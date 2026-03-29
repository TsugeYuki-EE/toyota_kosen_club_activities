// 開発環境で使う簡易的な管理キーです。
// 本番環境では .env の ADMIN_VIEW_KEY で上書きして使います。
const defaultAdminKey = "toyota-table-tennis-admin";

export function getAdminKey(): string {
  return process.env.ADMIN_VIEW_KEY || defaultAdminKey;
}

// URL やヘッダーから受け取ったキーが有効かを判定します。
export function isAdminKeyValid(key: string | null | undefined): boolean {
  if (!key) {
    return false;
  }

  return key === getAdminKey();
}

