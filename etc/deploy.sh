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

# nginx.conf is bind-mounted as a single file, and a bind mount of a file
# follows the inode. git pull replaces the file rather than editing it, so the
# container goes on serving the config it started with — `up -d` sees an
# unchanged service and leaves it running, and even `nginx -s reload` rereads
# the same stale inode. Recreating is what actually picks up a config change.
# Unconditional because comparing the two is more work than the second it costs.
echo "==> Recreating nginx to pick up any nginx.conf change..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE up -d --force-recreate nginx"

echo "==> Status..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE ps"

echo ""
echo "==> Recent web logs..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE logs web --tail 20"
