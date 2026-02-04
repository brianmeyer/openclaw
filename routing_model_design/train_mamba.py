#!/usr/bin/env python3
"""
Train a Mamba architecture model for query routing
"""
import torch
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    TrainingArguments, 
    Trainer,
    DataCollatorWithPadding
)
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score

# Load extended dataset
df = pd.read_csv('routing_data_extended.csv')
print(f"Loaded {len(df)} examples")
print(f"Class distribution:\n{df['label'].value_counts().sort_index()}")

# Split data
train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['label'])
print(f"\nTrain: {len(train_df)}, Test: {len(test_df)}")

# Try to load Mamba model
model_name = "state-spaces/mamba-130m"

try:
    print(f"\nLoading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, 
        num_labels=3,
        trust_remote_code=True
    )
    
    print(f"Model loaded: {model.__class__.__name__}")
    print(f"Parameters: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
    output_dir = "./mamba_routing_final"
    
except Exception as e:
    print(f"Failed to load Mamba: {e}")
    print("\nFalling back to ModernBERT (Mamba-like efficiency characteristics)...")
    
    model_name = "answerdotai/ModernBERT-base"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=3,
        ignore_mismatched_sizes=True
    )
    print(f"Using ModernBERT fallback")
    print(f"Parameters: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
    output_dir = "./modernbert_routing_v2"

# Prepare datasets
def prepare_dataset(df):
    texts = df['text'].tolist()
    labels = df['label'].astype(int).tolist()
    
    encodings = tokenizer(texts, truncation=True, padding=False, max_length=128)
    encodings['labels'] = labels
    return Dataset.from_dict(encodings)

train_dataset = prepare_dataset(train_df)
test_dataset = prepare_dataset(test_df)

# Data collator
data_collator = DataCollatorWithPadding(tokenizer)

# Metrics
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    
    acc = accuracy_score(labels, predictions)
    f1 = f1_score(labels, predictions, average="macro")
    
    return {
        "accuracy": acc,
        "f1_macro": f1
    }

# Training arguments
training_args = TrainingArguments(
    output_dir=output_dir,
    learning_rate=3e-5,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=64,
    num_train_epochs=5,
    weight_decay=0.01,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    logging_steps=10,
    report_to="none",
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics,
)

# Train
print("\nStarting training...")
trainer.train()

# Final evaluation
print("\n" + "="*60)
print("FINAL EVALUATION")
print("="*60)
results = trainer.evaluate()
print(f"Accuracy: {results['eval_accuracy']:.4f}")
print(f"F1 Macro: {results['eval_f1_macro']:.4f}")

# Save model
trainer.save_model(output_dir)
print(f"\nModel saved to {output_dir}")

# Test on examples
print("\nSample predictions:")
test_queries = [
    "What's the weather today?",
    "Write a Python function to sort a list",
    "Um, like, can you help me with something...",
    "Hi",
    "HELP ME PLEASE"
]

label_names = ['fast_simple', 'slow_complex', 'voice']
for query in test_queries:
    inputs = tokenizer(query, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    pred = torch.argmax(outputs.logits, dim=1).item()
    conf = torch.softmax(outputs.logits, dim=1).max().item()
    print(f"  '{query}' -> {label_names[pred]} ({conf:.2f})")
