import { createJstDate, getJstDateParts, getJstWeekday, nowInJst } from "@/lib/date-format";

export type WeekdayDefaultTimeRow = {
  key: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  label: string;
  startTime: string;
  endTime: string;
};

export const WEEKDAY_DEFAULT_TIME_ROWS: readonly WeekdayDefaultTimeRow[] = [
  { key: "sun", label: "日", startTime: "09:15", endTime: "13:00" },
  { key: "mon", label: "月", startTime: "15:15", endTime: "18:00" },
  { key: "tue", label: "火", startTime: "16:30", endTime: "18:30" },
  { key: "wed", label: "水", startTime: "15:55", endTime: "18:30" },
  { key: "thu", label: "木", startTime: "16:30", endTime: "18:30" },
  { key: "fri", label: "金", startTime: "15:15", endTime: "18:00" },
  { key: "sat", label: "土", startTime: "09:15", endTime: "13:00" },
] as const;

const FALLBACK_DEFAULT_TIME = { startTime: "19:00", endTime: "" };

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getDefaultEventTimesForDateKey(dateKey: string): { startTime: string; endTime: string } {
  if (!isDateKey(dateKey)) {
    return FALLBACK_DEFAULT_TIME;
  }

  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return FALLBACK_DEFAULT_TIME;
  }

  const date = createJstDate(year, month - 1, day);
  const dateParts = getJstDateParts(date);
  if (dateParts.year !== year || dateParts.month !== month || dateParts.day !== day) {
    return FALLBACK_DEFAULT_TIME;
  }

  const row = WEEKDAY_DEFAULT_TIME_ROWS[getJstWeekday(date)];
  if (!row) {
    return FALLBACK_DEFAULT_TIME;
  }

  return {
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

export function getTodayDateKeyInJst(): string {
  const now = nowInJst();
  const parts = getJstDateParts(now);
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
