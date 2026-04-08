"use client";

function formatTrendDayLabel(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * 추이 차트와 동일한 `points` 순서로 일자별 실행 시간 텍스트 목록
 */
export function ExecutionTrendDayList({ points, formatDuration }) {
  if (!points?.length) return null;

  return (
    <div className="rounded-lg border border-black/[0.06] bg-slate-50/60">
      <ul className="divide-y divide-black/[0.06]">
        {points.map(({ ymd, seconds }) => (
          <li
            key={ymd}
            className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] leading-snug"
          >
            <span className="min-w-0 text-slate-600">{formatTrendDayLabel(ymd)}</span>
            <span className="shrink-0 tabular-nums font-medium text-slate-800">
              {formatDuration(seconds)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 일별 실행 시간(초) 막대 — 높이는 기간 내 최댓값 대비 비율
 * - month/week 모두 화면 가로폭에 맞춰 칸을 균등 분배
 */
export default function ExecutionTrendBarChart({ points, formatDuration, period = "month" }) {
  const isWeek = period === "week";
  const maxSec = points.reduce((m, p) => Math.max(m, p.seconds), 1);

  return (
    <div className="w-full pb-2">
      <div
        className="grid min-h-[140px] items-end gap-1 px-0.5 pt-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
      >
        {points.map(({ ymd, seconds }) => {
          const day = Number(ymd.slice(8, 10));
          const isZeroValue = seconds <= 0;
          const h = isZeroValue ? 2 : maxSec > 0 ? Math.max(4, (seconds / maxSec) * 112) : 2;
          return (
            <div
              key={ymd}
              className="flex min-w-0 flex-col items-center gap-1"
              title={`${ymd}: ${formatDuration(seconds)}`}
            >
              <div className="flex h-[112px] w-full items-end justify-center">
                <div
                  className={[
                    isWeek ? "w-[calc(100%-2px)]" : "w-[calc(100%-4px)]",
                    isZeroValue ? "rounded-full bg-orange-400/85" : "rounded-t bg-orange-500/90",
                    "transition-[height] duration-300",
                  ].join(" ")}
                  style={{ height: `${h}px` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-slate-500">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
