import {
  legalActions,
  transition,
  initialState,
  DEFAULT_RULES,
  type State,
  type PlayerId,
} from "../../src/engine/game";
import { seededRandom } from "../../src/engine/session";
import { NODES } from "../../src/engine/geometry";
import { chooseAction } from "../../src/ai/search";
import {
  canonical,
  positionKey,
  pathTo,
  boardText,
  label,
  components,
  type Graph,
  type Solution,
} from "./graph";
const score = (s: State) =>
  s.result.status === "won" ? (s.result.winner === "blue" ? 1 : -1) : 0;
export function capped(g: Graph, limit: number) {
  const memo = Array.from({ length: limit + 1 }, () =>
    new Int8Array(g.states.length).fill(2),
  );
  const boundary = g.edges.map((edges, id) =>
    edges.map((e) =>
      e.cost
        ? transition(
            {
              ...g.states[id],
              rules: { ...g.rules, moveLimit: limit },
              moves: limit - 1,
              visits: {},
            },
            e.action,
          ).state
        : null,
    ),
  );
  function value(id: number, remaining: number): number {
    const s = g.states[id];
    if (s.result.status !== "playing") return score(s);
    if (remaining === 0 && s.phase === "movement") return 0;
    if (memo[remaining][id] !== 2) return memo[remaining][id];
    const values = g.edges[id].map((e, i) =>
      e.cost && remaining === 1
        ? score(boundary[id][i]!)
        : value(e.to, remaining - e.cost),
    );
    return (memo[remaining][id] =
      s.turn === "blue" ? Math.max(...values) : Math.min(...values));
  }
  const root = value(0, limit),
    opening = g.edges[0].map((e) => ({
      action: label(e.action),
      value: value(e.to, limit),
    }));
  let current = new Set([0]),
    total = 0,
    symmetry = 0;
  const canon = g.states.map(canonical),
    layers = [];
  for (let clock = 0; clock <= limit; clock++) {
    const queue = [...current],
      next = new Set<number>(),
      lastDraws = new Map<string, State>();
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      g.edges[id].forEach((e, j) => {
        if (!e.cost) {
          if (!current.has(e.to)) {
            current.add(e.to);
            queue.push(e.to);
          }
        } else if (clock < limit) {
          if (
            clock + 1 === limit &&
            g.states[e.to].result.status === "playing"
          ) {
            const end = boundary[id][j]!;
            if (end.result.status === "playing")
              throw Error("Boundary did not terminate");
            lastDraws.set(positionKey(end), end);
          } else next.add(e.to);
        }
      });
    }
    const count = current.size,
      unique = new Set([...current].map((id) => canon[id])).size;
    total += count;
    symmetry += unique;
    layers.push({ moves: clock, states: count });
    if (clock + 1 === limit) {
      total += lastDraws.size;
      symmetry += new Set([...lastDraws.values()].map(canonical)).size;
      layers.push({ moves: limit, boundaryDraws: lastDraws.size });
    }
    current = next;
  }
  return {
    moveLimit: limit,
    repetition: null,
    root,
    opening,
    clockStates: total,
    clockSymmetry: symmetry,
    layers,
  };
}
export function movementBound(g: Graph, s: Solution, id: number): number {
  const memo = new Map<number, number>();
  function visit(v: number): number {
    if (g.states[v].result.status !== "playing") return 0;
    if (!s.winner[v]) throw Error("Not won");
    if (memo.has(v)) return memo.get(v)!;
    const owner = g.states[v].turn === (s.winner[v] === 1 ? "blue" : "gold");
    const choices = g.edges[v].filter(
      (e) =>
        s.winner[e.to] === s.winner[v] &&
        (!owner || s.distance[e.to] === s.distance[v] - 1),
    );
    const result = (owner ? Math.min : Math.max)(
      ...choices.map((e) => e.cost + visit(e.to)),
    );
    memo.set(v, result);
    return result;
  }
  return visit(id);
}
function wins(s: State, p: PlayerId) {
  const own = { ...s, turn: p, visits: {}, moves: 0 };
  return legalActions(own).flatMap((action) => {
    const end = transition(own, action).state;
    return end.result.status === "won" &&
      end.result.winner === p &&
      end.result.line.length
      ? [{ action, line: end.result.line.join("") }]
      : [];
  });
}
export function strategic(g: Graph, solution: Solution) {
  const playing = g.states
    .map((s, id) => ({ s, id }))
    .filter(({ s }) => s.result.status === "playing");
  const movements = playing.filter(({ s }) => s.phase === "movement"),
    branching: Record<string, number> = {};
  let differentOutcomes = 0,
    oneBest = 0,
    multipleBest = 0,
    onlyAction = 0;
  const meaningful = new Set<string>();
  for (const { s, id } of playing) {
    const values = g.edges[id].map((e) => solution.winner[e.to]);
    branching[values.length] = (branching[values.length] ?? 0) + 1;
    if (values.length === 1) onlyAction++;
    if (new Set(values).size > 1) {
      differentOutcomes++;
      meaningful.add(canonical(s));
    }
    const best = (s.turn === "blue" ? Math.max : Math.min)(...values),
      bestCount = values.filter((v) => v === best).length;
    if (bestCount === 1) oneBest++;
    else multipleBest++;
  }
  const center: Record<
    string,
    {
      states: number;
      toMoveWins: number;
      opponentWins: number;
      draws: number;
      meanMobility: number;
    }
  > = {};
  for (const { s, id } of movements) {
    const owner =
      s.board.E === null
        ? "vacant"
        : s.board.E === s.turn
          ? "toMove"
          : "opponent";
    const entry = (center[owner] ??= {
      states: 0,
      toMoveWins: 0,
      opponentWins: 0,
      draws: 0,
      meanMobility: 0,
    });
    entry.states++;
    const own = s.turn === "blue" ? 1 : -1;
    if (solution.winner[id] === own) entry.toMoveWins++;
    else if (solution.winner[id] === -own) entry.opponentWins++;
    else entry.draws++;
    entry.meanMobility += g.edges[id].length;
  }
  for (const c of Object.values(center)) c.meanMobility /= c.states;
  const forks = [];
  for (const { s, id } of movements) {
    const attacker = s.turn === "blue" ? "gold" : "blue",
      threats = wins(s, attacker);
    if (new Set(threats.map((t) => t.line)).size < 2) continue;
    const unavoidable = g.edges[id].every((e) => {
      const next = g.states[e.to];
      if (next.result.status !== "playing")
        return next.result.status === "won" && next.result.winner === attacker;
      return wins(next, attacker).length > 0;
    });
    if (unavoidable)
      forks.push({
        id,
        attacker,
        board: boardText(s),
        turn: s.turn,
        phase: s.phase,
        threats: threats.map((t) => ({
          action: label(t.action),
          line: t.line,
        })),
        path: pathTo(g, id).map(label),
        value: solution.winner[id],
      });
  }
  const scc = components(g),
    cycles = scc.groups.filter((c) => c.length > 1);
  const drawParents = new Map<
      number,
      {
        parent: number | null;
        action: (typeof g.edges)[number][number]["action"] | null;
        depth: number;
      }
    >([[0, { parent: null, action: null, depth: 0 }]]),
    drawQueue = [0];
  for (let h = 0; h < drawQueue.length; h++)
    for (const edge of g.edges[drawQueue[h]])
      if (solution.winner[edge.to] === 0 && !drawParents.has(edge.to)) {
        drawParents.set(edge.to, {
          parent: drawQueue[h],
          action: edge.action,
          depth: drawParents.get(drawQueue[h])!.depth + 1,
        });
        drawQueue.push(edge.to);
      }
  let cycle: number[] = [];
  outer: for (const group of cycles)
    for (const start of group) {
      if (!drawParents.has(start)) continue;
      for (const a of g.edges[start])
        for (const b of g.edges[a.to])
          for (const c of g.edges[b.to]) {
            const back = g.edges[c.to].find((e) => e.to === start);
            if (
              back &&
              [start, a.to, b.to, c.to].every(
                (id) => solution.winner[id] === 0 && drawParents.has(id),
              )
            ) {
              cycle = [start, a.to, b.to, c.to];
              break outer;
            }
          }
    }
  if (cycle.length) {
    const first = cycle.reduce(
      (best, id, i) =>
        drawParents.get(id)!.depth < drawParents.get(cycle[best])!.depth
          ? i
          : best,
      0,
    );
    cycle = [...cycle.slice(first), ...cycle.slice(0, first)];
    cycle.push(cycle[0]);
  }
  const cyclePath = [];
  if (cycle.length) {
    let id = cycle[0];
    while (drawParents.get(id)!.parent !== null) {
      cyclePath.push(drawParents.get(id)!.action!);
      id = drawParents.get(id)!.parent!;
    }
    cyclePath.reverse();
  }
  let exit: (typeof g.edges)[number][number]["action"][] = [];
  if (cycle.length) {
    const parents = new Map<
        number,
        {
          parent: number | null;
          action: (typeof g.edges)[number][number]["action"] | null;
        }
      >([[cycle[0], { parent: null, action: null }]]),
      queue = [cycle[0]];
    let end: number | undefined;
    for (let h = 0; h < queue.length && end === undefined; h++) {
      const id = queue[h];
      if (g.states[id].result.status === "won") {
        end = id;
        break;
      }
      for (const edge of g.edges[id])
        if (!parents.has(edge.to)) {
          parents.set(edge.to, { parent: id, action: edge.action });
          queue.push(edge.to);
        }
    }
    if (end !== undefined) {
      while (parents.get(end)!.parent !== null) {
        exit.push(parents.get(end)!.action!);
        end = parents.get(end)!.parent!;
      }
      exit.reverse();
    }
  }
  const cycleExample = cycle.length
    ? {
        start: cycle[0],
        board: boardText(g.states[cycle[0]]),
        path: cyclePath.map(label),
        moves: cycle
          .slice(0, -1)
          .map((id, i) =>
            label(g.edges[id].find((e) => e.to === cycle[i + 1])!.action),
          ),
        values: cycle.map((id) => solution.winner[id]),
        winningExit: exit.map(label),
      }
    : null;
  const distances = movements
    .filter(({ id }) => solution.winner[id])
    .map(({ id }) => solution.distance[id]);
  const centerLoss = movements.find(
    ({ s, id }) =>
      s.board.E === s.turn &&
      solution.winner[id] === (s.turn === "blue" ? -1 : 1),
  );
  let historyExample: null | {
    id: number;
    board: string;
    turn: PlayerId;
    path: string[];
    loop: string[];
    drawAction: string;
    freshWinner: number;
  } = null;
  if (centerLoss) {
    const start = centerLoss.id;
    outerHistory: for (const a of g.edges[start])
      for (const b of g.edges[a.to])
        for (const c of g.edges[b.to]) {
          const back = g.edges[c.to].find((e) => e.to === start);
          if (back) {
            const forbidden = new Set([start, b.to, c.to]),
              parents = new Map<
                number,
                { parent: number | null; action: typeof a.action | null }
              >([[0, { parent: null, action: null }]]),
              queue = [0];
            for (let h = 0; h < queue.length && !parents.has(a.to); h++)
              for (const edge of g.edges[queue[h]])
                if (!forbidden.has(edge.to) && !parents.has(edge.to)) {
                  parents.set(edge.to, {
                    parent: queue[h],
                    action: edge.action,
                  });
                  queue.push(edge.to);
                }
            if (!parents.has(a.to)) continue;
            const prefix: (typeof a.action)[] = [];
            let at = a.to;
            while (parents.get(at)!.parent !== null) {
              prefix.push(parents.get(at)!.action!);
              at = parents.get(at)!.parent!;
            }
            prefix.reverse();
            prefix.push(b.action, c.action, back.action);
            historyExample = {
              id: start,
              board: boardText(centerLoss.s),
              turn: centerLoss.s.turn,
              path: prefix.map(label),
              loop: [a, b, c, back].map((e) => label(e.action)),
              drawAction: label(a.action),
              freshWinner: solution.winner[start],
            };
            break outerHistory;
          }
        }
  }
  const longest = g.states
    .map((s, id) => id)
    .filter(
      (id) => g.states[id].result.status === "playing" && solution.winner[id],
    )
    .sort((a, b) => solution.distance[b] - solution.distance[a])[0];
  return {
    historyExample,
    branching,
    differentOutcomes,
    meaningfulSymmetry: meaningful.size,
    oneBest,
    multipleBest,
    onlyAction,
    center,
    centerLosingExample: (() => {
      const row = movements.find(
        ({ s, id }) =>
          s.board.E === s.turn &&
          solution.winner[id] === (s.turn === "blue" ? -1 : 1),
      );
      return row
        ? {
            id: row.id,
            board: boardText(row.s),
            turn: row.s.turn,
            path: pathTo(g, row.id).map(label),
            distance: solution.distance[row.id],
          }
        : null;
    })(),
    forks: forks.length,
    forkSymmetry: new Set(forks.map((f) => canonical(g.states[f.id]))).size,
    forkExample: forks[0] ?? null,
    cycleExample,
    cyclicStates: cycles.reduce((sum, c) => sum + c.length, 0),
    cyclicEdges: g.edges.reduce(
      (sum, edges, id) =>
        sum +
        edges.filter(
          (e) =>
            scc.membership[id] === scc.membership[e.to] &&
            cycles.some((c) => scc.membership[c[0]] === scc.membership[id]),
        ).length,
      0,
    ),
    movementRemoteness: {
      min: Math.min(...distances),
      max: Math.max(...distances),
    },
    longestExample: {
      id: longest,
      winner: solution.winner[longest],
      board: boardText(g.states[longest]),
      phase: g.states[longest].phase,
      turn: g.states[longest].turn,
      distance: solution.distance[longest],
      path: pathTo(g, longest).map(label),
    },
  };
}
export function sampleGames(
  placementWins: boolean,
  repetition: number | null,
  moveLimit: number | null,
  games = 1000,
) {
  const random = seededRandom(0x504f5454);
  const outcomes: Record<string, number> = {},
    firstCycleLengths: Record<string, number> = {};
  let repeatedGames = 0,
    totalActions = 0;
  for (let game = 0; game < games; game++) {
    let s = initialState({
        ...DEFAULT_RULES,
        placementWins,
        repetition,
        moveLimit,
      }),
      ply = 0,
      repeated = false;
    const seen = new Map<string, number>([[positionKey(s), 0]]);
    while (s.result.status === "playing") {
      const options = legalActions(s);
      s = transition(s, options[random.int(options.length)]).state;
      ply++;
      const key = positionKey({ ...s, result: { status: "playing" } }),
        previous = seen.get(key);
      if (s.result.status !== "won" && previous !== undefined && !repeated) {
        repeated = true;
        repeatedGames++;
        const length = ply - previous;
        firstCycleLengths[length] = (firstCycleLengths[length] ?? 0) + 1;
      }
      if (s.result.status !== "won") seen.set(key, ply);
      if (ply > 1000)
        throw Error("Sampling requires a terminating rule configuration");
    }
    const outcome =
      s.result.status === "won" ? s.result.winner + " win" : s.result.reason;
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    totalActions += ply;
  }
  return {
    seed: "0x504f5454",
    policy: "uniform random legal actions",
    games,
    placementWins,
    repetition,
    moveLimit,
    outcomes,
    repeatedGames,
    firstCycleLengths,
    meanActions: totalActions / games,
  };
}
export function benchmark(g: Graph, s: Solution, size = 48) {
  const groups = new Map<string, number>();
  g.states.forEach((state, id) => {
    if (
      state.result.status === "playing" &&
      new Set(g.edges[id].map((e) => s.winner[e.to])).size > 1
    )
      groups.set(canonical(state), id);
  });
  const pool = [...groups.values()],
    random = seededRandom(2042);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = random.int(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sample = pool.slice(0, size),
    rows = [];
  const live = new Map(
    sample.map((id) => {
      let state = initialState(g.rules);
      for (const action of pathTo(g, id))
        state = transition(state, action).state;
      return [id, state] as const;
    }),
  );
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    let preserving = 0,
      nodes = 0,
      depth = 0;
    const mistakes = [];
    for (const id of sample) {
      const choice = chooseAction(live.get(id)!, difficulty, 1);
      const edge = g.edges[id].find(
        (e) => JSON.stringify(e.action) === JSON.stringify(choice.action),
      );
      if (!edge) throw Error("AI returned illegal move");
      if (s.winner[edge.to] === s.winner[id]) preserving++;
      else
        mistakes.push({
          id,
          board: boardText(g.states[id]),
          turn: g.states[id].turn,
          phase: g.states[id].phase,
          best: s.winner[id],
          chosen: s.winner[edge.to],
          action: label(edge.action),
          path: pathTo(g, id).map(label),
        });
      nodes += choice.nodes;
      depth += choice.depth;
    }
    rows.push({
      difficulty,
      preserving,
      sample: sample.length,
      meanNodes: nodes / sample.length,
      meanDepth: depth / sample.length,
      firstMistake: mistakes[0] ?? null,
    });
    console.log("AI benchmark", difficulty, preserving + "/" + sample.length);
  }
  return {
    seed: 2042,
    eligibility:
      "states with differently valued legal moves; one representative per D4 orbit; shortest-path engine history",
    symmetryDistinctPool: pool.length,
    ids: sample,
    rows,
  };
}
