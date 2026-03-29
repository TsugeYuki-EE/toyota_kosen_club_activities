import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { buildAppUrl } from "@/lib/request-utils";

// マネージャー/管理者向けの体重一括入力APIです。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");
  const redirectTo = String(formData.get("redirectTo") || "/admin/manager/weights");
  const redirectUrl = buildAppUrl(request, redirectTo);

  const adminMember = await getAuthorizedAdminMember();
  if (!adminMember) {
    redirectUrl.searchParams.set("error", "管理画面へのアクセス権限がありません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const memberId = String(formData.get("memberId") || "");
  if (!memberId) {
    redirectUrl.searchParams.set("error", "部員IDが指定されていません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const targetMember = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, nickname: true, name: true },
  });

  if (!targetMember) {
    redirectUrl.searchParams.set("error", "対象の部員が見つかりません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (intent === "delete-latest") {
    const latestWeight = await prisma.weightRecord.findFirst({
      where: { memberId },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    });

    if (!latestWeight) {
      redirectUrl.searchParams.set("error", "削除できる体重データがありません");
      return NextResponse.redirect(redirectUrl, 303);
    }

    await prisma.weightRecord.delete({
      where: { id: latestWeight.id },
    });

    redirectUrl.searchParams.set("ok", `deleted-${targetMember.nickname || targetMember.name}`);
    return NextResponse.redirect(redirectUrl, 303);
  }

  const weightRaw = formData.get("weightKg");
  const weightKg = Number(weightRaw);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    redirectUrl.searchParams.set("error", "体重は0より大きい数値で入力してください");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const now = new Date();

  await prisma.weightRecord.create({
    data: {
      memberId,
      weightKg,
      recordedOn: now,
      submittedAt: now,
    },
  });

  redirectUrl.searchParams.set("ok", `saved-${targetMember.nickname || targetMember.name}`);
  return NextResponse.redirect(redirectUrl, 303);
}
