export type ItemId = "parsnip_seed" | "parsnip";

export type ItemDef = {
  id: ItemId;
  name: string;
  maxStack: number;
};

export const ITEMS: Record<ItemId, ItemDef> = {
  parsnip_seed: { id: "parsnip_seed", name: "Parsnip Seeds", maxStack: 999 },
  parsnip: { id: "parsnip", name: "Parsnip", maxStack: 999 }
};

