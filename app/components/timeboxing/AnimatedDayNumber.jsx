"use client";

import { useLayoutEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/** 증가: 빠르게 목표에 붙는 느낌 */
function easeOutQuart(t) {
  return 1 - (1 - t) ** 4;
}

/** 감소: 천천히 출발했다가 빨라지는 느낌(아래로 가속) */
function easeInCubic(t) {
  return t * t * t;
}


/**
 * 날짜가 바뀔 때 일(day) 숫자가 이전 값에서 목표 값으로 짧게 카운트되는 인터랙션.
 * 월만 바뀌고 일이 같을 때는 살짝 ‘팝’만 준다.
 */
export default function AnimatedDayNumber({
  value,
  /** YYYY-MM-DD — 월/년 전환 등 일 숫자는 같을 때도 반응용 */
  dateKey,
  prefersReducedMotion = false,
  className = "",
  enablePop = true,
}) {
  const [display, setDisplay] = useState(value);
  /** 'up' 증가 착지, 'down' 감소 착지, 'pulse' 월만 바뀜 등 */
  const [popVariant, setPopVariant] = useState(null);
  const rafRef = useRef(0);
  const popTimerRef = useRef(0);
  const spanRef = useRef(null);
  const firstRef = useRef(true);
  const lastTargetRef = useRef(value);
  const lastDateKeyRef = useRef(dateKey);

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      lastTargetRef.current = value;
      lastDateKeyRef.current = dateKey;
      return;
    }

    if (firstRef.current) {
      firstRef.current = false;
      setDisplay(value);
      lastTargetRef.current = value;
      lastDateKeyRef.current = dateKey;
      return;
    }

    const from = lastTargetRef.current;
    const dateChanged = dateKey !== lastDateKeyRef.current;
    lastDateKeyRef.current = dateKey;

    const triggerPop = (variant) => {
      if (!enablePop) return;
      clearTimeout(popTimerRef.current);
      setPopVariant(variant);
      popTimerRef.current = window.setTimeout(() => setPopVariant(null), 520);
    };

    if (dateChanged && value === from) {
      setDisplay(value);
      triggerPop("pulse");
      return;
    }

    if (value === from) return;

    cancelAnimationFrame(rafRef.current);
    const increasing = value > from;
    const start = performance.now();
    const span = Math.abs(value - from);
    /** 거리가 멀수록 조금 더 길게 — 증가/감소 모두 체감되도록 */
    const duration = Math.min(640, 185 + span * 36);

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const easedNum = increasing ? easeOutQuart(t) : easeInCubic(t);
      const v = Math.round(from + (value - from) * easedNum);
      setDisplay(v);

      const slideP = easeOutCubic(t);
      const el = spanRef.current;
      if (el) {
        if (increasing) {
          /** 아래(+)에서 올라오며 살짝 커짐 → 증가 */
          const ty = (1 - slideP) * 26;
          const sc = 0.82 + 0.18 * slideP;
          el.style.transform = `translateY(${ty}px) scale(${sc})`;
        } else {
          /** 위(-)에서 내려오며 살짝 커짐 → 감소 */
          const ty = -(1 - slideP) * 26;
          const sc = 0.82 + 0.18 * slideP;
          el.style.transform = `translateY(${ty}px) scale(${sc})`;
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        lastTargetRef.current = value;
        if (el) el.style.transform = "";
        triggerPop(increasing ? "up" : "down");
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(popTimerRef.current);
    };
  }, [value, dateKey, prefersReducedMotion, enablePop]);

  const popClass =
    !prefersReducedMotion && popVariant === "up"
      ? "day-digit-pop-up"
      : !prefersReducedMotion && popVariant === "down"
        ? "day-digit-pop-down"
        : !prefersReducedMotion && popVariant === "pulse"
          ? "day-digit-pop"
          : "";

  return (
    <span
        ref={spanRef}
        className={[
          "inline-block tabular-nums will-change-transform",
          popClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
    >
      {display}
    </span>
  );
}
