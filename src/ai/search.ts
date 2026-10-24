import {
  legalActions,
  geometryFor,
  transition,
  movesFor,
  other,
  type Action,
  type State,
  type PlayerId,
} from "../engine/game";
import { seededRandom } from "../engine/session";
export type Difficulty = "easy" | "normal" | "hard";
export interface SearchResult {
  action: Action | null;
  nodes: number;
  depth: number;
  score: number;
}
const LIMIT = 100000;
function evaluate(s: State, me: PlayerId): number {
  if (s.result.status === "draw") return 0;
  if (s.result.status === "won") return s.result.winner === me ? LIMIT : -LIMIT;
  const enemy = other(me);
  let value = 0;
  for (const line of geometryFor(s).lines) {
    const a = line.filter((n) => s.board[n] === me).length,
      b = line.filter((n) => s.board[n] === enemy).length;
    if (!b) value += [0, 3, 32, 80, 180, 400][a];
    if (!a) value -= [0, 3, 36, 80, 180, 400][b];
  }
  for (const n of geometryFor(s).centres)
    value += s.board[n] === me ? 12 : s.board[n] === enemy ? -12 : 0;
  if (s.phase === "movement")
    value += 2 * (movesFor(s, me).length - movesFor(s, enemy).length);
  return value;
}
// History is part of a position: identical boards with different repetition counts
// or remaining movement turns must never share a transposition evaluation.
export function searchKey(s: State): string {
  return (
    geometryFor(s)
      .nodes.map((n) => s.board[n]?.[0] ?? "-")
      .join("") +
    s.turn +
    s.phase +
    ":" +
    s.moves +
    ":" +
    JSON.stringify(
      Object.entries(s.visits).sort(([a], [b]) => a.localeCompare(b)),
    ) +
    JSON.stringify(s.rules)
  );
}
export function chooseAction(
  s: State,
  difficulty: Difficulty,
  seed = 1,
): SearchResult {
  const actions = legalActions(s),
    me = s.turn;
  if (!actions.length)
    return { action: null, nodes: 0, depth: 0, score: evaluate(s, me) };
  const ranked = (state: State) =>
    legalActions(state)
      .map((action) => ({ action, state: transition(state, action).state }))
      .sort(
        (a, b) =>
          (evaluate(b.state, me) - evaluate(a.state, me)) *
          (state.turn === me ? 1 : -1),
      );
  const root = ranked(s),
    win = root.find(
      (r) => r.state.result.status === "won" && r.state.result.winner === me,
    );
  if (win)
    return { action: win.action, nodes: root.length, depth: 1, score: LIMIT };
  if (difficulty === "easy") {
    // Seeded imperfection: favour useful positions but sometimes miss a block.
    const random = seededRandom(
      seed +
        geometryFor(s).nodes.reduce(
          (v, n, i) =>
            v + (s.board[n] === me ? 1 : s.board[n] ? 2 : 0) * 3 ** i,
          0,
        ),
    );
    const choice =
      random.next() < 0.65 ? root[0] : root[random.int(root.length)];
    return {
      action: choice.action,
      nodes: root.length,
      depth: 1,
      score: evaluate(choice.state, me),
    };
  }
  const larger = geometryFor(s).size > 3;
  const budget =
      difficulty === "hard" ? (larger ? 2400 : 24000) : larger ? 600 : 1800,
    maxDepth = difficulty === "hard" ? (larger ? 4 : 12) : larger ? 2 : 3;
  let nodes = 0,
    best = root[0].action,
    bestScore = evaluate(root[0].state, me),
    completed = 0;
  const cache = new Map<
    string,
    { score: number; flag: "exact" | "lower" | "upper" }
  >();
  const exhausted = {};
  function visit(
    state: State,
    depth: number,
    alpha: number,
    beta: number,
  ): number {
    if (++nodes > budget) throw exhausted;
    if (state.result.status !== "playing") return evaluate(state, me);
    if (depth === 0) return evaluate(state, me);
    const key = searchKey(state) + ":" + depth,
      hit = cache.get(key);
    if (hit) {
      if (hit.flag === "exact") return hit.score;
      if (hit.flag === "lower") alpha = Math.max(alpha, hit.score);
      else beta = Math.min(beta, hit.score);
      if (alpha >= beta) return hit.score;
    }
    // Classify against the effective window after a cached bound narrows it.
    const startA = alpha,
      startB = beta;
    const maximizing = state.turn === me;
    let score = maximizing ? -Infinity : Infinity;
    for (const child of ranked(state)) {
      const value = visit(child.state, depth - 1, alpha, beta);
      score = maximizing ? Math.max(score, value) : Math.min(score, value);
      if (maximizing) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    if (!Number.isFinite(score)) score = 0;
    cache.set(key, {
      score,
      flag: score <= startA ? "upper" : score >= startB ? "lower" : "exact",
    });
    return score;
  }
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best,
      score = -Infinity,
      alpha = -Infinity;
    try {
      for (const child of root) {
        const value = visit(child.state, depth - 1, alpha, Infinity);
        if (value > score) {
          score = value;
          iterationBest = child.action;
        }
        alpha = Math.max(alpha, score);
      }
    } catch (error) {
      if (error !== exhausted) throw error;
      break;
    }
    best = iterationBest;
    bestScore = score;
    completed = depth;
    root.sort((a, b) =>
      JSON.stringify(a.action) === JSON.stringify(best)
        ? -1
        : JSON.stringify(b.action) === JSON.stringify(best)
          ? 1
          : 0,
    );
    if (Math.abs(score) >= LIMIT) break;
  }
  return { action: best, nodes, depth: completed, score: bestScore };
}
