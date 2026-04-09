"use client";

import { useLayoutEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
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
  const [pop, setPop] = useState(false);
  const rafRef = useRef(0);
  const popTimerRef = useRef(0);
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

    const triggerPop = () => {
      if (!enablePop) return;
      clearTimeout(popTimerRef.current);
      setPop(true);
      popTimerRef.current = window.setTimeout(() => setPop(false), 480);
    };

    if (dateChanged && value === from) {
      setDisplay(value);
      triggerPop();
      return;
    }

    if (value === from) return;

    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const span = Math.abs(value - from);
    const duration = Math.min(580, 165 + span * 32);

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const v = Math.round(from + (value - from) * eased);
      setDisplay(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        lastTargetRef.current = value;
        triggerPop();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(popTimerRef.current);
    };
  }, [value, dateKey, prefersReducedMotion, enablePop]);

  return (
    <span
        className={[
          "inline-block tabular-nums will-change-transform",
          pop && !prefersReducedMotion ? "day-digit-pop" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
    >
      {display}
    </span>
  );
}
