# Raspberry Pi + Cloudflare デプロイ手順

対象ドメイン: toyotakosenclubnotes.cc

## 推奨構成

- 公開方式は Cloudflare Tunnel を推奨
- ルーターのポート開放は不要
- アプリ本体は localhost bind（127.0.0.1:3000）
- 外部からは Cloudflare 経由の HTTPS のみ
- Tunnel 構成では `FORCE_HTTPS=true` で HTTP を HTTPS へ 301 リダイレクト

## 1. Raspberry Pi の事前準備

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# 反映のため一度ログアウト/ログイン
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
