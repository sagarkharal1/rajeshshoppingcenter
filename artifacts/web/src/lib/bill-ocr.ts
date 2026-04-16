export type BillScanSuggestion = {
  amount?: string;
  invoiceNumber?: string;
  phone?: string;
  quantity?: string;
  buyingPrice?: string;
  transportCost?: string;
};

export type BillScanResult = {
  text: string;
  summary: string[];
  suggestion: BillScanSuggestion;
};

const moneyPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/g;
const invoicePattern = /\b(?:inv|invoice|bill|receipt|ref)[\s#:-]*([a-z0-9-]{3,})/i;
const phonePattern = /(?:\+?977[-\s]?)?(9\d{9})\b/;
const quantityPattern = /\b(?:qty|quantity|pieces|pcs|unit|units)[\s:.-]*(\d+(?:\.\d+)?)\b/i;
const transportPattern = /\b(?:transport|delivery|carriage|freight)[^\d]*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/i;

function normalizeSpaces(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function toPlainNumber(value: string) {
  return value.replace(/,/g, "").trim();
}

function pickLargestAmount(text: string) {
  const matches = text.match(moneyPattern) || [];
  const numbers = matches
    .map((entry) => ({ raw: entry, value: Number(toPlainNumber(entry)) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
  if (!numbers.length) return "";
  return numbers.sort((a, b) => b.value - a.value)[0].raw;
}

function buildSummary(suggestion: BillScanSuggestion) {
  const summary: string[] = [];
  if (suggestion.amount) summary.push(`Amount ${suggestion.amount}`);
  if (suggestion.invoiceNumber) summary.push(`Bill ${suggestion.invoiceNumber}`);
  if (suggestion.phone) summary.push(`Phone ${suggestion.phone}`);
  if (suggestion.quantity) summary.push(`Qty ${suggestion.quantity}`);
  if (suggestion.transportCost) summary.push(`Transport ${suggestion.transportCost}`);
  return summary;
}

function extractSuggestion(text: string): BillScanSuggestion {
  const invoiceMatch = text.match(invoicePattern);
  const phoneMatch = text.match(phonePattern);
  const quantityMatch = text.match(quantityPattern);
  const transportMatch = text.match(transportPattern);
  const amount = pickLargestAmount(text);

  return {
    amount: amount ? toPlainNumber(amount) : undefined,
    buyingPrice: amount ? toPlainNumber(amount) : undefined,
    invoiceNumber: invoiceMatch?.[1]?.trim(),
    phone: phoneMatch?.[1]?.trim(),
    quantity: quantityMatch?.[1]?.trim(),
    transportCost: transportMatch?.[1] ? toPlainNumber(transportMatch[1]) : undefined,
  };
}

export async function scanBillImage(imageUrl: string): Promise<BillScanResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(imageUrl);
    const text = normalizeSpaces(result.data.text || "");
    const suggestion = extractSuggestion(text);
    return {
      text,
      summary: buildSummary(suggestion),
      suggestion,
    };
  } finally {
    await worker.terminate();
  }
}
