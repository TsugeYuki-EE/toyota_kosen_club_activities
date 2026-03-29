import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { feedbackSubmitSchema } from "@/lib/form-schemas";
import { getSessionMember } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";

// ログイン中の部員がフィードバックを送信します。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = feedbackSubmitSchema.safeParse({
    content: formData.get("content"),
    redirectTo: formData.get("redirectTo") || undefined,
  });

  const redirectTo = parsed.success && parsed.data.redirectTo ? parsed.data.redirectTo : "/feedback";
  const redirectUrl = buildAppUrl(request, redirectTo);

  const member = await getSessionMember();
  if (!member) {
    const authUrl = buildAppUrl(request, "/auth");
    authUrl.searchParams.set("error", "ログインしてください");
    return NextResponse.redirect(authUrl, 303);
  }

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await prisma.$executeRaw`
    INSERT INTO "Feedback" ("id", "memberId", "memberNameSnapshot", "content", "createdAt")
    VALUES (${crypto.randomUUID()}, ${member.id}, ${member.name}, ${parsed.data.content}, NOW())
  `;

  redirectUrl.searchParams.set("ok", "feedback-submitted");
  return NextResponse.redirect(redirectUrl, 303);
}
