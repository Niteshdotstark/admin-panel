# Use Python 3.11 slim
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (essential for psycopg2, cryptography, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements FIRST to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create and set permissions for uploads directory
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads

# Expose port
EXPOSE 8000

# Run with uvicorn (for production, use gunicorn + uvicorn workers)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]