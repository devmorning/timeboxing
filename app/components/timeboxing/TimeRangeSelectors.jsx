"use client";

export default function TimeRangeSelectors({
  showTimeControls = true,
  startTime,
  endTime,
  onChangeStartTime,
  onChangeEndTime,
  timeSlotOptions,
  disabled = false,
}) {
  if (!showTimeControls) {
    return (
      <>
        <div className="w-[120px] flex-none" aria-hidden="true">
          <div className="block w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-300" />
        </div>
        <div className="w-[120px] flex-none" aria-hidden="true">
          <div className="block w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-300" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="w-[120px] flex-none">
        <label className="block">
          <span className="sr-only">시작 시간 선택</span>
          <select
            aria-label="시작 시간 선택"
            value={startTime}
            disabled={disabled}
            onChange={(e) => onChangeStartTime?.(e.target.value)}
            className={[
              "block w-full appearance-none border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-900",
              "focus:border-orange-500 focus:outline-none focus:ring-0",
              "disabled:cursor-not-allowed disabled:text-slate-400",
            ].join(" ")}
          >
            {timeSlotOptions.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="w-[120px] flex-none">
        <label className="block">
          <span className="sr-only">종료 시간 선택</span>
          <select
            aria-label="종료 시간 선택"
            value={endTime}
            disabled={disabled}
            onChange={(e) => onChangeEndTime?.(e.target.value)}
            className={[
              "block w-full appearance-none border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-900",
              "focus:border-orange-500 focus:outline-none focus:ring-0 focus:ring-0",
              "disabled:cursor-not-allowed disabled:text-slate-400",
            ].join(" ")}
          >
            <option value="">종료 없음</option>
            {timeSlotOptions.map((slot) => (
              <option key={`end_${slot}`} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

