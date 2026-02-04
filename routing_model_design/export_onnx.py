import torch
from transformers import DistilBertForSequenceClassification, DistilBertTokenizerFast
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

def export_to_onnx():
    model_path = "./routing_model_final"
    onnx_path = "routing_model.onnx"
    quantized_path = "routing_model_quantized.onnx"

    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    tokenizer = DistilBertTokenizerFast.from_pretrained(model_path)
    model.eval()

    # Dummy input for export
    dummy_input = tokenizer("This is a test query", return_tensors="pt")
    
    # Export the model
    torch.onnx.export(
        model,
        (dummy_input["input_ids"], dummy_input["attention_mask"]),
        onnx_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["output"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "output": {0: "batch_size"}
        },
        opset_version=14 # Use newer opset for better Apple Silicon support
    )
    print(f"Model exported to {onnx_path}")

    # Quantize to QInt8 (signed) - better performance on modern CPUs/NPUs
    # Using weight_type=QuantType.QInt8 instead of QUInt8
    quantize_dynamic(
        onnx_path,
        quantized_path,
        weight_type=QuantType.QInt8,
        reduce_range=True # Optimization for per-channel quantization
    )
    print(f"Quantized (QInt8) model saved to {quantized_path}")

if __name__ == "__main__":
    export_to_onnx()
