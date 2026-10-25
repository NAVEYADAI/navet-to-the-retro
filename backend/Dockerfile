# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build && npm prune --production

# Stage 2: Production runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# Needed by Fly's release_command (fly.toml): `node scripts/db-migrate.js release` applies the migrations in
# prisma/migrations (the Prisma CLI is a production dependency for this reason). Nothing here runs when the app itself starts.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

ENV NODE_ENV=production
EXPOSE 5005

CMD ["node", "dist/main.js"]
