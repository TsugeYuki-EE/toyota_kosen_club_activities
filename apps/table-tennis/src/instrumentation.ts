import { startAttendanceReminderScheduler } from "@/lib/attendance-reminder-scheduler";
import { startDailyAdminStatusScheduler } from "@/lib/admin-daily-status-scheduler";

export async function register(): Promise<void> {
  startAttendanceReminderScheduler();
  startDailyAdminStatusScheduler();
}
