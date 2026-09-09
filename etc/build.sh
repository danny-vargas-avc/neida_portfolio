#!/bin/bash
# Builds the image on the VPS. Run from anywhere: ./etc/build.sh
set -e

# Shares graze's VPS; the tunnel is what keeps them out of each other's way.
VPS_HOST="${VPS_HOST:-graze}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
# Paths are relative to DEPLOY_PATH, which the ssh command cds into first.
COMPOSE="docker compose --profile tunnel -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

echo "==> Pulling latest on $VPS_HOST..."
# -A forwards your local SSH agent for this command, so the VPS pulls with your
# GitHub identity and holds no credential of its own. Requires the origin remote
# to be the SSH URL and a key loaded locally (ssh-add -l). --ff-only so a
# divergence stops here rather than opening a merge in a non-interactive shell.
if ! ssh -A "$VPS_HOST" "cd $DEPLOY_PATH && git pull --ff-only"; then
  echo ""
  echo "Pull failed. Check that a key is loaded locally (ssh-add -l) and that"
  echo "the remote on $VPS_HOST is the SSH URL, not https://github.com/..."
  exit 1
fi

echo "==> Building..."
ssh "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE build"

echo "==> Built. Run ./etc/deploy.sh to start it."
