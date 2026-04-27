"use client";

import { useState } from "react";
import { AttendanceStatus } from "@prisma/client";
import styles from "@/app/member-page-shared.module.css";

type AttendanceSubmitFormProps = {
  eventId: string;
  redirectTo: string;
  initialStatus: AttendanceStatus;
  initialComment: string;
};

export function AttendanceSubmitForm({
  eventId,
  redirectTo,
  initialStatus,
  initialComment,
}: AttendanceSubmitFormProps) {
  const [status, setStatus] = useState<AttendanceStatus>(initialStatus);
  const [comment, setComment] = useState(initialComment);

  const showCommentField = status !== AttendanceStatus.ATTEND;

  return (
    <form action="/api/self-attendance" method="post" className={styles.form}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        自分の出席状況
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.currentTarget.value as AttendanceStatus)}
        >
          <option value={AttendanceStatus.ATTEND}>出席</option>
          <option value={AttendanceStatus.LATE}>遅刻</option>
          <option value={AttendanceStatus.ABSENT}>欠席</option>
        </select>
      </label>

      {showCommentField ? (
        <label>
          コメント
          <textarea
            name="comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            required
            placeholder="理由を記入"
          />
        </label>
      ) : null}

      {showCommentField ? (
        <p className={styles.meta}>遅刻・欠席の場合はコメントの入力が必要です。</p>
      ) : null}

      <button type="submit" className={styles.button}>このイベントに提出する</button>
    </form>
  );
}