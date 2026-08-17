const DECIMAL_UNITS = new Set([
  "kg",
  "kgs",
  "kilogram",
  "kilograms",
  "liter",
  "litre",
  "liters",
  "litres",
  "ltr",
  "l",
  // The unit is free text and the shop works in Nepali, so half a kilo is just
  // as often written केजी as kg. Without these, a product added in Nepali could
  // only be sold in whole numbers.
  "केजी",
  "किलो",
  "किलोग्राम",
  "लिटर",
  "लि",
]);

/**
 * The measure a product is sold by, without the pack size in front of it.
 *
 * "Sold by" is free text, and a shopkeeper thinking of a one-litre bottle of
 * oil naturally types "1 ltr". Every screen then renders quantity and unit
 * together, so buying one bottle reads "1 1 ltr" and the stock line reads
 * "23 1 ltr". The pack size belongs in the product name — "Dhara Oil 1L" —
 * and the unit is what a quantity is counted in.
 *
 * It also has to be clean for getQuantityStep to recognise it: "1 ltr" matches
 * nothing, so oil could not be sold in half litres either.
 */
export function normalizeUnit(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Devanagari digits as well as ASCII — "१ लिटर" is as likely as "1 ltr"
  // from someone typing in Nepali, and would otherwise pass straight through.
  const withoutCount = raw.replace(/^[\d०-९]+(?:[.,][\d०-९]+)?\s*/, "").trim();

  // A unit that is only a number is nonsense, but silently emptying the field
  // someone just typed into is worse. Leave it for them to see and correct.
  return withoutCount || raw;
}

export function getQuantityStep(unit?: string) {
  const normalized = normalizeUnit(unit).toLowerCase();
  return DECIMAL_UNITS.has(normalized) ? 0.25 : 1;
}

export function normalizeQuantity(value: unknown, unit?: string) {
  const step = getQuantityStep(unit);
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return step;
  }

  return Math.max(step, Math.round(numeric * 100) / 100);
}

export function formatQuantity(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "1";
  }

  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(2).replace(/\.?0+$/, "");
}
