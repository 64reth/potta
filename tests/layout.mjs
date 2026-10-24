import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const page = await browser.newPage({ reducedMotion: "reduce" });
try {
  await fs.mkdir("artifacts", { recursive: true });
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [1366, 768],
    [768, 1024],
    [1024, 768],
    [844, 390],
    [390, 844],
    [375, 667],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
    await page.getByRole("button", { name: /Play Local/ }).click();
    await page.locator('[data-node="A"]').click();
    await page.locator('[data-node="B"]').click();
    const sizes = await page.evaluate(() => {
      const box = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          bottom: r.bottom,
          right: r.right,
        };
      };
      const svg = document.querySelector(".board");
      const alignment = [...svg.querySelectorAll(".sockets circle")].map(
        (circle, i) => {
          const screen = new DOMPoint(
            Number(circle.getAttribute("cx")),
            Number(circle.getAttribute("cy")),
          ).matrixTransform(svg.getScreenCTM());
          const target = document.querySelectorAll(".node")[i],
            r = target.getBoundingClientRect();
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return {
            error: Math.hypot(
              screen.x - r.x - r.width / 2,
              screen.y - r.y - r.height / 2,
            ),
            unobstructed: target.contains(hit),
          };
        },
      );
      return {
        alignment,
        arena: box(".arena"),
        table: box(".table"),
        piece: box(".piece"),
        target: box(".node"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(sizes.overflow, false);
    assert.ok(
      sizes.alignment.every((p) => p.error < 0.5 && p.unobstructed),
      "all nine targets align with the graph and receive pointer input",
    );
    assert.ok(sizes.arena.x >= 0 && sizes.arena.right <= width);
    assert.ok(
      sizes.arena.bottom <= height,
      `board must be visible at ${width}×${height}`,
    );
    assert.ok(sizes.target.width >= 44 && sizes.target.height >= 44);
    assert.ok(sizes.piece.width >= 40);
    assert.ok(
      Math.abs(
        sizes.arena.x +
          sizes.arena.width / 2 -
          (sizes.table.x + sizes.table.width / 2),
      ) < 2,
    );
    if (width <= 600)
      assert.ok(
        sizes.arena.width / width >= 0.96 && sizes.arena.width / width <= 1,
      );
    console.log(
      `${width}×${height}: arena ${Math.round(sizes.arena.width)}px, piece ${Math.round(sizes.piece.width)}px, target ${Math.round(sizes.target.width)}px, board extent / playing surface ${((sizes.arena.width * 0.94) / Math.min(sizes.table.width, sizes.table.height)).toFixed(2)}`,
    );
    await page.screenshot({
      path: `artifacts/layout-${width}-${height}.png`,
      fullPage: true,
    });
  }
} finally {
  await browser.close();
}
