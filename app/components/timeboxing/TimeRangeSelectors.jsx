"use client";

function parseHHMM(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  let h = Number.parseInt(m[1], 10);
  let min = Number.parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  h = Math.min(23, Math.max(0, h));
  min = Math.min(59, Math.max(0, min));
  return { h, m: min };
}

function toHHMM(h, m) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toTimeInputValue(s) {
  const p = parseHHMM(s);
  if (!p) return "";
  return toHHMM(p.h, p.m);
}

function secondsFromMidnight(h, m) {
  return h * 3600 + m * 60;
}

/** 종료 시각이 같은 날만 보면 시작보다 이르면 다음날까지 이어진 구간 */
function endsNextDay(startTime, endTime) {
  const a = parseHHMM(startTime);
  const b = parseHHMM(endTime);
  if (!a || !b) return false;
  return secondsFromMidnight(b.h, b.m) < secondsFromMidnight(a.h, a.m);
}

const inputClass = [
  "block w-full min-w-0 border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-900",
  "[color-scheme:light]",
  "focus:border-orange-500 focus:outline-none focus:ring-0",
  "disabled:cursor-not-allowed disabled:text-slate-400",
].join(" ");

/** step: 초 단위. 60 = 1분 단위로 시·분을 고르는 네이티브 시간 선택 UI */
const STEP_SECONDS = 60;

export default function TimeRangeSelectors({
  showTimeControls = true,
  startTime,
  endTime,
  onChangeStartTime,
  onChangeEndTime,
  disabled = false,
}) {
  const startValue = toTimeInputValue(startTime) || "09:00";
  const endValue = toTimeInputValue(endTime);
  const showNextDayHint = Boolean(endValue) && endsNextDay(startValue, endValue);

  if (!showTimeControls) {
    return (
      <>
        <div className="w-[120px] flex-none" aria-hidden="true">
          <div className="block h-10 w-full border-b border-slate-200" />
        </div>
        <div className="w-[120px] flex-none" aria-hidden="true">
          <div className="block h-10 w-full border-b border-slate-200" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[120px] flex-none">
          <label className="block">
            <span className="sr-only">시작 시간 선택</span>
            <input
              type="time"
              step={STEP_SECONDS}
              value={startValue}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                onChangeStartTime?.(v && v.length >= 4 ? v.slice(0, 5) : "09:00");
              }}
              className={inputClass}
            />
          </label>
        </div>
        <div className="w-[120px] flex-none">
          <label className="block">
            <span className="sr-only">종료 시간 선택</span>
            <input
              type="time"
              step={STEP_SECONDS}
              value={endValue}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                onChangeEndTime?.(v && v.length >= 4 ? v.slice(0, 5) : "");
              }}
              className={inputClass}
            />
          </label>
        </div>
      </div>
      {showNextDayHint ? (
        <p className="w-full max-w-[min(100%,20rem)] pt-0.5 text-[11px] leading-snug text-slate-400">
          종료가 시작보다 이르면 다음날까지로 계산됩니다 (예: 수면 23:00~08:00)
        </p>
      ) : null}
    </>
  );
}
