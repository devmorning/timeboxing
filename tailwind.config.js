import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Tailwind v4에서 색상 유틸이 생성되지 않는 케이스가 있어
    // 기본 테마의 colors 자체를 명시적으로 채웁니다.
    colors,
    extend: {},
  },
  plugins: [],
};

