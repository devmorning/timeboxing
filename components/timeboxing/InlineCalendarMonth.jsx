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
      className="mb-6 last:mb-2"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "320px",
      }}
    >
      <h3 className="mb-2 text-center text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] font-semibold text-slate-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={`${ym}_${d}`} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1.5">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`${ym}_e_${idx}`} className="min-h-[48px]" />;
          }

          const isSelected = cell.dateYmd === selectedDate;
          const isMarked = markedDates.has(cell.dateYmd);

          return (
            <div
              key={cell.dateYmd}
              className="flex min-h-[48px] flex-col items-center justify-start"
            >
              <button
                type="button"
                onClick={() => onSelectDate(cell.dateYmd)}
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
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
