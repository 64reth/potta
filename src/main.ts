import { GameSession, replay, type Recording } from "./engine/session";
import {
  potta,
  DEFAULT_RULES,
  type Action,
  type State,
  type Rules,
} from "./engine/game";
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
  { id: "blue", name: "Azure" },
  { id: "gold", name: "Ochre" },
];
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
  return new GameSession(potta, DEFAULT_RULES, players, sessionSeed);
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
  app.innerHTML = `<main class="selection"><header><span class="wordmark">POTTA</span><span class="edition">HERITAGE GAMES <span>004</span></span></header>
 <section class="mode-intro"><div class="eyebrow">BARBADOS · A GAME OF CONNECTION</div><h1>Three pieces.<br><em>Endless possibility.</em></h1><p>A shared tradition. Your kind of contest.</p></section>
 <div class="mode-grid"><button class="mode-card" id="solo"><span class="mode-icon">◉</span><span class="mode-number">01</span><h2>SOLO</h2><p>A quiet challenge.<br>You and the computer.</p><strong>Play Solo <span>↗</span></strong></button>
 <button class="mode-card" id="local"><span class="mode-icon">◉ ◉</span><span class="mode-number">02</span><h2>LOCAL</h2><p>Share the board.<br>Two players, one device.</p><strong>Play Local <span>↗</span></strong></button>
 <button class="mode-card" id="online"><span class="mode-icon">◎</span><span class="mode-number">03</span><h2>ONLINE</h2><p>A little distance.<br>The same connection.</p><strong>Play Online <span>↗</span></strong></button></div>
 <div class="resume-actions">${saved ? '<button id="resume-local" class="quiet">Resume Game · ' + (saved.mode === "solo" ? "Solo" : "Local") + " ↗</button>" : ""}${seat ? '<button id="resume-online" class="quiet">Resume Game · Online ↗</button>' : ""}</div>
 <p class="menu-note">Nine places. Three in a line. Make your next move.</p></main>`;
  on("local", () => start("local"));
  on("solo", soloMenu);
  on("online", onlineMenu);
  on("resume-local", () => {
    try {
      if (!saved) return;
      session = replay(potta, saved.recording);
      mode = saved.mode;
      difficulty = saved.difficulty;
      seed = saved.seed;
      showBoard();
      think();
    } catch {
      notice = "That saved game could not be restored.";
      soloMenu();
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
function soloMenu() {
  setup(
    "Find your challenge.",
    `<p>You play Azure. The computer plays Ochre.</p><div class="difficulties">${(["easy", "normal", "hard"] as const).map((d) => `<button data-level="${d}" class="difficulty ${d === difficulty ? "chosen" : ""}" aria-pressed="${d === difficulty}"><strong>${d[0].toUpperCase() + d.slice(1)}</strong><span>${d === "easy" ? "Room to discover." : d === "normal" ? "A thoughtful opponent." : "A deeper contest."}</span></button>`).join("")}</div><button id="start-solo" class="primary">Play Solo ↗</button>`,
  );
  document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        difficulty = b.dataset.level as Difficulty;
        soloMenu();
      }),
  );
  on("start-solo", () => start("solo"));
}
function onlineMenu() {
  cancel();
  document.body.classList.remove("in-game");
  const code =
    new URLSearchParams(location.hash.slice(1)).get("room")?.toUpperCase() ||
    "";
  setup(
    "Across the table.<br>Wherever you are.",
    `<p>Invite one person to a private game. Your seat stays yours if your connection drops.</p><button id="create-online" class="primary">Create Game ↗</button><div class="join-divider">OR JOIN A FRIEND</div><form id="join-form"><label for="room-code">Room code</label><div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" aria-label="Room code"><button class="restart" type="submit">Join Game</button></div></form><p class="rule-note">Keep the same browser to resume your seat. Invitation links share the room, never your player identity.</p>`,
  );
  const input = document.querySelector<HTMLInputElement>("#room-code")!;
  input.value = /^[A-Z2-9]{6}$/.test(code) ? code : "";
  const open = (code: string, intent: "create" | "join") => {
    try {
      connect(newSeat(code, intent));
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
    canPlay = true,
    busy = thinking;
  if (mode === "solo") {
    canPlay = !thinking && s.turn === "blue";
    if (thinking) message = "Ochre is considering the next move…";
  }
  if (mode === "online" && online) {
    const v = online.view;
    busy = !!online.seat.pending || !!v?.rematch.includes(v.player);
    canPlay =
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
                  : `You are ${v.player === "blue" ? "Azure" : "Ochre"}. ${v.player === s.turn ? "Your turn." : "Your opponent’s turn."}`;
  }
  return {
    canPlay,
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
  board.update(state(), context());
  if (mode === "online") updateRoomStrip();
}
function showBoard() {
  screen = "game";
  document.body.classList.add("in-game");
  board = mountBoard(app, state(), context(), {
    action: act,
    reset,
    home: menu,
  });
  if (mode === "online") {
    const strip = document.createElement("div");
    strip.className = "room-strip";
    strip.innerHTML =
      '<span id="room-state" role="status"></span><button id="share" class="quiet">Share invitation ↗</button><input id="invitation" readonly aria-label="Invitation link" hidden>';
    document.querySelector(".game-rail .game-bottom")!.before(strip);
    on("share", () => void share());
    updateRoomStrip();
  }
}
function updateRoomStrip() {
  const el = document.getElementById("room-state");
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
