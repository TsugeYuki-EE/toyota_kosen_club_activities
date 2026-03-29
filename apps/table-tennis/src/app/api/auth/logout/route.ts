import { NextRequest, NextResponse } from "next/server";
import { clearMemberSession } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";

export async function POST(request: NextRequest) {
  await clearMemberSession();

  const redirectUrl = buildAppUrl(request, "/auth");
  redirectUrl.searchParams.set("ok", "logout");
  return NextResponse.redirect(redirectUrl, 303);
}
