import { CROPS, type CropId } from "../content/crops";
import { ITEMS, type ItemId } from "../content/items";
import { RECIPES } from "../content/recipes";
import { NPCS, type NpcId } from "../content/npcs";
import { calendarFromDay, weatherForDay } from "./calendar";
import type {
  GameSaveV0,
  GameSaveV1,
  GameSaveV2,
  GameSaveV3,
  GameSaveV4,
  GameSaveV5,
  GameSaveV6,
  InventorySlot,
  QuestState,
  RelationshipState,
  TileKey,
  PlacedObjectState,
  TileState
} from "./types";

function saveKey(slot: number): string {
  const s = Math.max(1, Math.floor(slot));
  if (s === 1) return "coke-famer-save";
  return `coke-famer-save:slot${s}`;
}
const CURRENT_SAVE_VERSION = 6 as const;

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 26 * 60; // 2:00 next day (allow wrap handling in UI)
const ENERGY_MAX = 270;
const INVENTORY_SIZE = 24;
const START_GOLD = 500;
const CHEST_SIZE = 24;
const WOOD_NODE_HP = 3;
const STONE_NODE_HP = 3;
const WEED_NODE_HP = 1;
const WOOD_NODE_DROP = 5;
const STONE_NODE_DROP = 5;
const WEED_NODE_DROP = 3;
const TREE_SEED_DAYS = 3;
const TREE_SAPLING_DAYS = 3;
const TREE_HP_BY_STAGE = { 0: 1, 1: 2, 2: 6 } as const;
const TREE_WOOD_BY_STAGE = { 0: 0, 1: 5, 2: 15 } as const;
const MINUTES_PER_DAY = 24 * 60;
const PRESERVES_MINUTES = 180;
const SHIPPING_BIN_SIZE = 24;

const ACTION_MINUTES = {
  hoe: 10,
  water: 10,
  plant: 10,
  harvest: 5,
  scythe: 5,
  gift: 0,
  chop: 10,
  mine: 10
} as const;

const ACTION_ENERGY = {
  hoe: 2,
  water: 2,
  plant: 2,
  harvest: 0,
  scythe: 0,
  gift: 0,
  chop: 4,
  mine: 4
} as const;

function tileKey(tx: number, ty: number): TileKey {
  return `${tx},${ty}`;
}

function cloneTileState(state: TileState): TileState {
  return {
    tilled: state.tilled,
    watered: state.watered,
    crop: state.crop ? { ...state.crop } : null
  };
}

export class FarmGame {
  day = 1;
  minutes = DAY_START_MINUTES;
  energy = ENERGY_MAX;
  gold = START_GOLD;
  inventorySlots: Array<InventorySlot | null> = Array.from({ length: INVENTORY_SIZE }, () => null);
  private tiles = new Map<TileKey, TileState>();
  private objects = new Map<TileKey, PlacedObjectState>();
  private quest: QuestState | null = null;
  private relationships: Partial<Record<NpcId, RelationshipState>> = {};

  private normalizeRelationshipState(state?: Partial<RelationshipState> | null): RelationshipState {
    const friendshipRaw = Number(state?.friendship ?? 0);
    const lastTalkDayRaw = Number(state?.lastTalkDay ?? 0);
    const lastGiftDayRaw = Number((state as any)?.lastGiftDay ?? 0);
    const friendship = Number.isFinite(friendshipRaw) ? Math.max(0, friendshipRaw) : 0;
    const lastTalkDay = Number.isFinite(lastTalkDayRaw) ? Math.max(0, Math.floor(lastTalkDayRaw)) : 0;
    const lastGiftDay = Number.isFinite(lastGiftDayRaw) ? Math.max(0, Math.floor(lastGiftDayRaw)) : 0;
    return { friendship, lastTalkDay, lastGiftDay };
  }

  private normalizeRelationships(
    rels: Partial<Record<NpcId, Partial<RelationshipState> | RelationshipState>> | null | undefined
  ): Partial<Record<NpcId, RelationshipState>> {
    const out: Partial<Record<NpcId, RelationshipState>> = {};
    for (const id of Object.keys(NPCS) as NpcId[]) {
      out[id] = this.normalizeRelationshipState(rels?.[id] as any);
    }
    return out;
  }

  static newGame(): FarmGame {
    const g = new FarmGame();
    g.day = 1;
    g.minutes = DAY_START_MINUTES;
    g.energy = ENERGY_MAX;
    g.gold = START_GOLD;
    g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
    g.addItem("parsnip_seed", 15);
    g.quest = g.generateQuestForDay(g.day);
    g.relationships = g.defaultRelationships();
    return g;
  }

  static loadFromStorage(slot = 1): FarmGame | null {
    const raw = localStorage.getItem(saveKey(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | GameSaveV0
      | GameSaveV1
      | GameSaveV2
      | GameSaveV3
      | GameSaveV4
      | GameSaveV5
      | GameSaveV6;
    if (!parsed) return null;

    const g = new FarmGame();
    if (parsed.version === 0) {
      g.day = parsed.day;
      g.minutes = DAY_START_MINUTES;
      g.energy = ENERGY_MAX;
      g.gold = START_GOLD;
      g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
      for (const it of parsed.inventory ?? []) g.addItem(it.itemId, it.qty);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      g.quest = g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 1) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = START_GOLD;
      g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
      for (const it of parsed.inventory ?? []) g.addItem(it.itemId, it.qty);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      g.quest = g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 2) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = parsed.gold ?? START_GOLD;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      g.quest = g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 3) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = parsed.gold ?? START_GOLD;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      g.quest = g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 4) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = parsed.gold ?? START_GOLD;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      for (const o of parsed.objects ?? []) g.objects.set(tileKey(o.tx, o.ty), o.obj);
      g.quest = g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 5) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = parsed.gold ?? START_GOLD;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      for (const o of parsed.objects ?? []) g.objects.set(tileKey(o.tx, o.ty), o.obj);
      g.quest = parsed.quest ?? g.generateQuestForDay(g.day);
      g.relationships = g.defaultRelationships();
      // Migrate-on-load
      g.saveToStorage(slot);
      return g;
    }
    if (parsed.version === 6) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.gold = parsed.gold ?? START_GOLD;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      for (const o of parsed.objects ?? []) g.objects.set(tileKey(o.tx, o.ty), o.obj);
      g.quest = parsed.quest ?? g.generateQuestForDay(g.day);
      g.relationships = g.normalizeRelationships({ ...g.defaultRelationships(), ...(parsed.relationships ?? {}) });
      return g;
    }
    return null;
  }

  saveToStorage(slot = 1): void {
    const tiles: GameSaveV0["tiles"] = [];
    for (const [k, state] of this.tiles.entries()) {
      const [txStr, tyStr] = k.split(",");
      tiles.push({ tx: Number(txStr), ty: Number(tyStr), state });
    }
    const objects: GameSaveV4["objects"] = [];
    for (const [k, obj] of this.objects.entries()) {
      const [txStr, tyStr] = k.split(",");
      objects.push({ tx: Number(txStr), ty: Number(tyStr), obj });
    }

    const save: GameSaveV6 = {
      version: CURRENT_SAVE_VERSION,
      day: this.day,
      minutes: this.minutes,
      energy: this.energy,
      inventorySlots: this.inventorySlots,
      gold: this.gold,
      tiles,
      objects,
      quest: this.quest,
      relationships: this.relationships
    };
    localStorage.setItem(saveKey(slot), JSON.stringify(save));
  }

  resetToNewGame(): void {
    const fresh = FarmGame.newGame();
    this.day = fresh.day;
    this.minutes = fresh.minutes;
    this.energy = fresh.energy;
    this.gold = fresh.gold;
    this.inventorySlots = fresh.inventorySlots;
    this.tiles = new Map();
    this.objects = new Map();
    this.quest = fresh.quest;
    this.relationships = fresh.relationships;
  }

  static exportSaveJson(slot = 1): string | null {
    return localStorage.getItem(saveKey(slot));
  }

  static importSaveJson(slot: number, json: string): { ok: boolean; reason?: string } {
    if (!json || typeof json !== "string") return { ok: false, reason: "json" };
    try {
      JSON.parse(json);
    } catch {
      return { ok: false, reason: "parse" };
    }
    localStorage.setItem(saveKey(slot), json);
    return { ok: true };
  }

  getTile(tx: number, ty: number): TileState {
    const k = tileKey(tx, ty);
    const existing = this.tiles.get(k);
    if (existing) return cloneTileState(existing);
    return { tilled: false, watered: false, crop: null };
  }

  getAllTiles(): Array<{ tx: number; ty: number; state: TileState }> {
    const out: Array<{ tx: number; ty: number; state: TileState }> = [];
    for (const [k, state] of this.tiles.entries()) {
      const [txStr, tyStr] = k.split(",");
      out.push({ tx: Number(txStr), ty: Number(tyStr), state: cloneTileState(state) });
    }
    return out;
  }

  getObject(tx: number, ty: number): PlacedObjectState | null {
    return this.objects.get(tileKey(tx, ty)) ?? null;
  }

  getAllObjects(): Array<{ tx: number; ty: number; obj: PlacedObjectState }> {
    const out: Array<{ tx: number; ty: number; obj: PlacedObjectState }> = [];
    for (const [k, obj] of this.objects.entries()) {
      const [txStr, tyStr] = k.split(",");
      out.push({ tx: Number(txStr), ty: Number(tyStr), obj });
    }
    return out;
  }

  getAbsMinutes(): number {
    return (this.day - 1) * MINUTES_PER_DAY + this.minutes;
  }

  getQuest(): QuestState | null {
    return this.quest ? { ...this.quest } : null;
  }

  debugSetQuest(q: QuestState | null): void {
    this.quest = q ? { ...q } : null;
  }

  completeQuest(): { ok: boolean; reason?: string; goldGained?: number } {
    const q = this.quest;
    if (!q) return { ok: false, reason: "no_quest" };
    if (q.completed) return { ok: false, reason: "completed" };
    if (this.countItem(q.itemId) < q.qty) return { ok: false, reason: "missing" };
    const ok = this.consumeItem(q.itemId, q.qty);
    if (!ok) return { ok: false, reason: "missing" };
    this.gold += q.rewardGold;
    q.completed = true;
    this.quest = q;
    return { ok: true, goldGained: q.rewardGold };
  }

  getRelationship(npcId: NpcId): RelationshipState {
    return this.normalizeRelationshipState(this.relationships[npcId]);
  }

  talkToNpc(npcId: NpcId): { ok: boolean; reason?: string; friendshipGained?: number; relationship?: RelationshipState } {
    if (!NPCS[npcId]) return { ok: false, reason: "unknown_npc" };
    const current = this.normalizeRelationshipState(this.relationships[npcId]);
    if (current.lastTalkDay === this.day) return { ok: false, reason: "already_talked", relationship: { ...current } };
    const next = { ...current, friendship: current.friendship + 20, lastTalkDay: this.day };
    this.relationships[npcId] = next;
    return { ok: true, friendshipGained: 20, relationship: { ...next } };
  }

  private defaultRelationships(): Partial<Record<NpcId, RelationshipState>> {
    return this.normalizeRelationships(null);
  }

  giftToNpc(
    npcId: NpcId,
    opts?: {
      itemId?: ItemId;
    }
  ): {
    ok: boolean;
    reason?: string;
    friendshipGained?: number;
    itemId?: ItemId;
    taste?: string;
    relationship?: RelationshipState;
  } {
    const npc = NPCS[npcId];
    if (!npc) return { ok: false, reason: "unknown_npc" };

    const current = this.normalizeRelationshipState(this.relationships[npcId]);
    if (current.lastGiftDay === this.day) return { ok: false, reason: "already_gifted", relationship: { ...current } };

    const chosen = opts?.itemId ?? null;
    if (chosen) {
      if (!ITEMS[chosen]) return { ok: false, reason: "unknown_item", relationship: { ...current } };
      if (this.countItem(chosen) <= 0) return { ok: false, reason: "missing_item", relationship: { ...current } };
    }

    const candidates: ItemId[] = ["blueberry", "cranberry", "potato", "parsnip", "wood", "fiber", "stone"];
    const itemId = chosen ?? candidates.find((id) => this.countItem(id) > 0) ?? null;
    if (!itemId) return { ok: false, reason: "no_gift_items", relationship: { ...current } };

    const ok = this.consumeItem(itemId, 1);
    if (!ok) return { ok: false, reason: "no_gift_items", relationship: { ...current } };

    const taste = npc.giftTastes?.[itemId] ?? "neutral";
    const delta = taste === "loved" ? 80 : taste === "liked" ? 45 : taste === "disliked" ? -20 : 20;
    const next = { ...current, friendship: Math.max(0, current.friendship + delta), lastGiftDay: this.day };
    this.relationships[npcId] = next;
    return { ok: true, friendshipGained: delta, itemId, taste, relationship: { ...next } };
  }

  private generateQuestForDay(day: number): QuestState {
    // Deterministic "Help Wanted" style quest pool (keep to early-game items).
    const pool: Array<{ itemId: "wood" | "stone" | "fiber" | "parsnip"; baseQty: number; baseGold: number }> = [
      { itemId: "wood", baseQty: 15, baseGold: 60 },
      { itemId: "stone", baseQty: 15, baseGold: 60 },
      { itemId: "fiber", baseQty: 10, baseGold: 50 },
      { itemId: "parsnip", baseQty: 1, baseGold: 80 }
    ];
    const idx = day % pool.length;
    const pick = pool[idx]!;
    const extra = Math.floor((day % 7) / 3);
    const qty = pick.baseQty + extra * (pick.itemId === "parsnip" ? 0 : 5);
    const rewardGold = pick.baseGold + extra * 15;
    return { dayIssued: day, itemId: pick.itemId, qty, rewardGold, completed: false };
  }

  refreshDerivedState(): void {
    this.updateMachines();
  }

  advanceMinutes(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.minutes += delta;
    this.updateMachines();
  }

  private updateMachines(): void {
    const now = this.getAbsMinutes();
    for (const obj of this.objects.values()) {
      if (obj.id !== "preserves_jar") continue;
      if (!obj.completeAtAbsMinutes || obj.completeAtAbsMinutes > now) continue;
      if (!obj.input) {
        obj.completeAtAbsMinutes = null;
        continue;
      }
      if (obj.output) {
        obj.completeAtAbsMinutes = null;
        continue;
      }
      const out = this.preservesOutputFor(obj.input);
      if (!out) {
        obj.input = null;
        obj.completeAtAbsMinutes = null;
        continue;
      }
      obj.output = out;
      obj.input = null;
      obj.completeAtAbsMinutes = null;
    }
  }

  private growTreesNextDay(): void {
    for (const obj of this.objects.values()) {
      if (obj.id !== "tree") continue;
      if (obj.stage >= 2) continue;
      obj.daysInStage += 1;
      const needed = obj.stage === 0 ? TREE_SEED_DAYS : TREE_SAPLING_DAYS;
      if (obj.daysInStage < needed) continue;
      obj.stage = (obj.stage + 1) as 0 | 1 | 2;
      obj.daysInStage = 0;
      obj.hp = TREE_HP_BY_STAGE[obj.stage];
    }
  }

  private preservesOutputFor(input: ItemId): ItemId | null {
    if (input === "parsnip") return "parsnip_jar";
    if (input === "potato") return "potato_jar";
    if (input === "blueberry") return "blueberry_jar";
    if (input === "cranberry") return "cranberry_jar";
    return null;
  }

  private getShippingBinRef(): Array<InventorySlot | null> | null {
    for (const obj of this.objects.values()) {
      if (obj.id === "shipping_bin") return (obj as any).slots as Array<InventorySlot | null>;
    }
    return null;
  }

  ensureShippingBinAt(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    this.objects.set(key, { id: "shipping_bin", slots: Array.from({ length: SHIPPING_BIN_SIZE }, () => null) } as any);
    return true;
  }

  getShippingBinSlots(): ReadonlyArray<InventorySlot | null> {
    const slots = this.getShippingBinRef();
    return slots ? slots.slice() : [];
  }

  shippingPickup(index: number): InventorySlot | null {
    const slots = this.getShippingBinRef();
    if (!slots) return null;
    return this.opsPickup(slots, index);
  }

  shippingSplitHalf(index: number): InventorySlot | null {
    const slots = this.getShippingBinRef();
    if (!slots) return null;
    return this.opsSplitHalf(slots, index);
  }

  shippingPlace(index: number, stack: InventorySlot): InventorySlot | null {
    const slots = this.getShippingBinRef();
    if (!slots) return stack;
    return this.opsPlace(slots, index, stack);
  }

  shippingPlaceOne(index: number, stack: InventorySlot): { ok: boolean; remaining: InventorySlot | null } {
    const slots = this.getShippingBinRef();
    if (!slots) return { ok: false, remaining: stack };
    return this.opsPlaceOne(slots, index, stack);
  }

  sellShippingBin(): { goldGained: number; itemsSold: number } {
    const slots = this.getShippingBinRef();
    if (!slots) return { goldGained: 0, itemsSold: 0 };
    let goldGained = 0;
    let itemsSold = 0;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const def = ITEMS[slot.itemId];
      goldGained += def.sellPrice * slot.qty;
      itemsSold += slot.qty;
      slots[i] = null;
    }
    this.gold += goldGained;
    return { goldGained, itemsSold };
  }

  placeChest(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop) return false;
    if (!this.consumeItem("chest", 1)) return false;
    this.objects.set(key, { id: "chest", slots: Array.from({ length: CHEST_SIZE }, () => null) });
    return true;
  }

  placeResource(tx: number, ty: number, kind: "wood" | "stone", hp?: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    const nodeHp = hp ?? (kind === "wood" ? WOOD_NODE_HP : STONE_NODE_HP);
    this.objects.set(key, { id: kind, hp: Math.max(1, nodeHp) });
    return true;
  }

  placeWeed(tx: number, ty: number, hp?: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    const nodeHp = hp ?? WEED_NODE_HP;
    this.objects.set(key, { id: "weed", hp: Math.max(1, nodeHp) });
    return true;
  }

  plantTree(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.plant)) return false;
    if (!this.consumeItem("acorn", 1)) return false;
    this.objects.set(key, { id: "tree", stage: 0, daysInStage: 0, hp: TREE_HP_BY_STAGE[0] });
    this.spend("plant");
    return true;
  }

  placePreservesJar(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    if (!this.consumeItem("preserves_jar", 1)) return false;
    this.objects.set(key, { id: "preserves_jar", input: null, output: null, completeAtAbsMinutes: null });
    return true;
  }

  interactPreservesJar(tx: number, ty: number): { ok: boolean; reason?: string } {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "preserves_jar") return { ok: false, reason: "not_a_jar" };

    this.updateMachines();

    if (obj.output) {
      const out = obj.output;
      if (!this.canAddItem(out, 1)) return { ok: false, reason: "inv_full" };
      const added = this.addItem(out, 1);
      if (!added) return { ok: false, reason: "inv_full" };
      obj.output = null;
      return { ok: true };
    }

    if (obj.input && obj.completeAtAbsMinutes) return { ok: false, reason: "processing" };

    const candidates: ItemId[] = ["parsnip", "potato", "blueberry", "cranberry"];
    const input = candidates.find((id) => this.countItem(id) > 0) ?? null;
    if (!input) return { ok: false, reason: "no_input" };
    const out = this.preservesOutputFor(input);
    if (!out) return { ok: false, reason: "bad_input" };
    const ok = this.consumeItem(input, 1);
    if (!ok) return { ok: false, reason: "no_input" };
    obj.input = input;
    obj.output = null;
    obj.completeAtAbsMinutes = this.getAbsMinutes() + PRESERVES_MINUTES;
    return { ok: true };
  }

  pickupPreservesJarIfIdle(tx: number, ty: number): { ok: boolean; reason?: string } {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "preserves_jar") return { ok: false, reason: "not_a_jar" };
    this.updateMachines();
    if (obj.input || obj.output || obj.completeAtAbsMinutes) return { ok: false, reason: "busy" };

    this.objects.delete(key);
    const added = this.addItem("preserves_jar", 1);
    if (!added) {
      this.objects.set(key, obj);
      return { ok: false, reason: "inv_full" };
    }
    return { ok: true };
  }

  placeSimpleObject(tx: number, ty: number, id: "fence" | "path" | "sprinkler" | "quality_sprinkler"): boolean {
    const key = tileKey(tx, ty);
    if (this.objects.has(key)) return false;
    const t = this.getTile(tx, ty);
    if (t.crop || t.tilled || t.watered) return false;
    if (!this.consumeItem(id, 1)) return false;
    this.objects.set(key, { id });
    return true;
  }

  pickupSimpleObject(tx: number, ty: number, id: "fence" | "path" | "sprinkler" | "quality_sprinkler"): boolean {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== id) return false;
    this.objects.delete(key);
    const added = this.addItem(id, 1);
    if (!added) {
      this.objects.set(key, obj);
      return false;
    }
    return true;
  }

  removeChest(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "chest") return false;
    this.objects.delete(key);
    this.addItem("chest", 1);
    return true;
  }

  pickupChestIfEmpty(tx: number, ty: number): { ok: boolean; reason?: "not_a_chest" | "not_empty" | "inv_full" } {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "chest") return { ok: false, reason: "not_a_chest" };
    const hasAny = obj.slots.some((s) => Boolean(s));
    if (hasAny) return { ok: false, reason: "not_empty" };
    this.objects.delete(key);
    const added = this.addItem("chest", 1);
    if (!added) {
      this.objects.set(key, obj);
      return { ok: false, reason: "inv_full" };
    }
    return { ok: true };
  }

  getChestSlots(tx: number, ty: number): ReadonlyArray<InventorySlot | null> | null {
    const obj = this.getObject(tx, ty);
    if (!obj || obj.id !== "chest") return null;
    return obj.slots.slice();
  }

  private getChestRef(tx: number, ty: number): Array<InventorySlot | null> | null {
    const obj = this.getObject(tx, ty);
    if (!obj || obj.id !== "chest") return null;
    return obj.slots;
  }

  private setTile(tx: number, ty: number, state: TileState): void {
    const k = tileKey(tx, ty);
    if (!state.tilled && !state.watered && !state.crop) {
      this.tiles.delete(k);
      return;
    }
    this.tiles.set(k, state);
  }

  getInventorySlots(): ReadonlyArray<InventorySlot | null> {
    return this.inventorySlots.slice();
  }

  private opsPickup(slots: Array<InventorySlot | null>, index: number): InventorySlot | null {
    if (index < 0 || index >= slots.length) return null;
    const slot = slots[index];
    if (!slot) return null;
    slots[index] = null;
    return { itemId: slot.itemId, qty: slot.qty };
  }

  private opsSplitHalf(slots: Array<InventorySlot | null>, index: number): InventorySlot | null {
    if (index < 0 || index >= slots.length) return null;
    const slot = slots[index];
    if (!slot) return null;
    if (slot.qty <= 1) {
      slots[index] = null;
      return { itemId: slot.itemId, qty: slot.qty };
    }
    const take = Math.ceil(slot.qty / 2);
    slot.qty -= take;
    return { itemId: slot.itemId, qty: take };
  }

  private opsPlace(slots: Array<InventorySlot | null>, index: number, stack: InventorySlot): InventorySlot | null {
    if (index < 0 || index >= slots.length) return stack;
    if (!stack || stack.qty <= 0) return null;
    const max = ITEMS[stack.itemId].maxStack;
    const current = slots[index];

    if (!current) {
      const put = Math.min(max, stack.qty);
      slots[index] = { itemId: stack.itemId, qty: put };
      const rem = stack.qty - put;
      return rem > 0 ? { itemId: stack.itemId, qty: rem } : null;
    }

    if (current.itemId === stack.itemId) {
      const space = Math.max(0, max - current.qty);
      const put = Math.min(space, stack.qty);
      current.qty += put;
      const rem = stack.qty - put;
      return rem > 0 ? { itemId: stack.itemId, qty: rem } : null;
    }

    slots[index] = { itemId: stack.itemId, qty: Math.min(max, stack.qty) };
    return { itemId: current.itemId, qty: current.qty };
  }

  private opsPlaceOne(
    slots: Array<InventorySlot | null>,
    index: number,
    stack: InventorySlot
  ): { ok: boolean; remaining: InventorySlot | null } {
    if (index < 0 || index >= slots.length) return { ok: false, remaining: stack };
    if (!stack || stack.qty <= 0) return { ok: false, remaining: null };

    const max = ITEMS[stack.itemId].maxStack;
    const current = slots[index];

    if (!current) {
      slots[index] = { itemId: stack.itemId, qty: 1 };
      const remQty = stack.qty - 1;
      return { ok: true, remaining: remQty > 0 ? { itemId: stack.itemId, qty: remQty } : null };
    }

    if (current.itemId !== stack.itemId) return { ok: false, remaining: stack };
    if (current.qty >= max) return { ok: false, remaining: stack };
    current.qty += 1;
    const remQty = stack.qty - 1;
    return { ok: true, remaining: remQty > 0 ? { itemId: stack.itemId, qty: remQty } : null };
  }

  private addItem(itemId: ItemId, qty: number): boolean {
    if (qty <= 0) return true;
    let remaining = qty;

    // First, fill existing stacks.
    for (const slot of this.inventorySlots) {
      if (!slot || slot.itemId !== itemId) continue;
      const max = ITEMS[itemId].maxStack;
      const space = Math.max(0, max - slot.qty);
      const take = Math.min(space, remaining);
      slot.qty += take;
      remaining -= take;
      if (remaining <= 0) return true;
    }

    // Then, use empty slots.
    for (let i = 0; i < this.inventorySlots.length; i++) {
      if (this.inventorySlots[i]) continue;
      const max = ITEMS[itemId].maxStack;
      const put = Math.min(max, remaining);
      this.inventorySlots[i] = { itemId, qty: put };
      remaining -= put;
      if (remaining <= 0) return true;
    }

    return false;
  }

  private consumeItem(itemId: ItemId, qty: number): boolean {
    if (qty <= 0) return true;
    if (this.countItem(itemId) < qty) return false;
    let remaining = qty;
    for (let i = 0; i < this.inventorySlots.length; i++) {
      const slot = this.inventorySlots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const take = Math.min(slot.qty, remaining);
      slot.qty -= take;
      remaining -= take;
      if (slot.qty <= 0) this.inventorySlots[i] = null;
      if (remaining <= 0) break;
    }
    return true;
  }

  countItem(itemId: ItemId): number {
    let total = 0;
    for (const slot of this.inventorySlots) {
      if (slot?.itemId === itemId) total += slot.qty;
    }
    return total;
  }

  private capacityFor(itemId: ItemId): number {
    const max = ITEMS[itemId].maxStack;
    let cap = 0;
    for (const slot of this.inventorySlots) {
      if (!slot) cap += max;
      else if (slot.itemId === itemId) cap += Math.max(0, max - slot.qty);
    }
    return cap;
  }

  canAddItem(itemId: ItemId, qty: number): boolean {
    return this.capacityFor(itemId) >= qty;
  }

  buy(itemId: ItemId, qty: number): { ok: boolean; reason?: string } {
    if (qty <= 0) return { ok: false, reason: "qty" };
    const def = ITEMS[itemId];
    if (def.buyPrice == null) return { ok: false, reason: "not_for_sale" };
    const cost = def.buyPrice * qty;
    if (this.gold < cost) return { ok: false, reason: "gold" };
    if (!this.canAddItem(itemId, qty)) return { ok: false, reason: "inv_full" };
    const added = this.addItem(itemId, qty);
    if (!added) return { ok: false, reason: "inv_full" };
    this.gold -= cost;
    return { ok: true };
  }

  craft(output: ItemId, qty: number): { ok: boolean; reason?: string } {
    if (qty <= 0) return { ok: false, reason: "qty" };
    const recipe = RECIPES.find((r) => r.output === output);
    if (!recipe) return { ok: false, reason: "no_recipe" };

    const outQty = recipe.qty * qty;
    if (!this.canAddItem(output, outQty)) return { ok: false, reason: "inv_full" };

    for (const [itemId, needEach] of Object.entries(recipe.ingredients)) {
      const need = (needEach ?? 0) * qty;
      if (need <= 0) continue;
      if (this.countItem(itemId as ItemId) < need) return { ok: false, reason: "missing" };
    }

    for (const [itemId, needEach] of Object.entries(recipe.ingredients)) {
      const need = (needEach ?? 0) * qty;
      if (need <= 0) continue;
      const ok = this.consumeItem(itemId as ItemId, need);
      if (!ok) return { ok: false, reason: "missing" };
    }

    const added = this.addItem(output, outQty);
    if (!added) return { ok: false, reason: "inv_full" };
    return { ok: true };
  }

  sellStack(stack: InventorySlot): { ok: boolean; goldGained?: number; reason?: string } {
    if (!stack || stack.qty <= 0) return { ok: false, reason: "stack" };
    const def = ITEMS[stack.itemId];
    const gain = def.sellPrice * stack.qty;
    this.gold += gain;
    return { ok: true, goldGained: gain };
  }

  inventoryPickup(index: number): InventorySlot | null {
    return this.opsPickup(this.inventorySlots, index);
  }

  inventorySplitHalf(index: number): InventorySlot | null {
    return this.opsSplitHalf(this.inventorySlots, index);
  }

  inventoryPlace(index: number, stack: InventorySlot): InventorySlot | null {
    return this.opsPlace(this.inventorySlots, index, stack);
  }

  inventoryPlaceOne(index: number, stack: InventorySlot): { ok: boolean; remaining: InventorySlot | null } {
    return this.opsPlaceOne(this.inventorySlots, index, stack);
  }

  chestPickup(tx: number, ty: number, index: number): InventorySlot | null {
    const slots = this.getChestRef(tx, ty);
    if (!slots) return null;
    return this.opsPickup(slots, index);
  }

  chestSplitHalf(tx: number, ty: number, index: number): InventorySlot | null {
    const slots = this.getChestRef(tx, ty);
    if (!slots) return null;
    return this.opsSplitHalf(slots, index);
  }

  chestPlace(tx: number, ty: number, index: number, stack: InventorySlot): InventorySlot | null {
    const slots = this.getChestRef(tx, ty);
    if (!slots) return stack;
    return this.opsPlace(slots, index, stack);
  }

  chestPlaceOne(
    tx: number,
    ty: number,
    index: number,
    stack: InventorySlot
  ): { ok: boolean; remaining: InventorySlot | null } {
    const slots = this.getChestRef(tx, ty);
    if (!slots) return { ok: false, remaining: stack };
    return this.opsPlaceOne(slots, index, stack);
  }

  private canSpendEnergy(cost: number): boolean {
    return this.energy >= cost;
  }

  private spend(action: keyof typeof ACTION_MINUTES): void {
    this.advanceMinutes(ACTION_MINUTES[action]);
    this.energy = Math.max(0, this.energy - ACTION_ENERGY[action]);
  }

  private hasBlockingObject(tx: number, ty: number): boolean {
    return this.objects.has(tileKey(tx, ty));
  }

  hoe(tx: number, ty: number): boolean {
    if (this.hasBlockingObject(tx, ty)) return false;
    const state = this.getTile(tx, ty);
    if (state.tilled) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.hoe)) return false;
    state.tilled = true;
    state.watered = false;
    this.setTile(tx, ty, state);
    this.spend("hoe");
    return true;
  }

  water(tx: number, ty: number): boolean {
    if (this.hasBlockingObject(tx, ty)) return false;
    const state = this.getTile(tx, ty);
    if (!state.tilled) return false;
    if (state.watered) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.water)) return false;
    state.watered = true;
    this.setTile(tx, ty, state);
    this.spend("water");
    return true;
  }

  plant(tx: number, ty: number, cropId: CropId): boolean {
    const def = CROPS[cropId];
    const { season } = calendarFromDay(this.day);
    if (!def.seasons.includes(season)) return false;
    if (this.hasBlockingObject(tx, ty)) return false;
    const state = this.getTile(tx, ty);
    if (!state.tilled) return false;
    if (state.crop) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.plant)) return false;
    if (!this.consumeItem(def.seedItemId as ItemId, 1)) return false;
    state.crop = { cropId, stage: 0, daysInStage: 0, harvestsDone: 0 };
    this.setTile(tx, ty, state);
    this.spend("plant");
    return true;
  }

  isHarvestable(tx: number, ty: number): boolean {
    const state = this.getTile(tx, ty);
    if (!state.crop) return false;
    const def = CROPS[state.crop.cropId];
    const harvestStage = def.growthDaysPerStage.length;
    return state.crop.stage >= harvestStage;
  }

  harvest(tx: number, ty: number): boolean {
    if (this.hasBlockingObject(tx, ty)) return false;
    const state = this.getTile(tx, ty);
    if (!state.crop) return false;
    const def = CROPS[state.crop.cropId];
    const harvestStage = def.growthDaysPerStage.length;
    if (state.crop.stage < harvestStage) return false;
    this.addItem(def.produceItemId as ItemId, Math.max(1, def.harvestQty ?? 1));
    if (def.regrowDays && def.regrowDays > 0) {
      state.crop.stage = Math.max(0, harvestStage - 1);
      state.crop.daysInStage = 0;
      state.crop.harvestsDone = (state.crop.harvestsDone ?? 0) + 1;
    } else {
      state.crop = null;
    }
    this.setTile(tx, ty, state);
    this.spend("harvest");
    return true;
  }

  chop(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || (obj.id !== "wood" && obj.id !== "tree")) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.chop)) return false;
    obj.hp -= 1;
    if (obj.hp <= 0) {
      this.objects.delete(key);
      if (obj.id === "wood") {
        this.addItem("wood", WOOD_NODE_DROP);
      } else if (obj.id === "tree") {
        const wood = TREE_WOOD_BY_STAGE[obj.stage];
        if (wood > 0) this.addItem("wood", wood);
        // Small deterministic chance: every 2nd day yields one acorn from chopping mature trees.
        if (obj.stage >= 2 && this.day % 2 === 0) this.addItem("acorn", 1);
      }
    }
    this.spend("chop");
    return true;
  }

  mine(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "stone") return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.mine)) return false;
    obj.hp -= 1;
    if (obj.hp <= 0) {
      this.objects.delete(key);
      this.addItem("stone", STONE_NODE_DROP);
    }
    this.spend("mine");
    return true;
  }

  scythe(tx: number, ty: number): boolean {
    const key = tileKey(tx, ty);
    const obj = this.objects.get(key);
    if (!obj || obj.id !== "weed") return false;
    obj.hp -= 1;
    if (obj.hp <= 0) {
      this.objects.delete(key);
      this.addItem("fiber", WEED_NODE_DROP);
    }
    this.spend("scythe");
    return true;
  }

  sleepNextDay(): { shipped: { goldGained: number; itemsSold: number } } {
    this.updateMachines();
    const shipped = this.sellShippingBin();
    // Grow crops if watered.
    for (const { tx, ty, state } of this.getAllTiles()) {
      if (!state.crop) continue;
      if (!state.watered) continue;
      const def = CROPS[state.crop.cropId];
      const harvestStage = def.growthDaysPerStage.length;
      if (state.crop.stage >= harvestStage) continue;

      state.crop.daysInStage += 1;
      const isRegrowStage = Boolean(def.regrowDays) && (state.crop.harvestsDone ?? 0) > 0 && state.crop.stage === harvestStage - 1;
      const needed = isRegrowStage ? (def.regrowDays ?? 1) : (def.growthDaysPerStage[state.crop.stage] ?? 1);
      if (state.crop.daysInStage >= needed) {
        state.crop.stage += 1;
        state.crop.daysInStage = 0;
      }
      this.setTile(tx, ty, state);
    }

    // Reset watering.
    for (const { tx, ty, state } of this.getAllTiles()) {
      if (!state.tilled) continue;
      if (!state.watered) continue;
      state.watered = false;
      this.setTile(tx, ty, state);
    }

    this.day += 1;
    this.minutes = DAY_START_MINUTES;
    this.energy = ENERGY_MAX;
    this.updateMachines();
    this.growTreesNextDay();
    this.quest = this.generateQuestForDay(this.day);

    // Season change can kill out-of-season crops.
    {
      const { season } = calendarFromDay(this.day);
      for (const { tx, ty, state } of this.getAllTiles()) {
        if (!state.crop) continue;
        const def = CROPS[state.crop.cropId];
        if (!def.seasons.includes(season)) {
          state.crop = null;
          this.setTile(tx, ty, state);
        }
      }
    }

    // Rain waters tilled soil.
    if (weatherForDay(this.day) === "rain") {
      for (const { tx, ty, state } of this.getAllTiles()) {
        if (!state.tilled) continue;
        if (state.watered) continue;
        state.watered = true;
        this.setTile(tx, ty, state);
      }
    }

    this.applySprinklers();

    return { shipped };
  }

  getCalendar(): { season: string; dayOfSeason: number; year: number; weather: string } {
    const cal = calendarFromDay(this.day);
    const weather = weatherForDay(this.day);
    return { ...cal, weather };
  }

  private applySprinklers(): void {
    const tryWater = (tx: number, ty: number) => {
      if (this.hasBlockingObject(tx, ty)) return;
      const state = this.getTile(tx, ty);
      if (!state.tilled || state.watered) return;
      state.watered = true;
      this.setTile(tx, ty, state);
    };

    for (const [k, obj] of this.objects.entries()) {
      if (obj.id !== "sprinkler" && obj.id !== "quality_sprinkler") continue;
      const [txStr, tyStr] = k.split(",");
      const tx = Number(txStr);
      const ty = Number(tyStr);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

      const offsets =
        obj.id === "sprinkler"
          ? [
              { dx: 1, dy: 0 },
              { dx: -1, dy: 0 },
              { dx: 0, dy: 1 },
              { dx: 0, dy: -1 }
            ]
          : [
              { dx: 1, dy: 0 },
              { dx: -1, dy: 0 },
              { dx: 0, dy: 1 },
              { dx: 0, dy: -1 },
              { dx: 1, dy: 1 },
              { dx: 1, dy: -1 },
              { dx: -1, dy: 1 },
              { dx: -1, dy: -1 }
            ];

      for (const o of offsets) tryWater(tx + o.dx, ty + o.dy);
    }
  }
}

export const GAME_CONSTANTS = {
  DAY_START_MINUTES,
  DAY_END_MINUTES,
  ENERGY_MAX
} as const;
