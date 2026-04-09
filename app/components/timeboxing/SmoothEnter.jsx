"use client";

import { useEffect, useState } from "react";

/**
 * 마운트 시 페이드·슬라이드업 — 날짜 전환·플랜 동기화 후 값이 부드럽게 나타나게 함.
 * staggerMs: 여러 줄을 순차적으로 (1→2→3) 살짝 밀어서 보여 줄 때 사용.
 */
export default function SmoothEnter({
  children,
  prefersReducedMotion = false,
  staggerMs = 0,
  className = "",
}) {
  const [visible, setVisible] = useState(() => prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [prefersReducedMotion]);

  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      <div
          className={[
            "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
          ].join(" ")}
          style={{
            transitionDelay:
              prefersReducedMotion || !visible ? "0ms" : `${staggerMs}ms`,
          }}
      >
        {children}
      </div>
    </div>
  );
}
