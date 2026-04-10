"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function secondsFromMidnightParsed(p) {
  if (!p) return 0;
  return secondsFromMidnight(p.h, p.m);
}

/** 종료 시각이 같은 날만 보면 시작보다 이르면 다음날까지 이어진 구간 */
function endsNextDay(startTime, endTime) {
  const a = parseHHMM(startTime);
  const b = parseHHMM(endTime);
  if (!a || !b) return false;
  return secondsFromMidnight(b.h, b.m) < secondsFromMidnight(a.h, a.m);
}

const SECONDS_PER_DAY = 86400;

/** select에 표시할 구간(분) — 고정 목록 */
const ALLOWED_DURATIONS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 120, 180, 240];
const DEFAULT_DURATION_MIN = 30;
const MIN_DURATION_MIN = 1;
const MAX_DURATION_MIN = 24 * 60;

const inputClass = [
  "block h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200/90 bg-[#FAFAFA] px-2.5 py-0 text-[15px] leading-[2.5rem] text-slate-900",
  "[&::-webkit-date-and-time-value]:py-0 [&::-webkit-date-and-time-value]:leading-[2.5rem]",
  "[&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:leading-[2.5rem]",
  "[color-scheme:light]",
  "focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20",
  "disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-400",
].join(" ");

/** 구간(분) 셀렉트 — time input과 동일 톤 */
const selectClass = [
  "block h-10 w-full min-w-[4.25rem] max-w-[5.25rem] shrink-0 cursor-pointer appearance-none",
  "rounded-lg border border-slate-200/90 bg-[#FAFAFA] py-0 pl-2.5 pr-7 text-left text-[14px] text-slate-900",
  "bg-[length:0.75rem] bg-[position:right_0.375rem_center] bg-no-repeat",
  "[background-image:url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%2394a3b8%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]",
  "[color-scheme:light]",
  "focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20",
  "disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-400",
].join(" ");

/** step: 초 단위. 300 = 5분 단위 */
const STEP_SECONDS = 300;

/** 자정 기준 초를 step에 맞게 반올림한 뒤 HH:MM */
function nowHHMMSnappedToStep(stepSeconds) {
  const d = new Date();
  const totalSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  const rounded = Math.round(totalSec / stepSeconds) * stepSeconds;
  const wrapped = ((rounded % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const h = Math.floor(wrapped / 3600);
  const m = Math.floor((wrapped % 3600) / 60);
  return toHHMM(h, m);
}

/** 시작·종료(HH:MM)로 구간 길이(분). 자정 넘김이면 익일까지 합산 */
function durationMinutesFromStartEnd(startTime, endTime) {
  const st = parseHHMM(startTime) || { h: 9, m: 0 };
  const et = parseHHMM(endTime);
  if (!et) return null;
  const a = secondsFromMidnightParsed(st);
  const b = secondsFromMidnightParsed(et);
  let diffSec = b - a;
  if (diffSec <= 0) diffSec += SECONDS_PER_DAY;
  return Math.round(diffSec / 60);
}

function clampDurationMinutes(minutes) {
  const rounded = Math.round(minutes);
  return Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, rounded));
}

/** 시작 시각 + 구간(분) → 종료 HH:MM (자정 넘김은 익일 시각으로 표현) */
function endTimeFromStartAndDurationMinutes(startTime, durationMin) {
  const st = parseHHMM(startTime) || { h: 9, m: 0 };
  const a = secondsFromMidnightParsed(st);
  const d = clampDurationMinutes(durationMin);
  const addSec = d * 60;
  const endSec = (a + addSec) % SECONDS_PER_DAY;
  const h = Math.floor(endSec / 3600);
  const min = Math.floor((endSec % 3600) / 60);
  return toHHMM(h, min);
}

function formatDurationOptionLabel(totalMin) {
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

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

  const [durationMin, setDurationMin] = useState(() => {
    const d = durationMinutesFromStartEnd(startTime || "09:00", endTime);
    return d != null ? clampDurationMinutes(d) : DEFAULT_DURATION_MIN;
  });

  const durationMinRef = useRef(durationMin);
  durationMinRef.current = durationMin;

  const skipStartEffectRef = useRef(true);

  const applyStartTimeNow = useCallback(() => {
    if (disabled) return;
    const next = nowHHMMSnappedToStep(STEP_SECONDS);
    onChangeStartTime?.(next);
  }, [disabled, onChangeStartTime]);

  /** 부모에서 start/end가 바뀌면 구간(분) 동기화 */
  useEffect(() => {
    const st = startTime || "09:00";
    const et = typeof endTime === "string" ? endTime.trim() : "";
    if (!et) return;
    const d = durationMinutesFromStartEnd(st, et);
    if (d == null) return;
    const clamped = clampDurationMinutes(d);
    setDurationMin(clamped);
    const snapped = endTimeFromStartAndDurationMinutes(st, clamped);
    if (snapped !== toTimeInputValue(et)) {
      onChangeEndTime?.(snapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start/end만 동기화
  }, [startTime, endTime]);

  /** 시작 시각만 바뀌면 같은 구간 길이로 종료 시각 재계산 */
  useEffect(() => {
    if (skipStartEffectRef.current) {
      skipStartEffectRef.current = false;
      return;
    }
    const nextEnd = endTimeFromStartAndDurationMinutes(startTime || "09:00", durationMinRef.current);
    onChangeEndTime?.(nextEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시작 변경 시에만 종료 재계산
  }, [startTime]);

  const applyDuration = (nextDur) => {
    const d = clampDurationMinutes(nextDur);
    setDurationMin(d);
    const nextEnd = endTimeFromStartAndDurationMinutes(startTime || "09:00", d);
    onChangeEndTime?.(nextEnd);
  };

  const onSelectDuration = (e) => {
    const raw = e.target.value;
    if (raw === "") return;
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    applyDuration(v);
  };

  if (!showTimeControls) {
    return (
      <div
        className="flex min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-x-auto pb-0.5 sm:gap-2.5"
        aria-hidden="true"
      >
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-10 w-9 shrink-0 rounded-lg border border-slate-200/90 bg-slate-100/80" />
          <div className="w-[104px] shrink-0">
            <div className="block h-10 w-full rounded-lg border border-slate-200/90 bg-slate-100/80" />
          </div>
        </div>
        <div className="w-[104px] shrink-0">
          <div className="block h-10 w-full rounded-lg border border-slate-200/90 bg-slate-100/80" />
        </div>
        <div className="h-10 min-w-[4.25rem] shrink-0 rounded-lg border border-slate-200/90 bg-slate-100/80" />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-x-auto pb-0.5 sm:gap-2.5">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={applyStartTimeNow}
            title="시작 시간을 지금 시각으로 맞추기"
            aria-label="시작 시간을 현재 시각으로 맞추기"
            className={[
              "inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-[#FAFAFA] text-slate-500",
              "hover:border-orange-300/80 hover:bg-orange-50/90 hover:text-orange-600",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-200/90 disabled:hover:bg-[#FAFAFA] disabled:hover:text-slate-500",
            ].join(" ")}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.85"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="7.25" />
              <path d="M12 8.15V12l2.9 1.93" />
              <path d="M17.2 6.8c.35.28.68.58 1 1" stroke="#ea580c" />
            </svg>
          </button>
          <div className="w-[104px] shrink-0">
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
        </div>
        <div className="w-[104px] shrink-0">
          <label className="block">
            <span className="sr-only">종료 시간 선택</span>
            <input
              type="time"
              step={STEP_SECONDS}
              value={endValue}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                const next = v && v.length >= 4 ? v.slice(0, 5) : "";
                onChangeEndTime?.(next);
              }}
              className={inputClass}
            />
          </label>
        </div>
        <div className="shrink-0">
          <label className="sr-only" htmlFor="time-range-duration-select">
            시작부터 종료까지 구간 길이
          </label>
          <select
            id="time-range-duration-select"
            className={selectClass}
            disabled={disabled}
            value={ALLOWED_DURATIONS.includes(durationMin) ? String(durationMin) : ""}
            onChange={onSelectDuration}
          >
            {!ALLOWED_DURATIONS.includes(durationMin) ? (
              <option value="">{durationMin}분</option>
            ) : null}
            {ALLOWED_DURATIONS.map((m) => (
              <option key={m} value={m}>
                {formatDurationOptionLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showNextDayHint ? (
        <p className="mx-auto w-full max-w-[min(100%,20rem)] pt-0.5 text-center text-[11px] leading-snug text-slate-400">
          종료가 시작보다 이르면 다음날까지로 계산됩니다 (예: 수면 23:00~08:00)
        </p>
      ) : null}
    </>
  );
}
