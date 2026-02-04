"""
Test all model architectures on the extended test set (822 examples).
Compare: TinyBERT, DistilBERT, and Mamba if available.
"""

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from datasets import Dataset
from sklearn.metrics import classification_report, accuracy_score
import numpy as np
import time
import json

def test_model_on_extended(model_path, model_name, extended_data_path="routing_data_extended.csv"):
    """Test any model on extended test set."""
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"Testing: {model_name}")
    print(f"Model path: {model_path}")
    print(f"{'='*60}")
    
    try:
        # Load model
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        model = model.to(device)
        model.eval()
        
        # Load extended test set
        dataset = Dataset.from_csv(extended_data_path)
        
        # Test
        y_true = []
        y_pred = []
        latencies = []
        
        id_to_label = {0: "fast_simple", 1: "slow_complex", 2: "voice"}
        
        for item in dataset:
            text = item["text"]
            true_label = item["label"]
            
            # Tokenize
            inputs = tokenizer(text, return_tensors="pt", padding="max_length", 
                             truncation=True, max_length=128)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            # Predict with timing
            start = time.perf_counter()
            with torch.no_grad():
                outputs = model(**inputs)
            latency = (time.perf_counter() - start) * 1000
            
            pred_label = torch.argmax(outputs.logits, dim=-1).item()
            
            y_true.append(id_to_label[true_label])
            y_pred.append(id_to_label[pred_label])
            latencies.append(latency)
        
        accuracy = accuracy_score(y_true, y_pred)
        
        print(f"Accuracy: {accuracy:.4f}")
        print(f"Latency: mean={np.mean(latencies):.2f}ms, p95={np.percentile(latencies, 95):.2f}ms")
        print("\nClassification Report:")
        print(classification_report(y_true, y_pred))
        
        return {
            "model": model_name,
            "accuracy": accuracy,
            "latency_mean": float(np.mean(latencies)),
            "latency_p95": float(np.percentile(latencies, 95)),
            "test_size": len(dataset)
        }
        
    except Exception as e:
        print(f"ERROR: {e}")
        return {"model": model_name, "error": str(e)}

def main():
    results = []
    
    # Test TinyBERT (5 epoch)
    results.append(test_model_on_extended(
        "./tinybert_routing_final", 
        "TinyBERT (5 epoch)"
    ))
    
    # Test DistilBERT (original baseline)
    results.append(test_model_on_extended(
        "./routing_model_final",
        "DistilBERT (baseline)"
    ))
    
    # Save results
    with open("extended_test_comparison.json", 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for r in results:
        if "error" not in r:
            print(f"{r['model']:<25} Acc: {r['accuracy']:.4f}  Latency: {r['latency_mean']:.2f}ms")
        else:
            print(f"{r['model']:<25} ERROR: {r['error']}")

if __name__ == "__main__":
    main()
