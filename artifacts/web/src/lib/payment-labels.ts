/**
 * Human names for the payment method codes stored in the database.
 *
 * The raw values ("cash", "esewa", "credit") were being rendered straight into
 * dropdowns, which reads as untranslated jargon on an otherwise bilingual
 * screen — and "credit" in particular is easy to misread when it actually
 * means udharo.
 */
const LABELS: Record<string, { en: string; ne: string }> = {
  cash: { en: "Cash", ne: "नगद" },
  credit: { en: "Credit (udharo)", ne: "उधारो" },
  esewa: { en: "eSewa", ne: "इसेवा" },
  khalti: { en: "Khalti", ne: "खल्ती" },
  bank: { en: "Bank transfer", ne: "बैंक" },
};

export function paymentMethodLabel(method: string, lang: string): string {
  const entry = LABELS[String(method || "").toLowerCase()];
  if (!entry) return method;
  return lang === "ne" ? entry.ne : entry.en;
}
