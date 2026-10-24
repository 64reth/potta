# POTTA Build 002A — strategic findings

**The current initial game is a theoretical draw. Allowing placement wins changes it into a forced first-player win, provided the first piece takes the centre.** These are exact initial-position results, including the current threefold/100-movement-turn draw rules—not predictions from a depth-limited AI.

This studies the supplied engine, not authenticated Barbadian tradition. Every configuration keeps blocked turns as draws. Neither provisional placement behaviour nor any alternative below is asserted to be traditional.

## 1. What is solved?

| Placement victory | Reachable structural states | After eight-way board symmetry | Active movement states | Perfect result from an empty board |
| --- | ---: | ---: | ---: | --- |
| Movement only | 5,850 | 811 | 3,188 | Draw; neither player can force victory |
| Placement and movement | 5,538 | 765 | 2,744 | First player wins in at most nine total plies against any defence |

These counts are exhaustive for the **history-free game**: repetition and move limits disabled, with endless play classified as a mathematical draw. They include terminal states and retain player labels, turn, phase, piece counts and outcome. Keeping unused counters as unbounded mathematical integers gives infinitely many representations; these finite counts are their behaviour-preserving quotient.

The no-repetition game with a 100-move limit has **156,182 clock-retaining states / 20,986 symmetry classes** for movement-only victory, or **155,870 / 20,940** with placement wins. These counts also are exhaustive; terminal move clocks are retained.

**The full threefold-history-expanded state count has not been enumerated.** Its initial outcome is proved, but not every possible in-progress history has been solved. The structural counts above must not be presented as that larger state space.

## 2. First- and second-player advantage

| First placement | Movement-only wins | Placement wins allowed, ordinary draw limits |
| --- | --- | --- |
| Centre E | Draw | First player forces victory |
| Corner A/C/G/I | Draw | Draw |
| Edge B/D/F/H | Draw | Second player forces victory |

Thus the present rules have no forced first- or second-player win from the initial position. Placement victory creates a decisive centre-opening advantage; a first-player edge opening loses against perfect defence. The latter loss can be forced by ply eight.

One fastest-forcing first-player line, with the defender delaying optimally, is:

`E, A, F, D, G, C; E–H, A–B, F–I`

Players alternate throughout. Blue wins on G–H–I at ply nine: six placements and three movements. This is one branch of the verified strategy, not a claim that every defender chooses those moves. Notice that the winner **leaves the centre** to complete the plan.

## 3. Draw rules materially affect duration

| Draw configuration | Movement-only initial result | Placement-wins initial result |
| --- | --- | --- |
| No repetition, no move limit | Draw by infinite-play convention | First-player win |
| Twofold or threefold, no move limit | Draw | First-player win |
| None/twofold/threefold, 100-move limit | Draw | First-player win |
| None/twofold/threefold, 3-, 4- or 10-move limit | Draw | First-player win |
| None/twofold/threefold, **2-move limit** | Draw | Draw |

A two-move limit is a deliberately short stress case. The placement-winning strategy needs at most three movement turns. Its strictly decreasing winning ranks prevent repetition, so twofold and threefold do not rescue the defender. Conversely, adding automatic draws cannot turn an already drawn initial position into a forced win. See [the proofs and counting definitions](METHODS.md).

There is no initial forced victory under movement-only rules. Across its winning nonterminal structural positions, fastest win against longest resistance takes **1–11 remaining plies**; restricting the starting position to movement gives **1–10**. With placement wins, the corresponding maxima are **10 and 10**. These are minimax remotenesses, not maximum legal match lengths. Without draw limits, legal cycles can be repeated arbitrarily before an eventual win. The present 100-move rule bounds a match to 106 total plies.

## 4. The centre matters, but ownership is not a guarantee

E has eight neighbours; every peripheral point has three. In movement-only structural positions, the player to act averages 4.69 legal moves when owning E, versus 2.60 when the opponent owns it. However, **184 positions with the centre owned by the player to act are forced losses**. These are exact position counts, not probabilities or a causal estimate of centre value.

Here X is first-player Blue, O is Gold, and the coordinates are A/B/C, D/E/F, G/H/I:

```text
X O X
O X O
. . .
```

Blue to move, after placements `A, B, C, D, E, F`. Only E can move. Every choice E–G/H/I lets Gold play B–E and win on D–E–F. Owning the centre is a liability here. Under movement-only rules every initial placement still draws with perfect continuation; there is no unique winning opening.

## 5. Double threats are real

Each victory configuration has **64 active movement positions / eight symmetry classes** with an unavoidable double threat on distinct winning lines. This definition requires every legal defender reply to leave an immediate winning move, not merely two attractive-looking alignments.

```text
X O .
X O X
O . .
```

Blue to move, reached by `A, B, D, E, F, G`. Gold threatens B–C on C–E–G and G–H on B–E–H. Blue has only F–C or F–I: after F–C, Gold wins G–H; after F–I, Gold can win B–C. Both replies were checked against the live engine with current draw rules.

## 6. Repetition is strategic history, not just a long game

Both structural graphs have one cyclic strongly connected component of **2,744 states**, with 9,952 internal edges. Winning and drawn states coexist there: membership in a cycle does **not** itself establish a draw. The shortest cycle is four plies.

A draw-preserving example is reached by `C, B, D, F, E, G`, then:

`E–H, B–A, H–E, A–B`

One loop returns the identical board and turn. With threefold rules, two complete loops produce a draw; with no draw limits, it can continue indefinitely. A legal exit to a win also exists, so there is no longest legal winning path in the unbounded model.

History can even change a forced loss into a draw. The centre-loss board above has a second, verified history in which E–H has already occurred twice with the same next player. Blue can then choose E–H for an immediate threefold draw instead of losing. [The complete witness](METHODS.md#history-witness) uses only legal actions. A board-only tablebase cannot replace the production history-aware rules.

Frequency depends on a policy. In **1,000 seeded, uniformly random legal-action games per configuration**, all with a 100-move limit:

| Victory / repetition | Games revisiting a position | Repetition-draw results |
| --- | ---: | ---: |
| Movement only / twofold | 223 | 223 |
| Movement only / threefold | 244 | 25 |
| Movement only / disabled | 251 | 0 (one move-limit draw) |
| Placement allowed / threefold | 185 | 15 |

In the current threefold sample, 208 of the 244 first returns were four-ply reversals. These are reproducible simulation estimates for that policy, not perfect-play frequencies, human statistics or evidence of seat advantage.

## 7. Competitive depth and AI search

There are six opening placement decisions. The movement-only graph averages **4.28 legal actions per active position**. Of 5,538 active positions, **4,233 (577 after symmetry)** have legal choices with different perfect-play outcomes; 2,092 positions with multiple legal actions have exactly one best-outcome action. The placement-winning variant has 3,849 outcome-sensitive positions / 524 symmetry classes. This defines “meaningful” narrowly by win/draw/loss; it is not a count of independent human strategies or of every history-sensitive decision.

The unchanged AI was tested on 48 seeded, symmetry-distinct, outcome-sensitive positions in each fully solved no-repetition/no-limit model:

| Existing difficulty | Movement-only: preserves optimal outcome | Placement allowed |
| --- | ---: | ---: |
| Easy | 27/48 | 39/48 |
| Normal | 43/48 | 46/48 |
| Hard | 48/48 | 48/48 |

More search helped in this sample. Normal and Hard share evaluation/search code but differ in both depth and node budget, so this is not a depth-only controlled experiment. It is not an exhaustive AI test, a proof Hard is unbeatable, or an evaluation of all production histories.

**Interpretation:** Potta offers substantial tactical punishment, forks and draw-resource decisions despite its small board. The compact structural space, short forced-win horizons and repeated positions limit unlimited competitive novelty; long play does not necessarily imply deeper strategy. More search can avoid mistakes, but cannot discover a forced initial win under the current movement-only rules. None of these findings authenticates a historical ruleset or recommends changing it.
