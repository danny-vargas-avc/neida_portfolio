#!/bin/bash
# Local development. Starts the Django side; run the front end separately.
#
#   ./etc/start.sh            # admin + API on :8000
#   cd src/site && npm run dev   # the site on :3000
#
# The site proxies /api and /media to :8000, so both live on one origin exactly
# as they do behind nginx in production.
set -e

cd "$(dirname "$0")/../src/django"

if [ ! -d .venv ]; then
    echo "==> Creating virtualenv..."
    python3.12 -m venv .venv
    ./.venv/bin/pip install --quiet --upgrade pip
fi

echo "==> Installing dependencies..."
./.venv/bin/pip install --quiet -r requirements.txt

echo "==> Migrating..."
./.venv/bin/python manage.py migrate --noinput

# Safe to repeat: creates the eight sections if missing, leaves your words alone.
./.venv/bin/python manage.py seed_sections >/dev/null

if ! ./.venv/bin/python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
django.setup()
from django.contrib.auth.models import User
raise SystemExit(0 if User.objects.exists() else 1)
" 2>/dev/null; then
    echo ""
    echo "    No one can sign in to the admin yet. Create an account with:"
    echo "      cd src/django && ./.venv/bin/python manage.py createsuperuser"
    echo ""
fi

echo "==> Django on http://127.0.0.1:8000/admin/"
exec ./.venv/bin/python manage.py runserver
