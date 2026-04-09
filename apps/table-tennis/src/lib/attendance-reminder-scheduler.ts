import { AttendanceEventType } from "@prisma/client";
import { formatDateTime, toDateKey } from "@/lib/date-format";
import { isLineNotificationEnabled, sendLineNotification } from "@/lib/line-notification";
import { prisma } from "@/lib/prisma";

const REMINDER_LEAD_MINUTES = 90;
const REMINDER_SCAN_WINDOW_MINUTES = 2;
const REMINDER_INTERVAL_MS = 60_000;

type AttendanceEventReminder = {
  id: string;
  title: string;
  scheduledAt: Date;
  eventType: AttendanceEventType;
  matchOpponent: string | null;
  matchDetail: string | null;
  note: string | null;
};

type ReminderSweepResult = {
  scanned: number;
  sent: number;
  skipped: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __tableTennisAttendanceReminderSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __tableTennisAttendanceReminderSweepRunning: boolean | undefined;
}

function getPublicBaseUrl(): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!configuredBaseUrl) {
    return "http://localhost:3000";
  }

  if (/^https?:\/\//i.test(configuredBaseUrl)) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return `https://${configuredBaseUrl.replace(/\/$/, "")}`;
}

function buildReminderMessage(event: AttendanceEventReminder): string {
  const eventDateKey = toDateKey(event.scheduledAt);
  const attendanceUrl = new URL(`/calendar/${eventDateKey}`, `${getPublicBaseUrl()}/`).toString();
  const lines = [
    "【卓球部】出欠登録のお願い",
    `予定: ${event.title}`,
    `開始: ${formatDateTime(event.scheduledAt)}`,
    `開始90分前です。出欠登録をお願いします。`,
    `確認: ${attendanceUrl}`,
  ];

  if (event.eventType === AttendanceEventType.MATCH && event.matchOpponent) {
    lines.splice(2, 0, `対戦相手: ${event.matchOpponent}`);
  }

  if (event.matchDetail) {
    lines.push(`試合詳細: ${event.matchDetail}`);
  }

  if (event.note) {
    lines.push(`補足: ${event.note}`);
  }

  return lines.join("\n");
}

async function sweepOnce(): Promise<ReminderSweepResult> {
  if (!isLineNotificationEnabled()) {
    return { scanned: 0, sent: 0, skipped: true };
  }

  if (globalThis.__tableTennisAttendanceReminderSweepRunning) {
    return { scanned: 0, sent: 0, skipped: true };
  }

  globalThis.__tableTennisAttendanceReminderSweepRunning = true;

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (REMINDER_LEAD_MINUTES - 1) * 60_000);
    const windowEnd = new Date(now.getTime() + (REMINDER_LEAD_MINUTES + REMINDER_SCAN_WINDOW_MINUTES - 1) * 60_000);

    const dueEvents = await prisma.attendanceEvent.findMany({
      where: {
        reminderSentAt: null,
        eventType: {
          in: [AttendanceEventType.PRACTICE, AttendanceEventType.MATCH],
        },
        scheduledAt: {
          gte: windowStart,
          lt: windowEnd,
        },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        eventType: true,
        matchOpponent: true,
        matchDetail: true,
        note: true,
      },
    });

    let sentCount = 0;

    for (const event of dueEvents) {
      const message = buildReminderMessage(event);
      const result = await sendLineNotification(message);

      if (result.sent) {
        await prisma.attendanceEvent.update({
          where: { id: event.id },
          data: { reminderSentAt: new Date() },
        });
        sentCount += 1;
      } else if (!result.skipped) {
        console.error("LINE attendance reminder failed", {
          eventId: event.id,
          status: result.status,
          error: result.error,
        });
      }
    }

    return { scanned: dueEvents.length, sent: sentCount, skipped: false };
  } finally {
    globalThis.__tableTennisAttendanceReminderSweepRunning = false;
  }
}

export async function sendDueAttendanceReminders(): Promise<ReminderSweepResult> {
  return sweepOnce();
}

export function startAttendanceReminderScheduler(): void {
  if (globalThis.__tableTennisAttendanceReminderSchedulerStarted) {
    return;
  }

  globalThis.__tableTennisAttendanceReminderSchedulerStarted = true;

  void sweepOnce().catch((error) => {
    console.error("Initial LINE attendance reminder sweep failed", error);
  });

  setInterval(() => {
    void sweepOnce().catch((error) => {
      console.error("LINE attendance reminder sweep failed", error);
    });
  }, REMINDER_INTERVAL_MS);
}
