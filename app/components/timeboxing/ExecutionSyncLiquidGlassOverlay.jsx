"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 타이머 시작/중지 API fetch 중 — 전면 리퀴드글래스 스타일로 입력·탭 차단 (뷰포트 전체, body 포털)
 */
export default function ExecutionSyncLiquidGlassOverlay({ action }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  const label = action === "start" ? "타이머 시작하는 중" : "타이머 멈추는 중";

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const safePad = [
    "pt-[max(1.25rem,env(safe-area-inset-top))]",
    "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
    "pl-[max(1rem,env(safe-area-inset-left))]",
    "pr-[max(1rem,env(safe-area-inset-right))]",
  ].join(" ");

  return createPortal(
    <div
      className="execution-sync-overlay-enter pointer-events-auto fixed inset-0 z-[100] flex min-h-[100dvh] w-full max-w-none touch-none overflow-hidden overscroll-none"
      style={{ overscrollBehavior: "none" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      onPointerDownCapture={(e) => e.preventDefault()}
      onTouchMoveCapture={(e) => e.preventDefault()}
    >
      {/* 배경 레이어 — 글래스 뒤로 비침 */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-stone-100/90 via-white/55 to-orange-50/65 backdrop-blur-md backdrop-saturate-150"
        aria-hidden
      />
      <div className="absolute inset-0 bg-stone-900/[0.06]" aria-hidden />

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

      {/* 전체 화면 액정커버 느낌 — 리퀴드 글래스 면 */}
      <div className="absolute inset-0 flex min-h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-white/55 bg-white/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-[1.35]">
        <div
          className="execution-sync-shimmer pointer-events-none absolute inset-0 opacity-[0.5]"
          aria-hidden
          style={{
            background:
              "linear-gradient(105deg, transparent 32%, rgba(255,255,255,0.65) 50%, transparent 68%)",
          }}
        />
        <div
          className={`relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 ${safePad}`}
        >
          <div className="execution-sync-card-breathe flex flex-col items-center gap-5">
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
            <p className="text-center text-[16px] font-semibold tracking-tight text-stone-800">
              {label}
              <span className="ml-0.5 font-bold text-orange-600">…</span>
            </p>
            <p className="text-center text-[13px] leading-snug text-stone-500/95">
              잠시만 기다려 주세요
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
