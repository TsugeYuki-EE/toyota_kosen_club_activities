import { NextResponse } from "next/server";

// Render のヘルスチェック用に、DB 非依存で 200 を返します。
export function GET() {
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
