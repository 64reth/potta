# Build 001 verification · 24 October 2026

- TypeScript check, eight engine tests and the production Vite build pass.
- Engine checks cover the sixteen-edge graph, eight winning lines, immutable transitions, placement alternation and phase change, overlap/jump/opponent/out-of-turn rejection, configurable placement wins (including the sixth placement), each winning line, blocked opening with draw/loss/pass, repetition, movement limits, detached recordings and replay event validation.
- Launched the local application and checked HTTP 200. Played sequences through actual browser buttons using Playwright with installed Google Chrome. Verified placement, occupied-point rejection, selection, jumping rejection, opponent-piece rejection, connected movement, turn changes, a movement win, end-of-game input rejection, rematch, restart cancellation/confirmation, instructions, Escape dismissal, keyboard activation and a blocked draw.
- Inspected captured desktop and mobile images. Responsive checks at 320, 390, 768 and 1440 pixels passed without horizontal overflow. Screenshots are generated under `artifacts/` and ignored by Git.
- Browser page errors: none. No deployment or changes to the Studio Kit.

Browser interactions were automated; screenshots were visually inspected. Physical-device touch behavior and historical rule authentication were not tested. The provisional rules are documented in the game instructions and `RULES.md`.
