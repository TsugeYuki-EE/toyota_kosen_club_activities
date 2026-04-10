-- Add email field for member registration and profile updates.
ALTER TABLE "Member" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
