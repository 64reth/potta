# Board and rule decisions · engine version 1

The board follows the geometry specified for this build:

```text
A ─── B ─── C
│ ╲   │   ╱ │
│   ╲ │ ╱   │
D ─── E ─── F
│   ╱ │ ╲   │
│ ╱   │   ╲ │
G ─── H ─── I
```

An edge joins only consecutive points: AB, BC, DE, EF, GH, HI; AD, DG, BE, EH, CF, FI; AE, EI, CE, EG. Edges are undirected. In particular A–I, C–G and A–C are not single moves. Centre E has eight neighbours; corner A has B, D and E.

Winning lines: ABC, DEF, GHI, ADG, BEH, CFI, AEI, CEG. A bent path through three connected points is not a winning line.

## Implemented play

Two players place three pieces each in alternating turns. After the sixth placement, every turn moves one owned piece exactly one graph edge to a vacant point. No jumping, overlap, opponent movement, placement after the opening, or action after a result is legal. Victory during movement is checked after the acting player's move, before blocked-turn and draw checks.

## Provisional configuration

These defaults are practical Build 001 choices, **not authenticated traditional rules**. Historical verification remains outstanding. `Rules` and `DEFAULT_RULES` in `src/engine/game.ts` provide the explicit engine configuration; there is no player-facing rules editor.

| Setting | Initial default | Alternatives / semantics |
| --- | --- | --- |
| `placementWins` | `false` | `true` checks victory after every placement, including the sixth. With `false`, a placement alignment is not a win and is not awarded retroactively at phase change. A later movement action must leave the acting player aligned. |
| `blocked` | `draw` | `loss` awards victory to the opponent; `pass` transfers play to the opponent when that player has a move. Applied immediately on entering movement and after every move. |
| `repetition` | `3` | Positive integer ≥2, or `null` to disable. Identical node occupancy, phase and side to act constitute the same position. A forced pass is resolved before counting. |
| `moveLimit` | `100` | Positive integer ≥2, or `null` to disable. Counts individual movement turns, excluding placements. |

If neither player can move, the game draws regardless of blocked-turn policy. If a move both wins and reaches a draw threshold, the win takes precedence. Blocking takes precedence over repetition and the movement limit. Configurations disabling both draw thresholds allow an indefinite cycle; that is deliberate opt-in behavior.

Azure starts each new game and rematch as an explicit interface convention. Colour names, piece styling, movement timing and these draw policies are presentation/implementation decisions rather than historical assertions.
