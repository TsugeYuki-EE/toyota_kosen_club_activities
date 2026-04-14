-- 出席イベントに終了時刻を追加します。
ALTER TABLE "AttendanceEvent"
ADD COLUMN "endAt" TIMESTAMP(3);
