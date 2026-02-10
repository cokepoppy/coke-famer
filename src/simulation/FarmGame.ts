import { CROPS, type CropId } from "../content/crops";
import { ITEMS, type ItemId } from "../content/items";
import type {
  GameSaveV0,
  GameSaveV1,
  GameSaveV2,
  InventorySlot,
  TileKey,
  TileState
} from "./types";

const SAVE_KEY = "coke-famer-save";
const CURRENT_SAVE_VERSION = 2 as const;

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 26 * 60; // 2:00 next day (allow wrap handling in UI)
const ENERGY_MAX = 270;
const INVENTORY_SIZE = 24;

const ACTION_MINUTES = {
  hoe: 10,
  water: 10,
  plant: 10,
  harvest: 5
} as const;

const ACTION_ENERGY = {
  hoe: 2,
  water: 2,
  plant: 2,
  harvest: 0
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
  inventorySlots: Array<InventorySlot | null> = Array.from({ length: INVENTORY_SIZE }, () => null);
  private tiles = new Map<TileKey, TileState>();

  static newGame(): FarmGame {
    const g = new FarmGame();
    g.day = 1;
    g.minutes = DAY_START_MINUTES;
    g.energy = ENERGY_MAX;
    g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
    g.addItem("parsnip_seed", 15);
    return g;
  }

  static loadFromStorage(): FarmGame | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameSaveV0 | GameSaveV1 | GameSaveV2;
    if (!parsed) return null;

    const g = new FarmGame();
    if (parsed.version === 0) {
      g.day = parsed.day;
      g.minutes = DAY_START_MINUTES;
      g.energy = ENERGY_MAX;
      g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
      for (const it of parsed.inventory ?? []) g.addItem(it.itemId, it.qty);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      // Migrate-on-load
      g.saveToStorage();
      return g;
    }
    if (parsed.version === 1) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.inventorySlots = Array.from({ length: INVENTORY_SIZE }, () => null);
      for (const it of parsed.inventory ?? []) g.addItem(it.itemId, it.qty);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      // Migrate-on-load to V2
      g.saveToStorage();
      return g;
    }
    if (parsed.version === 2) {
      g.day = parsed.day;
      g.minutes = parsed.minutes ?? DAY_START_MINUTES;
      g.energy = parsed.energy ?? ENERGY_MAX;
      g.inventorySlots = (parsed.inventorySlots ?? []).slice(0, INVENTORY_SIZE);
      while (g.inventorySlots.length < INVENTORY_SIZE) g.inventorySlots.push(null);
      for (const t of parsed.tiles ?? []) g.tiles.set(tileKey(t.tx, t.ty), t.state);
      return g;
    }
    return null;
  }

  saveToStorage(): void {
    const tiles: GameSaveV0["tiles"] = [];
    for (const [k, state] of this.tiles.entries()) {
      const [txStr, tyStr] = k.split(",");
      tiles.push({ tx: Number(txStr), ty: Number(tyStr), state });
    }
    const save: GameSaveV2 = {
      version: CURRENT_SAVE_VERSION,
      day: this.day,
      minutes: this.minutes,
      energy: this.energy,
      inventorySlots: this.inventorySlots,
      tiles
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  resetToNewGame(): void {
    const fresh = FarmGame.newGame();
    this.day = fresh.day;
    this.minutes = fresh.minutes;
    this.energy = fresh.energy;
    this.inventorySlots = fresh.inventorySlots;
    this.tiles = new Map();
    this.saveToStorage();
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

  inventoryPickup(index: number): InventorySlot | null {
    if (index < 0 || index >= this.inventorySlots.length) return null;
    const slot = this.inventorySlots[index];
    if (!slot) return null;
    this.inventorySlots[index] = null;
    return { itemId: slot.itemId, qty: slot.qty };
  }

  inventorySplitHalf(index: number): InventorySlot | null {
    if (index < 0 || index >= this.inventorySlots.length) return null;
    const slot = this.inventorySlots[index];
    if (!slot) return null;
    if (slot.qty <= 1) {
      this.inventorySlots[index] = null;
      return { itemId: slot.itemId, qty: slot.qty };
    }
    const take = Math.ceil(slot.qty / 2);
    slot.qty -= take;
    return { itemId: slot.itemId, qty: take };
  }

  inventoryPlace(index: number, stack: InventorySlot): InventorySlot | null {
    if (index < 0 || index >= this.inventorySlots.length) return stack;
    if (!stack || stack.qty <= 0) return null;
    const max = ITEMS[stack.itemId].maxStack;
    const current = this.inventorySlots[index];

    if (!current) {
      const put = Math.min(max, stack.qty);
      this.inventorySlots[index] = { itemId: stack.itemId, qty: put };
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

    // Swap (cursor should already be within maxStack).
    this.inventorySlots[index] = { itemId: stack.itemId, qty: Math.min(max, stack.qty) };
    return { itemId: current.itemId, qty: current.qty };
  }

  inventoryPlaceOne(index: number, stack: InventorySlot): { ok: boolean; remaining: InventorySlot | null } {
    if (index < 0 || index >= this.inventorySlots.length) return { ok: false, remaining: stack };
    if (!stack || stack.qty <= 0) return { ok: false, remaining: null };

    const max = ITEMS[stack.itemId].maxStack;
    const current = this.inventorySlots[index];

    if (!current) {
      this.inventorySlots[index] = { itemId: stack.itemId, qty: 1 };
      const remQty = stack.qty - 1;
      return { ok: true, remaining: remQty > 0 ? { itemId: stack.itemId, qty: remQty } : null };
    }

    if (current.itemId !== stack.itemId) return { ok: false, remaining: stack };
    if (current.qty >= max) return { ok: false, remaining: stack };
    current.qty += 1;
    const remQty = stack.qty - 1;
    return { ok: true, remaining: remQty > 0 ? { itemId: stack.itemId, qty: remQty } : null };
  }

  private canSpendEnergy(cost: number): boolean {
    return this.energy >= cost;
  }

  private spend(action: keyof typeof ACTION_MINUTES): void {
    this.minutes += ACTION_MINUTES[action];
    this.energy = Math.max(0, this.energy - ACTION_ENERGY[action]);
  }

  hoe(tx: number, ty: number): boolean {
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
    const state = this.getTile(tx, ty);
    if (!state.tilled) return false;
    if (state.crop) return false;
    if (!this.canSpendEnergy(ACTION_ENERGY.plant)) return false;
    if (!this.consumeItem(def.seedItemId as ItemId, 1)) return false;
    state.crop = { cropId, stage: 0, daysInStage: 0 };
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
    const state = this.getTile(tx, ty);
    if (!state.crop) return false;
    const def = CROPS[state.crop.cropId];
    const harvestStage = def.growthDaysPerStage.length;
    if (state.crop.stage < harvestStage) return false;
    this.addItem(def.produceItemId as ItemId, 1);
    state.crop = null;
    this.setTile(tx, ty, state);
    this.spend("harvest");
    return true;
  }

  sleepNextDay(): void {
    // Grow crops if watered.
    for (const { tx, ty, state } of this.getAllTiles()) {
      if (!state.crop) continue;
      if (!state.watered) continue;
      const def = CROPS[state.crop.cropId];
      const harvestStage = def.growthDaysPerStage.length;
      if (state.crop.stage >= harvestStage) continue;

      state.crop.daysInStage += 1;
      const needed = def.growthDaysPerStage[state.crop.stage] ?? 1;
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
    this.saveToStorage();
  }
}

export const GAME_CONSTANTS = {
  DAY_START_MINUTES,
  DAY_END_MINUTES,
  ENERGY_MAX
} as const;
