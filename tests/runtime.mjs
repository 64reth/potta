import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5173",
  file = ".local/recovery-fixture.json";
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
async function call(code, secret, command, expected = 200) {
  const r = await fetch(base + "/api/rooms/" + code, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + secret,
    },
    body: JSON.stringify(command),
  });
  assert.equal(r.status, expected, await r.clone().text());
  return r.json();
}
if (process.argv.includes("--recover")) {
  const fixture = JSON.parse(await fs.readFile(file, "utf8"));
  const restored = await call(fixture.code, fixture.host, { type: "sync" });
  assert.equal(restored.player, "blue");
  assert.equal(restored.revision, fixture.view.revision);
  assert.equal(restored.state.turn, "gold");
  assert.deepEqual(restored.state, fixture.view.state);
  const guest = await call(fixture.code, fixture.guest, { type: "sync" });
  assert.equal(guest.player, "gold");
  assert.deepEqual(guest.state, restored.state);
  console.log(
    "Runtime restart recovery passed: persisted board, revision, seat identities and turn survive workerd restart.",
  );
} else {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    code = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (n) => alphabet[n % 32],
    ).join(""),
    host = token(),
    guest = token();
  let view = await call(code, host, { type: "create" });
  assert.equal(view.player, "blue");
  assert.equal(view.ready, false);
  assert.equal(
    (await call(code, host, { type: "create" })).revision,
    view.revision,
  );
  await call(code, token(), { type: "create" }, 409);
  await call(code, guest, { type: "sync" }, 401);
  await call(code, guest, { type: "join" });
  view = await call(code, host, { type: "sync" });
  assert.equal(view.ready, true);
  await call(code, token(), { type: "join" }, 409);
  const command = {
    type: "action",
    id: crypto.randomUUID(),
    revision: view.revision,
    match: 1,
    action: { type: "place", to: "A" },
  };
  await call(code, guest, command, 409);
  const results = await Promise.all(
    Array.from({ length: 5 }, () => call(code, host, command)),
  );
  assert.ok(results.every((r) => r.revision === view.revision + 1));
  view = results[0];
  assert.equal(view.state.placed.blue, 1);
  await call(
    code,
    host,
    { ...command, action: { type: "place", to: "B" } },
    409,
  );
  await call(code, guest, { ...command, id: crypto.randomUUID() }, 409);
  await call(
    code,
    guest,
    { ...command, id: crypto.randomUUID(), revision: view.revision },
    409,
  );
  const denied = await fetch(base + "/api/rooms/" + code, {
    method: "POST",
    headers: {
      Origin: "https://unrelated.example",
      "Content-Type": "application/json",
      Authorization: "Bearer " + host,
    },
    body: '{"type":"sync"}',
  });
  assert.equal(denied.status, 403);
  const large = await fetch(base + "/api/rooms/" + code, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + host,
    },
    body: JSON.stringify({ type: "sync", padding: "x".repeat(2100) }),
  });
  assert.equal(large.status, 413);
  await fs.mkdir(".local", { recursive: true });
  await fs.writeFile(file, JSON.stringify({ code, host, guest, view }));
  console.log(
    "Runtime passed: real Durable Object create/join/auth, legal and illegal moves, concurrent deduplication, stale revision rejection, origin checks and input limits. Recovery fixture saved locally.",
  );
}
