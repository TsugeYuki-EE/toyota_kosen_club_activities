import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { selfWeightSubmitSchema } from "@/lib/form-schemas";
import { getSessionMember } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";

// メイン画面からの体重送信を保存します。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");
  const redirectTo = String(formData.get("redirectTo") || "/");
  const successRedirectTo = String(formData.get("successRedirectTo") || redirectTo);
  const redirectUrl = buildAppUrl(request, redirectTo);
  const successRedirectUrl = buildAppUrl(request, successRedirectTo);

  const member = await getSessionMember();
  if (!member) {
    const authUrl = buildAppUrl(request, "/auth");
    authUrl.searchParams.set("error", "ログインしてください");
    return NextResponse.redirect(authUrl, 303);
  }

  if (intent === "delete") {
    const recordId = String(formData.get("recordId") || "");

    if (!recordId) {
      redirectUrl.searchParams.set("error", "削除対象の体重データが見つかりません");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const deleted = await prisma.weightRecord.deleteMany({
      where: {
        id: recordId,
        memberId: member.id,
      },
    });

    if (deleted.count === 0) {
      redirectUrl.searchParams.set("error", "体重データの削除に失敗しました");
      return NextResponse.redirect(redirectUrl, 303);
    }

    redirectUrl.searchParams.set("ok", "weight-deleted");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const parsed = selfWeightSubmitSchema.safeParse({
    weightKg: formData.get("weightKg"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const now = new Date();

  await prisma.weightRecord.create({
    data: {
      memberId: member.id,
      weightKg: parsed.data.weightKg,
      recordedOn: now,
      submittedAt: now,
    },
  });

  successRedirectUrl.searchParams.set("ok", "weight");
  return NextResponse.redirect(successRedirectUrl, 303);
}
