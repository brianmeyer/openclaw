#!/usr/bin/env python3
"""
Clean Graphiti import - conversation only.
Extracts: user messages + assistant text responses
Ignores: thinking blocks, tool calls, tool outputs, system events
"""
import json
import requests
import sys
from datetime import datetime

SESSION_FILE = "/Users/brianmeyer/.openclaw/agents/main/sessions/df454f33-2d59-493a-97ae-80c7de0ea0df.jsonl"
GRAPHITI_URL = "http://localhost:8001"

def extract_text(content_parts):
    """Extract only text content, ignore thinking/tool blocks."""
    texts = []
    for part in content_parts:
        if isinstance(part, dict):
            # Only keep actual text responses, skip thinking/tool blocks
            if part.get('type') == 'text':
                texts.append(part.get('text', ''))
            # Skip: thinking, toolCall, toolResult, etc.
    return ' '.join(texts).strip()

def main():
    print("📥 CLEAN IMPORT - Conversation Only")
    print("=" * 50)
    
    # Read session
    entries = []
    with open(SESSION_FILE, 'r') as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                entries.append(entry)
            except:
                continue
    
    print(f"Total entries in session: {len(entries)}")
    
    # Extract conversation pairs only
    conversations = []
    for entry in entries:
        if entry.get('type') != 'message':
            continue
        
        msg = entry.get('message', {})
        role = msg.get('role', '')
        content = msg.get('content', [])
        
        # Skip non-conversation roles
        if role not in ('user', 'assistant'):
            continue
        
        text = extract_text(content)
        if not text or len(text) < 10:  # Skip empty/short messages
            continue
        
        # Get timestamp
        ts = entry.get('timestamp', '')
        if isinstance(ts, (int, float)):
            ts = datetime.fromtimestamp(ts/1000).isoformat()
        
        conversations.append({
            'role': role,
            'text': text,
            'timestamp': ts
        })
    
    print(f"Conversation messages found: {len(conversations)}")
    print(f"  - User messages: {sum(1 for c in conversations if c['role'] == 'user')}")
    print(f"  - Assistant messages: {sum(1 for c in conversations if c['role'] == 'assistant')}")
    print()
    
    # Import to Graphiti
    imported = 0
    failed = 0
    
    for i, conv in enumerate(conversations, 1):
        # Format: "User: <text>" or "Assistant: <text>"
        content = f"{conv['role'].upper()}: {conv['text']}"
        name = f"{conv['role']}_{i}_{conv['timestamp'][:10] if conv['timestamp'] else 'unknown'}"
        
        try:
            resp = requests.post(
                f"{GRAPHITI_URL}/messages",
                json={"name": name, "content": content},
                timeout=30
            )
            result = resp.json()
            
            if result.get('status') == 'added':
                imported += 1
                print(f"✅ [{i}/{len(conversations)}] Added {conv['role']} message")
            else:
                failed += 1
                print(f"❌ [{i}/{len(conversations)}] Failed: {result.get('error', 'unknown')}")
                
        except Exception as e:
            failed += 1
            print(f"❌ [{i}/{len(conversations)}] Error: {str(e)[:40]}")
    
    print()
    print("=" * 50)
    print(f"DONE: {imported} imported, {failed} failed")
    
    # Final count
    try:
        health = requests.get(f"{GRAPHITI_URL}/health", timeout=5).json()
        print(f"Graphiti status: {health.get('status', 'unknown')}")
    except:
        pass
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
