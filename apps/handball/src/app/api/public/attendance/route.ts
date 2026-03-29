import { AttendanceStatus, InputType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attendanceSubmitSchema } from "@/lib/form-schemas";
import { buildAppUrl } from "@/lib/request-utils";

// 共有リンク経由の出席回答を保存します。

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = attendanceSubmitSchema.safeParse({
    token: formData.get("token"),
    status: formData.get("status") || AttendanceStatus.UNKNOWN,
    comment: formData.get("comment") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  const inputToken = await prisma.inputToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!inputToken || !inputToken.isActive || inputToken.type !== InputType.ATTENDANCE) {
    return NextResponse.json({ error: "リンクが無効です" }, { status: 404 });
  }

  if (inputToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "リンクの有効期限が切れています" }, { status: 410 });
  }

  if (!inputToken.eventId) {
    return NextResponse.json({ error: "イベント情報がありません" }, { status: 400 });
  }

  await prisma.attendanceRecord.upsert({
    where: {
      eventId_memberId: {
        eventId: inputToken.eventId,
        memberId: inputToken.memberId,
      },
    },
    update: {
      status: parsed.data.status,
      comment: parsed.data.comment,
      submittedAt: new Date(),
    },
    create: {
      eventId: inputToken.eventId,
      memberId: inputToken.memberId,
      status: parsed.data.status,
      comment: parsed.data.comment,
    },
  });

  await prisma.inputToken.update({
    where: { token: parsed.data.token },
    data: { usedAt: new Date() },
  });

  const redirectUrl = buildAppUrl(request, `/l/${parsed.data.token}`);
  redirectUrl.searchParams.set("done", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
