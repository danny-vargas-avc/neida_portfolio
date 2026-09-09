#!/bin/bash
# Runs docker compose against this project's files, from any directory.
#
#   ./etc/compose.sh up -d
#   ./etc/compose.sh exec web python manage.py createsuperuser
#   ./etc/compose.sh logs -f web
#   ./etc/compose.sh down
#
# The compose and env paths are relative to the repo root, so running the raw
# command from a subdirectory resolves them against the wrong place and fails
# with a doubled path like "etc/etc/docker/.env.production". This removes the
# chance of that.
set -e

cd "$(dirname "$0")/.."

ENV_FILE="etc/docker/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE" >&2
    echo "" >&2
    echo "  cp etc/docker/.env.production.example $ENV_FILE" >&2
    echo "  then fill it in — DJANGO_SECRET_KEY at minimum." >&2
    exit 1
fi

exec docker compose -f etc/docker/docker-compose.yml --env-file "$ENV_FILE" "$@"
