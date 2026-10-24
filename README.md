# POTTA · Heritage Games 004

A standalone digital adaptation of the Barbadian board game. Build 003 adds three configurable boards and a LUDI-inspired red, green and charcoal interface across Solo, Local and private Online play. Nothing has been deployed.

## Run locally

Requires Node.js **22.18+** and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL (normally **http://127.0.0.1:5173**). This one command runs the frontend and local Cloudflare Workers/Durable Objects runtime. No Cloudflare login, account, remote binding or deployment is needed. Room storage persists in the ignored `.local/online/` directory.

- **Play Solo:** choose Easy, Normal or Hard. Choose a board and difficulty. You are Red; Green is the computer.
- **Play Local:** two people share the device. Choose a board; Red starts.
- **Play Online:** Create Game, then Share invitation or give a friend the six-character code. Join Game assigns the other seat. For local testing use two browser profiles or isolated browser contexts; two tabs in the same browser share a player identity.
- **Resume Game:** return from the main menu. Online reloads restore automatically using the room URL and this browser's saved identity. An interruption never forfeits a seat.
- **Rematch:** available after a result. Online rematches start when both players request one.

Place your stones in alternating turns, then move one owned stone along a connected edge to an empty intersection. Traditional uses three stones and three in a row; experimental Four uses four stones and three consecutive; experimental Five uses five stones and four consecutive. Only the two full-board diagonals have diagonal edges. Placement wins and draw policies remain explicitly provisional; see [rules](docs/RULES.md).

## Validate and preview

```sh
npm test                 # engine, replay, AI and room protocol tests
npm run check            # frontend and Worker TypeScript
npm run build            # client + Worker bundles; does not deploy
npm run preview          # local production-build preview
```

With the dev server running and Playwright Chromium installed (`npx playwright install chromium`):

```sh
npm run test:build003    # all boards, modes, responsive controls and online recovery
npm run test:browser     # preserved local player loop
npm run test:layout      # nine desktop/tablet/phone sizes and target alignment
npm run test:modes       # AI levels, solo result, two-browser online and recovery
npm run test:runtime     # actual Durable Object authority, auth and deduplication
```

Use `BASE_URL` for a different port and `CHROMIUM_PATH` for an existing Chrome executable. Screenshots go to ignored `artifacts/`. To verify process-restart recovery, run `test:runtime`, stop/restart the same dev server, then run `node tests/runtime.mjs --recover` with the same `BASE_URL`.

## Architecture

- `src/engine/`: configuration-driven board graphs, winning segments, rules, state machine, session events and versioned replay.
- `src/ai/`: deterministic search and a dedicated computation worker.
- `src/ui/board.ts`: shared renderer and controls for all three modes.
- `src/main.ts`: mode selection and session coordination.
- `src/online/`: protocol, saved identities and retrying client.
- `server/`: authoritative room commands and one SQLite-backed Durable Object per room.
- `cloudflare.config.ts`, `vite.config.ts`: typed Cloudflare configuration and local/build integration. Development and production have distinct Worker names; local resources never target remote bindings.

Production output is `dist/client/` plus `dist/potta_online/`. Online requires the Worker and its Durable Object binding; uploading only the static client is insufficient. Deployment remains a separate, explicitly authorised step.

See [online/recovery design](docs/ONLINE.md), [AI design](docs/AI.md), [architecture provenance](docs/ARCHITECTURE.md) and [verification](docs/VERIFICATION.md). See [Build 003 notes](docs/BUILD-003.md) for configuration and review details. There is no matchmaking, account system or tutorial.
