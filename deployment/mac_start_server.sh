#!/bin/bash
# Lolo V4: Mac-Optimized OpenAI-Compatible Server
# Utilizes llama-cpp-python with Metal GPU acceleration

# CHANGE 1: Just the path to the model, nothing else!
MODEL_PATH="./models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

echo "🚀 Starting local Llama 3.1 API server on M4 Metal GPU..."

# We set n_gpu_layers to -1 to force 100% of the model onto the GPU
# We set n_ctx to 8192 to give the agent plenty of memory for RAG documents
python -m llama_cpp.server \
    --model ${MODEL_PATH} \
    --n_gpu_layers -1 \
    --n_ctx 8192 \
    --host 0.0.0.0 \
    --port 8000 \
    --chat_format llama-3