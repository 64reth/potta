# POTTA · Heritage Games 004

A standalone local two-player adaptation of the Barbadian board game. Build 001 establishes the nine-point board, deterministic engine and complete placement-to-movement player loop. No backend or deployment is required.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Azure starts. Alternate placing three pieces each, then select a piece and a highlighted neighbouring empty point. Make a row, column or full diagonal during movement to win. Use **Rematch** after a result or **New game** during play.

The active checkout is `/Users/garethwallen/Projects/potta` on this machine. On Windows, clone into `C:\Projects\Potta` and use the same npm commands.

```sh
npm test           # deterministic engine / replay tests
npm run check      # TypeScript
npm run build      # production static output in dist/
npm run preview    # inspect the production build
```

Browser verification requires a running dev server and a Playwright browser:

```sh
npx playwright install chromium
npm run test:browser
npm run test:layout  # viewport sizing, alignment and input visibility
```

Alternatively set `CHROMIUM_PATH` to a locally installed Chrome/Chromium executable. Browser checks save ignored screenshots under `artifacts/`.

## Structure

- `src/engine/geometry.ts`: positions, the sixteen undirected edges and derived adjacency.
- `src/engine/lines.ts`: the eight winning combinations.
- `src/engine/game.ts`: pure initialisation, legal actions, transitions, configurable rules and outcomes.
- `src/engine/session.ts`: detached snapshots, action validation, events, versioned recording and replay.
- `src/main.ts`, `src/ui/style.css`: accessible board controls, scalable SVG connections, animated pieces and responsive presentation. No rule computation lives in the renderer.

See [board and rule decisions](docs/RULES.md), [architecture provenance](docs/ARCHITECTURE.md) and [verification](docs/VERIFICATION.md).

Build 001 intentionally has no AI, tutorial flow, online service or saved-session UI. The engine and recordings preserve clean boundaries for those later additions. Nothing has been deployed.

## Build 001A · board-first layout

The playing surface now uses viewport height on desktop and 94% of screen width on phones, with compact turn information and controls below it. The SVG viewport is cropped to `50 50 500 500`; the renderer projects the unchanged graph into that viewport for both pieces and interaction targets. The game engine, rules and replay format are unchanged.

Responsive verification covers 320×568, 375×667, 390×844, 768×1024, 1366×768, 1440×900 and 1920×1080. Set `BASE_URL` when reviewing a server on a different port (default: `http://127.0.0.1:5173`).
