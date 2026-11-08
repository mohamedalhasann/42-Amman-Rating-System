#!/usr/bin/env bash
# Build step for Render (or any host): Python deps, both frontends, database migrations.
set -euo pipefail
pip install -r backend/requirements.txt
(cd frontend && npm ci && npm run build)
(cd staff-frontend && npm ci && npm run build)
python backend/manage.py migrate --noinput
python backend/manage.py provision_staff
