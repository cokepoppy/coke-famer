function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function mountShopPanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
} {
  const panel = el("div", "shop-panel");
  const header = el("div", "shop-header");
  const title = el("div", "shop-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (O)";
  title.textContent = "Shop";
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "shop-body");
  panel.appendChild(body);

  host.appendChild(panel);

  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    panel.style.display = open ? "block" : "none";
    if (!open) host.dispatchEvent(new CustomEvent("shop:close"));
  };
  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  const buyRow = (label: string, itemId: string, qty: number) => {
    const row = el("div", "shop-row");
    const left = el("div", "shop-left");
    const right = el("div", "shop-right");
    left.textContent = label;
    const btn = el("button", "btn");
    btn.textContent = `Buy x${qty}`;
    btn.onclick = () => window.__cokeFamer?.api?.shopBuy(itemId, qty);
    right.appendChild(btn);
    row.appendChild(left);
    row.appendChild(right);
    return row;
  };

  const render = () => {
    if (!open) return;
    body.innerHTML = "";
    const season = (window.__cokeFamer as any)?.season as string | undefined;
    if (!season) {
      body.appendChild(buyRow("Parsnip Seeds (20g)", "parsnip_seed", 1));
      body.appendChild(buyRow("Parsnip Seeds (20g)", "parsnip_seed", 5));
      return;
    }

    if (season === "spring") {
      body.appendChild(buyRow("Parsnip Seeds (20g)", "parsnip_seed", 1));
      body.appendChild(buyRow("Parsnip Seeds (20g)", "parsnip_seed", 5));
      body.appendChild(buyRow("Potato Seeds (50g)", "potato_seed", 1));
      body.appendChild(buyRow("Potato Seeds (50g)", "potato_seed", 5));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 1));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 5));
      body.appendChild(buyRow("Chest (200g)", "chest", 1));
    } else if (season === "summer") {
      body.appendChild(buyRow("Blueberry Seeds (80g)", "blueberry_seed", 1));
      body.appendChild(buyRow("Blueberry Seeds (80g)", "blueberry_seed", 5));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 1));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 5));
      body.appendChild(buyRow("Chest (200g)", "chest", 1));
    } else if (season === "fall") {
      body.appendChild(buyRow("Cranberry Seeds (100g)", "cranberry_seed", 1));
      body.appendChild(buyRow("Cranberry Seeds (100g)", "cranberry_seed", 5));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 1));
      body.appendChild(buyRow("Acorn (20g)", "acorn", 5));
      body.appendChild(buyRow("Chest (200g)", "chest", 1));
    } else {
      const msg = el("div");
      msg.textContent = "Shop is closed this season (demo).";
      body.appendChild(msg);
    }
  };

  return { setOpen, isOpen: () => open, render };
}
