import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  initialState,
  legalActions,
  transition,
  DEFAULT_RULES,
  type State,
  type Action,
} from "../../src/engine/game";
import { seededRandom } from "../../src/engine/session";
import { NODES } from "../../src/engine/geometry";
import {
  buildGraph,
  solve,
  checkSolution,
  canonical,
  principalVariation,
  label,
  boardText,
  components,
  positionKey,
  pathTo,
  SYMMETRIES,
  transform,
  type Graph,
  type Solution,
} from "./graph";
import { capped, movementBound } from "./metrics";

// The entire proposed rule: remove E placement actions. All movement, victory,
// turn, draw and history processing remains the authoritative engine's work.
export const allowRestrictedCentre = (s: State, a: Action) =>
  s.phase !== "placement" || a.type !== "place" || a.to !== "E";
export const experimentActions = (s: State, restricted: boolean) =>
  legalActions(s).filter((a) => !restricted || allowRestrictedCentre(s, a));
export function experimentTransition(s: State, a: Action, restricted: boolean) {
  if (restricted && !allowRestrictedCentre(s, a))
    throw Error("Centre placement is restricted in this research model");
  return transition(s, a).state;
}
function summary(g: Graph, sol: Solution) {
  const rows = g.states.map((s, id) => ({ s, id })),
    playing = rows.filter((r) => r.s.result.status === "playing");
  function choices(phase: State["phase"]) {
    const subset = playing.filter((r) => r.s.phase === phase);
    let meaningful = 0,
      uniqueBest = 0,
      branchSum = 0;
    const orbits = new Set<string>();
    for (const { id, s } of subset) {
      const values = g.edges[id].map((e) => sol.winner[e.to]),
        best = (s.turn === "blue" ? Math.max : Math.min)(...values);
      branchSum += values.length;
      if (new Set(values).size > 1) {
        meaningful++;
        orbits.add(canonical(s));
      }
      if (values.length > 1 && values.filter((v) => v === best).length === 1)
        uniqueBest++;
    }
    return {
      states: subset.length,
      meaningful,
      meaningfulOrbits: orbits.size,
      meaningfulFraction: meaningful / subset.length,
      uniqueBestAmongMultiple: uniqueBest,
      meanLegalActions: branchSum / subset.length,
    };
  }
  const scc = components(g),
    cyclic = scc.groups.filter((c) => c.length > 1);
  const completed = rows.filter(
    ({ s, id }) =>
      g.depth[id] === 6 && s.placed.blue === 3 && s.placed.gold === 3,
  );
  const allValues = Object.fromEntries(
    [-1, 0, 1].map((v) => [
      String(v),
      completed.filter(
        ({ s, id }) => (s.result.status === "draw" ? 0 : sol.winner[id]) === v,
      ).length,
    ]),
  );
  const handoffs = rows.filter(
    ({ s, id }) =>
      g.depth[id] === 6 &&
      s.phase === "movement" &&
      s.result.status === "playing" &&
      s.turn === "blue",
  );
  const handoffValues = Object.fromEntries(
    [-1, 0, 1].map((v) => [
      String(v),
      handoffs.filter((r) => sol.winner[r.id] === v).length,
    ]),
  );
  const central = handoffs.filter(({ s }) => s.board.E === null),
    centreBest = Object.fromEntries(
      [-1, 0, 1].map((v) => [
        String(v),
        central.filter(
          ({ id }) =>
            Math.max(
              ...g.edges[id]
                .filter((e) => e.action.to === "E")
                .map((e) => sol.winner[e.to]),
            ) === v,
        ).length,
      ]),
    );
  const exception = central.find(
    ({ id }) =>
      sol.winner[id] === 1 &&
      !g.edges[id].some((e) => e.action.to === "E" && sol.winner[e.to] === 1),
  );
  return {
    states: g.states.length,
    symmetry: new Set(g.states.map(canonical)).size,
    edges: g.edges.reduce((s, e) => s + e.length, 0),
    root: sol.winner[0],
    rootRemoteness: sol.distance[0],
    winningMovementBound: sol.winner[0] ? movementBound(g, sol, 0) : null,
    activeStates: playing.length,
    placement: choices("placement"),
    movement: choices("movement"),
    maxMovementRemoteness: Math.max(
      ...rows
        .filter(
          (r) => r.s.phase === "movement" && r.s.result.status === "playing",
        )
        .map((r) => sol.distance[r.id]),
    ),
    blockedDrawStates: rows.filter(
      (r) =>
        r.s.result.status === "draw" &&
        r.s.result.reason === "No available move",
    ).length,
    handoffs: {
      completedLayouts: completed.length,
      valuesIncludingBlocked: allValues,
      active: handoffs.length,
      values: handoffValues,
      centreEmpty: central.length,
      centreEntryBest: centreBest,
      blueWinningLayoutsWithoutWinningCentreEntry: central.filter(
        ({ id }) =>
          sol.winner[id] === 1 &&
          !g.edges[id].some(
            (e) => e.action.to === "E" && sol.winner[e.to] === 1,
          ),
      ).length,
    },
    centreException: exception
      ? {
          board: boardText(exception.s),
          turn: exception.s.turn,
          path: pathTo(g, exception.id).map(label),
          actions: g.edges[exception.id].map((e) => ({
            action: label(e.action),
            value: sol.winner[e.to],
            distance: sol.distance[e.to],
          })),
        }
      : null,
    cyclicComponents: cyclic.map((c) => c.length),
    cyclicStates: cyclic.reduce((n, c) => n + c.length, 0),
    opening: g.edges[0].map((e) => ({
      action: label(e.action),
      value: sol.winner[e.to],
      distance: sol.distance[e.to],
    })),
    principal: principalVariation(g, sol).sequence.map(label),
  };
}
function policyEdges(g: Graph, sol: Solution, id: number) {
  const value = sol.winner[id],
    preserving = g.edges[id].filter((e) => sol.winner[e.to] === value);
  if (!value) return preserving;
  const owner = g.states[id].turn === (value === 1 ? "blue" : "gold");
  const best = (owner ? Math.min : Math.max)(
    ...preserving.map((e) => sol.distance[e.to]),
  );
  return preserving.filter((e) => sol.distance[e.to] === best);
}
function simulate(
  g: Graph,
  sol: Solution,
  restricted: boolean,
  policy: "uniform" | "tablebase",
  games = 10000,
) {
  const trials: { plies: number; repeat: boolean; outcome: string }[] = [],
    lengths: number[] = [],
    outcomes: Record<string, number> = {};
  let repeats = 0,
    sum = 0,
    squares = 0,
    centreFirst: { blue: number; gold: number } = { blue: 0, gold: 0 };
  for (let game = 0; game < games; game++) {
    // Independent seeded stream per game; matching game seeds across variants.
    const rng = seededRandom((0x43454e54 + Math.imul(game, 0x9e3779b9)) >>> 0);
    let state = initialState(DEFAULT_RULES),
      plies = 0,
      seenRepeat = false,
      entered = false;
    const seen = new Set([positionKey(state)]);
    while (state.result.status === "playing") {
      const id = g.index.get(positionKey(state));
      assert.notEqual(id, undefined);
      const legal = experimentActions(state, restricted),
        choices =
          policy === "uniform"
            ? legal
            : policyEdges(g, sol, id!).map((e) => e.action);
      const action = choices[rng.int(choices.length)];
      if (!entered && action.to === "E") {
        entered = true;
        centreFirst[state.turn]++;
      }
      state = experimentTransition(state, action, restricted);
      plies++;
      if (state.result.status !== "won") {
        const key = positionKey({ ...state, result: { status: "playing" } });
        if (seen.has(key)) seenRepeat = true;
        seen.add(key);
      }
      assert.ok(
        plies <= 106,
        "The actual move-limit rule must terminate play.",
      );
    }
    const outcome =
      state.result.status === "won"
        ? state.result.winner + " win"
        : state.result.reason;
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    trials.push({ plies, repeat: seenRepeat, outcome });
    if (seenRepeat) repeats++;
    lengths.push(plies);
    sum += plies;
    squares += plies ** 2;
  }
  lengths.sort((a, b) => a - b);
  const mean = sum / games,
    sd = Math.sqrt((squares - sum ** 2 / games) / (games - 1));
  return {
    trials,
    policy,
    games,
    seedBase: "0x43454e54",
    seedStep: "0x9e3779b9",
    rules: DEFAULT_RULES,
    meanPlies: mean,
    meanMovementTurns: mean - 6,
    mean95PercentMonteCarloInterval: [
      mean - (1.96 * sd) / Math.sqrt(games),
      mean + (1.96 * sd) / Math.sqrt(games),
    ],
    median: lengths[Math.floor(games / 2)],
    p90: lengths[Math.floor(games * 0.9)],
    minimum: lengths[0],
    maximum: lengths.at(-1),
    outcomes,
    gamesWithRepeatedPosition: repeats,
    firstCentreOccupant: centreFirst,
  };
}
function openingCensus(g: Graph, sol: Solution) {
  const out = [];
  for (const first of ["A", "B"] as const) {
    const edge = g.edges[0].find((e) => e.action.to === first)!;
    out.push({
      first,
      replies: g.edges[edge.to].map((reply) => ({
        reply: label(reply.action),
        value: sol.winner[reply.to],
        distance: sol.distance[reply.to],
        thirdPlacements: g.edges[reply.to].map((e) => ({
          action: label(e.action),
          value: sol.winner[e.to],
          distance: sol.distance[e.to],
        })),
      })),
    });
  }
  return out;
}
function verify(g: Graph, sol: Solution, restricted: boolean) {
  checkSolution(g, sol);
  let checks = 0;
  // An independent, synchronous least-fixed-point calculation.
  for (const p of ["blue", "gold"] as const) {
    let rank = Int32Array.from(
        g.states.map((s) =>
          s.result.status === "won" && s.result.winner === p ? 0 : -1,
        ),
      ),
      round = 0;
    for (;;) {
      const next = rank.slice();
      let changed = false;
      round++;
      for (let id = 0; id < g.states.length; id++)
        if (rank[id] < 0 && g.edges[id].length) {
          const cs = g.edges[id].map((e) => rank[e.to] >= 0);
          if (g.states[id].turn === p ? cs.some(Boolean) : cs.every(Boolean)) {
            next[id] = round;
            changed = true;
          }
        }
      rank = next;
      if (!changed) break;
    }
    assert.deepEqual(rank, sol.attractors[p]);
  }
  for (let id = 0; id < g.states.length; id++) {
    const s = g.states[id];
    assert.equal(g.edges[id].length, experimentActions(s, restricted).length);
    if (restricted && s.phase === "placement") assert.equal(s.board.E, null);
    for (const map of SYMMETRIES) {
      const mapped = transform(s, map),
        mappedId = g.index.get(positionKey(mapped));
      assert.notEqual(mappedId, undefined);
      assert.equal(sol.winner[id], sol.winner[mappedId!]);
      assert.equal(sol.distance[id], sol.distance[mappedId!]);
      for (const e of g.edges[id]) {
        const action: Action =
          e.action.type === "place"
            ? { type: "place", to: map[NODES.indexOf(e.action.to)] }
            : {
                type: "move",
                from: map[NODES.indexOf(e.action.from)],
                to: map[NODES.indexOf(e.action.to)],
              };
        assert.equal(
          positionKey(experimentTransition(mapped, action, restricted)),
          positionKey(transform(g.states[e.to], map)),
        );
        checks++;
      }
    }
  }
  let pv = initialState(DEFAULT_RULES);
  for (const a of principalVariation(g, sol).sequence)
    pv = experimentTransition(pv, a, restricted);
  if (sol.winner[0]) {
    assert.equal(pv.result.status, "won");
    assert.equal(pv.result.status === "won" ? pv.result.winner : null, "blue");
    assert.equal(pv.moves, 3);
    assert.equal(sol.distance[0], 9);
  }
  return { symmetryEngineTransitions: checks, independentFixedPoint: true };
}
function verifyClock(g: Graph, restricted: boolean) {
  const rules = { ...DEFAULT_RULES, repetition: null, moveLimit: 3 },
    states = [initialState(rules)],
    edges: number[][] = [[]],
    index = new Map([[positionKey(states[0]) + ":0", 0]]);
  for (let id = 0; id < states.length; id++)
    for (const a of experimentActions(states[id], restricted)) {
      const next = experimentTransition(states[id], a, restricted);
      next.visits = {};
      const key = positionKey(next) + ":" + next.moves;
      let to = index.get(key);
      if (to === undefined) {
        to = states.length;
        index.set(key, to);
        states.push(next);
        edges.push([]);
      }
      edges[id].push(to);
    }
  const memo = new Map<number, number>();
  function evaluate(id: number): number {
    if (memo.has(id)) return memo.get(id)!;
    const s = states[id];
    const value =
      s.result.status === "won"
        ? s.result.winner === "blue"
          ? 1
          : -1
        : s.result.status === "draw"
          ? 0
          : (s.turn === "blue" ? Math.max : Math.min)(
              ...edges[id].map(evaluate),
            );
    memo.set(id, value);
    return value;
  }
  const compressed = capped(g, 3),
    symmetry = new Set(states.map((s) => canonical(s) + ":" + s.moves)).size;
  assert.equal(states.length, compressed.clockStates);
  assert.equal(symmetry, compressed.clockSymmetry);
  assert.equal(evaluate(0), compressed.root);
  return { states: states.length, symmetry, root: evaluate(0) };
}
export function runExperiment() {
  const baseline = buildGraph(false),
    variant = buildGraph(false, allowRestrictedCentre),
    bs = solve(baseline),
    vs = solve(variant);
  assert.equal(bs.winner[0], 0);
  assert.equal(vs.winner[0], 1);
  assert.equal(movementBound(variant, vs, 0), 3);
  let sharedMovement = 0;
  for (let id = 0; id < variant.states.length; id++) {
    const s = variant.states[id],
      baseId = baseline.index.get(positionKey(s));
    assert.notEqual(baseId, undefined);
    if (s.phase === "movement") {
      sharedMovement++;
      assert.equal(vs.winner[id], bs.winner[baseId!]);
      assert.equal(vs.distance[id], bs.distance[baseId!]);
    }
  }
  assert.ok(legalActions(initialState()).some((a) => a.to === "E"));
  assert.ok(!experimentActions(initialState(), true).some((a) => a.to === "E"));
  assert.throws(() =>
    experimentTransition(initialState(), { type: "place", to: "E" }, true),
  );
  let prepared = initialState(DEFAULT_RULES);
  for (const a of pathTo(
    variant,
    variant.states.findIndex(
      (s, id) =>
        variant.depth[id] === 6 &&
        s.result.status === "playing" &&
        s.phase === "movement",
    ),
  ))
    prepared = experimentTransition(prepared, a, true);
  assert.equal(prepared.phase, "movement");
  assert.equal(prepared.board.E, null);
  assert.ok(
    experimentActions(prepared, true).some(
      (a) => a.type === "move" && a.to === "E",
    ),
  );
  for (const first of variant.edges[0]) {
    assert.equal(vs.winner[first.to], 1);
    assert.equal(vs.distance[first.to], 8);
    const opposite = NODES[8 - NODES.indexOf(first.action.to)];
    for (const second of variant.edges[first.to]) {
      assert.equal(vs.winner[second.to], 1);
      assert.equal(
        vs.distance[second.to],
        second.action.to === opposite ? 7 : 5,
      );
    }
  }
  const verification = [verify(baseline, bs, false), verify(variant, vs, true)];
  const clock3 = verifyClock(variant, true);
  assert.ok(
    baseline.states.every(
      (s, id) =>
        s.result.status !== "draw" ||
        s.result.reason !== "No available move" ||
        baseline.depth[id] === 6,
    ),
  );
  assert.ok(
    variant.states.every(
      (s) =>
        s.result.status !== "draw" || s.result.reason !== "No available move",
    ),
  );

  const bu = simulate(baseline, bs, false, "uniform"),
    bo = simulate(baseline, bs, false, "tablebase"),
    vu = simulate(variant, vs, true, "uniform"),
    vo = simulate(variant, vs, true, "tablebase");
  const strip = ({ trials, ...data }: ReturnType<typeof simulate>) => data;
  function paired(metric: (t: (typeof bu.trials)[number]) => number) {
    const differences = bu.trials.map(
        (t, i) => metric(vu.trials[i]) - metric(t),
      ),
      n = differences.length,
      mean = differences.reduce((a, b) => a + b, 0) / n,
      sd = Math.sqrt(
        differences.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1),
      );
    return {
      restrictedMinusCurrent: mean,
      approximate95PercentMonteCarloInterval: [
        mean - (1.96 * sd) / Math.sqrt(n),
        mean + (1.96 * sd) / Math.sqrt(n),
      ],
    };
  }
  const comparison = {
    uniformPairedDifferences: {
      plies: paired((t) => t.plies),
      repeatedPosition: paired((t) => Number(t.repeat)),
      repetitionDraw: paired((t) => Number(t.outcome === "Position repeated")),
      blueWin: paired((t) => Number(t.outcome === "blue win")),
    },
  };
  const results = [
    {
      restricted: false,
      graph: summary(baseline, bs),
      cap100: capped(baseline, 100),
      samples: [strip(bu), strip(bo)],
    },
    {
      restricted: true,
      graph: summary(variant, vs),
      cap100: capped(variant, 100),
      samples: [strip(vu), strip(vo)],
      openingCensus: openingCensus(variant, vs),
    },
  ];
  const output = {
    format: 1,
    baselineRules: DEFAULT_RULES,
    change:
      "Only placement at E is forbidden; movement becomes fully ordinary after the sixth placement.",
    structuralModel:
      "repetition and move limit disabled; infinite play classified as draw",
    currentRulesRootProof:
      "A drawn initial position remains drawn when automatic draws are added. The restricted-centre winning rank strictly decreases, preventing repeats from a fresh game, and forces victory within three movement turns.",
    verification,
    independentRestrictedClock3: clock3,
    comparison,
    sharedMovementPositionsWithIdenticalValues: sharedMovement,
    sources: Object.fromEntries(
      [
        "src/engine/game.ts",
        "src/engine/geometry.ts",
        "src/engine/lines.ts",
        "src/engine/session.ts",
        "tools/analysis/metrics.ts",
        "tools/analysis/graph.ts",
        "tools/analysis/restricted-centre.ts",
      ].map((f) => [
        f,
        createHash("sha256").update(readFileSync(f)).digest("hex"),
      ]),
    ),
    results,
  };
  writeFileSync(
    "docs/research/restricted-centre-results.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  for (const r of results)
    console.log(
      `${r.restricted ? "Restricted centre" : "Current"}: root ${r.graph.root}, ${r.graph.states} structural states, uniform mean ${r.samples[0].meanPlies.toFixed(4)} plies.`,
    );
  console.log(
    "Verified exact graphs; saved docs/research/restricted-centre-results.json",
  );
  return output;
}
if (import.meta.url === new URL(process.argv[1], "file:").href) runExperiment();
