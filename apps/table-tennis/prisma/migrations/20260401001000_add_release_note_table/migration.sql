-- CreateTable
CREATE TABLE "ReleaseNote" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseNote_version_key" ON "ReleaseNote"("version");

-- AddForeignKey
ALTER TABLE "ReleaseNote" ADD CONSTRAINT "ReleaseNote_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
