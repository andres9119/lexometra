#!/usr/bin/env bash
# ── Lexometra — Deployment Script ─────────────────────
# Run on the VPS after cloning the repository.
# Requires: Ubuntu 22.04+, Python 3.13+, PostgreSQL 16+
#
# Usage:
#   sudo bash deploy.sh
#
# Before running:
#   1. Fill in /home/lexometra/lexometra/.env with real values
#   2. Make sure PostgreSQL is running and the database/user exist
# ───────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="/home/lexometra/lexometra"
VENV_DIR="/home/lexometra/.venv"
SERVICE_NAME="lexometra"
NGINX_SITE="lexometra"

echo "==> 1. System dependencies"
apt-get update
apt-get install -y --no-install-recommends \
    python3.13 python3.13-venv python3.13-dev \
    postgresql-client libpq-dev \
    nginx certbot python3-certbot-nginx \
    build-essential libpango1.0-dev libcairo2-dev libffi-dev

echo "==> 2. Create system user (if not exists)"
id -u lexometra &>/dev/null || useradd -m -s /bin/bash lexometra

echo "==> 3. Python virtual environment"
python3.13 -m venv "$VENV_DIR"
chown -R lexometra:lexometra "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel
"$VENV_DIR/bin/pip" install -r "$REPO_DIR/requirements.txt"

echo "==> 4. Environment file"
if [ ! -f "$REPO_DIR/.env" ]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    echo "  >>> Edit $REPO_DIR/.env with production values and re-run this script."
    exit 1
fi

echo "==> 5. Static files"
mkdir -p "$REPO_DIR/staticfiles" "$REPO_DIR/media" "$REPO_DIR/logs"
cd "$REPO_DIR"
"$VENV_DIR/bin/python" manage.py collectstatic --noinput --clear

echo "==> 6. Database migration"
"$VENV_DIR/bin/python" manage.py migrate --noinput

echo "==> 7. Create superuser (optional)"
"$VENV_DIR/bin/python" manage.py createsuperuser --noinput \
    --username admin \
    --email admin@lexometra.local 2>/dev/null || true

echo "==> 8. Permissions"
chown -R lexometra:lexometra "$REPO_DIR"

echo "==> 9. Gunicorn systemd service"
cp "$REPO_DIR/gunicorn.service" /etc/systemd/system/lexometra.service
systemctl daemon-reload
systemctl enable lexometra
systemctl restart lexometra

echo "==> 10. Nginx"
cp "$REPO_DIR/nginx_lexometra.conf" /etc/nginx/sites-available/lexometra
if [ ! -L /etc/nginx/sites-enabled/lexometra ]; then
    ln -s /etc/nginx/sites-available/lexometra /etc/nginx/sites-enabled/
fi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "=== Deployment complete! ==="
echo "  Site:  https://$(grep server_name /etc/nginx/sites-available/lexometra | head -1 | awk '{print $2}')"
echo "  Logs:  journalctl -u lexometra -f"
echo ""
echo "  Next steps (manual):"
echo "    1. sudo certbot --nginx -d lexometra.tudominio.com"
echo "    2. Check journalctl -u lexometra -f for errors"
echo "    3. Visit /admin/ to verify"
