import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { playerMatchScoreSchema } from "@/lib/form-schemas";
import { getSessionMember } from "@/lib/member-session";
import { buildAppUrl } from "@/lib/request-utils";

// 個人得点の一覧取得と保存を扱う API です。

export async function GET() {
  const playerScores = await prisma.playerMatchScore.findMany({
    include: {
      member: true,
      match: true,
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ playerScores });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") || "/player-scores/new");
  const redirectUrl = buildAppUrl(request, redirectTo);

  const member = await getSessionMember();
  if (!member) {
    const authUrl = buildAppUrl(request, "/auth");
    authUrl.searchParams.set("error", "ログインしてください");
    return NextResponse.redirect(authUrl, 303);
  }

  const parsed = playerMatchScoreSchema.safeParse({
    matchId: formData.get("matchId"),
    goals: formData.get("goals"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await prisma.playerMatchScore.upsert({
    where: {
      memberId_matchId: {
        memberId: member.id,
        matchId: parsed.data.matchId,
      },
    },
    update: {
      goals: parsed.data.goals,
      note: parsed.data.note,
      submittedAt: new Date(),
    },
    create: {
      ...parsed.data,
      memberId: member.id,
    },
  });

  redirectUrl.searchParams.set("ok", "score");
  return NextResponse.redirect(redirectUrl, 303);
}
