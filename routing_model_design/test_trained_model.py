"""
Test the trained DistilBERT model with real-world query examples.
Measure accuracy on test set and latency distribution.
"""

import torch
from transformers import DistilBertForSequenceClassification, DistilBertTokenizerFast
from datasets import Dataset
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np
import time
import json

# Real test queries by category
TEST_QUERIES = {
    "fast_simple": [
        "What's the weather?",
        "Set a timer for 5 minutes",
        "What time is it?",
        "Turn off the lights",
        "What's on my calendar today?",
        "Remind me to call mom",
        "Play some music",
        "What's 15 times 23?",
        "Define 'serendipity'",
        "Send a text to Brian",
        "What's the news?",
        "Set an alarm for 7am",
        "What's the stock price of AAPL?",
        "How many ounces in a cup?",
        "Translate 'hello' to Spanish",
    ],
    "slow_complex": [
        "Analyze this Python code and find the bug",
        "Write a function to sort a list of dictionaries by multiple keys",
        "Explain the tradeoffs between REST and GraphQL",
        "Help me design a database schema for a social media app",
        "Refactor this function to use async/await",
        "Compare React vs Vue for a large enterprise app",
        "Debug why my Docker container keeps crashing",
        "Create a regex that matches valid email addresses",
        "Explain how Bitcoin's proof of work actually works",
        "Help me optimize this SQL query",
        "Review this architecture diagram and suggest improvements",
        "Write a unit test for this function",
        "Explain the difference between concurrency and parallelism",
        "Help me set up a CI/CD pipeline for this project",
        "Analyze the time complexity of this algorithm",
    ],
    "voice": [
        "Um, hey, can you like... remind me about that thing?",
        "Wait, no, actually, what I meant was... what's the weather?",
        "You know, that restaurant we went to last time... what was it called?",
        "I'm thinking... maybe... should I call him or text him?",
        "Like, I don't know, I just feel like... can you help me decide?",
        "So, uh, I was wondering if maybe you could... never mind",
        "Actually, wait, scratch that — I need something else",
        "Hey, um, do you remember when we talked about...",
        "I'm not sure how to say this but...",
        "Can you just... I mean, like, help me with something?",
        "You know what, forget it... actually no, wait",
        "I have this problem but it's hard to explain...",
        "What's that word for when you... never mind",
        "So here's the thing, right...",
        "I was gonna ask you something but I forgot",
    ]
}

def test_model(model_path="./routing_model_final"):
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Testing on device: {device}")
    
    # Load model
    tokenizer = DistilBertTokenizerFast.from_pretrained(model_path)
    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    model = model.to(device)
    model.eval()
    
    # Load test dataset
    dataset = Dataset.from_csv("routing_data.csv")
    dataset = dataset.train_test_split(test_size=0.2)
    test_data = dataset["test"]
    
    # Tokenize test data
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)
    
    tokenized = test_data.map(tokenize_function, batched=True)
    tokenized.set_format("torch", columns=["input_ids", "attention_mask", "label"])
    
    # Run evaluation
    all_preds = []
    all_labels = []
    latencies = []
    
    print("\nRunning evaluation on test set...")
    with torch.no_grad():
        for i in range(len(tokenized)):
            item = tokenized[i]
            
            input_ids = item['input_ids'].unsqueeze(0).to(device)
            attention_mask = item['attention_mask'].unsqueeze(0).to(device)
            label = item['label'].item()
            
            # Time inference
            start = time.perf_counter()
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            latency = (time.perf_counter() - start) * 1000
            
            pred = torch.argmax(outputs.logits, dim=-1).item()
            
            all_preds.append(pred)
            all_labels.append(label)
            latencies.append(latency)
    
    # Report
    print("\n" + "="*60)
    print("TEST SET EVALUATION")
    print("="*60)
    
    target_names = ["fast_simple", "slow_complex", "voice"]
    print(classification_report(all_labels, all_preds, target_names=target_names))
    
    print("\nConfusion Matrix:")
    cm = confusion_matrix(all_labels, all_preds)
    print(f"{'':>15} {'pred fast':>10} {'pred slow':>10} {'pred voice':>10}")
    for i, name in enumerate(target_names):
        print(f"{'true '+name:>15} {cm[i][0]:>10} {cm[i][1]:>10} {cm[i][2]:>10}")
    
    print(f"\nLatency Statistics:")
    print(f"  Mean: {np.mean(latencies):.2f}ms")
    print(f"  P50: {np.percentile(latencies, 50):.2f}ms")
    print(f"  P95: {np.percentile(latencies, 95):.2f}ms")
    print(f"  P99: {np.percentile(latencies, 99):.2f}ms")
    print(f"  Min: {np.min(latencies):.2f}ms")
    print(f"  Max: {np.max(latencies):.2f}ms")
    
    # Test on curated examples
    print("\n" + "="*60)
    print("CURATED QUERY TESTS")
    print("="*60)
    
    label_map = {0: "fast_simple", 1: "slow_complex", 2: "voice"}
    results = []
    
    for true_label, queries in TEST_QUERIES.items():
        print(f"\n{true_label.upper()} queries:")
        correct = 0
        for query in queries:
            inputs = tokenizer(query, return_tensors="pt", padding="max_length",
                              truncation=True, max_length=128)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = model(**inputs)
                pred_label = torch.argmax(outputs.logits, dim=-1).item()
                pred_name = label_map[pred_label]
                probs = torch.softmax(outputs.logits, dim=-1)[0]
                confidence = probs[pred_label].item()
            
            match = "✓" if pred_name == true_label else "✗"
            if pred_name == true_label:
                correct += 1
            
            results.append({
                "query": query,
                "true_label": true_label,
                "predicted": pred_name,
                "confidence": confidence,
                "correct": pred_name == true_label
            })
            
            print(f"  {match} '{query[:50]}...' -> {pred_name} ({confidence:.2f})")
        
        accuracy = correct / len(queries)
        print(f"  Accuracy: {correct}/{len(queries)} ({accuracy:.1%})")
    
    # Summary
    total_correct = sum(1 for r in results if r['correct'])
    total = len(results)
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Overall accuracy on curated tests: {total_correct}/{total} ({total_correct/total:.1%})")
    print(f"Average confidence on correct predictions: {np.mean([r['confidence'] for r in results if r['correct']]):.2f}")
    print(f"Average confidence on incorrect predictions: {np.mean([r['confidence'] for r in results if not r['correct']]):.2f}")
    
    # Save detailed results
    with open("test_results_detailed.json", 'w') as f:
        json.dump({
            "test_set": {
                "accuracy": sum(1 for a, p in zip(all_labels, all_preds) if a == p) / len(all_labels),
                "latencies": {
                    "mean_ms": float(np.mean(latencies)),
                    "p95_ms": float(np.percentile(latencies, 95)),
                    "p99_ms": float(np.percentile(latencies, 99))
                }
            },
            "curated_tests": results
        }, f, indent=2)
    
    print(f"\nDetailed results saved to: test_results_detailed.json")

if __name__ == "__main__":
    test_model()
