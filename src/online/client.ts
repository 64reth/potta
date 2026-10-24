import { ROOM_PATTERN, type Command, type RoomView } from "./protocol";
export interface Seat {
  code: string;
  token: string;
  intent: "create" | "join" | "sync";
  pending?: Command;
  boardSize?: 3 | 4 | 5;
}
const KEY = "potta-seats-v1",
  ACTIVE = "potta-active-room-v1";
function seats(): Record<string, Seat> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
export function savedSeat(
  code = localStorage.getItem(ACTIVE) || "",
): Seat | undefined {
  return seats()[code];
}
export function remember(seat: Seat) {
  const all = seats();
  all[seat.code] = seat;
  localStorage.setItem(KEY, JSON.stringify(all));
  localStorage.setItem(ACTIVE, seat.code);
}
export function newSeat(
  code: string,
  intent: "create" | "join",
  boardSize: 3 | 4 | 5 = 3,
): Seat {
  if (!ROOM_PATTERN.test(code)) throw Error("Enter a six-character room code.");
  const existing = savedSeat(code);
  if (existing) {
    remember(existing);
    return existing;
  }
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  const seat = { code, token, intent, boardSize };
  remember(seat);
  return seat;
}
export function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n % alphabet.length],
  ).join("");
}
export type Connection = "connecting" | "connected" | "reconnecting" | "error";
export class OnlineClient {
  view?: RoomView;
  status: Connection = "connecting";
  message = "Connecting to your game…";
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private active = false;
  private failures = 0;
  constructor(
    readonly seat: Seat,
    private changed: () => void,
  ) {}
  start() {
    this.stopped = false;
    void this.sync();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  send(command: Command) {
    if (this.seat.pending || this.status !== "connected") return;
    this.seat.pending = command;
    remember(this.seat);
    this.changed();
    clearTimeout(this.timer);
    void this.sync();
  }
  private async sync() {
    if (this.stopped || this.active) return;
    this.active = true;
    const pending = this.seat.pending,
      command =
        pending ??
        (this.seat.intent === "create"
          ? { type: "create", boardSize: this.seat.boardSize ?? 3 }
          : { type: this.seat.intent });
    try {
      const response = await fetch(`/api/rooms/${this.seat.code}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.seat.token}`,
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(6000),
      });
      const data = await response.json();
      if (this.stopped) return;
      if (!response.ok) {
        if (response.status >= 500) throw Error();
        if (response.status === 409 && pending) {
          delete this.seat.pending;
          remember(this.seat);
          this.message = data.error;
          this.status = "reconnecting";
        } else {
          this.status = "error";
          this.message =
            data.error ||
            "We could not open this game. Return to the menu to try again.";
          return;
        }
      } else {
        this.view = data as RoomView;
        this.seat.boardSize = this.view.state.rules.boardSize ?? 3;
        this.status = "connected";
        this.message = "";
        this.failures = 0;
        this.seat.intent = "sync";
        if (pending && this.seat.pending === pending) delete this.seat.pending;
        remember(this.seat);
      }
    } catch {
      if (!this.stopped) {
        this.status = "reconnecting";
        this.message =
          "Connection interrupted. Reconnecting — your seat is saved.";
        this.failures++;
      }
    } finally {
      this.active = false;
      if (!this.stopped) {
        this.changed();
        if (this.status !== "error")
          this.timer = setTimeout(
            () => void this.sync(),
            Math.min(5000, 600 * 2 ** Math.min(this.failures, 3)),
          );
      }
    }
  }
}
