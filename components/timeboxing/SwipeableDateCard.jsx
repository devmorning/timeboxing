"use client";

import { useEffect, useRef } from "react";

function isInteractiveElement(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("button, input, textarea, select, a, [data-no-swipe]")
  );
}

/**
 * iOS Safari용 좌우 스와이프 감지.
 * - 세로 스크롤은 유지(pan-y)
 * - 버튼/입력 위에서는 스와이프 처리하지 않음
 */
export default function SwipeableDateCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
}) {
  const ref = useRef(null);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    ignored: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      gestureRef.current.startX = t.clientX;
      gestureRef.current.startY = t.clientY;
      gestureRef.current.ignored = isInteractiveElement(e.target);
    };

    const handleTouchMove = (e) => {
      if (gestureRef.current.ignored) return;
      // 수직 스크롤을 방해하지 않기 위해 기본 동작을 유지합니다.
      // (여기서 preventDefault를 하지 않음)
    };

    const handleTouchEnd = (e) => {
      if (gestureRef.current.ignored) return;
      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - gestureRef.current.startX;
      const dy = t.clientY - gestureRef.current.startY;

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return (
    <div
      ref={ref}
      style={{ touchAction: "pan-y" }}
      data-no-swipe={undefined}
    >
      {children}
    </div>
  );
}

