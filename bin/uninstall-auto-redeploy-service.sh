#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo ./bin/uninstall-auto-redeploy-service.sh"
  exit 1
fi

SERVICE_NAME="${SERVICE_NAME:-toyota-auto-redeploy}"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service"; then
  systemctl disable --now "$SERVICE_NAME" || true
fi

rm -f "$SERVICE_PATH"
systemctl daemon-reload

echo "Removed service: $SERVICE_NAME"
