# Architecture and provenance

Inspected the existing local checkout of `64reth/solo-game-studio-kit`, commit `f0989e7` (Build 003), especially `packages/core/src/index.ts`, the tabletop player entry, legal actions, action/event recordings and replay. The reference repository was read only and remains unchanged.

`src/engine/session.ts` reuses the reference core supplied by the repository owner for this project. It retains `GameDefinition`, `GameSession`, seeded random injection, snapshot isolation, immutable exported recordings, version compatibility checks and event-checked replay. No teaching game, lab, inspector or developer UI was imported. Potta-specific geometry, rules, appearance and tests are independently defined here. There was no license file in the inspected reference; this provenance note does not assign a new license to the reference code.

The game definition takes a rules configuration and two fixed player IDs (`blue`, `gold`). `initialState`, `legalActions` and `transition` work without a DOM, network, clock or random source. The session validates the acting player and membership in legal actions before recording a transition. State snapshots and recordings are detached copies. Events describe placements, movements, turn changes, passes and results.

Recordings contain game ID, engine version, configuration, roster, seed, actions and expected events. Replay re-runs actions through the same validation and rejects divergent events or incompatible versions. There is no replay or persistence UI in Build 001. Increment the game version when changing transition semantics; do not silently replay old actions under new rules.

The renderer consumes state and legal actions, maintains only transient selection and piece identities for animation, and dispatches engine actions. Selection never changes game state. The SVG connection layer and HTML button targets use the same central coordinates. Piece elements persist through moves so transitions can animate between positions. Buttons have node/occupancy labels, pressed selection state, keyboard interaction and an announced turn/result region. Native modal dialogs handle instructions and destructive restart confirmation; reduced-motion preferences disable animation.

Build 001 established those boundaries; Build 002 now uses them for solo opponents, online authority and session recovery. The original engine, graph, rules and replay semantics remain unchanged. Fonts and pieces still require no external services or asset downloads.

## Build 002 composition

`src/main.ts` coordinates consumer screens and session lifecycle. `src/ui/board.ts` is the shared renderer for every mode; it consumes state/context and sends actions through callbacks. Local and solo games retain `GameSession` and versioned recordings in browser storage. The AI runs in an isolated Web Worker and its selected actions enter the same session dispatch path.

Online identity, pending-command recovery and polling live in `src/online/`; authoritative commands are in `server/room.ts`. `server/index.ts` provides same-origin routing, bounded input, credential hashing and a SQLite-backed Durable Object. Server actions use the original legal-action generator and transitions and produce replay-compatible events. Room commands receive wall-clock time only for advisory presence; game transitions and search have no wall-clock dependency.

The playing screen uses a square board constrained by viewport height/primary column width, with information in a separate desktop rail. Portrait layouts use screen width minus eight pixels, moving information into compact rows. SVG rendering uses `viewBox="60 60 480 480"` with one matching projection for pieces and button targets. Engine coordinates are unchanged.

See [AI](AI.md) and [online recovery](ONLINE.md) for algorithm and protocol decisions. There is still no tutorial, public matchmaking or account service. No reference repository was modified.
