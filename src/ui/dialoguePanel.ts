import { NPCS, type NpcId } from "../content/npcs";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function mountDialoguePanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
  setAnchor: (pageX: number, pageY: number) => void;
} {
  const panel = el("div", "dialogue-panel");
  const header = el("div", "dialogue-header");
  const title = el("div", "dialogue-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (Esc)";
  title.textContent = "Dialogue";
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "dialogue-body");
  panel.appendChild(body);

  host.appendChild(panel);

  let open = false;
  let selectedGiftItemId: string | null = null;
  let anchor: { x: number; y: number } | null = null;
  const setOpen = (next: boolean) => {
    open = next;
    panel.style.display = open ? "block" : "none";
    if (!open) host.dispatchEvent(new CustomEvent("dialogue:close"));
  };
  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  const render = () => {
    if (!open) return;
    body.innerHTML = "";
    const s = window.__cokeFamer as any;
    const d = s?.dialogue as { npcId: NpcId; text: string } | null | undefined;

    if (!d) {
      const msg = el("div");
      msg.textContent = "No dialogue.";
      body.appendChild(msg);
      return;
    }

    const rel = s?.relationships?.[d.npcId] as { friendship: number } | undefined;
    const def = NPCS[d.npcId];
    const name = el("div", "dialogue-name");
    name.textContent = `${def?.name ?? d.npcId} (Friendship: ${rel?.friendship ?? 0})`;
    body.appendChild(name);

    const text = el("div", "dialogue-text");
    text.textContent = d.text;
    body.appendChild(text);

    const actions = el("div", "dialogue-actions");
    const sInvSlots = (s?.inventorySlots ?? []) as Array<{ itemId: string; qty: number } | null>;
    const counts = new Map<string, number>();
    for (const slot of sInvSlots) {
      if (!slot) continue;
      counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + slot.qty);
    }
    const options = Array.from(counts.entries())
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (options.length) {
      const wrap = el("div", "dialogue-gift");
      const label = el("div", "dialogue-gift-label");
      label.textContent = "Gift item:";
      const select = document.createElement("select");
      select.className = "select";
      for (const [id, qty] of options) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `${id} x${qty}`;
        select.appendChild(opt);
      }
      const fallback = selectedGiftItemId && counts.get(selectedGiftItemId) ? selectedGiftItemId : options[0]![0];
      select.value = fallback;
      selectedGiftItemId = fallback;
      select.onchange = () => {
        selectedGiftItemId = select.value;
      };
      wrap.appendChild(label);
      wrap.appendChild(select);
      actions.appendChild(wrap);
    }

    const giftBtn = el("button", "btn");
    giftBtn.textContent = "Gift (G)";
    giftBtn.onclick = () => window.__cokeFamer?.api?.giftToNpc?.(d.npcId, selectedGiftItemId ?? undefined);
    actions.appendChild(giftBtn);
    body.appendChild(actions);

    // Position the panel near the NPC anchor (if available) after content updates.
    if (anchor) {
      const pad = 12;
      const r = panel.getBoundingClientRect();
      let left = anchor.x + 12;
      let top = anchor.y - r.height - 18;
      left = Math.max(pad, Math.min(left, window.innerWidth - r.width - pad));
      top = Math.max(pad, Math.min(top, window.innerHeight - r.height - pad));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }
  };

  const setAnchor = (pageX: number, pageY: number) => {
    anchor = { x: pageX, y: pageY };
  };

  return { setOpen, isOpen: () => open, render, setAnchor };
}
