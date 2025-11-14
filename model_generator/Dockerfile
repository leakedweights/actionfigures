FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv vim curl && \
    rm -rf /var/lib/apt/lists/*

ARG PYTHON_ENV=my_env
ENV PYTHON_ENV=$PYTHON_ENV
ENV PATH="/opt/${PYTHON_ENV}/bin:$PATH"

RUN python3 -m venv /opt/${PYTHON_ENV}

COPY requirements.txt /

RUN pip install --no-cache-dir -r /requirements.txt

RUN pip install --no-cache-dir comfy-cli

COPY . .

EXPOSE 8188

# CORRECTED CMD: This runs the server, not the client script
CMD ["python3", "main.py", "--listen", "0.0.0.0", "--port", "8188", "--output-directory", "/output"]
