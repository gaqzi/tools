// The catalogue a first visit starts from.

import { emptyStores } from "./stores.js";

const SEED_LIQUIDS = [
  ["Gin", 40],
  ["Vodka", 40],
  ["Whisky", 40],
  ["Campari", 25],
  ["Sweet vermouth", 15],
  ["Dry vermouth", 18],
  ["Lager", 5],
  ["Light white wine", 11],
  ["White wine", 12.5],
  ["Red wine", 13.5],
  ["Full-bodied red", 14.5],
  ["Sparkling wine", 12],
  ["Port", 20],
  ["Soda water", 0],
  ["Lime juice", 0],
];

export function seedStores() {
  return {
    ...emptyStores(),
    liquids: SEED_LIQUIDS.map(([name, alcoholPercent]) => ({ name, alcoholPercent })),
  };
}
