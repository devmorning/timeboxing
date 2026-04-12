import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ICON_VERSION = "20260410b";

export const metadata = {
  title: {
    default: "Timeboxing",
    template: "%s | Timeboxing",
  },
  description: "하루 일정을 시간 단위로 정리하는 타임박싱 앱",
  icons: {
    icon: [
      { url: `/icon.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
      { url: `/icon-192?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
    ],
    shortcut: `/icon.svg?v=${ICON_VERSION}`,
    apple: `/apple-icon?v=${ICON_VERSION}`,
  },
};

// Next.js에서 head의 <meta name="viewport" ...>를 자동 생성합니다.
export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  /** PWA·모바일 브라우저 상단 영역 — body `bg-stone-200` 과 동일 */
  themeColor: "#e7e5e4",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <head>
        <link rel="manifest" href={`/manifest.json?v=${ICON_VERSION}`} />
      </head>
      <body
          className={`${notoSansKr.className} min-h-screen bg-stone-200 font-sans text-stone-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

