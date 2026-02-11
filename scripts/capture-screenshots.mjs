import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const port = Number(process.env.SCREENSHOT_PORT ?? "4177");
const baseURL = `http://127.0.0.1:${port}/`;
const outDir = path.join(projectRoot, "docs", "screenshots");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function waitForHttp200(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for HTTP 200: ${url}`);
}

function startPreviewServer() {
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        NO_PROXY: "127.0.0.1,localhost,::1",
        no_proxy: "127.0.0.1,localhost,::1",
        http_proxy: "",
        https_proxy: ""
      }
    }
  );
  return child;
}

async function main() {
  await ensureDir(outDir);

  const server = startPreviewServer();
  try {
    await waitForHttp200(baseURL, 90_000);

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto(baseURL);
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => (window).__cokeFamer?.ready === true);

    const reset = async () => {
      await page.locator("#btn-reset").click();
      await page.waitForTimeout(250);
    };

    // 01: world + HUD
    await reset();
    await page.screenshot({ path: path.join(outDir, "01-world.png"), fullPage: true });

    // 02: farming (mature crop)
    await reset();
    await page.evaluate(() => {
      const s = (window).__cokeFamer;
      const { tx, ty } = s.player;
      s.api.useAt(tx, ty, "hoe");
      s.api.useAt(tx, ty, "watering_can");
      s.api.useAt(tx, ty, "parsnip_seed");
      for (let i = 0; i < 4; i++) {
        s.api.useAt(tx, ty, "watering_can");
        s.api.sleep();
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "02-farming.png"), fullPage: true });

    // 03: inventory panel
    await reset();
    await page.keyboard.press("i");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "03-inventory.png"), fullPage: true });

    // 04: shop panel
    await reset();
    await page.keyboard.press("o");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "04-shop.png"), fullPage: true });

    // 05: chest management (inventory + chest grid)
    await reset();
    await page.evaluate(() => {
      const s = (window).__cokeFamer;
      s.api.shopBuy("chest", 1);

      const { tx, ty } = s.player;
      const candidates = [
        { tx: tx + 1, ty },
        { tx: tx - 1, ty },
        { tx, ty: ty + 1 },
        { tx, ty: ty - 1 },
        { tx: tx + 2, ty },
        { tx: tx - 2, ty },
        { tx, ty: ty + 2 },
        { tx, ty: ty - 2 }
      ];

      let pos = null;
      for (const c of candidates) {
        if (s.api.placeChestAt(c.tx, c.ty)) {
          pos = c;
          break;
        }
      }
      if (!pos) return;

      s.api.openChestAt(pos.tx, pos.ty);

      const invSlots = s.inventorySlots ?? [];
      const seedIndex = invSlots.findIndex((it) => it?.itemId === "parsnip_seed");
      if (seedIndex >= 0) {
        const half = s.api.invSplitHalf(seedIndex);
        if (half) s.api.chestPlace(0, half);
      }
    });
    await page.keyboard.press("i");
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "05-chest.png"), fullPage: true });

    // 06: gathering resources (wood/stone nodes + axe/pickaxe)
    await reset();
    await page.keyboard.press("6");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "06-gather.png"), fullPage: true });

    // 07: craft panel (after gathering some resources)
    await reset();
    await page.evaluate(() => {
      const s = window.__cokeFamer;
      const { tx, ty } = s.player;
      // Try chop/mine around player to get wood/stone.
      const positions = [
        { tx: tx + 1, ty },
        { tx: tx - 1, ty },
        { tx, ty: ty + 1 },
        { tx, ty: ty - 1 }
      ];
      for (let i = 0; i < 3; i++) {
        for (const p of positions) s.api.useAt(p.tx, p.ty, "axe");
        for (const p of positions) s.api.useAt(p.tx, p.ty, "pickaxe");
      }
    });
    await page.keyboard.press("c");
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "07-craft.png"), fullPage: true });

    // 08: placeables (craft + place fence/path)
    await reset();
    await page.evaluate(() => {
      const s = window.__cokeFamer;
      const { tx, ty } = s.player;
      const positions = [
        { tx: tx + 1, ty },
        { tx: tx - 1, ty },
        { tx, ty: ty + 1 },
        { tx, ty: ty - 1 }
      ];
      for (let i = 0; i < 3; i++) {
        for (const p of positions) s.api.useAt(p.tx, p.ty, "axe");
        for (const p of positions) s.api.useAt(p.tx, p.ty, "pickaxe");
      }
      s.api.craft("fence", 2);
      s.api.craft("path", 2);

      // Place around the player (skip the tile with a blocking object if any).
      for (const p of positions) {
        s.api.useAt(p.tx, p.ty, "path");
      }
      for (const p of positions) {
        s.api.useAt(p.tx, p.ty, "fence");
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "08-placeables.png"), fullPage: true });

    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }

  console.log(`Saved screenshots to: ${path.relative(projectRoot, outDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
