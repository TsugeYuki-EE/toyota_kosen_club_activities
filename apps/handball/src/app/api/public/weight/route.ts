import { InputType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { weightSubmitSchema } from "@/lib/form-schemas";
import { buildAppUrl } from "@/lib/request-utils";

// 共有リンク経由の体重入力を保存します。

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = weightSubmitSchema.safeParse({
    token: formData.get("token"),
    weightKg: formData.get("weightKg"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  const inputToken = await prisma.inputToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!inputToken || !inputToken.isActive || inputToken.type !== InputType.WEIGHT) {
    return NextResponse.json({ error: "リンクが無効です" }, { status: 404 });
  }

  if (inputToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "リンクの有効期限が切れています" }, { status: 410 });
  }

  await prisma.weightRecord.create({
    data: {
      memberId: inputToken.memberId,
      weightKg: parsed.data.weightKg,
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
