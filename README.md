# Toyota Kosen Club Activities

ハンドボールアプリと卓球アプリを1つの入口に統合した運用用プロジェクトです。

## 構成

- `apps/handball`: 既存ハンドボールアプリ
- `apps/table-tennis`: 既存卓球アプリ
- `gateway/server.cjs`: 部活選択画面と内部プロキシ
- `docker-compose.yml`: 統合起動設定

## 仕様

- 初回アクセスで部活を選択（ハンドボール or 卓球）
- 選択後はそれぞれの既存ログイン画面へ遷移
- ログイン/ユーザ登録時に部活パスワードを追加
  - ハンドボール: `hand`
  - 卓球: `ttc`
- `admin` の追加確認パスワードは既存どおり `devdev`
- データベースは部活ごとに分離
  - `handball_notes`
  - `table_tennis_notes`

## データ永続化

`docker-compose.yml` では PostgreSQL の named volume `postgres_data` を使用します。

- `docker compose down` ではデータは消えません
- データを消す場合のみ `docker compose down -v` を使用

## 自動バックアップ（1時間ごと、最大3日）

`db-backup` サービスが次のポリシーで自動バックアップします。

- ハンドボールDB: 1時間ごとに保存
- 卓球DB: 1時間ごとに保存
- 保持期間: 最大3日（72世代）
- 保存先ディレクトリ（競技ごとに分離）:
  - `backups/handball`
  - `backups/table-tennis`

  軽量運用のため、`db-backup` は `profile: backup` を指定した場合のみ起動されます。

  バックアップ有効化の起動例:

  ```bash
  docker compose --profile backup up -d
  ```

## 外部DBを使わない運用

この統合構成はローカル PostgreSQL コンテナを前提にしています。

- ゲートウェイ内部で接続先をローカルDB固定にしています
- 外部DB接続が不要な運用にできます
- `apps/handball/.env` と `apps/table-tennis/.env` もローカル接続先に変更済み

## 既存データを外部DBからローカルへ移す

既存の外部DBデータを引き継ぐ場合は、次のスクリプトを使います。

`scripts/migrate-external-to-local.ps1`

実行例:

```powershell
cd toyota_kosen_club_activities
./scripts/migrate-external-to-local.ps1 \
  -HandballSourceDatabaseUrl "postgresql://USER:PASSWORD@HOST:5432/DBNAME" \
  -TableTennisSourceDatabaseUrl "postgresql://USER:PASSWORD@HOST:5432/DBNAME"
```

このスクリプトは次を行います。

- ローカル PostgreSQL コンテナ起動
- 現在のローカルDBを `backups/before-migration-日時/` にバックアップ
- 外部DBの内容をローカル `handball_notes` / `table_tennis_notes` へ投入

## 起動方法（Raspberry Pi 含む）

```bash
cd toyota_kosen_club_activities
docker compose up --build -d
```

標準の `docker compose up` は省メモリ設定で起動されます。

- PostgreSQL: `shared_buffers=64MB`, `max_connections=40`
- アプリ (gateway): `NODE_OPTIONS=--max-old-space-size=256`
- 子アプリ (handball / table-tennis): `--max-old-space-size=384`

Raspberry Pi でビルド時にメモリ不足が起きる場合:

```bash
docker compose build --build-arg BUILD_NODE_OPTIONS=--max-old-space-size=1024 app
docker compose up -d
```

DB 初期化済みで起動時間を短縮したい場合（マイグレーションをスキップ）:

```bash
RUN_DB_MIGRATIONS=false docker compose up -d
```

アクセス先:

- http://localhost:3000

停止:

```bash
docker compose down
```

ログ確認:

```bash
docker compose logs -f app
```

## 環境変数（必要に応じて）

`docker-compose.yml` の `app.environment` で変更できます。

- `PUBLIC_BASE_URL`
- `HANDBALL_ADMIN_VIEW_KEY`
- `TABLE_TENNIS_ADMIN_VIEW_KEY`

## Cloudflare 公開の最短手順

1. `.env.tunnel.example` を `.env.tunnel` にコピーして編集

```bash
cp .env.tunnel.example .env.tunnel
```

`.env.tunnel`:

```env
CLOUDFLARE_TUNNEL_TOKEN=あなたのトークン
PUBLIC_BASE_URL=https://toyotakosenclubnotes.cc
```

2. ローカルサービスを起動

```bash
docker compose up -d --build
```

3. Tunnel を起動

```bash
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

4. 確認

```bash
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml ps
docker compose --env-file .env.tunnel -f docker-compose.yml -f docker-compose.tunnel.yml logs -f cloudflared
```
