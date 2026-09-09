#!/bin/bash
# Runs a docker compose subcommand on the VPS.
#
#   ./etc/remote.sh ps
#   ./etc/remote.sh logs web --tail 50
#   ./etc/remote.sh exec web python manage.py createsuperuser
#
# ssh -t allocates a terminal, without which interactive commands like
# createsuperuser cannot prompt for a password.
set -e

# Shares graze's VPS; the tunnel is what keeps them out of each other's way.
VPS_HOST="${VPS_HOST:-graze}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
COMPOSE="docker compose --profile tunnel -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

ssh -t "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE $*"
