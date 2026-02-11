import { ITEMS, type ItemId } from "../content/items";
import { RECIPES } from "../content/recipes";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function mountCraftPanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
} {
  const panel = el("div", "craft-panel");
  const header = el("div", "craft-header");
  const title = el("div", "craft-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (C)";
  title.textContent = "Craft";
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "craft-body");
  panel.appendChild(body);
  host.appendChild(panel);

  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    panel.style.display = open ? "block" : "none";
    if (!open) host.dispatchEvent(new CustomEvent("craft:close"));
  };
  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  const render = () => {
    if (!open) return;
    body.innerHTML = "";
    const inv = (window.__cokeFamer as any)?.inventory as Record<string, number> | undefined;
    const inventory = inv ?? {};

    const row = (output: ItemId, qty: number, ingredients: Partial<Record<ItemId, number>>) => {
      const wrap = el("div", "craft-row");
      const left = el("div", "craft-left");
      const right = el("div", "craft-right");

      const outDef = ITEMS[output];
      const ingText = Object.entries(ingredients)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([id, v]) => {
          const need = v ?? 0;
          const have = inventory[id] ?? 0;
          return `${id} ${have}/${need}`;
        })
        .join(" | ");

      left.textContent = `${outDef.name} x${qty} — ${ingText}`;

      const btn = el("button", "btn");
      btn.textContent = "Craft x1";

      const canCraft = Object.entries(ingredients).every(([id, v]) => (inventory[id] ?? 0) >= (v ?? 0));
      btn.disabled = !canCraft;
      btn.onclick = () => window.__cokeFamer?.api?.craft(output, 1);

      right.appendChild(btn);
      wrap.appendChild(left);
      wrap.appendChild(right);
      return wrap;
    };

    for (const r of RECIPES) {
      body.appendChild(row(r.output, r.qty, r.ingredients as any));
    }
  };

  return { setOpen, isOpen: () => open, render };
}

