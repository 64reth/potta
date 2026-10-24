import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseAction, searchKey } from "../src/ai/search";
import {
  initialState,
  transition,
  legalActions,
  type State,
} from "../src/engine/game";
function opening(points: string[]): State {
  let s = initialState();
  for (const to of points)
    s = transition(s, { type: "place", to: to as "A" }).state;
  return s;
}
test("every difficulty uses legal actions, preserves input and deterministically finds an immediate movement win", () => {
  const s = opening(["A", "D", "B", "G", "F", "I"]),
    before = JSON.stringify(s);
  for (const d of ["easy", "normal", "hard"] as const) {
    const result = chooseAction(s, d, 72);
    assert.deepEqual(result.action, { type: "move", from: "F", to: "C" });
    assert.deepEqual(chooseAction(s, d, 72), result);
    assert.ok(
      legalActions(s).some(
        (a) => JSON.stringify(a) === JSON.stringify(result.action),
      ),
    );
  }
  assert.equal(JSON.stringify(s), before);
});
test("normal and hard prevent an immediate threat when a safe move exists", () => {
  const s = opening(["A", "D", "B", "G", "F", "I"]);
  // Find a reachable position with both safe replies and immediate losing moves.
  let found = false;
  function walk(q: State, depth: number) {
    if (found || depth === 0 || q.result.status !== "playing") return;
    const options = legalActions(q).map((action) => ({
      action,
      next: transition(q, action).state,
    }));
    const safe = options.filter(
      ({ next }) =>
        next.result.status !== "playing" ||
        !legalActions(next).some(
          (a) => transition(next, a).state.result.status === "won",
        ),
    );
    if (
      safe.length &&
      safe.length < options.length &&
      !options.some((o) => o.next.result.status === "won")
    ) {
      for (const d of ["normal", "hard"] as const) {
        const chosen = chooseAction(q, d).action;
        assert.ok(
          safe.some((o) => JSON.stringify(o.action) === JSON.stringify(chosen)),
        );
      }
      found = true;
      return;
    }
    for (const { next } of options) walk(next, depth - 1);
  }
  walk(s, 3);
  assert.ok(found);
});
test("hard searches deeper than normal in the opening; repetition and move horizon are in its cache key", () => {
  const s = initialState(),
    normal = chooseAction(s, "normal"),
    hard = chooseAction(s, "hard");
  assert.ok(hard.depth > normal.depth);
  assert.ok(hard.nodes > normal.nodes);
  assert.ok(hard.nodes <= 24001);
  const changed = structuredClone(s);
  changed.visits.extra = 2;
  assert.notEqual(searchKey(s), searchKey(changed));
  changed.visits = s.visits;
  changed.moves = 20;
  assert.notEqual(searchKey(s), searchKey(changed));
});
test("no AI moves after a result", () => {
  const s = initialState();
  s.result = { status: "draw", reason: "test" };
  assert.equal(chooseAction(s, "hard").action, null);
});
