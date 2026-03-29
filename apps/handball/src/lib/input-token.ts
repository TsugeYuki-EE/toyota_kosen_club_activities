import { randomBytes } from "node:crypto";

// 共有リンク用の推測しにくいトークンを生成します。
export function createInputToken(): string {
  return randomBytes(24).toString("hex");
}
