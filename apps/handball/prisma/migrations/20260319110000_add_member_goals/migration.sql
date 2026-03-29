-- Add personal goal fields to member profile.
ALTER TABLE "Member" ADD COLUMN "yearlyGoal" TEXT;
ALTER TABLE "Member" ADD COLUMN "monthlyGoal" TEXT;
