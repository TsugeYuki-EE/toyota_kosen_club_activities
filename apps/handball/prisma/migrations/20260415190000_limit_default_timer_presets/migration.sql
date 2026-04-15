-- Remove legacy system timer presets so only the new defaults remain.
DELETE FROM "TimerPreset"
WHERE "isSystemPreset" = true;

INSERT INTO "TimerPreset" ("id", "name", "durationSeconds", "setCount", "description", "isSystemPreset", "createdByMemberId", "createdAt", "updatedAt") VALUES
  ('timer-system-break-120', '休憩2分', 120, 1, '短い休憩', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-interval-120-6', '2:00 × 6セット', 120, 6, '2分の反復練習', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-interval-150-6', '2:30 × 6セット', 150, 6, '少し長めの反復練習', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);