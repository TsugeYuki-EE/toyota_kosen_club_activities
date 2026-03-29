# Toyota Table Tennis Notes

卓球部向けの管理アプリです。
部員・マネージャー・コーチ・管理者が、出席、体重、試合スコア、目標、連絡事項を一元管理できます。

## 主な機能

- ニックネームでの登録・ログイン
- カレンダーでの日別予定確認と出席提出
- 体重入力と体重推移の確認
- 試合スコア管理（試合別・部員別サマリー）
- 個人得点入力
- 管理者通達の表示
- リリースノート管理/閲覧
- フィードバック送信/閲覧

## 現在のWebページ構成

### 部員向け

- `/auth`: ニックネーム登録とログイン
- `/`: メイン画面（カレンダー、通達、目標表示、フィードバック導線）
- `/calendar/[date]`: 日別確認（予定・出席状況・自分の出席提出）
- `/self/profile`: プロフィールと目標の更新
- `/self/weight`: 体重入力
- `/self/weight-history`: 体重履歴の確認と削除
- `/match-scores`: 試合スコア閲覧（試合別と部員別）
- `/player-scores/new`: 自分の試合得点入力
- `/feedback`: フィードバック送信
- `/release-notes`: 公開リリースノート閲覧

### 管理者/マネージャー向け

- `/admin`: 管理ダッシュボード
	- 出席イベント作成（練習/試合）
	- 部員一覧編集
	- 通達管理（adminユーザー）
	- リリースノート管理導線（adminユーザー）
	- フィードバック一覧導線（adminユーザー）
- `/admin/manager`: マネージャーウィンドウ（出席率・得点率・最新体重）
- `/admin/manager/weights`: 体重一括入力
- `/admin/manager/match-score`: 試合スコア入力
- `/admin/members/[memberId]`: 部員詳細ダッシュボード
- `/admin/members/[memberId]/attendance`: 出席履歴
- `/admin/members/[memberId]/weight`: 体重推移
- `/admin/members/[memberId]/scores`: 得点履歴
- `/admin/release-notes`: リリースノート管理（adminユーザー）
- `/admin/feedback`: フィードバック一覧（adminユーザー）

### 互換リダイレクト

- `/attendance`, `/attendance/submit`, `/practice-menus` は `/` へリダイレクトします。

## DB構成（Prisma / PostgreSQL）

### 接続方式

- Prisma datasource: `postgresql`
- 接続文字列: `DATABASE_URL`
- `DATABASE_URL` が未設定の場合、次の環境変数を順にフォールバック可能:
	- `POSTGRES_PRISMA_URL`
	- `POSTGRES_URL`
	- `NEON_DATABASE_URL`
	- `RENDER_POSTGRESQL_URL`

### 主なEnum

- `Role`: `PLAYER`, `MANAGER`, `COACH`, `ADMIN`
- `AttendanceStatus`: `ATTEND`, `ABSENT`, `LATE`, `UNKNOWN`
- `InputType`: `ATTENDANCE`, `WEIGHT`
- `AttendanceEventType`: `PRACTICE`, `MATCH`
- `MatchPeriod`: `FIRST_HALF`, `SECOND_HALF`

### 主なモデル

- `Member`: ユーザー本体（役割、目標、管理画面アクセス可否）
- `AttendanceEvent`: 出席イベント（練習/試合）
- `AttendanceRecord`: 部員ごとの出席回答
- `WeightRecord`: 部員ごとの体重履歴
- `MatchRecord`: 試合記録（対戦相手、点数）
- `MatchPeriodScore`: 前半/後半ごとのチームスコア
- `PlayerMatchScore`: 試合ごとの部員スコア
- `PlayerMatchPeriodStat`: 前半/後半ごとの部員スタッツ
- `PracticeMenu`: 練習メニュー記録
- `ReleaseNote`: リリースノート
- `Feedback`: 部員からのフィードバック
- `AdminAnnouncement`: 期間表示の通達

### 主なリレーション

- `Member` 1 - N `AttendanceRecord`, `WeightRecord`, `PlayerMatchScore`, `PlayerMatchPeriodStat`
- `AttendanceEvent` 1 - N `AttendanceRecord`, `MatchRecord`
- `MatchRecord` 1 - N `PlayerMatchScore`, `MatchPeriodScore`, `PlayerMatchPeriodStat`
- `Member` 1 - N `ReleaseNote`（作成者）
- `Member` 1 - N `AdminAnnouncement`（作成者）
- `Member` 1 - N `Feedback`

### 代表的な制約

- `Member.nickname` は一意
- `AttendanceRecord` は `(eventId, memberId)` の複合一意
- `PlayerMatchScore` は `(memberId, matchId)` の複合一意
- `MatchPeriodScore` は `(matchId, period)` の複合一意
- `PlayerMatchPeriodStat` は `(matchId, memberId, period)` の複合一意

## 技術構成

- フロントエンド: Next.js (App Router) + TypeScript
- バックエンド: Next.js Route Handlers
- ORM: Prisma
- DB: PostgreSQL

## 初回セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. `.env` を作成し、最低限 `DATABASE_URL` を設定

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public
ADMIN_VIEW_KEY=toyota-table-tennis-admin
```

3. マイグレーションを適用して起動

```bash
npm run db:migrate
npm run dev
```

## Docker で起動する

このリポジトリの `docker-compose.yml` には DB コンテナは含まれていません。
外部PostgreSQLの `DATABASE_URL` を設定してから起動してください。

```bash
docker compose up --build
```

停止:

```bash
docker compose down
```

起動後:

- <http://localhost:3000>

## Render で起動する

Dockerデプロイを想定しています。

推奨設定:

- Runtime: Docker
- Start Command: 空欄（Dockerfile の `CMD` を使用）
- Health Check Path: `/api/health`
- Environment Variables:
	- `DATABASE_URL`（またはフォールバック対象の接続変数）
	- `ADMIN_VIEW_KEY`
	- `NEXT_PUBLIC_APP_BASE_URL`（未設定時は `RENDER_EXTERNAL_URL` を利用）

`HTTP ERROR 502` の場合は、ログで `PORT=` 表示後に `Ready` まで到達しているか確認してください。

## 環境変数

- `DATABASE_URL`: PostgreSQL接続文字列
- `POSTGRES_PRISMA_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL` / `RENDER_POSTGRESQL_URL`: `DATABASE_URL` の代替
- `ADMIN_VIEW_KEY`: 管理画面キー
- `RENDER_EXTERNAL_URL`: Render公開URL

## 開発用コマンド

```bash
npm run dev               # 開発サーバ起動
npm run build             # 本番ビルド
npm run start             # 本番サーバ起動
npm run lint              # Lint
npm run db:migrate        # ローカル向けマイグレーション実行
npm run db:migrate:deploy # 本番向けマイグレーション適用
npm run db:push           # スキーマ直接反映（開発用途）
npm run db:generate       # Prisma Client再生成
npm run db:studio         # Prisma Studio起動
```

## 管理者権限について

管理画面 (`/admin`) は次のいずれかを満たすログインユーザーのみ利用できます。

- ニックネームが `admin`（スーパー管理者）
- `canAccessAdmin = true`

権限判定ロジックは `src/lib/admin-access.ts` にあります。

## ディレクトリ構成（詳細）

### ルート直下

- `README.md`: このドキュメント
- `package.json`: npm scripts と依存関係
- `next.config.ts`: Next.js 設定
- `tsconfig.json`: TypeScript 設定
- `eslint.config.mjs`: ESLint 設定
- `Dockerfile`: 本番向け Docker イメージ定義
- `docker-compose.yml`: ローカル Docker 起動設定（アプリ本体）
- `prisma.config.ts`: Prisma 設定と `DATABASE_URL` フォールバック解決

### `src/app`（App Router）

- `src/app/layout.tsx`: ルートレイアウト
- `src/app/globals.css`: 全体スタイル
- `src/app/page.tsx`: 部員向けメイン画面
- `src/app/floating-mobile-tabs.tsx`: モバイル固定タブ

部員向けページ:

- `src/app/auth/page.tsx`: ログイン/登録
- `src/app/calendar/[date]/page.tsx`: 日別確認と出席提出
- `src/app/self/profile/page.tsx`: プロフィール・目標更新
- `src/app/self/weight/page.tsx`: 体重入力
- `src/app/self/weight-history/page.tsx`: 体重履歴
- `src/app/match-scores/page.tsx`: 試合スコア閲覧
- `src/app/player-scores/new/page.tsx`: 個人得点入力
- `src/app/feedback/page.tsx`: フィードバック送信
- `src/app/release-notes/page.tsx`: 公開リリースノート

管理者向けページ:

- `src/app/admin/page.tsx`: 管理ダッシュボード
- `src/app/admin/manager/page.tsx`: マネージャーウィンドウ
- `src/app/admin/manager/weights/page.tsx`: 体重一括入力
- `src/app/admin/manager/match-score/page.tsx`: 試合スコア入力
- `src/app/admin/members/[memberId]/page.tsx`: 部員詳細ダッシュボード
- `src/app/admin/members/[memberId]/attendance/page.tsx`: 出席履歴
- `src/app/admin/members/[memberId]/weight/page.tsx`: 体重推移
- `src/app/admin/members/[memberId]/scores/page.tsx`: 得点履歴
- `src/app/admin/release-notes/page.tsx`: リリースノート管理
- `src/app/admin/feedback/page.tsx`: フィードバック一覧

### `src/app/api`（Route Handlers）

認証・セッション:

- `src/app/api/auth/register/route.ts`: アカウント登録
- `src/app/api/auth/login/route.ts`: ログイン
- `src/app/api/auth/logout/route.ts`: ログアウト

部員セルフ操作:

- `src/app/api/self-profile/route.ts`: 自分のプロフィール更新
- `src/app/api/self-weight/route.ts`: 自分の体重登録/削除
- `src/app/api/self-attendance/route.ts`: 自分の出席提出

管理者操作:

- `src/app/api/events/route.ts`: 出席イベント作成
- `src/app/api/events/[eventId]/route.ts`: 出席イベント削除
- `src/app/api/members/route.ts`: 部員作成/更新系
- `src/app/api/members/[memberId]/route.ts`: 部員詳細更新/削除
- `src/app/api/admin-weights/route.ts`: 体重一括入力
- `src/app/api/manager-match-score/route.ts`: 試合スコア登録
- `src/app/api/matches/route.ts`: 試合データ関連
- `src/app/api/player-scores/route.ts`: 個人得点登録
- `src/app/api/admin-announcements/route.ts`: 通達管理
- `src/app/api/release-notes/route.ts`: リリースノート管理
- `src/app/api/admin-data/route.ts`: 管理データ操作
- `src/app/api/admin-data/cleanup/route.ts`: 管理データクリーンアップ

共有入力・その他:

- `src/app/api/links/route.ts`: 共有リンク発行
- `src/app/api/public/attendance/route.ts`: 共有リンク経由の出席提出
- `src/app/api/public/weight/route.ts`: 共有リンク経由の体重提出
- `src/app/api/feedback/route.ts`: フィードバック送信
- `src/app/api/practice-menus/route.ts`: 練習メニューAPI
- `src/app/api/health/route.ts`: ヘルスチェック

### `src/lib`（共通ロジック）

- `src/lib/prisma.ts`: Prisma Client のシングルトン管理
- `src/lib/member-session.ts`: セッション中の部員情報取得
- `src/lib/admin-access.ts`: 管理画面アクセス判定
- `src/lib/admin-key.ts`: 管理キー取得/検証
- `src/lib/date-format.ts`: 日付/時刻整形と日付キー処理
- `src/lib/form-schemas.ts`: Zod バリデーション定義
- `src/lib/input-token.ts`: 共有トークン生成/補助
- `src/lib/member-sort.ts`: 部員表示順ソート
- `src/lib/request-utils.ts`: リダイレクトURL等の共通処理

### `src/components`

- `src/components/local-date-time.tsx`: ローカル日時表示コンポーネント

### `prisma`

- `prisma/schema.prisma`: データモデル、Enum、制約定義
- `prisma/migrations/*/migration.sql`: マイグレーションSQL履歴
- `prisma/migrations/migration_lock.toml`: マイグレーションロック情報

### `public`

- 静的アセット配置ディレクトリ（画像・アイコン等）

