#!/bin/bash
# Exit immediately if any command fails
set -e

# Prepend Fly CLI to PATH
export PATH="$HOME/.fly/bin:$PATH"

echo "🗄️  Checking migrations (no destructive statement without an explicit acknowledgement)..."
npm run migrate:check --prefix backend

echo "🧪 Running backend unit tests..."
npm run test --prefix backend

echo "🧪 Running backend E2E tests..."
npm run test:e2e --prefix backend

echo "🧪 Running frontend component tests..."
npm run test --prefix frontend

echo "🧪 Running frontend E2E tests..."
npm run test:e2e --prefix frontend

# No production URL is needed here. Database changes ship as migrations (backend/prisma/migrations) that were created and
# tried in development; Fly's release_command (backend/fly.toml) applies the ones production has not run yet, in the NEW
# image before the new version goes live. A failing migration aborts the deploy and the running version is untouched.

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
