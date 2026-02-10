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

  const grid = el("div", "inv-grid");
  panel.appendChild(grid);

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

  const leftClick = (slotIndex: number) => {
    const api = window.__cokeFamer?.api;
    if (!api) return;

    if (!cursor) {
      cursor = api.invPickup(slotIndex) as any;
      syncCursorLine();
      return;
    }

    const res = api.invPlace(slotIndex, cursor as any) as any;
    // If place returned a different item, that's a swap; otherwise it's remainder.
    cursor = res;
    syncCursorLine();
  };

  const rightClick = (slotIndex: number) => {
    const api = window.__cokeFamer?.api;
    if (!api) return;

    if (!cursor) {
      cursor = api.invSplitHalf(slotIndex) as any;
      syncCursorLine();
      return;
    }

    const placed = api.invPlaceOne(slotIndex, cursor as any) as any;
    cursor = placed.remaining;
    syncCursorLine();
  };

  sellBtn.onclick = () => {
    if (!cursor) return;
    window.__cokeFamer?.api?.sellStack({ itemId: cursor.itemId, qty: cursor.qty });
    cursor = null;
    syncCursorLine();
  };

  const render = () => {
    if (!open) return;
    const slots = (window.__cokeFamer as any)?.inventorySlots as Array<InventorySlot | null> | undefined;
    grid.innerHTML = "";
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
        if (ev.button === 2) rightClick(i);
        else leftClick(i);
      };
      stopContextMenu(cell);

      cell.appendChild(name);
      cell.appendChild(qty);
      grid.appendChild(cell);
    }
  };

  return { setOpen, isOpen: () => open, render };
}
