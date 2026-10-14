// The vessels a brew can be poured into, and how much each un-preheated
// one cools the water. The order is the order of the buttons on the page;
// settings remember a vessel by its index here.

export const VESSELS = [
  { name: "None", offsetC: 0 },
  { name: "Ceramic teapot", offsetC: 8 },
  { name: "Ceramic mug", offsetC: 5 },
  { name: "Glass teapot", offsetC: 4 },
  { name: "Glass mug", offsetC: 3 },
  { name: "Thermos", offsetC: 3 },
  { name: "Plastic", offsetC: 2 },
];

export function vesselByIndex(index) {
  if (!Number.isInteger(index)) return VESSELS[0];
  const clamped = Math.max(0, Math.min(VESSELS.length - 1, index));
  return VESSELS[clamped];
}
