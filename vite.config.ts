import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { compatibilityDate, roomClass, workerName } from "./server/config";
export default defineConfig(({ mode }) => ({
  server: { host: "127.0.0.1" },
  plugins: [
    cloudflare({
      persistState: { path: ".local/online" },
      inspectorPort: false,
      remoteBindings: false,
      config: {
        name: workerName(mode === "production"),
        main: "./server/index.ts",
        compatibility_date: compatibilityDate,
        durable_objects: {
          bindings: [{ name: "ROOMS", class_name: roomClass }],
        },
        migrations: [{ tag: "v1", new_sqlite_classes: [roomClass] }],
        assets: {
          binding: "ASSETS",
          not_found_handling: "single-page-application",
          run_worker_first: ["/api/*"],
        },
        observability: { enabled: true, traces: { enabled: true } },
      },
    }),
  ],
}));
