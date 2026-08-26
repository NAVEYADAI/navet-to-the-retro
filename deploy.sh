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
