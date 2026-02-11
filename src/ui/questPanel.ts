function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function mountQuestPanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
} {
  const panel = el("div", "quest-panel");
  const header = el("div", "quest-header");
  const title = el("div", "quest-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (J)";
  title.textContent = "Quest";
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "quest-body");
  panel.appendChild(body);

  host.appendChild(panel);

  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    panel.style.display = open ? "block" : "none";
    if (!open) host.dispatchEvent(new CustomEvent("quest:close"));
  };
  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  const render = () => {
    if (!open) return;
    body.innerHTML = "";
    const s = window.__cokeFamer as any;
    const q = s?.quest as { itemId: string; qty: number; rewardGold: number; completed: boolean } | null | undefined;
    const inv = (s?.inventory as Record<string, number> | undefined) ?? {};

    if (!q) {
      const msg = el("div");
      msg.textContent = "No quest today.";
      body.appendChild(msg);
      return;
    }

    const have = inv[q.itemId] ?? 0;
    const text = el("div", "quest-text");
    text.textContent = `Deliver ${q.itemId} x${q.qty} — ${have}/${q.qty} | Reward: ${q.rewardGold}g`;
    body.appendChild(text);

    const row = el("div", "quest-actions");
    const btn = el("button", "btn");
    btn.textContent = q.completed ? "Completed" : "Complete";
    btn.disabled = q.completed || have < q.qty;
    btn.onclick = () => window.__cokeFamer?.api?.completeQuest();
    row.appendChild(btn);
    body.appendChild(row);
  };

  return { setOpen, isOpen: () => open, render };
}

