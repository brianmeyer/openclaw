"""
Train TinyBERT with simple data augmentation (no NLTK dependency).
Goal: Improve accuracy on extended test set.
"""

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
from datasets import Dataset
from sklearn.metrics import classification_report
import numpy as np
import random
import time

# Simple augmentation without NLTK
SYNONYMS = {
    "weather": ["climate", "temperature", "forecast"],
    "time": ["hour", "clock", "moment"],
    "set": ["configure", "adjust", "put"],
    "help": ["assist", "aid", "support"],
    "write": ["create", "compose", "draft"],
    "debug": ["fix", "repair", "solve"],
    "explain": ["describe", "clarify", "elaborate"],
    "analyze": ["examine", "study", "investigate"],
    "create": ["make", "build", "generate"],
    "check": ["verify", "confirm", "validate"],
    "find": ["locate", "discover", "identify"],
    "show": ["display", "reveal", "present"],
    "tell": ["inform", "notify", "report"],
    "get": ["obtain", "acquire", "receive"],
    "make": ["create", "produce", "construct"],
}

def augment_text(text, aug_prob=0.15):
    """Simple synonym replacement augmentation."""
    words = text.split()
    if len(words) < 3:
        return text
    
    new_words = []
    for word in words:
        word_lower = word.lower()
        if random.random() < aug_prob and word_lower in SYNONYMS:
            synonym = random.choice(SYNONYMS[word_lower])
            # Preserve capitalization
            if word[0].isupper():
                synonym = synonym.capitalize()
            new_words.append(synonym)
        else:
            new_words.append(word)
    
    return ' '.join(new_words)

def augment_dataset(dataset, aug_factor=3):
    """Augment training data."""
    texts = dataset["text"]
    labels = dataset["label"]
    
    augmented_texts = list(texts)
    augmented_labels = list(labels)
    
    for _ in range(aug_factor - 1):
        for text, label in zip(texts, labels):
            aug_text = augment_text(text, aug_prob=0.15)
            if aug_text != text:
                augmented_texts.append(aug_text)
                augmented_labels.append(label)
            else:
                # If no change, add slight variation
                augmented_texts.append(text + " ")
                augmented_labels.append(label)
    
    return Dataset.from_dict({"text": augmented_texts, "label": augmented_labels})

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    report = classification_report(labels, predictions, output_dict=True, 
                                   target_names=["fast_simple", "slow_complex", "voice"])
    return {
        "accuracy": report["accuracy"],
        "f1_macro": report["macro avg"]["f1-score"],
    }

def train_augmented():
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Training on {device} with data augmentation")
    
    # Load model
    model_name = "huawei-noah/TinyBERT_General_4L_312D"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)
    model = model.to(device)
    
    # Load and augment data
    dataset = Dataset.from_csv("routing_data.csv")
    dataset = dataset.train_test_split(test_size=0.2)
    
    print(f"Original train size: {len(dataset['train'])}")
    augmented_train = augment_dataset(dataset["train"], aug_factor=3)
    print(f"Augmented train size: {len(augmented_train)}")
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)
    
    train_tokenized = augmented_train.map(tokenize_function, batched=True)
    test_tokenized = dataset["test"].map(tokenize_function, batched=True)
    
    # Class weights
    labels = augmented_train["label"]
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
    
    # Training with more epochs and better settings
    training_args = TrainingArguments(
        output_dir="./tinybert_augmented_results",
        num_train_epochs=10,  # More epochs
        per_device_train_batch_size=32,
        per_device_eval_batch_size=64,
        warmup_ratio=0.1,
        weight_decay=0.01,
        learning_rate=3e-5,
        logging_dir="./tinybert_augmented_logs",
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
    )
    
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=test_tokenized,
        compute_metrics=compute_metrics
    )
    
    print("Starting augmented training (10 epochs)...")
    start = time.time()
    trainer.train()
    train_time = time.time() - start
    
    # Save
    model.save_pretrained("./tinybert_augmented_final")
    tokenizer.save_pretrained("./tinybert_augmented_final")
    
    # Final eval
    results = trainer.evaluate()
    
    print(f"\nTraining complete in {train_time:.1f}s")
    print(f"Final results: {results}")
    print(f"Model saved to ./tinybert_augmented_final")
    
    return model, tokenizer

if __name__ == "__main__":
    train_augmented()
