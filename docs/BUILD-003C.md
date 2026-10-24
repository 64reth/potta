# Build 003C — OXBLOOD menus and JOUVERT gameplay

Two coordinated token sets in `src/ui/style.css` theme the existing components without duplicating screens. OXBLOOD is the default for welcome, mode selection, board/difficulty selection and online setup. Entering the playing screen selects JOUVERT for the board, waiting room, HUD, in-game dialogs and results. The application background has a brief colour transition; reduced-motion preferences remain respected.

OXBLOOD uses the approved background #30191E, elevated surfaces #76333B, accents #CB8F89, action red #FA655B, supporting green #42B879, text #FFF1E9 and controls #20171A. JOUVERT uses background #183B30, board #9F373B, connections #E3A8A0, red #FF6657, green #50D58B, text #FFF2DE and panels #111F1A. Sculpted highlights, shading and subdued text derive from those tokens. Bright primary buttons use dark text for readability.

The board has gentle rounding, an inset edge highlight and restrained shading. Existing square containment, desktop HUD widths, portrait/landscape layouts, counter hit areas, typography and navigation remain. HUD counter icons are larger while board counter proportions are preserved. No engine, rule, AI or network code changed.

## Review

Frontend/Worker TypeScript checks and production build passed. The existing focused browser flow passed for all three boards: placement, movement, winning lines and rematch; solo computer turns; portrait/landscape visibility and touch targets; pause/settings; and online Five synchronisation, reload and mutual rematch. Desktop and mobile screenshots were visually inspected for welcome, setup, gameplay, waiting, results and pause. Review used local Chromium and the local Worker runtime, not physical devices or deployed networking.

No exhaustive analysis, large simulations, dependency additions or deployment were performed.
