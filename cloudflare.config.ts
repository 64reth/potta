import { bindings, defineConfig, exports } from "cf/config";
import { compatibilityDate, roomClass, workerName, productionAccount, productionHostname } from "./server/config";
export default defineConfig(({ mode }) => {
  const name = workerName(mode === "production");
  return {
    ...(mode === "production" ? { accountId: productionAccount } : {}),
    worker: {
      name,
      ...(mode === "production" ? { domains: [productionHostname], workersDev: false, previewUrls: false } : {}),
      compatibilityDate,
      entrypoint: "./server/index.ts",
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
      },
      env: {
        ASSETS: bindings.assets(),
        GIT_COMMIT: bindings.text<string>("development"),
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
