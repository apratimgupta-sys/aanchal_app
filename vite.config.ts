import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl =
    env.RMC_BACKEND_URL ?? "https://anchal-backend-staging.onrender.com";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/v1/api/anchal"),
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
