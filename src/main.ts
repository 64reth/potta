import { GameSession, type Recording } from "./engine/session";
import {
  potta,
  DEFAULT_RULES,
  geometryFor,
  type Action,
  type State,
  type Rules,
} from "./engine/game";
import { boardGeometry, type BoardSize } from "./engine/boards";
import { restoreGame } from "./engine/restore";
import { mountBoard, type BoardContext } from "./ui/board";
import {
  OnlineClient,
  newSeat,
  newCode,
  savedSeat,
  type Seat,
} from "./online/client";
import type { Difficulty } from "./ai/search";
import "./ui/style.css";
type Mode = "local" | "solo" | "online";
const app = document.querySelector<HTMLDivElement>("#app")!;
const players = [
  { id: "blue", name: "Red" },
  { id: "gold", name: "Green" },
];
let selectedSize: BoardSize = 3;
let paused = false,
  renderedSize: BoardSize = 3;
try {
  document.documentElement.classList.toggle(
    "reduced-motion",
    localStorage.getItem("potta-motion") === "true",
  );
} catch {}
let session = create(),
  mode: Mode = "local",
  difficulty: Difficulty = "normal",
  seed = 1;
let board: ReturnType<typeof mountBoard> | undefined,
  online: OnlineClient | undefined;
let worker: Worker | undefined,
  thinking = false,
  generation = 0,
  notice = "",
  screen = "menu";
function create(sessionSeed = 1) {
  return new GameSession(
    potta,
    { ...DEFAULT_RULES, boardSize: selectedSize },
    players,
    sessionSeed,
  );
}
function readSave():
  | {
      mode: "local" | "solo";
      difficulty: Difficulty;
      seed: number;
      recording: Recording<Action, Rules>;
    }
  | undefined {
  try {
    return (
      JSON.parse(localStorage.getItem("potta-game-v2") || "null") ?? undefined
    );
  } catch {
    return undefined;
  }
}
function save() {
  try {
    localStorage.setItem(
      "potta-game-v2",
      JSON.stringify({ mode, difficulty, seed, recording: session.recording }),
    );
  } catch {
    notice = "This browser cannot save progress. Keep this tab open.";
  }
}
function cancel() {
  generation++;
  paused = false;
  worker?.terminate();
  worker = undefined;
  thinking = false;
  online?.stop();
  board = undefined;
}
function menu() {
  cancel();
  screen = "menu";
  history.replaceState(null, "", location.pathname + location.search);
  document.body.classList.remove("in-game");
  const saved = readSave();
  let seat: Seat | undefined;
  try {
    seat = savedSeat();
  } catch {}
  app.innerHTML = `<main class="selection welcome"><header class="menu-top"><span class="kicker">HERITAGE GAMES / 004</span><span class="edition">BARBADOS · MADE TO CONNECT</span></header><section class="welcome-layout"><div class="welcome-copy"><span class="kicker">A SMALL BOARD. A BIG CONTEST.</span><h1 class="hero-logo">POTTA<span>●</span></h1><p class="lead">Place your stones.<br>Find your line.</p><p class="welcome-note">A shared tradition, with new ways to play. <br>Choose your opponent. Make your move.</p><div class="resume-actions">${saved ? '<button id="resume-local" class="primary">Resume Game · ' + (saved.mode === "solo" ? "Solo" : "Local") + " ↗</button>" : ""}${seat ? '<button id="resume-online">Resume Game · Online ↗</button>' : ""}</div></div><div class="mode-grid" aria-label="Choose a game mode">${[
    {
      id: "solo",
      n: "01",
      title: "Solo",
      copy: "A quiet challenge. You and the computer.",
    },
    {
      id: "local",
      n: "02",
      title: "Local",
      copy: "Share the board. Two players, one device.",
    },
    {
      id: "online",
      n: "03",
      title: "Online",
      copy: "A little distance. The same connection.",
    },
  ]
    .map(
      (m) =>
        `<button id="${m.id}" class="mode-card" aria-label="Play ${m.title}"><span class="mode-number">${m.n}</span><span class="mode-copy"><strong>${m.title}</strong><span>${m.copy}</span></span><span class="card-arrow">↗</span></button>`,
    )
    .join(
      "",
    )}</div></section><footer><span>RED. GREEN. BLACK. YOUR NEXT MOVE.</span><span>Traditional 3 × 3 · Four · Five</span></footer></main>`;
  on("local", () => gameSetup("local"));
  on("solo", () => gameSetup("solo"));
  on("online", onlineMenu);
  on("resume-local", () => {
    try {
      if (!saved) return;
      session = restoreGame(saved.recording);
      selectedSize = session.state.rules.boardSize ?? 3;
      mode = saved.mode;
      difficulty = saved.difficulty;
      seed = saved.seed;
      showBoard();
      think();
    } catch {
      notice = "That saved game could not be restored.";
      gameSetup("solo");
    }
  });
  on("resume-online", () => {
    if (seat) connect(seat);
  });
}
function on(id: string, fn: () => void) {
  document.getElementById(id)?.addEventListener("click", fn);
}
function setup(title: string, content: string) {
  screen = "setup";
  app.innerHTML = `<main class="selection setup"><header><button id="back" class="quiet">← Main menu</button><span class="edition">POTTA / 004</span></header><section class="setup-content"><div class="eyebrow">MAKE YOUR NEXT MOVE</div><h1>${title}</h1>${content}<p id="setup-error" role="status"></p></section></main>`;
  on("back", menu);
}
function boardOptions() {
  const g = boardGeometry(selectedSize);
  return `<fieldset class="board-options"><legend>Choose your board</legend><div class="size-grid">${(
    [3, 4, 5] as const
  )
    .map((size) => {
      const board = boardGeometry(size);
      return `<button class="board-option ${size === selectedSize ? "chosen" : ""}" data-size="${size}" aria-pressed="${size === selectedSize}" aria-label="${board.name} ${size} by ${size}"><span class="grid-symbol" style="--grid:${size}">${Array.from({ length: size * size }, () => "<i></i>").join("")}</span><strong>${board.name}</strong><small>${size} × ${size}</small></button>`;
    })
    .join(
      "",
    )}</div><p class="board-summary"><strong>${g.pieces} stones each · ${g.target} consecutive to win</strong><span>${selectedSize === 3 ? "The Traditional nine-point board." : "Experimental modern variant. Main diagonals only."}</span></p></fieldset>`;
}
function bindBoards(back: () => void) {
  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedSize = Number(b.dataset.size) as BoardSize;
        back();
      }),
  );
}
function gameSetup(next: "solo" | "local") {
  setup(
    next === "solo" ? "Your next challenge." : "One board. Two players.",
    `<p>${next === "solo" ? "You play Red. The computer plays Green." : "Red begins. Pass the device when the turn changes."}</p>${boardOptions()}${next === "solo" ? `<fieldset class="difficulties"><legend>Choose your challenge</legend>${(["easy", "normal", "hard"] as const).map((d) => `<button data-level="${d}" class="difficulty ${difficulty === d ? "chosen" : ""}" aria-pressed="${difficulty === d}"><strong>${d[0].toUpperCase() + d.slice(1)}</strong><span>${d === "easy" ? "Room to discover" : d === "normal" ? "A thoughtful opponent" : "A deeper contest"}</span></button>`).join("")}</fieldset>` : '<div class="local-seats"><span><i class="seat red"></i>Player one · Red</span><span><i class="seat green"></i>Player two · Green</span></div>'}<button id="start-${next}" class="primary full">Play ${next === "solo" ? "Solo" : "Local"} <span>→</span></button>`,
  );
  bindBoards(() => gameSetup(next));
  document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        difficulty = b.dataset.level as Difficulty;
        gameSetup(next);
      }),
  );
  on("start-" + next, () => start(next));
}
let joinCode = "";
function onlineMenu() {
  cancel();
  document.body.classList.remove("in-game");
  const code =
    new URLSearchParams(location.hash.slice(1)).get("room")?.toUpperCase() ||
    "";
  setup(
    "Your private table.",
    `<p>Create a game for a friend, or join with their room code.</p>${boardOptions()}<button id="create-online" class="primary full">Create Game <span>→</span></button><div class="join-divider">OR JOIN A FRIEND</div><form id="join-form"><label for="room-code">Room code</label><div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" aria-label="Room code"><button type="submit">Join Game</button></div></form><p class="rule-note">Joining uses your host’s board. Your seat is saved in this browser, even if your connection drops.</p>`,
  );
  const input = document.querySelector<HTMLInputElement>("#room-code")!;
  input.value = /^[A-Z2-9]{6}$/.test(code) ? code : joinCode;
  input.oninput = () => {
    joinCode = input.value;
  };
  bindBoards(onlineMenu);
  const open = (code: string, intent: "create" | "join") => {
    try {
      connect(newSeat(code, intent, selectedSize));
    } catch (error) {
      document.getElementById("setup-error")!.textContent = (
        error as Error
      ).message;
    }
  };
  on("create-online", () => open(newCode(), "create"));
  document.getElementById("join-form")!.onsubmit = (e) => {
    e.preventDefault();
    open(input.value.trim().toUpperCase(), "join");
  };
}
function start(next: "solo" | "local") {
  cancel();
  mode = next;
  seed = crypto.getRandomValues(new Uint32Array(1))[0];
  session = create(seed);
  notice = "";
  save();
  showBoard();
  think();
}
function state(): State {
  return mode === "online" && online?.view ? online.view.state : session.state;
}
function context(): BoardContext {
  const s = state();
  let message = notice,
    headline: string | undefined,
    canPlay = !paused,
    busy = thinking;
  if (mode === "solo") {
    canPlay = !paused && !thinking && s.turn === "blue";
    if (thinking) {
      message = "Green is considering the next move…";
      headline = "Green is thinking.";
    }
  }
  if (mode === "online" && online) {
    const v = online.view;
    busy =
      online.status !== "connected" ||
      !!online.seat.pending ||
      !!v?.rematch.includes(v.player);
    headline =
      online.status === "error"
        ? "Can't open this game."
        : online.status === "reconnecting"
          ? "Reconnecting…"
          : online.status === "connecting"
            ? "Connecting…"
            : !v?.ready
              ? "Waiting for your friend."
              : undefined;
    canPlay =
      !paused &&
      online.status === "connected" &&
      !!v?.ready &&
      v.player === s.turn &&
      !busy;
    message =
      online.status !== "connected"
        ? online.message
        : !v?.ready
          ? "Waiting for your opponent. Share the invitation link."
          : online.seat.pending
            ? "Sending your move…"
            : v.rematch.includes(v.player)
              ? "Rematch requested. Waiting for your opponent."
              : s.result.status !== "playing"
                ? s.result.reason + " · Ready for another round?"
                : !v.opponentPresent
                  ? "Your opponent is reconnecting. Their seat is saved."
                  : `You are ${v.player === "blue" ? "Red" : "Green"}. ${v.player === s.turn ? "Your turn." : "Your opponent’s turn."}`;
  }
  return {
    canPlay,
    headline,
    label:
      mode === "solo"
        ? `SOLO · ${difficulty.toUpperCase()}`
        : mode === "online"
          ? `ONLINE · ${online?.seat.code}`
          : "LOCAL · TWO PLAYERS",
    message,
    online: mode === "online",
    busy,
  };
}
function refresh() {
  if (screen !== "game" || !board) return;
  if (geometryFor(state()).size !== renderedSize) {
    selectedSize = geometryFor(state()).size;
    showBoard();
    return;
  }
  board.update(state(), context());
  if (mode === "online") updateRoomStrip();
}
function showBoard() {
  screen = "game";
  document.body.classList.add("in-game");
  renderedSize = geometryFor(state()).size;
  board = mountBoard(app, state(), context(), {
    action: act,
    reset,
    home: menu,
    pause: (value: boolean) => {
      paused = value;
      if (value && mode !== "online") {
        generation++;
        worker?.terminate();
        thinking = false;
      }
      refresh();
      if (!value) think();
    },
  });
  if (mode === "online") {
    const strip = document.createElement("div");
    strip.className = "room-strip";
    strip.innerHTML =
      '<span id="room-state" role="status"></span><button id="share" class="quiet">Share invitation ↗</button><input id="invitation" readonly aria-label="Invitation link" hidden>';
    document.querySelector("#room-slot")!.append(strip);
    on("share", () => void share());
    updateRoomStrip();
  }
}
function updateRoomStrip() {
  const el = document.getElementById("room-state");
  if (el && online) {
    const container =
      online.view?.ready && online.status === "connected"
        ? document.getElementById("details-dialog")
        : document.getElementById("room-slot");
    if (container && el.parentElement!.parentElement !== container)
      container.append(el.parentElement!);
  }
  if (el)
    el.textContent = `Room ${online?.seat.code} · ${online?.status === "connected" ? (online.view?.ready ? "Two at the table" : "Waiting for a friend") : online?.status === "error" ? "Unable to connect" : "Connecting…"}`;
}
async function share() {
  const input = document.querySelector<HTMLInputElement>("#invitation")!;
  input.value =
    location.origin + location.pathname + "#room=" + online!.seat.code;
  try {
    await navigator.clipboard.writeText(input.value);
    document.getElementById("share")!.textContent = "Invitation copied ✓";
  } catch {
    input.hidden = false;
    input.select();
    document.getElementById("share")!.textContent = "Copy this invitation";
  }
}
function connect(seat: Seat) {
  cancel();
  history.replaceState(null, "", "#room=" + seat.code);
  mode = "online";
  selectedSize = seat.boardSize ?? 3;
  notice = "";
  session = create();
  online = new OnlineClient(seat, () => refresh());
  showBoard();
  online.start();
}
function act(action: Action) {
  if (!context().canPlay) return;
  notice = "";
  if (mode === "online") {
    const v = online!.view!;
    online!.send({
      type: "action",
      id: crypto.randomUUID(),
      match: v.match,
      revision: v.revision,
      action,
    });
    refresh();
    return;
  }
  session.dispatch(session.state.turn, action);
  save();
  refresh();
  think();
}
function reset() {
  if (mode === "online") {
    const v = online?.view;
    if (v)
      online!.send({
        type: "rematch",
        id: crypto.randomUUID(),
        match: v.match,
      });
    refresh();
    return;
  }
  worker?.terminate();
  thinking = false;
  generation++;
  seed = crypto.getRandomValues(new Uint32Array(1))[0];
  session = create(seed);
  notice = "";
  save();
  refresh();
  think();
}
function think() {
  if (
    mode !== "solo" ||
    screen !== "game" ||
    thinking ||
    paused ||
    session.state.turn !== "gold" ||
    session.state.result.status !== "playing"
  )
    return;
  thinking = true;
  refresh();
  const token = generation,
    start = performance.now();
  worker?.terminate();
  worker = new Worker(new URL("./ai/worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e) => {
    setTimeout(
      () => {
        if (token !== generation || screen !== "game") return;
        thinking = false;
        worker?.terminate();
        if (e.data.action) {
          session.dispatch(session.state.turn, e.data.action);
          save();
          refresh();
          think();
        } else {
          notice =
            e.data.error ||
            "The computer paused. Return to the menu and resume to retry.";
          refresh();
        }
      },
      Math.max(0, 420 - (performance.now() - start)),
    );
  };
  worker.onerror = () => {
    if (token !== generation) return;
    thinking = false;
    notice = "The computer paused. Return to the menu and resume to retry.";
    refresh();
  };
  worker.postMessage({ state: session.state, difficulty, seed });
}
function routeInvitation() {
  const invited = new URLSearchParams(location.hash.slice(1))
    .get("room")
    ?.toUpperCase();
  if (!invited) {
    menu();
    return;
  }
  if (screen === "game" && mode === "online" && online?.seat.code === invited)
    return;
  let returning: Seat | undefined;
  try {
    returning = savedSeat(invited);
  } catch {}
  if (returning) connect(returning);
  else onlineMenu();
}
window.addEventListener("hashchange", routeInvitation);
routeInvitation();
