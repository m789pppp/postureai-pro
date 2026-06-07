# PostureAI Pro — Production Dockerfile
FROM python:3.11-slim

# Security: non-root user
RUN groupadd -r postureai && useradd -r -g postureai postureai

# System deps for OpenCV + MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libgomp1 libgcc-s1 wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .
RUN mkdir -p reports && chown -R postureai:postureai /app

USER postureai

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5050/api/health || exit 1

EXPOSE 5050

# Production: Gunicorn with 4 workers, eventlet for concurrent WebSocket support
# Tuned for 1.5GB RAM container: 4 workers × 2 threads = 8 concurrent requests
CMD ["gunicorn",      "--workers", "4",      "--threads", "2",      "--worker-class", "sync",      "--timeout", "120",      "--keep-alive", "5",      "--max-requests", "1000",      "--max-requests-jitter", "100",      "--bind", "0.0.0.0:5050",      "--access-logfile", "-",      "--error-logfile", "-",      "--log-level", "info",      "--preload",      "backend:app"]
