import type { ItemId } from "./items";

export type NpcId = "townie";

export type GiftTaste = "loved" | "liked" | "neutral" | "disliked";

export type NpcDef = {
  id: NpcId;
  name: string;
  giftTastes?: Partial<Record<ItemId, GiftTaste>>;
};

export const NPCS: Record<NpcId, NpcDef> = {
  townie: {
    id: "townie",
    name: "Townie",
    giftTastes: {
      blueberry: "loved",
      parsnip: "liked",
      wood: "liked",
      fiber: "neutral",
      stone: "disliked"
    }
  }
};
