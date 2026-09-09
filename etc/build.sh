#!/bin/bash
# Builds the image on the VPS. Run from anywhere: ./etc/build.sh
set -e

# Shares graze's VPS; the tunnel is what keeps them out of each other's way.
VPS_HOST="${VPS_HOST:-graze}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
# Paths are relative to DEPLOY_PATH, which the ssh command cds into first.
COMPOSE="docker compose --profile tunnel -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

echo "==> Pulling latest on $VPS_HOST..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && git pull"

echo "==> Building..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE build"

echo "==> Built. Run ./etc/deploy.sh to start it."
