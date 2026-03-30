import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nicknameLoginSchema } from "@/lib/form-schemas";
import { isSuperAdminNickname, isValidSuperAdminLoginPassword } from "@/lib/admin-access";
import { isValidClubPassword } from "@/lib/club-password";
import { setMemberSession } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") || "/auth");
  const redirectUrl = buildAppUrl(request, redirectTo);

  const parsed = nicknameLoginSchema.safeParse({
    nickname: formData.get("nickname"),
    adminPassword: formData.get("adminPassword") || undefined,
  });
  const clubPassword = String(formData.get("clubPassword") || "");

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (!isValidClubPassword(clubPassword)) {
    redirectUrl.searchParams.set("error", "部活パスワードが正しくありません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const member = await prisma.member.findUnique({
    where: { nickname: parsed.data.nickname },
    select: { id: true },
  });

  if (!member) {
    redirectUrl.searchParams.set("error", "ニックネームが見つかりません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (isSuperAdminNickname(parsed.data.nickname) && !isValidSuperAdminLoginPassword(parsed.data.adminPassword)) {
    redirectUrl.searchParams.set("error", "admin ログインにはパスワードが必要です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await setMemberSession(member.id, request);

  const successUrl = buildAppUrl(request, "/");
  successUrl.searchParams.set("ok", "login");
  return NextResponse.redirect(successUrl, 303);
}
