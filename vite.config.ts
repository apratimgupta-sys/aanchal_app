import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl =
    env.RMC_BACKEND_URL ?? "https://anchal-backend-staging.onrender.com";
  return {
    plugins: [react()],
    base: "/anchal/",
    // Vite's default target emits media-query range syntax (width>=1024px), which
    // Chrome < 104 and Safari < 16.4 ignore; the whole responsive layout hangs on it.
    build: { target: ["chrome87", "safari14"] },
    server: {
      proxy: {
        "/v1/api/anchal": {
          target: backendUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("origin", backendUrl);
            });
            proxy.on("proxyRes", (proxyRes) => {
              const cookies = proxyRes.headers["set-cookie"];
              if (cookies) {
                proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
                  cookie.replace(
                    /Path=\/v1\/api\/anchal/gi,
                    "Path=/",
                  ),
                );
              }
            });
          },
        },
      },
    },
  };
});
