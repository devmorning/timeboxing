import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.css";

export const metadata = {
  title: {
    default: "Timeboxing",
    template: "%s | Timeboxing",
  },
  description: "하루 일정을 시간 단위로 정리하는 타임박싱 앱",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon",
  },
};

// Next.js에서 head의 <meta name="viewport" ...>를 자동 생성합니다.
export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#F2F2F7] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

