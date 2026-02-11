import { mountInventoryPanel } from "./inventoryPanel";
import { mountShopPanel } from "./shopPanel";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function button(label: string, id: string) {
  const b = el("button", "btn");
  b.id = id;
  b.type = "button";
  b.textContent = label;
  return b;
}

export function mountHud(containerId: string): void {
  const host = document.getElementById(containerId);
  if (!host) return;

  const row = el("div", "hud-row");

  const left = el("div", "hud-left");
  const right = el("div", "hud-right");

  left.appendChild(el("div", "hud-line"));
  left.appendChild(el("div", "hud-line"));

  const dayLine = left.children[0] as HTMLDivElement;
  const invLine = left.children[1] as HTMLDivElement;

  dayLine.innerHTML =
    `Day: <span id="hud-day">?</span> | ` +
    `Season: <span id="hud-season">?</span> <span id="hud-dayofseason">?</span> | ` +
    `Weather: <span id="hud-weather">?</span> | ` +
    `Time: <span id="hud-time">?</span> | ` +
    `Energy: <span id="hud-energy">?</span> | ` +
    `Gold: <span id="hud-gold">?</span> | ` +
    `Mode: <span id="hud-mode">?</span> | ` +
    `Tile: <span id="hud-tile">?</span>`;
  invLine.innerHTML =
    `Seed: <span id="hud-seed">?</span> x<span id="hud-seedqty">0</span> | ` +
    `Parsnip: <span id="hud-parsnip">0</span> | ` +
    `Chest: <span id="hud-chest">0</span>`;

  right.appendChild(button("Sleep", "btn-sleep"));
  right.appendChild(button("Pause", "btn-pause"));
  right.appendChild(button("Save", "btn-save"));
  right.appendChild(button("Load", "btn-load"));
  right.appendChild(button("Reset", "btn-reset"));

  row.appendChild(left);
  row.appendChild(right);
  host.appendChild(row);

  const hotbar = el("div", "hotbar");
  hotbar.id = "hud-hotbar";
  host.appendChild(hotbar);

  const subHint = el("div", "subhint");
  subHint.textContent = "1-5: Mode | Q: Cycle Seeds | I: Inventory | O: Shop | P: Pause";
  host.appendChild(subHint);

  const btnSleep = document.getElementById("btn-sleep") as HTMLButtonElement;
  const btnPause = document.getElementById("btn-pause") as HTMLButtonElement;
  const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
  const btnLoad = document.getElementById("btn-load") as HTMLButtonElement;
  const btnReset = document.getElementById("btn-reset") as HTMLButtonElement;

  btnSleep.onclick = () => window.__cokeFamer?.api?.sleep();
  btnPause.onclick = () => {
    const paused = Boolean(window.__cokeFamer?.timePaused);
    window.__cokeFamer?.api?.setPaused(!paused);
  };
  btnSave.onclick = () => window.__cokeFamer?.api?.save();
  btnLoad.onclick = () => window.__cokeFamer?.api?.load();
  btnReset.onclick = () => window.__cokeFamer?.api?.reset();

  const hudDay = document.getElementById("hud-day")!;
  const hudSeason = document.getElementById("hud-season")!;
  const hudDayOfSeason = document.getElementById("hud-dayofseason")!;
  const hudWeather = document.getElementById("hud-weather")!;
  const hudTime = document.getElementById("hud-time")!;
  const hudEnergy = document.getElementById("hud-energy")!;
  const hudGold = document.getElementById("hud-gold")!;
  const hudMode = document.getElementById("hud-mode")!;
  const hudTile = document.getElementById("hud-tile")!;
  const hudSeed = document.getElementById("hud-seed")!;
  const hudSeedQty = document.getElementById("hud-seedqty")!;
  const hudParsnip = document.getElementById("hud-parsnip")!;
  const hudChest = document.getElementById("hud-chest")!;

  const hudHotbar = document.getElementById("hud-hotbar")!;

  const toast = el("div", "toast");
  toast.id = "hud-toast";
  host.appendChild(toast);

  const invHost = el("div");
  host.appendChild(invHost);
  const { setOpen: setInvOpen, isOpen: isInvOpen, render: renderInv } = mountInventoryPanel(invHost);

  const shopHost = el("div");
  host.appendChild(shopHost);
  const { setOpen: setShopOpen, isOpen: isShopOpen, render: renderShop } = mountShopPanel(shopHost);

  let invPausedByUi = false;
  const openInventory = () => {
    setInvOpen(true);
    const paused = Boolean(window.__cokeFamer?.timePaused);
    if (!paused) {
      invPausedByUi = true;
      window.__cokeFamer?.api?.setPaused(true);
    }
  };
  const closeInventory = () => {
    setInvOpen(false);
    window.__cokeFamer?.api?.closeChest();
    if (invPausedByUi) {
      invPausedByUi = false;
      window.__cokeFamer?.api?.setPaused(false);
    }
  };
  const toggleInventory = () => {
    if (isInvOpen()) closeInventory();
    else openInventory();
  };

  let shopPausedByUi = false;
  const openShop = () => {
    setShopOpen(true);
    const paused = Boolean(window.__cokeFamer?.timePaused);
    if (!paused) {
      shopPausedByUi = true;
      window.__cokeFamer?.api?.setPaused(true);
    }
  };
  const closeShop = () => {
    setShopOpen(false);
    if (shopPausedByUi) {
      shopPausedByUi = false;
      window.__cokeFamer?.api?.setPaused(false);
    }
  };
  const toggleShop = () => {
    if (isShopOpen()) closeShop();
    else openShop();
  };

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "i") toggleInventory();
    if (e.key.toLowerCase() === "o") toggleShop();
  });

  invHost.addEventListener("inventory:close", () => closeInventory());
  shopHost.addEventListener("shop:close", () => closeShop());

  const renderHotbar = (mode: string, inventory: Record<string, number>, selectedSeed?: string) => {
    const seedId = selectedSeed ?? "parsnip_seed";
    const seedQty = inventory[seedId] ?? 0;
    const entries: Array<{ key: string; label: string }> = [
      { key: "hoe", label: "1 Hoe" },
      { key: "watering_can", label: "2 Water" },
      { key: seedId, label: `3 Seed: ${seedId} (${seedQty})` },
      { key: "hand", label: "4 Hand" },
      { key: "chest", label: `5 Chest (${inventory.chest ?? 0})` }
    ];
    hudHotbar.innerHTML = "";
    for (const e of entries) {
      const slot = el("div", "hotbar-slot");
      if (e.key === mode) slot.classList.add("active");
      slot.textContent = e.label;
      hudHotbar.appendChild(slot);
    }
  };

  const render = () => {
    const s = window.__cokeFamer;
    if (s) {
      hudDay.textContent = String(s.day);
      hudSeason.textContent = s.season ?? "?";
      hudDayOfSeason.textContent = s.dayOfSeason ? `Day ${s.dayOfSeason}` : "";
      hudWeather.textContent = s.weather ?? "?";
      hudMode.textContent = s.mode;
      hudTile.textContent = `${s.player.tx},${s.player.ty}`;
      const sel = s.selectedSeed ?? "parsnip_seed";
      hudSeed.textContent = sel;
      hudSeedQty.textContent = String(s.inventory[sel] ?? 0);
      hudParsnip.textContent = String(s.inventory.parsnip ?? 0);
      hudChest.textContent = String(s.inventory.chest ?? 0);
      hudTime.textContent = s.timeText ?? "?";
      hudEnergy.textContent = `${s.energy ?? "?"}/${s.energyMax ?? "?"}`;
      hudGold.textContent = String(s.gold ?? 0);
      renderHotbar(s.mode, s.inventory, s.selectedSeed);

      btnPause.textContent = s.timePaused ? "Resume" : "Pause";

      const t = s.toast;
      if (t) {
        toast.textContent = t.text;
        toast.dataset.kind = t.kind;
        toast.style.opacity = String(Math.max(0, 1 - (Date.now() - t.ts) / 2500));
      } else {
        toast.textContent = "";
        toast.style.opacity = "0";
      }

      renderInv();
      renderShop();
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
