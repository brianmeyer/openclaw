#!/usr/bin/env python3
"""
Quick benchmark script for extended test set evaluation
"""
import sys
import json
import time
import torch
import numpy as np
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Load data
import csv
queries = []
with open('routing_data_extended.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        queries.append((row['text'], row['label']))

def benchmark_model(model_path, name):
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")
    
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path).to(device)
    model.eval()
    
    label_map = {0: 'fast_simple', 1: 'slow_complex', 2: 'voice'}
    correct = 0
    latencies = []
    
    for query, expected in queries:
        inputs = tokenizer(query, return_tensors="pt", truncation=True, max_length=128).to(device)
        
        start = time.perf_counter()
        with torch.no_grad():
            outputs = model(**inputs)
        end = time.perf_counter()
        
        latencies.append((end - start) * 1000)
        pred_idx = torch.argmax(outputs.logits, dim=1).item()
        
        # Handle both numeric and string labels in CSV
        reverse_map = {'fast_simple': 0, 'slow_complex': 1, 'voice': 2, '0': 0, '1': 1, '2': 2}
        expected_idx = int(reverse_map.get(expected, expected))
        
        if pred_idx == expected_idx:
            correct += 1
    
    accuracy = correct / len(queries)
    latencies = np.array(latencies)
    
    print(f"Accuracy: {accuracy:.4f} ({correct}/{len(queries)})")
    print(f"Latency: {np.mean(latencies):.2f}ms mean, {np.percentile(latencies, 95):.2f}ms p95")
    
    return {
        'model': name,
        'accuracy': accuracy,
        'latency_mean': float(np.mean(latencies)),
        'latency_p95': float(np.percentile(latencies, 95))
    }

results = []

# Test TinyBERT Augmented
if Path('./tinybert_augmented_final').exists():
    results.append(benchmark_model('./tinybert_augmented_final', 'TinyBERT-Augmented'))

# Test DistilBERT Baseline  
if Path('./routing_model_final').exists():
    results.append(benchmark_model('./routing_model_final', 'DistilBERT-Baseline'))

# Test ModernBERT
if Path('./modernbert_routing_final').exists():
    results.append(benchmark_model('./modernbert_routing_final', 'ModernBERT'))

print(f"\n{'='*60}")
print("COMPARISON")
print(f"{'='*60}")
for r in sorted(results, key=lambda x: x['accuracy'], reverse=True):
    print(f"{r['model']:25} Acc: {r['accuracy']:.2%}  Latency: {r['latency_mean']:.2f}ms")

# Save results
with open('extended_benchmark_results.json', 'w') as f:
    json.dump(results, f, indent=2)
print("\nResults saved to extended_benchmark_results.json")
