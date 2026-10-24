import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  }),
  base = process.env.BASE_URL || "http://127.0.0.1:5175";
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = async (fn) => {
  const until = Date.now() + 12000;
  while (!(await fn())) {
    if (Date.now() > until) throw Error("Timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
};
const click = async (p, n) => p.locator(`[data-node="${n}"]`).click();
const cases = [
  {
    size: 3,
    name: "Traditional",
    opening: ["A", "D", "B", "G", "F", "I"],
    from: "F",
    to: "C",
  },
  {
    size: 4,
    name: "Four",
    opening: ["A", "E", "B", "I", "G", "N", "M", "P"],
    from: "G",
    to: "C",
  },
  {
    size: 5,
    name: "Five",
    opening: ["A", "F", "B", "K", "C", "P", "I", "V", "U", "Y"],
    from: "I",
    to: "D",
  },
];
try {
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/003-welcome-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "artifacts/003-welcome.png", fullPage: true });
  for (const c of cases) {
    await page.getByRole("button", { name: "Play Local", exact: true }).click();
    await page
      .getByRole("button", {
        name: `${c.name} ${c.size} by ${c.size}`,
        exact: true,
      })
      .click();
    await page.screenshot({
      path: `artifacts/003-setup-${c.size}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Play Local/ }).click();
    assert.equal(await page.locator(".node").count(), c.size * c.size);
    for (const n of c.opening) await click(page, n);
    assert.match(await page.locator("#phase").innerText(), /MOVE/);
    await click(page, "A");
    await page.locator('[data-node="A"]').click();
    await page.locator(`[data-node="${c.from}"]`).click();
    assert.equal(
      await page.locator(`[data-node="${c.to}"]`).getAttribute("aria-disabled"),
      "false",
    );
    await click(page, c.to);
    assert.match(await page.locator("#status-title").innerText(), /Red takes/i);
    await page.screenshot({
      path: `artifacts/003-win-${c.size}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Rematch/ }).click();
    assert.equal(await page.locator(".piece").count(), 0);
    for (const [width, height] of [
      [390, 844],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const rect = await page.locator(".arena").boundingBox();
      assert.ok(rect.y + rect.height <= height + 1);
      assert.ok(Math.abs(rect.width - rect.height) < 1);
      for (const node of await page.locator(".node").all()) {
        const r = await node.boundingBox();
        assert.ok(r.width >= 44 && r.height >= 44);
      }
      await page.screenshot({
        path: `artifacts/003-play-${c.size}-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Pause / settings", exact: true })
      .click();
    await page.getByLabel("Reduced motion", { exact: true }).check();
    await page.screenshot({
      path: `artifacts/003-pause-${c.size}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Continue game/ }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
  }
  // A bounded computer turn on every size, including the larger-board Hard setting.
  for (const c of cases) {
    await page.getByRole("button", { name: "Play Solo", exact: true }).click();
    await page
      .getByRole("button", { name: `${c.name} ${c.size} by ${c.size}` })
      .click();
    await page.getByRole("button", { name: /^Hard/ }).click();
    await page.screenshot({
      path: `artifacts/003-solo-setup-${c.size}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Play Solo/ }).click();
    await click(page, "A");
    await wait(async () => (await page.locator(".piece.gold").count()) === 1);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
  }
  // Two isolated clients: size-five room, authority/sync, refresh and two-party rematch.
  await page.getByRole("button", { name: "Play Online", exact: true }).click();
  await page.getByRole("button", { name: "Five 5 by 5" }).click();
  await page.getByRole("button", { name: /Create Game/ }).click();
  await wait(async () =>
    /Waiting for a friend/.test(await page.locator("#room-state").innerText()),
  );
  await page.screenshot({ path: "artifacts/003-waiting.png", fullPage: true });
  const code = (await page.locator("#room-state").innerText()).match(
    /Room ([A-Z2-9]{6})/,
  )[1];
  await page.getByRole("button", { name: /Share invitation/ }).click();
  const other = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    guest = await other.newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto(base + "/#room=" + code);
  await guest.getByRole("button", { name: "Join Game", exact: true }).click();
  await wait(async () => (await guest.locator(".node").count()) === 25);
  await wait(async () =>
    /You are Red/.test(await page.locator("#instruction").innerText()),
  );
  for (let i = 0; i < cases[2].opening.length; i++) {
    const p = i % 2 ? guest : page,
      n = cases[2].opening[i];
    await wait(
      async () =>
        (await p
          .locator(`[data-node="${n}"]`)
          .getAttribute("aria-disabled")) === "false",
    );
    await click(p, n);
    if (i === 1) {
      await guest.reload();
      await wait(
        async () =>
          (await guest.locator(".node").count()) === 25 &&
          (await guest.locator(".piece.gold").count()) === 1,
      );
    }
  }
  await wait(
    async () =>
      (await page.locator('[data-node="I"]').getAttribute("aria-disabled")) ===
      "false",
  );
  await click(page, "I");
  await click(page, "D");
  await wait(async () =>
    /Red takes/i.test(await guest.locator("#status-title").innerText()),
  );
  await guest.screenshot({
    path: "artifacts/003-online-five.png",
    fullPage: true,
  });
  await guest.reload();
  await wait(async () =>
    /Red takes/i.test(await guest.locator("#status-title").innerText()),
  );
  assert.equal(await guest.locator(".node").count(), 25);
  await page.getByRole("button", { name: /Rematch/ }).click();
  await guest.getByRole("button", { name: /Rematch/ }).click();
  await wait(
    async () =>
      (await page.locator(".piece").count()) === 0 &&
      (await guest.locator(".piece").count()) === 0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Build 003 focused review passed: all boards, placement/movement/wins, solo turns, responsive controls, pause/settings, online Five sync, refresh and rematch.",
  );
} finally {
  await browser.close();
}
