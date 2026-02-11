export type ItemId =
  | "parsnip_seed"
  | "parsnip"
  | "potato_seed"
  | "potato"
  | "blueberry_seed"
  | "blueberry"
  | "cranberry_seed"
  | "cranberry"
  | "wood"
  | "stone"
  | "fence"
  | "path"
  | "chest";

export type ItemDef = {
  id: ItemId;
  name: string;
  maxStack: number;
  buyPrice: number | null;
  sellPrice: number;
};

export const ITEMS: Record<ItemId, ItemDef> = {
  parsnip_seed: { id: "parsnip_seed", name: "Parsnip Seeds", maxStack: 999, buyPrice: 20, sellPrice: 10 },
  parsnip: { id: "parsnip", name: "Parsnip", maxStack: 999, buyPrice: null, sellPrice: 35 },
  potato_seed: { id: "potato_seed", name: "Potato Seeds", maxStack: 999, buyPrice: 50, sellPrice: 25 },
  potato: { id: "potato", name: "Potato", maxStack: 999, buyPrice: null, sellPrice: 80 },
  blueberry_seed: { id: "blueberry_seed", name: "Blueberry Seeds", maxStack: 999, buyPrice: 80, sellPrice: 40 },
  blueberry: { id: "blueberry", name: "Blueberry", maxStack: 999, buyPrice: null, sellPrice: 50 },
  cranberry_seed: { id: "cranberry_seed", name: "Cranberry Seeds", maxStack: 999, buyPrice: 100, sellPrice: 50 },
  cranberry: { id: "cranberry", name: "Cranberry", maxStack: 999, buyPrice: null, sellPrice: 75 },
  wood: { id: "wood", name: "Wood", maxStack: 999, buyPrice: null, sellPrice: 2 },
  stone: { id: "stone", name: "Stone", maxStack: 999, buyPrice: null, sellPrice: 2 },
  fence: { id: "fence", name: "Fence", maxStack: 999, buyPrice: null, sellPrice: 1 },
  path: { id: "path", name: "Path", maxStack: 999, buyPrice: null, sellPrice: 1 },
  chest: { id: "chest", name: "Chest", maxStack: 999, buyPrice: 200, sellPrice: 50 }
};
