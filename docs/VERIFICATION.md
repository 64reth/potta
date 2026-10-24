# Build 001 verification · 24 October 2026

- TypeScript check, eight engine tests and the production Vite build pass.
- Engine checks cover the sixteen-edge graph, eight winning lines, immutable transitions, placement alternation and phase change, overlap/jump/opponent/out-of-turn rejection, configurable placement wins (including the sixth placement), each winning line, blocked opening with draw/loss/pass, repetition, movement limits, detached recordings and replay event validation.
- Launched the local application and checked HTTP 200. Played sequences through actual browser buttons using Playwright with installed Google Chrome. Verified placement, occupied-point rejection, selection, jumping rejection, opponent-piece rejection, connected movement, turn changes, a movement win, end-of-game input rejection, rematch, restart cancellation/confirmation, instructions, Escape dismissal, keyboard activation and a blocked draw.
- Inspected captured desktop and mobile images. Responsive checks at 320, 390, 768 and 1440 pixels passed without horizontal overflow. Screenshots are generated under `artifacts/` and ignored by Git.
- Browser page errors: none. No deployment or changes to the Studio Kit.

Browser interactions were automated; screenshots were visually inspected. Physical-device touch behavior and historical rule authentication were not tested. The provisional rules are documented in the game instructions and `RULES.md`.


## Build 001A · board dominance and responsive layout

- Removed the large marketing heading and decorative board panel. Board sizing now follows viewport height on desktop and takes 94% of phone viewport width. Player information and actions sit in compact rows below the board.
- Tightened only the SVG presentation viewport and matching DOM projection. Engine graph, lines, rules, session and replay files have no changes.
- Browser gameplay regression passed, including movement wins, blocked draws, rematch, keyboard interaction and instructions. All eight engine tests, TypeScript and the production build passed.
- Measured and visually inspected responsive browser screenshots at 1440×900 and 390×844, plus the enlarged winning state. Automated layout review also covered 1920×1080, 1366×768, 768×1024, 375×667 and 320×568.
- Desktop board canvases measure 478–790 px at the tested heights; phone canvases measure 301–367 px. Phone pieces measure 42–51 px with 54–66 px interaction targets. All nine targets align with SVG points to within 0.5 px and remain unobstructed. Boards are horizontally centered, fully visible in the viewport and produce no horizontal overflow.
- Motion transitions and reduced-motion support are preserved. Screenshots and interaction checks use reduced motion for stable inspection. No deployment.

Reproduce with a running dev server: `npm run test:browser` and `npm run test:layout`. Both accept `BASE_URL` and `CHROMIUM_PATH`.

## Build 002 · game modes and full-screen play

- Fifteen engine, replay, AI and room-protocol tests pass, including canonical network action recordings. Original engine files and their eight tests are unchanged.
- Frontend and Worker TypeScript checks pass. Vite builds both client assets and the production Worker/SQLite namespace configuration. The compiled local production preview also passed the all-mode browser flow. Full dependency audit reported zero vulnerabilities after compatible patched transitive overrides.
- Preserved local browser loop passes: placement, invalid actions, graph-constrained movement, turn ownership, all result controls, blocked draw, instructions and keyboard operation.
- Mode browser review exercises Easy, Normal and Hard, a solo match to completion, solo rematch, private create/join/share, invalid room-code guidance, a full room, two-browser synchronisation, online win and mutually confirmed rematch.
- Recovery review drops an acknowledgement **after** the server accepts a move, then reloads and retries the persisted command: exactly one piece is placed. Both browsers restore their assigned identities and correct turn after refresh. Repeated sync responses preserve the winning-line DOM element and completed-match guidance instead of restarting the animation. Simulated network loss reconnects without terminating the match. Main menu → Resume Game and invitation changes in an already-open tab are covered.
- Actual workerd API tests reject unauthorised, stale and illegal actions, conflicting duplicate payloads, unrelated origins and oversized bodies. Five concurrent copies of one command produce one transition. A real dev-runtime stop/restart preserves both credentials' seats, board, revision and player to act.
- Layout checks cover 1440×900, 1920×1080, 1366×768, 1024×768, 768×1024, 844×390, 390×844, 375×667 and 320×568. Boards remain square, fully visible and free of horizontal overflow. All nine targets align with SVG points within 0.5 px and receive pointer input. Phone boards measure 312–382 px; pieces 44–53 px; touch targets 50–61 px. A 1440×900 desktop now has an 838 px board canvas (Build 001A: 610 px).
- Visually inspected desktop/mobile mode selection, desktop/mobile online movement states, tablet portrait and small-phone play. Fixed portrait auto-margin gaps, misleading online turn tags, rematch waiting guidance and same-tab invitation routing. The desktop information rail now flows and scrolls separately on short screens.

Interactions were automated through actual player controls; screenshots were visually inspected. Physical-device touch and real internet/production Cloudflare operation remain unverified. Online was tested with isolated browser contexts and the local Workers runtime. Hard uses bounded deterministic search rather than a proven exhaustive solution. Provisional placement/draw rules remain unchanged. No deployment or changes to LUDI, Warri or the Studio Kit.
