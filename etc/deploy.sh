#!/bin/bash
# Deploys (or redeploys) on the VPS. Run from anywhere: ./etc/deploy.sh
set -e

# Shares graze's VPS; the tunnel is what keeps them out of each other's way.
VPS_HOST="${VPS_HOST:-graze}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
# Paths are relative to DEPLOY_PATH, which the ssh command cds into first.
COMPOSE="docker compose --profile tunnel -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

echo "==> Starting containers on $VPS_HOST..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE up -d"

echo "==> Status..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE ps"

echo ""
echo "==> Recent web logs..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE logs web --tail 20"
