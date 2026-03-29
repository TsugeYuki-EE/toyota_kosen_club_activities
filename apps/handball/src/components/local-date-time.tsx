"use client";

import { useMemo } from "react";

const JST_TIME_ZONE = "Asia/Tokyo";

type LocalDateTimeProps = {
  value: Date | string | number;
  className?: string;
  emptyText?: string;
};

type LocalDateProps = {
  value: Date | string | number;
  className?: string;
  emptyText?: string;
};

function toValidDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function LocalDateTime({ value, className, emptyText = "-" }: LocalDateTimeProps) {
  const date = useMemo(() => toValidDate(value), [value]);
  const isClient = typeof window !== "undefined";

  if (!date) {
    return <span className={className}>{emptyText}</span>;
  }

  return (
    <time className={className} dateTime={date.toISOString()} suppressHydrationWarning>
      {isClient
        ? new Intl.DateTimeFormat("ja-JP", {
          timeZone: JST_TIME_ZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date)
        : ""}
    </time>
  );
}

export function LocalDate({ value, className, emptyText = "-" }: LocalDateProps) {
  const date = useMemo(() => toValidDate(value), [value]);
  const isClient = typeof window !== "undefined";

  if (!date) {
    return <span className={className}>{emptyText}</span>;
  }

  return (
    <time className={className} dateTime={date.toISOString()} suppressHydrationWarning>
      {isClient
        ? new Intl.DateTimeFormat("ja-JP", {
          timeZone: JST_TIME_ZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date)
        : ""}
    </time>
  );
}
