import { NextRequest } from "next/server";

const PRODUCTION_APP_FALLBACK_URL = "https://toyota-table-tennis-notes.onrender.com";

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalOnlyOrigin(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

// Render などのプロキシ配下でも外向きURLでリダイレクトできるようにします。
export function getRequestOrigin(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configuredBaseUrl && !(process.env.NODE_ENV === "production" && isLocalOnlyOrigin(configuredBaseUrl))) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_FALLBACK_URL;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = request.nextUrl.protocol || "https:";
    return `${protocol}//${host}`;
  }

  return request.nextUrl.origin;
}

export function buildAppUrl(request: NextRequest, path: string): URL {
  return new URL(path, `${getRequestOrigin(request)}/`);
}

// 管理キーは URL クエリまたはヘッダーのどちらからでも受け取れるようにしています。
export function getAdminKeyFromRequest(request: NextRequest): string | null {
  const urlKey = request.nextUrl.searchParams.get("key");
  const headerKey = request.headers.get("x-admin-key");

  return urlKey || headerKey;
}

// 管理画面へ戻すときに key を落とさないための共通処理です。
export function buildAdminRedirectUrl(request: NextRequest): URL {
  const key = request.nextUrl.searchParams.get("key") || "";
  const redirectUrl = buildAppUrl(request, "/admin");

  if (key) {
    redirectUrl.searchParams.set("key", key);
  }

  return redirectUrl;
}

// 詳細ページなど任意の画面へ戻すときに使う汎用リダイレクト生成です。
export function buildRedirectUrl(request: NextRequest, redirectTo: string, key?: string | null): URL {
  const redirectUrl = buildAppUrl(request, redirectTo || "/admin");

  if (key) {
    redirectUrl.searchParams.set("key", key);
  }

  return redirectUrl;
}

