"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      try {
        // next-pwa가 빌드 시 public/sw.js로 생성한다.
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        // 서비스워커 등록 실패는 치명적이지 않다.
        // eslint-disable-next-line no-console
        console.warn("ServiceWorker registration failed:", err);
      }
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

