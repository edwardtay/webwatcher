# Use Node.js 20 LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (keep tsx for runtime)
RUN npm ci

# Copy source code
COPY . .

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start the server using tsx runtime (no build needed)
CMD ["npm", "run", "start:prod"]

