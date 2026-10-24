# Build 003E — unified OXBLOOD and readable interface scale

Every screen now uses one OXBLOOD token set: background #30191E, board/elevated surface #76333B, dark grid and panels #20171A, supporting accent #CB8F89, primary action #FA655B and text #FFF1E9. Emerald (#50D58B) and charcoal (#25292B) retain sculpted highlights and defined rims. The gameplay-only JOUVERT override has been removed. Dark grid strokes and socket outlines are slightly stronger; legal destinations and winning lines retain their contrasting highlights.

Counter-face number pseudo-elements have been removed entirely. Named and numbered HUD identities and accessible node labels remain; no piece identifiers or gameplay state changed.

## Layout and typography correction

The previous desktop HUD used a 280–340px column, 19px player names, 14px stone counts and 12px phase labels. Its base column now scales from 380 to 440px, with a separate 340px tablet/laptop-width treatment and existing compact portrait/landscape compositions. Board size continues to follow the actual remaining stage width and height.

The setup's canonical maximum width is 1100px; the obsolete 610px base restriction and redundant earlier mobile setup rules were removed. Desktop sections, descriptions and navigation now use deliberate readable sizes. The heading is capped at 72px rather than allowing a 92px heading to overpower small supporting controls. Welcome-screen descriptions and supporting text were also enlarged. LUDI's existing Barlow Condensed / DM Sans typography is unchanged.

## Rendered review

Actual browser measurements, at normal zoom:

| Element | 2048×1290 | 1440×900 |
| --- | --- | --- |
| Setup content width | 1100px | 1100px |
| Setup heading | 72px | 57.6px |
| Section / card title | 24px / 30px | 24px / 30px |
| Difficulty description | 18px | 18px |
| Main Menu / primary label | 20px / 20px | 20px / 20px |
| HUD width | 440px | 403.2px |
| Turn heading | 48px | 36px |
| Player names / stone counts | 24px / 18px | 24px / 18px |
| Phase / instructions | 20px / 18px | 20px / 18px |

Screenshots of setup, active movement with selected stone/legal destinations, and results were visually inspected at both desktop sizes and 390×844. The full board remained square and within the viewport, without horizontal overflow. On mobile, the board measured 366px square, with compact 25px turn headings and 16px instructions. Computed counter-face pseudo-content was `none`; the clean surfaces were also visually confirmed.

Frontend/Worker TypeScript checks and production build passed. Existing focused browser checks passed across all three board sizes, placement/movement/wins, solo turns, responsive targets, pause/settings, online Five synchronisation/reload and mutual rematch. Engine, board configurations, AI and networking are unchanged. Verification used local Chromium and the local Worker runtime; physical devices and deployed networking were not tested. No exhaustive analysis or deployment was performed.
