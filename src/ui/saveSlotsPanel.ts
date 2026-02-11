function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

async function tryCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function mountSaveSlotsPanel(host: HTMLElement): {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  render: () => void;
} {
  const panel = el("div", "save-panel");
  const header = el("div", "save-header");
  const title = el("div", "save-title");
  const closeBtn = el("button", "btn");
  closeBtn.textContent = "Close (M)";
  title.textContent = "Save Slots";
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = el("div", "save-body");
  panel.appendChild(body);

  host.appendChild(panel);

  let open = false;
  const setOpen = (next: boolean) => {
    open = next;
    panel.style.display = open ? "block" : "none";
    if (!open) host.dispatchEvent(new CustomEvent("save:close"));
  };
  closeBtn.onclick = () => setOpen(false);
  setOpen(false);

  const render = () => {
    if (!open) return;
    body.innerHTML = "";

    const s = window.__cokeFamer as any;
    const slot = Number(s?.saveSlot ?? s?.api?.getSaveSlot?.() ?? 1);

    const line = el("div", "save-text");
    line.textContent = `Current slot: ${slot}`;
    body.appendChild(line);

    const slotsRow = el("div", "save-actions");
    for (const n of [1, 2, 3]) {
      const btn = el("button", "btn");
      btn.textContent = n === slot ? `Slot ${n} (Current)` : `Switch to Slot ${n}`;
      btn.disabled = n === slot;
      btn.onclick = () => window.__cokeFamer?.api?.setSaveSlot?.(n);
      slotsRow.appendChild(btn);
    }
    body.appendChild(slotsRow);

    const ioRow = el("div", "save-actions");
    const exportBtn = el("button", "btn");
    exportBtn.textContent = "Export Current Slot";
    exportBtn.onclick = async () => {
      const root = window.__cokeFamer;
      const json = root?.api?.exportSave?.() ?? null;
      if (!json) {
        if (root) root.toast = { text: "Nothing to export", kind: "warn", ts: Date.now() };
        return;
      }
      const ok = await tryCopy(json);
      if (ok) {
        if (root) root.toast = { text: "Export copied to clipboard", kind: "info", ts: Date.now() };
        return;
      }
      window.prompt("Copy save JSON:", json);
    };

    const importBtn = el("button", "btn");
    importBtn.textContent = "Import into Current Slot";
    importBtn.onclick = () => {
      const root = window.__cokeFamer;
      const json = window.prompt("Paste save JSON to import:", "");
      if (!json) return;
      const res = root?.api?.importSave?.(json);
      if (root) {
        if (res?.ok) root.toast = { text: "Imported", kind: "info", ts: Date.now() };
        else root.toast = { text: `Import failed: ${res?.reason ?? "unknown"}`, kind: "error", ts: Date.now() };
      }
    };

    ioRow.appendChild(exportBtn);
    ioRow.appendChild(importBtn);
    body.appendChild(ioRow);
  };

  return { setOpen, isOpen: () => open, render };
}
