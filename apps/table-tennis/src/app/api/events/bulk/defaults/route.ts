import { NextRequest, NextResponse } from "next/server";
import { AttendanceEventType } from "@prisma/client";
import { z } from "zod";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { addJstDays, createJstDate, getJstDateParts, getJstWeekday, parseJstDateTimeToUtc, toDateKey } from "@/lib/date-format";
import { isJapaneseHolidayDateKey } from "@/lib/japanese-holiday";
import { prisma } from "@/lib/prisma";
import { buildRedirectUrl } from "@/lib/request-utils";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const weekdayTimeSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時刻の形式が不正です").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "終了時刻の形式が不正です").optional(),
  off: z.boolean(),
}).superRefine((value, ctx) => {
  if (!value.off && !value.startTime) {
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
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "開始日が不正です"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "終了日が不正です"),
  sun: weekdayTimeSchema,
  mon: weekdayTimeSchema,
  tue: weekdayTimeSchema,
  wed: weekdayTimeSchema,
  thu: weekdayTimeSchema,
  fri: weekdayTimeSchema,
  sat: weekdayTimeSchema,
}).superRefine((value, ctx) => {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "終了日は開始日以降を指定してください",
    });
  }
});

function extractWeekdayTime(formData: FormData, key: (typeof weekdayKeys)[number]) {
  return {
    startTime: (String(formData.get(`${key}StartTime`) || "").trim() || undefined),
    endTime: (String(formData.get(`${key}EndTime`) || "").trim() || undefined),
    off: formData.get(`${key}Off`) === "1",
  };
}

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") || "/admin/events");
  const redirectUrl = buildRedirectUrl(request, redirectTo);

  const parsed = bulkDefaultsSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
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

  const startDateValue = parsed.data.startDate;
  const endDateValue = parsed.data.endDate;

  const startDate = parseJstDateTimeToUtc(startDateValue, "00:00");
  const endDate = parseJstDateTimeToUtc(endDateValue, "00:00");
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    redirectUrl.searchParams.set("error", "開始日または終了日が不正です");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const existingEvents = await prisma.attendanceEvent.findMany({
    where: {
      eventType: AttendanceEventType.PRACTICE,
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
    matchOpponent: null;
    matchDetail: null;
    note: null;
  }> = [];
  let skippedByHoliday = 0;
  let skippedByOff = 0;
  let skippedByExisting = 0;

  for (let cursor = startDate; cursor.getTime() <= endDate.getTime(); cursor = addJstDays(cursor, 1)) {
    const dateKey = toDateKey(cursor);
    if (isJapaneseHolidayDateKey(dateKey)) {
      skippedByHoliday += 1;
      continue;
    }

    const weekdayIndex = getJstWeekday(cursor);
    const weekdayKey = weekdayKeys[weekdayIndex];
    const weekdaySetting = parsed.data[weekdayKey];

    if (weekdaySetting.off) {
      skippedByOff += 1;
      continue;
    }

    if (!weekdaySetting.startTime) {
      continue;
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
      eventType: AttendanceEventType.PRACTICE,
      title: `練習 ${dateKey}`,
      scheduledAt,
      endAt,
      matchOpponent: null,
      matchDetail: null,
      note: null,
    });
  }

  if (rows.length > 0) {
    await prisma.attendanceEvent.createMany({ data: rows });
  }

  redirectUrl.searchParams.set(
    "ok",
    `default-bulk-${rows.length}件作成 (祝日除外${skippedByHoliday}日 / 部活なし${skippedByOff}日 / 既存重複${skippedByExisting}件)`,
  );
  return NextResponse.redirect(redirectUrl, 303);
}
