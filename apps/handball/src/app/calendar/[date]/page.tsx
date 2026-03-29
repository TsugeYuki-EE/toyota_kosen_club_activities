import Link from "next/link";
import { AttendanceStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { canAccessAdminByMember } from "@/lib/admin-access";
import { getJstDayRangeFromDateKey } from "@/lib/date-format";
import { LocalDate, LocalDateTime } from "@/components/local-date-time";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import styles from "@/app/member-page-shared.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ ok?: string; error?: string; from?: string }>;
};

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function statusLabel(status: AttendanceStatus): string {
  if (status === AttendanceStatus.ATTEND) {
    return "出席";
  }

  if (status === AttendanceStatus.LATE) {
    return "遅刻";
  }

  if (status === AttendanceStatus.ABSENT) {
    return "欠席";
  }

  return "未回答";
}

export default async function CalendarDatePage({ params, searchParams }: PageProps) {
  const { date } = await params;
  const query = await searchParams;
  const isHomeCalendarMode = query.from === "home";

  if (!isDateKey(date)) {
    notFound();
  }

  const member = await getSessionMember();
  if (!member) {
    redirect("/auth");
  }

  const selectedDate = dateFromKey(date);
  const canViewAttendanceDetails = canAccessAdminByMember(member);
  const { startUtc: dayStart, endUtc: dayEnd } = getJstDayRangeFromDateKey(date);

  const [players, events, matches, practiceMenus] = await Promise.all([
    prisma.member.findMany({
      where: { role: "PLAYER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceEvent.findMany({
      where: {
        scheduledAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      include: {
        records: {
          include: { member: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.matchRecord.findMany({
      where: {
        attendanceEventId: null,
        matchDate: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      orderBy: { matchDate: "asc" },
    }),
    prisma.practiceMenu.findMany({
      where: {
        practiceDate: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      include: { createdBy: true },
      orderBy: { practiceDate: "asc" },
    }),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1><LocalDate value={selectedDate} /> の確認</h1>
        <p>この日に必要な情報を確認し、出席入力までこのページで行えます。</p>
      </header>

      <nav className={styles.nav}>
        <Link href="/" className={styles.secondaryLink}>カレンダーへ戻る</Link>
      </nav>

      {query.ok ? <p className={styles.message}>保存しました: {query.ok}</p> : null}
      {query.error ? <p className={styles.error}>エラー: {query.error}</p> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>当日の予定</h2>
          <ul className={styles.list}>
            {events.map((event) => (
              <li key={event.id}>出席イベント: {event.title} / <LocalDateTime value={event.scheduledAt} /></li>
            ))}
            {matches.map((match) => (
              <li key={match.id}>試合: vs {match.opponent} / <LocalDateTime value={match.matchDate} /></li>
            ))}
            {practiceMenus.map((practice) => (
              <li key={practice.id}>練習: {practice.title} / <LocalDateTime value={practice.practiceDate} /></li>
            ))}
            {events.length === 0 && matches.length === 0 && practiceMenus.length === 0 ? (
              <li className={styles.empty}>この日の予定はありません。</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className={styles.listGrid}>
        {events.map((event) => {
          const attendMembers = event.records.filter((record) => record.status === AttendanceStatus.ATTEND).map((record) => record.member.name);
          const lateMembers = event.records.filter((record) => record.status === AttendanceStatus.LATE).map((record) => record.member.name);
          const absentMembers = event.records.filter((record) => record.status === AttendanceStatus.ABSENT).map((record) => record.member.name);
          const answeredIds = new Set(event.records.map((record) => record.memberId));
          const unansweredMembers = players.filter((player) => !answeredIds.has(player.id)).map((player) => player.name);
          const myRecord = event.records.find((record) => record.memberId === member.id);

          return (
            <article key={event.id} className={styles.card}>
              <h2>{event.title}</h2>
              <p className={styles.meta}><LocalDateTime value={event.scheduledAt} /></p>
              {event.matchDetail || event.note ? (
                <div className={styles.infoBox}>
                  <p className={styles.infoTitle}>提出前に確認</p>
                  {event.matchDetail ? <p className={styles.meta}>試合詳細: {event.matchDetail}</p> : null}
                  {event.note ? <p className={styles.meta}>補足: {event.note}</p> : null}
                </div>
              ) : null}
              {!isHomeCalendarMode ? (
                <>
                  <div className={styles.statusRow}>
                    <span className={`${styles.statusBadge} ${styles.attend}`}>出席 {attendMembers.length}</span>
                    <span className={`${styles.statusBadge} ${styles.late}`}>遅刻 {lateMembers.length}</span>
                    <span className={`${styles.statusBadge} ${styles.absent}`}>欠席 {absentMembers.length}</span>
                    <span className={`${styles.statusBadge} ${styles.unknown}`}>未回答 {unansweredMembers.length}</span>
                  </div>
                  <p className={styles.meta}>出席: {attendMembers.length > 0 ? attendMembers.join("、") : "なし"}</p>
                  <p className={styles.meta}>遅刻: {lateMembers.length > 0 ? lateMembers.join("、") : "なし"}</p>
                  <p className={styles.meta}>欠席: {absentMembers.length > 0 ? absentMembers.join("、") : "なし"}</p>
                  <p className={styles.meta}>未回答: {unansweredMembers.length > 0 ? unansweredMembers.join("、") : "なし"}</p>
                </>
              ) : null}

              {isHomeCalendarMode && !myRecord ? (
                <p className={styles.infoTitle}>あなたはこのイベントに未回答です。</p>
              ) : null}

              <form action="/api/self-attendance" method="post" className={styles.form}>
                <input
                  type="hidden"
                  name="redirectTo"
                  value={isHomeCalendarMode ? `/calendar/${date}?from=home` : `/calendar/${date}`}
                />
                <input type="hidden" name="eventId" value={event.id} />
                <label>
                  自分の出席状況
                  <select name="status" defaultValue={myRecord?.status || AttendanceStatus.ATTEND}>
                    <option value={AttendanceStatus.ATTEND}>出席</option>
                    <option value={AttendanceStatus.LATE}>遅刻</option>
                    <option value={AttendanceStatus.ABSENT}>欠席</option>
                  </select>
                </label>
                <label>
                  コメント
                  <textarea name="comment" rows={3} defaultValue={myRecord?.comment || ""} />
                </label>
                <button type="submit" className={styles.button}>このイベントに提出する</button>
              </form>

              {canViewAttendanceDetails ? (
                <Link href={`/calendar/${date}/attendance-details`} className={styles.secondaryLink}>
                  出欠詳細情報を見る
                </Link>
              ) : null}

              <p className={styles.meta}>
                自分の現在回答: {myRecord ? <>{statusLabel(myRecord.status)} (<LocalDateTime value={myRecord.submittedAt} />)</> : "未回答"}
              </p>
            </article>
          );
        })}
        {events.length === 0 ? <p className={styles.empty}>この日の出席イベントはありません。</p> : null}
      </section>
    </main>
  );
}
