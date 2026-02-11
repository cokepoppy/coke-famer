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
    const giftBtn = el("button", "btn");
    giftBtn.textContent = "Gift (G)";
    giftBtn.onclick = () => window.__cokeFamer?.api?.giftToNpc?.(d.npcId);
    actions.appendChild(giftBtn);
    body.appendChild(actions);
  };

  return { setOpen, isOpen: () => open, render };
}
