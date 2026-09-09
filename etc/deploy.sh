#!/bin/bash
# Deploys (or redeploys) on the VPS. Run from anywhere: ./etc/deploy.sh
set -e

VPS_HOST="${VPS_HOST:-neida}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
COMPOSE="docker compose -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

echo "==> Starting containers on $VPS_HOST..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE up -d"

echo "==> Status..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE ps"

echo ""
echo "==> Recent web logs..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE logs web --tail 20"
