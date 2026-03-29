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

function buildJapaneseHolidaySet(year: number): Set<string> {
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

  const baseHolidays = [...holidays];
  for (const dateValue of baseHolidays) {
    const [yearText, monthText, dayText] = dateValue.split("-");
    const base = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
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

const holidayCache = new Map<number, Set<string>>();

function getHolidaySet(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) {
    return cached;
  }
  const generated = buildJapaneseHolidaySet(year);
  holidayCache.set(year, generated);
  return generated;
}

export function isJapaneseHolidayDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isInteger(year)) {
    return false;
  }
  return getHolidaySet(year).has(dateKey);
}
