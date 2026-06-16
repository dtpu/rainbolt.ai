FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# git is required to pip-install CLIP from GitHub; build-essential for native wheels
RUN apt-get update \
    && apt-get install -y --no-install-recommends git build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install CPU-only torch AND torchvision together from the same index. They must
# be co-versioned or torchvision's custom ops (e.g. torchvision::nms, used by
# CLIP) fail to load. Doing this first also avoids the multi-GB CUDA wheels and
# stops CLIP from pulling a mismatched torchvision off the default PyPI index.
# For GPU support, drop this line and use an nvidia/cuda base image instead.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && pip install -r requirements.txt

COPY . .

RUN mkdir -p uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
