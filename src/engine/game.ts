import { type Node } from "./geometry";
import { boardGeometry, type BoardSize } from "./boards";
import type { GameDefinition, GameEvent } from "./session";
export type PlayerId = "blue" | "gold";
export type Action =
  | { type: "place"; to: Node }
  | { type: "move"; from: Node; to: Node };
export interface Rules {
  boardSize?: BoardSize;
  placementWins: boolean;
  blocked: "loss" | "draw" | "pass";
  repetition: number | null;
  moveLimit: number | null;
}
/** Provisional house rules; not a claim of authenticated tradition. */
export const DEFAULT_RULES: Rules = {
  placementWins: false,
  blocked: "draw",
  repetition: 3,
  moveLimit: 100,
};
export interface State {
  board: Record<Node, PlayerId | null>;
  turn: PlayerId;
  phase: "placement" | "movement";
  placed: Record<PlayerId, number>;
  moves: number;
  visits: Record<string, number>;
  rules: Rules;
  result:
    | { status: "playing" }
    | { status: "won"; winner: PlayerId; line: readonly Node[]; reason: string }
    | { status: "draw"; reason: string };
}
export const other = (p: PlayerId): PlayerId =>
  p === "blue" ? "gold" : "blue";
export const geometryFor = (s: State) => boardGeometry(s.rules.boardSize ?? 3);
const key = (s: State) =>
  geometryFor(s)
    .nodes.map((n) => s.board[n]?.[0] ?? "-")
    .join("") +
  ":" +
  s.turn +
  ":" +
  s.phase;
export function movesFor(s: State, p: PlayerId): Action[] {
  const geometry = geometryFor(s);
  return geometry.nodes.flatMap((from) =>
    s.board[from] === p
      ? geometry.adjacency[from]
          .filter((to) => !s.board[to])
          .map((to) => ({ type: "move" as const, from, to }))
      : [],
  );
}
export function legalActions(s: State, p: string = s.turn): Action[] {
  if (s.result.status !== "playing" || p !== s.turn) return [];
  return s.phase === "placement"
    ? geometryFor(s)
        .nodes.filter((to) => !s.board[to])
        .map((to) => ({ type: "place", to }))
    : movesFor(s, s.turn);
}
export function initialState(
  rules: Rules = DEFAULT_RULES,
  first: PlayerId = "blue",
): State {
  validateRules(rules);
  const s: State = {
    board: Object.fromEntries(
      boardGeometry(rules.boardSize ?? 3).nodes.map((n) => [n, null]),
    ) as State["board"],
    turn: first,
    phase: "placement",
    placed: { blue: 0, gold: 0 },
    moves: 0,
    visits: {},
    rules: structuredClone(rules),
    result: { status: "playing" },
  };
  s.visits[key(s)] = 1;
  return s;
}
function validateRules(r: Rules) {
  if (
    ![3, 4, 5].includes(r.boardSize ?? 3) ||
    typeof r.placementWins !== "boolean" ||
    !["loss", "draw", "pass"].includes(r.blocked) ||
    ![r.repetition, r.moveLimit].every(
      (n) => n === null || (Number.isSafeInteger(n) && n >= 2),
    )
  )
    throw Error("Invalid rules");
}
export function transition(
  state: State,
  action: Action,
  player: string = state.turn,
): { state: State; events: GameEvent[] } {
  if (
    !legalActions(state, player).some(
      (a) =>
        a.type === action.type &&
        a.to === action.to &&
        (a.type !== "move" ||
          (action.type === "move" && a.from === action.from)),
    )
  )
    throw Error("Illegal action");
  const s = structuredClone(state),
    events: GameEvent[] = [];
  const p = s.turn;
  const wasMovement = s.phase === "movement";
  if (action.type === "move") {
    s.board[action.from] = null;
    s.moves++;
  } else s.placed[p]++;
  s.board[action.to] = p;
  events.push({
    type: action.type,
    message:
      action.type === "place"
        ? `${p} placed at ${action.to}`
        : `${p} moved ${action.from}–${action.to}`,
  });
  const line = geometryFor(s).lines.find((l) =>
    l.every((n) => s.board[n] === p),
  );
  if (line && (wasMovement || s.rules.placementWins)) {
    s.result = {
      status: "won",
      winner: p,
      line,
      reason:
        `${["", "", "", "Three", "Four", "Five"][geometryFor(s).target]} in a line`,
    };
    events.push({ type: "won", message: `${p} wins` });
    return { state: s, events };
  }
  if (
    s.placed.blue === geometryFor(s).pieces &&
    s.placed.gold === geometryFor(s).pieces
  )
    s.phase = "movement";
  s.turn = other(p);
  if (s.phase === "movement" && movesFor(s, s.turn).length === 0) {
    if (movesFor(s, p).length === 0 || s.rules.blocked === "draw")
      s.result = { status: "draw", reason: "No available move" };
    else if (s.rules.blocked === "loss")
      s.result = {
        status: "won",
        winner: p,
        line: [],
        reason: "Opponent has no available move",
      };
    else {
      events.push({
        type: "passed",
        message: `${s.turn} has no move; turn passed`,
      });
      s.turn = p;
    }
  }
  const k = key(s);
  s.visits[k] = (s.visits[k] ?? 0) + 1;
  if (
    s.result.status === "playing" &&
    s.rules.repetition !== null &&
    s.visits[k] >= s.rules.repetition
  )
    s.result = { status: "draw", reason: "Position repeated" };
  if (
    s.result.status === "playing" &&
    s.rules.moveLimit !== null &&
    s.moves >= s.rules.moveLimit
  )
    s.result = { status: "draw", reason: "Movement limit reached" };
  if (s.result.status !== "playing")
    events.push({ type: s.result.status, message: s.result.reason });
  events.push({ type: "turn", message: `${s.turn} to play` });
  return { state: s, events };
}
export const potta: GameDefinition<State, Action, Rules> = {
  id: "potta",
  version: 2,
  validateConfig(r, players) {
    validateRules(r);
    if (
      players.length !== 2 ||
      players[0].id !== "blue" ||
      players[1].id !== "gold"
    )
      throw Error("Potta requires blue and gold players");
  },
  initialise: (r) => initialState(r),
  legalActions,
  transition,
  outcome: (s) =>
    s.result.status === "won"
      ? { status: "won", winners: [s.result.winner], reason: s.result.reason }
      : s.result,
};

/** Version 1 recordings retain exactly the Traditional transition semantics. */
export const legacyPotta: typeof potta = {
  ...potta,
  version: 1,
  validateConfig(r, p) {
    potta.validateConfig(r, p);
    if ((r.boardSize ?? 3) !== 3)
      throw Error("Legacy recordings require Traditional");
  },
};
