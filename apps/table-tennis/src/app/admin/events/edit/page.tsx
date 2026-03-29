import Link from "next/link";
import { AttendanceEventType } from "@prisma/client";
import {
  addJstDays,
  createJstDate,
  getJstDateParts,
  getJstWeekday,
  nowInJst,
  toDateKey,
  toDateTimeLocalValue,
} from "@/lib/date-format";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import styles from "../events-management.module.css";
import { HashSmoothScroll } from "./hash-smooth-scroll";

export const dynamic = "force-dynamic";

type EventEditPageProps = {
  searchParams: Promise<{
    month?: string;
    date?: string;
    ok?: string;
    error?: string;
  }>;
};

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
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function buildCalendarDates(baseDate: Date): Date[] {
  const baseParts = getJstDateParts(baseDate);
  const firstDay = createJstDate(baseParts.year, baseParts.month - 1, 1);
  const startOffset = getJstWeekday(firstDay);
  const startDate = addJstDays(firstDay, -startOffset);
  return Array.from({ length: 42 }, (_, index) => addJstDays(startDate, index));
}

function toTimeValue(date: Date): string {
  return toDateTimeLocalValue(date).slice(11, 16);
}

export default async function EventEditPage({ searchParams }: EventEditPageProps) {
  const params = await searchParams;
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>予定編集へのアクセス権限がありません</h1>
          <p>役職が管理者・コーチ・マネージャーのユーザーのみ利用できます。</p>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const currentMonth = parseMonthParam(params.month);
  const monthParts = getJstDateParts(currentMonth);
  const prevMonth = createJstDate(monthParts.year, monthParts.month - 2, 1);
  const nextMonth = createJstDate(monthParts.year, monthParts.month, 1);
  const dates = buildCalendarDates(currentMonth);

  const rangeStart = dates[0];
  const rangeEnd = addJstDays(dates[dates.length - 1], 1);

  const events = await prisma.attendanceEvent.findMany({
    where: {
      scheduledAt: {
        gte: rangeStart,
        lt: rangeEnd,
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : toDateKey(nowInJst());
  const todayKey = toDateKey(nowInJst());
  const monthParam = toMonthParam(currentMonth);
  const eventsByDate = new Map<string, typeof events>();

  for (const event of events) {
    const key = toDateKey(event.scheduledAt);
    const current = eventsByDate.get(key) || [];
    current.push(event);
    eventsByDate.set(key, current);
  }

  const selectedDateEvents = eventsByDate.get(selectedDateKey) || [];

  return (
    <main className={styles.page}>
      <HashSmoothScroll />

      <header className={styles.header}>
        <h1>予定編集</h1>
        <p>カレンダーの日付を押すと、その日の予定を編集できます。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/events">予定管理へ戻る</Link>
          <Link className={styles.secondaryLink} href="/admin/events/single">単体予定作成へ</Link>
        </div>
      </header>

      {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}
      {params.ok ? <p className={styles.ok}>保存しました: {params.ok}</p> : null}

      <section className={styles.card}>
        <h2>カレンダー</h2>
        <div className={styles.calendarCard}>
          <div className={styles.calendarHeaderBar}>
            <div>
              <strong>{monthParts.year}年 {monthParts.month}月</strong>
              <p className={styles.meta}>日付を選択すると下に編集フォームが表示されます。</p>
            </div>
            <div className={styles.monthSwitch}>
              <Link className={styles.monthButton} href={`/admin/events/edit?month=${toMonthParam(prevMonth)}`} aria-label="前の月">◀</Link>
              <Link className={styles.monthButton} href={`/admin/events/edit?month=${toMonthParam(nextMonth)}`} aria-label="次の月">▶</Link>
            </div>
          </div>

          <div className={styles.weekdaysBar}>
            {["日", "月", "火", "水", "木", "金", "土"].map((label) => <span key={label}>{label}</span>)}
          </div>

          <div className={styles.monthGrid}>
            {dates.map((date) => {
              const parts = getJstDateParts(date);
              const key = toDateKey(date);
              const isCurrentMonth = parts.year === monthParts.year && parts.month === monthParts.month;
              const isSelected = key === selectedDateKey;
              const isToday = key === todayKey;
              const dayEvents = eventsByDate.get(key) || [];
              const labels = Array.from(new Set(dayEvents.map((event) => event.eventType === AttendanceEventType.MATCH ? "試合" : "練習")));

              const className = [
                styles.monthCell,
                !isCurrentMonth ? styles.monthCellOutside : "",
                isSelected ? styles.monthCellActive : "",
                isToday ? styles.monthCellToday : "",
              ].filter(Boolean).join(" ");

              return (
                <Link
                  key={key}
                  href={`/admin/events/edit?month=${monthParam}&date=${key}#event-edit-forms`}
                  className={className}
                >
                  <div className={styles.monthDayNumber}>{parts.day}</div>
                  <div className={styles.monthBadgeRow}>
                    {labels.map((label) => (
                      <span
                        key={`${key}-${label}`}
                        className={`${styles.monthBadge} ${label === "試合" ? styles.monthBadgeMatch : styles.monthBadgePractice}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section id="event-edit-forms" className={`${styles.card} ${styles.scrollTarget}`}>
        <h2>選択日: {selectedDateKey}</h2>
        {selectedDateEvents.length === 0 ? (
          <p className={styles.notice}>この日の予定はありません。</p>
        ) : (
          <div className={styles.form}>
            {selectedDateEvents.map((event) => (
              <form key={event.id} action={`/api/events/${event.id}`} method="post" className={styles.card}>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="redirectTo" value={`/admin/events/edit?month=${monthParam}&date=${selectedDateKey}`} />
                <label>
                  種別
                  <select name="eventType" defaultValue={event.eventType}>
                    <option value={AttendanceEventType.PRACTICE}>練習</option>
                    <option value={AttendanceEventType.MATCH}>試合</option>
                  </select>
                </label>
                <label>
                  日付
                  <input type="date" name="eventDate" defaultValue={toDateTimeLocalValue(event.scheduledAt).slice(0, 10)} required />
                </label>
                <label>
                  時刻 (5分単位)
                  <input type="time" name="eventTime" step={300} defaultValue={toTimeValue(event.scheduledAt)} required />
                </label>
                <label>
                  対戦相手 (試合の場合)
                  <input type="text" name="matchOpponent" defaultValue={event.matchOpponent || ""} />
                </label>
                <label>
                  試合詳細 (試合の場合)
                  <textarea name="matchDetail" rows={2} defaultValue={event.matchDetail || ""} />
                </label>
                <label>
                  メモ
                  <textarea name="note" rows={2} defaultValue={event.note || ""} />
                </label>
                <button type="submit">変更を保存</button>
              </form>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
