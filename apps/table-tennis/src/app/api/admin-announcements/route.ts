import { NextRequest, NextResponse } from "next/server";
import { adminAnnouncementSchema } from "@/lib/form-schemas";
import { isSuperAdminNickname } from "@/lib/admin-access";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/request-utils";
import { parseJstDateTimeInputToUtc } from "@/lib/date-format";

// admin ユーザーのみが通達メッセージを登録できます。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");
  const redirectToRaw = String(formData.get("redirectTo") || "/admin");
  const redirectUrl = buildAppUrl(request, redirectToRaw);

  const member = await getSessionMember();
  if (!member) {
    const authUrl = buildAppUrl(request, "/auth");
    authUrl.searchParams.set("error", "ログインしてください");
    return NextResponse.redirect(authUrl, 303);
  }

  if (!isSuperAdminNickname(member.nickname)) {
    redirectUrl.searchParams.set("error", "admin ユーザーのみ通達を操作できます");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (intent === "delete") {
    const announcementId = String(formData.get("announcementId") || "");
    if (!announcementId) {
      redirectUrl.searchParams.set("error", "削除対象が指定されていません");
      return NextResponse.redirect(redirectUrl, 303);
    }

    await prisma.adminAnnouncement.deleteMany({ where: { id: announcementId } });
    redirectUrl.searchParams.set("ok", "announcement-deleted");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const parsed = adminAnnouncementSchema.safeParse({
    message: formData.get("message"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    redirectTo: redirectToRaw,
  });

  const redirectTo = parsed.success && parsed.data.redirectTo ? parsed.data.redirectTo : "/admin";
  const createRedirectUrl = buildAppUrl(request, redirectTo);

  if (!parsed.success) {
    createRedirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(createRedirectUrl, 303);
  }

  const startsAt = parseJstDateTimeInputToUtc(parsed.data.startsAt);
  const endsAt = parseJstDateTimeInputToUtc(parsed.data.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    createRedirectUrl.searchParams.set("error", "日時が不正です");
    return NextResponse.redirect(createRedirectUrl, 303);
  }

  if (endsAt.getTime() < startsAt.getTime()) {
    createRedirectUrl.searchParams.set("error", "終了日時は開始日時以降を指定してください");
    return NextResponse.redirect(createRedirectUrl, 303);
  }

  await prisma.adminAnnouncement.create({
    data: {
      message: parsed.data.message,
      startsAt,
      endsAt,
      createdByMemberId: member.id,
    },
  });

  createRedirectUrl.searchParams.set("ok", "announcement");
  return NextResponse.redirect(createRedirectUrl, 303);
}
