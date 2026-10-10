import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지 최소화 — node_modules 없이 실행 가능
  output: "standalone",

  // standalone tracing 이 ioredis 의 `built/*.js` 를 누락하는 사고를 막는다.
  // server-only Redis client 라 webpack bundle 대신 외부 require 로 두면
  // nft(node-file-trace) 가 패키지 전체를 통째로 복사한다.
  serverExternalPackages: ["ioredis"],

  // dev: LAN IP(모바일 테스트) + localhost.
  // prod: BETTER_AUTH_URL(이 앱의 공개 주소) 호스트도 허용 — reverse proxy 뒤에서 nginx 가
  //   x-forwarded-host 를 upstream alias 로 잘못 set 할 때 server action 거부
  //   방지. nginx 설정에서 'proxy_set_header X-Forwarded-Host $host;' 명시도
  //   같이 권장.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3100",
        "127.0.0.1:3100",
        "192.168.*.*:3100",
        "10.*.*.*:3100",
        "172.16.*.*:3100",
        ...(process.env.BETTER_AUTH_URL
          ? [new URL(process.env.BETTER_AUTH_URL).host]
          : []),
      ],
    },
  },

  // dev 서버를 LAN 모든 인터페이스에서 받게 — webpack-hmr ws 도 같은 host 로.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
  ],
};

export default nextConfig;
