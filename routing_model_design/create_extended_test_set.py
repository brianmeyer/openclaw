"""
Create extended test set with 1000+ examples for thorough evaluation.
Mix of synthetic and realistic edge cases.
"""

import csv
import random

# Templates for each class
FAST_SIMPLE_TEMPLATES = [
    # Weather queries
    "What's the weather?", "Is it raining?", "Weather forecast", "What's the temperature?",
    "Will it snow today?", "Do I need an umbrella?", "How hot is it outside?",
    # Time/Date
    "What time is it?", "What's today's date?", "Set alarm for 7am", "Timer 5 minutes",
    "What day is it?", "When is sunset?", "Set a reminder for 3pm",
    # Basic facts
    "How many ounces in a cup?", "What's the capital of France?", "Define serendipity",
    "How many days in February?", "What's 15 times 23?", "Convert 100C to F",
    # Media control
    "Play some jazz", "Skip this song", "Turn up the volume", "What's playing?",
    # Home control
    "Turn on the lights", "Set thermostat to 72", "Turn off bedroom light",
    # Simple lookups
    "What's the stock price of AAPL?", "Latest news headlines", "What's Bitcoin at?",
]

SLOW_COMPLEX_TEMPLATES = [
    # Code analysis
    "Analyze this Python code and find the bug",
    "Debug why my Docker container keeps crashing",
    "Explain this error: NullPointerException",
    "Review my React component for performance issues",
    "What's wrong with this SQL query execution plan?",
    
    # Code generation
    "Write a function to sort a list of dictionaries by multiple keys",
    "Create a regex that matches valid email addresses but not IPs",
    "Generate a Python decorator for caching function results",
    "Write a unit test for this async function",
    "Implement a thread-safe singleton in Java",
    
    # Architecture/Design
    "Explain the tradeoffs between REST and GraphQL for a mobile app",
    "Compare React vs Vue for a large enterprise app with 100+ devs",
    "Help me design a database schema for a social media app with 10M users",
    "Should I use microservices or monolith for this architecture?",
    "Design a caching strategy for this read-heavy workload",
    
    # Optimization
    "Help me optimize this SQL query that's taking 5 seconds",
    "Analyze the time complexity of this recursive algorithm",
    "Profile this code and suggest memory optimizations",
    "How can I reduce the bundle size of this React app?",
    "Optimize this API endpoint for sub-100ms response time",
    
    # DevOps/Infrastructure
    "Set up a CI/CD pipeline for this Node.js project",
    "Configure nginx as a reverse proxy with rate limiting",
    "Help me set up Kubernetes deployment with health checks",
    "Troubleshoot this intermittent 502 Bad Gateway error",
    "Design a blue-green deployment strategy for zero downtime",
    
    # System design
    "Explain how Bitcoin's proof of work consensus actually works",
    "Design a distributed rate limiter",
    "How would you build a real-time chat system for 1M concurrent users?",
    "Explain CAP theorem and help me choose for my use case",
    "Design a URL shortener that handles 100M requests/day",
]

VOICE_TEMPLATES = [
    # Hesitation patterns
    "Um, hey, can you like... remind me about that thing?",
    "Wait, no, actually, what I meant was... what's the weather?",
    "I'm thinking... maybe... should I call him or text him?",
    "So, uh, I was wondering if maybe you could... never mind",
    "Actually, wait, scratch that — I need something else",
    
    # Conversational/disfluent
    "You know, that restaurant we went to last time... what was it called?",
    "Like, I don't know, I just feel like... can you help me decide?",
    "Hey, um, do you remember when we talked about...",
    "I'm not sure how to say this but...",
    "Can you just... I mean, like, help me with something?",
    
    # Self-correction
    "You know what, forget it... actually no, wait",
    "I have this problem but it's hard to explain...",
    "What's that word for when you... never mind",
    "So here's the thing, right...",
    "I was gonna ask you something but I forgot",
    
    # Filler-heavy
    "Well, um, you see, the thing is, I need to, like, find out about...",
    "Okay so, uh, basically, what I'm trying to say is...",
    "It's kind of, you know, like, complicated but...",
    "I don't really know how to put this but, um...",
    "So, like, I was thinking maybe, possibly, could you...",
]

def generate_variations(template, count=5):
    """Generate slight variations of a template."""
    variations = [template]
    
    # Add punctuation variations
    if not template.endswith('?'):
        variations.append(template + '?')
    if not template.endswith('.'):
        variations.append(template + '.')
    
    # Add capitalization variations
    variations.append(template.lower())
    variations.append(template.capitalize())
    
    # Add filler words
    fillers = ["Hey, ", "Can you ", "Please ", "I need to ", "Help me "]
    for filler in fillers[:2]:
        if not template.startswith(filler.strip()):
            variations.append(filler + template.lower())
    
    return variations[:count]

def create_extended_test_set():
    examples = []
    
    # Generate 400 fast_simple examples
    for template in FAST_SIMPLE_TEMPLATES:
        variations = generate_variations(template, count=8)
        for v in variations:
            examples.append((v, 0))
    
    # Add more random combinations
    for _ in range(100):
        base = random.choice(FAST_SIMPLE_TEMPLATES)
        examples.append((base, 0))
    
    # Generate 400 slow_complex examples  
    for template in SLOW_COMPLEX_TEMPLATES:
        variations = generate_variations(template, count=8)
        for v in variations:
            examples.append((v, 1))
    
    for _ in range(100):
        base = random.choice(SLOW_COMPLEX_TEMPLATES)
        examples.append((base, 1))
    
    # Generate 300 voice examples
    for template in VOICE_TEMPLATES:
        variations = generate_variations(template, count=10)
        for v in variations:
            examples.append((v, 2))
    
    # Add voice variations with different fillers
    fillers = ["um", "uh", "like", "you know", "so", "well", "basically"]
    for _ in range(100):
        base = random.choice([
            "what's the weather", "remind me about that thing", 
            "I need help with something", "can you tell me"
        ])
        filler_count = random.randint(1, 3)
        selected_fillers = random.sample(fillers, filler_count)
        text = ", ".join(selected_fillers) + ", " + base + "?"
        examples.append((text, 2))
    
    # Shuffle
    random.shuffle(examples)
    
    # Write to CSV
    with open('routing_data_extended.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['text', 'label'])
        for text, label in examples:
            writer.writerow([text, label])
    
    print(f"Generated {len(examples)} examples:")
    print(f"  fast_simple (0): {sum(1 for _, l in examples if l == 0)}")
    print(f"  slow_complex (1): {sum(1 for _, l in examples if l == 1)}")
    print(f"  voice (2): {sum(1 for _, l in examples if l == 2)}")
    print(f"\nSaved to routing_data_extended.csv")
    
    return examples

if __name__ == "__main__":
    create_extended_test_set()
