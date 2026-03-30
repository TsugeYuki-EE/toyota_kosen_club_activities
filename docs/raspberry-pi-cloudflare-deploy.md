# Raspberry Pi + Cloudflare デプロイ手順

対象ドメイン: toyotakosenclubnotes.cc

## 推奨構成

- 公開方式は Cloudflare Tunnel を推奨
- ルーターのポート開放は不要
- アプリ本体は localhost bind（127.0.0.1:3000）
- 外部からは Cloudflare 経由の HTTPS のみ
- Tunnel 構成では `FORCE_HTTPS=true` で HTTP を HTTPS へ 301 リダイレクト

## 1. Raspberry Pi の事前準備

### 1-1. システム更新

```bash
sudo apt update
sudo apt upgrade -y
```

### 1-2. 必須ツールのインストール

```bash
sudo apt install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  wget \
  vim \
  net-tools
```

### 1-3. Docker のインストール

**Docker 公式リモジトリを追加:**

```bash
# Docker 公式 GPP キーを追加
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# リモジトリを追加（Raspberry Pi は bookworm または bullseye）
echo \
  "deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# リポジトリ更新
sudo apt update
```

**Docker インストール:**

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**Docker が起動しているか確認:**

```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo docker run hello-world
```

### 1-4. Docker をユーザーで実行可能に

```bash
sudo usermod -aG docker $USER
newgrp docker
```

確認:
```bash
docker run hello-world
```

### 1-5. Docker Compose プラグイン（docker compose コマンド）

前のステップで `docker-compose-plugin` をインストール済みなので、以下で確認:

```bash
docker compose version
```

### 1-6. Cloudflare Tunnel クライアント（cloudflared）のインストール

**リポジトリを追加:**

```bash
# 以前の誤った定義がある場合は削除
sudo rm -f /etc/apt/sources.list.d/cloudflare-main.list
sudo rm -f /etc/apt/sources.list.d/cloudflared.list

curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# trixie の場合は cloudflared リポジトリが未提供のことがあるため bookworm を利用
CF_DISTRO="$(lsb_release -cs)"
if [ "$CF_DISTRO" = "trixie" ]; then
  CF_DISTRO="bookworm"
fi

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared ${CF_DISTRO} main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update
```

**インストール:**

```bash
sudo apt install -y cloudflared
```

`apt update` で 404 が出る場合（ディストリ未対応時）は、公式バイナリを直接インストール:

```bash
ARCH="$(dpkg --print-architecture)"
if [ "$ARCH" = "arm64" ]; then
  PKG_ARCH="arm64"
elif [ "$ARCH" = "armhf" ]; then
  PKG_ARCH="arm"
else
  echo "Unsupported architecture: $ARCH"; exit 1
fi

wget -O cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${PKG_ARCH}.deb"
sudo dpkg -i cloudflared.deb || sudo apt -f install -y
rm -f cloudflared.deb
```

**動作確認:**

```bash
cloudflared --version
```

### 1-7. Docker ディスク容量最適化（オプション）

Raspberry Pi は容量が限られているため、ストレージ効率を上げる:

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF

sudo systemctl restart docker
```

### 1-8. スワップ設定（オプション、ラズパイ 4GB 以下の場合）

```bash
# dphys-swapfile が無い場合は先にインストール
sudo apt update
sudo apt install -y dphys-swapfile

# 2GB に設定
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile

sudo dphys-swapfile swapoff
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# 状態確認
swapon --show
free -h
```

もし `dphys-swapfile` パッケージが使えない環境なら、汎用 swapfile を作成:

```bash
sudo swapoff -a
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

swapon --show
free -h
```

### 1-9. OS 自動更新の有効化（セキュリティ推奨）

```bash
sudo apt install -y unattended-upgrades apt-listchanges

sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "\${distro_id}:\${distro_codename}-security";
  "\${distro_id}ESMApps:\${distro_codename}-apps-security";
  "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::Mail "root";
Unattended-Upgrade::MailReport "on-change";
EOF

sudo systemctl enable unattended-upgrades
sudo systemctl restart unattended-upgrades
```

## 2. プロジェクト配置

```bash
cd /opt
git clone <your-repo-url> toyota_kosen_club_activities
cd toyota_kosen_club_activities
```

## 3. Cloudflare Tunnel を作成

1. Cloudflare Zero Trust の Dashboard で Tunnel を作成
2. Public Hostname を追加
   - Hostname: toyotakosenclubnotes.cc
   - Service: http://app:3000
3. 発行された Tunnel Token を控える

## 4. 環境変数ファイルを作成

`/opt/toyota_kosen_club_activities/.env.tunnel` を作成:

```env
CLOUDFLARE_TUNNEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_BASE_URL=https://toyotakosenclubnotes.cc
```

## 5. アプリを起動

```bash
cd /opt/toyota_kosen_club_activities
docker compose up -d --build
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

## 6. 動作確認

```bash
docker compose ps
docker compose logs -f app
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs -f cloudflared
```

ブラウザで以下を確認:

- https://toyotakosenclubnotes.cc

Cloudflare 側の SSL/TLS 設定推奨:

- SSL/TLS mode: `Full`（または `Full (strict)`）
- Edge Certificates: `Always Use HTTPS` を ON
- HSTS は十分に確認後に ON

## セキュリティ推奨

- Cloudflare Access で管理画面パス（/admin）をIPまたはメール認証で制限
- Cloudflare WAF を有効化（Bot Fight Mode, Managed Rules）
- OS自動更新を有効化（unattended-upgrades）
- 不要サービス停止、SSH鍵認証化、パスワードログイン無効化
- `.env.tunnel` は git 管理対象外にする
- 定期的に Docker イメージ更新:

```bash
docker compose pull
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml pull
docker compose up -d
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

## バックアップ

本プロジェクトでは DB バックアップを1時間ごとに自動実行:

- backups/handball
- backups/table-tennis

3日分（最大72世代）を保持します。

## トラブルシュート

- cloudflared が接続できない:
  - Tunnel Token の誤りを確認
  - Zero Trust 側で Public Hostname が `app:3000` を向いているか確認
- ドメインが開かない:
  - Cloudflare DNS で対象レコードが Proxy ON か確認
- app が再起動ループ:
  - `docker compose logs --tail=200 app` で Prisma エラー確認
  - `docker compose up -d --build app` で再ビルド

- `no space left on device` でビルド失敗:
  - まず容量確認:

```bash
df -h
docker system df
```

  - 使っていないイメージ/ビルダーキャッシュのみ削除（DBボリュームは消さない）:

```bash
docker image prune -a -f
docker builder prune -a -f
docker container prune -f
```

  - それでも不足する場合は、`/var/lib/docker` を大容量ストレージへ移設するか、SSD利用を推奨
