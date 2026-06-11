import { NextRequest, NextResponse } from "next/server";
import { AttendanceEventType } from "@prisma/client";
import { z } from "zod";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { addJstDays, getJstDateParts, getJstWeekday, parseJstDateTimeToUtc, toDateKey } from "@/lib/date-format";
import { isJapaneseHolidayDateKey } from "@/lib/japanese-holiday";
import { prisma } from "@/lib/prisma";
import { buildRedirectUrl } from "@/lib/request-utils";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const weekdayTimeSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時刻の形式が不正です").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "終了時刻の形式が不正です").optional(),
}).superRefine((value, ctx) => {
  if (!value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "部活なしにしない曜日は開始時刻が必要です",
      path: ["startTime"],
    });
  }
  if (value.startTime && value.endTime && value.endTime < value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "終了時刻は開始時刻以降を指定してください",
      path: ["endTime"],
    });
  }
});

const bulkDefaultsSchema = z.object({
  eventType: z.nativeEnum(AttendanceEventType),
  eventDates: z.string().trim().min(1, "日付を1つ以上選択してください"),
  matchOpponent: z.string().trim().optional(),
  matchDetail: z.string().trim().optional(),
  note: z.string().trim().optional(),
  sun: weekdayTimeSchema,
  mon: weekdayTimeSchema,
  tue: weekdayTimeSchema,
  wed: weekdayTimeSchema,
  thu: weekdayTimeSchema,
  fri: weekdayTimeSchema,
  sat: weekdayTimeSchema,
}).superRefine((value, ctx) => {
  if (value.eventType === AttendanceEventType.MATCH && !value.matchOpponent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matchOpponent"],
      message: "試合を選択した場合は対戦相手を入力してください",
    });
  }
});

function extractWeekdayTime(formData: FormData, key: (typeof weekdayKeys)[number]) {
  return {
    startTime: (String(formData.get(`${key}StartTime`) || "").trim() || undefined),
    endTime: (String(formData.get(`${key}EndTime`) || "").trim() || undefined),
  };
}

function parseEventDates(rawDates: string): string[] {
  return [...new Set(rawDates.split(",").map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort((a, b) => a.localeCompare(b));
}

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") || "/admin/events");
  const redirectUrl = buildRedirectUrl(request, redirectTo);

  const parsed = bulkDefaultsSchema.safeParse({
    eventType: formData.get("eventType"),
    eventDates: formData.get("eventDates"),
    matchOpponent: formData.get("matchOpponent") || undefined,
    matchDetail: formData.get("matchDetail") || undefined,
    note: formData.get("note") || undefined,
    sun: extractWeekdayTime(formData, "sun"),
    mon: extractWeekdayTime(formData, "mon"),
    tue: extractWeekdayTime(formData, "tue"),
    wed: extractWeekdayTime(formData, "wed"),
    thu: extractWeekdayTime(formData, "thu"),
    fri: extractWeekdayTime(formData, "fri"),
    sat: extractWeekdayTime(formData, "sat"),
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", parsed.error.issues[0]?.message || "入力値が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const eventDates = parseEventDates(parsed.data.eventDates);
  if (eventDates.length === 0) {
    redirectUrl.searchParams.set("error", "日付を1つ以上選択してください");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const startDate = parseJstDateTimeToUtc(eventDates[0], "00:00");
  const endDate = parseJstDateTimeToUtc(eventDates[eventDates.length - 1], "00:00");
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    redirectUrl.searchParams.set("error", "選択された日付が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const existingEvents = await prisma.attendanceEvent.findMany({
    where: {
      scheduledAt: {
        gte: startDate,
        lt: addJstDays(endDate, 1),
      },
    },
    select: {
      scheduledAt: true,
    },
  });
  const existingScheduleKeys = new Set(existingEvents.map((event) => {
    const dateKey = toDateKey(event.scheduledAt);
    const parts = getJstDateParts(event.scheduledAt);
    const hour = String(parts.hour).padStart(2, "0");
    const minute = String(parts.minute).padStart(2, "0");
    return `${dateKey}T${hour}:${minute}`;
  }));

  const rows: Array<{
    eventType: AttendanceEventType;
    title: string;
    scheduledAt: Date;
    endAt: Date | null;
    matchOpponent: string | null;
    matchDetail: string | null;
    note: string | null;
  }> = [];
  let skippedByExisting = 0;

  for (const dateKey of eventDates) {
    const cursor = parseJstDateTimeToUtc(dateKey, "00:00");
    const weekdayKey = isJapaneseHolidayDateKey(dateKey)
      ? "sun"
      : weekdayKeys[getJstWeekday(cursor)];
    const weekdaySetting = parsed.data[weekdayKey];

    if (!weekdaySetting.startTime) {
      redirectUrl.searchParams.set("error", `${weekdayKey} の開始時刻が必要です`);
      return NextResponse.redirect(redirectUrl, 303);
    }

    const scheduledAt = parseJstDateTimeToUtc(dateKey, weekdaySetting.startTime);
    const endAt = weekdaySetting.endTime ? parseJstDateTimeToUtc(dateKey, weekdaySetting.endTime) : null;
    if (Number.isNaN(scheduledAt.getTime()) || (endAt && Number.isNaN(endAt.getTime()))) {
      redirectUrl.searchParams.set("error", `日時変換に失敗しました: ${dateKey}`);
      return NextResponse.redirect(redirectUrl, 303);
    }

    const scheduleKey = `${dateKey}T${weekdaySetting.startTime}`;
    if (existingScheduleKeys.has(scheduleKey)) {
      skippedByExisting += 1;
      continue;
    }
    existingScheduleKeys.add(scheduleKey);

    rows.push({
      eventType: parsed.data.eventType,
      title: parsed.data.eventType === AttendanceEventType.MATCH
        ? `試合${parsed.data.matchOpponent ? `: ${parsed.data.matchOpponent}` : ""}`
        : `練習 ${dateKey}`,
      scheduledAt,
      endAt,
      matchOpponent: parsed.data.eventType === AttendanceEventType.MATCH ? parsed.data.matchOpponent || null : null,
      matchDetail: parsed.data.eventType === AttendanceEventType.MATCH ? parsed.data.matchDetail || null : null,
      note: parsed.data.note || null,
    });
  }

  if (rows.length > 0) {
    await prisma.attendanceEvent.createMany({ data: rows });
  }

  redirectUrl.searchParams.set(
    "ok",
    `bulk-${rows.length}件作成 (既存重複${skippedByExisting}件)`,
  );
  return NextResponse.redirect(redirectUrl, 303);
}
