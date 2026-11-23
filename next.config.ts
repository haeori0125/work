import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모든 화면이 로그인 사용자별 동적 화면이라 Cache Components는 쓰지 않는다.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
