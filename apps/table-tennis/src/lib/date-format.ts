type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type JstDateParts = LocalDateParts;

const JST_TIME_ZONE = "Asia/Tokyo";
const JST_OFFSET_MINUTES = 9 * 60;
const JST_OFFSET_MS = JST_OFFSET_MINUTES * 60 * 1000;

function toJstDate(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

function getLocalDateParts(date: Date): LocalDateParts {
  const jstDate = toJstDate(date);
  return {
    year: jstDate.getUTCFullYear(),
    month: jstDate.getUTCMonth() + 1,
    day: jstDate.getUTCDate(),
    hour: jstDate.getUTCHours(),
    minute: jstDate.getUTCMinutes(),
  };
}

export function getJstDateParts(date: Date): JstDateParts {
  return getLocalDateParts(date);
}

export function getJstWeekday(date: Date): number {
  return toJstDate(date).getUTCDay();
}

export function createJstDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0) - JST_OFFSET_MS);
}

export function addJstDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// 日時を画面表示向けの日本語フォーマットへ揃えます（JST固定）。
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// 日付だけを表示したい場面で使う共通フォーマッターです（JST固定）。
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// 現在時刻を返します。
export function nowInJst(): Date {
  return new Date();
}

// datetime-local input が扱いやすい形へ変換します。
export function toDateTimeLocalValue(date: Date): string {
  const parts = getLocalDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

// カレンダー集計用に日付を YYYY-MM-DD 文字列へ揃えます。
export function toDateKey(date: Date): string {
  const parts = getLocalDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

// 日付文字列 (YYYY-MM-DD) を JST 日付の検索範囲へ変換します。
export function getJstDayRangeFromDateKey(dateKey: string): { startUtc: Date; endUtc: Date } {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const startUtc = parseJstDateTimeToUtc(dateKey, "00:00");
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return { startUtc: new Date(Number.NaN), endUtc: new Date(Number.NaN) };
  }

  return { startUtc, endUtc };
}

// 月初から次月月初までの JST 日付検索範囲を返します。
export function getJstMonthRangeUtc(year: number, monthIndex: number): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0) - JST_OFFSET_MS);
  const endUtc = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) - JST_OFFSET_MS);
  return { startUtc, endUtc };
}

// 日付・時刻文字列を JST として Date (UTC instant) へ変換します。
export function parseJstDateTimeToUtc(dateText: string, timeText: string): Date {
  const [yearText, monthText, dayText] = dateText.split("-");
  const [hourText, minuteText] = timeText.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(Number.NaN);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return new Date(Number.NaN);
  }

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - JST_OFFSET_MS;
  const parsed = new Date(utcMs);
  const parsedParts = getLocalDateParts(parsed);

  if (
    parsedParts.year !== year ||
    parsedParts.month !== month ||
    parsedParts.day !== day ||
    parsedParts.hour !== hour ||
    parsedParts.minute !== minute
  ) {
    return new Date(Number.NaN);
  }

  return parsed;
}

// date/datetime-local 入力文字列を JST として UTC Date に変換します。
export function parseJstDateTimeInputToUtc(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseJstDateTimeToUtc(value, "00:00");
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!match) {
    return new Date(Number.NaN);
  }

  return parseJstDateTimeToUtc(match[1], match[2]);
}
