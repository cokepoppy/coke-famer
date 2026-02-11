import type { ItemId } from "./items";

export type Recipe = {
  output: ItemId;
  qty: number;
  ingredients: Partial<Record<ItemId, number>>;
};

export const RECIPES: Recipe[] = [
  { output: "chest", qty: 1, ingredients: { wood: 10 } },
  { output: "fence", qty: 1, ingredients: { wood: 2 } },
  { output: "path", qty: 1, ingredients: { stone: 2 } }
];

