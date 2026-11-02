#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

IMAGE_NAME="joodpakpaw-frontend"
CONTAINER_NAME="joodpakpaw_frontend"
HEALTH_URL="http://localhost:3000/capstone25/cp25nk2/"
MAX_RETRIES=10
RETRY_INTERVAL=5

echo "🚀 Deploying frontend container..."

# Backup current image for rollback
CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || echo "")
if [ -n "$CURRENT_IMAGE" ]; then
  echo "📦 Backing up current image..."
  docker tag "$CURRENT_IMAGE" "${IMAGE_NAME}:backup"
fi

# Pull latest code
git fetch origin main
git reset --hard origin/main

# Write .env for docker compose variable substitution
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}" > .env

# Build new image
docker compose -f docker-compose.yml build --no-cache

# Stop old container and start new one
docker compose -f docker-compose.yml down --remove-orphans
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker compose -f docker-compose.yml up -d --force-recreate

# Health check
echo "🏥 Running health check..."
HEALTHY=false
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  echo "  Attempt $i/$MAX_RETRIES - waiting ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

if [ "$HEALTHY" = true ]; then
  echo "✅ Frontend deployed successfully!"
  docker system prune -f
else
  echo "❌ Health check failed! Rolling back..."
  docker compose -f docker-compose.yml down
  if docker image inspect "${IMAGE_NAME}:backup" > /dev/null 2>&1; then
    docker tag "${IMAGE_NAME}:backup" "${IMAGE_NAME}:latest"
    docker compose -f docker-compose.yml up -d
    echo "⏪ Rolled back to previous version."
  else
    echo "⚠️ No backup image found. Manual intervention required."
  fi
  exit 1
fi
