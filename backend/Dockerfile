FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Chrome, ChromeDriver, and existing requirements (e.g., psycopg2, cryptography)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    python3-dev \
    # Dependencies for Chrome/ChromeDriver, including gnupg for apt-key
    wget \
    unzip \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    libxrender1 \
    libxi6 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libgtk-3-0 \
    libgbm-dev \
    libasound2 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

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