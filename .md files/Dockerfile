# Multi-stage Dockerfile for Hair Diagnosis SaaS
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps (including dev deps) so we can run prisma generate and build
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy rest and build
COPY . .
# Generate Prisma client if present
RUN if [ -f package.json ]; then npx prisma generate || true; fi
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/server.js"]
