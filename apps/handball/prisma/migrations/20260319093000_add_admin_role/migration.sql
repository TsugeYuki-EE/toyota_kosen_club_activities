-- Add ADMIN role and sync admin access flags by role.
UPDATE "Member"
SET "role" = 'ADMIN'
WHERE lower(coalesce("nickname", '')) = 'admin';

UPDATE "Member"
SET "canAccessAdmin" = ("role" <> 'PLAYER');
