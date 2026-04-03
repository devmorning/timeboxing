import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // next-pwa는 webpack 설정을 사용하므로 Turbopack 충돌을 피하기 위해 빈 설정을 둔다.
  turbopack: {},
};

export default withPWA({
  // 빌드 시 생성한 sw.js를 public 폴더로 내보낸다.
  dest: "public",
  sw: "sw.js",
  // 테스트에서는 서비스워커 생성/캐싱이 불필요하므로 비활성화
  disable: process.env.NODE_ENV === "test",
})(nextConfig);

