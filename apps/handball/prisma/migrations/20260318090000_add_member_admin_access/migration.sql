-- Add per-member admin access flag.
ALTER TABLE "Member" ADD COLUMN "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false;
