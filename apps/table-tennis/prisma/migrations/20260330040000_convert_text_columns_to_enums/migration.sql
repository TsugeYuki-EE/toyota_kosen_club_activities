-- Align PostgreSQL enum types with current Prisma schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('PLAYER', 'MANAGER', 'COACH', 'ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
    CREATE TYPE "AttendanceStatus" AS ENUM ('ATTEND', 'ABSENT', 'LATE', 'UNKNOWN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InputType') THEN
    CREATE TYPE "InputType" AS ENUM ('ATTENDANCE', 'WEIGHT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceEventType') THEN
    CREATE TYPE "AttendanceEventType" AS ENUM ('PRACTICE', 'MATCH');
  END IF;
END
$$;

ALTER TABLE "Member"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role"
    USING CASE
      WHEN "role" IN ('PLAYER', 'MANAGER', 'COACH', 'ADMIN') THEN "role"::"Role"
      ELSE 'PLAYER'::"Role"
    END,
  ALTER COLUMN "role" SET DEFAULT 'PLAYER'::"Role";

ALTER TABLE "AttendanceRecord"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AttendanceStatus"
    USING CASE
      WHEN "status" IN ('ATTEND', 'ABSENT', 'LATE', 'UNKNOWN') THEN "status"::"AttendanceStatus"
      ELSE 'UNKNOWN'::"AttendanceStatus"
    END,
  ALTER COLUMN "status" SET DEFAULT 'UNKNOWN'::"AttendanceStatus";

ALTER TABLE "InputToken"
  ALTER COLUMN "type" TYPE "InputType"
    USING CASE
      WHEN "type" IN ('ATTENDANCE', 'WEIGHT') THEN "type"::"InputType"
      ELSE 'ATTENDANCE'::"InputType"
    END;

ALTER TABLE "AttendanceEvent"
  ALTER COLUMN "eventType" DROP DEFAULT,
  ALTER COLUMN "eventType" TYPE "AttendanceEventType"
    USING CASE
      WHEN "eventType" IN ('PRACTICE', 'MATCH') THEN "eventType"::"AttendanceEventType"
      ELSE 'PRACTICE'::"AttendanceEventType"
    END,
  ALTER COLUMN "eventType" SET DEFAULT 'PRACTICE'::"AttendanceEventType";
