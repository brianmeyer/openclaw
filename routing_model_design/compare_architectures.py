"""
Compare multiple transformer architectures for query routing.
Tests: DistilBERT (baseline), TinyBERT, MobileBERT, RoBERTa-base
"""

import torch
from transformers import (
    DistilBertForSequenceClassification, DistilBertTokenizerFast,
    BertForSequenceClassification, BertTokenizerFast,
    RobertaForSequenceClassification, RobertaTokenizerFast,
    AutoModelForSequenceClassification, AutoTokenizer
)
from datasets import Dataset
from sklearn.metrics import classification_report, accuracy_score, f1_score
import numpy as np
import time
import json
from datetime import datetime

# Test configurations
MODEL_CONFIGS = [
    {
        "name": "distilbert-base-uncased",
        "model_class": DistilBertForSequenceClassification,
        "tokenizer_class": DistilBertTokenizerFast,
        "num_params": "66M",
        "description": "Baseline - distilled BERT"
    },
    {
        "name": "huawei-noah/TinyBERT_General_4L_312D",
        "model_class": AutoModelForSequenceClassification,
        "tokenizer_class": AutoTokenizer,
        "num_params": "14.5M",
        "description": "TinyBERT - 4 layers, 312 hidden"
    },
    {
        "name": "google/mobilebert-uncased",
        "model_class": AutoModelForSequenceClassification,
        "tokenizer_class": AutoTokenizer,
        "num_params": "25.3M",
        "description": "MobileBERT - optimized for mobile"
    },
    {
        "name": "distilbert-base-uncased-finetuned-sst-2-english",
        "model_class": AutoModelForSequenceClassification,
        "tokenizer_class": AutoTokenizer,
        "num_params": "66M",
        "description": "DistilBERT with sentiment pretraining"
    }
]

def quick_train_and_eval(config, dataset, device, epochs=2):
    """Quick training run (2 epochs) for comparison."""
    print(f"\n{'='*60}")
    print(f"Testing: {config['name']}")
    print(f"Description: {config['description']}")
    print(f"Parameters: {config['num_params']}")
    print(f"{'='*60}")
    
    # Load model and tokenizer
    try:
        if config['name'].startswith('distilbert-base-uncased') and not config['name'] == 'distilbert-base-uncased-finetuned-sst-2-english':
            tokenizer = config['tokenizer_class'].from_pretrained(config['name'])
            model = config['model_class'].from_pretrained(config['name'], num_labels=3)
        else:
            tokenizer = config['tokenizer_class'].from_pretrained(config['name'])
            model = config['model_class'].from_pretrained(config['name'], num_labels=3, ignore_mismatched_sizes=True)
    except Exception as e:
        print(f"ERROR loading {config['name']}: {e}")
        return None
    
    model = model.to(device)
    model.train()
    
    # Tokenize dataset
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)
    
    tokenized = dataset.map(tokenize_function, batched=True)
    tokenized = tokenized.remove_columns(["text"])
    tokenized.set_format("torch")
    
    # Simple training loop
    train_dataset = tokenized["train"]
    eval_dataset = tokenized["test"]
    
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
    
    # Training
    start_time = time.time()
    model.train()
    
    for epoch in range(epochs):
        total_loss = 0
        for i in range(0, len(train_dataset), 16):  # batch size 16
            batch = train_dataset[i:i+16]
            if len(batch['input_ids']) == 0:
                continue
                
            optimizer.zero_grad()
            
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device)
            
            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        print(f"  Epoch {epoch+1}/{epochs}, Loss: {total_loss:.4f}")
    
    train_time = time.time() - start_time
    
    # Evaluation
    model.eval()
    all_preds = []
    all_labels = []
    
    eval_start = time.time()
    with torch.no_grad():
        for i in range(0, len(eval_dataset), 16):
            batch = eval_dataset[i:i+16]
            if len(batch['input_ids']) == 0:
                continue
                
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device)
            
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            preds = torch.argmax(outputs.logits, dim=-1)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    
    eval_time = time.time() - eval_start
    
    # Metrics
    accuracy = accuracy_score(all_labels, all_preds)
    f1_macro = f1_score(all_labels, all_preds, average='macro')
    
    report = classification_report(all_labels, all_preds, 
                                   target_names=["fast_simple", "slow_complex", "voice"],
                                   output_dict=True)
    
    # Latency test
    test_text = "What's the weather like today?"
    inputs = tokenizer(test_text, return_tensors="pt", padding="max_length", 
                       truncation=True, max_length=128)
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Warmup
    for _ in range(10):
        with torch.no_grad():
            _ = model(**inputs)
    
    # Timing
    latencies = []
    for _ in range(100):
        start = time.perf_counter()
        with torch.no_grad():
            _ = model(**inputs)
        latencies.append((time.perf_counter() - start) * 1000)
    
    avg_latency = np.mean(latencies)
    p95_latency = np.percentile(latencies, 95)
    
    results = {
        "model": config['name'],
        "description": config['description'],
        "num_params": config['num_params'],
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "train_time_sec": train_time,
        "eval_time_sec": eval_time,
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency,
        "per_class_f1": {
            "fast_simple": report['fast_simple']['f1-score'],
            "slow_complex": report['slow_complex']['f1-score'],
            "voice": report['voice']['f1-score']
        }
    }
    
    print(f"  Accuracy: {accuracy:.4f}")
    print(f"  F1 Macro: {f1_macro:.4f}")
    print(f"  Avg Latency: {avg_latency:.2f}ms (p95: {p95_latency:.2f}ms)")
    print(f"  Train time: {train_time:.1f}s")
    
    return results

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # Load dataset
    dataset = Dataset.from_csv("routing_data.csv")
    dataset = dataset.train_test_split(test_size=0.2)
    
    print(f"Dataset: {len(dataset['train'])} train, {len(dataset['test'])} test")
    
    all_results = []
    
    for config in MODEL_CONFIGS:
        result = quick_train_and_eval(config, dataset, device, epochs=2)
        if result:
            all_results.append(result)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"model_comparison_{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"\n{'='*60}")
    print("COMPARISON SUMMARY")
    print(f"{'='*60}")
    print(f"{'Model':<45} {'F1':<8} {'Latency':<12} {'Params':<10}")
    print("-" * 75)
    
    for r in sorted(all_results, key=lambda x: x['f1_macro'], reverse=True):
        name = r['model'].split('/')[-1][:44]
        print(f"{name:<45} {r['f1_macro']:.4f}   {r['avg_latency_ms']:>6.1f}ms     {r['num_params']:<10}")
    
    print(f"\nResults saved to: {output_file}")
    
    # Recommendation
    if all_results:
        best_f1 = max(all_results, key=lambda x: x['f1_macro'])
        best_latency = min(all_results, key=lambda x: x['avg_latency_ms'])
        
        print(f"\n🏆 Best Accuracy/F1: {best_f1['model']} ({best_f1['f1_macro']:.4f})")
        print(f"⚡ Best Latency: {best_latency['model']} ({best_latency['avg_latency_ms']:.1f}ms)")

if __name__ == "__main__":
    main()
