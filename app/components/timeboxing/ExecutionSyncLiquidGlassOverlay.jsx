"use client";

import { useEffect } from "react";

/**
 * 타이머 시작/중지 API fetch 중 — 전면 리퀴드글래스 스타일로 입력·탭 차단
 */
export default function ExecutionSyncLiquidGlassOverlay({ action }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const label = action === "start" ? "타이머 시작하는 중" : "타이머 멈추는 중";

  return (
    <div
      className="execution-sync-overlay-enter pointer-events-auto fixed inset-0 z-[90] flex touch-none items-center justify-center overflow-hidden overscroll-none"
      style={{ overscrollBehavior: "none" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      onPointerDownCapture={(e) => e.preventDefault()}
      onTouchMoveCapture={(e) => e.preventDefault()}
    >
      {/* 베이스 — 블러 + 은은한 틴트 */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-stone-100/90 via-white/55 to-orange-50/65 backdrop-blur-md backdrop-saturate-150"
        aria-hidden
      />
      <div className="absolute inset-0 bg-stone-900/[0.06]" aria-hidden />

      {/* 떠다니는 리퀴드 볼록(색 번짐) */}
      <div
        className="execution-sync-blob-a pointer-events-none absolute -left-[18%] top-[8%] h-[52vmin] w-[52vmin] rounded-full bg-gradient-to-br from-orange-300/55 to-amber-200/35 blur-3xl"
        aria-hidden
      />
      <div
        className="execution-sync-blob-b pointer-events-none absolute -right-[12%] bottom-[12%] h-[48vmin] w-[48vmin] rounded-full bg-gradient-to-tl from-rose-200/40 to-orange-100/45 blur-3xl"
        aria-hidden
      />
      <div
        className="execution-sync-blob-c pointer-events-none absolute left-[22%] bottom-[-8%] h-[38vmin] w-[38vmin] rounded-full bg-gradient-to-tr from-white/70 to-orange-100/30 blur-2xl"
        aria-hidden
      />
      <div
        className="execution-sync-blob-d pointer-events-none absolute right-[18%] top-[18%] h-[28vmin] w-[28vmin] rounded-full bg-amber-100/50 blur-2xl"
        aria-hidden
      />

      {/* 중앙 글래스 카드 */}
      <div className="execution-sync-card-breathe relative mx-4 w-full max-w-[min(100%,18.5rem)] px-1">
        <div className="relative overflow-hidden rounded-[1.65rem] border border-white/60 bg-white/40 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-[1.35]">
          {/* 빛 스윕 */}
          <div
            className="execution-sync-shimmer pointer-events-none absolute inset-0 opacity-[0.55]"
            aria-hidden
            style={{
              background:
                "linear-gradient(105deg, transparent 36%, rgba(255,255,255,0.72) 50%, transparent 64%)",
            }}
          />
          <div className="relative flex flex-col items-center gap-4 px-7 py-8">
            {/* 스피너 + 스톱워치 */}
            <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center">
              <div
                className="pointer-events-none absolute h-11 w-11 rounded-full border-[2.5px] border-orange-200/75 border-t-orange-600 border-r-orange-500/35 motion-safe:animate-spin"
                aria-hidden
              />
              <svg
                viewBox="0 0 24 24"
                className="relative h-8 w-8 text-orange-800/95"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <circle cx="12" cy="12" r="7.5" />
                <path d="M12 5.5V3" strokeLinecap="round" />
                <g className="execution-sync-hand-tick">
                  <path d="M12 12V8.5" strokeLinecap="round" />
                </g>
                <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <p className="text-center text-[15px] font-semibold tracking-tight text-stone-800">
              {label}
              <span className="ml-0.5 font-bold text-orange-600">…</span>
            </p>
            <p className="text-center text-[12px] leading-snug text-stone-500/95">
              잠시만 기다려 주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
