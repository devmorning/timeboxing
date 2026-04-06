"use client";

/**
 * 일별 실행 시간(초) 막대 — 가로 스크롤, 높이는 월 내 최댓값 대비 비율
 */
export default function ExecutionTrendBarChart({ points, formatDuration }) {
  const maxSec = points.reduce((m, p) => Math.max(m, p.seconds), 1);

  return (
    <div className="w-full overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      <div className="flex min-h-[140px] min-w-max items-end gap-1 px-0.5 pt-2">
        {points.map(({ ymd, seconds }) => {
          const day = Number(ymd.slice(8, 10));
          const h = maxSec > 0 ? Math.max(4, (seconds / maxSec) * 112) : 4;
          return (
            <div
              key={ymd}
              className="flex w-7 shrink-0 flex-col items-center gap-1"
              title={`${ymd}: ${formatDuration(seconds)}`}
            >
              <div className="flex h-[112px] w-full items-end justify-center">
                <div
                  className="w-4 rounded-t bg-orange-500/90 transition-[height] duration-300"
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
