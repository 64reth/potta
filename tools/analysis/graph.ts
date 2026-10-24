import {
  initialState,
  legalActions,
  transition,
  type State,
  type Rules,
  type Action,
  type PlayerId,
} from "../../src/engine/game";
import {
  NODES,
  COORDINATES,
  EDGES,
  type Node,
} from "../../src/engine/geometry";
export interface Edge {
  to: number;
  action: Action;
  cost: number;
}
export interface Graph {
  rules: Rules;
  states: State[];
  edges: Edge[][];
  parents: number[][];
  paths: (number | null)[];
  incoming: (Action | null)[];
  depth: number[];
  index: Map<string, number>;
}
export function positionKey(s: State): string {
  return (
    NODES.map((n) => s.board[n]?.[0] ?? "-").join("") +
    ":" +
    s.turn +
    ":" +
    s.phase +
    ":" +
    s.placed.blue +
    s.placed.gold +
    ":" +
    (s.result.status === "won"
      ? "won:" + s.result.winner + ":" + s.result.reason
      : s.result.status === "draw"
        ? "draw:" + s.result.reason
        : "playing")
  );
}
// The eight D4 isometries preserve labelled players, phase, turn and outcome.
export const SYMMETRIES = Array.from({ length: 8 }, () => [] as Node[]);
for (let k = 0; k < 8; k++)
  for (const n of NODES) {
    let [x, y] = COORDINATES[n].map((v) => (v - 100) / 200);
    if (k >= 4) x = 2 - x;
    for (let r = 0; r < k % 4; r++) [x, y] = [2 - y, x];
    SYMMETRIES[k].push(NODES[y * 3 + x]);
  }
export function transform(s: State, map: Node[]): State {
  const t = structuredClone(s);
  for (let i = 0; i < 9; i++) t.board[map[i]] = s.board[NODES[i]];
  if (t.result.status === "won")
    t.result.line = t.result.line.map((n) => map[NODES.indexOf(n)]);
  return t;
}
export function canonical(s: State): string {
  return SYMMETRIES.map((map) => {
    const board = Object.fromEntries(
      NODES.map((n, i) => [map[i], s.board[n]]),
    ) as State["board"];
    return positionKey({ ...s, board });
  }).sort()[0];
}
export function verifySymmetries() {
  const edges = new Set(EDGES.map((e) => [...e].sort().join("")));
  for (const map of SYMMETRIES) {
    if (new Set(map).size !== 9) throw Error("Not a permutation");
    for (const [a, b] of EDGES)
      if (
        !edges.has(
          [map[NODES.indexOf(a)], map[NODES.indexOf(b)]].sort().join(""),
        )
      )
        throw Error("Graph symmetry invalid");
  }
}
export function buildGraph(
  placementWins: boolean,
  allow: (state: State, action: Action) => boolean = () => true,
): Graph {
  const rules: Rules = {
    placementWins,
    blocked: "draw",
    repetition: null,
    moveLimit: null,
  };
  const graph: Graph = {
    rules,
    states: [],
    edges: [],
    parents: [],
    paths: [],
    incoming: [],
    depth: [],
    index: new Map(),
  };
  function add(s: State, parent: number | null, action: Action | null) {
    const key = positionKey(s),
      known = graph.index.get(key);
    if (known !== undefined) return known;
    // Under disabled history rules these counters have no effect on any successor.
    s.moves = 0;
    s.visits = {};
    const id = graph.states.length;
    graph.index.set(key, id);
    graph.states.push(s);
    graph.edges.push([]);
    graph.parents.push([]);
    graph.paths.push(parent);
    graph.incoming.push(action);
    graph.depth.push(parent === null ? 0 : graph.depth[parent] + 1);
    return id;
  }
  add(initialState(rules), null, null);
  for (let id = 0; id < graph.states.length; id++)
    for (const action of legalActions(graph.states[id]).filter((action) =>
      allow(graph.states[id], action),
    )) {
      const to = add(transition(graph.states[id], action).state, id, action);
      graph.edges[id].push({
        to,
        action,
        cost: graph.states[id].phase === "movement" ? 1 : 0,
      });
      graph.parents[to].push(id);
    }
  return graph;
}
export interface Solution {
  winner: Int8Array;
  distance: Int32Array;
  attractors: Record<PlayerId, Int32Array>;
}
export function solve(graph: Graph): Solution {
  const attractors = {} as Record<PlayerId, Int32Array>;
  for (const player of ["blue", "gold"] as const) {
    const distance = new Int32Array(graph.states.length).fill(-1),
      remaining = Int32Array.from(graph.edges.map((e) => e.length)),
      longest = new Int32Array(graph.states.length),
      queue: number[] = [];
    graph.states.forEach((s, id) => {
      if (s.result.status === "won" && s.result.winner === player) {
        distance[id] = 0;
        queue.push(id);
      }
    });
    // FIFO discovery is nondecreasing in rank: owner's first child minimises distance;
    // defender enters only when every child does, and takes the maximum rank.
    for (let head = 0; head < queue.length; head++) {
      const child = queue[head];
      for (const parent of graph.parents[child]) {
        if (distance[parent] >= 0) continue;
        if (graph.states[parent].turn === player) {
          distance[parent] = distance[child] + 1;
          queue.push(parent);
        } else {
          longest[parent] = Math.max(longest[parent], distance[child]);
          if (--remaining[parent] === 0) {
            distance[parent] = longest[parent] + 1;
            queue.push(parent);
          }
        }
      }
    }
    attractors[player] = distance;
  }
  const winner = new Int8Array(graph.states.length),
    distance = new Int32Array(graph.states.length).fill(-1);
  for (let id = 0; id < winner.length; id++) {
    if (attractors.blue[id] >= 0 && attractors.gold[id] >= 0)
      throw Error("Overlapping attractors");
    if (attractors.blue[id] >= 0) {
      winner[id] = 1;
      distance[id] = attractors.blue[id];
    }
    if (attractors.gold[id] >= 0) {
      winner[id] = -1;
      distance[id] = attractors.gold[id];
    }
  }
  return { winner, distance, attractors };
}
export function checkSolution(g: Graph, s: Solution) {
  for (let id = 0; id < g.states.length; id++) {
    const state = g.states[id];
    if (state.result.status !== "playing") continue;
    const values = g.edges[id].map((e) => s.winner[e.to]),
      best = state.turn === "blue" ? Math.max(...values) : Math.min(...values);
    if (best !== s.winner[id]) throw Error("Bellman mismatch " + id);
    if (s.winner[id]) {
      const children = g.edges[id].filter(
        (e) => s.winner[e.to] === s.winner[id],
      );
      const rank =
        (state.turn === (s.winner[id] === 1 ? "blue" : "gold")
          ? Math.min(...children.map((e) => s.distance[e.to]))
          : Math.max(...children.map((e) => s.distance[e.to]))) + 1;
      if (rank !== s.distance[id]) throw Error("Remoteness mismatch " + id);
    }
  }
}
export function pathTo(g: Graph, id: number): Action[] {
  const out: Action[] = [];
  while (g.paths[id] !== null) {
    out.push(g.incoming[id]!);
    id = g.paths[id]!;
  }
  return out.reverse();
}
export const label = (a: Action) =>
  a.type === "place" ? a.to : a.from + "–" + a.to;
export function boardText(s: State): string {
  return [0, 3, 6]
    .map((i) =>
      NODES.slice(i, i + 3)
        .map((n) =>
          s.board[n] === "blue" ? "X" : s.board[n] === "gold" ? "O" : ".",
        )
        .join(" "),
    )
    .join("\n");
}
export function principalVariation(g: Graph, solution: Solution, start = 0) {
  const sequence: Action[] = [];
  let id = start;
  const seen = new Set<number>();
  while (g.edges[id].length && !seen.has(id)) {
    seen.add(id);
    const value = solution.winner[id];
    let candidates = g.edges[id].filter((e) => solution.winner[e.to] === value);
    if (value)
      candidates = candidates.sort(
        (a, b) =>
          (solution.distance[a.to] - solution.distance[b.to]) *
          (g.states[id].turn === (value === 1 ? "blue" : "gold") ? 1 : -1),
      );
    if (!candidates.length) throw Error("No preserving action");
    const edge = candidates[0];
    sequence.push(edge.action);
    id = edge.to;
  }
  return {
    sequence,
    end: id,
    cycle: seen.has(id) && g.states[id].result.status === "playing",
  };
}
export function components(g: Graph) {
  // Iterative Kosaraju avoids relying on the host's recursion stack.
  const seen = new Uint8Array(g.states.length),
    order: number[] = [];
  for (let start = 0; start < seen.length; start++)
    if (!seen[start]) {
      const stack: [number, number][] = [[start, 0]];
      seen[start] = 1;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top[1] < g.edges[top[0]].length) {
          const to = g.edges[top[0]][top[1]++].to;
          if (!seen[to]) {
            seen[to] = 1;
            stack.push([to, 0]);
          }
        } else {
          order.push(top[0]);
          stack.pop();
        }
      }
    }
  const groups: number[][] = [],
    membership = new Int32Array(g.states.length).fill(-1);
  for (const start of order.reverse())
    if (membership[start] < 0) {
      const group: number[] = [],
        stack = [start],
        id = groups.length;
      membership[start] = id;
      while (stack.length) {
        const v = stack.pop()!;
        group.push(v);
        for (const p of g.parents[v])
          if (membership[p] < 0) {
            membership[p] = id;
            stack.push(p);
          }
      }
      groups.push(group);
    }
  return { groups, membership };
}
