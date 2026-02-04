"""
Train TinyBERT for 5 epochs (full training) for query routing.
Architecture: 4 layers, 312 hidden dim, 14.5M params
"""

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
from datasets import Dataset
from sklearn.metrics import classification_report, accuracy_score, f1_score
import numpy as np
import time
import json

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    report = classification_report(labels, predictions, output_dict=True, target_names=["fast_simple", "slow_complex", "voice"])
    return {
        "accuracy": report["accuracy"],
        "f1_macro": report["macro avg"]["f1-score"],
        "precision_macro": report["macro avg"]["precision"],
        "recall_macro": report["macro avg"]["recall"],
    }

def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Training on device: {device}")
    
    # Load TinyBERT
    model_name = "huawei-noah/TinyBERT_General_4L_312D"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)
    model = model.to(device)
    
    # Load dataset
    dataset = Dataset.from_csv("routing_data.csv")
    dataset = dataset.train_test_split(test_size=0.2)
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)
    
    tokenized_datasets = dataset.map(tokenize_function, batched=True)
    
    # Class weights for balance
    labels = dataset["train"]["label"]
    class_counts = np.bincount(labels)
    total_samples = len(labels)
    class_weights = total_samples / (len(class_counts) * class_counts)
    weights = torch.tensor(class_weights, dtype=torch.float).to(device)
    
    # Custom trainer with weighted loss
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
            labels = inputs.get("labels")
            outputs = model(**inputs)
            logits = outputs.get("logits")
            loss_fct = torch.nn.CrossEntropyLoss(weight=weights)
            loss = loss_fct(logits.view(-1, self.model.config.num_labels), labels.view(-1))
            return (loss, outputs) if return_outputs else loss
    
    # Training args - 5 epochs for full training
    training_args = TrainingArguments(
        output_dir="./tinybert_results",
        num_train_epochs=5,
        per_device_train_batch_size=32,
        per_device_eval_batch_size=32,
        warmup_steps=100,
        weight_decay=0.01,
        logging_dir="./tinybert_logs",
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro"
    )
    
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["test"],
        compute_metrics=compute_metrics
    )
    
    print("Starting TinyBERT 5-epoch training...")
    start_time = time.time()
    trainer.train()
    train_time = time.time() - start_time
    
    # Save model
    model.save_pretrained("./tinybert_routing_final")
    tokenizer.save_pretrained("./tinybert_routing_final")
    
    print(f"Training complete in {train_time:.1f}s")
    print(f"Model saved to ./tinybert_routing_final")
    
    # Final eval
    eval_results = trainer.evaluate()
    print(f"\nFinal evaluation: {eval_results}")
    
    # Save results
    with open("tinybert_5epoch_results.json", 'w') as f:
        json.dump({
            "train_time_sec": train_time,
            "eval_results": eval_results,
            "model": "TinyBERT_4L_312D",
            "epochs": 5
        }, f, indent=2)
    
    return model, tokenizer

if __name__ == "__main__":
    train()
