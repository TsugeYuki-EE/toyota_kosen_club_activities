export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [attendanceReminderScheduler, dailyAdminStatusScheduler] = await Promise.all([
    import("@/lib/attendance-reminder-scheduler"),
    import("@/lib/admin-daily-status-scheduler"),
  ]);

  attendanceReminderScheduler.startAttendanceReminderScheduler();
  dailyAdminStatusScheduler.startDailyAdminStatusScheduler();
}
