import { test } from "node:test";
import assert from "node:assert/strict";
import { boardGeometry } from "../src/engine/boards";
import {
  initialState,
  transition,
  DEFAULT_RULES,
  potta,
  legacyPotta,
} from "../src/engine/game";
import { GameSession } from "../src/engine/session";
import { restoreGame } from "../src/engine/restore";
import { commandRoom } from "../server/room";
const cases = [
  {
    size: 4 as const,
    pieces: 4,
    target: 4,
    opening: ["A", "E", "B", "I", "C", "N", "H", "P"],
    from: "H",
    to: "D",
  },
  {
    size: 5 as const,
    pieces: 5,
    target: 5,
    opening: ["A", "F", "B", "K", "C", "P", "D", "U", "J", "Y"],
    from: "J",
    to: "E",
  },
];
for (const c of cases)
  test(`${c.size}×${c.size}: configuration, graph, placement, movement, victory, replay and online rematch`, () => {
    const g = boardGeometry(c.size);
    assert.equal(g.nodes.length, c.size * c.size);
    assert.equal(g.pieces, c.pieces);
    assert.equal(g.target, c.target);
    assert.equal(g.edges.length, c.size === 4 ? 30 : 48);
    assert.equal(g.lines.length, 2 * c.size + 2);
    for (const line of g.lines) {
      assert.equal(line.length, c.target);
      for (let i = 1; i < line.length; i++)
        assert.ok(g.adjacency[line[i - 1]].includes(line[i]));
    }
    assert.ok(!g.adjacency.A.includes("C"));
    assert.ok(!g.adjacency.B.includes(c.size === 4 ? "E" : "F"));
    if (c.size === 4)
      assert.ok(
        !g.nodes.some(
          (n) => g.coordinates[n][0] === 300 && g.coordinates[n][1] === 300,
        ),
      );
    const session = new GameSession(
      potta,
      { ...DEFAULT_RULES, boardSize: c.size },
      [
        { id: "blue", name: "Red" },
        { id: "gold", name: "Green" },
      ],
    );
    for (let i = 0; i < c.opening.length; i++) {
      session.dispatch(session.state.turn, { type: "place", to: c.opening[i] });
      if (i < c.opening.length - 1)
        assert.equal(session.state.phase, "placement");
    }
    assert.equal(session.state.phase, "movement");
    assert.equal(session.state.placed.blue, c.pieces);
    assert.throws(() =>
      session.dispatch("blue", {
        type: "move",
        from: "A",
        to: c.size === 4 ? "D" : "E",
      }),
    );
    if (c.size === 5)
      assert.equal(
        transition(session.state, { type: "move", from: "J", to: "I" }).state
          .result.status,
        "playing",
      );
    session.dispatch("blue", { type: "move", from: c.from, to: c.to });
    assert.equal(session.state.result.status, "won");
    if (session.state.result.status === "won")
      assert.equal(session.state.result.line.length, c.target);
    assert.deepEqual(restoreGame(session.recording).state, session.state);
    let room = commandRoom(
      null,
      "host",
      { type: "create", boardSize: c.size },
      0,
    ).room;
    room = commandRoom(room, "guest", { type: "join" }, 1).room;
    for (const to of c.opening)
      room = commandRoom(
        room,
        room.state.turn === "blue" ? "host" : "guest",
        {
          type: "action",
          id: crypto.randomUUID(),
          match: room.match,
          revision: room.revision,
          action: { type: "place", to },
        },
        2,
      ).room;
    room = commandRoom(
      room,
      "host",
      {
        type: "action",
        id: crypto.randomUUID(),
        match: 1,
        revision: room.revision,
        action: { type: "move", from: c.from, to: c.to },
      },
      3,
    ).room;
    assert.equal(room.state.result.status, "won");
    for (const who of ["host", "guest"])
      room = commandRoom(
        room,
        who,
        { type: "rematch", id: crypto.randomUUID(), match: 1 },
        4,
      ).room;
    assert.equal(room.state.rules.boardSize, c.size);
    assert.equal(room.match, 2);
    assert.equal(Object.keys(room.state.board).length, c.size * c.size);
  });
test("Traditional version-one recordings and placement behaviour are preserved", () => {
  const session = new GameSession(legacyPotta, DEFAULT_RULES, [
    { id: "blue", name: "Azure" },
    { id: "gold", name: "Ochre" },
  ]);
  for (const to of ["A", "D", "B", "E", "C"])
    session.dispatch(session.state.turn, { type: "place", to });
  assert.equal(session.state.result.status, "playing");
  assert.deepEqual(restoreGame(session.recording).state, session.state);
  let s = initialState({ ...DEFAULT_RULES, boardSize: 4 });
  for (const to of ["A", "E", "B", "I", "C", "N", "G", "P"])
    s = transition(s, { type: "place", to }).state;
  assert.equal(s.result.status, "playing");
  assert.equal(s.phase, "movement");
  assert.equal(
    transition(s, { type: "move", from: "G", to: "H" }).state.result.status,
    "playing",
  );
  assert.throws(() =>
    commandRoom(null, "host", { type: "create", boardSize: 7 as 3 }, 0),
  );
});
