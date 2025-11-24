#!/bin/sh
set -e

MODEL_DIR="/models/checkpoints"
MODEL_FILE="hunyuan3d-dit-v2-1.safetensors"
REPO_URL="https://huggingface.co/Comfy-Org/hunyuan3D_2.1_repackaged/resolve/main/hunyuan_3d_v2.1.safetensors"

mkdir -p "$MODEL_DIR"

if [ ! -f "$MODEL_DIR/$MODEL_FILE" ]; then
  echo "The Hunyuan3D model not found..."
  wget -O "$MODEL_DIR/$MODEL_FILE" "$REPO_URL"
  echo "Dowload finised."
else
  echo "The Hunyuan3D dowloaded."
fi

exec "$@"
