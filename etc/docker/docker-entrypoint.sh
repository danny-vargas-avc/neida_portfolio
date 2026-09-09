#!/bin/bash
set -e

echo "==> Copying frontend build to shared volume..."
rm -rf /app/frontend-serve/*
cp -r /app/frontend-dist/* /app/frontend-serve/

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Running migrations..."
python manage.py migrate --noinput

# Safe to repeat: creates the eight sections if they are missing and leaves
# anything already written alone.
echo "==> Ensuring sections exist..."
python manage.py seed_sections

echo "==> Starting gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --access-logfile - \
    --error-logfile -
