-- CreateTable
CREATE TABLE "TimerPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "setCount" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "isSystemPreset" BOOLEAN NOT NULL DEFAULT false,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimerPreset_isSystemPreset_createdByMemberId_idx" ON "TimerPreset"("isSystemPreset", "createdByMemberId");

-- AddForeignKey
ALTER TABLE "TimerPreset" ADD CONSTRAINT "TimerPreset_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed system presets
INSERT INTO "TimerPreset" ("id", "name", "durationSeconds", "setCount", "description", "isSystemPreset", "createdByMemberId", "createdAt", "updatedAt") VALUES
  ('timer-system-stretch', 'ストレッチ', 30, 1, '準備運動の切り替え', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-break', '休憩', 120, 1, '短い休憩', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-drill', '基礎練習', 300, 1, '基本メニュー', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-set', 'セット練習', 600, 1, '集中して回す', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-match', '試合前', 900, 1, '本番前の準備', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-interval-90-4', '1分30秒 × 4セット', 90, 4, '基礎メニューの反復', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-interval-120-3', '2分 × 3セット', 120, 3, '少し長めの反復', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('timer-system-interval-45-6', '45秒 × 6セット', 45, 6, '素早い切り替え', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
