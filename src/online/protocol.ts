import type { BoardSize } from "../engine/boards";
import type { State, Action, PlayerId, Rules } from "../engine/game";
import type { Recording } from "../engine/session";
export const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
export interface RoomView {
  code: string;
  player: PlayerId;
  state: State;
  ready: boolean;
  revision: number;
  match: number;
  rematch: PlayerId[];
  opponentPresent: boolean;
}
export type Command =
  | { type: "create"; boardSize?: BoardSize }
  | { type: "join" | "sync" }
  | {
      type: "action";
      id: string;
      revision: number;
      match: number;
      action: Action;
    }
  | { type: "rematch"; id: string; match: number };
export interface RoomData {
  state: State;
  recording: Recording<Action, Rules>;
  members: Partial<Record<PlayerId, { hash: string; seen: number }>>;
  revision: number;
  match: number;
  rematch: PlayerId[];
  receipts: Record<string, string>;
}
