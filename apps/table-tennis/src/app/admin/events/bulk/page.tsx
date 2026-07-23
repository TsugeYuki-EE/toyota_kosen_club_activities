// サーバーコンポーネント
import { BulkDatePicker } from "./bulk-date-picker";

// デフォルトの日付を計算
function getDefaultDate(): string {
  const today = new Date();
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
}

// サーバーコンポーネントとしてデフォルトエクスポート
export default function BulkPage({ defaultDate }: { defaultDate?: string }) {
  const today = defaultDate || getDefaultDate();
  return <BulkDatePicker defaultDate={today} />;
}