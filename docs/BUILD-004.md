# Build 004 — production deployment

Production hostname: https://potta.allencreativetechnologies.uk
Worker: `potta` · Durable Object binding: `ROOMS` → SQLite `PottaRoom`, migration `v1`.

The Cloudflare account and custom-domain deployment pattern were checked against the read-only LUDI and Warri configurations. Potta's independent Worker name and exact custom domain are configured in `vite.config.ts` using constants in `server/config.ts`; the typed `cloudflare.config.ts` mirrors them. Vite emits the bundled Worker and authoritative Wrangler configuration under `dist/potta/`, plus browser assets under `dist/client/`. Wrangler 4.152.0 is pinned as a direct development dependency. No other applications' files, Workers or DNS bindings are part of this deployment.

Before first deployment the account contained no Potta Worker/custom-domain binding, there were no zone Worker routes, and the target hostname returned NXDOMAIN. The configured OAuth identity has Workers, routes, zone-read and certificate permissions. DNS-record listing is outside its scope; no additional credentials or secrets are needed by the application. Wrangler's custom-domain workflow provisions the exact hostname and certificate. Existing unrelated records must not be replaced.

## Runtime and recovery

Online play retains the existing same-origin HTTPS JSON polling protocol (`POST /api/rooms/:code`), not WebSockets; there is no WSS endpoint. One SQLite-backed object per room validates and persists commands before acknowledging them. Browser credentials are saved before joining, hashed server-side, and never placed in links or logs. Revision/match checks and command receipts protect against illegal, stale or duplicate actions. Temporary connection loss does not delete the seat or match. API success responses are `no-store`; no application secrets are baked into browser assets.

Only `/api/*` runs Worker-first. Other URLs use Cloudflare Workers Assets with SPA fallback for refresh/direct links. Entry HTML uses the platform's revalidation default, while Vite-hashed `/assets/*` files receive one-year immutable caching. Static assets include nosniff, frame-denial and referrer headers. Local development has a separate Worker name and `.local/online/` SQLite storage with remote bindings disabled. No production/staging data is shared with other games. Logs and traces remain enabled.

`GET /api/health` is uncached and returns service `potta`, build `004` and the Git SHA embedded by Vite. Compare that SHA with the clean checkout and the deployed Wrangler version annotation. Never deploy from an unrelated or dirty checkout.

## Commands and verification

```sh
npm ci
npm test
npm run build
npm run cf:types       # optional generated binding inspection; ignored build-specific output
npm run deploy:check   # Wrangler validates the built production config without uploading
npm run deploy        # rebuild + Wrangler deployment/custom-domain attachment
```

Use the existing configured Cloudflare credentials. No token belongs in source, command arguments or output. Keep `workers_dev` and version previews disabled for this production Worker.

After deployment:

```sh
BASE_URL=https://potta.allencreativetechnologies.uk npm run test:build003
BASE_URL=https://potta.allencreativetechnologies.uk npm run test:runtime
```

Set `CHROMIUM_PATH` if using an installed Chrome rather than Playwright Chromium. The focused browser flow exercises all three boards, local placement/movement/victory/rematch, solo turns, desktop/mobile composition, and two independent online sessions including active and finished reload plus mutual rematch. Runtime checks exercise the real public authority, illegal/stale actions, concurrent deduplication, origin checks and request-size limits using dedicated test rooms. Saved runtime recovery fixtures contain browser credentials and remain only in ignored `.local/`; do not commit them or print them.

Also inspect live HTTPS assets/font/CSS loading, direct-link navigation, cache headers, layout and a deliberate offline/reconnect cycle. Compare unrelated domain bindings/routes before and after. Record actual deployment/version IDs, commit and successful checks in the delivery report. No strategic analysis, gameplay changes or new production features are part of this build.
