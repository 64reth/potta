# Build 003D — menu scale and navigation

Setup screens now use a responsive content area up to 1100px inside a wider shell. Large desktops receive enlarged board previews/cards, a proportionate display headline, 19px section headings, 18px body text, substantial difficulty cards and 64px primary actions. Laptop-height layouts use tighter spacing while retaining readable controls. Phone layouts stack board and difficulty options as full-width cards and use 60px primary actions; online joining also stacks naturally.

The shared setup header replaces the quiet link with a fully clickable Main Menu button: visible back arrow, 18px desktop / 16px mobile label, at least 48px height, generous padding, a visible border and explicit hover treatment. Existing keyboard focus styling remains. Board cards show their size, stone count and winning alignment directly.

OXBLOOD and JOUVERT tokens, gameplay composition, engine, AI, networking and navigation destinations are unchanged.

## Focused review

Frontend and Worker TypeScript checks and production build passed. Local Chromium review covered Solo, Local and Online setup at 2048×1290, 1440×900, 390×844 and 320×568. Desktop content measured 1100px; Main Menu controls measured 54px high on desktop and 50px on phones. Checks confirmed no horizontal overflow, selected-state updates, difficulty selection, return navigation and starting/placing a stone on a local Five board. Screenshots were visually reviewed for desktop, laptop and mobile composition. Mobile setup pages scroll vertically as needed.

No exhaustive tests, strategic analysis or deployment were performed. Review did not include physical devices or deployed networking.
