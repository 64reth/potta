import {
  legalActions,
  geometryFor,
  type State,
  type Action,
  type PlayerId,
} from "../engine/game";
import type { Node } from "../engine/geometry";
export interface BoardContext {
  headline?: string;
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
    action: (a: Action) => void;
    reset: () => void;
    home: () => void;
    pause: (paused: boolean) => void;
  },
) {
  let current = initial,
    context = initialContext,
    selected: Node | null = null;
  const g = geometryFor(initial),
    coordinates = g.coordinates,
    nodes = g.nodes;
  const percent = (v: number) => (v - 60) / 4.8,
    name = (p: PlayerId) => (p === "blue" ? "Red" : "Green");
  const count = (n: number) => Array.from({ length: n }, (_, i) => i);
  app.innerHTML = `<main class="play-screen" style="--stone:${g.size === 3 ? 9 : g.size === 4 ? 7 : 5.8}%;--target:${g.size === 3 ? 18 : g.size === 4 ? 15 : 12}%" data-size="${g.size}">
 <header class="topbar"><button id="menu" class="brand" aria-label="Main menu">POTTA<span>●</span></button><span class="game-title">${g.name} <span class="muted">${g.size} × ${g.size}</span></span><button id="pause" class="icon-button" aria-label="Pause / settings">☰</button></header>
 <section class="play-body"><div class="board-stage"><div class="arena"><svg class="board" viewBox="60 60 480 480" role="group" aria-label="${g.size} by ${g.size} Potta board"><g class="connections">${g.edges.map(([a, b]) => `<line x1="${coordinates[a][0]}" y1="${coordinates[a][1]}" x2="${coordinates[b][0]}" y2="${coordinates[b][1]}"/>`).join("")}</g><g class="sockets">${nodes.map((n) => `<circle cx="${coordinates[n][0]}" cy="${coordinates[n][1]}" r="${g.size === 3 ? 7 : 5}"/>`).join("")}</g><g id="winning"></g></svg>
 <div class="node-layer">${nodes.map((n) => `<button class="node" data-node="${n}" style="left:${percent(coordinates[n][0])}%;top:${percent(coordinates[n][1])}%"><span class="destination"></span><span class="node-letter">${n}</span></button>`).join("")}</div><div id="pieces" aria-hidden="true"></div></div></div>
 <section class="context-dock" aria-label="Current game"><div class="turn-heading" role="status" aria-live="polite" aria-atomic="true"><span class="hud-label">CURRENT TURN</span><h2 id="status-title"></h2></div><div class="turn-row"><div class="player blue" id="blue-player"><span class="mini-piece"></span><div><strong>Red</strong><span class="reserve" id="blue-reserve"></span></div><span class="turn-tag">TO PLAY</span></div><span id="phase" class="pill"></span><div class="player gold" id="gold-player"><span class="mini-piece"></span><div><strong>Green</strong><span class="reserve" id="gold-reserve"></span></div><span class="turn-tag">TO PLAY</span></div></div>
 <div class="action-row"><div class="status" role="status" aria-live="polite"><p id="instruction"></p></div><div class="context-actions"><button id="restart" class="primary">Rematch ↻</button><button id="cancel-selection" class="quiet" hidden>Cancel selection</button><button id="details" class="quiet">Details <span>↗</span></button></div></div><div id="room-slot"></div></section></section>
 <dialog id="pause-dialog"><div class="panel-heading"><div><span class="kicker">TAKE A MOMENT</span><h2>Pause / settings</h2></div><button class="icon-button" id="close-pause" aria-label="Close pause">×</button></div><p id="pause-note">Your game is saved. Continue when you’re ready.</p><button id="continue" class="primary full">Continue game →</button><label class="setting-row"><span>Reduced motion</span><input type="checkbox" id="motion"></label><button id="rules" class="full">How to play</button><button id="new-game" class="full">New game</button><button id="leave-menu" class="quiet full">Main menu</button></dialog>
 <dialog id="rules-dialog"><div class="panel-heading"><h2>${g.name}: how to play</h2><button class="icon-button close-rules" aria-label="Close instructions">×</button></div><p>Take turns placing <strong>${g.pieces} stones each</strong> on empty intersections. Red starts.</p><p>After all ${g.pieces * 2} stones are placed, move one stone along one connected edge to an empty intersection. No jumping. Crossings without an intersection are not playable.</p><p>During movement, align <strong>${g.target} consecutive stones</strong> along a drawn row, column or main diagonal to win. ${g.size > 3 ? "Four and Five are experimental modern variants." : ""}</p><p class="rule-note">Placement alignments do not win. A blocked turn, three occurrences of a position with the same player to act, or 100 movement turns draws. These draw and placement-win decisions remain provisional.</p><button class="primary full close-rules">Back to game</button></dialog>
 <dialog id="details-dialog"><div class="panel-heading"><h2>At the table</h2><button class="icon-button" id="close-details" aria-label="Close details">×</button></div><p id="mode-label"></p><p>${g.pieces} stones each · ${g.target} consecutive to win</p><p>${g.size > 3 ? "Experimental modern variant" : "Traditional board · provisional adjudication rules"}</p><button id="detail-rules" class="full">How to play</button></dialog>
 <dialog id="reset-dialog"><h2>A fresh board?</h2><p>Your current round will be replaced.</p><div class="dialog-actions"><button class="cancel-reset">Keep playing</button><button class="primary confirm-reset">Start new game</button></div></dialog></main>`;
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
      for (const node of nodes)
        if (s.board[node] === p && !pieceIds[p].has(node)) {
          const used = new Set(pieceIds[p].values());
          pieceIds[p].set(node, count(g.pieces).find((id) => !used.has(id))!);
        }
      for (let id = 0; id < g.pieces; id++)
        if (![...pieceIds[p].values()].includes(id))
          document.getElementById(`piece-${p}-${id}`)?.remove();
      $(`${p}-player`).classList.toggle("active", !ended && s.turn === p);
      $(`${p}-reserve`).textContent = s.phase === "placement"
        ? `${g.pieces - s.placed[p]} of ${g.pieces} left to place`
        : `${g.pieces} stones on board`;
      for (const [node, id] of pieceIds[p]) {
        let el = document.getElementById(`piece-${p}-${id}`);
        if (!el) {
          el = document.createElement("span");
          el.id = `piece-${p}-${id}`;
          el.className = `piece ${p}`;
          $("pieces").append(el);
        }
        el.style.left = `${percent(coordinates[node][0])}%`;
        el.style.top = `${percent(coordinates[node][1])}%`;
        el.classList.toggle("selected", node === selected);
        el.classList.toggle(
          "victorious",
          s.result.status === "won" && s.result.line.includes(node),
        );
      }
    }
    const legal = context.canPlay ? legalActions(s) : [],
      destinations = legal
        .filter((a) => a.type === "place" || a.from === selected)
        .map((a) => a.to);
    for (const n of nodes) {
      const b = app.querySelector<HTMLButtonElement>(`[data-node="${n}"]`)!;
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
    const key =
      s.result.status === "won" ? s.result.winner + s.result.line.join() : "";
    if (key !== winningKey) {
      winningKey = key;
      const line = s.result.status === "won" ? s.result.line : [];
      if (line.length) {
        const a = coordinates[line[0]],
          b = coordinates[line.at(-1)!];
        $("winning").innerHTML =
          `<line class="win-line ${s.result.status === "won" ? s.result.winner : ""}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
      } else $("winning").replaceChildren();
    }
    $("phase").textContent = ended
      ? "ROUND COMPLETE"
      : s.phase === "placement"
        ? "PLACE"
        : "MOVE";
    $("status-title").textContent =
      s.result.status === "won"
        ? `${name(s.result.winner)} takes the line.`
        : s.result.status === "draw"
          ? "A shared finish."
          : `${name(s.turn)} ${context.online ? "to play." : s.phase === "placement" ? "— place a stone." : "— make your move."}`;
    if (context.headline && !ended)
      $("status-title").textContent = context.headline;
    $("instruction").textContent =
      context.message ||
      (s.result.status !== "playing"
        ? s.result.reason + " · Another round?"
        : s.phase === "placement"
          ? `${g.pieces - s.placed[s.turn]} stones left to place.`
          : selected
            ? `Move ${selected} to a glowing point.`
            : "Select a stone, then a glowing destination.");
    $("mode-label").textContent = context.label;
    $("restart").hidden = !ended;
    ($("restart") as HTMLButtonElement).disabled = !!context.busy;
    $("cancel-selection").hidden = !selected;
    $("details").hidden = !!selected;
    app.querySelector(".play-screen")!.classList.toggle("finished", ended);
    app.querySelector(".hud-label")!.textContent = ended ? "ROUND RESULT" : "CURRENT TURN";
    $("new-game").hidden = !!context.online;
  }
  app.querySelectorAll<HTMLButtonElement>("[data-node]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = b.dataset.node!;
        if (!context.canPlay || current.result.status !== "playing") return;
        if (current.phase === "movement" && current.board[n] === current.turn) {
          selected = selected === n ? null : n;
          render();
          return;
        }
        const action = legalActions(current).find(
          (a) => a.to === n && (a.type === "place" || a.from === selected),
        );
        if (action) {
          selected = null;
          callbacks.action(action);
        }
      }),
  );
  $("cancel-selection").onclick = () => {
    selected = null;
    render();
  };
  const pause = $("pause-dialog") as HTMLDialogElement,
    rules = $("rules-dialog") as HTMLDialogElement,
    details = $("details-dialog") as HTMLDialogElement,
    confirm = $("reset-dialog") as HTMLDialogElement;
  const motion = $("motion") as HTMLInputElement;
  motion.checked =
    document.documentElement.classList.contains("reduced-motion");
  motion.onchange = () => {
    document.documentElement.classList.toggle("reduced-motion", motion.checked);
    try {
      localStorage.setItem("potta-motion", String(motion.checked));
    } catch {}
  };
  function openPause() {
    callbacks.pause(true);
    $("pause-note").textContent = context.online
      ? "Online play continues for your friend. Your seat stays saved."
      : "Your game is saved. Continue when you’re ready.";
    pause.showModal();
  }
  function closePause() {
    pause.close();
    callbacks.pause(false);
  }
  pause.addEventListener("cancel", () => callbacks.pause(false));
  $("pause").onclick = openPause;
  $("menu").onclick = callbacks.home;
  $("continue").onclick = closePause;
  $("close-pause").onclick = closePause;
  $("leave-menu").onclick = () => {
    pause.close();
    callbacks.home();
  };
  $("rules").onclick = () => rules.showModal();
  $("detail-rules").onclick = () => {
    details.close();
    rules.showModal();
  };
  app
    .querySelectorAll(".close-rules")
    .forEach((b) => b.addEventListener("click", () => rules.close()));
  $("details").onclick = () => details.showModal();
  $("close-details").onclick = () => details.close();
  $("new-game").onclick = () => {
    pause.close();
    if (
      Object.values(current.board).some(Boolean) &&
      current.result.status === "playing"
    )
      confirm.showModal();
    else {
      callbacks.pause(false);
      callbacks.reset();
    }
  };
  app.querySelector(".cancel-reset")!.addEventListener("click", () => {
    confirm.close();
    callbacks.pause(false);
  });
  app.querySelector(".confirm-reset")!.addEventListener("click", () => {
    confirm.close();
    callbacks.pause(false);
    callbacks.reset();
  });
  confirm.addEventListener("cancel", () => callbacks.pause(false));
  $("restart").onclick = callbacks.reset;
  function update(s: State, next: BoardContext) {
    const hash = JSON.stringify([s, next]);
    if (hash === snapshot) return;
    snapshot = hash;
    current = s;
    context = next;
    if (!next.canPlay) selected = null;
    render();
  }
  update(initial, initialContext);
  return { update };
}
