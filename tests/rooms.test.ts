import { test } from "node:test";
import assert from "node:assert/strict";
import { commandRoom } from "../server/room";
import { replay } from "../src/engine/session";
import { potta } from "../src/engine/game";
import type { Command } from "../src/online/protocol";
const id = () => crypto.randomUUID();
test("rooms retain identities, reject strangers/illegal/stale actions, deduplicate and replay exactly", () => {
  let room = commandRoom(null, "host", { type: "create" }, 0).room;
  assert.equal(commandRoom(room, "host", { type: "create" }, 1).player, "blue");
  room = commandRoom(room, "guest", { type: "join" }, 1).room;
  assert.equal(commandRoom(room, "guest", { type: "join" }, 2).player, "gold");
  assert.throws(() => commandRoom(room, "third", { type: "join" }, 2));
  assert.throws(() => commandRoom(room, "third", { type: "sync" }, 2));
  const command: Command = {
    type: "action",
    id: id(),
    revision: room.revision,
    match: 1,
    action: { type: "place", to: "A" },
  };
  room = commandRoom(room, "host", command, 3).room;
  const revision = room.revision;
  room = commandRoom(room, "host", command, 400000).room;
  assert.equal(room.revision, revision);
  assert.equal(room.recording.actions.length, 1);
  assert.throws(() => commandRoom(room, "host", { ...command, id: id() }, 4));
  assert.throws(() =>
    commandRoom(
      room,
      "guest",
      { ...command, id: id(), revision: room.revision },
      4,
    ),
  );
  assert.throws(() =>
    commandRoom(
      room,
      "host",
      { ...command, action: { type: "place", to: "B" } },
      4,
    ),
  );
  room = commandRoom(
    JSON.parse(JSON.stringify(room)),
    "guest",
    { type: "sync" },
    9999999,
  ).room;
  assert.equal(room.state.turn, "gold");
  assert.deepEqual(replay(potta, room.recording).state, room.state);
});
test("completed matches require both rematch votes and delayed old-match actions cannot change the new board", () => {
  let room = commandRoom(null, "host", { type: "create" }, 0).room;
  room = commandRoom(room, "guest", { type: "join" }, 1).room;
  for (const to of ["A", "D", "B", "G", "F", "I"] as const)
    room = commandRoom(
      room,
      room.state.turn === "blue" ? "host" : "guest",
      {
        type: "action",
        id: id(),
        revision: room.revision,
        match: room.match,
        action: { type: "place", to },
      },
      2,
    ).room;
  room = commandRoom(
    room,
    "host",
    {
      type: "action",
      id: id(),
      revision: room.revision,
      match: 1,
      action: { type: "move", from: "F", to: "C" },
    },
    3,
  ).room;
  assert.equal(room.state.result.status, "won");
  assert.deepEqual(replay(potta, room.recording).state, room.state);
  const vote: Command = { type: "rematch", id: id(), match: 1 };
  room = commandRoom(room, "host", vote, 4).room;
  assert.equal(room.match, 1);
  room = commandRoom(
    room,
    "guest",
    { type: "rematch", id: id(), match: 1 },
    5,
  ).room;
  assert.equal(room.match, 2);
  assert.equal(commandRoom(room, "host", vote, 6).room.match, 2);
  assert.throws(() =>
    commandRoom(
      room,
      "host",
      {
        type: "action",
        id: id(),
        revision: room.revision,
        match: 1,
        action: { type: "place", to: "A" },
      },
      6,
    ),
  );
  assert.equal(room.state.placed.blue, 0);
  assert.equal(
    commandRoom(room, "host", { type: "sync" }, 999999999).player,
    "blue",
  );
});

test("network action key ordering is normalised for deterministic replay", () => {
  let room = commandRoom(null, "host", { type: "create" }, 0).room;
  room = commandRoom(room, "guest", { type: "join" }, 1).room;
  room = commandRoom(
    room,
    "host",
    {
      type: "action",
      id: crypto.randomUUID(),
      revision: room.revision,
      match: 1,
      action: { to: "A", type: "place" },
    },
    2,
  ).room;
  assert.deepEqual(replay(potta, room.recording).state, room.state);
});
