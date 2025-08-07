# Step 1: Use Python base image
FROM python:3.11-slim

# Step 2: Set working directory
WORKDIR /app

# Step 3: Install system dependencies (optional, only if needed)
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Step 4: Copy requirements file
COPY requirements.txt .

# Step 5: Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Step 6: Copy application files including uploads
COPY . .

# Ensure uploads directory exists and is writable
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads

# Step 7: Expose FastAPI port
EXPOSE 8000

# Step 8: Run FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
