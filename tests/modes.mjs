import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const a = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  }),
  b = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
const host = await a.newPage(),
  guest = await b.newPage(),
  errors = [];
for (const p of [host, guest]) p.on("pageerror", (e) => errors.push(e.message));
const wait = async (fn, timeout = 12000) => {
  const until = Date.now() + timeout;
  while (!(await fn())) {
    if (Date.now() > until) throw Error("Condition timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
};
const click = async (p, n) => p.locator(`[data-node="${n}"]`).click();
const count = async (p, color) => p.locator(`.piece.${color}`).count();
try {
  await guest.goto(base);
  await guest.screenshot({
    path: "artifacts/modes-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await guest.getByRole("button", { name: /Play Online/ }).click();
  await guest.getByRole("button", { name: "Join Game", exact: true }).click();
  assert.match(
    await guest.locator("#setup-error").innerText(),
    /six-character/,
  );
  await host.goto(base);
  await host.screenshot({
    path: "artifacts/modes-desktop.png",
    fullPage: true,
  });
  for (const level of ["Easy", "Normal", "Hard"]) {
    await host.getByRole("button", { name: /Play Solo/ }).click();
    await host.getByRole("button", { name: new RegExp("^" + level) }).click();
    await host.getByRole("button", { name: /Play Solo/ }).click();
    await click(host, "A");
    await wait(async () => (await count(host, "gold")) === 1);
    assert.equal(await count(host, "blue"), 1);
    assert.match(await host.locator("#status-title").innerText(), /Red/i);
    await host.getByRole("button", { name: "Main menu" }).click();
  }
  // Finish a solo match through actual legal controls, using the same public legal labels as a player.
  await host.getByRole("button", { name: /Resume Game · Solo/ }).click();
  for (let i = 0; i < 120; i++) {
    if (
      await host.getByRole("button", { name: "Rematch", exact: false }).count()
    )
      break;
    await wait(
      async () =>
        (/Red/i.test(await host.locator("#status-title").innerText()) &&
          !/considering/.test(
            await host.locator("#instruction").innerText(),
          )) ||
        (await host
          .getByRole("button", { name: "Rematch", exact: false })
          .count()) > 0,
    );
    if (
      await host.getByRole("button", { name: "Rematch", exact: false }).count()
    )
      break;
    if (!(await host.locator(".node.legal").count())) {
      for (const node of await host.locator(".node").all()) {
        if ((await node.getAttribute("aria-label")).includes("Red piece")) {
          await node.click({ force: true });
          if (await host.locator(".node.legal").count()) break;
        }
      }
    }
    await host.locator(".node.legal").first().click();
    await wait(
      async () =>
        !/considering/.test(await host.locator("#instruction").innerText()),
    );
  }
  assert.ok(
    await host.getByRole("button", { name: "Rematch", exact: false }).count(),
  );
  await host.getByRole("button", { name: "Rematch", exact: false }).click();
  assert.equal(await count(host, "blue"), 0);
  await host.getByRole("button", { name: "Main menu" }).click();
  await host.getByRole("button", { name: /Play Online/ }).click();
  await host.getByRole("button", { name: /Create Game/ }).click();
  await wait(async () =>
    /Waiting for a friend/.test(await host.locator("#room-state").innerText()),
  );
  const code = (await host.locator("#room-state").innerText()).match(
    /Room ([A-Z2-9]{6})/,
  )[1];
  await host.getByRole("button", { name: /Share invitation/ }).click();
  await guest.goto(base + "/#room=" + code);
  await guest.getByRole("button", { name: "Join Game", exact: true }).click();
  await wait(async () =>
    /Two at the table/.test(await host.locator("#room-state").innerText()),
  );
  await wait(async () =>
    /You are Green/.test(await guest.locator("#instruction").innerText()),
  );
  const visitor = await browser.newContext();
  const third = await visitor.newPage();
  await third.goto(base + "/#room=" + code);
  await third.getByRole("button", { name: "Join Game", exact: true }).click();
  await wait(async () =>
    /already has two players/.test(
      await third.locator("#instruction").innerText(),
    ),
  );
  await visitor.close();
  // A lost response after the server accepts A: reload must retry the same action ID.
  let lost = false;
  await host.route("**/api/rooms/" + code, async (route) => {
    const command = route.request().postDataJSON();
    if (command.type === "action" && !lost) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await click(host, "A");
  await wait(async () => lost);
  await wait(async () => (await count(guest, "blue")) === 1);
  await wait(async () =>
    /Connection interrupted/.test(
      await host.locator("#instruction").innerText(),
    ),
  );
  await host.reload();
  await wait(async () => (await count(host, "blue")) === 1);
  assert.equal(await count(host, "gold"), 0);
  await host.unroute("**/api/rooms/" + code);
  // The guest retains identity through a refresh.
  await guest.reload();
  await wait(async () =>
    /You are Green/.test(await guest.locator("#instruction").innerText()),
  );
  for (const [p, n] of [
    [guest, "D"],
    [host, "B"],
    [guest, "G"],
    [host, "F"],
    [guest, "I"],
  ]) {
    await wait(
      async () =>
        (await p
          .locator(`[data-node="${n}"]`)
          .getAttribute("aria-disabled")) === "false",
    );
    await click(p, n);
    await wait(
      async () =>
        (await host
          .locator(`[data-node="${n}"]`)
          .getAttribute("aria-label")) !== `${n}: empty` &&
        (await guest
          .locator(`[data-node="${n}"]`)
          .getAttribute("aria-label")) !== `${n}: empty`,
    );
  }
  // Pause a connection, then recover the same board and turn.
  await b.setOffline(true);
  await wait(async () =>
    /Connection interrupted/.test(
      await guest.locator("#instruction").innerText(),
    ),
  );
  await b.setOffline(false);
  await wait(async () =>
    /You are Green/.test(await guest.locator("#instruction").innerText()),
  );
  await host.locator('[data-node="F"]').click();
  await host.screenshot({
    path: "artifacts/online-desktop.png",
    fullPage: true,
  });
  await guest.screenshot({
    path: "artifacts/online-mobile.png",
    fullPage: true,
  });
  await click(host, "C");
  await wait(async () =>
    /Red takes the line/i.test(
      await guest.locator("#status-title").innerText(),
    ),
  );
  assert.equal(await guest.locator(".victorious").count(), 3);
  const winningLine = await guest.locator(".win-line").elementHandle();
  for (let i = 0; i < 2; i++)
    await guest.waitForResponse(
      (r) =>
        r.url().includes("/api/rooms/") &&
        r.request().postDataJSON()?.type === "sync",
    );
  assert.ok(
    await guest
      .locator(".win-line")
      .evaluate((line, previous) => line === previous, winningLine),
    "polls must not restart the winning animation",
  );
  assert.match(
    await guest.locator("#instruction").innerText(),
    /Ready for another round/,
  );
  await host.getByRole("button", { name: "Rematch", exact: false }).click();
  await wait(async () =>
    /Rematch requested/.test(await host.locator("#instruction").innerText()),
  );
  await guest.getByRole("button", { name: "Rematch", exact: false }).click();
  await wait(
    async () =>
      (await count(host, "blue")) === 0 && (await count(guest, "blue")) === 0,
  );
  await guest.reload();
  await wait(async () =>
    /You are Green/.test(await guest.locator("#instruction").innerText()),
  );
  assert.match(await guest.locator("#status-title").innerText(), /Red/i);
  await host.getByRole("button", { name: "Main menu" }).click();
  await host.getByRole("button", { name: /Resume Game · Online/ }).click();
  await wait(async () =>
    /You are Red/.test(await host.locator("#instruction").innerText()),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Modes passed: all three AI levels, solo completion/rematch, private create/join/invitation, two-client sync, lost acknowledgement with refresh, identity/turn recovery, interrupted connection, movement win and two-party rematch.",
  );
} finally {
  await browser.close();
}
