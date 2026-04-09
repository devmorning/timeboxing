"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TextInput from "../components/textinput/TextInput.jsx";
import { InlineCalendarMonth } from "../components/timeboxing/InlineCalendarMonth.jsx";
import { buildMonthKeys, getRangeYmdBounds } from "../components/timeboxing/utils/calendarMonth.js";
import { addDaysToYmd, getSundayOfWeekForYmd } from "../components/timeboxing/utils/dateYmd.js";
import { getDayPlanRepository } from "../components/timeboxing/storage/dayPlan.repository.js";
import AnimatedDayNumber from "./components/timeboxing/AnimatedDayNumber.jsx";
import ComposerContentInput from "./components/timeboxing/ComposerContentInput.jsx";
import ExecutionTrendBarChart, {
  ExecutionTrendDayList,
} from "./components/timeboxing/ExecutionTrendBarChart.jsx";
import TimeRangeSelectors from "./components/timeboxing/TimeRangeSelectors.jsx";
import {
  collectYmdsNeededForMonthTrend,
  collectYmdsNeededForWeekTrend,
  listWeekDaysYmd,
  listYmDaysYmd,
  sumExecutedSecondsMatchingContentOnCalendarDay,
} from "../components/timeboxing/utils/executionByContentFilter.js";
import {
  clearStoredAccessToken,
  getApiAuthUrl,
  setStoredAccessToken,
} from "../components/timeboxing/storage/dayPlan.apiRepository.js";
import {
  createEmptyDayPlan,
  hasDayPlanContent,
  normalizeDayPlan,
} from "../components/timeboxing/storage/dayPlan.schema.js";
import {
  ADJACENT_DAY_SWIPE_PARALLAX_Y_PER_PX,
  getChapterBlurParallaxTranslateY,
  getMainChapterIdxFromScrollRoot,
  getScrollContentOffsetTop,
} from "../components/timeboxing/utils/chapterScrollGeometry.js";

const SECONDS_PER_DAY = 86400;
const THIRTY_MIN_SECONDS = 1800;
/** 브레인 덤프 textarea — 빈 상태 기본 1줄 높이(px, text-base·leading-relaxed 기준) */
const BRAIN_DUMP_TEXTAREA_MIN_HEIGHT_PX = 28;
/** 일정 추가 모달 브레인 덤프 textarea 최대 줄 수 */
const COMPOSER_BRAIN_DUMP_MAX_LINES = 7;
/** false: 좌우 인접 날 캐러셀·프리뷰 열 비활성(단일 열만, peek API 호출 생략) */
const ENABLE_DAY_SWIPE_ADJACENT_PEEK = false;

function getTextareaMaxHeightByLines(el, maxLines) {
  if (!el) return Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(maxLines) || maxLines <= 0) return Number.MAX_SAFE_INTEGER;
  const computed = window.getComputedStyle(el);
  const lineHeightPx = Number.parseFloat(computed.lineHeight);
  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.ceil(lineHeightPx * maxLines);
}
/** 인라인 캘린더 가상 스크롤: 월 하나의 대략 높이(px) */
const CALENDAR_VIRTUAL_MONTH_HEIGHT_PX = 316;
const CALENDAR_VIRTUAL_OVERSCAN = 2;

/** 데이 플랜·모달 본문 카드: 캔버스(stone-200) 대비 밝은 스톤 면 — 가장 중요한 일·브레인 덤프·일정 등 공통 */
const UI_SURFACE_P4 =
  "w-full overflow-hidden rounded-xl bg-stone-50/96 p-4 shadow-[0_1px_0_rgba(15,23,42,0.03),0_24px_56px_-28px_rgba(15,23,42,0.1)] backdrop-blur-md";
const UI_SURFACE_PX4 =
  "w-full overflow-hidden rounded-xl bg-stone-50/96 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03),0_24px_56px_-28px_rgba(15,23,42,0.1)] backdrop-blur-md";
/** 메인 원-캔버스: 2026 웜 스톤 소프트 글래스 */
const UI_CANVAS =
  "w-full max-h-[calc(100dvh-8.25rem-env(safe-area-inset-bottom))] overflow-hidden rounded-3xl border border-white/55 bg-white/55 shadow-[0_18px_70px_-34px_rgba(15,23,42,0.22)] backdrop-blur-2xl";
/** 좌우 날짜 프리뷰: 메인과 동일 바깥 테두리·섀도(세로는 본문 높이만큼, overflow-visible로 챕터 잘림 방지) */
const UI_CANVAS_PEEK =
  "w-full max-h-none overflow-visible rounded-3xl border border-white/55 bg-white/55 shadow-[0_18px_70px_-34px_rgba(15,23,42,0.22)] backdrop-blur-2xl";
const UI_CANVAS_INSET =
  "w-full overflow-hidden rounded-2xl border border-white/60 bg-stone-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";
/** 가장 중요한 일 우선순위 번호(1–3): 얕은 그라데이션 웰 */
const UI_PIN_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100/95 to-amber-50/70 text-orange-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]";
const UI_AI_BUTTON =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-orange-200/60 bg-gradient-to-r from-orange-50/95 to-amber-50/85 px-3 text-[12px] font-semibold text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-14px_rgba(251,146,60,0.55)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/25 active:opacity-70";

function secondsToHHMM(totalSeconds) {
  const s = ((Math.floor(totalSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function resolveEndTimeOrDefault(startTime, endTime) {
  const et = (endTime || "").trim();
  if (et) return et;
  const stSec = parseHHMMToSecondsFromMidnight(startTime);
  if (stSec == null) return "";
  return secondsToHHMM(stSec + THIRTY_MIN_SECONDS);
}

function parseHHMMToSecondsFromMidnight(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 3600 + min * 60;
}

/**
 * 같은 날만 보면 종료 ≤ 시작인 경우(예: 23:00~08:00) 다음날까지 이어진 구간으로 본다.
 * 시각이 같으면 0분 구간이므로 자정 넘김으로 보지 않는다.
 */
function spansMidnight(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return false;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return false;
  return b < a;
}

/** 종료 시간이 있을 때만 구간 길이(초). 자정 넘김이면 (24h − 시작) + 종료 */
function getPlannedDurationSeconds(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return null;
  if (b < a) {
    return SECONDS_PER_DAY - a + b;
  }
  return Math.max(0, b - a);
}

/** 목록·리포트용: 자정 넘김이면 익일 종료임을 표시 */
function formatItemTimeRange(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return st;
  if (spansMidnight(st, et)) {
    return `${st} – 익일 ${et}`;
  }
  return `${st} – ${et}`;
}

/**
 * 이 날짜의 00:00~24:00 한 줄에서만 덮는 구간 [start, end) (초).
 * 자정 넘김 일정은 그날 자정까지만 포함(익일 새벽은 해당 날짜 플랜에서 다룸).
 */
function getPlannedIntervalOnCalendarDay(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return null;
  if (spansMidnight(st, et)) {
    if (a >= SECONDS_PER_DAY) return null;
    return { start: a, end: SECONDS_PER_DAY };
  }
  if (b <= a) return null;
  return { start: a, end: b };
}

/** 해당 캘린더일에만 속하는 계획 초(자정 넘김이면 그날 자정까지만). */
function getPlannedSecondsOnCalendarDay(startTime, endTime) {
  const iv = getPlannedIntervalOnCalendarDay(startTime, endTime);
  if (!iv || iv.end <= iv.start) return null;
  return iv.end - iv.start;
}

function mergeIntervalsSeconds(intervals) {
  const sorted = intervals
      .filter((iv) => iv.end > iv.start)
      .sort((x, y) => x.start - y.start);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (!last || iv.start > last.end) {
      out.push({ start: iv.start, end: iv.end });
    } else {
      last.end = Math.max(last.end, iv.end);
    }
  }
  return out;
}

function unionIntervalsLengthSeconds(intervals) {
  return mergeIntervalsSeconds(intervals).reduce((s, iv) => s + (iv.end - iv.start), 0);
}

/**
 * 전날 시작한 자정 넘김 일정이 '다음날' 캘린더일에 덮는 새벽 구간 [0, end) (초).
 * (getPlannedIntervalOnCalendarDay는 시작일 쪽만 자정까지 자르므로, 익일 아침은 여기로 합친다.)
 */
function getOvernightMorningIntervalOnFollowingDay(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  if (!spansMidnight(st, et)) return null;
  const b = parseHHMMToSecondsFromMidnight(et);
  if (b == null) return null;
  return { start: 0, end: b };
}

/** 인접 날 읽기 전용 패널: 전날 이어짐 + 당일 일정 병합 (displayItemsMerged 와 동일 정렬) */
function mergeAdjacentDisplayRows(carryFromPrevDay, dayItemsSorted) {
  const from = carryFromPrevDay.map((x) => ({ ...x, _isCarryover: true }));
  const fromDay = dayItemsSorted.map((it) => ({ ...it, _isCarryover: false }));
  const all = [...from, ...fromDay];
  all.sort((a, b) => {
    const sa = a._isCarryover
      ? 0
      : (parseHHMMToSecondsFromMidnight(a.startTime || a.time || "09:00") ?? 0);
    const sb = b._isCarryover
      ? 0
      : (parseHHMMToSecondsFromMidnight(b.startTime || b.time || "09:00") ?? 0);
    if (sa !== sb) return sa - sb;
    if (a._isCarryover && b._isCarryover) {
      const ea = parseHHMMToSecondsFromMidnight(a.endTime || "") ?? 0;
      const eb = parseHHMMToSecondsFromMidnight(b.endTime || "") ?? 0;
      return ea - eb;
    }
    if (a._isCarryover !== b._isCarryover) return a._isCarryover ? -1 : 1;
    return 0;
  });
  return all;
}

function formatExecutedSecondsAsMmSs(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function buildCarryOverDisplayItem(raw, prevYmd) {
  const st = raw.startTime || raw.time || "09:00";
  const et = raw.endTime || "";
  if (!et || !spansMidnight(st, et)) return null;
  const morningSec = parseHHMMToSecondsFromMidnight(et);
  if (morningSec == null) return null;
  const totalPlanned = getPlannedDurationSeconds(st, et);
  const executed = Math.max(0, Math.floor(raw.executedSeconds ?? 0));
  const executedMorning =
      totalPlanned != null && totalPlanned > 0 ? Math.round((executed * morningSec) / totalPlanned) : 0;
  return {
    ...raw,
    _isCarryover: true,
    _carryFromYmd: prevYmd,
    _displayStartSec: 0,
    _executedMorningSeconds: executedMorning,
  };
}

function formatCarryOverSegmentForDay(endTime) {
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return "00:00 –";
  return `00:00 – ${et}`;
}

const DAY_TIMELINE_PALETTE = [
  "bg-orange-500/85",
  "bg-sky-500/85",
  "bg-emerald-500/85",
  "bg-violet-500/85",
  "bg-amber-500/85",
  "bg-rose-500/85",
  "bg-cyan-500/85",
  "bg-indigo-500/85",
];

function formatSecondsAsDurationKo(sec) {
  const n = Math.max(0, Math.floor(sec));
  if (n <= 0) return "0분";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function isDayPlanItemUuid(id) {
  return (
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

/** 닫힘 완료 타이머 — modalBackdropClass / modalPanelClass 의 closing `duration-[480ms]` 와 동일 (열림은 400ms) */
const MODAL_CLOSE_MS = 480;
/** 날짜 스와이프 취소·스냅 시 짧은 전환 */
const DAY_SWIPE_TRANSITION_MS = 260;
/** 캐러셀 트랙이 한 열 폭만큼 미끄러진 뒤 날짜가 바뀌는 시간 */
const DAY_SWIPE_CAROUSEL_TRANSITION_MS = 380;
/** 메인 날짜 블록 상단과 동일 — 리퀴드 글래스 캔버스(방사형 레이어) */
const MAIN_DATE_CANVAS_BACKGROUND = [
  "radial-gradient(ellipse 90% 65% at 12% 0%, rgba(255,255,255,0.72), transparent 56%)",
  "radial-gradient(ellipse 70% 55% at 92% 18%, rgba(251,146,60,0.12), transparent 54%)",
  "radial-gradient(ellipse 70% 55% at 10% 92%, rgba(120,113,108,0.10), transparent 54%)",
].join(", ");

/**
 * 좌우 날짜 스와이프: 3열 트랙(이전·현재·다음) + translate로 캐러셀 느낌.
 * 비활성 시 기존 단일 열만 렌더(접근성 감소 모션 등).
 */
function DaySwipeCarouselTrack({
  enabled,
  trackStyle,
  surfaceClassName,
  surfaceStyle,
  prevSlot,
  nextSlot,
  children,
  /** 가로 스와이프 중 세로 팬이 트랙에 먹지 않도록 */
  trackTouchLock = false,
}) {
  const gridCell = "col-start-1 row-start-1";
  if (!enabled) {
    return (
      <div className={[gridCell, surfaceClassName].join(" ")} style={surfaceStyle}>
        {children}
      </div>
    );
  }
  return (
    <div className={[gridCell, "w-full min-w-0 overflow-hidden"].join(" ")}>
      <div
          className={[
            "flex min-h-0 w-[300%] min-w-0",
            trackTouchLock ? "touch-none" : "touch-pan-y",
          ].join(" ")}
          style={trackStyle}
      >
        {/* 빈 날 오버레이(z-39)보다 위에 그려져 전·다음날 프리뷰(날짜 카드)가 가려지지 않게 함 */}
        <aside
            className="relative z-[41] box-border min-h-0 w-[33.333333%] min-w-0 shrink-0 px-1"
            aria-hidden
        >
          {prevSlot}
        </aside>
        <div className="box-border min-h-0 w-[33.333333%] min-w-0 shrink-0">
          <div className={surfaceClassName} style={surfaceStyle}>
            {children}
          </div>
        </div>
        <aside
            className="relative z-[41] box-border min-h-0 w-[33.333333%] min-w-0 shrink-0 px-1"
            aria-hidden
        >
          {nextSlot}
        </aside>
      </div>
    </div>
  );
}

/** 스크롤 중 등 `cancelable === false` 인 touch 이벤트에서 preventDefault 시 크롬 Intervention 경고 방지 */
function preventDefaultIfCancelable(e) {
  if (e && e.cancelable) {
    e.preventDefault();
  }
}

/** 인라인 캘린더 패널과 유사한 이징으로 모달 열림·닫힘 */
function useModalOpenAnimation(isOpen, onFullyClosed) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const onClosedRef = useRef(onFullyClosed);
  onClosedRef.current = onFullyClosed;

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      setClosing(false);
      return;
    }
    setClosing(false);
    setEntered(false);
    /** 한 프레임만 쓰면 첫 페인트와 트랜지션 시작이 맞물려 깜빡일 수 있어 이중 rAF 유지 */
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setClosing(false);
      setEntered(false);
      onClosedRef.current();
    }, MODAL_CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing]);

  const requestClose = useCallback(() => {
    if (!isOpen) return;
    setClosing(true);
  }, [isOpen]);

  const showOverlay = entered && !closing;

  return { requestClose, showOverlay, closing };
}

function modalBackdropClass(showOverlay, closing) {
  const transition = closing
      ? "transition-[opacity] duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      : "transition-[opacity] duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)]";
  return [
    "fixed inset-0 z-[60] isolate bg-black/45 backdrop-blur-[2px]",
    "will-change-[opacity]",
    transition,
    showOverlay ? "opacity-100" : "opacity-0",
  ].join(" ");
}

/**
 * 패널은 opacity로 흐리게 지우지 않고 clip-path로 아래에서 말아 올려,
 * 닫힐 때 상단이 비며 뒤 컨텐츠가 비쳐 보이는 현상을 막음 (겹 덮개 → 말려 들어감).
 */
/** @param {{ surface?: 'white' | 'app' }} [options] — `app`: body와 동일 stone 캔버스(카드 대비) */
function modalPanelClass(showOverlay, closing, options = {}) {
  const surface = options.surface === "app" ? "app" : "white";
  const bgClass = surface === "app" ? "bg-stone-200" : "bg-white";
  const transition = closing
      ? "transition-[clip-path] duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      : "transition-[clip-path] duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)]";
  const clipClosed = "clip-path-[inset(0_0_100%_0)]";
  const clipOpen = "clip-path-[inset(0_0_0_0)]";
  const clip = showOverlay ? clipOpen : clipClosed;
  return [
    "flex h-full w-full flex-col overflow-hidden",
    bgClass,
    "will-change-[clip-path]",
    transition,
    clip,
  ].join(" ");
}

/**
 * 아이폰 바텀 시트처럼 패널이 화면 아래에서 translateY 로 올라오고, 닫힐 때 다시 아래로 내려감.
 * @param {{ surface?: 'white' | 'app' }} [options]
 */
function modalBottomSheetPanelClass(showOverlay, closing, options = {}) {
  const surface = options.surface === "app" ? "app" : "white";
  const intensity = options.intensity === "strong" ? "strong" : "normal";
  const bgClass = surface === "app" ? "bg-stone-200" : "bg-white";
  const transition = closing
      ? "transition-[transform,opacity,filter] duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      : intensity === "strong"
        ? "transition-[transform,opacity,filter] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        : "transition-[transform,opacity,filter] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]";
  const transformY =
      showOverlay
        ? "translate-y-0 scale-100 opacity-100 blur-0"
        : intensity === "strong"
          ? "translate-y-[105%] scale-[0.955] opacity-90 blur-[2px]"
          : "translate-y-full scale-[0.985] opacity-95 blur-[1px]";
  return [
    "flex w-full max-w-lg flex-col overflow-hidden",
    "mx-auto max-h-[min(95vh,980px)] min-h-0",
    "rounded-t-[1.25rem] shadow-[0_-8px_40px_rgba(15,23,42,0.14)]",
    "pb-[max(0px,env(safe-area-inset-bottom))]",
    bgClass,
    "will-change-[transform,opacity,filter]",
    transition,
    transformY,
  ].join(" ");
}

/** 드래그 시 일정 거리 이후 저항(고무줄) — 인접 날 미리보기와 동일 좌표계 */
function rubberDaySwipeDx(dx, maxAbs) {
  const a = Math.abs(dx);
  if (a <= maxAbs) return dx;
  const sign = dx > 0 ? 1 : -1;
  const excess = a - maxAbs;
  return sign * (maxAbs + Math.min(excess * 0.33, maxAbs * 0.55));
}

/**
 * 입력이 전혀 없는 날짜 — 잠금화면 스타일로 날짜만 강조 (2026 스톤·소프트 글래스 톤)
 */
function EmptyDayLockScreen({
  selectedDate,
  onDismiss,
  onStartPlan,
  visible,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  swipePullX = 0,
  swipeTransition = false,
  prefersReducedMotion = false,
  /** 메인 캐러셀과 동일 1:1 이동 */
  carouselSwipeEnabled = false,
}) {
  const parts = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    return {
      dayNum: d,
      weekday: dt.toLocaleDateString("ko-KR", { weekday: "long" }),
      monthLine: dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }),
      year: y,
    };
  }, [selectedDate]);

  if (!visible || !parts) return null;

  return (
    <div
        className={[
          "fixed inset-0 z-[39] flex cursor-default flex-col items-center justify-center overflow-hidden px-6",
          "pb-[max(5.5rem,calc(4.25rem+env(safe-area-inset-bottom)))] pt-[max(3.5rem,env(safe-area-inset-top)+2.25rem)]",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="선택한 날짜 — 아직 기록 없음"
        data-empty-day-lock
        onClick={(event) => {
          event.preventDefault();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        style={{
          transform: !prefersReducedMotion
            ? `translate3d(${carouselSwipeEnabled ? swipePullX : swipePullX * 0.14}px, 0, 0)`
            : undefined,
          transition: !prefersReducedMotion && swipeTransition
            ? carouselSwipeEnabled
              ? `transform ${DAY_SWIPE_CAROUSEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "transform 0.26s cubic-bezier(0.2,0.8,0.2,1)"
            : "none",
          willChange:
            !prefersReducedMotion && (swipePullX !== 0 || swipeTransition)
              ? "transform"
              : "auto",
          background: [
            "linear-gradient(165deg, #e7e5e4 0%, #e7e5e4 30%, #ebeae8 100%)",
            "radial-gradient(ellipse 92% 62% at 4% 98%, rgba(251,146,60,0.085), transparent 52%)",
            "radial-gradient(ellipse 82% 56% at 98% 46%, rgba(120,113,108,0.07), transparent 48%)",
            "radial-gradient(ellipse 90% 60% at 50% 118%, rgba(255,255,255,0.34), transparent 56%)",
          ].join(", "),
        }}
    >
      <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.4]"
          style={{
            backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 42%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0%, transparent 38%)",
          }}
      />
      <div className="relative w-full max-w-md overflow-hidden px-2">
        <div
            className="relative flex w-full flex-col items-center text-center"
            style={
              !prefersReducedMotion
                ? {
                    transform: `translate3d(${
                      carouselSwipeEnabled ? swipePullX : swipePullX * 0.18
                    }px, 0, 0)`,
                    transition: swipeTransition
                      ? carouselSwipeEnabled
                        ? `transform ${DAY_SWIPE_CAROUSEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                        : "transform 0.26s cubic-bezier(0.2,0.8,0.2,1)"
                      : "none",
                  }
                : undefined
            }
        >
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-stone-400">
            {parts.weekday}
          </p>
          <p className="mt-1 leading-[0.92]">
            <AnimatedDayNumber
                value={parts.dayNum}
                dateKey={selectedDate}
                prefersReducedMotion={prefersReducedMotion}
                className="font-sans text-[clamp(4.25rem,20vw,6.75rem)] font-extralight leading-[0.92] tracking-[-0.085em] text-stone-800"
            />
          </p>
          <p className="mt-5 text-xl font-medium tracking-tight text-stone-700">{parts.monthLine}</p>
          <p className="mt-1 text-[13px] font-medium text-stone-400">{parts.year}년</p>
          <p className="mt-14 max-w-[17rem] text-[13px] leading-relaxed text-stone-500">
            이 날에는 아직 적은 내용이 없어요.
            <br />
            화면을 누르거나 아래를 눌러 플랜을 시작해 보세요.
          </p>
          <button
              type="button"
              className={[
                "mt-10 rounded-full border border-white/50 bg-white/30 px-11 py-3.5 text-sm font-semibold tracking-tight text-stone-800",
                "shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onStartPlan === "function") {
                  onStartPlan();
                  return;
                }
                onDismiss();
              }}
          >
            플랜 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 일정 목록이 비었을 때 — 메인(추가 유도) / 인접 날(읽기 전용) 공통 시각 블록
 * @param {{ variant?: "interactive" | "readonly" }} props
 */
function EmptyScheduleListBlock({ variant = "interactive" }) {
  const readonly = variant === "readonly";
  if (!readonly) {
    return (
      <div role="status" aria-label="일정 추가 안내">
        <div className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/55 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl">
          <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-100/80 text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
          >
            <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M4 10h16M9 3v4M15 3v4" />
              <path d="M12 14v4M10 16h4" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug tracking-tight text-stone-800">
              아직 추가된 일정이 없어요
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-stone-600">
              하단 탭의 <span className="font-semibold text-orange-700/90">「일정」</span>을 눌러 바로 추가해 보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
        className="border-t border-stone-200/70 pt-4"
        role="status"
        aria-label={readonly ? "이 날짜 일정 없음 안내" : "일정 추가 안내"}
    >
      <div className="rounded-xl border border-dashed border-orange-200/55 bg-gradient-to-br from-orange-50/45 via-stone-50/70 to-stone-100/25 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100/85 text-orange-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]"
              aria-hidden
          >
            <svg
                viewBox="0 0 24 24"
                className="h-[22px] w-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 11h16" />
              <path d="M11.5 14.5h.01M15.5 14.5h.01" strokeWidth="2" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-base font-semibold leading-snug tracking-tight text-stone-800">
              {readonly ? "이 날짜에는 일정이 없어요" : "타임블록으로 하루를 채워 보세요"}
            </p>
            <p className="type-body-sm mt-1 text-stone-600">
              {readonly
                ? "좌우로 스와이프하면 다른 날과 비교할 수 있어요."
                : "하단 탭의 「일정」을 눌러 시작·종료 시간과 할 일을 적으면 목록이 쌓여요."}
            </p>
            {!readonly ? (
                <ul className="type-caption mt-3 space-y-1.5 text-left text-stone-500">
                  <li className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums text-orange-600">1</span>
                    <span>
                      하단 탭의 <span className="font-medium text-stone-600">「일정」</span>을 눌러 모달을 열어요
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums text-orange-600">2</span>
                    <span>시간대와 내용을 입력한 뒤 + 로 추가해요</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums text-orange-600">3</span>
                    <span>자주 쓰는 문장은 반복 템플릿으로 불러올 수 있어요</span>
                  </li>
                </ul>
            ) : (
                <p className="type-caption mt-3 text-stone-400">
                  가운데 날짜에서 일정을 등록하면 여기에도 반영돼요.
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getPeekDateDisplayParts(ymd) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { day: "", weekday: "", ym: "", label: "" };
  }
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = String(d);
  const weekday = dt.toLocaleDateString("ko-KR", { weekday: "long" });
  const ym = dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  const label = dt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return { day, weekday, ym, label };
}

/** 인접 날 캐러셀 — 메인과 동일한 리퀴드 글래스 캔버스(방사형) + 날짜 카드 셸, 읽기 전용 */
function AdjacentPeekDateCard({ ymd }) {
  const parts = useMemo(() => getPeekDateDisplayParts(ymd), [ymd]);
  if (!parts.day) return null;
  return (
      <div className="relative z-[41] mb-3.5">
        {/* 메인 날짜와 동일: 큰 캔버스 위에 한 겹 더 얹는 리퀴드 글래스(방사형 레이어) */}
        <div
            className="rounded-[1.35rem] px-2 py-2 sm:px-3"
            style={{ background: MAIN_DATE_CANVAS_BACKGROUND }}
        >
          <div
              className={[
                "group relative overflow-hidden rounded-3xl border border-white/65 bg-white/55",
                "shadow-[0_12px_30px_-18px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-xl",
                "transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              ].join(" ")}
              aria-label={`날짜 미리보기 — ${parts.label}`}
          >
            <div className="relative z-10 flex w-full items-start gap-1.5 px-4 py-2">
              <div className="relative min-h-0 min-w-0 flex-1">
                <p className="text-[9px] font-semibold tracking-[0.18em] text-orange-700/80">
                  {parts.weekday.toUpperCase()}
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p
                      className={[
                        "font-sans text-[1.875rem] font-light leading-none tracking-[-0.07em] text-stone-900 tabular-nums",
                      ].join(" ")}
                  >
                    {parts.day}
                  </p>
                  <p className="text-[11px] font-semibold tracking-tight text-stone-600">
                    {parts.ym}
                  </p>
                </div>
              </div>
              {/* 메인 상단 날짜 카드의 펼치기 버튼과 동일 셸(프리뷰는 스와이프 가로채기 방지로 비활성) */}
              <div
                  className={[
                    "pointer-events-none mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/55 bg-white/40 text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm",
                  ].join(" ")}
                  aria-hidden
              >
                <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

/**
 * 좌우 스와이프 시 옆에서 보이는 이전/다음 날 — 가운데 열과 동일 블록(읽기 전용, 입력·실행 UI 없음)
 * peekYmd: 인접 날짜(날짜 카드 표시)
 */
function AdjacentDayStaticColumn({
  plan,
  displayRows,
  activeChapterIdx = 0,
  daySwipePullX = 0,
  prefersReducedMotion = false,
  peekYmd = "",
  mainChapterParallaxYs = [0, 0, 0],
}) {
  const columnRootRef = useRef(null);
  const chapterRefs = [useRef(null), useRef(null), useRef(null)];
  const [chapterAlignedOffsetY, setChapterAlignedOffsetY] = useState(0);

  const norm = plan ? normalizeDayPlan(plan) : null;
  const important3 = norm?.important3 ?? ["", "", ""];
  const brainDump = norm?.brainDump ?? "";
  const rows = displayRows ?? [];

  useLayoutEffect(() => {
    if (prefersReducedMotion || plan == null) {
      setChapterAlignedOffsetY(0);
      return;
    }
    const idx = Math.max(0, Math.min(2, activeChapterIdx ?? 0));
    const target = chapterRefs[idx]?.current;
    const root = columnRootRef.current;
    if (!(target instanceof HTMLElement) || !root) return;
    setChapterAlignedOffsetY(-getScrollContentOffsetTop(root, target));
  }, [activeChapterIdx, prefersReducedMotion, plan]);

  const previewTranslateY = !prefersReducedMotion && plan != null
    ? chapterAlignedOffsetY + daySwipePullX * ADJACENT_DAY_SWIPE_PARALLAX_Y_PER_PX
    : 0;

  if (plan === null) {
    return (
      <div className="pointer-events-none w-full min-w-0 space-y-8 animate-pulse pb-5">
        <AdjacentPeekDateCard ymd={peekYmd} />
        <section aria-hidden className="relative">
          <div className="mb-2.5 h-14 rounded-2xl bg-stone-200/50" />
          <div className={UI_CANVAS_INSET}>
            <div className="divide-y divide-stone-200/35 px-2.5 py-2">
              {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-1 py-2 first:pt-0 last:pb-0"
                >
                  <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-200/80" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-full rounded-full bg-stone-200/70" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="relative">
          <div className="mb-2.5 h-14 rounded-2xl bg-stone-200/50" />
          <div className={UI_CANVAS_INSET}>
            <div className="px-2.5 py-2.5">
              <div className="min-h-[1.75rem] rounded-xl bg-stone-200/35" />
            </div>
          </div>
        </section>
        <section className="relative">
          <div className="mb-2.5 h-14 rounded-2xl bg-stone-200/50" />
          <div className={UI_CANVAS_INSET}>
            <div className="space-y-2.5 px-3 pt-3 pb-4">
              <div className="h-[3.25rem] rounded-2xl bg-slate-200/60" />
              <div className="h-[3.25rem] rounded-2xl bg-slate-200/60" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full min-w-0 select-none pb-5">
      <AdjacentPeekDateCard ymd={peekYmd} />
      <div
          ref={columnRootRef}
          className="pointer-events-none w-full min-w-0 space-y-8"
          style={
            !prefersReducedMotion
              ? {
                  transform: `translate3d(0, ${previewTranslateY}px, 0)`,
                  transition: "transform 0.2s ease-out",
                  willChange: Math.abs(daySwipePullX) > 0 ? "transform" : "auto",
                }
              : undefined
          }
      >
      <section ref={chapterRefs[0]} aria-label="가장 중요한 3가지" className="relative">
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
            style={{
              background:
                  "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(251,146,60,0.22), transparent 58%), radial-gradient(ellipse 70% 60% at 70% 40%, rgba(255,255,255,0.55), transparent 62%)",
              ...(!prefersReducedMotion
                ? {
                    transform: `translate3d(0, ${mainChapterParallaxYs[0] ?? 0}px, 0)`,
                    willChange: "transform",
                  }
                : {}),
            }}
        />
        <div
            className={[
              "sticky top-2 z-10 mb-2.5 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-2.5 py-1.5",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl",
            ].join(" ")}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-orange-700/70">CHAPTER 01</p>
            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">가장 중요한 일</p>
          </div>
          <span className="text-[12px] font-semibold text-stone-500">3개</span>
        </div>
        <div className={UI_CANVAS_INSET}>
          <div className="divide-y divide-stone-200/35 px-2.5 py-2">
            {important3.map((v, idx) => (
              <div
                  key={idx}
                  role="group"
                  aria-label={`가장 중요한 일 ${idx + 1}`}
                  className="flex items-center gap-3 rounded-xl px-1 py-2 first:pt-0 last:pb-0"
              >
                <span className={UI_PIN_WELL} aria-hidden>
                  <span className="text-[15px] font-semibold tabular-nums leading-none">
                    {idx + 1}
                  </span>
                </span>
                <div
                    className={[
                      "min-h-[40px] min-w-0 flex-1 whitespace-pre-wrap text-base leading-relaxed tracking-[-0.01em]",
                      v.trim() ? "text-stone-800" : "text-stone-400",
                    ].join(" ")}
                >
                  {v.trim() || `가장 중요한 일 ${idx + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={chapterRefs[1]} className="relative">
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
            style={{
              background:
                  "radial-gradient(ellipse 70% 60% at 40% 30%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(ellipse 70% 60% at 70% 45%, rgba(120,113,108,0.16), transparent 62%)",
              ...(!prefersReducedMotion
                ? {
                    transform: `translate3d(0, ${mainChapterParallaxYs[1] ?? 0}px, 0)`,
                    willChange: "transform",
                  }
                : {}),
            }}
        />
        <div className="sticky top-2 z-10 mb-2.5 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-stone-500/90">CHAPTER 02</p>
            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">브레인 덤프</p>
          </div>
          <span className="text-[12px] font-semibold text-stone-500">메모</span>
        </div>
        <div className={UI_CANVAS_INSET}>
          <div className="px-2.5 py-2.5">
            <div
                className={[
                  "min-h-[1.75rem] whitespace-pre-wrap text-[15px] leading-relaxed tracking-[-0.01em]",
                  brainDump.trim() ? "text-stone-800" : "text-stone-400",
                ].join(" ")}
            >
              {brainDump.trim() ? brainDump : "예: 회의 준비, 이메일 확인, 아이디어 메모..."}
            </div>
          </div>
        </div>
      </section>

      <section ref={chapterRefs[2]} aria-label="일정 목록" className="relative">
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
            style={{
              background:
                  "radial-gradient(ellipse 70% 60% at 55% 25%, rgba(251,146,60,0.16), transparent 60%), radial-gradient(ellipse 70% 60% at 20% 55%, rgba(255,255,255,0.55), transparent 62%)",
              ...(!prefersReducedMotion
                ? {
                    transform: `translate3d(0, ${mainChapterParallaxYs[2] ?? 0}px, 0)`,
                    willChange: "transform",
                  }
                : {}),
            }}
        />
        <div className="sticky top-2 z-10 mb-3 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-orange-700/70">CHAPTER 03</p>
            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">내용</p>
          </div>
        </div>
        <div className={UI_CANVAS_INSET}>
          <div className="px-3 pt-3 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))]">
            {rows.length > 0 ? (
                <div className="space-y-2.5">
                  {rows.map((it) => {
                    const isCarry = Boolean(it._isCarryover);
                    const rowKey = isCarry ? `carry_${it._carryFromYmd}_${it.id}` : it.id;
                    const execSec = isCarry
                      ? Math.max(0, Math.floor(it._executedMorningSeconds ?? 0))
                      : Math.max(0, Math.floor(it.executedSeconds ?? 0));
                    const isExecutionRunning =
                        !isCarry && Boolean(it.executionStartedAt);
                    return (
                        <div
                            key={rowKey}
                            className={[
                              "rounded-2xl px-2.5 py-2.5 outline-none",
                              isCarry
                                ? "border border-dashed border-orange-200/80 bg-orange-50/40"
                                : "",
                            ].join(" ")}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-min max-w-full shrink-0 whitespace-nowrap select-none text-[13px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                              {isCarry
                                ? formatCarryOverSegmentForDay(it.endTime)
                                : it.endTime
                                  ? formatItemTimeRange(it.startTime || it.time || "09:00", it.endTime)
                                  : it.startTime || it.time || "09:00"}
                            </div>
                            <div className="min-w-0 flex-1 basis-0">
                              <div className="whitespace-pre-wrap break-words text-sm leading-snug text-slate-900">
                                {it.content}
                              </div>
                            </div>
                            {(isCarry ? execSec > 0 : it.done || execSec > 0) ? (
                                <span
                                    className={[
                                      "inline-flex h-5 min-w-[5.25rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                                      isExecutionRunning
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-600",
                                    ].join(" ")}
                                >
                                  실행 {formatExecutedSecondsAsMmSs(execSec)}
                                </span>
                            ) : null}
                          </div>
                        </div>
                    );
                  })}
                </div>
            ) : (
                <EmptyScheduleListBlock variant="readonly" />
            )}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

export default function PageClient({ initialAuthUser = null, initialSelectedDate = null, initialPlan = null }) {
  const dayPlanRepository = useMemo(() => getDayPlanRepository(), []);
  const saveTimerRef = useRef(null);
  const lastSavedPlanRef = useRef("");
  const skippedInitialLoadRef = useRef(false);
  const dayPlanCacheRef = useRef(new Map());
  const [authReady, setAuthReady] = useState(Boolean(initialAuthUser?.id));
  const [isAuthBootstrapDone, setIsAuthBootstrapDone] = useState(Boolean(initialAuthUser?.id));
  const [authUser, setAuthUser] = useState(initialAuthUser);

  const toLocalYmd = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };


  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate || toLocalYmd(new Date()));

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [selectedDate]);
  const selectedDateDisplay = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return {
      day: Number.isFinite(d) ? String(d) : "",
      weekday: dt.toLocaleDateString("ko-KR", { weekday: "long" }),
      ym: dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long" }),
    };
  }, [selectedDate]);

  const todayShortLabel = useMemo(() => {
    const dt = new Date();
    return dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }, []);

  const selectedIsToday = useMemo(
      () => selectedDate === toLocalYmd(new Date()),
      [selectedDate]
  );

  const peekPrevYmd = useMemo(() => addDaysToYmd(selectedDate, -1), [selectedDate]);
  const peekNextYmd = useMemo(() => addDaysToYmd(selectedDate, 1), [selectedDate]);

  const [important3, setImportant3] = useState(initialPlan?.important3 ?? ["", "", ""]);
  const [brainDump, setBrainDump] = useState(initialPlan?.brainDump ?? "");
  const brainDumpTextareaRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const adjustBrainDumpHeight = useCallback(() => {
    const el = brainDumpTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const vhCap =
        typeof window !== "undefined"
            ? Math.floor(window.innerHeight * 0.65)
            : Number.MAX_SAFE_INTEGER;
    const capped = Math.min(scrollH, vhCap);
    const next = Math.max(capped, BRAIN_DUMP_TEXTAREA_MIN_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = scrollH > vhCap ? "auto" : "hidden";
  }, []);

  const composerBrainDumpRef = useRef(null);
  const scheduleComposerFirstImportantInputRef = useRef(null);
  const adjustComposerBrainDumpHeight = useCallback(() => {
    const el = composerBrainDumpRef.current;
    if (!el) return;
    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const lineCap = getTextareaMaxHeightByLines(el, COMPOSER_BRAIN_DUMP_MAX_LINES);
    const vhCap =
        typeof window !== "undefined"
            ? Math.floor(window.innerHeight * 0.32)
            : Number.MAX_SAFE_INTEGER;
    const capped = Math.min(scrollH, vhCap, lineCap);
    const next = Math.max(capped, BRAIN_DUMP_TEXTAREA_MIN_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = scrollH > Math.min(vhCap, lineCap) ? "auto" : "hidden";
  }, []);

  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("");
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState(initialPlan?.items ?? []);
  /** 전날 플랜에서 자정 넘김(수면 등)으로 오늘 새벽에 이어지는 구간 — 표시·통계용 */
  const [carryOverItems, setCarryOverItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [activeExecutionItemId, setActiveExecutionItemId] = useState(null);
  const [activeExecutionStartedAtMs, setActiveExecutionStartedAtMs] = useState(null);
  const [executionNowMs, setExecutionNowMs] = useState(Date.now());
  /** 실행 시작/중지 API 중복 호출 방지 (ref는 동기 가드, state는 로딩 UI) */
  const executionFetchInFlightRef = useRef(false);
  const [executionSync, setExecutionSync] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  /** 일정 내용 키워드별 월별 실행 추이 모달 */
  const [isTrendOpen, setIsTrendOpen] = useState(false);
  /** 일정 추가·수정: 하단 탭 「일정」·목록 항목 탭 등으로 열림 */
  const [isScheduleComposerModalOpen, setIsScheduleComposerModalOpen] = useState(false);
  /** 입력 없는 날 — 사용자가 직접 닫은 날짜(해당 날짜에서만 오버레이 숨김) */
  const [emptyDayLockDismissedDate, setEmptyDayLockDismissedDate] = useState(null);
  const [trendYm, setTrendYm] = useState(() => {
    const ymd = typeof initialSelectedDate === "string" ? initialSelectedDate : "";
    const [y, mo] = ymd.split("-").map(Number);
    if (Number.isFinite(y) && y > 0 && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, "0")}`;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [trendKeyword, setTrendKeyword] = useState("");
  /** `month` | `week` — 실행 추이 기간(월 단위 / 해당 주 일~토) */
  const [trendPeriod, setTrendPeriod] = useState("month");
  const [trendWeekStart, setTrendWeekStart] = useState(() => {
    const ymd = typeof initialSelectedDate === "string" ? initialSelectedDate : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return getSundayOfWeekForYmd(ymd);
    }
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return getSundayOfWeekForYmd(today);
  });
  const [trendSeries, setTrendSeries] = useState({
    loading: false,
    error: null,
    points: [],
  });
  const trendYmTitle = useMemo(() => {
    const [y, m] = trendYm.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }, [trendYm]);
  const trendWeekTitle = useMemo(() => {
    const mon = trendWeekStart;
    const end = addDaysToYmd(mon, 6);
    const [y1, m1, d1] = mon.split("-").map(Number);
    const [y2, m2, d2] = end.split("-").map(Number);
    if (!Number.isFinite(y1) || !Number.isFinite(m1) || !Number.isFinite(d1)) return "";
    if (y1 === y2) {
      return `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
    }
    return `${y1}년 ${m1}월 ${d1}일 ~ ${y2}년 ${m2}월 ${d2}일`;
  }, [trendWeekStart]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [readyDate, setReadyDate] = useState(initialAuthUser && initialSelectedDate ? initialSelectedDate : "");
  const [isInitialSkeletonDelayDone, setIsInitialSkeletonDelayDone] = useState(Boolean(initialAuthUser));
  const [showDayPlanSkeleton, setShowDayPlanSkeleton] = useState(true);
  const [showDayPlanContent, setShowDayPlanContent] = useState(false);
  const [swipingItemId, setSwipingItemId] = useState(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  /** 인라인 캘린더에 표시할 월 목록 `YYYY-MM` (열 때만 설정) */
  const [calendarMonthRange, setCalendarMonthRange] = useState(null);
  const [calendarVisibleRange, setCalendarVisibleRange] = useState({ start: 0, end: 0 });
  const calendarScrollRef = useRef(null);
  const calendarScrollRafRef = useRef(null);
  const calendarScrollPendingRef = useRef({ scrollTop: 0, viewportHeight: 0 });
  const [markedDates, setMarkedDates] = useState(new Set());
  const [repeatingTemplates, setRepeatingTemplates] = useState([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templateDraftContent, setTemplateDraftContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const swipeGestureRef = useRef({
    itemId: null,
    startX: 0,
    startY: 0,
    dragging: false,
    horizontalLocked: false,
    didMove: false,
  });
  const reportSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
    horizontalLocked: false,
    moved: false,
  });

  const templateSwipeRef = useRef({
    templateId: null,
    startX: 0,
    startY: 0,
    dragging: false,
    horizontalLocked: false,
    didMove: false,
    offsetX: 0,
  });
  const [swipingTemplateId, setSwipingTemplateId] = useState(null);
  const [templateSwipeOffsetX, setTemplateSwipeOffsetX] = useState(0);
  const deleteRepeatingTemplateRef = useRef(null);
  const applyRepeatingTemplateRef = useRef(null);
  const suppressTemplateItemClickUntilRef = useRef(0);
  const statsSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
  });
  const statsScrollRef = useRef(null);
  const reportScrollRef = useRef(null);
  const scheduleComposerScrollRef = useRef(null);
  const scheduleComposerSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
  });
  const trendScrollRef = useRef(null);
  const templatesScrollRef = useRef(null);
  const trendSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
  });
  /** 메인 본문 좌우 스와이프 → 전날/다음날 (리포트 모달과 동일 임계값) */
  const daySwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
    horizontalLocked: false,
  });
  const daySwipeViewportRef = useRef(null);
  const mainChapterScrollRef = useRef(null);
  /** 0=중요3, 1=브레인덤프, 2=일정 — 스크롤 위치로 동기화, 이전 챕터 입력 영역 페이드아웃용 */
  const [mainActiveChapterIdx, setMainActiveChapterIdx] = useState(0);
  /** 챕터별 글로우 패럴렉스 translateY(px) — 스크롤 픽셀마다 갱신 */
  const [mainChapterParallaxYs, setMainChapterParallaxYs] = useState(() => [0, 0, 0]);
  const mainChapterScrollSyncRafRef = useRef(null);
  const pendingChapterIdxAfterDaySwipeRef = useRef(null);
  const daySwipeCommitTimerRef = useRef(null);
  /** 드래그 오프셋(px) — 캐러셀에서 인접 날 미리보기 */
  const [daySwipePullX, setDaySwipePullX] = useState(0);
  /** 좌우 날짜 스와이프가 가로로 잠긴 동안 메인 챕터 세로 스크롤 억제 */
  const [daySwipeLocksVerticalScroll, setDaySwipeLocksVerticalScroll] = useState(false);
  const [daySwipeTransition, setDaySwipeTransition] = useState(false);
  const daySwipePullXRafRef = useRef(null);
  const daySwipePullXPendingRef = useRef(0);
  /** 캐러셀 트랙 translate — % 기준은 flex 폭 계산과 어긋날 수 있어 뷰포트 px와 터치의 w를 통일 */
  const [daySwipeViewportWidthPx, setDaySwipeViewportWidthPx] = useState(0);
  /** 좌우 피크 패널용 인접 날 플랜(null이면 스켈레톤) */
  const [peekPrevPlan, setPeekPrevPlan] = useState(null);
  const [peekNextPlan, setPeekNextPlan] = useState(null);
  /** peekPrev 날의 전날 이어짐(자정 넘김)용 — 전전날 플랜 */
  const [peekPrevPrevPlan, setPeekPrevPrevPlan] = useState(null);

  useLayoutEffect(() => {
    const el = daySwipeViewportRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setDaySwipeViewportWidthPx(el.offsetWidth);
      return;
    }
    const ro = new ResizeObserver(() => {
      setDaySwipeViewportWidthPx(el.offsetWidth);
    });
    ro.observe(el);
    setDaySwipeViewportWidthPx(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const canAdd = useMemo(() => {
    return newContent.trim().length > 0;
  }, [newContent]);

  const sortItemsByTimeAsc = useCallback((list) => {
    return [...list].sort((a, b) => {
      const aStart = a.startTime || a.time || "09:00";
      const bStart = b.startTime || b.time || "09:00";
      const aEnd = a.endTime || "";
      const bEnd = b.endTime || "";
      const aSpan = spansMidnight(aStart, aEnd);
      const bSpan = spansMidnight(bStart, bEnd);
      /** 같은 날 일정은 먼저, 자정 넘김(수면 등)은 뒤로 — 타임라인상 “밤~익일”을 하루 끝에 두기 위함 */
      if (aSpan !== bSpan) {
        return aSpan ? 1 : -1;
      }
      if (aStart === bStart) {
        if (aEnd === bEnd) return 0;
        return aEnd < bEnd ? -1 : 1;
      }
      return aStart < bStart ? -1 : 1;
    });
  }, []);

  /** 선택일과 state가 맞을 때만 본문 표시 — 날짜 전환 직전 프레임에 이전 날 입력이 보이는 현상 방지 */
  const planDisplayMatchesSelection = readyDate === selectedDate;

  const displayImportant3 = planDisplayMatchesSelection ? important3 : ["", "", ""];
  const displayBrainDump = planDisplayMatchesSelection ? brainDump : "";

  /** 당일 목록·리포트: 전날 이어짐 + 당일 일정 (시간순) */
  const displayItemsMerged = useMemo(() => {
    if (!planDisplayMatchesSelection) return [];
    const from = carryOverItems.map((x) => ({ ...x, _isCarryover: true }));
    const fromDay = items.map((it) => ({ ...it, _isCarryover: false }));
    const all = [...from, ...fromDay];
    all.sort((a, b) => {
      const sa = a._isCarryover
        ? 0
        : (parseHHMMToSecondsFromMidnight(a.startTime || a.time || "09:00") ?? 0);
      const sb = b._isCarryover
        ? 0
        : (parseHHMMToSecondsFromMidnight(b.startTime || b.time || "09:00") ?? 0);
      if (sa !== sb) return sa - sb;
      if (a._isCarryover && b._isCarryover) {
        const ea = parseHHMMToSecondsFromMidnight(a.endTime || "") ?? 0;
        const eb = parseHHMMToSecondsFromMidnight(b.endTime || "") ?? 0;
        return ea - eb;
      }
      if (a._isCarryover !== b._isCarryover) return a._isCarryover ? -1 : 1;
      return 0;
    });
    return all;
  }, [planDisplayMatchesSelection, carryOverItems, items]);

  /** 인접 ‘이전 날’ 패널: 전전날→전날 이어짐 + 전날 일정 */
  const peekPrevDisplayRows = useMemo(() => {
    if (!peekPrevPlan) return null;
    const prevYmd = addDaysToYmd(peekPrevYmd, -1);
    const carry = [];
    const source = peekPrevPrevPlan != null ? normalizeDayPlan(peekPrevPrevPlan) : createEmptyDayPlan();
    for (const raw of sortItemsByTimeAsc(source.items)) {
      const b = buildCarryOverDisplayItem(raw, prevYmd);
      if (b) carry.push(b);
    }
    const dayItems = sortItemsByTimeAsc(normalizeDayPlan(peekPrevPlan).items);
    return mergeAdjacentDisplayRows(carry, dayItems);
  }, [peekPrevPlan, peekPrevPrevPlan, peekPrevYmd, sortItemsByTimeAsc]);

  /** 인접 ‘다음 날’ 패널: 오늘→내일 이어짐 + 내일 일정 */
  const peekNextDisplayRows = useMemo(() => {
    if (!peekNextPlan) return null;
    const carry = [];
    if (planDisplayMatchesSelection) {
      for (const raw of sortItemsByTimeAsc(items)) {
        const b = buildCarryOverDisplayItem(raw, selectedDate);
        if (b) carry.push(b);
      }
    }
    const dayItems = sortItemsByTimeAsc(normalizeDayPlan(peekNextPlan).items);
    return mergeAdjacentDisplayRows(carry, dayItems);
  }, [peekNextPlan, items, selectedDate, sortItemsByTimeAsc, planDisplayMatchesSelection]);

  const serializePlan = useCallback(
      (plan) =>
          JSON.stringify({
            important3: normalizeDayPlan(plan).important3,
            brainDump: normalizeDayPlan(plan).brainDump,
            items: sortItemsByTimeAsc(normalizeDayPlan(plan).items).map((it) => ({
              id: it.id,
              startTime: it.startTime || it.time || "09:00",
              endTime: it.endTime || "",
              content: it.content,
              done: Boolean(it.done),
              executedSeconds:
                typeof it.executedSeconds === "number" && Number.isFinite(it.executedSeconds)
                  ? Math.max(0, Math.floor(it.executedSeconds))
                  : 0,
            })),
          }),
      [sortItemsByTimeAsc]
  );

  const filledImportant3 = useMemo(
      () =>
          (planDisplayMatchesSelection ? important3 : ["", "", ""])
              .map((v) => v.trim())
              .filter(Boolean),
      [important3, planDisplayMatchesSelection]
  );

  const templateDraftCanSave = useMemo(() => templateDraftContent.trim().length > 0, [templateDraftContent]);

  const editingTemplate = useMemo(() => {
    if (!editingTemplateId) return null;
    return repeatingTemplates.find((t) => t.id === editingTemplateId) ?? null;
  }, [editingTemplateId, repeatingTemplates]);

  const isEditingTemplateChanged = useMemo(() => {
    if (!editingTemplate) return false;
    return editingTemplate.content !== templateDraftContent.trim();
  }, [editingTemplate, templateDraftContent]);

  const [statsDayYmd, setStatsDayYmd] = useState(() => initialSelectedDate || toLocalYmd(new Date()));
  const [dailyStats, setDailyStats] = useState({
    loading: false,
    dateYmd: "",
    items: [],
    totalPlannedSeconds: 0,
    totalExecutedSeconds: 0,
    dayAchievementPercent: null,
    unplannedSeconds: SECONDS_PER_DAY,
    unplannedDayPercent: 100,
  });
  const [aiDayFeedback, setAiDayFeedback] = useState(null);
  const [aiDayFeedbackLoading, setAiDayFeedbackLoading] = useState(false);
  const [aiDayFeedbackError, setAiDayFeedbackError] = useState("");
  const [aiFeedbackTypedSummary, setAiFeedbackTypedSummary] = useState("");
  const [aiFeedbackListsVisible, setAiFeedbackListsVisible] = useState(false);
  const aiFeedbackTypeTimerRef = useRef(null);
  const aiFeedbackListTimerRef = useRef(null);
  const [aiPlanSuggestLoading, setAiPlanSuggestLoading] = useState(false);
  const [aiPlanSuggestError, setAiPlanSuggestError] = useState("");

  const statsDayLabel = useMemo(() => {
    const [y, m, d] = statsDayYmd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, [statsDayYmd]);

  const prevStatsOpenRef = useRef(false);
  useEffect(() => {
    if (isStatsOpen && !prevStatsOpenRef.current) {
      setStatsDayYmd(selectedDate);
    }
    prevStatsOpenRef.current = isStatsOpen;
  }, [isStatsOpen, selectedDate]);

  useEffect(() => {
    setAiDayFeedback(null);
    setAiDayFeedbackError("");
    setAiFeedbackTypedSummary("");
    setAiFeedbackListsVisible(false);
  }, [statsDayYmd, isStatsOpen]);

  useEffect(() => {
    if (aiFeedbackTypeTimerRef.current) {
      clearInterval(aiFeedbackTypeTimerRef.current);
      aiFeedbackTypeTimerRef.current = null;
    }
    if (aiFeedbackListTimerRef.current) {
      clearTimeout(aiFeedbackListTimerRef.current);
      aiFeedbackListTimerRef.current = null;
    }
    if (!aiDayFeedback) {
      setAiFeedbackTypedSummary("");
      setAiFeedbackListsVisible(false);
      return;
    }

    const summary = typeof aiDayFeedback.summary === "string" ? aiDayFeedback.summary : "";
    setAiFeedbackTypedSummary("");
    setAiFeedbackListsVisible(false);

    if (!summary) {
      setAiFeedbackListsVisible(true);
      return;
    }

    let idx = 0;
    aiFeedbackTypeTimerRef.current = setInterval(() => {
      idx += 1;
      setAiFeedbackTypedSummary(summary.slice(0, idx));
      if (idx >= summary.length) {
        if (aiFeedbackTypeTimerRef.current) {
          clearInterval(aiFeedbackTypeTimerRef.current);
          aiFeedbackTypeTimerRef.current = null;
        }
        aiFeedbackListTimerRef.current = setTimeout(() => {
          setAiFeedbackListsVisible(true);
        }, 120);
      }
    }, 20);

    return () => {
      if (aiFeedbackTypeTimerRef.current) {
        clearInterval(aiFeedbackTypeTimerRef.current);
        aiFeedbackTypeTimerRef.current = null;
      }
      if (aiFeedbackListTimerRef.current) {
        clearTimeout(aiFeedbackListTimerRef.current);
        aiFeedbackListTimerRef.current = null;
      }
    };
  }, [aiDayFeedback]);

  useLayoutEffect(() => {
    adjustBrainDumpHeight();
  }, [brainDump, adjustBrainDumpHeight, isDatePickerOpen, showDayPlanContent, readyDate]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPrefersReducedMotion(Boolean(mq.matches));
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    mq.addListener?.(apply);
    return () => mq.removeListener?.(apply);
  }, []);

  useLayoutEffect(() => {
    if (!isScheduleComposerModalOpen) return;
    adjustComposerBrainDumpHeight();
  }, [brainDump, isScheduleComposerModalOpen, adjustComposerBrainDumpHeight]);

  useEffect(() => {
    if (!isScheduleComposerModalOpen) return;
    if (isDatePickerOpen) return;
    const delay = prefersReducedMotion ? 0 : 140;
    const t = window.setTimeout(() => {
      const el = scheduleComposerFirstImportantInputRef.current;
      if (!(el instanceof HTMLInputElement)) return;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      if (typeof el.setSelectionRange === "function") {
        el.setSelectionRange(end, end);
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [isScheduleComposerModalOpen, isDatePickerOpen, prefersReducedMotion]);

  useEffect(() => {
    if (!initialAuthUser?.id || !initialSelectedDate) return;
    lastSavedPlanRef.current = serializePlan(initialPlan);
    dayPlanCacheRef.current.set(initialSelectedDate, normalizeDayPlan(initialPlan));
  }, [initialAuthUser?.id, initialSelectedDate, initialPlan, serializePlan]);

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return items.find((it) => it.id === editingId) ?? null;
  }, [editingId, items]);

  const isEditingChanged = useMemo(() => {
    if (!editingItem) return false;
    return (
        (editingItem.startTime || editingItem.time || "09:00") !== newStartTime ||
        (editingItem.endTime || "") !== newEndTime ||
        editingItem.content !== newContent.trim()
    );
  }, [editingItem, newContent, newEndTime, newStartTime]);

  const startEditItem = (item) => {
    setEditingId(item.id);
    setNewStartTime(item.startTime || item.time || "09:00");
    setNewEndTime(item.endTime || "");
    setNewContent(item.content);
    setIsScheduleComposerModalOpen(true);
  };

  const resetEditState = () => {
    setEditingId(null);
    setNewStartTime("09:00");
    setNewEndTime("");
    setNewContent("");
  };

  const resetTemplateDraft = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateDraftContent("");
  }, []);

  const finalizeReportClose = useCallback(() => {
    setIsReportOpen(false);
  }, []);

  const finalizeStatsClose = useCallback(() => {
    setIsStatsOpen(false);
  }, []);

  const finalizeTemplatesClose = useCallback(() => {
    setIsTemplatesOpen(false);
    resetTemplateDraft();
  }, [resetTemplateDraft]);

  const finalizeTrendClose = useCallback(() => {
    setIsTrendOpen(false);
  }, []);

  const finalizeScheduleComposerClose = useCallback(() => {
    setIsScheduleComposerModalOpen(false);
    setEditingId(null);
    setNewStartTime("09:00");
    setNewEndTime("");
    setNewContent("");
  }, []);

  const reportModalAnim = useModalOpenAnimation(isReportOpen, finalizeReportClose);
  const statsModalAnim = useModalOpenAnimation(isStatsOpen, finalizeStatsClose);
  const templatesModalAnim = useModalOpenAnimation(isTemplatesOpen, finalizeTemplatesClose);
  const trendModalAnim = useModalOpenAnimation(isTrendOpen, finalizeTrendClose);
  const scheduleComposerModalAnim = useModalOpenAnimation(
      isScheduleComposerModalOpen,
      finalizeScheduleComposerClose
  );

  const closeReportModal = reportModalAnim.requestClose;
  const closeStatsModal = statsModalAnim.requestClose;
  const closeTemplatesModal = templatesModalAnim.requestClose;
  const closeTrendModal = trendModalAnim.requestClose;
  const closeScheduleComposerModal = scheduleComposerModalAnim.requestClose;

  const addItem = () => {
    if (!canAdd) return;
    const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const resolvedEndTime = resolveEndTimeOrDefault(newStartTime, newEndTime);
    setItems((prev) =>
        sortItemsByTimeAsc([
          ...prev,
          {
            id,
            startTime: newStartTime,
            endTime: resolvedEndTime,
            content: newContent.trim(),
            done: false,
            executedSeconds: 0,
          },
        ])
    );
    closeScheduleComposerModal();
  };

  const saveEditItem = () => {
    if (!editingId) return;
    const nextContent = newContent.trim();
    if (!nextContent) return;
    const resolvedEndTime = resolveEndTimeOrDefault(newStartTime, newEndTime);

    setItems((prev) =>
        sortItemsByTimeAsc(
            prev.map((it) =>
                it.id === editingId
                    ? {
                      ...it,
                      startTime: newStartTime,
                      endTime: resolvedEndTime,
                      content: nextContent,
                    }
                    : it
            )
        )
    );
    closeScheduleComposerModal();
  };

  const handleLoadAiDayFeedback = useCallback(async () => {
    if (!authUser?.id || typeof dayPlanRepository.getAiDayFeedback !== "function") return;
    setAiDayFeedbackError("");
    setAiDayFeedbackLoading(true);
    try {
      const feedback = await dayPlanRepository.getAiDayFeedback(statsDayYmd);
      setAiDayFeedback(feedback);
    } catch (error) {
      console.error("Failed to load AI day feedback", error);
      setAiDayFeedbackError("AI 피드백을 불러오지 못했습니다.");
    } finally {
      setAiDayFeedbackLoading(false);
    }
  }, [authUser?.id, dayPlanRepository, statsDayYmd]);

  const handleApplyAiPlanSuggestion = useCallback(async () => {
    if (!authUser?.id || typeof dayPlanRepository.suggestAiPlan !== "function") return;
    setAiPlanSuggestError("");
    setAiPlanSuggestLoading(true);
    try {
      const suggestion = await dayPlanRepository.suggestAiPlan(selectedDate, 10);
      if (!suggestion) {
        setAiPlanSuggestError("AI 초안을 만들지 못했습니다.");
        return;
      }
      if (Array.isArray(suggestion.important3) && suggestion.important3.length === 3) {
        setImportant3(suggestion.important3.map((v) => (typeof v === "string" ? v : "")));
      }
      if (typeof suggestion.brainDump === "string") {
        setBrainDump(suggestion.brainDump);
      }
      if (Array.isArray(suggestion.items) && suggestion.items.length > 0) {
        const mapped = suggestion.items
          .map((it) => ({
            id:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            startTime: typeof it?.startTime === "string" ? it.startTime : "09:00",
            endTime: typeof it?.endTime === "string" ? it.endTime : "",
            content: typeof it?.content === "string" ? it.content.trim() : "",
            done: false,
            executedSeconds: 0,
          }))
          .filter((it) => it.content.length > 0);
        if (mapped.length > 0) setItems(sortItemsByTimeAsc(mapped));
      }
    } catch (error) {
      console.error("Failed to apply AI plan suggestion", error);
      setAiPlanSuggestError("AI 일정 초안 적용에 실패했습니다.");
    } finally {
      setAiPlanSuggestLoading(false);
    }
  }, [authUser?.id, dayPlanRepository, selectedDate, sortItemsByTimeAsc]);

  const shiftTrendMonth = useCallback((delta) => {
    setTrendYm((prev) => {
      const [y, mo] = prev.split("-").map(Number);
      const d = new Date(y, mo - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  const shiftTrendWeek = useCallback((delta) => {
    setTrendWeekStart((prev) => addDaysToYmd(prev, delta * 7));
  }, []);

  const handleTrendPeriodChange = useCallback((next) => {
    if (next !== "month" && next !== "week") return;
    if (next === trendPeriod) return;
    if (next === "week") {
      const [y, m] = trendYm.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) {
        setTrendWeekStart(getSundayOfWeekForYmd(`${y}-${String(m).padStart(2, "0")}-15`));
      }
    } else {
      const [y, mo] = trendWeekStart.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(mo)) {
        setTrendYm(`${y}-${String(mo).padStart(2, "0")}`);
      }
    }
    setTrendPeriod(next);
  }, [trendPeriod, trendYm, trendWeekStart]);

  const loadTrendSeries = useCallback(async () => {
    const kw = trendKeyword.trim();
    if (!kw) {
      setTrendSeries({
        loading: false,
        error: "일정 내용에 포함된 키워드를 입력하세요.",
        points: [],
      });
      return;
    }
    if (!authUser?.id) {
      setTrendSeries({
        loading: false,
        error: "로그인이 필요합니다.",
        points: [],
      });
      return;
    }

    setTrendSeries((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [y, m] = trendYm.split("-").map(Number);
      const ymdsToFetch =
          trendPeriod === "week"
            ? collectYmdsNeededForWeekTrend(trendWeekStart)
            : collectYmdsNeededForMonthTrend(y, m);
      const startYmd = ymdsToFetch[0];
      const endYmd = ymdsToFetch[ymdsToFetch.length - 1];

      const map = new Map();
      if (typeof dayPlanRepository.getByDateRangeInclusive === "function") {
        const rangeMap = await dayPlanRepository.getByDateRangeInclusive(startYmd, endYmd);
        rangeMap.forEach((plan, ymd) => {
          dayPlanCacheRef.current.set(ymd, plan);
          map.set(ymd, plan);
        });
      } else {
        for (const ymd of ymdsToFetch) {
          let plan;
          if (dayPlanCacheRef.current.has(ymd)) {
            plan = normalizeDayPlan(dayPlanCacheRef.current.get(ymd));
          } else {
            plan = await dayPlanRepository.getByDate(ymd);
            dayPlanCacheRef.current.set(ymd, plan);
          }
          map.set(ymd, plan);
        }
      }

      const points = [];
      const dayList =
          trendPeriod === "week" ? listWeekDaysYmd(trendWeekStart) : listYmDaysYmd(y, m);
      for (const ymd of dayList) {
        const prevYmd = addDaysToYmd(ymd, -1);
        const sec = sumExecutedSecondsMatchingContentOnCalendarDay(
            ymd,
            map.get(ymd),
            map.get(prevYmd),
            kw
        );
        points.push({ ymd, seconds: sec });
      }

      setTrendSeries({ loading: false, error: null, points });
    } catch (error) {
      console.error("Failed to load execution trend", error);
      setTrendSeries({
        loading: false,
        error: "데이터를 불러오지 못했습니다.",
        points: [],
      });
    }
  }, [authUser?.id, trendKeyword, trendYm, trendPeriod, trendWeekStart, dayPlanRepository]);

  const deleteItemById = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeExecutionItemId === id) {
      setActiveExecutionItemId(null);
      setActiveExecutionStartedAtMs(null);
      setExecutionNowMs(Date.now());
    }
    if (editingId === id) {
      resetEditState();
      setIsScheduleComposerModalOpen(false);
    }
  };

  const resetExecutionState = useCallback(() => {
    setActiveExecutionItemId(null);
    setActiveExecutionStartedAtMs(null);
    setExecutionNowMs(Date.now());
  }, []);

  const startExecution = useCallback(
      (id, nowMs) => {
        const startedAt = nowMs ?? Date.now();

        // 실행 중이던 항목이 있다면 먼저 정지시킨다.
        if (activeExecutionItemId && activeExecutionItemId !== id) {
          const elapsedSeconds =
              activeExecutionStartedAtMs
                ? Math.max(0, Math.floor((startedAt - activeExecutionStartedAtMs) / 1000))
                : 0;

          setItems((prev) =>
              prev.map((it) =>
                  it.id === activeExecutionItemId
                      ? {
                        ...it,
                        done: false,
                        executedSeconds: (it.executedSeconds ?? 0) + elapsedSeconds,
                      }
                      : it
              )
          );
        }

        setActiveExecutionItemId(id);
        setActiveExecutionStartedAtMs(startedAt);
        setExecutionNowMs(startedAt);

        setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, done: true } : it))
        );
      },
      [activeExecutionItemId, activeExecutionStartedAtMs]
  );

  const stopExecution = useCallback(
      (id, nowMs) => {
        const now = nowMs ?? Date.now();
        const elapsedSeconds =
            activeExecutionItemId === id && activeExecutionStartedAtMs
              ? Math.max(0, Math.floor((now - activeExecutionStartedAtMs) / 1000))
              : 0;

        setItems((prev) =>
            prev.map((it) =>
                it.id === id
                    ? {
                      ...it,
                      done: false,
                      executedSeconds: (it.executedSeconds ?? 0) + elapsedSeconds,
                    }
                    : it
            )
        );

        resetExecutionState();
      },
      [activeExecutionItemId, activeExecutionStartedAtMs, resetExecutionState]
  );

  const mergeExecutionItemIntoState = useCallback(
      (updated) => {
        if (!updated || typeof updated.id !== "string") return;
        setItems((prev) => {
          const next = sortItemsByTimeAsc(
              prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
          );
          dayPlanCacheRef.current.set(
              selectedDate,
              normalizeDayPlan({ important3, brainDump, items: next })
          );
          return next;
        });
      },
      [brainDump, important3, selectedDate, sortItemsByTimeAsc]
  );

  const toggleExecutionBySwipe = useCallback(
      async (id) => {
        const target = items.find((it) => it.id === id);
        if (!target) return;

        const running =
            Boolean(target.executionStartedAt) || Boolean(target.done);

        if (isDayPlanItemUuid(id) && typeof dayPlanRepository.startExecution === "function") {
          if (executionFetchInFlightRef.current) return;

          if (!running) {
            executionFetchInFlightRef.current = true;
            setExecutionSync({ itemId: id, action: "start" });
            try {
              try {
                const updated = await dayPlanRepository.startExecution(selectedDate, id);
                if (updated) mergeExecutionItemIntoState(updated);
              } catch (err) {
                if (err?.status === 404) {
                  await dayPlanRepository.saveByDate(
                      selectedDate,
                      normalizeDayPlan({ important3, brainDump, items })
                  );
                  lastSavedPlanRef.current = serializePlan({ important3, brainDump, items });
                  const updated = await dayPlanRepository.startExecution(selectedDate, id);
                  if (updated) mergeExecutionItemIntoState(updated);
                } else {
                  throw err;
                }
              }
            } catch (error) {
              console.error("Execution API failed", error);
            } finally {
              executionFetchInFlightRef.current = false;
              setExecutionSync(null);
            }
            return;
          }

          if (target.executionStartedAt) {
            executionFetchInFlightRef.current = true;
            setExecutionSync({ itemId: id, action: "stop" });
            try {
              const updated = await dayPlanRepository.stopExecution(selectedDate, id);
              if (updated) mergeExecutionItemIntoState(updated);
            } catch (error) {
              /** 서버에 이미 종료됐거나 행이 없을 때 — 로컬 표시·타이머만 정리 */
              if (error?.status === 409) {
                setItems((prev) => {
                  const cur = prev.find((x) => x.id === id);
                  if (!cur) return prev;
                  const startedMs = cur.executionStartedAt
                    ? Date.parse(cur.executionStartedAt)
                    : NaN;
                  const extraSec =
                      Number.isFinite(startedMs)
                        ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
                        : 0;
                  const next = sortItemsByTimeAsc(
                      prev.map((it) =>
                          it.id === id
                            ? {
                                ...it,
                                done: false,
                                executionStartedAt: null,
                                executedSeconds: (it.executedSeconds ?? 0) + extraSec,
                              }
                            : it
                      )
                  );
                  dayPlanCacheRef.current.set(
                      selectedDate,
                      normalizeDayPlan({ important3, brainDump, items: next })
                  );
                  return next;
                });
                if (activeExecutionItemId === id) {
                  resetExecutionState();
                }
                setExecutionNowMs(Date.now());
              } else {
                console.error("Execution API failed", error);
              }
            } finally {
              executionFetchInFlightRef.current = false;
              setExecutionSync(null);
            }
            return;
          }

          stopExecution(id, Date.now());
          return;
        }

        if (!running) {
          startExecution(id, Date.now());
        } else {
          stopExecution(id, Date.now());
        }
      },
      [
        items,
        selectedDate,
        dayPlanRepository,
        mergeExecutionItemIntoState,
        startExecution,
        stopExecution,
        important3,
        brainDump,
        serializePlan,
        activeExecutionItemId,
        resetExecutionState,
      ]
  );

  const getDisplayedExecutionSeconds = useCallback(
      (item) => {
        const base = typeof item.executedSeconds === "number" ? Math.max(0, Math.floor(item.executedSeconds)) : 0;
        if (item.executionStartedAt) {
          const ms = Date.parse(item.executionStartedAt);
          if (Number.isFinite(ms)) {
            return base + Math.max(0, Math.floor((executionNowMs - ms) / 1000));
          }
        }
        if (activeExecutionItemId === item.id && activeExecutionStartedAtMs) {
          return base + Math.max(0, Math.floor((executionNowMs - activeExecutionStartedAtMs) / 1000));
        }
        return base;
      },
      [activeExecutionItemId, activeExecutionStartedAtMs, executionNowMs]
  );

  const formatSecondsToMMSS = useCallback((totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const serverRunning = items.some((it) => Boolean(it.executionStartedAt));
    if (!serverRunning && (!activeExecutionItemId || !activeExecutionStartedAtMs)) return;
    const intervalId = window.setInterval(() => setExecutionNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [items, activeExecutionItemId, activeExecutionStartedAtMs]);

  useEffect(() => {
    // 날짜 전환 시에는 실행(가상 타이머) 상태를 끊어준다.
    resetExecutionState();
  }, [selectedDate, resetExecutionState]);

  const handleItemTouchStart = (id, event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeGestureRef.current = {
      itemId: id,
      startX: touch.clientX,
      startY: touch.clientY,
      dragging: true,
      horizontalLocked: false,
      didMove: false,
    };
    setSwipingItemId(id);
    setSwipeOffsetX(0);
  };

  const handleItemTouchMove = (id, event) => {
    const touch = event.touches?.[0];
    const gesture = swipeGestureRef.current;
    if (!touch || !gesture.dragging || gesture.itemId !== id) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.dragging = false;
        setSwipingItemId(null);
        setSwipeOffsetX(0);
        return;
      }
      gesture.horizontalLocked = true;
    }

    const nextOffset = Math.max(-120, Math.min(96, dx));
    gesture.didMove = Math.abs(nextOffset) > 10;
    setSwipeOffsetX(nextOffset);
  };

  const handleItemTouchEnd = (id) => {
    const gesture = swipeGestureRef.current;
    const isSameItem = gesture.itemId === id;
    const shouldDelete = isSameItem && swipeOffsetX <= -72;
    const shouldToggleDone = isSameItem && swipeOffsetX >= 56;
    const didMove = isSameItem && gesture.didMove;

    swipeGestureRef.current = {
      itemId: null,
      startX: 0,
      startY: 0,
      dragging: false,
      horizontalLocked: false,
      didMove: false,
    };
    setSwipingItemId(null);
    setSwipeOffsetX(0);

    if (shouldDelete) {
      deleteItemById(id);
      return true;
    }
    if (shouldToggleDone) {
      toggleExecutionBySwipe(id);
      return true;
    }
    return didMove;
  };

  const handleReportTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    reportSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
      horizontalLocked: false,
      moved: false,
    };
  };

  const handleReportTouchMove = (event) => {
    const touch = event.touches?.[0];
    const gesture = reportSwipeRef.current;
    if (!touch || !gesture.tracking) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        gesture.horizontalLocked = true;
      }
    }
    if (gesture.horizontalLocked && Math.abs(dx) > 12) {
      gesture.moved = true;
    }
  };

  const handleReportTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    const gesture = reportSwipeRef.current;
    if (!touch || !gesture.tracking) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    reportSwipeRef.current = {
      startX: 0,
      startY: 0,
      tracking: false,
      horizontalLocked: false,
      moved: false,
    };

    /** 통계·반복 모달과 동일: 아래로 충분히 밀면 닫기 */
    if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
      // 스크롤 컨테이너가 최상단일 때만 닫기: 내용 스크롤 중 오동작 방지
      const scrollTop = reportScrollRef.current?.scrollTop ?? 0;
      const canClose = scrollTop <= 0;
      if (!canClose) return;
      closeReportModal();
      preventDefaultIfCancelable(event);
      event.stopPropagation();
      return;
    }

    const isHorizontal = gesture.horizontalLocked || Math.abs(dx) > 24;

    if (!isHorizontal) return;

    if (dx <= -72) {
      setSelectedDate((d) => addDaysToYmd(d, 1));
      preventDefaultIfCancelable(event);
      event.stopPropagation();
      return;
    }
    if (dx >= 72) {
      setSelectedDate((d) => addDaysToYmd(d, -1));
      preventDefaultIfCancelable(event);
      event.stopPropagation();
    }
  };

  const handleStatsTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    statsSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleStatsTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = statsSwipeRef.current;
        statsSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          // 스크롤 컨테이너가 최상단일 때만 닫기: 내용 스크롤 중 오동작 방지
          const scrollTop = statsScrollRef.current?.scrollTop ?? 0;
          const canClose = scrollTop <= 0;
          if (!canClose) return;
          closeStatsModal();
          preventDefaultIfCancelable(event);
          event.stopPropagation();
        }
      },
      [closeStatsModal]
  );

  const handleScheduleComposerTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    scheduleComposerSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleScheduleComposerTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = scheduleComposerSwipeRef.current;
        scheduleComposerSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          const scrollTop = scheduleComposerScrollRef.current?.scrollTop ?? 0;
          const canClose = scrollTop <= 0;
          if (!canClose) return;
          closeScheduleComposerModal();
          preventDefaultIfCancelable(event);
          event.stopPropagation();
        }
      },
      [closeScheduleComposerModal]
  );

  const handleTrendTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    trendSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleTrendTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = trendSwipeRef.current;
        trendSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          const scrollTop = trendScrollRef.current?.scrollTop ?? 0;
          const canClose = scrollTop <= 0;
          if (!canClose) return;
          closeTrendModal();
          preventDefaultIfCancelable(event);
          event.stopPropagation();
        }
      },
      [closeTrendModal]
  );

  const handleTemplateTouchStart = useCallback((id, event) => {
    const touch = event.touches?.[0];
    if (!touch) return;

    templateSwipeRef.current = {
      templateId: id,
      startX: touch.clientX,
      startY: touch.clientY,
      dragging: true,
      horizontalLocked: false,
      didMove: false,
      offsetX: 0,
    };

    setSwipingTemplateId(id);
    setTemplateSwipeOffsetX(0);
  }, []);

  const handleTemplateTouchMove = useCallback((id, event) => {
    const touch = event.touches?.[0];
    const gesture = templateSwipeRef.current;
    if (!touch || !gesture.dragging || gesture.templateId !== id) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.dragging = false;
        setSwipingTemplateId(null);
        setTemplateSwipeOffsetX(0);
        return;
      }
      gesture.horizontalLocked = true;
    }

    const nextOffset = Math.max(-120, Math.min(96, dx));
    gesture.didMove = Math.abs(nextOffset) > 10;
    gesture.offsetX = nextOffset;
    setTemplateSwipeOffsetX(nextOffset);
  }, []);

  const handleTemplateTouchEnd = useCallback(
      (id) => {
        const gesture = templateSwipeRef.current;
        const isSame = gesture.templateId === id;
        const offset = gesture.offsetX ?? 0;
        const shouldDelete = isSame && offset <= -72;
        const shouldApplyRight = isSame && offset >= 72;
        const didMove = isSame && gesture.didMove;

        templateSwipeRef.current = {
          templateId: null,
          startX: 0,
          startY: 0,
          dragging: false,
          horizontalLocked: false,
          didMove: false,
          offsetX: 0,
        };

        setSwipingTemplateId(null);
        setTemplateSwipeOffsetX(0);

        if (shouldDelete) {
          suppressTemplateItemClickUntilRef.current = Date.now() + 500;
          deleteRepeatingTemplateRef.current?.(id);
          return true;
        }
        if (shouldApplyRight) {
          const template = repeatingTemplates.find((t) => t.id === id);
          if (template) {
            suppressTemplateItemClickUntilRef.current = Date.now() + 500;
            applyRepeatingTemplateRef.current?.(template);
            closeTemplatesModal();
          }
          return true;
        }
        return didMove;
      },
      [repeatingTemplates, closeTemplatesModal]
  );

  const handleTemplatesModalTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    statsSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleTemplatesModalTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = statsSwipeRef.current;
        statsSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          // 스크롤 컨테이너가 최상단일 때만 닫기: 내용 스크롤 중 오동작 방지
          const scrollTop = templatesScrollRef.current?.scrollTop ?? 0;
          const canClose = scrollTop <= 0;
          if (!canClose) return;
          closeTemplatesModal();
          preventDefaultIfCancelable(event);
          event.stopPropagation();
        }
      },
      [closeTemplatesModal]
  );

  const closeInlineCalendar = useCallback(() => {
    setIsDatePickerOpen(false);
    setCalendarMonthRange(null);
    setCalendarVisibleRange({ start: 0, end: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleGoToday = useCallback(() => {
    const today = toLocalYmd(new Date());
    setSelectedDate(today);
    closeInlineCalendar();
  }, [closeInlineCalendar]);

  const openInlineCalendar = (event) => {
    preventDefaultIfCancelable(event);
    event?.stopPropagation();

    const activeEl = document.activeElement;
    if (
        activeEl instanceof HTMLElement &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
    ) {
      activeEl.blur();
    }

    // 입력 포커스/키보드 닫힘 중 레이아웃 흔들림을 피하려고 즉시 상단 이동 후 캘린더를 연다.
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      const centerYm = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate.slice(0, 7)
        : toLocalYmd(new Date()).slice(0, 7);
      setCalendarMonthRange(buildMonthKeys(centerYm, 6, 6));
      setIsDatePickerOpen(true);
    });
  };

  const updateCalendarVirtualRange = useCallback((scrollTop, viewportHeight) => {
    if (!calendarMonthRange?.length) return;
    const total = calendarMonthRange.length;
    const start = Math.max(
      0,
      Math.floor(scrollTop / CALENDAR_VIRTUAL_MONTH_HEIGHT_PX) - CALENDAR_VIRTUAL_OVERSCAN
    );
    const visibleCount =
      Math.ceil(viewportHeight / CALENDAR_VIRTUAL_MONTH_HEIGHT_PX) + CALENDAR_VIRTUAL_OVERSCAN * 2;
    const end = Math.min(total - 1, start + visibleCount - 1);
    setCalendarVisibleRange((prev) => {
      if (prev.start === start && prev.end === end) return prev;
      return { start, end };
    });
  }, [calendarMonthRange]);

  const visibleCalendarMonths = useMemo(() => {
    if (!calendarMonthRange?.length) return [];
    const start = Math.max(0, calendarVisibleRange.start);
    const end = Math.max(start, Math.min(calendarMonthRange.length - 1, calendarVisibleRange.end));
    return calendarMonthRange.slice(start, end + 1);
  }, [calendarMonthRange, calendarVisibleRange]);

  const calendarTopSpacerPx =
    Math.max(0, calendarVisibleRange.start) * CALENDAR_VIRTUAL_MONTH_HEIGHT_PX;
  const hiddenMonthCount = calendarMonthRange?.length
    ? Math.max(0, calendarMonthRange.length - (calendarVisibleRange.end + 1))
    : 0;
  const calendarBottomSpacerPx = hiddenMonthCount * CALENDAR_VIRTUAL_MONTH_HEIGHT_PX;

  const handleCalendarScroll = useCallback((event) => {
    const node = event.currentTarget;
    if (!(node instanceof HTMLElement)) return;
    calendarScrollPendingRef.current = {
      scrollTop: node.scrollTop,
      viewportHeight: node.clientHeight,
    };
    if (calendarScrollRafRef.current) return;
    calendarScrollRafRef.current = requestAnimationFrame(() => {
      calendarScrollRafRef.current = null;
      const pending = calendarScrollPendingRef.current;
      updateCalendarVirtualRange(pending.scrollTop, pending.viewportHeight);
    });
  }, [updateCalendarVirtualRange]);

  useEffect(
    () => () => {
      if (calendarScrollRafRef.current) {
        cancelAnimationFrame(calendarScrollRafRef.current);
        calendarScrollRafRef.current = null;
      }
    },
    []
  );


  useEffect(() => {
    const initialSkeletonDelayMs = process.env.NODE_ENV === "test" ? 0 : 500;
    const timer = setTimeout(() => {
      setIsInitialSkeletonDelayDone(true);
    }, initialSkeletonDelayMs);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrap = async () => {
      const bootstrapDate = initialSelectedDate || toLocalYmd(new Date());

      try {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("token");
        if (accessToken) {
          setStoredAccessToken(accessToken);
          params.delete("token");
          const nextQuery = params.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
        }
      } catch (_error) {
        // ignore URL parsing failures
      }

      try {
        const auth = await dayPlanRepository.getBootstrap?.(bootstrapDate);
        if (cancelled) return;
        if (auth?.authenticated && auth.user?.id) {
          const plan = normalizeDayPlan(auth?.plan ?? createEmptyDayPlan());
          setAuthUser(auth.user);
          lastSavedPlanRef.current = serializePlan(plan);
          dayPlanCacheRef.current.set(bootstrapDate, plan);
          setImportant3(plan.important3);
          setBrainDump(plan.brainDump);
          setItems(sortItemsByTimeAsc(plan.items));
          setReadyDate(bootstrapDate);
          skippedInitialLoadRef.current = initialSelectedDate === bootstrapDate;
          return;
        }
        clearStoredAccessToken();
        setAuthUser(null);
        setReadyDate("");
      } catch (error) {
        if (!cancelled) {
          if (error?.status !== 401) {
            console.error("Failed to load bootstrap data", error);
          }
          clearStoredAccessToken();
          setAuthUser(null);
          setReadyDate("");
        }
      } finally {
        if (!cancelled) {
          setIsAuthBootstrapDone(true);
          setAuthReady(true);
        }
      }
    };

    if (!initialAuthUser?.id) {
      setIsAuthBootstrapDone(false);
      setAuthReady(false);
    }
    loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, [dayPlanRepository, initialSelectedDate, serializePlan, sortItemsByTimeAsc]);

  useLayoutEffect(() => {
    if (!authReady || !authUser?.id) return;

    if (skippedInitialLoadRef.current && initialSelectedDate === selectedDate) {
      skippedInitialLoadRef.current = false;
      setReadyDate(selectedDate);
      return;
    }

    const cachedPlan = dayPlanCacheRef.current.get(selectedDate);
    if (cachedPlan) {
      const normalizedPlan = normalizeDayPlan(cachedPlan);
      lastSavedPlanRef.current = serializePlan(normalizedPlan);
      resetExecutionState();
      setImportant3(normalizedPlan.important3);
      setBrainDump(normalizedPlan.brainDump);
      setItems(sortItemsByTimeAsc(normalizedPlan.items));
      resetEditState();
      setReadyDate(selectedDate);
      return;
    }

    let cancelled = false;

    const loadDayPlan = async () => {
      try {
        const plan = await dayPlanRepository.getByDate(selectedDate);
        if (cancelled) return;
        dayPlanCacheRef.current.set(selectedDate, plan);
        lastSavedPlanRef.current = serializePlan(plan);
        resetExecutionState();
        setImportant3(plan.important3);
        setBrainDump(plan.brainDump);
        setItems(sortItemsByTimeAsc(plan.items));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load day plan", error);
          resetExecutionState();
          setImportant3(["", "", ""]);
          setBrainDump("");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          resetEditState();
          setReadyDate(selectedDate);
        }
      }
    };

    loadDayPlan();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    authUser?.id,
    dayPlanRepository,
    initialSelectedDate,
    selectedDate,
    sortItemsByTimeAsc,
    serializePlan,
  ]);

  /** 전날 플랜에서 자정 넘김(수면 등) 항목만 추려 오늘 새벽 구간으로 표시 */
  useEffect(() => {
    if (!authReady || !authUser?.id) return;

    let cancelled = false;
    const prevYmd = addDaysToYmd(selectedDate, -1);

    const loadCarryOver = async () => {
      try {
        let plan;
        if (dayPlanCacheRef.current.has(prevYmd)) {
          plan = normalizeDayPlan(dayPlanCacheRef.current.get(prevYmd));
        } else {
          plan = await dayPlanRepository.getByDate(prevYmd);
          if (!cancelled) {
            dayPlanCacheRef.current.set(prevYmd, plan);
          }
        }
        if (cancelled) return;
        const list = sortItemsByTimeAsc(normalizeDayPlan(plan).items);
        const next = [];
        for (const raw of list) {
          const built = buildCarryOverDisplayItem(raw, prevYmd);
          if (built) next.push(built);
        }
        if (!cancelled) setCarryOverItems(next);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load carry-over day plan", error);
          setCarryOverItems([]);
        }
      }
    };

    loadCarryOver();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.id, selectedDate, dayPlanRepository, sortItemsByTimeAsc]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (readyDate !== selectedDate) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const currentPlan = { important3, brainDump, items };
    const nextSnapshot = serializePlan(currentPlan);
    if (lastSavedPlanRef.current === nextSnapshot) return;

    saveTimerRef.current = setTimeout(async () => {
      try {
        await dayPlanRepository.saveByDate(selectedDate, currentPlan);
        dayPlanCacheRef.current.set(selectedDate, normalizeDayPlan(currentPlan));
        lastSavedPlanRef.current = nextSnapshot;
      } catch (error) {
        console.error("Failed to save day plan", error);
      }
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [authUser?.id, readyDate, selectedDate, important3, brainDump, items, dayPlanRepository, serializePlan]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (!isDatePickerOpen || !calendarMonthRange?.length) return;
    let cancelled = false;

    const loadMarkedDates = async () => {
      try {
        const bounds = getRangeYmdBounds(calendarMonthRange);
        if (!bounds) return;

        let list;
        if (typeof dayPlanRepository.listMarkedDatesInRange === "function") {
          list = await dayPlanRepository.listMarkedDatesInRange(
              bounds.startYmd,
              bounds.endYmd
          );
        } else {
          const lists = await Promise.all(
              calendarMonthRange.map((ym) => {
                const [year, month] = ym.split("-").map(Number);
                return dayPlanRepository.listMarkedDatesInMonth(year, month);
              })
          );
          list = lists.flat();
        }

        if (cancelled) return;
        setMarkedDates(new Set(list));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load marked dates", error);
          setMarkedDates(new Set());
        }
      }
    };

    loadMarkedDates();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, isDatePickerOpen, calendarMonthRange, dayPlanRepository]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const hasContent = hasDayPlanContent({ important3, brainDump, items });
    setMarkedDates((prev) => {
      const next = new Set(prev);
      if (hasContent) next.add(selectedDate);
      else next.delete(selectedDate);
      return next;
    });
  }, [isDatePickerOpen, selectedDate, important3, brainDump, items]);

  useEffect(() => {
    if (!isDatePickerOpen || !calendarMonthRange?.length) return;
    const ym = selectedDate.slice(0, 7);
    const monthIdx = Math.max(0, calendarMonthRange.findIndex((key) => key === ym));
    const scrollTop = Math.max(0, (monthIdx - 1) * CALENDAR_VIRTUAL_MONTH_HEIGHT_PX);
    const viewportHeight = calendarScrollRef.current?.clientHeight ?? 560;
    setCalendarVisibleRange({
      start: Math.max(0, monthIdx - 3),
      end: Math.min(calendarMonthRange.length - 1, monthIdx + 3),
    });
    requestAnimationFrame(() => {
      const node = calendarScrollRef.current;
      if (!node) return;
      node.scrollTop = scrollTop;
      updateCalendarVirtualRange(scrollTop, viewportHeight);
    });
  }, [isDatePickerOpen, calendarMonthRange, selectedDate, updateCalendarVirtualRange]);

  const hasCachedSelectedPlan = dayPlanCacheRef.current.has(selectedDate);
  const isDateTransitionLoading =
      Boolean(authUser?.id) &&
      readyDate !== "" &&
      readyDate !== selectedDate &&
      !hasCachedSelectedPlan;
  /** 첫 부트스트랩·스켈레톤 지연 — 날짜만 바꾼 로딩과 구분 */
  const isInitialPlanLoading = useMemo(
      () =>
          !authReady ||
          (Boolean(authUser?.id) && (readyDate === "" || !isInitialSkeletonDelayDone)),
      [authReady, authUser?.id, readyDate, isInitialSkeletonDelayDone]
  );
  /** 캐러셀 등으로 날짜만 바뀐 뒤 API 로딩 — 본문 전체 blur 대신 오버레이만 */
  const showDateTransitionOverlay =
      isDateTransitionLoading && !isInitialPlanLoading;
  const isDayPlanLoading =
      !authReady ||
      (authUser?.id &&
          (readyDate === "" ||
              (readyDate !== selectedDate && !hasCachedSelectedPlan) ||
              !isInitialSkeletonDelayDone));

  const isPlanEmpty = useMemo(
      () => !hasDayPlanContent({ important3, brainDump, items }),
      [important3, brainDump, items]
  );

  const showEmptyDayLock = useMemo(() => {
    if (!authUser?.id) return false;
    if (isDatePickerOpen) return false;
    if (
        isReportOpen ||
        isStatsOpen ||
        isTemplatesOpen ||
        isTrendOpen ||
        isScheduleComposerModalOpen
    )
      return false;
    if (isDayPlanLoading) return false;
    if (isDateTransitionLoading) return false;
    if (!isPlanEmpty) return false;
    if (emptyDayLockDismissedDate === selectedDate) return false;
    return true;
  }, [
    authUser?.id,
    isDatePickerOpen,
    isReportOpen,
    isStatsOpen,
    isTemplatesOpen,
    isTrendOpen,
    isScheduleComposerModalOpen,
    isDayPlanLoading,
    isDateTransitionLoading,
    isPlanEmpty,
    emptyDayLockDismissedDate,
    selectedDate,
  ]);

  const daySwipeCarouselEnabled = useMemo(
      () =>
          ENABLE_DAY_SWIPE_ADJACENT_PEEK &&
          !prefersReducedMotion &&
          (showDayPlanContent || showEmptyDayLock),
      [prefersReducedMotion, showDayPlanContent, showEmptyDayLock]
  );

  const isDaySwipeIgnoredTarget = useCallback((target) => {
    if (!(target instanceof Element)) return true;
    if (target.closest("[data-day-swipe-ignore]")) return true;
    if (target.closest("button, input, textarea, select, a, label")) return true;
    if (target.closest('[role="button"]')) return true;
    return false;
  }, []);

  /** setState만으로는 같은 프레임에 overflow가 막히지 않는 경우가 있어 DOM에 즉시 반영 */
  const applyDaySwipeScrollLock = useCallback(() => {
    const root = mainChapterScrollRef.current;
    if (root) {
      root.style.setProperty("overflow-y", "hidden");
      root.style.setProperty("touch-action", "none");
      root.style.setProperty("overscroll-behavior-y", "none");
    }
    const vp = daySwipeViewportRef.current;
    if (vp) {
      vp.style.setProperty("touch-action", "none");
    }
  }, []);

  const releaseDaySwipeScrollLock = useCallback(() => {
    const root = mainChapterScrollRef.current;
    if (root) {
      root.style.removeProperty("overflow-y");
      root.style.removeProperty("touch-action");
      root.style.removeProperty("overscroll-behavior-y");
    }
    const vp = daySwipeViewportRef.current;
    if (vp) {
      vp.style.removeProperty("touch-action");
    }
  }, []);

  const handleDaySwipeTouchStart = useCallback(
      (event) => {
        releaseDaySwipeScrollLock();
        setDaySwipeLocksVerticalScroll(false);
        if (isDatePickerOpen) return;
        if (isReportOpen || isStatsOpen || isTemplatesOpen || isTrendOpen || isScheduleComposerModalOpen)
          return;
        if (isDateTransitionLoading) return;
        if (isDaySwipeIgnoredTarget(event.target)) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        if (daySwipeCommitTimerRef.current != null) {
          window.clearTimeout(daySwipeCommitTimerRef.current);
          daySwipeCommitTimerRef.current = null;
        }
        setDaySwipeTransition(false);
        daySwipeRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          tracking: true,
          horizontalLocked: false,
        };
      },
      [
        isDatePickerOpen,
        isReportOpen,
        isStatsOpen,
        isTemplatesOpen,
        isTrendOpen,
        isScheduleComposerModalOpen,
        isDateTransitionLoading,
        isDaySwipeIgnoredTarget,
        releaseDaySwipeScrollLock,
      ]
  );

  const handleDaySwipeTouchMove = useCallback((event) => {
    const touch = event.touches?.[0];
    const g = daySwipeRef.current;
    if (!touch || !g.tracking) return;
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    if (!g.horizontalLocked) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

      // 세로가 분명히 우세하면 가로 추적 종료
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.12) {
        g.tracking = false;
        releaseDaySwipeScrollLock();
        setDaySwipeLocksVerticalScroll(false);
        setDaySwipeTransition(true);
        setDaySwipePullX(0);
        window.setTimeout(() => setDaySwipeTransition(false), DAY_SWIPE_TRANSITION_MS);
        return;
      }

      // 가로 우선: dx가 dy보다 크거나(비율), 또는 가로 12px 이상 — 예전엔 dx<12면 무조건 return 해 세로가 이김
      const horizontalDominant =
          Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(dy) * 0.75;
      const strongHorizontal = Math.abs(dx) >= 12;
      if (!horizontalDominant && !strongHorizontal) {
        return;
      }

      g.horizontalLocked = true;
      applyDaySwipeScrollLock();
      setDaySwipeLocksVerticalScroll(true);
    }
    const w =
        typeof window !== "undefined"
          ? daySwipeViewportRef.current?.offsetWidth ?? window.innerWidth
          : 400;
    const maxPull = Math.min(w * 0.52, 520);
    daySwipePullXPendingRef.current = rubberDaySwipeDx(dx, maxPull);
    if (daySwipePullXRafRef.current != null) return;
    daySwipePullXRafRef.current = window.requestAnimationFrame(() => {
      daySwipePullXRafRef.current = null;
      setDaySwipePullX(daySwipePullXPendingRef.current);
    });
  }, [applyDaySwipeScrollLock, releaseDaySwipeScrollLock]);

  const captureCurrentChapterIdx = useCallback(() => {
    return getMainChapterIdxFromScrollRoot(mainChapterScrollRef.current);
  }, []);

  const syncMainChapterScrollState = useCallback(() => {
    const root = mainChapterScrollRef.current;
    if (!root) return;
    const chapters = Array.from(root.querySelectorAll("[data-main-chapter]"));
    const ys = chapters.map((el) =>
      el instanceof HTMLElement ? getChapterBlurParallaxTranslateY(root, el) : 0
    );
    setMainChapterParallaxYs(ys.length ? ys : [0, 0, 0]);
    setMainActiveChapterIdx(getMainChapterIdxFromScrollRoot(root));
  }, []);

  const onMainChapterScroll = useCallback(() => {
    if (mainChapterScrollSyncRafRef.current != null) return;
    mainChapterScrollSyncRafRef.current = requestAnimationFrame(() => {
      mainChapterScrollSyncRafRef.current = null;
      syncMainChapterScrollState();
    });
  }, [syncMainChapterScrollState]);

  const handleDaySwipeTouchEnd = useCallback(
      (event) => {
        releaseDaySwipeScrollLock();
        setDaySwipeLocksVerticalScroll(false);
        const touch = event.changedTouches?.[0];
        const prev = daySwipeRef.current;
        const wasTracking = prev.tracking;
        const wasHorizontalLocked = prev.horizontalLocked;
        const startX = prev.startX;
        const startY = prev.startY;

        daySwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
          horizontalLocked: false,
        };

        if (!touch || !wasTracking) return;

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        const isHorizontal =
            wasHorizontalLocked &&
            Math.abs(dx) > 36 &&
            Math.abs(dx) > Math.abs(dy) * 1.25;
        if (!isHorizontal) {
          setDaySwipeTransition(true);
          setDaySwipePullX(0);
          if (daySwipePullXRafRef.current != null) {
            window.cancelAnimationFrame(daySwipePullXRafRef.current);
            daySwipePullXRafRef.current = null;
          }
          window.setTimeout(() => setDaySwipeTransition(false), DAY_SWIPE_TRANSITION_MS);
          return;
        }
        if (Math.abs(dy) > Math.abs(dx)) {
          setDaySwipeTransition(true);
          setDaySwipePullX(0);
          if (daySwipePullXRafRef.current != null) {
            window.cancelAnimationFrame(daySwipePullXRafRef.current);
            daySwipePullXRafRef.current = null;
          }
          window.setTimeout(() => setDaySwipeTransition(false), DAY_SWIPE_TRANSITION_MS);
          return;
        }

        const w =
            typeof window !== "undefined"
              ? daySwipeViewportRef.current?.offsetWidth ?? window.innerWidth
              : 400;

        const useCarouselCommit = daySwipeCarouselEnabled;
        const commitAnimMs = useCarouselCommit
          ? DAY_SWIPE_CAROUSEL_TRANSITION_MS
          : DAY_SWIPE_TRANSITION_MS;

        if (dx <= -72) {
          pendingChapterIdxAfterDaySwipeRef.current = captureCurrentChapterIdx();
          setDaySwipeTransition(true);
          setDaySwipePullX(useCarouselCommit ? -w : -Math.min(w * 0.4, 180));
          if (daySwipeCommitTimerRef.current != null) {
            window.clearTimeout(daySwipeCommitTimerRef.current);
          }
          daySwipeCommitTimerRef.current = window.setTimeout(() => {
            daySwipeCommitTimerRef.current = null;
            if (useCarouselCommit) {
              setDaySwipeTransition(false);
              setDaySwipePullX(0);
            }
            setSelectedDate((d) => addDaysToYmd(d, 1));
            if (!useCarouselCommit) {
              setDaySwipeTransition(false);
              setDaySwipePullX(0);
            }
            if (daySwipePullXRafRef.current != null) {
              window.cancelAnimationFrame(daySwipePullXRafRef.current);
              daySwipePullXRafRef.current = null;
            }
          }, commitAnimMs);
          preventDefaultIfCancelable(event);
          event.stopPropagation();
          return;
        }
        if (dx >= 72) {
          pendingChapterIdxAfterDaySwipeRef.current = captureCurrentChapterIdx();
          setDaySwipeTransition(true);
          setDaySwipePullX(useCarouselCommit ? w : Math.min(w * 0.4, 180));
          if (daySwipeCommitTimerRef.current != null) {
            window.clearTimeout(daySwipeCommitTimerRef.current);
          }
          daySwipeCommitTimerRef.current = window.setTimeout(() => {
            daySwipeCommitTimerRef.current = null;
            if (useCarouselCommit) {
              setDaySwipeTransition(false);
              setDaySwipePullX(0);
            }
            setSelectedDate((d) => addDaysToYmd(d, -1));
            if (!useCarouselCommit) {
              setDaySwipeTransition(false);
              setDaySwipePullX(0);
            }
            if (daySwipePullXRafRef.current != null) {
              window.cancelAnimationFrame(daySwipePullXRafRef.current);
              daySwipePullXRafRef.current = null;
            }
          }, commitAnimMs);
          preventDefaultIfCancelable(event);
          event.stopPropagation();
          return;
        }

        setDaySwipeTransition(true);
        setDaySwipePullX(0);
        if (daySwipePullXRafRef.current != null) {
          window.cancelAnimationFrame(daySwipePullXRafRef.current);
          daySwipePullXRafRef.current = null;
        }
        window.setTimeout(() => setDaySwipeTransition(false), DAY_SWIPE_TRANSITION_MS);
      },
      [
        captureCurrentChapterIdx,
        daySwipeCarouselEnabled,
        releaseDaySwipeScrollLock,
        setSelectedDate,
      ]
  );

  const handleDaySwipeTouchCancel = useCallback(() => {
    if (daySwipeCommitTimerRef.current != null) {
      window.clearTimeout(daySwipeCommitTimerRef.current);
      daySwipeCommitTimerRef.current = null;
    }
    daySwipeRef.current = {
      startX: 0,
      startY: 0,
      tracking: false,
      horizontalLocked: false,
    };
    releaseDaySwipeScrollLock();
    setDaySwipeLocksVerticalScroll(false);
    setDaySwipeTransition(false);
    setDaySwipePullX(0);
    if (daySwipePullXRafRef.current != null) {
      window.cancelAnimationFrame(daySwipePullXRafRef.current);
      daySwipePullXRafRef.current = null;
    }
  }, [releaseDaySwipeScrollLock]);

  useEffect(() => {
    return () => {
      if (daySwipeCommitTimerRef.current != null) {
        window.clearTimeout(daySwipeCommitTimerRef.current);
      }
      if (daySwipePullXRafRef.current != null) {
        window.cancelAnimationFrame(daySwipePullXRafRef.current);
      }
      if (mainChapterScrollSyncRafRef.current != null) {
        window.cancelAnimationFrame(mainChapterScrollSyncRafRef.current);
        mainChapterScrollSyncRafRef.current = null;
      }
      releaseDaySwipeScrollLock();
    };
  }, [releaseDaySwipeScrollLock]);

  useEffect(() => {
    releaseDaySwipeScrollLock();
    setDaySwipePullX(0);
    setDaySwipeTransition(false);
  }, [releaseDaySwipeScrollLock, selectedDate]);

  useLayoutEffect(() => {
    if (!showDayPlanContent) return;
    const pendingChapterIdx = pendingChapterIdxAfterDaySwipeRef.current;
    if (pendingChapterIdx == null) return;
    const root = mainChapterScrollRef.current;
    if (!root) return;
    const chapters = Array.from(root.querySelectorAll("[data-main-chapter]"));
    const target = chapters[Math.max(0, Math.min(pendingChapterIdx, chapters.length - 1))];
    if (!(target instanceof HTMLElement)) {
      pendingChapterIdxAfterDaySwipeRef.current = null;
      return;
    }
    requestAnimationFrame(() => {
      const y = getScrollContentOffsetTop(root, target);
      root.scrollTop = y;
      requestAnimationFrame(() => {
        root.scrollTop = getScrollContentOffsetTop(root, target);
        pendingChapterIdxAfterDaySwipeRef.current = null;
        syncMainChapterScrollState();
      });
    });
  }, [selectedDate, showDayPlanContent, syncMainChapterScrollState]);

  useLayoutEffect(() => {
    if (!showDayPlanContent) return;
    const id = requestAnimationFrame(() => {
      syncMainChapterScrollState();
    });
    return () => cancelAnimationFrame(id);
  }, [selectedDate, showDayPlanContent, syncMainChapterScrollState]);

  useLayoutEffect(() => {
    if (!showDayPlanContent) return;
    const id = requestAnimationFrame(() => {
      syncMainChapterScrollState();
    });
    return () => cancelAnimationFrame(id);
  }, [mainActiveChapterIdx, showDayPlanContent, syncMainChapterScrollState]);

  useEffect(() => {
    if (!ENABLE_DAY_SWIPE_ADJACENT_PEEK) {
      setPeekPrevPlan(null);
      setPeekNextPlan(null);
      return;
    }
    if (!authUser?.id) {
      setPeekPrevPlan(null);
      setPeekNextPlan(null);
      return;
    }
    let cancelled = false;
    setPeekPrevPlan(null);
    setPeekNextPlan(null);
    (async () => {
      for (const [ymd, setter] of [
        [peekPrevYmd, setPeekPrevPlan],
        [peekNextYmd, setPeekNextPlan],
      ]) {
        if (cancelled) return;
        if (dayPlanCacheRef.current.has(ymd)) {
          setter(normalizeDayPlan(dayPlanCacheRef.current.get(ymd)));
          continue;
        }
        try {
          const raw = await dayPlanRepository.getByDate(ymd);
          if (cancelled) return;
          const p = normalizeDayPlan(raw);
          dayPlanCacheRef.current.set(ymd, p);
          setter(p);
        } catch {
          if (!cancelled) setter(createEmptyDayPlan());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peekPrevYmd, peekNextYmd, authUser?.id, dayPlanRepository]);

  useEffect(() => {
    if (!ENABLE_DAY_SWIPE_ADJACENT_PEEK) {
      setPeekPrevPrevPlan(null);
      return;
    }
    if (!authUser?.id) {
      setPeekPrevPrevPlan(null);
      return;
    }
    const ymd = addDaysToYmd(peekPrevYmd, -1);
    let cancelled = false;
    setPeekPrevPrevPlan(null);
    (async () => {
      if (dayPlanCacheRef.current.has(ymd)) {
        setPeekPrevPrevPlan(normalizeDayPlan(dayPlanCacheRef.current.get(ymd)));
        return;
      }
      try {
        const raw = await dayPlanRepository.getByDate(ymd);
        if (cancelled) return;
        const p = normalizeDayPlan(raw);
        dayPlanCacheRef.current.set(ymd, p);
        setPeekPrevPrevPlan(p);
      } catch {
        if (!cancelled) setPeekPrevPrevPlan(createEmptyDayPlan());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peekPrevYmd, authUser?.id, dayPlanRepository]);

  useEffect(() => {
    if (isDayPlanLoading) {
      setShowDayPlanSkeleton(isInitialPlanLoading);
      if (isInitialPlanLoading) {
        setShowDayPlanContent(false);
      }
      return;
    }

    const contentTimer = setTimeout(() => {
      setShowDayPlanContent(true);
    }, 150);

    const skeletonTimer = setTimeout(() => {
      setShowDayPlanSkeleton(false);
    }, 340);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(skeletonTimer);
    };
  }, [isDayPlanLoading, isInitialPlanLoading]);

  const [showAuthTransitionContent, setShowAuthTransitionContent] = useState(Boolean(initialAuthUser?.id));

  useEffect(() => {
    if (!isAuthBootstrapDone) {
      setShowAuthTransitionContent(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowAuthTransitionContent(true);
    }, 220);

    return () => clearTimeout(timer);
  }, [isAuthBootstrapDone]);

  useEffect(() => {
    if (
        !isReportOpen &&
        !isStatsOpen &&
        !isTemplatesOpen &&
        !isTrendOpen &&
        !isScheduleComposerModalOpen &&
        !showEmptyDayLock
    )
      return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const previousHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyStyle.overflow;
      body.style.position = previousBodyStyle.position;
      body.style.top = previousBodyStyle.top;
      body.style.width = previousBodyStyle.width;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [
    isReportOpen,
    isStatsOpen,
    isTemplatesOpen,
    isTrendOpen,
    isScheduleComposerModalOpen,
    showEmptyDayLock,
  ]);

  useEffect(() => {
    if (!isStatsOpen || !authUser?.id) return;

    let cancelled = false;

    const loadDailyStats = async () => {
      setDailyStats((prev) => ({ ...prev, loading: true }));
      try {
        const dateYmd = statsDayYmd;
        let plan;
        if (dayPlanCacheRef.current.has(dateYmd)) {
          plan = normalizeDayPlan(dayPlanCacheRef.current.get(dateYmd));
        } else {
          plan = await dayPlanRepository.getByDate(dateYmd);
          dayPlanCacheRef.current.set(dateYmd, plan);
        }

        const prevYmd = addDaysToYmd(dateYmd, -1);
        let prevPlan;
        if (dayPlanCacheRef.current.has(prevYmd)) {
          prevPlan = normalizeDayPlan(dayPlanCacheRef.current.get(prevYmd));
        } else {
          prevPlan = await dayPlanRepository.getByDate(prevYmd);
          dayPlanCacheRef.current.set(prevYmd, prevPlan);
        }

        if (cancelled) return;

        const rawItems = sortItemsByTimeAsc(normalizeDayPlan(plan).items);
        const dayRows = rawItems.map((it) => {
          const startTime = it.startTime || it.time || "09:00";
          const endTime = it.endTime || "";
          const fullPlanned = getPlannedDurationSeconds(startTime, endTime);
          const plannedOnDay = getPlannedSecondsOnCalendarDay(startTime, endTime);
          const executedFull = Math.max(0, Math.floor(it.executedSeconds ?? 0));
          const executedOnDay =
              fullPlanned != null && fullPlanned > 0 && plannedOnDay != null && plannedOnDay > 0
                ? Math.round((executedFull * plannedOnDay) / fullPlanned)
                : plannedOnDay != null && plannedOnDay > 0
                  ? executedFull
                  : 0;
          let achievementPercent = null;
          if (plannedOnDay != null && plannedOnDay > 0) {
            achievementPercent = Math.min(100, (executedOnDay / plannedOnDay) * 100);
          }
          const startSec = parseHHMMToSecondsFromMidnight(startTime);
          const daySharePercent =
              plannedOnDay != null && plannedOnDay > 0 ? (plannedOnDay / SECONDS_PER_DAY) * 100 : null;
          return {
            id: it.id,
            content: it.content,
            startTime,
            endTime,
            plannedSeconds: plannedOnDay,
            executedSeconds: executedOnDay,
            achievementPercent,
            startSecondsFromMidnight: startSec ?? 0,
            daySharePercent,
            _carryFromYmd: null,
          };
        });

        const carryRows = [];
        const prevRaw = sortItemsByTimeAsc(normalizeDayPlan(prevPlan).items);
        for (const it of prevRaw) {
          const startTime = it.startTime || it.time || "09:00";
          const endTime = it.endTime || "";
          const morningIv = getOvernightMorningIntervalOnFollowingDay(startTime, endTime);
          if (!morningIv || morningIv.end <= morningIv.start) continue;
          const morningPlanned = morningIv.end - morningIv.start;
          const fullPlanned = getPlannedDurationSeconds(startTime, endTime);
          const executedFull = Math.max(0, Math.floor(it.executedSeconds ?? 0));
          const executedMorning =
              fullPlanned != null && fullPlanned > 0
                ? Math.round((executedFull * morningPlanned) / fullPlanned)
                : 0;
          let achievementPercent = null;
          if (morningPlanned > 0) {
            achievementPercent = Math.min(100, (executedMorning / morningPlanned) * 100);
          }
          carryRows.push({
            id: `carry_${prevYmd}_${it.id}`,
            content: it.content,
            startTime: "00:00",
            endTime,
            plannedSeconds: morningPlanned,
            executedSeconds: executedMorning,
            achievementPercent,
            startSecondsFromMidnight: 0,
            daySharePercent: (morningPlanned / SECONDS_PER_DAY) * 100,
            _carryFromYmd: prevYmd,
          });
        }

        const items = [...carryRows, ...dayRows].sort((a, b) => {
          if (a.startSecondsFromMidnight !== b.startSecondsFromMidnight) {
            return a.startSecondsFromMidnight - b.startSecondsFromMidnight;
          }
          return String(a.id).localeCompare(String(b.id));
        });

        let totalPlannedSeconds = 0;
        let weightedPlanned = 0;
        let weightedExecuted = 0;
        for (const row of items) {
          if (row.plannedSeconds != null && row.plannedSeconds > 0) {
            totalPlannedSeconds += row.plannedSeconds;
            weightedPlanned += row.plannedSeconds;
            weightedExecuted += row.executedSeconds;
          }
        }
        const totalExecutedSeconds = items.reduce((s, r) => s + r.executedSeconds, 0);
        const dayAchievementPercent =
            weightedPlanned > 0 ? Math.min(100, (weightedExecuted / weightedPlanned) * 100) : null;

        const dayIntervals = [];
        /** carryRows는 이미 당일 00:00~종료로 정규화됨 — spansMidnight가 아니므로 getOvernight… 대신 당일 구간으로 합산 */
        for (const row of carryRows) {
          const iv = getPlannedIntervalOnCalendarDay(row.startTime, row.endTime);
          if (iv) dayIntervals.push(iv);
        }
        for (const row of dayRows) {
          const iv = getPlannedIntervalOnCalendarDay(row.startTime, row.endTime);
          if (iv) dayIntervals.push(iv);
        }
        const plannedUnionSeconds = Math.min(SECONDS_PER_DAY, unionIntervalsLengthSeconds(dayIntervals));
        const unplannedSeconds = Math.max(0, SECONDS_PER_DAY - plannedUnionSeconds);
        const unplannedDayPercent = (unplannedSeconds / SECONDS_PER_DAY) * 100;

        setDailyStats({
          loading: false,
          dateYmd,
          items,
          totalPlannedSeconds,
          totalExecutedSeconds,
          dayAchievementPercent,
          unplannedSeconds,
          unplannedDayPercent,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load daily stats", error);
        setDailyStats({
          loading: false,
          dateYmd: statsDayYmd,
          items: [],
          totalPlannedSeconds: 0,
          totalExecutedSeconds: 0,
          dayAchievementPercent: null,
          unplannedSeconds: SECONDS_PER_DAY,
          unplannedDayPercent: 100,
        });
      }
    };

    loadDailyStats();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, dayPlanRepository, isStatsOpen, sortItemsByTimeAsc, statsDayYmd]);

  useEffect(() => {
    if (!isTemplatesOpen || !authUser?.id) return;

    let cancelled = false;

    const loadTemplates = async () => {
      setIsTemplatesLoading(true);
      try {
        const templates = await dayPlanRepository.listRepeatingTemplates?.();
        if (!cancelled) {
          setRepeatingTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load repeating templates", error);
          setRepeatingTemplates([]);
        }
      } finally {
        if (!cancelled) {
          setIsTemplatesLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, dayPlanRepository, isTemplatesOpen]);

  const applyRepeatingTemplate = useCallback((template) => {
    if (!template) return;
    setNewContent(typeof template.content === "string" ? template.content : "");
    setEditingId(null);
  }, []);

  useEffect(() => {
    applyRepeatingTemplateRef.current = applyRepeatingTemplate;
  }, [applyRepeatingTemplate]);

  const startEditingTemplate = useCallback((template) => {
    setEditingTemplateId(template.id);
    setTemplateDraftContent(template.content);
  }, []);

  const saveRepeatingTemplate = useCallback(async () => {
    const content = templateDraftContent.trim();
    if (!content) return;

    try {
      if (editingTemplateId) {
        const updated = await dayPlanRepository.updateRepeatingTemplate?.(editingTemplateId, {
          content,
        });
        if (updated) {
          setRepeatingTemplates((prev) =>
            prev.map((item) => (item.id === editingTemplateId ? updated : item))
          );
        }
      } else {
        const created = await dayPlanRepository.createRepeatingTemplate?.({
          content,
        });
        if (created) {
          setRepeatingTemplates((prev) =>
            [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          );
        }
      }
      resetTemplateDraft();
    } catch (error) {
      console.error("Failed to save repeating template", error);
    }
  }, [dayPlanRepository, editingTemplateId, resetTemplateDraft, templateDraftContent]);

  const deleteRepeatingTemplate = useCallback(
      async (templateId) => {
        try {
          await dayPlanRepository.deleteRepeatingTemplate?.(templateId);
          setRepeatingTemplates((prev) => prev.filter((item) => item.id !== templateId));
          if (editingTemplateId === templateId) {
            resetTemplateDraft();
          }
        } catch (error) {
          console.error("Failed to delete repeating template", error);
        }
      },
      [dayPlanRepository, editingTemplateId, resetTemplateDraft]
  );

  useEffect(() => {
    deleteRepeatingTemplateRef.current = deleteRepeatingTemplate;
  }, [deleteRepeatingTemplate]);

  const handleLogin = () => {
    window.location.href = getApiAuthUrl("/auth/google");
  };

  const handleLogout = async () => {
    try {
      await dayPlanRepository.logout?.();
    } finally {
      clearStoredAccessToken();
      setAuthUser(null);
      setAuthReady(true);
      setReadyDate("");
      setImportant3(["", "", ""]);
      setBrainDump("");
      setItems([]);
      setActiveExecutionItemId(null);
      setActiveExecutionStartedAtMs(null);
      setExecutionNowMs(Date.now());
      setIsReportOpen(false);
      setIsStatsOpen(false);
      setIsTemplatesOpen(false);
      setIsTrendOpen(false);
      setIsScheduleComposerModalOpen(false);
      setIsDatePickerOpen(false);
      setEmptyDayLockDismissedDate(null);
    }
  };

  if (!authUser) {
    return (
        <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-stone-200">
          <div
              className="pointer-events-none absolute inset-0 opacity-70"
              aria-hidden
              style={{
                backgroundImage:
                    "linear-gradient(180deg, rgba(231,229,228,0.96), rgba(231,229,228,0.96)), radial-gradient(ellipse 90% 60% at 50% 112%, rgba(255,255,255,0.24), transparent 56%)",
              }}
          />
          <section
              className="relative mx-auto flex w-full max-w-md flex-col px-8 py-12 sm:px-10"
              style={{ paddingBottom: "max(3rem, calc(env(safe-area-inset-bottom) + 2rem))" }}
          >
          <div className="relative min-h-[70dvh]">
            <div
                className={[
                  "absolute inset-0 w-full transition-[opacity,transform,filter] duration-820 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]",
              showAuthTransitionContent
                ? "pointer-events-none absolute inset-0 translate-y-0.5 scale-[0.998] opacity-0 blur-[0.5px]"
                : "translate-y-0 scale-100 opacity-100 blur-0",
                ].join(" ")}
                aria-hidden={showAuthTransitionContent}
            >
            <div className="flex min-h-[70dvh] items-center justify-center">
                <div className="flex items-center gap-3" aria-hidden>
                  <div className="space-y-2">
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-2.5 w-11 rounded-full bg-slate-700/85" />
                    <div className="h-2.5 w-9 rounded-full bg-slate-400/85" />
                    <div className="h-2.5 w-13 rounded-full bg-slate-700/85" />
                  </div>
                </div>
              </div>
            </div>

            <div
                className={[
                  "absolute inset-0 w-full transition-[opacity,transform,filter] duration-650 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]",
              showAuthTransitionContent
                ? "translate-y-0 scale-100 opacity-100 blur-0"
                : "pointer-events-none translate-y-1 scale-[0.998] opacity-0 blur-[2px]",
                ].join(" ")}
                aria-hidden={!showAuthTransitionContent}
            >
              <div className="flex min-h-[70dvh] flex-col justify-center">
                <div>
                  <h1 className="text-[42px] font-semibold leading-[0.9] tracking-[-0.08em] text-slate-950 sm:text-[52px]">
                    Time
                    <span className="ml-2 inline-block text-slate-300">/</span>
                    <br />
                    <span className="inline-block pl-6">boxing</span>
                  </h1>
                  <p className="mt-3 text-[18px] leading-[1.35] tracking-[-0.03em] text-slate-700">
                    Plan your day.
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-slate-400">
                    Focus on what matters most.
                  </p>
                </div>

                <div className="mt-14 max-w-sm">
                  <button
                      type="button"
                      onClick={handleLogin}
                      aria-label="Google로 로그인"
                      className="group flex h-16 w-16 items-center justify-center rounded-full bg-[#1F1F1F] text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                  >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 transition-transform duration-150 group-active:scale-95"
                    >
                      <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 3.7 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1.1-.2-1.6z"
                      />
                      <path
                          fill="#34A853"
                          d="M3 16.7l3.1-2.4c.8 1.9 2.6 3.2 5 3.2 3 0 4.7-2 5.3-3H12v-3.8h8.4c.1.4.2 1 .2 1.6 0 5.2-3.5 8.9-8.6 8.9-3.8 0-7-2.2-8.6-5.5z"
                      />
                      <path
                          fill="#FBBC05"
                          d="M4.8 7.9C4.3 8.9 4 10 4 11.2c0 1.2.3 2.3.8 3.3l-1.8 2.2C2.4 15.4 2 13.8 2 12s.4-3.4 1.1-4.8z"
                      />
                      <path
                          fill="#4285F4"
                          d="M12 4.8c2 0 3.4.9 4.2 1.6l2.8-2.8C17.3 2 14.9 1 12 1 8.1 1 4.7 3.2 3 6.4l3 2.3C6.8 6.4 9.1 4.8 12 4.8z"
                      />
                    </svg>
                  </button>
                  <p className="mt-5 text-[11px] leading-5 tracking-[0.12em] text-slate-300">
                    TAP TO SIGN IN
                  </p>
                </div>
              </div>
            </div>
          </div>
          </section>
        </main>
    );
  }

  return (
      <main className="min-h-[100dvh] w-full min-w-0 overflow-hidden bg-stone-200">
        {/* 하단 고정 탭바가 main overflow에 잘리지 않도록 스크롤 영역만 overflow-x 숨김 */}
        <div className="h-[100dvh] w-full min-w-0 overflow-x-clip overflow-y-hidden">

        <EmptyDayLockScreen
            visible={showEmptyDayLock}
            selectedDate={selectedDate}
            onDismiss={() => setEmptyDayLockDismissedDate(selectedDate)}
            onStartPlan={() => {
              setIsScheduleComposerModalOpen(true);
            }}
            onTouchStart={handleDaySwipeTouchStart}
            onTouchMove={handleDaySwipeTouchMove}
            onTouchEnd={handleDaySwipeTouchEnd}
            onTouchCancel={handleDaySwipeTouchCancel}
            swipePullX={daySwipePullX}
            swipeTransition={daySwipeTransition}
            prefersReducedMotion={prefersReducedMotion}
            carouselSwipeEnabled={daySwipeCarouselEnabled}
        />

        <div
            className="mx-auto w-full min-w-0 max-w-md px-0 pb-[max(8.75rem,calc(5.75rem+env(safe-area-inset-bottom)))] pt-[max(1rem,env(safe-area-inset-top)+0.75rem)]"
        >
          <div
              ref={daySwipeViewportRef}
              className="w-full min-w-0 overflow-x-clip"
              onTouchStart={handleDaySwipeTouchStart}
              onTouchMove={handleDaySwipeTouchMove}
              onTouchEnd={handleDaySwipeTouchEnd}
              onTouchCancel={handleDaySwipeTouchCancel}
          >
            <div className="w-full min-w-0">
          <div className="relative grid w-full min-w-0">
            {showDayPlanSkeleton ? (
                <div
                    className={[
                      "col-start-1 row-start-1 space-y-5 animate-pulse transition-[opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isDayPlanLoading
                        ? "opacity-100 translate-y-0 scale-100 blur-0"
                        : "pointer-events-none opacity-0 -translate-y-0.5 scale-[0.996] blur-[1.5px]",
                    ].join(" ")}
                    aria-label="일정 불러오는 중"
                >
                  <section aria-hidden>
                    <div className={UI_SURFACE_P4}>
                      <div className="divide-y divide-stone-200/80">
                        {[0, 1, 2].map((i) => (
                          <div
                              key={i}
                              className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-200/80" />
                            <div className="min-w-0 flex-1">
                              <div className="h-3 w-full rounded-full bg-stone-200/70" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                  <section>
                    <div className={UI_SURFACE_P4}>
                      <div className="min-h-[120px] rounded-xl bg-stone-200/35" />
                    </div>
                  </section>
                  <section>
                    <div className={UI_SURFACE_P4}>
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 gap-y-3 sm:gap-3">
                          <div className="h-10 w-[104px] shrink-0 rounded-lg bg-slate-200/70" />
                          <div className="h-10 w-[104px] shrink-0 rounded-lg bg-slate-200/70" />
                          <div className="h-10 w-[5.25rem] shrink-0 rounded-lg bg-slate-200/70" />
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="h-10 min-h-[40px] flex-1 rounded-xl bg-slate-200/70" />
                          <div className="h-10 w-[56px] rounded-md bg-slate-200/70" />
                          <div className="h-10 w-10 shrink-0 rounded-md bg-slate-200/70" />
                        </div>
                        <div className="space-y-3 border-t border-slate-100 pt-4">
                          <div className="h-14 rounded-xl bg-slate-200/60" />
                          <div className="h-14 rounded-xl bg-slate-200/60" />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
            ) : null}
            <DaySwipeCarouselTrack
                enabled={daySwipeCarouselEnabled}
                trackTouchLock={
                  daySwipeLocksVerticalScroll ||
                  Math.abs(daySwipePullX) > 0 ||
                  daySwipeTransition
                }
                trackStyle={
                  !prefersReducedMotion
                    ? {
                        transform:
                            daySwipeViewportWidthPx > 0
                              ? `translate3d(${-daySwipeViewportWidthPx + daySwipePullX}px, 0, 0)`
                              : `translate3d(calc(-100% / 3 + ${daySwipePullX}px), 0, 0)`,
                        transition: daySwipeTransition
                          ? `transform ${DAY_SWIPE_CAROUSEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                          : "none",
                        willChange:
                          daySwipePullX !== 0 || daySwipeTransition ? "transform" : "auto",
                      }
                    : undefined
                }
                surfaceClassName={[
                  "space-y-4 transition-[opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  showDayPlanContent
                    ? "opacity-100 translate-y-0 scale-100 blur-0"
                    : "pointer-events-none opacity-0 translate-y-1 scale-[0.998] blur-[2px]",
                ].join(" ")}
                surfaceStyle={
                  !prefersReducedMotion && daySwipeCarouselEnabled
                    ? {
                        transformOrigin: "center top",
                        transition: daySwipeTransition
                          ? "opacity 0.22s ease-out"
                          : "none",
                      }
                    : undefined
                }
                prevSlot={
                  <section aria-hidden className={UI_CANVAS_PEEK}>
                    <div className="px-4 py-4" style={{ background: MAIN_DATE_CANVAS_BACKGROUND }}>
                      <AdjacentDayStaticColumn
                          plan={peekPrevPlan}
                          displayRows={peekPrevDisplayRows}
                          activeChapterIdx={mainActiveChapterIdx}
                          daySwipePullX={daySwipePullX}
                          prefersReducedMotion={prefersReducedMotion}
                          peekYmd={peekPrevYmd}
                          mainChapterParallaxYs={mainChapterParallaxYs}
                      />
                    </div>
                  </section>
                }
                nextSlot={
                  <section aria-hidden className={UI_CANVAS_PEEK}>
                    <div className="px-4 py-4" style={{ background: MAIN_DATE_CANVAS_BACKGROUND }}>
                      <AdjacentDayStaticColumn
                          plan={peekNextPlan}
                          displayRows={peekNextDisplayRows}
                          activeChapterIdx={mainActiveChapterIdx}
                          daySwipePullX={daySwipePullX}
                          prefersReducedMotion={prefersReducedMotion}
                          peekYmd={peekNextYmd}
                          mainChapterParallaxYs={mainChapterParallaxYs}
                      />
                    </div>
                  </section>
                }
            >
              <section
                  aria-label="오늘 기록"
                  className={[UI_CANVAS, "max-h-none relative"].join(" ")}
              >
                {showDateTransitionOverlay ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                        aria-label="하루 불러오는 중"
                        className={[
                          "pointer-events-auto absolute inset-0 z-[50] flex flex-col items-center justify-center gap-2 rounded-3xl",
                          "bg-white/50 backdrop-blur-[3px]",
                        ].join(" ")}
                    >
                      {!prefersReducedMotion ? (
                          <div
                              className="h-9 w-9 shrink-0 rounded-full border-2 border-orange-200/90 border-t-orange-600 motion-safe:animate-spin"
                              aria-hidden
                          />
                      ) : (
                          <div
                              className="h-2 w-2 shrink-0 rounded-full bg-orange-500/80"
                              aria-hidden
                          />
                      )}
                      <span className="text-[12px] font-medium text-stone-500">하루 불러오는 중…</span>
                    </div>
                ) : null}
                <div className="px-4 py-4" style={{ background: MAIN_DATE_CANVAS_BACKGROUND }}>
                  <div className="relative z-[41] pointer-events-auto">
                    <div
                        className={[
                          "group relative mb-3.5 overflow-hidden rounded-3xl border border-white/65 bg-white/55 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-xl",
                          "transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          isDatePickerOpen
                            ? "shadow-[0_18px_44px_-22px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]"
                            : "hover:border-white/75 hover:shadow-[0_14px_36px_-20px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.88)]",
                          isDateTransitionLoading && !showDateTransitionOverlay ? "opacity-60" : "",
                        ].join(" ")}
                    >
                      {/* 성능 우선: 열림 시 대면적 sheen 애니메이션 제거 */}
                      <div className="relative z-10 flex w-full items-start gap-1.5 px-4 py-2">
                        {isDatePickerOpen ? (
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <div className="relative min-h-0 min-w-0 flex-1">
                                <button
                                    type="button"
                                    disabled={isDateTransitionLoading}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      closeInlineCalendar();
                                    }}
                                    className={[
                                      "block w-full bg-transparent text-left",
                                      "transition-[transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500/30",
                                      "active:scale-[0.992]",
                                      isDateTransitionLoading ? "cursor-wait" : "",
                                    ].join(" ")}
                                    aria-label={`날짜 패널 접기 — ${selectedDateLabel}`}
                                >
                                  <p className="text-[9px] font-semibold tracking-[0.18em] text-orange-700/80">
                                    {selectedDateDisplay.weekday.toUpperCase()}
                                  </p>
                                  <div className="mt-1 flex items-end gap-2">
                                    <p className="m-0 leading-none">
                                      <AnimatedDayNumber
                                          value={Number(selectedDateDisplay.day)}
                                          dateKey={selectedDate}
                                          prefersReducedMotion={prefersReducedMotion}
                                          className="font-sans text-[1.875rem] font-light leading-none tracking-[-0.07em] text-stone-900"
                                      />
                                    </p>
                                  </div>
                                </button>
                              </div>
                              <button
                                  type="button"
                                  aria-label={
                                    selectedIsToday
                                      ? "이미 오늘 날짜가 선택되어 있습니다"
                                      : `오늘 날짜로 이동${todayShortLabel ? ` (${todayShortLabel})` : ""}`
                                  }
                                  title={
                                    selectedIsToday
                                      ? "이미 오늘 날짜입니다"
                                      : `오늘로 이동${todayShortLabel ? ` (${todayShortLabel})` : ""}`
                                  }
                                  disabled={isDateTransitionLoading || selectedIsToday}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleGoToday();
                                  }}
                                  className={[
                                    "group mt-[1.05rem] inline-flex shrink-0 items-center gap-2 rounded-full border border-orange-300/45 bg-gradient-to-r from-orange-50/95 to-amber-50/80 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_18px_-12px_rgba(251,146,60,0.35)]",
                                    "transition-[transform,box-shadow,opacity] duration-250 ease-out",
                                    "hover:border-orange-400/55 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_22px_-10px_rgba(251,146,60,0.4)]",
                                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
                                    "active:scale-[0.99]",
                                    isDateTransitionLoading || selectedIsToday ? "cursor-not-allowed opacity-45" : "",
                                  ].join(" ")}
                              >
                                <span className="text-[11px] font-extrabold tracking-tight text-orange-800">
                                  오늘
                                </span>
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 shrink-0 text-orange-700 transition-transform duration-250 ease-out group-hover:translate-x-[1px]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.25"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                  <path d="M5 12h14M13 6l6 6-6 6" />
                                </svg>
                              </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                id="main-date-expand-toggle"
                                aria-expanded={false}
                                aria-controls="main-date-expand-slot"
                                disabled={isDateTransitionLoading}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openInlineCalendar(event);
                                }}
                                className={[
                                  "flex min-w-0 flex-1 cursor-pointer items-start gap-2 bg-transparent text-left",
                                  "transition-[transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500/30",
                                  "active:scale-[0.992]",
                                  isDateTransitionLoading ? "cursor-wait" : "",
                                ].join(" ")}
                                aria-label={`날짜 선택 열기 — ${selectedDateLabel}`}
                            >
                              <div className="relative min-h-0 min-w-0 flex-1">
                                <p
                                    className={[
                                      "text-[9px] font-semibold tracking-[0.18em] text-orange-700/80",
                                      "transition-colors duration-300 ease-out",
                                      "group-hover:text-orange-600",
                                    ].join(" ")}
                                >
                                  {selectedDateDisplay.weekday.toUpperCase()}
                                </p>
                                <div className="mt-1 flex items-end justify-between gap-2">
                                  <p
                                      className={[
                                        "m-0 leading-none",
                                        "transition-[transform,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                                        "group-hover:scale-[1.015] motion-reduce:group-hover:scale-100",
                                      ].join(" ")}
                                  >
                                    <AnimatedDayNumber
                                        value={Number(selectedDateDisplay.day)}
                                        dateKey={selectedDate}
                                        prefersReducedMotion={prefersReducedMotion}
                                        className="font-sans text-[1.875rem] font-light leading-none tracking-[-0.07em] text-stone-900"
                                    />
                                  </p>
                                  <p className="text-[11px] font-semibold tracking-tight text-stone-600 transition-colors duration-300 group-hover:text-stone-700">
                                    {selectedDateDisplay.ym}
                                  </p>
                                </div>
                              </div>
                            </button>
                        )}
                        <button
                            type="button"
                            aria-expanded={isDatePickerOpen}
                            aria-controls="main-date-expand-slot"
                            disabled={isDateTransitionLoading}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (isDatePickerOpen) {
                                closeInlineCalendar();
                              } else {
                                openInlineCalendar(event);
                              }
                            }}
                            className={[
                              "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/55 bg-white/40 text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm",
                              "transition-[transform,background-color,color,box-shadow] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                              "hover:border-orange-200/50 hover:bg-orange-50/50 hover:text-orange-600/90 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_4px_14px_-6px_rgba(251,146,60,0.35)]",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30",
                              "active:scale-[0.95]",
                              !prefersReducedMotion && "hover:-translate-y-px",
                              isDatePickerOpen ? "text-orange-600" : "",
                              isDateTransitionLoading ? "cursor-wait opacity-40" : "",
                            ].join(" ")}
                            aria-label={
                              isDatePickerOpen
                                ? "날짜 패널 접기"
                                : "날짜 패널 펼치기"
                            }
                        >
                          <svg
                              viewBox="0 0 24 24"
                              className={[
                                "h-4 w-4 transition-transform duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                                isDatePickerOpen ? "rotate-180" : "",
                              ].join(" ")}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </div>

                      <div
                          id="main-date-expand-slot"
                          data-testid="inline-calendar-panel"
                          className={[
                            "relative z-10 grid overflow-hidden",
                            !prefersReducedMotion
                              ? "transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]"
                              : "",
                            isDatePickerOpen
                              ? "grid-rows-[1fr] opacity-100"
                              : "pointer-events-none grid-rows-[0fr] opacity-0",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={
                            !prefersReducedMotion
                              ? { transitionDuration: isDatePickerOpen ? "320ms" : "300ms" }
                              : undefined
                          }
                          aria-hidden={!isDatePickerOpen}
                      >
                        <div
                            className={[
                              "mx-4 mb-4 min-h-0 max-h-[min(72vh,560px)] overflow-hidden rounded-2xl border border-white/55 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] will-change-[transform,opacity]",
                              !prefersReducedMotion
                                ? "transition-[transform,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]"
                                : "",
                              isDatePickerOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1.5 scale-[0.985] opacity-0",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={
                              !prefersReducedMotion
                                ? { transitionDuration: isDatePickerOpen ? "380ms" : "340ms" }
                                : undefined
                            }
                            aria-label="날짜 선택 확장 영역"
                        >
                          <div
                              ref={calendarScrollRef}
                              onScroll={handleCalendarScroll}
                              className="min-h-0 max-h-[min(72vh,560px)] overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 scrollbar-none touch-pan-y [-webkit-overflow-scrolling:touch]"
                          >
                            {calendarMonthRange?.length ? (
                                <div className="mx-auto w-full max-w-md min-w-0">
                                  {calendarTopSpacerPx > 0 ? (
                                      <div style={{ height: `${calendarTopSpacerPx}px` }} aria-hidden />
                                  ) : null}
                                  {visibleCalendarMonths.map((ym) => (
                                      <InlineCalendarMonth
                                          key={ym}
                                          ym={ym}
                                          selectedDate={selectedDate}
                                          markedDates={markedDates}
                                          onSelectDate={(ymd) => {
                                            setSelectedDate(ymd);
                                            closeInlineCalendar();
                                          }}
                                      />
                                  ))}
                                  {calendarBottomSpacerPx > 0 ? (
                                      <div style={{ height: `${calendarBottomSpacerPx}px` }} aria-hidden />
                                  ) : null}
                                </div>
                            ) : (
                                <div className="flex min-h-[min(72vh,560px)] items-center justify-center">
                                  <p className="text-sm font-semibold text-stone-500">캘린더를 불러오는 중…</p>
                                </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                        ref={mainChapterScrollRef}
                        onScroll={onMainChapterScroll}
                        className={[
                          // proximity: 터치 관성·가벼운 스크롤에 맞춤 (mandatory+min-h-full+scroll-smooth는 네이티브 스냅과 잘 충돌)
                          "h-[min(calc(100dvh-8.25rem-env(safe-area-inset-bottom)),760px)] snap-y snap-proximity space-y-8 pb-[max(8rem,calc(6rem+env(safe-area-inset-bottom)))] scroll-pb-[max(8rem,calc(6rem+env(safe-area-inset-bottom)))] scrollbar-none",
                          daySwipeLocksVerticalScroll
                            ? "overflow-y-hidden overscroll-y-none touch-none"
                            : "overflow-y-auto overscroll-y-contain",
                        ].join(" ")}
                    >
                      <section
                          aria-label="가장 중요한 3가지"
                          data-main-chapter
                          className="relative min-h-[min(56vh,520px)] snap-start scroll-mt-24"
                      >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
                            style={{
                              background:
                                  "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(251,146,60,0.22), transparent 58%), radial-gradient(ellipse 70% 60% at 70% 40%, rgba(255,255,255,0.55), transparent 62%)",
                              ...(!prefersReducedMotion
                                ? {
                                    transform: `translate3d(0, ${mainChapterParallaxYs[0] ?? 0}px, 0)`,
                                    willChange: "transform",
                                  }
                                : {}),
                            }}
                        />
                        <div
                            className={[
                              "sticky top-2 z-10 mb-2.5 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-2.5 py-1.5",
                              "shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl",
                            ].join(" ")}
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-orange-700/70">CHAPTER 01</p>
                            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">가장 중요한 일</p>
                          </div>
                          <span className="text-[12px] font-semibold text-stone-500">3개</span>
                        </div>
                        <div
                            className={[
                              "overflow-hidden",
                              !prefersReducedMotion && "transition-[max-height,opacity] duration-300 ease-out",
                              mainActiveChapterIdx >= 1
                                ? "pointer-events-none max-h-0 select-none opacity-0"
                                : "max-h-[2000px] opacity-100",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-hidden={mainActiveChapterIdx >= 1}
                        >
                          <div className={UI_CANVAS_INSET}>
                          <div className="divide-y divide-stone-200/35 px-2.5 py-2">
                            {displayImportant3.map((v, idx) => (
                                <div
                                    key={`${selectedDate}-imp-${idx}`}
                                    className="group flex items-center gap-3 rounded-xl px-1 py-2 transition-colors first:pt-0 last:pb-0 focus-within:bg-white/55"
                                >
                                  <span
                                      className={[
                                        UI_PIN_WELL,
                                        !prefersReducedMotion
                                            ? "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:scale-[1.03]"
                                            : "",
                                      ].join(" ")}
                                      aria-hidden
                                  >
                                    <span className="text-[15px] font-semibold tabular-nums leading-none">
                                      {idx + 1}
                                    </span>
                                  </span>
                                  <TextInput
                                      className="min-w-0 flex-1"
                                      inputRef={idx === 0 ? scheduleComposerFirstImportantInputRef : null}
                                      ariaLabel={`가장 중요한 일 ${idx + 1}`}
                                      value={v}
                                      placeholder={`가장 중요한 일 ${idx + 1}`}
                                      disabled={isDatePickerOpen}
                                      inputClassName={[
                                        "!h-10 !min-h-[2.5rem] !rounded-none !border-0 !border-b-0 !bg-transparent !px-0 !py-0 !text-base !leading-[2.5rem] !tracking-[-0.01em] !text-stone-800 !shadow-none !ring-0",
                                        "placeholder:text-stone-400",
                                        "focus:!border-0 focus:!bg-transparent focus:!outline-none focus:!ring-0",
                                        "disabled:!cursor-not-allowed disabled:!bg-transparent disabled:!text-stone-400",
                                      ].join(" ")}
                                      onChange={(next) =>
                                          setImportant3((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = next;
                                            return copy;
                                          })
                                      }
                                  />
                                </div>
                            ))}
                          </div>
                          </div>
                        </div>
                      </section>

                      <section
                          aria-label="브레인 덤프"
                          data-main-chapter
                          className="relative min-h-[min(56vh,520px)] snap-start scroll-mt-24"
                      >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
                            style={{
                              background:
                                  "radial-gradient(ellipse 70% 60% at 40% 30%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(ellipse 70% 60% at 70% 45%, rgba(120,113,108,0.16), transparent 62%)",
                              ...(!prefersReducedMotion
                                ? {
                                    transform: `translate3d(0, ${mainChapterParallaxYs[1] ?? 0}px, 0)`,
                                    willChange: "transform",
                                  }
                                : {}),
                            }}
                        />
                        <div className="sticky top-2 z-10 mb-2.5 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-stone-500/90">CHAPTER 02</p>
                            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">브레인 덤프</p>
                          </div>
                          <span className="text-[12px] font-semibold text-stone-500">메모</span>
                        </div>
                        <div
                            className={[
                              "overflow-hidden",
                              !prefersReducedMotion && "transition-[max-height,opacity] duration-300 ease-out",
                              mainActiveChapterIdx >= 2
                                ? "pointer-events-none max-h-0 select-none opacity-0"
                                : "max-h-[2000px] opacity-100",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-hidden={mainActiveChapterIdx >= 2}
                        >
                          <div className={UI_CANVAS_INSET}>
                            <div className="px-2.5 py-2.5">
                              <textarea
                                  ref={brainDumpTextareaRef}
                                  id="brain_dump"
                                  aria-label="브레인 덤프"
                                  value={displayBrainDump}
                                  disabled={isDatePickerOpen}
                                  onChange={(e) => setBrainDump(e.target.value)}
                                  placeholder="예: 회의 준비, 이메일 확인, 아이디어 메모..."
                                  className={[
                                    "block w-full min-h-[1.75rem] resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-[15px] leading-relaxed tracking-[-0.01em] text-stone-800",
                                    "placeholder:text-stone-400",
                                    "focus:bg-transparent focus:outline-none focus:ring-0",
                                    !prefersReducedMotion
                                        ? "transition-[filter] duration-200 ease-out focus:drop-shadow-[0_8px_20px_rgba(251,146,60,0.12)]"
                                        : "",
                                    "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-stone-400",
                                  ]
                                      .filter(Boolean)
                                      .join(" ")}
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      <section
                          aria-label="일정 목록"
                          data-main-chapter
                          className="relative min-h-[min(56vh,520px)] snap-start scroll-mt-24 scroll-mb-24"
                      >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-36 rounded-[2rem] opacity-70 blur-2xl"
                            style={{
                              background:
                                  "radial-gradient(ellipse 70% 60% at 55% 25%, rgba(251,146,60,0.16), transparent 60%), radial-gradient(ellipse 70% 60% at 20% 55%, rgba(255,255,255,0.55), transparent 62%)",
                              ...(!prefersReducedMotion
                                ? {
                                    transform: `translate3d(0, ${mainChapterParallaxYs[2] ?? 0}px, 0)`,
                                    willChange: "transform",
                                  }
                                : {}),
                            }}
                        />
                        <div className="sticky top-2 z-10 mb-3 flex items-end justify-between rounded-2xl border border-white/60 bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-orange-700/70">CHAPTER 03</p>
                            <p className="mt-1 text-base font-semibold tracking-tight text-stone-800">내용</p>
                          </div>
                        </div>
                        <div
                            className={UI_CANVAS_INSET}
                        >
                          <div className="px-3 pt-3 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))]">
                            {/* 추가된 항목 목록 (전날 자정 넘김 새벽 구간 포함) */}
                            {displayItemsMerged.length > 0 ? (
                                <div className="space-y-2.5">
                                  {displayItemsMerged.map((it) => {
                                    const isCarry = Boolean(it._isCarryover);
                                    const rowKey = isCarry ? `carry_${it._carryFromYmd}_${it.id}` : it.id;
                                    const execSec = isCarry
                                      ? Math.max(0, Math.floor(it._executedMorningSeconds ?? 0))
                                      : getDisplayedExecutionSeconds(it);
                                    const isExecutionSyncing =
                                        !isCarry && executionSync?.itemId === it.id;
                                    const isExecutionRunning =
                                        !isCarry &&
                                        (Boolean(it.executionStartedAt) ||
                                            (activeExecutionItemId === it.id &&
                                                activeExecutionStartedAtMs != null));
                                    return (
                                        <div
                                            key={rowKey}
                                            data-day-swipe-ignore
                                            role={isCarry ? undefined : "button"}
                                            tabIndex={isCarry ? undefined : 0}
                                            aria-busy={isExecutionSyncing}
                                            aria-label={
                                              isExecutionSyncing
                                                ? executionSync.action === "start"
                                                  ? "실행 시작 요청 중"
                                                  : "실행 종료 요청 중"
                                                : undefined
                                            }
                                            onClick={() => {
                                              if (isCarry) return;
                                              if (swipingItemId === it.id && swipeOffsetX !== 0) return;
                                              startEditItem(it);
                                            }}
                                            onKeyDown={(e) => {
                                              if (isCarry) return;
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                startEditItem(it);
                                              }
                                            }}
                                            onTouchStart={!isCarry ? (e) => handleItemTouchStart(it.id, e) : undefined}
                                            onTouchMove={!isCarry ? (e) => handleItemTouchMove(it.id, e) : undefined}
                                            onTouchEnd={
                                              !isCarry
                                                ? (e) => {
                                                    const moved = handleItemTouchEnd(it.id);
                                                    if (moved) {
                                                      preventDefaultIfCancelable(e);
                                                      e.stopPropagation();
                                                    }
                                                  }
                                                : undefined
                                            }
                                            onTouchCancel={!isCarry ? () => handleItemTouchEnd(it.id) : undefined}
                                            className={[
                                              "rounded-2xl px-2.5 py-2.5 outline-none transition-colors",
                                              !prefersReducedMotion
                                                ? "active:scale-[0.99] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                                : "",
                                              isCarry
                                                ? "border border-dashed border-orange-200/80 bg-orange-50/40"
                                                : "cursor-pointer hover:bg-white/60 focus:bg-white/70",
                                            ].join(" ")}
                                            style={
                                              isCarry
                                                ? undefined
                                                : {
                                                    touchAction: "pan-y",
                                                    transform:
                                                        swipingItemId === it.id && swipeOffsetX !== 0
                                                          ? `translateX(${swipeOffsetX}px)`
                                                          : "translateX(0)",
                                                    transition:
                                                        swipingItemId === it.id
                                                          ? "none"
                                                          : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                  }
                                            }
                                        >
                                          <div className="flex items-start gap-2">
                                            <div className="w-min max-w-full shrink-0 whitespace-nowrap select-none text-[13px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                              {isCarry
                                                ? formatCarryOverSegmentForDay(it.endTime)
                                                : it.endTime
                                                  ? formatItemTimeRange(it.startTime || it.time || "09:00", it.endTime)
                                                  : it.startTime || it.time || "09:00"}
                                            </div>
                                            <div className="min-w-0 flex-1 basis-0">
                                              {isExecutionSyncing ? (
                                                  <p className="mb-0.5 text-[11px] font-medium text-slate-500 animate-pulse">
                                                    {executionSync.action === "start"
                                                      ? "실행 시작 요청 중…"
                                                      : "실행 종료 요청 중…"}
                                                  </p>
                                              ) : null}
                                              <div className="whitespace-pre-wrap break-words text-sm leading-snug text-slate-900">
                                                {it.content}
                                              </div>
                                            </div>
                                            {(isCarry ? execSec > 0 : it.done || execSec > 0) ? (
                                                <span
                                                    className={[
                                                      "inline-flex h-5 min-w-[5.25rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                                                      isExecutionRunning
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-slate-100 text-slate-600",
                                                    ].join(" ")}
                                                >
                                                  실행 {formatSecondsToMMSS(execSec)}
                                                </span>
                                            ) : null}
                                          </div>
                                        </div>
                                    );
                                  })}
                                </div>
                            ) : (
                                <EmptyScheduleListBlock variant="interactive" />
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </section>
            </DaySwipeCarouselTrack>
          </div>
            </div>
          </div>
        </div>
        </div>

        {!isDatePickerOpen ? (
            <nav
                className="pointer-events-none fixed inset-x-0 bottom-2 z-40"
                aria-label="하단 메뉴"
            >
              <div
                  className={[
                    "pointer-events-auto mx-auto w-full min-w-0 max-w-md",
                    "px-3 pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom)))]",
                  ].join(" ")}
              >
                <div
                    className={[
                      "grid w-full grid-cols-4 overflow-hidden rounded-3xl border border-stone-200/40 bg-white/60 px-0 pt-2 pb-2",
                      "shadow-[0_14px_44px_-18px_rgba(15,23,42,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/45",
                    ].join(" ")}
                >
                  <button
                      type="button"
                      aria-label="일정 추가"
                      disabled={isDateTransitionLoading}
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        resetEditState();
                        setIsScheduleComposerModalOpen(true);
                      }}
                      className={[
                        "flex min-h-[52px] min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1 py-1.5",
                        "text-orange-600 active:bg-orange-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/25",
                        isDateTransitionLoading ? "cursor-wait opacity-45" : "",
                      ].join(" ")}
                  >
                    <svg
                        aria-hidden="true"
                        className="h-[22px] w-[22px] shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                      <rect x="4" y="5" width="16" height="14" rx="2" />
                      <path d="M4 10h16M9 3v4M15 3v4" />
                      <circle cx="17.5" cy="17.5" r="4.5" fill="currentColor" fillOpacity="0.2" stroke="none" />
                      <path
                          d="M17.5 15.5v4M15.5 17.5h4"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight tracking-wide text-orange-600">
                      일정
                    </span>
                  </button>
                  <button
                      type="button"
                      aria-label="일자별 통계 열기"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        setStatsDayYmd(selectedDate);
                        setIsStatsOpen(true);
                      }}
                      className={[
                        "flex min-h-[52px] min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1 py-1.5",
                        "text-stone-600 active:bg-stone-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20",
                      ].join(" ")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0">
                      <path
                          fill="currentColor"
                          d="M5 19V9h3v10zm5 0V5h3v14zm5 0v-7h3v7z"
                      />
                    </svg>
                    <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight tracking-wide text-stone-500">
                      통계
                    </span>
                  </button>
                  <button
                      type="button"
                      aria-label="일정 리포트 열기"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        setIsReportOpen(true);
                      }}
                      className={[
                        "flex min-h-[52px] min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1 py-1.5",
                        "text-stone-600 active:bg-stone-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20",
                      ].join(" ")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0">
                      <path
                          fill="currentColor"
                          d="M9 3a2 2 0 0 0-2 2H6a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2zm0 2h6v2H9zm-1 6h8v2H8zm0 4h8v2H8z"
                      />
                    </svg>
                    <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight tracking-wide text-stone-500">
                      리포트
                    </span>
                  </button>
                  <button
                      type="button"
                      aria-label="내용별 실행 추이 열기"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        const p = selectedDate.split("-");
                        if (p.length >= 2) {
                          const y = Number(p[0]);
                          const mo = Number(p[1]);
                          if (Number.isFinite(y) && Number.isFinite(mo)) {
                            setTrendYm(`${y}-${String(mo).padStart(2, "0")}`);
                          }
                        }
                        if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
                          setTrendWeekStart(getSundayOfWeekForYmd(selectedDate));
                        }
                        setIsTrendOpen(true);
                      }}
                      className={[
                        "flex min-h-[52px] min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1 py-1.5",
                        "text-stone-600 active:bg-stone-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20",
                      ].join(" ")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0">
                      <path
                          fill="currentColor"
                          d="M4 19h16v2H4zm2-4h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zM6 9h2v4H6zm4-2h2v6h-2zm4-3h2v9h-2zm4 1h2v8h-2z"
                      />
                    </svg>
                    <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight tracking-wide text-stone-500">
                      추이
                    </span>
                  </button>
                </div>
              </div>
            </nav>
        ) : null}

        {isScheduleComposerModalOpen ? (
            <div
                className={modalBackdropClass(
                    scheduleComposerModalAnim.showOverlay,
                    scheduleComposerModalAnim.closing
                )}
                onClick={closeScheduleComposerModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-end justify-center px-0 pb-0 pt-0">
                <section
                    className={modalBottomSheetPanelClass(
                        scheduleComposerModalAnim.showOverlay,
                        scheduleComposerModalAnim.closing,
                        { intensity: "strong" }
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleScheduleComposerTouchStart}
                    onTouchEnd={handleScheduleComposerTouchEnd}
                    onTouchCancel={() => {
                      scheduleComposerSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-700">
                      {editingId ? "일정 수정" : "일정 추가"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                          type="button"
                          onClick={handleApplyAiPlanSuggestion}
                          disabled={isDatePickerOpen || aiPlanSuggestLoading}
                          className={[
                            UI_AI_BUTTON,
                            "h-8 px-2.5 text-[11px]",
                            aiPlanSuggestLoading ? "cursor-wait opacity-70" : "",
                            isDatePickerOpen ? "cursor-not-allowed opacity-45" : "",
                          ].join(" ")}
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3 shrink-0">
                          <path
                              fill="currentColor"
                              d="M9 3h6v2l-1.3 2.2A5.5 5.5 0 1 1 7 12.5c0-1.2.4-2.3 1.1-3.2L9 7V3Zm2 2v2.55l-1.35 2.28A3.5 3.5 0 1 0 14.5 12.5c0-.76-.24-1.46-.65-2.03L12.5 8.2V5H11Zm6.2 11.2.8-1.7 1.7-.8-1.7-.8-.8-1.7-.8 1.7-1.7.8 1.7.8.8 1.7Z"
                          />
                        </svg>
                        {aiPlanSuggestLoading ? "AI…" : "AI 초안"}
                      </button>
                      <button
                          type="button"
                          aria-label="일정 입력 닫기"
                          onClick={closeScheduleComposerModal}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div
                      ref={scheduleComposerScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-4 pb-[max(1.5rem,calc(0.75rem+env(safe-area-inset-bottom)))] [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="space-y-4">
                      <section aria-label="가장 중요한 3가지">
                        <div className={UI_SURFACE_P4}>
                          <div className="divide-y divide-stone-200/80">
                            {displayImportant3.map((v, idx) => (
                                <div
                                    key={`${selectedDate}-composer-imp-${idx}`}
                                    className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                                >
                                  <span className={UI_PIN_WELL} aria-hidden>
                                    <span className="text-[15px] font-semibold tabular-nums leading-none">
                                      {idx + 1}
                                    </span>
                                  </span>
                                  <TextInput
                                      className="min-w-0 flex-1"
                                      ariaLabel={`가장 중요한 일 ${idx + 1}`}
                                      value={v}
                                      placeholder={`가장 중요한 일 ${idx + 1}`}
                                      disabled={isDatePickerOpen}
                                      inputClassName={[
                                        "!h-10 !min-h-[2.5rem] !rounded-none !border-0 !border-b-0 !bg-transparent !px-0 !py-0 !text-base !leading-[2.5rem] !tracking-[-0.01em] !text-stone-800 !shadow-none !ring-0",
                                        "placeholder:text-stone-400",
                                        "focus:!border-0 focus:!bg-transparent focus:!outline-none focus:!ring-0",
                                        "disabled:!cursor-not-allowed disabled:!bg-transparent disabled:!text-stone-400",
                                      ].join(" ")}
                                      onChange={(next) =>
                                          setImportant3((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = next;
                                            return copy;
                                          })
                                      }
                                  />
                                </div>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section aria-label="브레인 덤프">
                        <div className={UI_SURFACE_P4}>
                          <textarea
                              ref={composerBrainDumpRef}
                              id="brain_dump_schedule_modal"
                              aria-label="브레인 덤프"
                              value={displayBrainDump}
                              disabled={isDatePickerOpen}
                              onChange={(e) => setBrainDump(e.target.value)}
                              placeholder="예: 회의 준비, 이메일 확인, 아이디어 메모..."
                              className={[
                                "block w-full min-h-[1.75rem] resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-base leading-relaxed tracking-[-0.01em] text-stone-800",
                                "placeholder:text-stone-400",
                                "focus:bg-transparent focus:outline-none focus:ring-0",
                                "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-stone-400",
                              ]
                                  .filter(Boolean)
                                  .join(" ")}
                          />
                        </div>
                      </section>

                      <div data-day-swipe-ignore className="min-w-0 w-full">
                        <TimeRangeSelectors
                            startTime={newStartTime}
                            endTime={newEndTime}
                            onChangeStartTime={setNewStartTime}
                            onChangeEndTime={setNewEndTime}
                            disabled={isDatePickerOpen}
                        />
                      </div>
                      {aiPlanSuggestError ? (
                          <p className="text-[12px] text-rose-600">{aiPlanSuggestError}</p>
                      ) : null}
                      <section aria-label="일정 내용 입력">
                        <div className={UI_SURFACE_P4}>
                          <div className="flex items-stretch gap-2.5">
                            <div className="min-w-0 flex-1">
                              <ComposerContentInput
                                  value={newContent}
                                  placeholder="예: 고객 피드백 정리"
                                  disabled={isDatePickerOpen}
                                  onChange={setNewContent}
                                  inputClassName={[
                                    "!border-0 rounded-xl !bg-stone-100/70 px-3.5 py-3 text-base leading-relaxed tracking-[-0.01em] text-stone-800",
                                    "min-h-[40px]",
                                    "placeholder:text-stone-400",
                                    "focus:!bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/12",
                                    "disabled:!bg-stone-200/40 disabled:text-stone-400",
                                  ].join(" ")}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                  type="button"
                                  aria-label="반복 내용 관리 열기"
                                  disabled={isDatePickerOpen}
                                  onClick={() => {
                                    setIsDatePickerOpen(false);
                                    setIsTemplatesOpen(true);
                                  }}
                                  className={[
                                    "flex h-10 w-10 select-none items-center justify-center rounded-xl border border-white/60 bg-white/55 p-0",
                                    "text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60",
                                    "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                                    "disabled:cursor-not-allowed disabled:opacity-40",
                                  ].join(" ")}
                              >
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="block h-[18px] w-[18px] shrink-0 translate-y-px"
                                >
                                  <path
                                      fill="currentColor"
                                      d="M4 7.5C4 6.67 4.67 6 5.5 6h8C14.33 6 15 6.67 15 7.5v8c0 .83-.67 1.5-1.5 1.5h-8C4.67 17 4 16.33 4 15.5zm5-3C9 3.67 9.67 3 10.5 3h8c.83 0 1.5.67 1.5 1.5v8c0 .83-.67 1.5-1.5 1.5H17v-6.5C17 5.57 15.43 4 13.5 4H9z"
                                  />
                                </svg>
                              </button>
                              <div className="w-[44px] shrink-0">
                                {editingId ? (
                                    isEditingChanged ? (
                                        <button
                                            type="button"
                                            aria-label="저장"
                                            disabled={!canAdd}
                                            onClick={saveEditItem}
                                            className={[
                                              "h-10 w-full select-none rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none",
                                              "text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60",
                                              "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                                              "disabled:cursor-not-allowed disabled:opacity-40",
                                            ].join(" ")}
                                        >
                                          ✓
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label="취소"
                                            onClick={closeScheduleComposerModal}
                                            className={[
                                              "h-10 w-full select-none rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none",
                                              "text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60",
                                              "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                                            ].join(" ")}
                                        >
                                          ✕
                                        </button>
                                    )
                                ) : (
                                    <button
                                        type="button"
                                        aria-label="추가"
                                        disabled={!canAdd}
                                        onClick={addItem}
                                        className={[
                                          "h-10 w-full select-none rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none",
                                          "text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60",
                                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                                          "disabled:cursor-not-allowed disabled:opacity-40",
                                        ].join(" ")}
                                    >
                                      +
                                    </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isTemplatesOpen ? (
            <div
                className={modalBackdropClass(templatesModalAnim.showOverlay, templatesModalAnim.closing)}
                onClick={closeTemplatesModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(templatesModalAnim.showOverlay, templatesModalAnim.closing)}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleTemplatesModalTouchStart}
                    onTouchEnd={handleTemplatesModalTouchEnd}
                    onTouchCancel={() => {
                      statsSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-700">반복 내용</p>
                      <p className="mt-0.5 text-[12px] text-slate-400">자주 쓰는 타임블록 내용을 저장해두고 빠르게 불러오세요</p>
                    </div>
                    <button
                        type="button"
                        aria-label="반복 내용 모달 닫기"
                        onClick={closeTemplatesModal}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                    >
                      ✕
                    </button>
                  </div>

                  <div
                      ref={templatesScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="space-y-5">
                      <section>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <ComposerContentInput
                                  value={templateDraftContent}
                                  placeholder="예: 데일리 체크인, 메일 확인, 운동"
                                  onChange={setTemplateDraftContent}
                              />
                            </div>
                            <div className="w-[56px]">
                              {editingTemplateId ? (
                                  isEditingTemplateChanged ? (
                                      <button
                                          type="button"
                                          aria-label="저장"
                                          disabled={!templateDraftCanSave}
                                          onClick={saveRepeatingTemplate}
                                          className={[
                                            "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                                            "text-orange-700 active:opacity-60",
                                            "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                                            "disabled:cursor-not-allowed disabled:opacity-40",
                                          ].join(" ")}
                                      >
                                        ✓
                                      </button>
                                  ) : (
                                      <button
                                          type="button"
                                          aria-label="취소"
                                          onClick={resetTemplateDraft}
                                          className={[
                                            "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                                            "text-orange-700 active:opacity-60",
                                            "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                                          ].join(" ")}
                                      >
                                        ✕
                                      </button>
                                  )
                              ) : (
                                  <button
                                      type="button"
                                      aria-label="추가"
                                      disabled={!templateDraftCanSave}
                                      onClick={saveRepeatingTemplate}
                                      className={[
                                        "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                                        "text-orange-700 active:opacity-60",
                                        "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                                        "disabled:cursor-not-allowed disabled:opacity-40",
                                      ].join(" ")}
                                  >
                                    +
                                  </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[13px] font-semibold text-slate-500">저장된 반복 내용</h3>
                          <span className="text-[11px] text-slate-400">{repeatingTemplates.length}개</span>
                        </div>

                        {isTemplatesLoading ? (
                            <div className="mt-4 space-y-3">
                              {Array.from({ length: 4 }).map((_, idx) => (
                                  <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                              ))}
                            </div>
                        ) : repeatingTemplates.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {repeatingTemplates.map((template) => (
                                  <div
                                      key={template.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        if (Date.now() < suppressTemplateItemClickUntilRef.current) return;
                                        startEditingTemplate(template);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          startEditingTemplate(template);
                                        }
                                      }}
                                      onTouchStart={(e) => handleTemplateTouchStart(template.id, e)}
                                      onTouchMove={(e) => handleTemplateTouchMove(template.id, e)}
                                      onTouchEnd={(e) => {
                                        const moved = handleTemplateTouchEnd(template.id);
                                        if (moved) {
                                          preventDefaultIfCancelable(e);
                                          e.stopPropagation();
                                        }
                                      }}
                                      onTouchCancel={() => {
                                        templateSwipeRef.current = {
                                          templateId: null,
                                          startX: 0,
                                          startY: 0,
                                          dragging: false,
                                          horizontalLocked: false,
                                          didMove: false,
                                          offsetX: 0,
                                        };
                                        setSwipingTemplateId(null);
                                        setTemplateSwipeOffsetX(0);
                                      }}
                                      className={[
                                        "cursor-pointer rounded-md px-1 py-1 outline-none transition-colors",
                                        "hover:bg-black/[0.02] focus:bg-black/[0.04]",
                                      ].join(" ")}
                                      style={{
                                        touchAction: "pan-y",
                                        transform:
                                            swipingTemplateId === template.id && templateSwipeOffsetX !== 0
                                                ? `translateX(${templateSwipeOffsetX}px)`
                                                : "translateX(0)",
                                        transition:
                                            swipingTemplateId === template.id
                                                ? "none"
                                                : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                                      }}
                                  >
                                        <div className="flex items-start gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                                              {template.content}
                                            </div>
                                          </div>
                                        </div>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-slate-400">아직 저장된 반복 내용이 없습니다.</p>
                        )}
                      </section>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isStatsOpen ? (
            <div
                className={modalBackdropClass(statsModalAnim.showOverlay, statsModalAnim.closing)}
                onClick={closeStatsModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(statsModalAnim.showOverlay, statsModalAnim.closing, {
                      surface: "white",
                    })}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleStatsTouchStart}
                    onTouchEnd={handleStatsTouchEnd}
                    onTouchCancel={() => {
                      statsSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/60 bg-white/40 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-stone-800">{statsDayLabel}</p>
                      <p className="mt-0.5 text-[12px] text-stone-500">계획(종료−시작) 대비 실행 시간 달성률</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                          type="button"
                          onClick={handleLoadAiDayFeedback}
                          disabled={dailyStats.loading || aiDayFeedbackLoading}
                          className={[
                            UI_AI_BUTTON,
                            "h-8 px-2.5 text-[11px]",
                            aiDayFeedbackLoading ? "cursor-wait opacity-70" : "",
                          ].join(" ")}
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3 shrink-0">
                          <path
                              fill="currentColor"
                              d="M9 3h6v2l-1.3 2.2A5.5 5.5 0 1 1 7 12.5c0-1.2.4-2.3 1.1-3.2L9 7V3Zm2 2v2.55l-1.35 2.28A3.5 3.5 0 1 0 14.5 12.5c0-.76-.24-1.46-.65-2.03L12.5 8.2V5H11Zm6.2 11.2.8-1.7 1.7-.8-1.7-.8-.8-1.7-.8 1.7-1.7.8 1.7.8.8 1.7Z"
                          />
                        </svg>
                        {aiDayFeedbackLoading ? "AI…" : "AI 피드백"}
                      </button>
                      <button
                          type="button"
                          aria-label="이전 날"
                          onClick={() => setStatsDayYmd((prev) => addDaysToYmd(prev, -1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                      >
                        ‹
                      </button>
                      <button
                          type="button"
                          aria-label="다음 날"
                          onClick={() => setStatsDayYmd((prev) => addDaysToYmd(prev, 1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                      >
                        ›
                      </button>
                      <button
                          type="button"
                          aria-label="통계 닫기"
                          onClick={closeStatsModal}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div
                      ref={statsScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="space-y-5">
                      {aiDayFeedbackError ? (
                          <p className="text-[12px] text-rose-600">{aiDayFeedbackError}</p>
                      ) : null}
                      {aiDayFeedback ? (
                          <div className={UI_SURFACE_PX4}>
                            <p className="text-[12px] font-semibold text-stone-700">AI 피드백</p>
                            {aiFeedbackTypedSummary ? (
                                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-stone-700">
                                  {aiFeedbackTypedSummary}
                                  {!aiFeedbackListsVisible ? <span className="ml-0.5 inline-block animate-pulse">|</span> : null}
                                </p>
                            ) : null}
                            {aiFeedbackListsVisible &&
                            Array.isArray(aiDayFeedback.strengths) &&
                            aiDayFeedback.strengths.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-[12px] text-stone-700">
                                  {aiDayFeedback.strengths.map((line, idx) => (
                                      <li key={`ai_strength_${idx}`}>- 강점: {line}</li>
                                  ))}
                                </ul>
                            ) : null}
                            {aiFeedbackListsVisible &&
                            Array.isArray(aiDayFeedback.risks) &&
                            aiDayFeedback.risks.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-[12px] text-stone-700">
                                  {aiDayFeedback.risks.map((line, idx) => (
                                      <li key={`ai_risk_${idx}`}>- 리스크: {line}</li>
                                  ))}
                                </ul>
                            ) : null}
                            {aiFeedbackListsVisible &&
                            Array.isArray(aiDayFeedback.actions) &&
                            aiDayFeedback.actions.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-[12px] text-stone-700">
                                  {aiDayFeedback.actions.map((line, idx) => (
                                      <li key={`ai_action_${idx}`}>- 액션: {line}</li>
                                  ))}
                                </ul>
                            ) : null}
                          </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-3">
                        <div className={UI_SURFACE_PX4}>
                          <p className="text-[12px] font-medium text-slate-500">계획 시간 합</p>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-slate-900">
                            {dailyStats.loading
                              ? "…"
                              : formatSecondsAsDurationKo(dailyStats.totalPlannedSeconds)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            종료 시간이 있는 일정만 합산합니다. 자정을 넘기는 일정은 그날 24:00 이전 구간만 포함하고, 다음날 새벽은 해당 날짜 통계에 포함됩니다.
                          </p>
                        </div>
                        <div
                            className={[
                              UI_SURFACE_PX4,
                              "ring-1 ring-stone-200/60",
                            ].join(" ")}
                        >
                          <p className="text-[12px] font-medium text-stone-700">실행 기록 합</p>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-stone-800">
                            {dailyStats.loading
                              ? "…"
                              : formatSecondsAsDurationKo(dailyStats.totalExecutedSeconds)}
                          </p>
                          <p className="mt-1 text-[11px] text-stone-500">스와이프로 누적한 실행 시간</p>
                        </div>
                      </div>

                      <div className={UI_SURFACE_PX4}>
                        <p className="text-[12px] font-medium text-slate-600">계획되지 않은 시간 비중</p>
                        <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-slate-900">
                          {dailyStats.loading
                              ? "…"
                              : `${dailyStats.unplannedDayPercent.toFixed(1)}%`}
                        </p>
                        <p className="mt-1 text-[13px] text-slate-700">
                          {dailyStats.loading ? "…" : formatSecondsAsDurationKo(dailyStats.unplannedSeconds)}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">
                          00:00~24:00 중 일정(시작~종료)으로 덮이지 않은 비율입니다. 겹치는 일정은 한 번만 계산합니다. 당일에 시작한 자정 넘김 일정은 그날 자정까지만 반영하고, 전날에 시작해 오늘 새벽까지 이어지는 구간(예: 수면)은 오늘 00:00~종료까지 포함합니다.
                        </p>
                      </div>

                      <div className={UI_SURFACE_PX4}>
                        <p className="text-[12px] font-medium text-slate-500">이 날짜 하루 달성률</p>
                        <p className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-0.04em] text-slate-900">
                          {dailyStats.loading
                              ? "…"
                              : dailyStats.dayAchievementPercent != null
                                ? `${dailyStats.dayAchievementPercent.toFixed(1)}%`
                                : "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          종료 시간이 있는 항목만, 실행 ÷ 계획 시간으로 가중 평균
                        </p>
                      </div>

                      <div className={UI_SURFACE_PX4}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[13px] font-semibold text-slate-500">24시간 대비 계획 비중</h3>
                          <span className="text-[11px] text-slate-400">하루 86400초 기준</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">
                          시작·종료로 잡힌 계획 시간이 전체 하루에서 차지하는 비율입니다. 시간대가 겹치면 막대가 겹쳐 보일 수 있고, 비중 합계가 100%를 넘을 수 있습니다.
                        </p>

                        {dailyStats.loading ? (
                            <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
                        ) : (() => {
                          const planRows = dailyStats.items.filter(
                              (r) => r.plannedSeconds != null && r.plannedSeconds > 0
                          );
                          return planRows.length > 0 ? (
                              <>
                                <div className="relative mt-4 h-16 w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                                  {[0, 6, 12, 18].map((h) => (
                                      <div
                                          key={`tick_${h}`}
                                          className="pointer-events-none absolute bottom-0 top-0 z-0 border-l border-slate-200/90"
                                          style={{ left: `${(h / 24) * 100}%` }}
                                          aria-hidden
                                      />
                                  ))}
                                  {planRows.map((row, idx) => {
                                    const leftPct = (row.startSecondsFromMidnight / SECONDS_PER_DAY) * 100;
                                    const widthPct = (row.plannedSeconds / SECONDS_PER_DAY) * 100;
                                    const w = Math.max(widthPct, 0.2);
                                    return (
                                        <div
                                            key={`tl_${row.id}`}
                                            className={[
                                              "absolute bottom-2 top-2 z-[1] min-h-[28px] rounded-sm ring-1 ring-white/50",
                                              DAY_TIMELINE_PALETTE[idx % DAY_TIMELINE_PALETTE.length],
                                            ].join(" ")}
                                            style={{
                                              left: `${leftPct}%`,
                                              width: `${Math.min(100 - leftPct, w)}%`,
                                            }}
                                            title={`${row.content}\n${formatItemTimeRange(row.startTime, row.endTime)}\n하루의 ${row.daySharePercent?.toFixed(1)}%`}
                                        />
                                    );
                                  })}
                                </div>
                                <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-slate-400">
                                  <span>0:00</span>
                                  <span>6:00</span>
                                  <span>12:00</span>
                                  <span>18:00</span>
                                  <span>24:00</span>
                                </div>
                                <ul className="mt-4 space-y-2.5">
                                  {planRows.map((row, idx) => (
                                      <li key={`dsp_${row.id}`} className="flex items-start gap-2 text-sm">
                                        <span
                                            className={[
                                              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm",
                                              DAY_TIMELINE_PALETTE[idx % DAY_TIMELINE_PALETTE.length].replace(
                                                  "/85",
                                                  ""
                                              ),
                                            ].join(" ")}
                                            aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                          {row._carryFromYmd ? (
                                              <p className="mb-0.5 text-[11px] font-medium text-orange-600/90">
                                                전날에서 이어짐
                                              </p>
                                          ) : null}
                                          <p className="font-medium text-slate-900">
                                            {row.daySharePercent != null ? row.daySharePercent.toFixed(1) : "0.0"}%
                                            <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                                              ({formatSecondsAsDurationKo(row.plannedSeconds ?? 0)} / 24시간)
                                            </span>
                                          </p>
                                          <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{row.content}</p>
                                          <p className="mt-0.5 text-[11px] text-slate-400">
                                            {formatItemTimeRange(row.startTime, row.endTime)}
                                          </p>
                                        </div>
                                      </li>
                                  ))}
                                </ul>
                              </>
                          ) : (
                              <p className="mt-4 text-sm text-slate-400">
                                종료 시간이 설정된 일정이 없어 24시간 비중을 계산할 수 없습니다.
                              </p>
                          );
                        })()}
                      </div>

                      <div className={UI_SURFACE_PX4}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[13px] font-semibold text-slate-500">일정별 달성</h3>
                          <span className="text-[11px] text-slate-400">실행 / 계획</span>
                        </div>

                        {dailyStats.loading ? (
                            <div className="mt-4 space-y-4">
                              {Array.from({ length: 4 }).map((_, idx) => (
                                  <div key={idx} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                              ))}
                            </div>
                        ) : dailyStats.items.length > 0 ? (
                            <ul className="mt-4 space-y-4">
                              {dailyStats.items.map((row) => (
                                  <li
                                      key={row.id}
                                      className="rounded-xl bg-[#FAFAFA] px-3 py-3 ring-1 ring-black/[0.04]"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        {row._carryFromYmd ? (
                                            <p className="text-[11px] font-medium text-orange-600/90">
                                              전날({row._carryFromYmd})에서 이어진 새벽 구간
                                            </p>
                                        ) : null}
                                        <p className="text-[12px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                          {row.endTime
                                              ? formatItemTimeRange(row.startTime, row.endTime)
                                              : row.startTime}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-900">{row.content}</p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {row.achievementPercent != null ? (
                                            <span className="text-sm font-semibold tabular-nums text-emerald-700/85">
                                              {row.achievementPercent.toFixed(1)}%
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">비율 없음</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-2 rounded-full bg-emerald-500/85 transition-[width]"
                                            style={{
                                              width:
                                                  row.achievementPercent != null
                                                    ? `${Math.min(100, row.achievementPercent)}%`
                                                    : "0%",
                                            }}
                                        />
                                      </div>
                                      <p className="text-[11px] text-slate-500">
                                        실행 {formatSecondsAsDurationKo(row.executedSeconds)}
                                        {row.plannedSeconds != null && row.plannedSeconds > 0
                                            ? ` · 계획 ${formatSecondsAsDurationKo(row.plannedSeconds)}`
                                            : row.endTime
                                              ? ""
                                              : " · 종료 시간 없음"}
                                      </p>
                                    </div>
                                  </li>
                              ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-slate-400">이 날짜에 일정이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isReportOpen ? (
            <div
                className={modalBackdropClass(reportModalAnim.showOverlay, reportModalAnim.closing)}
                onClick={closeReportModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(reportModalAnim.showOverlay, reportModalAnim.closing)}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleReportTouchStart}
                    onTouchMove={handleReportTouchMove}
                    onTouchEnd={handleReportTouchEnd}
                    onTouchCancel={() => {
                      reportSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                        horizontalLocked: false,
                        moved: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <p
                        className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-700"
                        suppressHydrationWarning
                    >
                      {selectedDateLabel}
                    </p>
                    <button
                        type="button"
                        aria-label="리포트 닫기"
                        onClick={closeReportModal}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                    >
                      ✕
                    </button>
                  </div>

                  <div
                      ref={reportScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-500">가장 중요한 3가지</h3>
                        {filledImportant3.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {filledImportant3.map((v, idx) => (
                                  <li key={`${idx}_${v}`} className="text-sm text-slate-900">
                                    {idx + 1}. {v}
                                  </li>
                              ))}
                            </ul>
                        ) : (
                            <p className="mt-2 text-sm text-slate-400">작성된 항목이 없습니다.</p>
                        )}
                      </div>

                      <div className="h-px w-full bg-black/[0.06]" />

                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-500">브레인 덤프</h3>
                        {displayBrainDump.trim() ? (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">
                              {displayBrainDump.trim()}
                            </p>
                        ) : (
                            <p className="mt-2 text-sm text-slate-400">작성된 내용이 없습니다.</p>
                        )}
                      </div>

                      <div className="h-px w-full bg-black/[0.06]" />

                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-500">시간 + 내용</h3>
                        {displayItemsMerged.length > 0 ? (
                            <div className="mt-2 space-y-2.5">
                              {displayItemsMerged.map((it) => {
                                const isCarry = Boolean(it._isCarryover);
                                const rowKey = isCarry ? `carry_${it._carryFromYmd}_${it.id}` : it.id;
                                return (
                                    <div
                                        key={rowKey}
                                        className={[
                                          "flex items-start gap-3 rounded-md px-2 py-1",
                                          isCarry
                                            ? "border border-dashed border-orange-200/80 bg-orange-50/40"
                                            : "",
                                        ].join(" ")}
                                    >
                                      <div className="w-min max-w-full shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                        {isCarry
                                          ? formatCarryOverSegmentForDay(it.endTime)
                                          : it.endTime
                                            ? formatItemTimeRange(it.startTime || it.time || "09:00", it.endTime)
                                            : it.startTime || it.time || "09:00"}
                                      </div>
                                      <div className="min-w-0 flex-1 basis-0">
                                        <div className="break-words text-sm leading-snug text-slate-900">
                                          {it.content}
                                        </div>
                                      </div>
                                    </div>
                                );
                              })}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-slate-400">추가된 일정이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isTrendOpen ? (
            <div
                className={modalBackdropClass(trendModalAnim.showOverlay, trendModalAnim.closing)}
                onClick={closeTrendModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(trendModalAnim.showOverlay, trendModalAnim.closing)}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleTrendTouchStart}
                    onTouchEnd={handleTrendTouchEnd}
                    onTouchCancel={() => {
                      trendSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/60 bg-white/40 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-stone-800">내용별 실행 추이</p>
                      <p className="mt-0.5 text-[12px] text-stone-500">
                        일정 내용에 키워드가 포함된 항목만, 해당 날짜에 실행된 시간을 합산합니다. 자정 넘김·전날
                        이어짐은 일자별 통계와 동일하게 나눕니다.
                      </p>
                    </div>
                    <button
                        type="button"
                        aria-label="실행 추이 닫기"
                        onClick={closeTrendModal}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                    >
                      ✕
                    </button>
                  </div>

                  <div
                      ref={trendScrollRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="space-y-4">
                      <div className="flex rounded-xl border border-white/60 bg-white/50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                        <button
                            type="button"
                            onClick={() => handleTrendPeriodChange("month")}
                            className={[
                              "min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold",
                              trendPeriod === "month"
                                ? "bg-white text-stone-800 shadow-sm"
                                : "text-stone-500",
                            ].join(" ")}
                        >
                          월
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTrendPeriodChange("week")}
                            className={[
                              "min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold",
                              trendPeriod === "week"
                                ? "bg-white text-stone-800 shadow-sm"
                                : "text-stone-500",
                            ].join(" ")}
                        >
                          주
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            aria-label={trendPeriod === "week" ? "이전 주" : "이전 달"}
                            onClick={() =>
                              trendPeriod === "week" ? shiftTrendWeek(-1) : shiftTrendMonth(-1)
                            }
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                        >
                          ‹
                        </button>
                        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-stone-800">
                          {trendPeriod === "week" ? trendWeekTitle : trendYmTitle}
                        </p>
                        <button
                            type="button"
                            aria-label={trendPeriod === "week" ? "다음 주" : "다음 달"}
                            onClick={() =>
                              trendPeriod === "week" ? shiftTrendWeek(1) : shiftTrendMonth(1)
                            }
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/55 text-[18px] font-semibold leading-none text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] active:opacity-60"
                        >
                          ›
                        </button>
                      </div>

                      <TextInput
                          label="내용 키워드"
                          value={trendKeyword}
                          onChange={setTrendKeyword}
                          placeholder="예: 수면"
                          inputClassName="text-[15px]"
                      />

                      <button
                          type="button"
                          onClick={loadTrendSeries}
                          disabled={trendSeries.loading}
                          className={[
                            "w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm",
                            "active:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
                            trendSeries.loading ? "cursor-wait opacity-70" : "",
                          ].join(" ")}
                      >
                        {trendSeries.loading ? "불러오는 중…" : "보기"}
                      </button>

                      {trendSeries.error ? (
                          <p className="text-sm text-rose-600">{trendSeries.error}</p>
                      ) : null}

                      {!trendSeries.loading && !trendSeries.error && trendSeries.points.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-[13px] font-medium text-stone-600">일별 실행 시간</p>
                            <ExecutionTrendBarChart
                                points={trendSeries.points}
                                formatDuration={formatSecondsAsDurationKo}
                                period={trendPeriod}
                            />
                            <ExecutionTrendDayList
                                points={trendSeries.points}
                                formatDuration={formatSecondsAsDurationKo}
                            />
                          </div>
                      ) : null}

                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

      </main>
  );
}
