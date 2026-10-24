# Build 003 — playable variants and visual direction

Traditional remains three stones / three in a row. Experimental Four uses four stones / four consecutive; experimental Five uses five stones / five consecutive. The size-matched targets supersede the initial shorter-target experiment. `BOARD_RULES` in `src/engine/boards.ts` keeps stone counts and winning targets independently adjustable without changing the engine. The shared configuration drives placement limits, legal movement, winning segments, rendering, AI and authoritative rooms. No additional diagonal edges or playable line crossings were introduced. Placement wins remain disabled by default; existing repetition, blocked-position and movement-limit policies remain provisional and shared across modes.

The interface adapts LUDI's actual Barlow Condensed / DM Sans typography, tactile buttons, setup hierarchy and contextual mobile controls (reference repository commit `dbf8d50`). Potta uses dominant red actions, supporting green and charcoal surfaces. Fonts are self-hosted with their OFL licences. Board and difficulty selection are combined with mode setup. Gameplay uses a large square board, compact turn/reserve information, contextual selection and result actions, and collapsed supporting information. Pause includes saved progress, reduced motion and instructions. Online waiting includes room identity and invitation sharing.

The existing deterministic engine and room protocol were extended rather than replaced. Engine recordings are version 2; a version 1 Traditional adapter preserves existing saved games/replays. Room creation persists the selected size and joining adopts the host configuration. Rematches retain it. AI uses the same legal actions and bounded search; Traditional budgets are unchanged, while larger boards cap Normal at 600 nodes/depth 2 and Hard at 2,400 nodes/depth 4. These are practical latency budgets, not claims of solved or optimal variant play.

## Verification

- All 18 engine, replay, AI and room tests pass, including new configuration/geometry, placement threshold, movement, winning-target, legacy replay and online rematch coverage.
- Frontend and Worker TypeScript checks and production build pass.
- Focused browser interaction covers all three boards: placement, movement, victory and rematch; a Hard computer turn on each; phone portrait and landscape square-board visibility and touch targets; pause/settings; and two isolated online clients on Five, including synchronisation, active-game reload, completed-game reload and mutual rematch.
- The Traditional browser smoke loop also passes. Screenshots were visually inspected for desktop gameplay, mobile portrait/landscape, menu/setup, pause, waiting and results. Verification uses local Chromium and the local Durable Object runtime, not physical touch devices or deployed internet matches.

No exhaustive analysis, large simulations, new research reports or deployment were performed. Four/Five balance remains experimental and needs human playtesting. There is no claim of exhaustive browser/device or public-network testing.

## Launch

With Node 22.18+ installed, run `npm ci` then `npm run dev`. Open the printed URL. This starts the frontend and local authoritative Worker runtime. To repeat focused browser checks with the server running, use `npm run test:build003`; optionally set `BASE_URL` and `CHROMIUM_PATH`.
