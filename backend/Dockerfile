# Backend Dockerfile
FROM node:20-slim

WORKDIR /app

# Build dependencies for sqlite3 (native module)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install dependencies (reproducible, no lockfile mutation)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

EXPOSE 5000

CMD ["node", "server.js"]
