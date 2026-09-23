# ==============================================================================
# ONION BOY GAME: FRONTEND DOCKERFILE
# ==============================================================================

FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first for optimal layer caching
COPY package*.json ./
RUN npm install

# Copy source code and assets
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host binding enabled
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
