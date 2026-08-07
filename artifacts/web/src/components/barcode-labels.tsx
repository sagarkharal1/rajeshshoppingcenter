"use client";

import { useMemo, useState } from "react";
import { Printer, X } from "lucide-react";

type LabelProduct = {
  id: number;
  name: string;
  sku?: string | null;
  price?: unknown;
  unit?: string | null;
};

type BarcodeLabelsProps = {
  open: boolean;
  onClose: () => void;
  products: LabelProduct[];
  lang?: "en" | "ne";
  shopName?: string;
  /** Give a code to older products that have none, then refresh the list. */
  onAssignCodes?: () => Promise<void> | void;
  assigning?: boolean;
};

/**
 * Printable stick-on barcode labels.
 *
 * Most of this shop's stock — rice by the sack, vegetables, hardware by weight
 * — has no manufacturer barcode. Printing our own turns those into scannable
 * items, which is what makes the scanner useful for more than packaged goods.
 *
 * The barcode encodes the product's SKU, which is exactly what the scanner
 * writes into the billing search, so a printed label scans straight back to
 * the right product.
 */
export function BarcodeLabels({ open, onClose, products, lang = "en", shopName, onAssignCodes, assigning }: BarcodeLabelsProps) {
  const ne = lang === "ne";
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const withCode = useMemo(
    () => products.filter((p) => String(p.sku || "").trim().length > 0),
    [products],
  );
  const withoutCode = useMemo(
    () => products.filter((p) => !String(p.sku || "").trim()),
    [products],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withCode;
    return withCode.filter((p) =>
      [p.name, p.sku].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [withCode, search]);

  const totalLabels = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);

  const printLabels = async () => {
    const chosen = withCode
      .map((p) => ({ product: p, count: Number(counts[p.id] || 0) }))
      .filter((entry) => entry.count > 0);
    if (chosen.length === 0) return;

    setBusy(true);
    setError("");
    try {
      // Loaded on demand — printing labels is occasional, and customers
      // browsing the shop should never download this.
      const { default: JsBarcode } = await import("jsbarcode");

      const cells: string[] = [];
      for (const { product, count } of chosen) {
        // CODE128 handles letters and digits, so the shop's own codes work as
        // they are — no need to invent 13-digit numbers.
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, String(product.sku), {
          format: "CODE128",
          width: 1.6,
          height: 42,
          displayValue: true,
          fontSize: 12,
          margin: 2,
        });
        const markup = new XMLSerializer().serializeToString(svg);
        const price = Number(product.price ?? 0);

        for (let i = 0; i < count; i++) {
          cells.push(`
            <div class="label">
              <div class="name">${escapeHtml(product.name)}</div>
              <div class="bars">${markup}</div>
              <div class="price">NPR ${price.toLocaleString()}${product.unit ? ` / ${escapeHtml(String(product.unit))}` : ""}</div>
            </div>`);
        }
      }

      const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(shopName || "Barcode labels")}</title>
<style>
  @page { size: A4; margin: 8mm; }
  body { font-family: "Nirmala UI","Noto Sans Devanagari","Segoe UI",system-ui,sans-serif; margin: 0; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .label {
    border: 1px dashed #cbd5e1;      /* a cutting guide, faint on paper */
    border-radius: 4px;
    padding: 4px 6px 5px;
    text-align: center;
    break-inside: avoid;
  }
  .name { font-size: 8.5pt; font-weight: 700; line-height: 1.15;
          overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; min-height: 2.3em; }
  .bars svg { width: 100%; height: auto; }
  .price { font-size: 9pt; font-weight: 800; margin-top: 1px; }
  button { margin: 10px 0 14px; padding: 10px 16px; font-size: 15px;
           background: #1e3a5f; color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
  @media print { button { display: none; } }
</style></head><body>
<button onclick="window.print()">🖨️ ${ne ? "प्रिन्ट गर्नुहोस्" : "Print labels"}</button>
<div class="sheet">${cells.join("")}</div>
</body></html>`;

      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) {
        setError(ne
          ? "पप-अप रोकिएको छ। ब्राउजरमा पप-अप खोल्न दिनुहोस्।"
          : "The pop-up was blocked. Allow pop-ups for this site and try again.");
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : (ne ? "लेबल बनाउन सकिएन।" : "Could not build the labels."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {ne ? "बारकोड स्टिकर छाप्नुहोस्" : "Print barcode labels"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {ne
                ? "आफ्नै सामानमा टाँस्न बारकोड बनाउनुहोस्। टाँसेपछि स्क्यान गरेर बिलमा हाल्न सकिन्छ।"
                : "Make barcodes to stick on your own goods. Once stuck on, they scan straight into a bill."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={ne ? "बन्द" : "Close"} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {withoutCode.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-900">
              {ne
                ? `${withoutCode.length} पुराना सामानमा कोड छैन। नयाँ सामानलाई आफैं कोड बन्छ।`
                : `${withoutCode.length} older product${withoutCode.length > 1 ? "s have" : " has"} no code. New products get one automatically.`}
            </p>
            <button
              type="button"
              onClick={onAssignCodes}
              disabled={assigning}
              className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {assigning
                ? (ne ? "बनाउँदै..." : "Assigning...")
                : (ne ? "सबैलाई कोड दिनुहोस्" : "Give them codes")}
            </button>
          </div>
        ) : null}

        <input
          className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ne ? "सामान खोज्नुहोस्" : "Search products"}
        />

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              {ne ? "कोड भएको सामान भेटिएन।" : "No products with a code found."}
            </p>
          ) : (
            visible.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  {[10, 20, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCounts((c) => ({ ...c, [p.id]: n }))}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={0}
                    value={counts[p.id] ?? ""}
                    onChange={(e) => setCounts((c) => ({ ...c, [p.id]: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">
            {ne ? `जम्मा ${totalLabels} स्टिकर` : `${totalLabels} label${totalLabels === 1 ? "" : "s"} selected`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCounts({})} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              {ne ? "खाली गर्नुहोस्" : "Clear"}
            </button>
            <button
              type="button"
              onClick={printLabels}
              disabled={busy || totalLabels === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              {busy ? (ne ? "बनाउँदै..." : "Building...") : (ne ? "स्टिकर बनाउनुहोस्" : "Make labels")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
