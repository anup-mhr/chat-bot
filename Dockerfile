# -----------------------
# Stage 1: Base environment
# -----------------------
FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production

# -----------------------
# Stage 2: Copy project
# -----------------------
FROM base AS runtime

WORKDIR /usr/src/app

# Copy server files
COPY . .

# Ensure dist and livechat folders are available
# (If you build them externally and copy them in)
# If you want Docker to build React too, we can modify later.

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server.js"]
