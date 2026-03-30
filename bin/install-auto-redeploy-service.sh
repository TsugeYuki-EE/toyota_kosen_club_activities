#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo ./bin/install-auto-redeploy-service.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-toyota-auto-redeploy}"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
RUN_USER="${RUN_USER:-${SUDO_USER:-$USER}}"

if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "User does not exist: $RUN_USER"
  exit 1
fi

if [[ ! -x "$ROOT_DIR/bin/auto-redeploy.sh" ]]; then
  chmod +x "$ROOT_DIR/bin/auto-redeploy.sh"
fi

cat >"$SERVICE_PATH" <<EOF
[Unit]
Description=Toyota Kosen auto redeploy watcher
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$ROOT_DIR
Environment=ENV_FILE=$ROOT_DIR/.env.tunnel
Environment=INITIAL_DEPLOY=0
ExecStart=$ROOT_DIR/bin/auto-redeploy.sh
Restart=always
RestartSec=5
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$SERVICE_PATH"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo "Installed and started: $SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" || true
