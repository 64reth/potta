# Method, proofs and verification

Analysed baseline: Build 002, commit `9c0a3c4`, game-engine version 1. Production source hashes are recorded in [results.json](results.json). No production module is changed or imports the analyser.

## Reproduction

From the project root, using the existing Node/npm dependencies:

```sh
npm run research:verify
npm run research:potta
```

The first command type-checks the standalone utility and runs independent checks. The second regenerates deterministic `docs/research/results.json`, including graph counts, clock-expanded counts, opening values, witnesses, simulations and AI sample IDs. No network, server, Cloudflare account or deployment is needed. Run from the project root so source hashes and output paths resolve correctly.

`tools/analysis/graph.ts` constructs and solves the graph; `metrics.ts` measures tactics, draw limits and seeded experiments; `run.ts` writes the artifact; `verify.ts` cross-checks the results. Research has its own `tsconfig.research.json`. The only package changes are two research scripts; no dependencies or AI settings are added or altered.

## Configurations and state identity

All cases preserve two labelled players, three stones, the supplied nine-point graph, eight winning lines, alternating turns and `blocked: 'draw'`. Placements are not retroactively awarded a win at phase change when `placementWins` is false. This matters: existing alignments can enter movement without ending the game. Successors always come from the original `legalActions` and `transition`; no placement, adjacency, phase-change or victory logic is reimplemented.

The structural key contains node occupancy, player to act, phase, placed counts and terminal result/winner/reason. Winning-line ordering is not a future decision variable. With repetition and move limits disabled, `moves` and `visits` cannot affect successors or outcomes; removing them is a valid behavioural quotient. With unused counters treated as unbounded mathematical integers, legal cycles give infinitely many raw representations. This is the game-theoretic model, not a study of JavaScript numeric overflow. Counts include terminal nodes and retain Blue/Gold identity; they are not counts of games or action sequences.

Canonicalisation uses the eight rotations/reflections of the square, preserving players, phase, turn and outcome. Both edges **and winning lines** are verified under every transform. A larger symmetry group of the graph alone would be invalid if it failed to preserve winning combinations. Symmetries are used for counts and experimental selection; solving retains the full labelled graph, avoiding ambiguity about stabilisers or edge multiplicity.

The no-repetition capped graph additionally retains the movement clock, including terminal clocks. It is exhaustively traversed layer by layer, with zero-cost placement edges and unit-cost movement edges. Every cap-boundary outcome is obtained by calling the actual engine at `moves = limit - 1`; victory/blocking/draw precedence is therefore inherited, not guessed. Exact memoised minimax evaluates the finite graph. The caps are actual analysed rules (2, 3, 4, 10, 100), never computational search cutoffs disguised as draws.

The reported **threefold initial value is exact, but a full history-expanded state count/tablebase is not supplied**. In that game the identity must also contain relevant visit counts and remaining movement budget. Independently canonicalising individual past boards would lose their orientation relative to the present board; a history-aware symmetry quotient must transform the complete history consistently. This utility does not claim to construct one.

## Unbounded cycles and minimax remoteness

For each possible winner separately:

1. Seed the attractor with that player's actual terminal victories, rank zero.
2. At that player's turn, add a predecessor once any successor is in the attractor; its rank is one plus the smallest successor rank.
3. At the defender's turn, add it only when **every** successor is in the attractor; its rank is one plus the largest successor rank.
4. Continue to a fixed point. Terminal draws never seed a winning attractor. The two attractors are disjoint.

A FIFO implementation computes ranks in nondecreasing order. A second, independent synchronous-round fixed-point implementation reproduces every attractor rank. All states also satisfy win/draw/loss Bellman equations and remoteness recurrences. States outside both attractors are draws under the explicit convention that infinite play is a draw. From these states each player has a non-losing strategy. The engine itself would keep playing indefinitely if both automatic draw rules were disabled.

SCC decomposition describes recurrence, not who wins. A cyclic SCC may contain forced wins because a player can force an exit. Shortest cycles are established by a four-ply witness, exhaustive absence of one-/two-edge cycles, and turn alternation excluding odd cycles. The cycle witness also has a legal terminal-winning exit: repeating the loop any chosen number of times and then exiting yields arbitrarily long **possible** winning games, not a claim that a player can force an opponent to cooperate in postponement.

Remoteness is remaining plies under the winner's fastest forcing strategy and the defender's longest resistance. It is neither longest legal play nor a guarantee for an arbitrary winning move. Movement-only remoteness can reach eleven from partial placement, or ten from movement; placement-winning remoteness reaches ten from an arbitrary reachable position. The placement-winning **initial** remoteness is nine.

## Why the current history-dependent initial result is known

Adding automatic draws cannot invalidate a non-losing strategy: play can end in a draw earlier, but an opponent cannot acquire a new terminal win. Consequently a drawn position remains drawn after these additional draw rules. This proves the current movement-only initial draw, and its draw after every opening placement, without enumerating all visit vectors.

For a winning initial position, select a rank-minimising action at the winner's turns. All defender replies also strictly decrease rank. Therefore the strategy never repeats an active structural position and cannot trigger a repetition draw from a fresh game. For placement-winning Potta, a memoised traversal of that decreasing-rank strategy bounds movement expenditure against **all** defender choices at three. The initial win therefore survives either twofold or threefold, with no movement cap or any analysed cap of at least three.

The exact capped minimax game draws at cap two. Adding repetition draws preserves that draw. These establish initial outcomes only; they do not pretend that every history of a structurally winning position remains winning.

## History witness

All sequences alternate Blue, Gold. Use current defaults, with either placement-victory setting (no placement win occurs in this witness).

Prepare a centre-loss board with:

```text
Placements: A, B, C, D, G, F
Movement:   G–H, D–G, H–E, G–D

X O X
O X O
. . .
Blue to act
```

At this point every Blue move E–G/H/I lets Gold win B–E immediately. Now legally traverse:

```text
E–H, D–G, H–E, G–D
```

The identical board and Blue turn return, but the Gold-to-act board reached by E–H has now been visited twice. Blue's next **E–H** is a third occurrence and immediately draws. The verifier preserves the engine's real `visits` throughout and checks that the board before/after the loop is identical while the histories differ. Since an automatic draw cannot create a Blue forced win from an underlying Gold win, an available immediate draw establishes the changed history-dependent value exactly.

The preparation is intentional: blindly looping from the ordinary six-placement centre-loss board would not have visited E–H twice before the next attempt. Visit multiplicities and phase/turn cannot be omitted from this argument.

## Experiments versus proofs

Repetition frequencies use 1,000 legal-action-uniform games per configuration, seed `0x504f5454`. A first return compares occupancy/phase/turn; terminal wins are excluded because engine win recognition pre-empts repetition counting. Every run has an explicit 100-move rule. The defensive sampling guard throws on nontermination; it never awards a draw. These frequencies are policy-specific estimates, not invariant mathematical probabilities.

AI comparisons call the existing `chooseAction` unchanged, using its existing settings, with seed 1. Forty-eight outcome-sensitive symmetry representatives are selected with seed 2042; the artifact records IDs. Each input is reconstructed along an actual shortest-path engine history, under the relevant no-repetition/no-limit model. The oracle tests whether the chosen legal successor preserves the position's exact win/draw/loss value. Losing positions with all choices equivalent are excluded. It does not grade winning speed or human plausibility. One deterministic orientation represents each orbit; order-sensitive search could behave differently in another orientation. The sample is not an exhaustive correctness certificate for the production AI.

## Checks and remaining limits

`research:verify` performs **361,776 symmetry-transformed engine transition checks**, verifies both independent attractor solutions, checks all local Bellman/remoteness identities and confirms winning-line symmetries. Literal clock-expanded engine enumerations independently reproduce counts and initial values for caps 2, 3 and 4. It replays representative prefixes, longest-remoteness lines, forks, cycle/draw witnesses, an exit to victory and the nine-ply initial win. Fork replies and history witnesses are checked with the current threefold/100-move rules and unmodified engine.

Not completed: a full count/strong solution for every threefold or twofold visit-history state, exhaustive orientation/history-specific AI assessment, changed blocked-turn policies, historical authentication and human-play studies. The reports do not extrapolate these missing results. The initial outcomes and finite/history-free counts claimed here have no search-depth approximation.
