import { type ReactNode } from "react";
import styles from "./weight-history-chart.module.css";

type WeightRecordLike = {
  id: string;
  submittedAt: Date;
  weightKg: number;
};

type WeightHistoryChartProps = {
  records: WeightRecordLike[];
  emptyMessage?: string;
  graphTitle?: string;
  actionHeader?: string;
  renderAction?: (record: WeightRecordLike) => ReactNode;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateAxisFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatAxisWeight(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function WeightHistoryChart({
  records,
  emptyMessage = "まだ体重記録はありません。",
  graphTitle = "体重推移グラフ",
  actionHeader,
  renderAction,
}: WeightHistoryChartProps) {
  if (records.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  const sortedRecords = [...records].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const values = sortedRecords.map((record) => record.weightKg);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const visualPadding = Math.max((maxValue - minValue) * 0.2, 0.8);
  const axisMin = Math.max(0, minValue - visualPadding);
  const axisMax = maxValue + visualPadding;
  const axisRange = Math.max(axisMax - axisMin, 1);

  const pointCount = sortedRecords.length;
  const chartHeight = 320;
  const paddingTop = 28;
  const paddingBottom = 58;
  const paddingLeft = 56;
  const paddingRight = 20;
  const chartWidth = Math.max(700, pointCount * 88);
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const stepX = pointCount > 1 ? plotWidth / (pointCount - 1) : 0;

  const points = sortedRecords.map((record, index) => {
    const x = paddingLeft + stepX * index;
    const ratio = (record.weightKg - axisMin) / axisRange;
    const y = paddingTop + (1 - ratio) * plotHeight;
    return { ...record, x, y };
  });

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const ratio = i / (tickCount - 1);
    const y = paddingTop + (1 - ratio) * plotHeight;
    const value = axisMin + axisRange * ratio;
    return { y, value };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className={styles.section}>
      <div className={styles.scrollArea}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">時間</th>
              <th scope="col">体重(kg)</th>
              {renderAction && actionHeader ? <th scope="col">{actionHeader}</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => (
              <tr key={record.id}>
                <td>{dateFormatter.format(record.submittedAt)}</td>
                <td>{timeFormatter.format(record.submittedAt)}</td>
                <td className={styles.weightCell}>{record.weightKg}</td>
                {renderAction && actionHeader ? <td>{renderAction(record)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.chartTitle}>{graphTitle}</h3>
      <div className={styles.scrollArea}>
        <div className={styles.chartShell} style={{ width: `${chartWidth}px` }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width={chartWidth}
            height={chartHeight}
            role="img"
            aria-label="体重推移の折れ線グラフ"
          >
            {yTicks.map((tick) => (
              <g key={`tick-${tick.y}`}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={chartWidth - paddingRight}
                  y2={tick.y}
                  stroke="#e3ebf1"
                  strokeWidth="1"
                />
                <text x={paddingLeft - 8} y={tick.y + 4} textAnchor="end" className={styles.axisLabel}>
                  {formatAxisWeight(tick.value)}
                </text>
              </g>
            ))}

            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={chartHeight - paddingBottom}
              stroke="#b9c9d5"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              y1={chartHeight - paddingBottom}
              x2={chartWidth - paddingRight}
              y2={chartHeight - paddingBottom}
              stroke="#b9c9d5"
              strokeWidth="1"
            />

            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#2f7da8"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {points.map((point) => (
              <g key={`point-${point.id}`}>
                <circle cx={point.x} cy={point.y} r="4.5" fill="#2f7da8" />
                <text x={point.x} y={Math.max(point.y - 10, 14)} textAnchor="middle" className={styles.pointLabel}>
                  {point.weightKg}kg
                </text>
                <text
                  x={point.x}
                  y={chartHeight - paddingBottom + 20}
                  textAnchor="middle"
                  className={styles.axisLabel}
                >
                  {dateAxisFormatter.format(point.submittedAt)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}