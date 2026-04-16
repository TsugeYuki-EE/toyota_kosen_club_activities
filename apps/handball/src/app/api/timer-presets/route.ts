import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";

type TimerPresetResponse = {
  id: string;
  label: string;
  durationSeconds: number;
  setCount: number;
  description: string;
  isSystemPreset: boolean;
  createdByMemberId: string | null;
  canDelete: boolean;
};

const createTimerPresetSchema = z.object({
  label: z.string().trim().min(1, "名前を入力してください").max(80),
  durationSeconds: z.number().int().min(10, "10秒以上で入力してください").max(24 * 60 * 60),
  setCount: z.number().int().min(1).max(99).default(1),
  description: z.string().trim().max(120).optional(),
});

function mapTimerPreset(timerPreset: {
  id: string;
  name: string;
  durationSeconds: number;
  setCount: number;
  description: string | null;
  isSystemPreset: boolean;
  createdByMemberId: string | null;
}): TimerPresetResponse {
  return {
    id: timerPreset.id,
    label: timerPreset.name,
    durationSeconds: timerPreset.durationSeconds,
    setCount: timerPreset.setCount,
    description: timerPreset.description || "",
    isSystemPreset: timerPreset.isSystemPreset,
    createdByMemberId: timerPreset.createdByMemberId,
    canDelete: !timerPreset.isSystemPreset,
  };
}

export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const timerPresets = await prisma.timerPreset.findMany({
    orderBy: [
      { isSystemPreset: "desc" },
      { createdAt: "asc" },
    ],
  });

  return NextResponse.json({ timerPresets: timerPresets.map(mapTimerPreset) });
}

export async function POST(request: NextRequest) {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = createTimerPresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const createdTimerPreset = await prisma.timerPreset.create({
    data: {
      name: parsed.data.label,
      durationSeconds: parsed.data.durationSeconds,
      setCount: parsed.data.setCount,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      isSystemPreset: false,
      createdByMemberId: member.id,
    },
  });

  return NextResponse.json({ timerPreset: mapTimerPreset(createdTimerPreset) }, { status: 201 });
}
