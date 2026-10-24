import {
  DEFAULT_RULES,
  potta,
  initialState,
  legalActions,
  transition,
  type PlayerId,
} from "../src/engine/game";
import type { Command, RoomData, RoomView } from "../src/online/protocol";
export class RoomError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
export function freshRoom(
  hash: string,
  now: number,
  boardSize: 3 | 4 | 5 = 3,
): RoomData {
  if (![3, 4, 5].includes(boardSize))
    throw new RoomError("Choose a valid board size.", 400);
  const rules = { ...DEFAULT_RULES, boardSize };
  return {
    state: initialState(rules),
    members: { blue: { hash, seen: now } },
    revision: 0,
    match: 1,
    rematch: [],
    receipts: {},
    recording: {
      format: 1,
      game: "potta",
      version: potta.version,
      seed: 1,
      config: structuredClone(rules),
      players: [
        { id: "blue", name: "Azure" },
        { id: "gold", name: "Ochre" },
      ],
      actions: [],
    },
  };
}
export function commandRoom(
  existing: RoomData | null,
  hash: string,
  command: Command,
  now: number,
): { room: RoomData; player: PlayerId } {
  if (!existing) {
    if (command.type !== "create")
      throw new RoomError("That game could not be found. Check the code.", 404);
    return { room: freshRoom(hash, now, command.boardSize), player: "blue" };
  }
  const room = structuredClone(existing);
  let player = (["blue", "gold"] as const).find(
    (p) => room.members[p]?.hash === hash,
  );
  if (command.type === "create" && !player)
    throw new RoomError("That code is in use. Create another game.");
  if (command.type === "join" && !player) {
    if (room.members.gold)
      throw new RoomError("This game already has two players.");
    room.members.gold = { hash, seen: now };
    player = "gold";
    room.revision++;
  }
  if (!player)
    throw new RoomError(
      "Your seat could not be restored. Use the browser you joined with.",
      401,
    );
  room.members[player]!.seen = now;
  if (command.type === "action" || command.type === "rematch") {
    if (typeof command.id !== "string" || !/^[a-f0-9-]{36}$/i.test(command.id))
      throw new RoomError("Please try that action again.", 400);
    const receipt = player + ":" + command.id,
      payload = JSON.stringify(command);
    if (room.receipts[receipt]) {
      if (room.receipts[receipt] !== payload)
        throw new RoomError("That action was already used.");
      return { room, player };
    }
    if (command.match !== room.match)
      throw new RoomError("A new round has started. Your board will refresh.");
    if (command.type === "action") {
      if (!room.members.gold) throw new RoomError("Waiting for your opponent.");
      if (command.revision !== room.revision)
        throw new RoomError("The board has changed. Choose a current move.");
      try {
        // Record the canonical legal action so JSON field order cannot break replay.
        const proposed = command.action;
        const action = legalActions(room.state, player).find(
          (a) =>
            a.type === proposed.type &&
            a.to === proposed.to &&
            (a.type === "place" ||
              (proposed.type === "move" && a.from === proposed.from)),
        );
        if (!action) throw new Error("Illegal action");
        const result = transition(room.state, action, player);
        room.state = result.state;
        room.recording.actions.push({
          playerId: player,
          action: structuredClone(action),
          events: result.events,
        });
      } catch {
        throw new RoomError(
          "That move is not available. Choose a highlighted point.",
        );
      }
    } else {
      if (room.state.result.status === "playing")
        throw new RoomError("Finish this game before a rematch.");
      if (!room.rematch.includes(player)) room.rematch.push(player);
      if (room.rematch.length === 2) {
        room.state = initialState(room.state.rules);
        room.recording = { ...room.recording, actions: [] };
        room.rematch = [];
        room.match++;
      }
    }
    room.receipts[receipt] = payload;
    room.revision++;
    // Keep recent receipts across rematches; old match IDs still reject delayed actions.
    const ids = Object.keys(room.receipts);
    if (ids.length > 512)
      for (const id of ids.slice(0, ids.length - 512)) delete room.receipts[id];
  }
  return { room, player };
}
export function roomView(
  room: RoomData,
  player: PlayerId,
  code: string,
  now: number,
): RoomView {
  return {
    code,
    player,
    state: room.state,
    ready: !!room.members.gold,
    revision: room.revision,
    match: room.match,
    rematch: room.rematch,
    opponentPresent:
      now - (room.members[player === "blue" ? "gold" : "blue"]?.seen ?? 0) <
      12000,
  };
}
