export type ItemId = "parsnip_seed" | "parsnip";

export type ItemDef = {
  id: ItemId;
  name: string;
  maxStack: number;
  buyPrice: number | null;
  sellPrice: number;
};

export const ITEMS: Record<ItemId, ItemDef> = {
  parsnip_seed: { id: "parsnip_seed", name: "Parsnip Seeds", maxStack: 999, buyPrice: 20, sellPrice: 10 },
  parsnip: { id: "parsnip", name: "Parsnip", maxStack: 999, buyPrice: null, sellPrice: 35 }
};
