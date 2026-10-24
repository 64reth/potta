# Build 003A — composition and HUD

Presentation-only refinement; game configurations, transitions, AI, replay and networking are unchanged.

The desktop layout reserves 280–340px for a readable HUD. The remaining board stage constrains the square board by both its actual width and height using container units. The board is centred with comfortable edge spacing; SVG dimensions follow that square rather than unrestricted viewport scaling.

The shared palette now uses a muted red backdrop (#71373B), black board (#0E1110), warm white text (#F7F3F0), red/green counters (#F0524D / #4AAF73) and muted connection lines (#71877A). Existing Barlow Condensed and DM Sans fonts remain. Counters retain their dimensional treatment, with smaller size-dependent visual diameters and separate hit areas of at least 44px.

The HUD presents current turn/result first, named Red and Green players with text stone counts, phase, contextual guidance and controls. Portrait layouts put compact turn/player information above the complete board and actions below; supporting details remain in the accessible Details panel. Short landscape layouts use a compact, independently scrollable HUD with readable text. Menus and setup share the same red background and dark supporting surfaces.

## Review

- All 18 existing engine/replay/AI/room tests, frontend and Worker TypeScript checks, and production build passed.
- Existing layout checks passed at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 844×390, 390×844, 375×667 and 320×568. They check viewport containment, horizontal overflow, graph/target alignment, unobstructed input, target sizes and desktop HUD width. Counter-size expectations were updated for the intentionally reduced visuals.
- Focused browser gameplay checks passed for all three board sizes, placement, movement, wins/rematch, solo turns, pause/settings and online Five synchronisation/reload/rematch.
- Actual browser screenshots were visually inspected for desktop, portrait and landscape play, menu, setup, online waiting and results. Excess portrait grid stretching and low edge-label placement discovered during review were corrected.

Browser verification used local Chromium and the local Worker runtime. Physical devices and deployed networking were not tested. No strategic analysis, large simulations or deployment were performed.
