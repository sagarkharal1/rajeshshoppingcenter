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
]);

export function getQuantityStep(unit?: string) {
  const normalized = String(unit ?? "").trim().toLowerCase();
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
