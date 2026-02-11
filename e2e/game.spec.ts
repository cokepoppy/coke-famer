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

test("chest: store items and persist across reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => (window as any).__cokeFamer?.ready === true);
  await page.locator("#btn-reset").click();

  const placed = await page.evaluate(() => {
    const s = (window as any).__cokeFamer;
    const buy = s.api.shopBuy("chest", 1);
    if (!buy.ok) return { ok: false, reason: buy.reason ?? "buy_failed" };

    const { tx, ty } = s.player;
    const candidates = [
      { tx: tx + 1, ty },
      { tx: tx - 1, ty },
      { tx, ty: ty + 1 },
      { tx, ty: ty - 1 },
      { tx, ty }
    ];

    let pos: { tx: number; ty: number } | null = null;
    for (const c of candidates) {
      if (s.api.placeChestAt(c.tx, c.ty)) {
        pos = c;
        break;
      }
    }
    if (!pos) return { ok: false, reason: "place_failed" };

    if (!s.api.openChestAt(pos.tx, pos.ty)) return { ok: false, reason: "open_failed" };

    const invSlots = s.inventorySlots ?? [];
    const seedIndex = invSlots.findIndex((it: any) => it?.itemId === "parsnip_seed");
    if (seedIndex < 0) return { ok: false, reason: "no_seed_slot" };
    const picked = s.api.invPickup(seedIndex);
    if (!picked) return { ok: false, reason: "pickup_failed" };
    const rem = s.api.chestPlace(0, picked);
    if (rem) return { ok: false, reason: "unexpected_remainder" };

    s.api.save();
    return { ok: true, pos, qty: picked.qty };
  });

  expect(placed.ok).toBeTruthy();

  await page.reload();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => (window as any).__cokeFamer?.ready === true);

  const chestSlot0 = await page.evaluate((pos) => {
    const s = (window as any).__cokeFamer;
    const ok = s.api.openChestAt(pos.tx, pos.ty);
    if (!ok) return null;
    const chest = s.chest;
    return chest?.slots?.[0] ?? null;
  }, (placed as any).pos);

  expect(chestSlot0).toBeTruthy();
  expect((chestSlot0 as any).itemId).toBe("parsnip_seed");
  expect((chestSlot0 as any).qty).toBeGreaterThan(0);
});
