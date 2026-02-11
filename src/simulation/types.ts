import type { CropId } from "../content/crops";
import type { ItemId } from "../content/items";

export type ToolId = "hoe" | "watering_can" | "axe" | "pickaxe" | "hand";
export type ActionId = ToolId | ItemId;

export type TileKey = `${number},${number}`;

export type CropState = {
  cropId: CropId;
  stage: number; // 0..maxStage (maxStage means harvestable)
  daysInStage: number;
};

export type TileState = {
  tilled: boolean;
  watered: boolean;
  crop: CropState | null;
};

export type InventorySlot = {
  itemId: ItemId;
  qty: number;
};

export type PlacedObjectId = "chest" | "shipping_bin" | "wood" | "stone" | "fence" | "path" | "preserves_jar";

export type ChestState = {
  id: "chest";
  slots: Array<InventorySlot | null>;
};

export type ShippingBinState = {
  id: "shipping_bin";
  slots: Array<InventorySlot | null>;
};

export type ResourceState = {
  id: "wood" | "stone";
  hp: number;
};

export type SimplePlacedState = {
  id: "fence" | "path";
};

export type PreservesJarState = {
  id: "preserves_jar";
  input: ItemId | null;
  output: ItemId | null;
  completeAtAbsMinutes: number | null;
};

export type PlacedObjectState = ChestState | ShippingBinState | ResourceState | SimplePlacedState | PreservesJarState;

export type GameSaveV0 = {
  version: 0;
  day: number;
  inventory: InventorySlot[];
  tiles: Array<{ tx: number; ty: number; state: TileState }>;
};

export type GameSaveV1 = {
  version: 1;
  day: number;
  minutes: number; // minutes since 00:00 within the day (e.g. 6:00 => 360)
  energy: number;
  inventory: InventorySlot[];
  tiles: Array<{ tx: number; ty: number; state: TileState }>;
};

export type GameSaveV2 = {
  version: 2;
  day: number;
  minutes: number;
  energy: number;
  gold: number;
  inventorySlots: Array<InventorySlot | null>;
  tiles: Array<{ tx: number; ty: number; state: TileState }>;
};

export type GameSaveV3 = {
  version: 3;
  day: number;
  minutes: number;
  energy: number;
  gold: number;
  inventorySlots: Array<InventorySlot | null>;
  tiles: Array<{ tx: number; ty: number; state: TileState }>;
};

export type GameSaveV4 = {
  version: 4;
  day: number;
  minutes: number;
  energy: number;
  gold: number;
  inventorySlots: Array<InventorySlot | null>;
  tiles: Array<{ tx: number; ty: number; state: TileState }>;
  objects: Array<{ tx: number; ty: number; obj: PlacedObjectState }>;
};
