import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ timerPresetId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { timerPresetId } = await params;
  const timerPreset = await prisma.timerPreset.findUnique({
    where: { id: timerPresetId },
    select: { id: true, isSystemPreset: true, createdByMemberId: true },
  });

  if (!timerPreset) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  if (timerPreset.isSystemPreset) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (timerPreset.createdByMemberId !== member.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.timerPreset.delete({ where: { id: timerPresetId } });
  return NextResponse.json({ deletedTimerPresetId: timerPresetId });
}