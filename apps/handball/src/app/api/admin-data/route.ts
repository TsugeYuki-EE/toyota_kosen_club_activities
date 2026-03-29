import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAdminMember } from "@/lib/admin-access";

// 管理画面でまとめて使うデータを返す API です。

export async function GET() {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [members, events, attendanceRecords, weightRecords, matches, links] = await Promise.all([
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attendanceEvent.findMany({ orderBy: { scheduledAt: "desc" } }),
    prisma.attendanceRecord.findMany({
      include: { member: true, event: true },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.weightRecord.findMany({
      include: { member: true },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.matchRecord.findMany({ orderBy: { matchDate: "desc" }, take: 50 }),
    prisma.inputToken.findMany({
      include: { member: true, event: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    members,
    events,
    attendanceRecords,
    weightRecords,
    matches,
    links,
  });
}
