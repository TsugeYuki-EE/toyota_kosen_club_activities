-- CreateTable
CREATE TABLE "AdminAnnouncement" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAnnouncement_startsAt_endsAt_idx" ON "AdminAnnouncement"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AdminAnnouncement_createdAt_idx" ON "AdminAnnouncement"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminAnnouncement" ADD CONSTRAINT "AdminAnnouncement_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
