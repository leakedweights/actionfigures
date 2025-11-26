# Build argument for CUDA version (12.1 or 12.8)
ARG CUDA_VERSION=12.8

# Conditional base image selection
FROM nvidia/cuda:${CUDA_VERSION}.0-runtime-ubuntu22.04 AS cuda-12.8
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS cuda-12.1

# Select the appropriate base
FROM cuda-${CUDA_VERSION} AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv vim curl wget && \
    rm -rf /var/lib/apt/lists/*

ARG PYTHON_ENV=my_env
ENV PYTHON_ENV=$PYTHON_ENV
ENV PATH="/opt/${PYTHON_ENV}/bin:$PATH"

RUN python3 -m venv /opt/${PYTHON_ENV}

COPY requirements.txt /

# Conditional PyTorch installation based on CUDA version
ARG CUDA_VERSION
RUN if [ "$CUDA_VERSION" = "12.8" ]; then \
    pip install --no-cache-dir torch torchvision torchaudio torchsde --extra-index-url https://download.pytorch.org/whl/cu128; \
    else \
    pip install --no-cache-dir torch torchvision torchaudio torchsde; \
    fi

# Install remaining requirements (excluding torch packages)
RUN grep -v '^torch' /requirements.txt > /requirements-filtered.txt && \
    pip install --no-cache-dir -r /requirements-filtered.txt

RUN pip install --no-cache-dir comfy-cli

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8188

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python3", "main.py", "--listen", "0.0.0.0", "--port", "8188", "--output-directory", "/output"]
