"use client";

import { memo, useMemo } from "react";
import { formatMonthTitle, getCellsForMonth } from "./utils/calendarMonth.js";

export const InlineCalendarMonth = memo(function InlineCalendarMonth({
  ym,
  selectedDate,
  markedDates,
  onSelectDate,
}) {
  const cells = useMemo(() => getCellsForMonth(ym), [ym]);
  const title = useMemo(() => formatMonthTitle(ym), [ym]);

  return (
    <div
      id={`cal-month-${ym}`}
      className="mb-6 w-full max-w-full min-w-0 overflow-x-hidden last:mb-2"
      style={{
        contentVisibility: "auto",
        // content-visibility 사용 시 레이아웃 점프를 줄이되, 가로(inline) 크기는 예약하지 않도록 최소값으로 둔다.
        containIntrinsicSize: "1px 320px",
      }}
    >
      <h3 className="mb-2 text-center text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid w-full grid-cols-7 gap-1 text-center text-[12px] font-semibold text-slate-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={`${ym}_${d}`} className="min-w-0 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid w-full grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`${ym}_e_${idx}`} className="min-w-0 aspect-square w-full" />;
          }

          const isSelected = cell.dateYmd === selectedDate;
          const isMarked = markedDates.has(cell.dateYmd);

          return (
            <div
              key={cell.dateYmd}
              className="flex w-full min-w-0 flex-col items-center justify-start"
            >
              <button
                type="button"
                onClick={() => onSelectDate(cell.dateYmd)}
                className={[
                  "flex aspect-square w-full min-w-0 max-w-10 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-orange-600 text-white"
                    : "bg-transparent text-slate-700 hover:bg-black/[0.04]",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                ].join(" ")}
              >
                {cell.day}
              </button>
              <span
                aria-hidden
                className={[
                  "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  isMarked ? "bg-orange-500" : "opacity-0",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
