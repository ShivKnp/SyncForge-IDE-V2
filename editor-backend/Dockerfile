# Use a stable Node.js version as the base image
FROM node:18-bullseye

# Set working dir
WORKDIR /app

# Install system dependencies required for compiling and running code
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-jre \
    default-jdk \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first to leverage Docker cache
COPY package*.json ./

# Install dependencies (including dev deps so "npm run dev" works inside container)
RUN npm install

# Copy application source
COPY . .

# Expose port used by your app
EXPOSE 8080

# Simple healthcheck so Docker can mark container unhealthy quickly
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start in dev mode by default (nodemon). For production, use: CMD ["npm","start"]
CMD ["npm", "run", "dev"]
