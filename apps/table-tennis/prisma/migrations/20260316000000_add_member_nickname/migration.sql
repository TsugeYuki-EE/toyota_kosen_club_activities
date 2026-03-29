-- AlterTable
ALTER TABLE "Member" ADD COLUMN "nickname" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_nickname_key" ON "Member"("nickname");
