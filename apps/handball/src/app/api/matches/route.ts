import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { buildAppUrl } from "@/lib/request-utils";
import { parseJstDateTimeInputToUtc } from "@/lib/date-format";
import { matchSchema } from "@/lib/form-schemas";

// 試合情報の取得と登録を受け付ける API です。

export async function GET() {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await prisma.matchRecord.findMany({
    orderBy: { matchDate: "desc" },
  });

  return NextResponse.json({ matches });
}

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = matchSchema.safeParse({
    opponent: formData.get("opponent"),
    matchDate: formData.get("matchDate"),
    ourScore: formData.get("ourScore"),
    theirScore: formData.get("theirScore"),
    note: formData.get("note") || undefined,
  });

  const redirectUrl = buildAppUrl(request, "/admin");

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const matchDate = parseJstDateTimeInputToUtc(parsed.data.matchDate);
  if (Number.isNaN(matchDate.getTime())) {
    redirectUrl.searchParams.set("error", "日時が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await prisma.matchRecord.create({
    data: {
      ...parsed.data,
      matchDate,
    },
  });

  redirectUrl.searchParams.set("ok", "match");
  return NextResponse.redirect(redirectUrl, 303);
}
