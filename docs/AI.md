# Computer opponents · Build 002

Every computer action comes from the same `legalActions` API as a human turn. Successors use the original `transition`, including provisional placement rules, blocked-turn policy, repetition and movement limits. Search never mutates the live state. The resulting action is dispatched through the ordinary `GameSession`, preserving events and replay.

- **Easy:** always takes an immediate legal win. Otherwise it favours useful positions 65% of the time and can choose a weaker legal move, missing a block. Variation uses the session seed and board, never ambient randomness inside search.
- **Normal:** iterative minimax to depth three, up to 1,800 search nodes. It evaluates wins/losses/draws, open winning lines, threats, centre occupation and movement options.
- **Hard:** iterative minimax to depth twelve, up to 24,000 search nodes, with alpha-beta pruning, ordered successors and transposition caching. Only fully completed search iterations replace the selected move.

The cache includes occupancy, player to act, phase, movement count, the complete sorted repetition history and rules configuration, plus remaining search depth. Exact/lower/upper bounds are distinguished. Board-only transposition keys would incorrectly reuse evaluations across draw histories. Search chooses maximizing/minimizing by the actual next player, so configured forced passes do not invalidate alternation assumptions.

The small board makes deeper search practical, but history-dependent repetition substantially enlarges the full game tree. Hard prioritises the strongest result it can establish within its deterministic node budget; it is **not a proven perfect-play solver**. No claim of an exhaustive solution or guaranteed unbeatable play is made. Equal evaluations use deterministic ordering. The budget bounds work rather than wall-clock time, keeping decisions reproducible.

Computation runs in a Web Worker. The presentation waits at least 420 ms before applying a computer move, retains the existing movement animation and respects reduced motion. Returning to the menu or starting another game cancels the old worker and ignores stale replies. Interrupted computation leaves a resumable game.
