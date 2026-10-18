#!/bin/bash
# Exit immediately if any command fails
set -e

# Prepend Fly CLI to PATH
export PATH="$HOME/.fly/bin:$PATH"

echo "🧪 Running backend unit tests..."
npm run test --prefix backend

echo "🧪 Running backend E2E tests..."
npm run test:e2e --prefix backend

echo "🧪 Running frontend component tests..."
npm run test --prefix frontend

echo "🧪 Running frontend E2E tests..."
npm run test:e2e --prefix frontend

echo "🗄️  Checking that the production DB schema matches schema.prisma (read-only)..."
# Prod never runs `prisma db push` on its own. If the live DB is behind the schema this stops the deploy
# BEFORE new code ships against tables/columns that don't exist. Fix = an approved push on production, then re-run.
# backend/.env is the DEVELOPMENT database now, so the production URL is NOT read from it: supply it for this run only,
#   PROD_DATABASE_URL='postgresql://…' ./deploy.sh      (or run this script under your secrets manager's prod environment)
if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "✖ PROD_DATABASE_URL is not set — refusing to deploy without checking the production schema."
  echo "  Provide it for this run only, e.g.: PROD_DATABASE_URL='…' ./deploy.sh"
  exit 1
fi
npm run schema:check:prod --prefix backend

echo "🚀 Starting deployment of all services to Fly.io..."

echo "================================"
echo "📦 1/2: Deploying BACKEND..."
echo "================================"
cd backend
fly deploy
cd ..

echo "================================"
echo "📦 2/2: Deploying FRONTEND..."
echo "================================"
cd frontend
fly deploy
cd ..

echo "🎉 Deployment completed successfully!"
