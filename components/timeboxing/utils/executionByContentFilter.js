import { addDaysToYmd } from "./dateYmd.js";
import { normalizeDayPlan } from "../storage/dayPlan.schema.js";

const SECONDS_PER_DAY = 86400;

function parseHHMMToSecondsFromMidnight(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 3600 + min * 60;
}

function spansMidnight(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return false;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return false;
  return b < a;
}

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

function getPlannedSecondsOnCalendarDay(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return null;
  if (spansMidnight(st, et)) {
    if (a >= SECONDS_PER_DAY) return null;
    return SECONDS_PER_DAY - a;
  }
  if (b <= a) return null;
  return b - a;
}

function getOvernightMorningIntervalOnFollowingDay(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  if (!spansMidnight(st, et)) return null;
  const b = parseHHMMToSecondsFromMidnight(et);
  if (b == null) return null;
  return { start: 0, end: b };
}

function sortItemsByTimeAsc(list) {
  return [...list].sort((a, b) => {
    const aStart = a.startTime || a.time || "09:00";
    const bStart = b.startTime || b.time || "09:00";
    const aEnd = a.endTime || "";
    const bEnd = b.endTime || "";
    const aSpan = spansMidnight(aStart, aEnd);
    const bSpan = spansMidnight(bStart, bEnd);
    if (aSpan !== bSpan) {
      return aSpan ? 1 : -1;
    }
    if (aStart === bStart) {
      return String(a.id).localeCompare(String(b.id));
    }
    return aStart.localeCompare(bStart);
  });
}

/**
 * 일자별 통계와 동일하게, 해당 캘린더일에 속하는 실행 초만 합산한다.
 * - 내용에 filter(부분 문자열, 대소문자 무시)가 포함된 일정만
 */
export function sumExecutedSecondsMatchingContentOnCalendarDay(
  _dateYmd,
  currentPlan,
  previousDayPlan,
  filterRaw
) {
  const filter = (filterRaw || "").trim().toLowerCase();
  if (!filter) return 0;

  const matches = (content) =>
    typeof content === "string" && content.toLowerCase().includes(filter);

  const plan = normalizeDayPlan(currentPlan);
  const prevPlan = normalizeDayPlan(previousDayPlan);

  let sum = 0;

  const rawItems = sortItemsByTimeAsc(plan.items);
  for (const it of rawItems) {
    if (!matches(it.content)) continue;
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
    sum += executedOnDay;
  }

  const prevRaw = sortItemsByTimeAsc(prevPlan.items);
  for (const it of prevRaw) {
    if (!matches(it.content)) continue;
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
    sum += executedMorning;
  }

  return sum;
}

/** `year` 1–9999, `month` 1–12. 해당 월 1일~말일 YYYY-MM-DD 목록 */
export function listYmDaysYmd(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const out = [];
  for (let d = 1; d <= lastDay; d += 1) {
    out.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/**
 * 추이 조회에 필요한 모든 날짜(해당 월 각 일 + 월 1일의 전날) YMD 정렬 목록
 */
export function collectYmdsNeededForMonthTrend(year, month) {
  const days = listYmDaysYmd(year, month);
  if (days.length === 0) return [];
  const set = new Set();
  set.add(addDaysToYmd(days[0], -1));
  for (const ymd of days) {
    set.add(ymd);
  }
  return Array.from(set).sort();
}

/** `weekStartSundayYmd`: 해당 주 일요일. 일~토 7일 YMD */
export function listWeekDaysYmd(weekStartSundayYmd) {
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(addDaysToYmd(weekStartSundayYmd, i));
  }
  return out;
}

/**
 * 주 단위 추이 조회에 필요한 날짜(해당 주 각 일 + 주 일요일의 전날) YMD 정렬 목록
 */
export function collectYmdsNeededForWeekTrend(weekStartSundayYmd) {
  const days = listWeekDaysYmd(weekStartSundayYmd);
  if (days.length === 0) return [];
  const set = new Set();
  set.add(addDaysToYmd(days[0], -1));
  for (const ymd of days) {
    set.add(ymd);
  }
  return Array.from(set).sort();
}
