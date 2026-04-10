import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Tailwind v4에서 색상 유틸이 생성되지 않는 케이스가 있어
    // 기본 테마의 colors 자체를 명시적으로 채웁니다.
    colors,
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
      keyframes: {
        nowSnapWiggle: {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "18%": { transform: "rotate(-14deg) scale(1.12)" },
          "36%": { transform: "rotate(12deg) scale(1.1)" },
          "54%": { transform: "rotate(-7deg) scale(1.05)" },
          "72%": { transform: "rotate(4deg) scale(1.02)" },
        },
        nowToastPop: {
          "0%": { opacity: "0", transform: "translateX(-50%) translateY(10px) scale(0.6) rotate(-6deg)" },
          "22%": { opacity: "1", transform: "translateX(-50%) translateY(-2px) scale(1.08) rotate(2deg)" },
          "40%": { transform: "translateX(-50%) translateY(-6px) scale(1) rotate(0deg)" },
          "65%": { opacity: "1", transform: "translateX(-50%) translateY(-8px) scale(1)" },
          "100%": { opacity: "0", transform: "translateX(-50%) translateY(-22px) scale(0.92)" },
        },
        nowInputGlow: {
          "0%": { boxShadow: "0 0 0 0 rgba(249, 115, 22, 0.55)" },
          "45%": { boxShadow: "0 0 0 4px rgba(249, 115, 22, 0.2)" },
          "100%": { boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)" },
        },
      },
      animation: {
        "now-snap-wiggle": "nowSnapWiggle 0.58s cubic-bezier(0.34, 1.45, 0.64, 1) both",
        "now-toast-pop": "nowToastPop 1.75s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "now-input-glow": "nowInputGlow 0.85s ease-out forwards",
      },
    },
  },
  plugins: [],
};

