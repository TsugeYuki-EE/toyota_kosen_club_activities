import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAdminMember, isSuperAdminNickname } from "@/lib/admin-access";
import { buildRedirectUrl } from "@/lib/request-utils";
import { memberUpdateSchema } from "@/lib/form-schemas";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

// 部員ごとの更新と削除を扱います。
export async function POST(request: NextRequest, { params }: RouteContext) {
  const adminMember = await getAuthorizedAdminMember();
  if (!adminMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "update");
  const redirectTo = String(formData.get("redirectTo") || "/admin");

  if (intent === "update-role") {
    const targetMember = await prisma.member.findUnique({
      where: { id: memberId },
      select: { nickname: true },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "対象の部員が見つかりません" }, { status: 404 });
    }

    if (isSuperAdminNickname(targetMember.nickname)) {
      return NextResponse.json({ error: "スーパーアドミンの役職は変更できません" }, { status: 403 });
    }

    const requestedRole = String(formData.get("role") || "PLAYER");
    if (requestedRole !== "PLAYER" && requestedRole !== "MANAGER" && requestedRole !== "COACH" && requestedRole !== "ADMIN") {
      return NextResponse.json({ error: "役職はプレイヤー・マネージャー・コーチ・管理者から選択してください" }, { status: 400 });
    }

    await prisma.member.update({
      where: { id: memberId },
      data: {
        role: requestedRole,
        canAccessAdmin: requestedRole !== "PLAYER",
      },
    });

    return NextResponse.json({ success: true, role: requestedRole });
  }

  const redirectUrl = buildRedirectUrl(request, redirectTo);

  if (intent === "delete") {
    await prisma.member.delete({
      where: { id: memberId },
    });

    redirectUrl.searchParams.set("ok", "member-deleted");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const parsed = memberUpdateSchema.safeParse({
    nickname: formData.get("nickname"),
    grade: formData.get("grade") || undefined,
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const targetMember = await prisma.member.findUnique({
    where: { id: memberId },
    select: { nickname: true },
  });

  if (!targetMember) {
    redirectUrl.searchParams.set("error", "対象の部員が見つかりません");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await prisma.member.update({
      where: { id: memberId },
      data: {
        nickname: parsed.data.nickname,
        name: parsed.data.nickname,
        grade: parsed.data.grade,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectUrl.searchParams.set("error", "そのニックネームは既に使われています");
      return NextResponse.redirect(redirectUrl, 303);
    }

    throw error;
  }

  redirectUrl.searchParams.set("ok", "member-updated");
  return NextResponse.redirect(redirectUrl, 303);
}
