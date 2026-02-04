"""
Train ModernBERT for query routing.
ModernBERT: Updated BERT architecture with better efficiency.
"""

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
from datasets import Dataset
from sklearn.metrics import classification_report
import numpy as np
import time

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    report = classification_report(labels, predictions, output_dict=True,
                                   target_names=["fast_simple", "slow_complex", "voice"])
    return {
        "accuracy": report["accuracy"],
        "f1_macro": report["macro avg"]["f1-score"],
    }

def train_modernbert():
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Training ModernBERT on {device}")
    
    # ModernBERT models
    model_name = "answerdotai/ModernBERT-base"  # 149M params, efficient
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)
        model = model.to(device)
        print(f"✓ Loaded {model_name}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return None
    
    # Load data
    dataset = Dataset.from_csv("routing_data.csv")
    dataset = dataset.train_test_split(test_size=0.2)
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)
    
    tokenized = dataset.map(tokenize_function, batched=True)
    
    # Class weights
    labels = dataset["train"]["label"]
    class_counts = np.bincount(labels)
    total_samples = len(labels)
    class_weights = total_samples / (len(class_counts) * class_counts)
    weights = torch.tensor(class_weights, dtype=torch.float).to(device)
    
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
            labels = inputs.get("labels")
            outputs = model(**inputs)
            logits = outputs.get("logits")
            loss_fct = torch.nn.CrossEntropyLoss(weight=weights)
            loss = loss_fct(logits.view(-1, self.model.config.num_labels), labels.view(-1))
            return (loss, outputs) if return_outputs else loss
    
    # Training
    training_args = TrainingArguments(
        output_dir="./modernbert_results",
        num_train_epochs=5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        warmup_steps=100,
        weight_decay=0.01,
        learning_rate=2e-5,
        logging_dir="./modernbert_logs",
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
    )
    
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["test"],
        compute_metrics=compute_metrics
    )
    
    print("\nTraining ModernBERT...")
    start = time.time()
    trainer.train()
    train_time = time.time() - start
    
    # Save
    model.save_pretrained("./modernbert_routing_final")
    tokenizer.save_pretrained("./modernbert_routing_final")
    
    # Eval
    results = trainer.evaluate()
    
    print(f"\nTraining complete in {train_time:.1f}s")
    print(f"Results: {results}")
    
    # Test latency
    test_text = "What's the weather today?"
    inputs = tokenizer(test_text, return_tensors="pt", padding="max_length",
                      truncation=True, max_length=128)
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Warmup
    for _ in range(10):
        with torch.no_grad():
            _ = model(**inputs)
    
    # Time it
    latencies = []
    for _ in range(100):
        start = time.perf_counter()
        with torch.no_grad():
            _ = model(**inputs)
        latencies.append((time.perf_counter() - start) * 1000)
    
    print(f"Latency: {np.mean(latencies):.2f}ms (p95: {np.percentile(latencies, 95):.2f}ms)")
    
    return model, tokenizer

if __name__ == "__main__":
    train_modernbert()
