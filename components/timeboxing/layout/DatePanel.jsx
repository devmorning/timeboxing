"use client";

import { addDaysToYmd } from "../utils/dateYmd.js";
import Card from "./Card.jsx";

function formatKoreanDateLine(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export default function DatePanel({
  date,
  onChange,
  disabled = false,
}) {
  const dateLabel = formatKoreanDateLine(date);

  return (
    <Card padding={false} className="bg-white">
      <div className="border-b border-black/[0.06] px-4 py-4">
        <div
          suppressHydrationWarning
          className="break-words text-center text-[22px] font-semibold leading-tight tracking-tight text-slate-900"
        >
          {dateLabel}
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          data-no-swipe
          aria-label="이전 날"
          disabled={disabled}
          onClick={() => onChange?.(addDaysToYmd(date, -1))}
          className="relative z-10 h-11 min-w-[44px] select-none rounded-full bg-slate-100 text-[22px] font-semibold text-slate-800 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {"<"}
        </button>

        <div className="relative z-0 min-w-0 flex-1 px-1">
          <input
            id="date_input"
            data-no-swipe
            type="date"
            value={date}
            disabled={disabled}
            suppressHydrationWarning
            onChange={(e) => onChange?.(e.target.value)}
            className="block w-full min-w-0 rounded-[12px] border border-black/[0.08] bg-[#F2F2F7] px-3 py-2.5 text-center text-[17px] font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          data-no-swipe
          aria-label="다음 날"
          disabled={disabled}
          onClick={() => onChange?.(addDaysToYmd(date, 1))}
          className="relative z-10 h-11 min-w-[44px] select-none rounded-full bg-slate-100 text-[22px] font-semibold text-slate-800 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {">"}
        </button>
      </div>
    </Card>
  );
}

