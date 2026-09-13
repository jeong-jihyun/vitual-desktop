import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중에는 signaling 서버(기본 8080)로 /api, /ws 요청을 프록시한다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
