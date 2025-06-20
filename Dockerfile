# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build:server
RUN npm prune --production

# Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5010
CMD ["node", "dist-server/server.js"]
