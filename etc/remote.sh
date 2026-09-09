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

VPS_HOST="${VPS_HOST:-neida}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/neida}"
COMPOSE="docker compose -f etc/docker/docker-compose.yml --env-file etc/docker/.env.production"

ssh -t "$VPS_HOST" "cd $DEPLOY_PATH && $COMPOSE $*"
