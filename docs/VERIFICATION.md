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
