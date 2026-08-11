"use client";

import { useEffect, useState } from "react";
import { X, Printer, Pencil, LoaderCircle } from "lucide-react";
import { salePriceInfo } from "@/lib/sale-price";

/**
 * One product, whole.
 *
 * Picking a product from the search bar used to drop the shopkeeper on the
 * product list with the name typed into a filter box — the answer was there
 * somewhere, spread across three screens. This is the page that says what it
 * costs, what it earns, what is left, and who has been buying it.
 */

type ProductProfileModalProps = {
  productId: number | null;
  onClose: () => void;
  api: (url: string, opts?: any) => Promise<any>;
  lang?: "en" | "ne";
  onEdit?: (productId: number) => void;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );

export function ProductProfileModal({ productId, onClose, api, lang = "en", onEdit }: ProductProfileModalProps) {
  const ne = lang === "ne";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api(`/admin/products/${productId}/profile`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : ne ? "खोल्न सकिएन।" : "Could not open this product.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, api, ne]);

  if (!productId) return null;

  const product = data?.product;
  const totals = data?.totals;
  const sale = product ? salePriceInfo(product) : null;
  const lowStock = product && Number(product.stockQuantity) <= Number(product.reorderLevel || 0);

  const expiry = product?.expiryDate ? new Date(product.expiryDate) : null;
  const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {product?.categoryName || (ne ? "सामान" : "Product")}
            </p>
            <h3 className="truncate text-2xl font-bold text-slate-950">
              {product?.name || (ne ? "लोड हुँदै..." : "Loading...")}
            </h3>
            {product?.sku ? <p className="mt-0.5 text-sm text-slate-500">{product.sku}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {product && onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(product.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {ne ? "सम्पादन" : "Edit"}
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label={ne ? "बन्द" : "Close"} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="p-8 text-center text-sm font-semibold text-rose-700">{error}</p>
        ) : product ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [ne ? "बेच्ने मूल्य" : "Selling price", sale?.onSale ? money(sale.price) : money(product.price), sale?.onSale ? "text-rose-700" : "text-slate-950"],
                [ne ? "लागत" : "Cost", money(product.unitCost), "text-slate-950"],
                [ne ? "प्रति एकाइ नाफा" : "Profit per unit", money(product.marginPerUnit), product.marginPerUnit > 0 ? "text-emerald-700" : "text-rose-700"],
                [ne ? "अहिले स्टक" : "In stock", `${product.stockQuantity} ${product.unit || ""}`, lowStock ? "text-amber-700" : "text-slate-950"],
              ].map(([label, value, cls]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className={`mt-1.5 text-xl font-extrabold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* The things worth knowing without being asked. */}
            <div className="flex flex-wrap gap-2">
              {sale?.onSale ? (
                <span className="rounded-full bg-rose-100 px-3 py-1.5 text-sm font-bold text-rose-800">
                  🏷️ {ne ? "छुटमा" : "On offer"} −{sale.savingPercent}% ({money(sale.normalPrice)} → {money(sale.price)})
                </span>
              ) : null}
              {lowStock ? (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-900">
                  ⚠️ {ne ? `स्टक कम — ${product.reorderLevel} मा चेतावनी` : `Low stock — warns below ${product.reorderLevel}`}
                </span>
              ) : null}
              {daysToExpiry !== null ? (
                <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${daysToExpiry < 0 ? "bg-rose-100 text-rose-800" : daysToExpiry <= 30 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                  {daysToExpiry < 0
                    ? (ne ? `म्याद ${Math.abs(daysToExpiry)} दिन अघि सकियो` : `Expired ${Math.abs(daysToExpiry)} days ago`)
                    : (ne ? `म्याद ${daysToExpiry} दिनमा सकिन्छ` : `Expires in ${daysToExpiry} days`)}
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                {ne ? "स्टकको लागत" : "Stock at cost"}: {money(product.stockValueAtCost)}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-bold text-slate-900">{ne ? "यसले कति कमायो" : "What this has earned"}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {[
                  [ne ? "बिक्री भएको" : "Sold", `${totals.soldQuantity} ${product.unit || ""}`, "text-slate-950"],
                  [ne ? "आम्दानी" : "Revenue", money(totals.revenue), "text-slate-950"],
                  [ne ? "लागत" : "Cost of sales", money(totals.costOfSales), "text-slate-600"],
                  [ne ? "नाफा" : "Profit", money(totals.profit), totals.profit >= 0 ? "text-emerald-700" : "text-rose-700"],
                ].map(([label, value, cls]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-lg font-bold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {ne
                  ? "रद्द गरिएका बिल गनिँदैनन्। लागत बिक्री भएकै दिनको हो।"
                  : "Voided bills are excluded. Cost is what it was on the day it sold."}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900">{ne ? "कसले किन्यो" : "Who bought it"}</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {(data.sales || []).length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">{ne ? "अहिलेसम्म बिक्री भएको छैन।" : "No sales yet."}</p>
                  ) : (
                    data.sales.map((sale: any, index: number) => (
                      <div key={`${sale.invoiceId}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{sale.customerName || (ne ? "ग्राहक" : "Customer")}</p>
                          <p className="text-xs text-slate-500">
                            {sale.invoiceNumber} · {new Date(sale.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-slate-900">{money(sale.lineTotal)}</p>
                          <p className="text-xs text-slate-500">{sale.quantity} {sale.unit}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900">{ne ? "स्टकको आउजाउ" : "Stock in and out"}</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {(data.movements || []).length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">{ne ? "कुनै रेकर्ड छैन।" : "Nothing recorded yet."}</p>
                  ) : (
                    data.movements.map((move: any) => (
                      <div key={move.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate text-slate-700">{move.reason || move.transactionType}</p>
                          <p className="text-xs text-slate-500">{new Date(move.date).toLocaleDateString()}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`font-bold ${Number(move.change) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {Number(move.change) >= 0 ? "+" : ""}{move.change}
                          </p>
                          <p className="text-xs text-slate-500">→ {move.balanceAfter}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {product.sku ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Printer className="h-4 w-4" />
                {ne
                  ? `बारकोड ${product.sku} — स्टिकर छाप्न सामान ट्याबको "स्टिकर छाप्नुहोस्" प्रयोग गर्नुहोस्।`
                  : `Barcode ${product.sku} — print a sticker from "Print labels" on the Products tab.`}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
