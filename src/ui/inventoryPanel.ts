import type { InventorySlot } from "../simulation/types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
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
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const grid = el("div", "inv-grid");
  panel.appendChild(grid);

  host.appendChild(panel);

  let open = false;

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

      cell.appendChild(name);
      cell.appendChild(qty);
      grid.appendChild(cell);
    }
  };

  return { setOpen, isOpen: () => open, render };
}
