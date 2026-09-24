#!/usr/bin/env bash
# Real one-command setup for a fresh deployment. Run this once after
# uploading the files to your host (via SSH, or your host's "Terminal"
# feature in cPanel if it has one).
#
#   bash deploy/setup.sh
#
# What it does, and why each step is needed:
#   1. Seeds the database (creates api/database.sqlite with demo data)
#   2. Fixes file ownership/permissions so the web server user can
#      actually WRITE to the database and uploads folder — this is the
#      single most common reason a fresh deployment looks broken (pages
#      load, but login/signup/checkout/anything that saves data fails
#      with a "readonly database" error) even though the code is correct.

set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Seeding the database..."
php api/seed.php

# Auto-detect the web server user — this varies by host:
#   Debian/Ubuntu + Apache or nginx: www-data
#   RHEL/CentOS + Apache:            apache
#   Many shared hosting (cPanel):    your cPanel username itself (files
#                                     you upload are usually already
#                                     owned correctly — this script is
#                                     mainly for VPS deployments)
WEB_USER="www-data"
if id "apache" &>/dev/null && ! id "www-data" &>/dev/null; then
  WEB_USER="apache"
fi

echo "==> Setting permissions so the web server ($WEB_USER) can write real data..."
echo "    (database writes, video uploads, email log, password resets, etc.)"

if [ "$(id -u)" -eq 0 ]; then
  chown -R "$WEB_USER:$WEB_USER" api uploads storage 2>/dev/null || true
fi
chmod -R 775 api uploads storage
chmod 664 api/database.sqlite 2>/dev/null || true

echo "==> Done."
echo ""
echo "Now visit yourdomain.com/check.html to verify the deployment is actually"
echo "wired together correctly (catches the two issues below automatically)."
echo ""
echo "If your host doesn't give you SSH/root access (most shared/cPanel"
echo "hosting), you can't run this script — instead, after uploading:"
echo "  1. Run 'php api/seed.php' once via your host's Terminal/Cron"
echo "     feature, or by briefly visiting a setup URL (see README)."
echo "  2. In cPanel's File Manager, right-click 'api' folder -> Permissions"
echo "     -> set to 775. Do the same for 'uploads' and 'storage'."
echo "  3. Right-click api/database.sqlite -> Permissions -> set to 664."
