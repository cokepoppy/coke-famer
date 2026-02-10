import { expect, test } from "@playwright/test";

test("loads, moves, and registers clicks", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");

  await page.waitForFunction(() => (window as any).__cokeFamer?.ready === true);

  await page.locator("#btn-reset").click();

  const before = await page.evaluate(() => (window as any).__cokeFamer.player);

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");

  const after = await page.evaluate(() => (window as any).__cokeFamer.player);
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0);

  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const cx = (box!.x ?? 0) + box!.width / 2;
  const cy = (box!.y ?? 0) + box!.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  const lastClick = await page.evaluate(() => (window as any).__cokeFamer.lastClick);
  expect(lastClick).toBeTruthy();
  expect(typeof lastClick.tx).toBe("number");
  expect(typeof lastClick.ty).toBe("number");
});

test("farming loop: hoe -> water -> plant -> sleep -> harvest", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => (window as any).__cokeFamer?.ready === true);

  await page.locator("#btn-reset").click();

  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const cx = (box!.x ?? 0) + box!.width / 2;
  const cy = (box!.y ?? 0) + box!.height / 2;

  const inv0 = await page.evaluate(() => (window as any).__cokeFamer.inventory);
  expect(inv0.parsnip_seed).toBeGreaterThan(0);

  const useHere = async (modeKey: string) => {
    await page.keyboard.press(modeKey);
    await page.evaluate(() => {
      const s = (window as any).__cokeFamer;
      return s.api.useAt(s.player.tx, s.player.ty);
    });
  };

  // Hoe / Water / Plant at player tile deterministically.
  await useHere("1");
  await useHere("2");
  await useHere("3");

  // 4-day crop: water + sleep, repeated.
  for (let i = 0; i < 4; i++) {
    await useHere("2");
    await page.locator("#btn-sleep").click();
  }

  // Harvest
  await useHere("4");

  const inv1 = await page.evaluate(() => (window as any).__cokeFamer.inventory);
  expect(inv1.parsnip).toBeGreaterThanOrEqual(1);
});

test("economy loop: buy seeds and sell harvest", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => (window as any).__cokeFamer?.ready === true);
  await page.locator("#btn-reset").click();

  const before = await page.evaluate(() => ({ gold: (window as any).__cokeFamer.gold, seeds: (window as any).__cokeFamer.inventory.parsnip_seed }));
  expect(before.gold).toBeGreaterThanOrEqual(100);

  const buy = await page.evaluate(() => (window as any).__cokeFamer.api.shopBuy("parsnip_seed", 5));
  expect(buy.ok).toBeTruthy();

  const afterBuy = await page.evaluate(() => ({ gold: (window as any).__cokeFamer.gold, seeds: (window as any).__cokeFamer.inventory.parsnip_seed }));
  expect(afterBuy.seeds).toBeGreaterThanOrEqual(before.seeds + 5);
  expect(afterBuy.gold).toBeLessThan(before.gold);

  // Harvest one parsnip (use deterministic API at player tile).
  await page.evaluate(() => {
    const s = (window as any).__cokeFamer;
    const { tx, ty } = s.player;
    s.api.useAt(tx, ty, "hoe");
    s.api.useAt(tx, ty, "watering_can");
    s.api.useAt(tx, ty, "parsnip_seed");
    for (let i = 0; i < 4; i++) {
      s.api.useAt(tx, ty, "watering_can");
      s.api.sleep();
    }
    s.api.useAt(tx, ty, "hand");
  });

  const invSlots = await page.evaluate(() => (window as any).__cokeFamer.inventorySlots);
  const parsnipIndex = invSlots.findIndex((s: any) => s?.itemId === "parsnip");
  expect(parsnipIndex).toBeGreaterThanOrEqual(0);

  const sold = await page.evaluate((idx) => {
    const s = (window as any).__cokeFamer;
    const picked = s.api.invPickup(idx);
    const res = s.api.sellStack(picked);
    return { picked, res, gold: s.gold };
  }, parsnipIndex);
  expect(sold.picked).toBeTruthy();
  expect(sold.res.ok).toBeTruthy();
  expect(sold.res.goldGained).toBeGreaterThan(0);
});
