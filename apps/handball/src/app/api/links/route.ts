import { InputType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { buildAppUrl } from "@/lib/request-utils";
import { createInputToken } from "@/lib/input-token";
import { parseJstDateTimeInputToUtc } from "@/lib/date-format";
import { inputTokenSchema } from "@/lib/form-schemas";

// 共有リンクの一覧取得と新規発行を扱います。

export async function GET() {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await prisma.inputToken.findMany({
    include: {
      member: true,
      event: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ links });
}

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = inputTokenSchema.safeParse({
    type: formData.get("type"),
    memberId: formData.get("memberId"),
    eventId: formData.get("eventId") || undefined,
    expiresAt: formData.get("expiresAt"),
  });

  const redirectUrl = buildAppUrl(request, "/admin");

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (parsed.data.type === InputType.ATTENDANCE && !parsed.data.eventId) {
    redirectUrl.searchParams.set("error", "出席リンクにはイベント選択が必要です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const expiresAt = parseJstDateTimeInputToUtc(parsed.data.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    redirectUrl.searchParams.set("error", "有効期限が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const created = await prisma.inputToken.create({
    data: {
      token: createInputToken(),
      type: parsed.data.type,
      memberId: parsed.data.memberId,
      eventId: parsed.data.type === InputType.ATTENDANCE ? parsed.data.eventId : null,
      expiresAt,
    },
  });

  redirectUrl.searchParams.set("ok", "link");
  redirectUrl.searchParams.set("newToken", created.token);
  return NextResponse.redirect(redirectUrl, 303);
}
