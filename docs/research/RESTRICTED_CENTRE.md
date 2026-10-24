# Strategic experiment — centre reserved for movement

**Recommendation: do not adopt this as a standalone competitive rule under the current turn order.** It changes the initial game from a theoretical draw into a forced first-player win. It eliminates blocked opening draws, but does not show an increase in meaningful choice or ordinary random-play game length.

This is a proposed variation, not a claim about authenticated Barbadian tradition. Production gameplay is unchanged.

## Rule and scope

Only placement at E is forbidden. The sixth placement switches the phase normally; E is then immediately available for ordinary edge-connected movement. Everything else remains the current configuration: three stones each, Blue first, movement-only victory, blocked-turn draw, threefold repetition and 100 movement turns.

As in [Build 002A](REPORT.md), an exhaustive history-free graph supplies exact values, with proofs extending the initial result to the actual repetition/clock rules. Full repetition-history state counts are not enumerated. Statistics below use the actual current draw rules and real histories, with only the E-placement filter added for the variation.

## 1–2. Perfect play and forced victory — proven

| | Current game | Restricted centre |
| --- | ---: | ---: |
| Perfect initial result | Draw | Blue forces victory |
| Fastest forced result against longest resistance | No forced initial victory | Nine player actions: six placements + three movements |
| Reachable structural states, including terminals | 5,850 | 4,409 |
| After square symmetries, retaining player identity | 811 | 602 |
| Active movement states | 3,188 | 2,892 |

All **eight permitted first placements** are winning with correct continuation; none is a uniquely necessary opening. Gold cannot force a win or draw against a correctly played Blue strategy.

This is not a depth-cutoff result. Both complete reachable graphs were solved by retrograde attractors and independently checked by synchronous fixed-point calculations. The winning strategy's rank strictly decreases. From a fresh game it cannot repeat an active position, and its maximum movement expenditure is three turns. Therefore neither threefold repetition nor the 100-move limit rescues the defender. The explicitly capped model agrees.

## 3. First movement initiative — strong, but not automatic

Blue places first **and** moves first after placement; those roles are not separated by this experiment. Blue can steer placement into a winning movement position, but merely receiving the next turn does not make every layout winning.

Exhaustive census of all distinct layouts after six placements:

| Result with perfect continuation | Current: 1,680 layouts | Restricted: 560 layouts |
| --- | ---: | ---: |
| Blue, the first movement player, wins | 992 | 436 |
| Draw | 404 | 80 |
| Gold wins | 284 | 44 |

The current draw total includes eight layouts already adjudicated blocked. The restricted layouts are all active, with E empty. The 436/560 figure is **not** an optimal-play or human win probability: it equally weights possible layouts, including placement mistakes. Optimal Blue avoids the drawing and losing handoffs.

These handoff values also hold under the actual default draw rules: no earlier movement history exists, a winning rank-decreasing strategy needs at most ten further movement turns, and automatic draws cannot create a win from a drawn position.

Movement itself has acquired no new tactics or permissions. Every restricted movement position is already present in the current game and has the same history-free value and remoteness. The rule selects a different set of starting layouts rather than enriching the movement rules.

### “Take E immediately” is not a universal winning rule

In 428 of the 436 Blue-winning restricted handoffs, at least one move into E preserves the win. In the other eight, **every** centre-entry move loses; the winning move stays on the perimeter.

For example, after `A, B, D, F, H, I`, Blue is to move:

```text
X O .
X . O
. X O
```

X is Blue, O is Gold; rows are A/B/C, D/E/F, G/H/I. **H–G wins on A–D–G immediately.** Moving A/D/H into E instead lets Gold play B–C and win C–F–I. This was checked directly against the engine.

## 4. More meaningful choices? — not by the existing metric

“Meaningful” retains Build 002A's narrow definition: a position has legal actions with different perfect-play win/draw/loss outcomes.

| Exact structural metric | Current | Restricted |
| --- | ---: | ---: |
| Outcome-sensitive active positions | 4,233 | 2,704 |
| After symmetry | 577 | 358 |
| Outcome-sensitive placement positions | 1,885 / 2,350 (80.2%) | 612 / 1,213 (50.5%) |
| Mean legal choices across placement positions | 4.65 | 3.79 |
| Mean legal choices across movement positions | 4.01 | 4.01 |
| Maximum movement-position minimax remoteness | 10 | 10 |

The variation removes options and opening positions; it does not expand the tactical movement horizon. These are structural counts, not counts of independent human strategies or a proof about enjoyment. Remoteness-sensitive delaying choices and history-dependent draw tactics are not captured by the win/draw/loss metric. Nevertheless, the measured evidence does not support a claim of greater competitive depth.

## 5. Average length — policy-dependent sampled observations

There is no policy-independent average, even under perfect play when many drawing choices are equivalent. Two reproducible policies were run for **10,000 games each, for each ruleset**:

| Policy | Current mean player actions | Restricted mean | Median: current / restricted |
| --- | ---: | ---: | ---: |
| Uniform random legal actions | 17.6035 | 17.5538 | 14 / 14 |
| Exact-outcome policy; fastest winner, slowest defender, random ties | 42.0854 | 9 | 39 / 9 |

The uniform-policy difference is −0.0497 actions, with an approximate paired 95% Monte Carlo interval of **−0.3254 to +0.2260**. No clear average-length change is established by that experiment.

In the outcome-policy sample, all current games drew; all restricted games ended with Blue winning at action nine. The restricted nine-action minimax result is independently proven, whereas **42.0854 is only the mean of the specified drawing tie-break policy**. It is not an intrinsic duration of perfect current-game play. No production AI was changed or used as a proxy for perfect play.

## 6. Repetition and stalemate

Both history-free graphs retain the same cyclic component of **2,744 positions**. Blocking centre placement does not remove movement cycles.

With uniform random legal play:

| Event, out of 10,000 games | Current | Restricted |
| --- | ---: | ---: |
| A position is revisited (including draw move) | 2,461 (24.61%) | 2,456 (24.56%) |
| Ends by threefold repetition | 200 (2.00%) | 236 (2.36%) |
| Ends by blocked-turn draw | 40 | 0 |
| Ends by movement limit | 0 | 2 |

Revisit rates are effectively unchanged in this sample. Repetition draws increased by 0.36 percentage points, but the approximate paired interval, **−0.006 to +0.726 percentage points**, includes zero. This does not establish a reliable increase or decrease in their underlying policy frequency. These observations are not predictions of human play.

Blocked-turn draws are a stronger finding: **none is reachable in the restricted structural graph**, compared with eight current blocked layouts, all ending at the sixth placement. Under uniform random placement the current probability is exactly **8/1,680 = 1/210**; the restricted probability is zero. With E vacant every stone initially has a connected empty destination, and exhaustive traversal finds no later blocked-draw terminal either. Repetition and general drawn positions still exist.

Under the specified optimal policy, repetition draws disappear in the restricted game because the forced win arrives before any repeat—not because cycles have been eliminated.

## 7. Dominant openings and recommendation

The opening is not dominated by one particular first point: every corner and edge can win. A new **maximal-resistance response pattern** does emerge. Gold's only first reply that delays a correctly played loss to action nine is the point opposite Blue's first placement. Any other first reply lets Blue force a win by action seven. All 56 first/second placement pairs were checked, with symmetry cross-checks.

For example, after `B, H`, Blue's third placement must be **A or C** to retain the forced win; D/F/G/I allow a draw. A representative longest-resistance winning line is:

`A, I, B, H, F, C; B–E, C–B, A–D`

Blue finishes on D–E–F. This is one adversarial branch of a reactive winning strategy, not a fixed script valid against arbitrary replies.

**Competitive balance worsens:** a balanced initial theoretical draw becomes a forced Blue win, and no measured increase in outcome-sensitive choice offsets that. Eliminating blocked openings is a real benefit, but the variation leaves the cyclic movement core intact and shortens correctly played decisive contests. Keep it as a research/puzzle experiment rather than promote it as a competitive improvement under the preserved rules. Whether people find the opening restriction enjoyable would require playtesting; no human-play claim is made here.

## Reproduction and verification

```sh
npm run research:centre
```

This type-checks the utility, runs exhaustive checks and regenerates [the data](restricted-centre-results.json). The sole experimental rule is an action filter in `tools/analysis/restricted-centre.ts`; `transition` still handles all actions and results. The shared graph builder accepts an optional research predicate, defaulting to the original unrestricted behaviour.

Checks include independent fixed points, all-state Bellman/remoteness identities, **319,304 symmetry-transformed engine transitions**, opening-response ranks, unchanged values for all shared movement states, and a separate literal clock-expanded engine traversal for the restricted three-move-cap game. Centre placement rejection, centre availability after six placements and the winning principal line are checked against the live engine. Initial outcomes and handoff counts are exact; average lengths and frequencies are seeded observations. Full repetition-history state enumeration and exhaustive expected lengths under a stochastic policy remain outside the claims.

Simulations use the default rules and independent per-game seeded streams (`0x43454e54 + game × 0x9e3779b9`, reduced to uint32), shared across compared variants. Approximate Monte Carlo intervals use paired per-game differences and a normal approximation; they do not quantify human behaviour. The artifact records policies, seeds and source hashes. No production game, interface, online service or AI difficulty setting is modified or deployed.
