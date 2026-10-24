import assert from "node:assert/strict";
import {
  initialState,
  transition,
  legalActions,
  DEFAULT_RULES,
  type State,
  type Action,
} from "../../src/engine/game";
import { NODES } from "../../src/engine/geometry";
import { WINNING_LINES } from "../../src/engine/lines";
import {
  buildGraph,
  solve,
  checkSolution,
  positionKey,
  canonical,
  SYMMETRIES,
  transform,
  pathTo,
  principalVariation,
  verifySymmetries,
} from "./graph";
import { capped, strategic, movementBound } from "./metrics";
verifySymmetries();
const resultScore = (s: State) =>
  s.result.status === "won" ? (s.result.winner === "blue" ? 1 : -1) : 0;
for (const placementWins of [false, true]) {
  const g = buildGraph(placementWins),
    solution = solve(g);
  checkSolution(g, solution);
  assert.equal(solution.winner[0], placementWins ? 1 : 0);
  // Independent synchronous fixed-point attractor computation (no queue/remoteness reuse).
  for (const player of ["blue", "gold"] as const) {
    let ranks = Int32Array.from(
        g.states.map((s) =>
          s.result.status === "won" && s.result.winner === player ? 0 : -1,
        ),
      ),
      round = 0;
    for (;;) {
      const next = ranks.slice();
      let changed = false;
      round++;
      for (let id = 0; id < g.states.length; id++)
        if (ranks[id] < 0 && g.edges[id].length) {
          const children = g.edges[id].map((e) => ranks[e.to] >= 0);
          if (
            g.states[id].turn === player
              ? children.some(Boolean)
              : children.every(Boolean)
          ) {
            next[id] = round;
            changed = true;
          }
        }
      ranks = next;
      if (!changed) break;
    }
    assert.deepEqual(ranks, solution.attractors[player]);
  }
  let transitions = 0;
  for (let id = 0; id < g.states.length; id++)
    for (const map of SYMMETRIES) {
      const mapped = transform(g.states[id], map),
        mappedId = g.index.get(positionKey(mapped));
      assert.notEqual(mappedId, undefined);
      assert.equal(solution.winner[id], solution.winner[mappedId!]);
      assert.equal(solution.distance[id], solution.distance[mappedId!]);
      for (const edge of g.edges[id]) {
        const action: Action =
          edge.action.type === "place"
            ? { type: "place", to: map[NODES.indexOf(edge.action.to)] }
            : {
                type: "move",
                from: map[NODES.indexOf(edge.action.from)],
                to: map[NODES.indexOf(edge.action.to)],
              };
        assert.equal(
          positionKey(transition(mapped, action).state),
          positionKey(transform(g.states[edge.to], map)),
        );
        transitions++;
      }
    }
  for (const map of SYMMETRIES)
    for (const line of WINNING_LINES) {
      const mapped = line
        .map((n) => map[NODES.indexOf(n)])
        .sort()
        .join("");
      assert.ok(WINNING_LINES.some((l) => [...l].sort().join("") === mapped));
    }
  // Independent literal clock-expanded engine traversal for small horizons.
  for (const limit of [2, 3, 4]) {
    const rules = { ...g.rules, moveLimit: limit },
      states: State[] = [initialState(rules)],
      edges: number[][] = [[]],
      index = new Map([[positionKey(states[0]) + ":0", 0]]);
    for (let id = 0; id < states.length; id++)
      for (const action of legalActions(states[id])) {
        const child = transition(states[id], action).state;
        child.visits = {};
        const key = positionKey(child) + ":" + child.moves;
        let to = index.get(key);
        if (to === undefined) {
          to = states.length;
          index.set(key, to);
          states.push(child);
          edges.push([]);
        }
        edges[id].push(to);
      }
    const memo = new Map<number, number>();
    function value(id: number): number {
      if (memo.has(id)) return memo.get(id)!;
      const s = states[id];
      const v =
        s.result.status !== "playing"
          ? resultScore(s)
          : (s.turn === "blue" ? Math.max : Math.min)(...edges[id].map(value));
      memo.set(id, v);
      return v;
    }
    const compressed = capped(g, limit);
    assert.equal(compressed.clockStates, states.length);
    assert.equal(compressed.root, value(0));
    assert.equal(
      compressed.clockSymmetry,
      new Set(states.map((state) => canonical(state) + ":" + state.moves)).size,
    );
  }
  const metrics = strategic(g, solution);
  for (let id = 0; id < g.states.length; id++)
    for (const e of g.edges[id]) {
      assert.notEqual(e.to, id);
      assert.ok(!g.edges[e.to].some((back) => back.to === id));
      if (g.states[e.to].result.status === "playing")
        assert.notEqual(g.states[id].turn, g.states[e.to].turn);
    }
  const history = metrics.historyExample!;
  function applyLabels(s: State, moves: string[]) {
    for (const text of moves) {
      const a = legalActions(s).find(
        (a) => (a.type === "place" ? a.to : a.from + "–" + a.to) === text,
      );
      assert.ok(a);
      s = transition(s, a).state;
    }
    return s;
  }
  const fresh = applyLabels(
    initialState({ ...DEFAULT_RULES, placementWins }),
    history.path,
  );
  for (const action of legalActions(fresh)) {
    const child = transition(fresh, action).state;
    assert.equal(child.result.status, "playing");
    assert.ok(
      legalActions(child).some((reply) => {
        const end = transition(child, reply).state;
        return (
          end.result.status === "won" &&
          end.result.winner === (fresh.turn === "blue" ? "gold" : "blue")
        );
      }),
    );
  }
  const returned = applyLabels(fresh, history.loop);
  assert.equal(positionKey(returned), positionKey(fresh));
  assert.notDeepEqual(returned.visits, fresh.visits);
  assert.deepEqual(applyLabels(returned, [history.drawAction]).result, {
    status: "draw",
    reason: "Position repeated",
  });
  const fork = metrics.forkExample!;
  const forkState = applyLabels(
    initialState({ ...DEFAULT_RULES, placementWins }),
    fork.path,
  );
  for (const action of legalActions(forkState)) {
    const child = transition(forkState, action).state;
    assert.equal(child.result.status, "playing");
    assert.ok(
      legalActions(child).some((reply) => {
        const end = transition(child, reply).state;
        return (
          end.result.status === "won" && end.result.winner === fork.attacker
        );
      }),
    );
  }
  const exit = applyLabels(
    applyLabels(initialState(g.rules), metrics.cycleExample!.path),
    metrics.cycleExample!.winningExit,
  );
  assert.equal(exit.result.status, "won");

  for (const id of [
    metrics.longestExample.id,
    metrics.forkExample!.id,
    metrics.centerLosingExample!.id,
  ]) {
    let s = initialState(g.rules);
    for (const action of pathTo(g, id)) s = transition(s, action).state;
    assert.equal(positionKey(s), positionKey(g.states[id]));
  }
  const longest = principalVariation(g, solution, metrics.longestExample.id);
  assert.equal(
    longest.sequence.length,
    solution.distance[metrics.longestExample.id],
  );
  assert.equal(
    resultScore(g.states[longest.end]),
    solution.winner[metrics.longestExample.id],
  );
  let liveLongest = initialState({ ...DEFAULT_RULES, placementWins });
  for (const action of [
    ...pathTo(g, metrics.longestExample.id),
    ...longest.sequence,
  ])
    liveLongest = transition(liveLongest, action).state;
  assert.equal(
    resultScore(liveLongest),
    solution.winner[metrics.longestExample.id],
  );

  // Replay a graph-derived four-ply cycle with real history, never clearing visits.
  const example = metrics.cycleExample!;
  let cycleStart = initialState({ ...DEFAULT_RULES, placementWins });
  for (const text of example.path) {
    const action = legalActions(cycleStart).find(
      (a) => (a.type === "place" ? a.to : a.from + "–" + a.to) === text,
    )!;
    assert.ok(action);
    cycleStart = transition(cycleStart, action).state;
  }
  function around(s: State) {
    for (const text of example.moves) {
      const action = legalActions(s).find(
        (a) => a.type === "move" && a.from + "–" + a.to === text,
      )!;
      assert.ok(action);
      s = transition(s, action).state;
    }
    return s;
  }
  const second = around(cycleStart);
  assert.equal(second.result.status, "playing");
  assert.equal(positionKey(second), positionKey(cycleStart));
  const third = around(second);
  assert.deepEqual(third.result, {
    status: "draw",
    reason: "Position repeated",
  });
  if (placementWins) {
    assert.equal(solution.distance[0], 9);
    assert.equal(movementBound(g, solution, 0), 3);
    let s = initialState({ ...DEFAULT_RULES, placementWins });
    for (const a of principalVariation(g, solution).sequence)
      s = transition(s, a).state;
    assert.equal(resultScore(s), 1);
  }
  console.log(
    `Verified ${placementWins ? "placement" : "movement"} wins: ${transitions} symmetry/engine edge checks, independent attractors, literal clock graphs, live-history witnesses.`,
  );
}
