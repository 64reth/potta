import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { potta } from "../../src/engine/game";
import {
  buildGraph,
  solve,
  canonical,
  checkSolution,
  verifySymmetries,
  principalVariation,
  label,
  components,
  boardText,
} from "./graph";
import {
  capped,
  strategic,
  sampleGames,
  benchmark,
  movementBound,
} from "./metrics";
verifySymmetries();
const result = [];
for (const placementWins of [false, true]) {
  const graph = buildGraph(placementWins),
    solution = solve(graph);
  checkSolution(graph, solution);
  const count = (ids: number[]) => ({
    total: ids.length,
    blue: ids.filter((id) => solution.winner[id] === 1).length,
    gold: ids.filter((id) => solution.winner[id] === -1).length,
    draw: ids.filter((id) => solution.winner[id] === 0).length,
  });
  const ids = graph.states.map((_, i) => i),
    scc = components(graph),
    pv = principalVariation(graph, solution),
    caps = [2, 3, 4, 10, 100].map((limit) => capped(graph, limit));
  const data = {
    placementWins,
    states: graph.states.length,
    symmetry: new Set(graph.states.map(canonical)).size,
    edges: graph.edges.reduce((s, e) => s + e.length, 0),
    counts: count(ids),
    playing: count(
      ids.filter((id) => graph.states[id].result.status === "playing"),
    ),
    movement: count(
      ids.filter(
        (id) =>
          graph.states[id].phase === "movement" &&
          graph.states[id].result.status === "playing",
      ),
    ),
    root: solution.winner[0],
    distance: solution.distance[0],
    movementBound: solution.winner[0]
      ? movementBound(graph, solution, 0)
      : null,
    maxDistance: Math.max(...solution.distance),
    maxShortestReach: Math.max(...graph.depth),
    opening: graph.edges[0].map((e) => ({
      action: label(e.action),
      value: solution.winner[e.to],
      distance: solution.distance[e.to],
    })),
    principal: pv.sequence.map(label),
    principalEnd: { board: boardText(graph.states[pv.end]), cycle: pv.cycle },
    cyclicComponents: scc.groups
      .filter((c) => c.length > 1)
      .map((c) => c.length),
    strategy: strategic(graph, solution),
    caps,
    historyRoots: [2, 3].flatMap((repetition) =>
      [null, 2, 3, 4, 10, 100].map((moveLimit) => {
        const base =
          moveLimit === null
            ? solution.winner[0]
            : caps.find((c) => c.moveLimit === moveLimit)!.root;
        const preserved =
          base === 0 ||
          movementBound(graph, solution, 0) <= (moveLimit ?? Infinity);
        if (!preserved) throw Error("Root proof not established");
        return {
          repetition,
          moveLimit,
          root: base,
          basis:
            base === 0
              ? "non-losing strategies survive added automatic draws"
              : "strictly rank-decreasing winning strategy within movement budget",
        };
      }),
    ),
    samples: [2, 3, null].map((repetition) =>
      sampleGames(placementWins, repetition, 100),
    ),
    ai: benchmark(graph, solution),
  };
  console.log(
    "Solved",
    placementWins ? "placement wins" : "movement wins",
    data.states,
    "states",
  );
  result.push(data);
}
writeFileSync(
  "docs/research/results.json",
  JSON.stringify(
    {
      format: 1,
      engineVersion: potta.version,
      sources: Object.fromEntries(
        [
          "src/engine/game.ts",
          "src/engine/geometry.ts",
          "src/engine/lines.ts",
          "src/engine/session.ts",
          "src/ai/search.ts",
        ].map((file) => [
          file,
          createHash("sha256").update(readFileSync(file)).digest("hex"),
        ]),
      ),
      config: {
        blocked: "draw",
        infinitePlay: "draw for mathematical classification only",
      },
      variants: result,
    },
    null,
    2,
  ) + "\n",
);
