# Use Node.js 20 LTS
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including tsx for runtime)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start server with tsx (no build needed, saves memory)
CMD ["npx", "tsx", "src/server.ts"]

