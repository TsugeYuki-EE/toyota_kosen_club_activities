"use client";

import { useMemo, useState } from "react";
import { AttendanceEventType } from "@prisma/client";
import styles from "./events-management.module.css";

type BulkDatePickerProps = {
  defaultDate: string;
};

function nthWeekdayOfMonthUtc(year: number, month: number, weekday: number, nth: number): number {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function calcVernalEquinoxDay(year: number): number {
  if (year <= 1979) {
    return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  }
  if (year <= 2099) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function calcAutumnEquinoxDay(year: number): number {
  if (year <= 1979) {
    return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  }
  if (year <= 2099) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function toDateValueUtc(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getJapaneseHolidaySet(year: number): Set<string> {
  const holidays = new Set<string>();
  const addHoliday = (month: number, day: number) => holidays.add(toDateValueUtc(year, month, day));

  addHoliday(1, 1);
  addHoliday(2, 11);
  if (year >= 2020) {
    addHoliday(2, 23);
  }
  addHoliday(4, 29);
  addHoliday(5, 3);
  addHoliday(5, 4);
  addHoliday(5, 5);
  addHoliday(8, 11);
  addHoliday(11, 3);
  addHoliday(11, 23);

  if (year >= 2000) {
    addHoliday(1, nthWeekdayOfMonthUtc(year, 1, 1, 2));
  } else {
    addHoliday(1, 15);
  }

  if (year >= 2003) {
    addHoliday(7, nthWeekdayOfMonthUtc(year, 7, 1, 3));
  } else if (year >= 1996) {
    addHoliday(7, 20);
  }

  if (year >= 2003) {
    addHoliday(9, nthWeekdayOfMonthUtc(year, 9, 1, 3));
  } else if (year >= 1966) {
    addHoliday(9, 15);
  }

  if (year >= 2000) {
    addHoliday(10, nthWeekdayOfMonthUtc(year, 10, 1, 2));
  } else if (year >= 1966) {
    addHoliday(10, 10);
  }

  addHoliday(3, calcVernalEquinoxDay(year));
  addHoliday(9, calcAutumnEquinoxDay(year));

  if (year >= 2020) {
    addHoliday(8, 11);
  }

  const baseHolidays = [...holidays];
  for (const dateValue of baseHolidays) {
    const [yearText, monthText, dayText] = dateValue.split("-");
    const month = Number(monthText);
    const day = Number(dayText);
    const base = new Date(Date.UTC(Number(yearText), month - 1, day));
    if (base.getUTCDay() === 0) {
      const substitute = new Date(base);
      do {
        substitute.setUTCDate(substitute.getUTCDate() + 1);
      } while (holidays.has(toDateValueUtc(substitute.getUTCFullYear(), substitute.getUTCMonth() + 1, substitute.getUTCDate())));
      holidays.add(toDateValueUtc(substitute.getUTCFullYear(), substitute.getUTCMonth() + 1, substitute.getUTCDate()));
    }
  }

  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    for (let day = 2; day <= daysInMonth - 1; day += 1) {
      const current = toDateValueUtc(year, month, day);
      const prev = toDateValueUtc(year, month, day - 1);
      const next = toDateValueUtc(year, month, day + 1);
      const currentWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (year >= 1985 && currentWeekday !== 0 && holidays.has(prev) && holidays.has(next) && !holidays.has(current)) {
        holidays.add(current);
      }
    }
  }

  return holidays;
}

function getTodayJstDateValue(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function BulkDatePicker({ defaultDate }: BulkDatePickerProps) {
  const [monthValue, setMonthValue] = useState(defaultDate.slice(0, 7));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const todayDateValue = useMemo(() => getTodayJstDateValue(), []);

  const sortedSelectedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.localeCompare(b)),
    [selectedDates],
  );

  const calendarCells = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(monthValue)) {
      return [] as Array<{ key: string; day: number | null; dateValue: string | null; weekday: number | null; isHoliday: boolean }>;
    }

    const [yearText, monthText] = monthValue.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return [] as Array<{ key: string; day: number | null; dateValue: string | null; weekday: number | null; isHoliday: boolean }>;
    }

    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const holidaySet = getJapaneseHolidaySet(year);
    const cells: Array<{ key: string; day: number | null; dateValue: string | null; weekday: number | null; isHoliday: boolean }> = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ key: `empty-${index}`, day: null, dateValue: null, weekday: null, isHoliday: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateValue = `${yearText}-${monthText}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      cells.push({ key: dateValue, day, dateValue, weekday, isHoliday: holidaySet.has(dateValue) });
    }

    return cells;
  }, [monthValue]);

  function toggleDate(date: string) {
    if (!date) {
      return;
    }

    setSelectedDates((current) => {
      if (current.includes(date)) {
        return current.filter((value) => value !== date);
      }
      return [...current, date];
    });
  }

  function clearDates() {
    setSelectedDates([]);
  }

  return (
    <form action="/api/events/bulk" method="post" className={styles.form}>
      <input type="hidden" name="eventDates" value={sortedSelectedDates.join(",")} />
      <input type="hidden" name="redirectTo" value="/admin/events" />

      <label>
        種別
        <select name="eventType" defaultValue={AttendanceEventType.PRACTICE}>
          <option value={AttendanceEventType.PRACTICE}>練習</option>
          <option value={AttendanceEventType.MATCH}>試合</option>
        </select>
      </label>

      <label>
        カレンダー月
        <input
          type="month"
          value={monthValue}
          onChange={(event) => setMonthValue(event.target.value)}
          required
        />
      </label>

      <div className={styles.calendarWrap}>
        <p className={styles.meta}>日付を複数選択 (同時に複数日を選んで一括作成できます)</p>
        <div className={styles.weekHeader}>
          {[
            "日", "月", "火", "水", "木", "金", "土",
          ].map((weekLabel) => (
            <span
              key={weekLabel}
              className={
                weekLabel === "日"
                  ? `${styles.weekLabel} ${styles.weekLabelSun}`
                  : weekLabel === "土"
                    ? `${styles.weekLabel} ${styles.weekLabelSat}`
                    : styles.weekLabel
              }
            >
              {weekLabel}
            </span>
          ))}
        </div>
        <p className={styles.calendarLegend}>赤: 日曜/祝日 青: 土曜 枠強調: 当日</p>
        <div className={styles.calendarGrid}>
          {calendarCells.map((cell) => {
            if (!cell.dateValue || !cell.day) {
              return <span key={cell.key} className={styles.blankDay} />;
            }

            const isChecked = selectedDates.includes(cell.dateValue);
            const isToday = cell.dateValue === todayDateValue;
            const isSunday = cell.weekday === 0;
            const isSaturday = cell.weekday === 6;
            const dayClassName = [
              styles.calendarDay,
              isChecked ? styles.calendarDayActive : "",
              isToday ? styles.calendarDayToday : "",
              (isSunday || cell.isHoliday) ? styles.calendarDayHoliday : "",
              isSaturday ? styles.calendarDaySaturday : "",
            ].filter(Boolean).join(" ");

            return (
              <label
                key={cell.key}
                className={dayClassName}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleDate(cell.dateValue as string)}
                />
                <span className={styles.calendarDayInner}>
                  <span className={styles.calendarDayNumber}>{cell.day}</span>
                  <span className={styles.calendarTagRow}>
                    {isToday ? <span className={styles.todayTag}>今日</span> : null}
                    {cell.isHoliday ? <span className={styles.holidayTag}>祝</span> : null}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className={styles.selectedDatesWrap}>
        <p className={styles.meta}>選択済み日付 ({sortedSelectedDates.length})</p>
        {sortedSelectedDates.length === 0 ? (
          <p className={styles.noticeText}>まだ日付が選択されていません。</p>
        ) : (
          <ul className={styles.selectedDatesList}>
            {sortedSelectedDates.map((date) => (
              <li key={date} className={styles.selectedDateItem}>
                <span>{date}</span>
                <button
                  type="button"
                  className={styles.removeDateButton}
                  onClick={() => toggleDate(date)}
                  aria-label={`${date} を削除`}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.inlineRow}>
          <button type="button" className={styles.secondaryButton} onClick={clearDates}>
            日付を全てクリア
          </button>
        </div>
      </div>

      <label>
        時刻 (5分単位)
        <input type="time" name="eventTime" step={300} defaultValue="19:00" required />
      </label>

      <label>
        対戦相手 (試合の場合)
        <input type="text" name="matchOpponent" placeholder="例: 豊田北高校" />
      </label>

      <label>
        試合詳細 (試合の場合)
        <textarea name="matchDetail" rows={2} placeholder="例: 会場、集合時刻、ユニフォーム情報" />
      </label>

      <label>
        補足
        <textarea name="note" rows={2} />
      </label>

      <button type="submit" disabled={sortedSelectedDates.length === 0}>
        複数予定を作成
      </button>
    </form>
  );
}
