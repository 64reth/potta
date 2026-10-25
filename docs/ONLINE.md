# Private online matches · Build 002

## Authority and transport

One SQLite-backed `PottaRoom` Durable Object owns one six-character room code. A same-origin Worker accepts small JSON POST requests and routes them with `getByName(code)`. The room performs synchronous read/validate/write against one persisted record; no related writes are separated by an `await`, and no acknowledged match state exists only in memory.

HTTP polling (normally every 600 ms) was selected for this turn-based build. It removes socket ownership and close-callback races from recovery while providing prompt updates. Failed requests retry with a bounded backoff (up to five seconds), with a six-second request timeout. Background suspension or a disconnected opponent changes guidance, never the result or seat assignment. Presence is advisory after twelve seconds without a successful request; it does not create a forfeit or expiry.

`RoomView` contains the board, authoritative side to act, assigned player, room revision, match number, rematch votes and advisory presence. It never exposes credentials. The client disables moves while disconnected, waiting for a second player, waiting for acknowledgement or observing the opponent's turn. There are no optimistic game-state mutations to reconcile.

All modes use `DEFAULT_RULES` and the unchanged engine. The server selects a canonical legal action, applies `transition`, and records the same action and events for replay. Canonicalisation prevents incoming JSON property order from making a valid recording unreplayable. No client-supplied board, result or rule overrides are accepted.

## Identity before transport

A browser generates a cryptographically random 256-bit credential and stores it with its room code **before** create/join is sent. Room codes use six unambiguous base-32 characters. Credentials travel only in Authorization headers; invitation URLs contain only `#room=CODE`. The server stores SHA-256 credential digests and assigns the creator Azure, the other member Ochre. A repeated create/join with the same credential returns the same seat, so a lost initial response cannot orphan it.

Credentials are stored per room in local storage. The active room is remembered independently. Reloading an online room URL automatically restores that seat; Main menu → Resume Game restores it later. Multiple tabs in one browser share that seat. Separate browser profiles represent separate players. Clearing browser storage removes that browser's recovery credential; there is no account-based recovery in this build. A browser that cannot persist credentials is prevented from starting an online session.

## Action delivery and rematch

Before sending, the client saves the command with a UUID, expected revision and match number. Only one command is pending. A lost acknowledgement or reload retries the same saved command. The server stores recent per-player receipts, compares payloads and returns the latest view for a duplicate without reapplying the action. A reused ID with a different payload, stale revision, old match, opponent action or illegal destination is rejected.

Receipts retain the most recent 512 commands across rounds. Older match numbers always reject after receipt eviction. A rematch requires both members' votes after a result; it preserves credentials and rules, resets the board, and increments the match number. The current round's engine recording is retained with the room; there is no historical-round archive or replay interface.

## Reference review

Read LUDI's `apps/server/rooms.ts`, `apps/worker/index.ts` and online tests without editing them. Reused the concepts of durable identity, idempotent create/join, revision + match validation and mutual rematch. Avoided identity loss on transport close, destructive reconnect timeouts and memory-only acknowledged state. The accessible Warri checkout supplies a useful isolated AI-worker/cancellation pattern but contains no online room implementation. No LUDI/Warri runtime code or game dependencies are imported.

## Environments and verification boundary

Development: `potta-online-development`, local SQLite under `.local/online/`, `remoteBindings: false`. Production build: `potta`, distinct namespace identity and bundled client/Worker outputs. Compatibility date: 2026-10-24. Bindings derive from the typed configuration, with the room namespace specialised to its RPC class. Vite's inline runtime configuration uses the same worker-name/date/class constants. Logs and traces are enabled; application logs do not include credentials or command payloads.

Build 002 verification used local workerd, two isolated browser contexts and a real local runtime restart. Build 004 introduces the authorised production deployment; see [deployment notes](BUILD-004.md). Physical remote devices remain outside the automated verification boundary.

Reference API guidance: [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [typed project configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/). Installed CLI/config types were checked because this beta CLI's commands and configuration differ from parts of the current online documentation.
