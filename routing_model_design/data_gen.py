import pandas as pd
import json

def generate_synthetic_data_template():
    """
    Template for generating 500+ examples per class using an LLM.
    """
    templates = {
        "fast_simple": [
            "What time is it?",
            "Hello",
            "Turn on the lights",
            "What is 2+2?",
            "Who is the president?",
            "Set a timer for 5 minutes",
            "Weather in New York",
            "Stop music",
            "What's my battery level?",
            "Read my last text",
            "How's the traffic to work?",
            "Tell me a joke",
            "Is it raining?",
            "Volume up",
            "Mute"
        ],
        "slow_complex": [
            "Explain the theory of relativity in simple terms for a child.",
            "Write a Python script to scrape a website and save data to CSV.",
            "Compare the economic policies of the 1920s vs the 2020s.",
            "Debug this code: print(x) where x is undefined.",
            "Design a microservices architecture for an e-commerce platform.",
            "Write a short story about a robot learning to feel emotions.",
            "Analyze the themes of power in Shakespeare's Macbeth.",
            "How do I set up a Kubernetes cluster on AWS?",
            "Summarize the latest research on CRISPR gene editing.",
            "Plan a 7-day trip to Tokyo including hidden gems.",
            "Write a formal apology email to a client for a missed deadline."
        ],
        "voice": [
            "Hey buddy, can you like, tell me what's next on my calendar?",
            "Uh, remind me to buy milk when I get to the store, thanks.",
            "So, what do you think about that thing we talked about earlier?",
            "Yo, play some chill music for me.",
            "Can you... um... find that recipe for the pasta?",
            "Wait, what did you just say?",
            "Actually, never mind, stop.",
            "Hey, are you there?",
            "Can you tell me more about... uh... that movie?",
            "Okay, sounds good, do that."
        ]
    }
    
    # Guidance for LLM Generation
    print("Use the following prompt to generate the full dataset:")
    print("-" * 50)
    print("""
    Generate 500 synthetic user queries for each of the following categories:
    1. 'fast_simple': Short, direct commands, factual questions, greetings.
    2. 'slow_complex': Multi-step reasoning, coding, long-form writing, analysis.
    3. 'voice': Conversational, informal, contains disfluencies (uh, um, like), or brief verbal confirmations.
    
    Format the output as a JSON object with keys as category names and values as lists of strings.
    """)
    print("-" * 50)

if __name__ == "__main__":
    generate_synthetic_data_template()
