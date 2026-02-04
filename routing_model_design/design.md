# Routing Model Architecture Design

This document outlines the architecture for a DistilBERT-based routing model designed to classify queries into three categories: **Fast/Simple**, **Slow/Complex**, and **Voice**.

## 1. Base Model Selection
- **Model:** `distilbert-base-uncased`
- **Why:** 40% fewer parameters than BERT, 60% faster, while retaining 97% of its performance. Ideal for local inference with low latency.

## 2. Architecture
- **Input:** Raw query text (max sequence length: 64 for inference speed).
- **Head:** Linear layer on top of the `[CLS]` token output.
- **Output Classes:**
    1. `fast_simple`: Factual questions, simple commands, greetings, status checks.
    2. `slow_complex`: Multi-step reasoning, coding tasks, creative writing, complex analysis, memory-heavy queries.
    3. `voice`: Conversational, short-form, high-context queries often containing disfluencies. This class is also used to trigger the Gemini Live session handoff.

## 3. Training Pipeline
- **Data Generation:** Synthetic data generation producing 500+ examples per class using diverse templates.
- **Tokenizer:** `DistilBertTokenizerFast` for improved training and inference speed.
- **Imbalance Handling:** Implementation of `WeightedTrainer` using class-based loss weights to ensure robust performance across all categories.
- **Metrics:** Evaluation using F1-Macro, Precision, and Recall via `classification_report`.

## 4. Optimization
- **Format:** ONNX (Opset 14).
- **Quantization:** QInt8 (signed) quantization using `onnxruntime` to reduce model size (~16MB) and optimize for Apple Silicon CPU/NPU performance.
- **Inference Engine:** `onnxruntime` with `GraphOptimizationLevel.ORT_ENABLE_ALL`.
- **Latency Optimization:** < 10ms target, achieved via Fast Tokenizer, reduced sequence length, and LRU caching for repeat queries.

## 5. Deployment
- **Local Loading:** Single `routing_model_quantized.onnx` file and a `routing_model_final` directory for tokenizer configuration.
- **Caching:** In-memory LRU cache for 1000 most recent queries.

## 6. Expected Metrics
- **Latency:** < 10ms on modern CPU (M1/M2 Mac).
- **Accuracy:** > 95% on balanced synthetic test set.
- **Size:** ~16MB (Quantized ONNX).
