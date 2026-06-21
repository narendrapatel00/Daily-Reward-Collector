# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy dependencies list first to leverage Docker cache layers
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy all frontend files and compile static assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Build Python Backend & Bundle App
# ==========================================
FROM python:3.10-slim

# Set environment variables to optimize Python performance inside Docker
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=10000
ENV BOT_MODE=simulation
ENV TARGET_URL=http://localhost:10000

WORKDIR /app

# Install download helpers and system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    curl \
    gnupg \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and install Google Chrome stable along with its dependencies automatically
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb --no-install-recommends \
    && rm ./google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Install python backend requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy built React files from Stage 1 into the designated static directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend files
COPY backend/ ./backend

# Change working directory to backend to run the Flask app
WORKDIR /app/backend

# Expose port (Render overrides this with dynamic PORT variable, defaulting to 10000)
EXPOSE 10000

# Start server
CMD ["python", "app.py"]
