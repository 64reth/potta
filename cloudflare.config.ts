import { bindings, defineConfig, exports } from "cf/config";
import { compatibilityDate, roomClass, workerName } from "./server/config";
export default defineConfig(({ mode }) => {
  const name = workerName(mode === "production");
  return {
    worker: {
      name,
      compatibilityDate,
      entrypoint: "./server/index.ts",
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
      },
      env: {
        ASSETS: bindings.assets(),
        ROOMS: bindings.durableObject({
          worker: name,
          exportName: "PottaRoom",
        }),
      },
      exports: { [roomClass]: exports.durableObject({ storage: "sqlite" }) },
      observability: {
        enabled: true,
        logs: { enabled: true },
        traces: { enabled: true },
        redactQueryString: true,
      },
    },
  };
});
