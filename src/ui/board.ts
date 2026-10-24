import {
  legalActions,
  type State,
  type Action,
  type PlayerId,
} from "../engine/game";
import { NODES, COORDINATES, EDGES, type Node } from "../engine/geometry";
export interface BoardContext {
  canPlay: boolean;
  label: string;
  message?: string;
  online?: boolean;
  busy?: boolean;
}
export function mountBoard(
  app: HTMLElement,
  initial: State,
  initialContext: BoardContext,
  callbacks: {
    action: (action: Action) => void;
    reset: () => void;
    home: () => void;
  },
) {
  let current = initial,
    context = initialContext,
    selected: Node | null = null;
  // Project the existing graph into a tighter viewport; engine coordinates stay unchanged.
  const boardPercent = (coordinate: number) => (coordinate - 60) / 4.8;
  const name = (p: PlayerId) => (p === "blue" ? "Azure" : "Ochre");

  app.innerHTML = `<main class="shell playing">
<header><button id="menu" class="wordmark" aria-label="Main menu">POTTA <span>↖</span></button><div class="edition">HERITAGE GAMES <span>004</span></div><button id="rules" class="quiet">How to play <span>↗</span></button></header>
<section class="game-heading"><div class="eyebrow">BARBADOS · TWO PLAYERS · ONE BOARD</div><p>Three pieces. Nine places. Your next move matters.</p></section>
<section class="table" aria-label="Potta game">
<div class="table-top"><span id="phase"></span><span class="local" id="mode-label"></span></div>
<div class="arena"><svg class="board" viewBox="60 60 480 480" role="group" aria-label="Nine-position Potta board">
<defs><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs>
<g class="connections">${EDGES.map(([a, b]) => `<line x1="${COORDINATES[a][0]}" y1="${COORDINATES[a][1]}" x2="${COORDINATES[b][0]}" y2="${COORDINATES[b][1]}"/>`).join("")}</g>
<g class="sockets">${NODES.map((n) => `<circle cx="${COORDINATES[n][0]}" cy="${COORDINATES[n][1]}" r="9"/>`).join("")}</g>
<g id="winning"></g></svg>
<div class="node-layer">${NODES.map((n) => `<button class="node" data-node="${n}" style="left:${boardPercent(COORDINATES[n][0])}%;top:${boardPercent(COORDINATES[n][1])}%"><span class="destination"></span><span class="node-letter">${n}</span></button>`).join("")}</div><div id="pieces" aria-hidden="true"></div>
</div>
<div class="players"><div id="blue-player" class="player blue"><span class="mini-piece"></span><div><strong>Azure</strong><span class="reserve" id="blue-reserve"></span></div><span class="turn-tag">YOUR TURN</span></div><div class="versus">×</div><div id="gold-player" class="player gold"><span class="mini-piece"></span><div><strong>Ochre</strong><span class="reserve" id="gold-reserve"></span></div><span class="turn-tag">YOUR TURN</span></div></div>
</section>
<section class="game-bottom"><div class="status" role="status" aria-live="polite" aria-atomic="true"><span id="status-dot"></span><div><h2 id="status-title"></h2><p id="instruction"></p></div></div><button id="restart" class="restart">New game <span>↻</span></button></section>
<footer><span>A BARBADIAN TRADITION. A NEW WAY TO PLAY.</span><span>Made for a shared moment.</span></footer>
<dialog id="rules-dialog"><button class="close" aria-label="Close how to play">×</button><div class="eyebrow">THE ART OF THREE</div><h2>How to play Potta</h2><ol><li><strong>Place.</strong> Take turns putting your three pieces on empty points. Azure begins.</li><li><strong>Move.</strong> After all six pieces are placed, select one of yours and move it to a highlighted, connected empty point. Every move follows one edge. No jumps.</li><li><strong>Align.</strong> During movement, make a row, column or corner-to-corner diagonal of three to win.</li></ol><p class="rule-note">Build 001 uses provisional rules: placement alignments do not win. A blocked turn, a position repeated three times (including whose turn it is), or 100 movement turns ends in a draw. These choices await historical verification.</p><button class="primary close-rules">Let’s play</button></dialog>
<dialog id="reset-dialog"><h2>A fresh board?</h2><p>This will end your current game.</p><div class="dialog-actions"><button class="quiet cancel-reset">Keep playing</button><button class="primary confirm-reset">Start new game</button></div></dialog>
</main>`;
  const rail = document.createElement("aside");
  rail.className = "game-rail";
  rail.setAttribute("aria-label", "Players and game controls");
  for (const selector of [".table-top", ".players", ".game-bottom"])
    rail.append(app.querySelector(selector)!);
  app.querySelector("main")!.append(rail);
  const $ = (id: string) => document.getElementById(id)!;
  const pieceIds: Record<PlayerId, Map<Node, number>> = {
    blue: new Map(),
    gold: new Map(),
  };
  let winningKey = "",
    snapshot = "";
  function render() {
    const s = current,
      ended = s.result.status !== "playing";
    for (const p of ["blue", "gold"] as const) {
      for (const node of pieceIds[p].keys())
        if (s.board[node] !== p) pieceIds[p].delete(node);
      for (const node of NODES)
        if (s.board[node] === p && !pieceIds[p].has(node)) {
          const used = new Set(pieceIds[p].values());
          pieceIds[p].set(node, [0, 1, 2].find((id) => !used.has(id))!);
        }
      for (let id = 0; id < 3; id++)
        if (![...pieceIds[p].values()].includes(id))
          document.getElementById(`piece-${p}-${id}`)?.remove();
    }
    const legal = context.canPlay ? legalActions(s) : [];
    const destinations = legal
      .filter((a) => a.type === "place" || a.from === selected)
      .map((a) => a.to);
    $("phase").textContent =
      s.phase === "placement"
        ? `01 / PLACE YOUR PIECES`
        : "02 / MOVE INTO LINE";
    for (const p of ["blue", "gold"] as const) {
      $(`${p}-player`).classList.toggle("active", !ended && s.turn === p);
      $(`${p}-player`).querySelector(".turn-tag")!.textContent = context.online
        ? "TO PLAY"
        : context.label.startsWith("SOLO") && p === "gold"
          ? "COMPUTER"
          : "YOUR TURN";
      $(`${p}-reserve`).innerHTML = Array.from(
        { length: 3 },
        (_, i) => `<i class="${i < s.placed[p] ? "used" : ""}"></i>`,
      ).join("");
      for (const [node, id] of pieceIds[p]) {
        let el = document.getElementById(`piece-${p}-${id}`);
        if (!el) {
          el = document.createElement("span");
          el.id = `piece-${p}-${id}`;
          el.className = `piece ${p}`;
          $("pieces").append(el);
        }
        el.style.left = `${boardPercent(COORDINATES[node][0])}%`;
        el.style.top = `${boardPercent(COORDINATES[node][1])}%`;
        el.classList.toggle("selected", node === selected);
        el.classList.toggle(
          "victorious",
          s.result.status === "won" && s.result.line.includes(node),
        );
      }
    }
    for (const n of NODES) {
      const b = document.querySelector<HTMLButtonElement>(
        `[data-node="${n}"]`,
      )!;
      const actionable =
        !ended &&
        context.canPlay &&
        (destinations.includes(n) ||
          (s.phase === "movement" && s.board[n] === s.turn));
      b.classList.toggle("legal", destinations.includes(n) && !s.board[n]);
      b.classList.toggle("selectable", actionable);
      b.setAttribute("aria-disabled", String(!actionable));
      b.setAttribute("aria-pressed", String(selected === n));
      b.setAttribute(
        "aria-label",
        `${n}: ${s.board[n] ? name(s.board[n]!) + " piece" : "empty"}${destinations.includes(n) ? ", legal destination" : ""}`,
      );
    }
    const nextWinningKey =
      s.result.status === "won"
        ? s.result.winner + ":" + s.result.line.join(",")
        : "";
    if (nextWinningKey !== winningKey) {
      winningKey = nextWinningKey;
      $("winning").innerHTML =
        s.result.status === "won" && s.result.line.length
          ? (() => {
              const a = COORDINATES[s.result.line[0]],
                b = COORDINATES[s.result.line[2]];
              return `<line class="win-line ${s.result.winner}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
            })()
          : "";
    }
    $("status-dot").className = ended ? "ended" : s.turn;
    $("status-title").textContent =
      s.result.status === "won"
        ? `${name(s.result.winner)} takes the line.`
        : s.result.status === "draw"
          ? "A shared finish."
          : `${name(s.turn)}, ${s.phase === "placement" ? "place your piece." : "make your move."}`;
    $("instruction").textContent =
      s.result.status === "playing"
        ? s.phase === "placement"
          ? `${3 - s.placed[s.turn]} ${3 - s.placed[s.turn] === 1 ? "piece" : "pieces"} left to place · Choose an empty point.`
          : selected
            ? `Choose a glowing point to move from ${selected}.`
            : "Select one of your pieces, then a connected empty point."
        : s.result.reason + " · Ready for another round?";
    if (context.online && !ended)
      $("status-title").textContent = `${name(s.turn)} to play.`;
    if (context.message) $("instruction").textContent = context.message;
    $("mode-label").textContent = context.label;
    $("restart").hidden = !!context.online && s.result.status === "playing";
    ($("restart") as HTMLButtonElement).disabled = !!context.busy;
    $("restart").innerHTML = ended
      ? "Rematch <span>↻</span>"
      : "New game <span>↻</span>";
  }
  document.querySelectorAll<HTMLButtonElement>("[data-node]").forEach(
    (b) =>
      (b.onclick = () => {
        const node = b.dataset.node as Node,
          s = current;
        if (!context.canPlay || s.result.status !== "playing") return;
        if (s.phase === "movement" && s.board[node] === s.turn) {
          selected = selected === node ? null : node;
          render();
          return;
        }
        const action = legalActions(s).find(
          (a) => a.to === node && (a.type === "place" || a.from === selected),
        );
        if (!action) return;
        selected = null;
        callbacks.action(action);
      }),
  );
  const rules = $("rules-dialog") as HTMLDialogElement,
    confirm = $("reset-dialog") as HTMLDialogElement;
  $("rules").onclick = () => rules.showModal();
  document
    .querySelectorAll(".close,.close-rules")
    .forEach((b) => b.addEventListener("click", () => rules.close()));
  $("restart").onclick = () => {
    if (
      Object.values(current.board).some(Boolean) &&
      current.result.status === "playing"
    )
      confirm.showModal();
    else callbacks.reset();
  };
  document
    .querySelector(".cancel-reset")!
    .addEventListener("click", () => confirm.close());
  document.querySelector(".confirm-reset")!.addEventListener("click", () => {
    confirm.close();
    callbacks.reset();
  });

  $("menu").onclick = () => callbacks.home();
  function update(state: State, next: BoardContext) {
    const nextSnapshot = JSON.stringify([state, next]);
    if (nextSnapshot === snapshot) return;
    snapshot = nextSnapshot;
    current = state;
    context = next;
    if (!next.canPlay) selected = null;
    render();
  }
  update(initial, initialContext);
  return { update };
}
