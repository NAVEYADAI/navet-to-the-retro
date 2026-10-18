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

echo "🗄️  Production schema gate (read-only): is the live DB in sync with schema.prisma, or is the change approved?"
# The backend image applies schema changes itself, but ONLY an approved plan, in Fly's release step before the new
# version goes live (backend/fly.toml → release_command). This gate runs the same comparison up front so a deploy that
# the release step would refuse never starts. Unapproved change => stop; review it with `npm run schema:plan:prod`,
# approve with `npm run schema:approve:prod`, commit the approval, run this again.
# backend/.env is the DEVELOPMENT database now, so the production URL is NOT read from it: supply it for this run only,
#   PROD_DATABASE_URL='postgresql://…' ./deploy.sh      (or run this script under your secrets manager's prod environment)
if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "✖ PROD_DATABASE_URL is not set — refusing to deploy without checking the production schema."
  echo "  Provide it for this run only, e.g.: PROD_DATABASE_URL='…' ./deploy.sh"
  exit 1
fi
npm run schema:gate:prod --prefix backend

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
