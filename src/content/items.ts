export type ItemId =
  | "parsnip_seed"
  | "parsnip"
  | "potato_seed"
  | "potato"
  | "blueberry_seed"
  | "blueberry"
  | "cranberry_seed"
  | "cranberry"
  | "parsnip_jar"
  | "potato_jar"
  | "blueberry_jar"
  | "cranberry_jar"
  | "wood"
  | "stone"
  | "fiber"
  | "acorn"
  | "fence"
  | "path"
  | "sprinkler"
  | "quality_sprinkler"
  | "preserves_jar"
  | "chest";

export type ItemDef = {
  id: ItemId;
  name: string;
  maxStack: number;
  buyPrice: number | null;
  sellPrice: number;
  energyRestore?: number; // edible items only
};

export const ITEMS: Record<ItemId, ItemDef> = {
  parsnip_seed: { id: "parsnip_seed", name: "Parsnip Seeds", maxStack: 999, buyPrice: 20, sellPrice: 10 },
  parsnip: { id: "parsnip", name: "Parsnip", maxStack: 999, buyPrice: null, sellPrice: 35, energyRestore: 25 },
  potato_seed: { id: "potato_seed", name: "Potato Seeds", maxStack: 999, buyPrice: 50, sellPrice: 25 },
  potato: { id: "potato", name: "Potato", maxStack: 999, buyPrice: null, sellPrice: 80, energyRestore: 25 },
  blueberry_seed: { id: "blueberry_seed", name: "Blueberry Seeds", maxStack: 999, buyPrice: 80, sellPrice: 40 },
  blueberry: { id: "blueberry", name: "Blueberry", maxStack: 999, buyPrice: null, sellPrice: 50, energyRestore: 25 },
  cranberry_seed: { id: "cranberry_seed", name: "Cranberry Seeds", maxStack: 999, buyPrice: 100, sellPrice: 50 },
  cranberry: { id: "cranberry", name: "Cranberry", maxStack: 999, buyPrice: null, sellPrice: 75, energyRestore: 25 },
  parsnip_jar: { id: "parsnip_jar", name: "Pickled Parsnip", maxStack: 999, buyPrice: null, sellPrice: 80, energyRestore: 50 },
  potato_jar: { id: "potato_jar", name: "Pickled Potato", maxStack: 999, buyPrice: null, sellPrice: 120, energyRestore: 50 },
  blueberry_jar: { id: "blueberry_jar", name: "Blueberry Jam", maxStack: 999, buyPrice: null, sellPrice: 150, energyRestore: 50 },
  cranberry_jar: { id: "cranberry_jar", name: "Cranberry Jam", maxStack: 999, buyPrice: null, sellPrice: 180, energyRestore: 50 },
  wood: { id: "wood", name: "Wood", maxStack: 999, buyPrice: null, sellPrice: 2 },
  stone: { id: "stone", name: "Stone", maxStack: 999, buyPrice: null, sellPrice: 2 },
  fiber: { id: "fiber", name: "Fiber", maxStack: 999, buyPrice: null, sellPrice: 1 },
  acorn: { id: "acorn", name: "Acorn", maxStack: 999, buyPrice: 20, sellPrice: 5 },
  fence: { id: "fence", name: "Fence", maxStack: 999, buyPrice: null, sellPrice: 1 },
  path: { id: "path", name: "Path", maxStack: 999, buyPrice: null, sellPrice: 1 },
  sprinkler: { id: "sprinkler", name: "Sprinkler", maxStack: 999, buyPrice: null, sellPrice: 25 },
  quality_sprinkler: { id: "quality_sprinkler", name: "Quality Sprinkler", maxStack: 999, buyPrice: null, sellPrice: 60 },
  preserves_jar: { id: "preserves_jar", name: "Preserves Jar", maxStack: 999, buyPrice: null, sellPrice: 50 },
  chest: { id: "chest", name: "Chest", maxStack: 999, buyPrice: 200, sellPrice: 50 }
};
