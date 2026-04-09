import { startAttendanceReminderScheduler } from "@/lib/attendance-reminder-scheduler";

export async function register(): Promise<void> {
  startAttendanceReminderScheduler();
}
