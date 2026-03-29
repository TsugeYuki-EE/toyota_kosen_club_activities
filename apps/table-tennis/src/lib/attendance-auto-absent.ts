import { AttendanceEventType, AttendanceStatus } from "@prisma/client";
import { createJstDate, getJstDateParts, nowInJst } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";

// 前日分の未解答イベントを自動で欠席にします。
export async function autoMarkPreviousDayUnansweredAsAbsent(memberId: string) {
  const now = nowInJst();
  const todayParts = getJstDateParts(now);
  const todayStartUtc = createJstDate(todayParts.year, todayParts.month - 1, todayParts.day);
  const yesterdayStartUtc = createJstDate(todayParts.year, todayParts.month - 1, todayParts.day - 1);

  const previousDayEvents = await prisma.attendanceEvent.findMany({
    where: {
      eventType: {
        in: [AttendanceEventType.PRACTICE, AttendanceEventType.MATCH],
      },
      scheduledAt: {
        gte: yesterdayStartUtc,
        lt: todayStartUtc,
      },
    },
    select: {
      id: true,
    },
  });

  if (previousDayEvents.length === 0) {
    return;
  }

  const eventIds = previousDayEvents.map((event) => event.id);

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      memberId,
      eventId: {
        in: eventIds,
      },
    },
    select: {
      eventId: true,
      status: true,
    },
  });

  const existingEventIdSet = new Set(existingRecords.map((record) => record.eventId));
  const missingEventIds = eventIds.filter((eventId) => !existingEventIdSet.has(eventId));

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.updateMany({
      where: {
        memberId,
        eventId: {
          in: eventIds,
        },
        status: AttendanceStatus.UNKNOWN,
      },
      data: {
        status: AttendanceStatus.ABSENT,
        submittedAt: now,
      },
    });

    if (missingEventIds.length > 0) {
      await tx.attendanceRecord.createMany({
        data: missingEventIds.map((eventId) => ({
          memberId,
          eventId,
          status: AttendanceStatus.ABSENT,
          submittedAt: now,
        })),
      });
    }
  });
}