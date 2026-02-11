import type { InventorySlot } from "../simulation/types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function stopContextMenu(node: HTMLElement) {
  node.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function mountInventoryPanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
} {
  const panel = el("div", "inv-panel");
  const header = el("div", "inv-header");
  const title = el("div", "inv-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (I)";

  title.textContent = "Inventory";
  header.appendChild(title);
  const headerRight = el("div", "inv-header-right");
  const sellBtn = el("button", "btn");
  sellBtn.textContent = "Sell Cursor";
  headerRight.appendChild(sellBtn);
  headerRight.appendChild(closeBtn);
  header.appendChild(headerRight);
  panel.appendChild(header);

  const invGrid = el("div", "inv-grid");
  panel.appendChild(invGrid);

  const chestWrap = el("div", "chest-wrap");
  const chestHeader = el("div", "chest-header");
  const chestTitle = el("div", "chest-title");
  const chestClose = el("button", "btn");
  chestClose.textContent = "Close Container";
  chestHeader.appendChild(chestTitle);
  chestHeader.appendChild(chestClose);
  chestWrap.appendChild(chestHeader);
  const chestGrid = el("div", "inv-grid");
  chestWrap.appendChild(chestGrid);
  panel.appendChild(chestWrap);

  const cursorLine = el("div", "inv-cursor");
  panel.appendChild(cursorLine);

  host.appendChild(panel);

  let open = false;
  let cursor: InventorySlot | null = null;

  const setOpen = (next: boolean) => {
    const prev = open;
    open = next;
    panel.style.display = open ? "block" : "none";
    if (prev && !open) {
      host.dispatchEvent(new CustomEvent("inventory:close"));
    }
  };

  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  stopContextMenu(panel);

  const syncCursorLine = () => {
    cursorLine.textContent = cursor ? `Cursor: ${cursor.itemId} x${cursor.qty}` : "Cursor: (empty)";
  };
  syncCursorLine();

  type Container = "inv" | "container";
  const leftClick = (container: Container, slotIndex: number) => {
    const api = window.__cokeFamer?.api;
    if (!api) return;

    if (!cursor) {
      cursor =
        container === "inv"
          ? ((api.invPickup(slotIndex) as any) ?? null)
          : ((api.containerPickup(slotIndex) as any) ?? null);
      syncCursorLine();
      return;
    }

    const res =
      container === "inv"
        ? (api.invPlace(slotIndex, cursor as any) as any)
        : (api.containerPlace(slotIndex, cursor as any) as any);
    // If place returned a different item, that's a swap; otherwise it's remainder.
    cursor = res;
    syncCursorLine();
  };

  const rightClick = (container: Container, slotIndex: number) => {
    const api = window.__cokeFamer?.api;
    if (!api) return;

    if (!cursor) {
      cursor =
        container === "inv"
          ? ((api.invSplitHalf(slotIndex) as any) ?? null)
          : ((api.containerSplitHalf(slotIndex) as any) ?? null);
      syncCursorLine();
      return;
    }

    const placed =
      container === "inv"
        ? (api.invPlaceOne(slotIndex, cursor as any) as any)
        : (api.containerPlaceOne(slotIndex, cursor as any) as any);
    cursor = placed.remaining;
    syncCursorLine();
  };

  sellBtn.onclick = () => {
    if (!cursor) return;
    window.__cokeFamer?.api?.sellStack({ itemId: cursor.itemId, qty: cursor.qty });
    cursor = null;
    syncCursorLine();
  };

  chestClose.onclick = () => {
    window.__cokeFamer?.api?.closeContainer();
  };

  const render = () => {
    if (!open) return;
    const slots = (window.__cokeFamer as any)?.inventorySlots as Array<InventorySlot | null> | undefined;
    invGrid.innerHTML = "";
    const safeSlots = slots ?? [];
    for (let i = 0; i < Math.max(24, safeSlots.length); i++) {
      const slot = safeSlots[i] ?? null;
      const cell = el("div", "inv-slot");
      const name = el("div", "inv-name");
      const qty = el("div", "inv-qty");

      if (slot) {
        name.textContent = String(slot.itemId);
        qty.textContent = String(slot.qty);
      } else {
        name.textContent = "";
        qty.textContent = "";
      }

      cell.onmousedown = (ev) => {
        if (ev.button === 2) rightClick("inv", i);
        else leftClick("inv", i);
      };
      stopContextMenu(cell);

      cell.appendChild(name);
      cell.appendChild(qty);
      invGrid.appendChild(cell);
    }

    const chest = (window.__cokeFamer as any)?.container as
      | { kind: string; tx?: number; ty?: number; slots: Array<InventorySlot | null> }
      | null
      | undefined;
    if (chest && Array.isArray(chest.slots)) {
      chestWrap.style.display = "block";
      const label =
        chest.kind === "shipping_bin" ? "Shipping Bin" : chest.kind === "chest" ? `Chest @ ${chest.tx},${chest.ty}` : chest.kind;
      chestTitle.textContent = label;
      chestGrid.innerHTML = "";
      const cs = chest.slots;
      for (let i = 0; i < Math.max(24, cs.length); i++) {
        const slot = cs[i] ?? null;
        const cell = el("div", "inv-slot");
        const name = el("div", "inv-name");
        const qty = el("div", "inv-qty");
        if (slot) {
          name.textContent = String((slot as any).itemId);
          qty.textContent = String((slot as any).qty);
        } else {
          name.textContent = "";
          qty.textContent = "";
        }
        cell.onmousedown = (ev) => {
          if (ev.button === 2) rightClick("container", i);
          else leftClick("container", i);
        };
        stopContextMenu(cell);
        cell.appendChild(name);
        cell.appendChild(qty);
        chestGrid.appendChild(cell);
      }
    } else {
      chestWrap.style.display = "none";
      chestGrid.innerHTML = "";
    }
  };

  return { setOpen, isOpen: () => open, render };
}
