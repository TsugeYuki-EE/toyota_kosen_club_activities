import Link from "next/link";
import { AttendanceEventType } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  addJstDays,
  createJstDate,
  getJstDateParts,
  getJstMonthRangeUtc,
  getJstWeekday,
  nowInJst,
  toDateKey,
} from "@/lib/date-format";
import { isJapaneseHolidayDateKey } from "@/lib/japanese-holiday";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { FloatingMobileTabs } from "./floating-mobile-tabs";
import styles from "./home-dashboard.module.css";

// DB の最新状態を毎回反映したいので動的描画にします。
export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ month?: string }>;
};

function buildEventDetailText(matchDetail: string | null, note: string | null): string | null {
  const parts: string[] = [];
  if (matchDetail) {
    parts.push(`試合詳細: ${matchDetail}`);
  }
  if (note) {
    parts.push(`補足: ${note}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join("\n");
}

function parseMonthParam(month?: string): Date {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const todayParts = getJstDateParts(nowInJst());
    return createJstDate(todayParts.year, todayParts.month - 1, 1);
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const todayParts = getJstDateParts(nowInJst());
    return createJstDate(todayParts.year, todayParts.month - 1, 1);
  }

  return createJstDate(year, monthIndex, 1);
}

function toMonthParam(date: Date): string {
  const parts = getJstDateParts(date);
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  return `${year}-${month}`;
}

function formatCalendarMonth(date: Date): string {
  const parts = getJstDateParts(date);
  return `${parts.year} ${parts.month}月`;
}

// 月間カレンダーを 6 週分のマスで作るための日付配列です。
function buildCalendarDates(baseDate: Date): Date[] {
  const baseParts = getJstDateParts(baseDate);
  const firstDay = createJstDate(baseParts.year, baseParts.month - 1, 1);
  const startOffset = getJstWeekday(firstDay);
  const startDate = addJstDays(firstDay, -startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    return addJstDays(startDate, index);
  });
}

// 部員向けホーム画面です。
export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const currentMonth = parseMonthParam(params.month);
  const currentMonthParts = getJstDateParts(currentMonth);
  const { startUtc: monthStartUtc, endUtc: nextMonthUtc } = getJstMonthRangeUtc(
    currentMonthParts.year,
    currentMonthParts.month - 1,
  );
  const today = nowInJst();
  const previousMonth = createJstDate(currentMonthParts.year, currentMonthParts.month - 2, 1);
  const followingMonth = createJstDate(currentMonthParts.year, currentMonthParts.month, 1);
  const dates = buildCalendarDates(currentMonth);
  const todayKey = toDateKey(today);
  const monthParam = toMonthParam(currentMonth);
  const monthQuery = `?month=${monthParam}`;

  const [events, matches, practiceMenus, activeAnnouncement] = await Promise.all([
    prisma.attendanceEvent.findMany({
      where: {
        scheduledAt: {
          gte: monthStartUtc,
          lt: nextMonthUtc,
        },
      },
      include: {
        records: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.matchRecord.findMany({
      where: {
        attendanceEventId: null,
        matchDate: {
          gte: monthStartUtc,
          lt: nextMonthUtc,
        },
      },
      orderBy: { matchDate: "asc" },
    }),
    prisma.practiceMenu.findMany({
      where: {
        practiceDate: {
          gte: monthStartUtc,
          lt: nextMonthUtc,
        },
      },
      orderBy: { practiceDate: "asc" },
    }),
    prisma.adminAnnouncement.findFirst({
      where: {
        startsAt: { lte: today },
        endsAt: { gte: today },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const scheduleMap = new Map<string, Set<"練習" | "試合">>();
  const eventDetailMap = new Map<string, { practice: string[]; match: string[] }>();

  for (const event of events) {
    const key = toDateKey(event.scheduledAt);
    const current = scheduleMap.get(key) || new Set<"練習" | "試合">();
    const label = event.eventType === AttendanceEventType.MATCH ? "試合" : "練習";
    current.add(label);
    scheduleMap.set(key, current);

    const detailText = buildEventDetailText(event.matchDetail, event.note);
    if (detailText) {
      const details = eventDetailMap.get(key) || { practice: [], match: [] };
      if (label === "試合") {
        details.match.push(detailText);
      } else {
        details.practice.push(detailText);
      }
      eventDetailMap.set(key, details);
    }
  }

  for (const match of matches) {
    const key = toDateKey(match.matchDate);
    const current = scheduleMap.get(key) || new Set<"練習" | "試合">();
    current.add("試合");
    scheduleMap.set(key, current);
  }

  for (const practice of practiceMenus) {
    const key = toDateKey(practice.practiceDate);
    const current = scheduleMap.get(key) || new Set<"練習" | "試合">();
    current.add("練習");
    scheduleMap.set(key, current);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {activeAnnouncement ? (
          <section className={styles.announcementWindow}>
            <h2>サーバ管理者からの通達</h2>
            <p>{activeAnnouncement.message}</p>
          </section>
        ) : null}

        <section className={styles.hero}>
          <h1>{member.nickname} のカレンダー</h1>
          <div className={styles.heroGoalWrap}>
            <h1 className={styles.heroGoalTitle}>目標</h1>
            <div className={styles.goalGrid}>
              <article className={styles.goalItem}>
                <h3>一年の目標</h3>
                <p>{member.yearlyGoal || "未設定です。プロフィールから入力できます。"}</p>
              </article>
              <article className={styles.goalItem}>
                <h3>{`${currentMonthParts.month}月の目標`}</h3>
                <p>{member.monthlyGoal || "未設定です。プロフィールから入力できます。"}</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <div>
              <h2>{formatCalendarMonth(currentMonth)}</h2>
              <p>日付を押すと詳細ページへ移動し、その日の予定と出席詳細を確認できます。</p>
            </div>
            <div className={styles.monthSwitch}>
              <Link className={styles.monthButton} href={`/?month=${toMonthParam(previousMonth)}`} aria-label="前の月">◀</Link>
              <Link className={styles.monthButton} href={`/?month=${toMonthParam(followingMonth)}`} aria-label="次の月">▶</Link>
            </div>
          </div>
          <div className={styles.weekdays}>
            {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
              <span
                key={day}
                className={
                  day === "日"
                    ? styles.weekdaySun
                    : day === "土"
                      ? styles.weekdaySat
                      : ""
                }
              >
                {day}
              </span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {dates.map((date) => {
              const dateParts = getJstDateParts(date);
              const key = toDateKey(date);
              const weekday = getJstWeekday(date);
              const isSunday = weekday === 0;
              const isSaturday = weekday === 6;
              const isHoliday = isJapaneseHolidayDateKey(key);
              const eventDetails = eventDetailMap.get(key);
              const schedules = Array.from(scheduleMap.get(key) || []);
              const isCurrentMonth =
                dateParts.year === currentMonthParts.year &&
                dateParts.month === currentMonthParts.month;
              const isToday = key === todayKey;

              const cellClassName = [
                styles.dayCell,
                isCurrentMonth ? "" : styles.outsideMonth,
                isToday ? styles.today : "",
                (isSunday || isHoliday) ? styles.dayCellHoliday : "",
                isSaturday ? styles.dayCellSaturday : "",
              ].filter(Boolean).join(" ");

              const dayNumberClassName = [
                styles.dayNumber,
                (isSunday || isHoliday) ? styles.dayNumberHoliday : "",
                isSaturday ? styles.dayNumberSaturday : "",
              ].filter(Boolean).join(" ");

              return (
                <Link
                  key={key}
                  href={`/calendar/${key}?from=home`}
                  className={cellClassName}
                >
                  <div className={dayNumberClassName}>{dateParts.day}</div>
                  <div className={styles.dayItems}>
                    {schedules.map((item, index) => {
                      const detailsByType = item === "試合" ? eventDetails?.match : eventDetails?.practice;
                      const tooltip = detailsByType && detailsByType.length > 0
                        ? detailsByType.join("\n----------------\n")
                        : undefined;

                      return (
                        <span
                          key={`${item}-${index}`}
                          className={`${styles.badge} ${item === "試合" ? styles.badgeMatch : styles.badgePractice}`}
                          title={tooltip}
                        >
                          {item}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.feedbackSection}>
          <Link href="/feedback" className={styles.feedbackButton}>
            アプリへのフィードバックを送る
          </Link>
        </section>

        <FloatingMobileTabs monthQuery={monthQuery} />
      </main>
    </div>
  );
}
