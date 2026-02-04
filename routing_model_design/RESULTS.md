# Routing Model Training Results

## Completed Work (2026-02-04)

### 1. Baseline DistilBERT Model Trained ✅

**Training Config:**
- Model: distilbert-base-uncased
- Epochs: 5
- Batch size: 32
- Max length: 128
- Weighted loss for class balance

**Results on Test Set (330 examples):**
- Accuracy: **100%**
- F1 Macro: **1.00**
- All classes perfectly classified

**Latency (MPS/Apple Silicon):**
- Mean: 8.72ms
- Median (P50): 3.95ms
- P95: 4.52ms
- P99: 4.71ms

### 2. Curated Query Testing ✅

Tested 45 real-world queries across 3 categories:

| Category | Accuracy | Notes |
|----------|----------|-------|
| fast_simple | 86.7% (13/15) | 2 false positives to slow_complex |
| slow_complex | 100% (15/15) | Perfect |
| voice | 100% (15/15) | Perfect |
| **Overall** | **95.6%** | **43/45 correct** |

**Misclassifications:**
- "Send a text to Brian" → slow_complex (confidence 0.57)
- "Translate 'hello' to Spanish" → slow_complex (confidence 0.94)

Both errors are conservative (routed to slower model). Safe behavior.

### 3. Architecture Comparison ✅ COMPLETE

Tested 4 models with 2-epoch quick training:

| Model | Params | Accuracy | Latency | Status |
|-------|--------|----------|---------|--------|
| **TinyBERT** | **14.5M** | **100%** | **2.4ms** | 🏆 **WINNER** |
| DistilBERT | 66M | 100% | 6.5ms | ✅ Baseline |
| MobileBERT | 25.3M | 27.8% | 14.2ms | ❌ Failed |
| DistilBERT-SST | 66M | 100% | 11.8ms | ✅ Slow |

**Winner: TinyBERT** — Same accuracy, but:
- **2.7x faster** inference (2.4ms vs 6.5ms)
- **4.5x smaller** (14.5M vs 66M params)
- **3.6x faster** training (13.6s vs 49s)

### 4. ONNX Export ⚠️

Blocked: onnxruntime not available for Python 3.14 on Apple Silicon.
Workaround: Use PyTorch inference (4ms latency acceptable).

## Files Generated

```
routing_model_design/
├── routing_model_final/          # Trained model (267MB)
│   ├── model.safetensors
│   ├── tokenizer.json
│   └── config.json
├── results/                      # Training checkpoints
│   ├── checkpoint-42/
│   ├── checkpoint-84/
│   ├── checkpoint-126/
│   ├── checkpoint-168/
│   └── checkpoint-210/
├── test_results_detailed.json    # Curated test results
├── compare_architectures.py      # Multi-model comparison script
└── test_trained_model.py         # Evaluation script
```

## Recommendations

1. **🏆 Use TinyBERT** — 100% accuracy, 2.4ms inference, 14.5M params
2. **Skip ONNX for now** — PyTorch latency acceptable (<3ms)
3. **Add confidence threshold** — Route low-confidence (<0.7) to slow_complex
4. **Train TinyBERT for 5 epochs** — Comparison was only 2 epochs, full training may improve further

## Next Steps

- [x] Architecture comparison complete — **TinyBERT wins**
- [ ] Train TinyBERT for 5 epochs (comparison was 2 epochs)
- [ ] Export TinyBERT to ONNX (if runtime available)
- [ ] Implement confidence thresholding
- [ ] Integrate router into main pipeline
- [ ] Test with real traffic
