import { redirect } from "next/navigation";
import { nowInJst, toDateKey } from "@/lib/date-format";

export default function TodayTableTennisNotePage() {
  const todayKey = toDateKey(nowInJst());
  redirect(`/table-tennis-notes/${todayKey}`);
}
