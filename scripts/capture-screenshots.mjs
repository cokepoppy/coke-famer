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

    // Stabilize state.
    await page.locator("#btn-reset").click();
    await page.waitForTimeout(200);

    // 01: world + HUD
    await page.screenshot({ path: path.join(outDir, "01-world.png"), fullPage: true });

    // 02: farming (mature crop)
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
    await page.keyboard.press("i");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "03-inventory.png"), fullPage: true });

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

