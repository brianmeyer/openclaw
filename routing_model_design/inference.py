import onnxruntime as ort
from transformers import DistilBertTokenizerFast
import numpy as np
import time
from functools import lru_cache

class QueryRouter:
    def __init__(self, model_path="routing_model_quantized.onnx", tokenizer_path="routing_model_final"):
        # Use Fast tokenizer
        self.tokenizer = DistilBertTokenizerFast.from_pretrained(tokenizer_path)
        
        # Optimize Session Options for Apple Silicon and Latency
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.intra_op_num_threads = 4 # Optimized for M1/M2 efficiency cores
        
        self.session = ort.InferenceSession(
            model_path, 
            sess_options=options,
            providers=['CPUExecutionProvider']
        )
        self.id_to_label = {0: "fast_simple", 1: "slow_complex", 2: "voice"}

    @lru_cache(maxsize=1000)
    def predict(self, text):
        start_time = time.perf_counter()
        
        # Tokenize (Fast)
        inputs = self.tokenizer(
            text, 
            return_tensors="np", 
            padding="max_length", 
            truncation=True, 
            max_length=64 # Reduced length for speed if queries are short
        )
        
        # Inference
        ort_inputs = {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"]
        }
        logits = self.session.run(None, ort_inputs)[0]
        
        # Post-process
        probs = self.softmax(logits)
        class_id = np.argmax(probs)
        label = self.id_to_label[class_id]
        confidence = probs[0][class_id]
        
        latency = (time.perf_counter() - start_time) * 1000
        
        return {
            "label": label,
            "confidence": float(confidence),
            "latency_ms": latency
        }

    @staticmethod
    def softmax(x):
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum(axis=1, keepdims=True)

if __name__ == "__main__":
    # Example usage (requires model file to exist)
    # router = QueryRouter()
    # print(router.predict("What's the weather like?"))
    print("Inference class defined.")
