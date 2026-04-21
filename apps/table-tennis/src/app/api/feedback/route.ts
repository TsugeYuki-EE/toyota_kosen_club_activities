import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { feedbackSubmitSchema } from "@/lib/form-schemas";
import { getSessionMember } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";
import { isSuperAdminNickname } from "@/lib/admin-access";
import { sendEmail } from "@/lib/email-notification";

async function getAdminRecipientEmails(): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: {
      email: { not: null },
    },
    select: {
      nickname: true,
      email: true,
    },
  });

  return members
    .filter((member) => isSuperAdminNickname(member.nickname))
    .map((member) => member.email?.trim() || "")
    .filter((email) => email.length > 0);
}

async function sendFeedbackNotificationToAdmins(args: {
  request: NextRequest;
  memberName: string;
  content: string;
}): Promise<void> {
  const recipients = await getAdminRecipientEmails();
  if (recipients.length === 0) {
    return;
  }

  const feedbackPageUrl = buildAppUrl(args.request, "/admin/feedback").toString();
  const message = [
    "【卓球部】新しいフィードバックが送信されました",
    `送信者: ${args.memberName}`,
    "",
    "内容:",
    args.content,
    "",
    `確認: ${feedbackPageUrl}`,
  ].join("\n");

  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient,
      subject: "【卓球部】フィードバック通知",
      message,
    });

    if (!result.sent && !result.skipped) {
      console.error("Feedback notification email failed", {
        recipient,
        status: result.status,
        error: result.error,
      });
    }
  }
}

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

  try {
    await sendFeedbackNotificationToAdmins({
      request,
      memberName: member.name,
      content: parsed.data.content,
    });
  } catch (error) {
    console.error("Feedback notification delivery failed", error);
  }

  redirectUrl.searchParams.set("ok", "feedback-submitted");
  return NextResponse.redirect(redirectUrl, 303);
}
