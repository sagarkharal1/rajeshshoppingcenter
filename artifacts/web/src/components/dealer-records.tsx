"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, PackagePlus, RefreshCw, RotateCcw, Search, ShieldAlert, Truck } from "lucide-react";

type Product = {
  id: number;
  name: string;
};

type DealerEntry = {
  id: number;
  productId: number;
  productName: string;
  transactionType: string;
  quantity: number;
  reason?: string | null;
  date: string;
  billNumber?: string | null;
  billAmount: number;
  paidAmount: number;
  dealerDue: number;
  returnStatus?: string | null;
  damagedReason?: string | null;
};

type Dealer = {
  name: string;
  phone?: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  purchaseCount: number;
  returnCount: number;
  damagedCount: number;
  lastActivity: string;
  entries: DealerEntry[];
};

type DealerRecordsProps = {
  products: Product[];
  api: (url: string, opts?: any) => Promise<any>;
  onRefresh?: () => Promise<void> | void;
  lang?: "en" | "ne";
};

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value || 0);

export function DealerRecords({ products, api, onRefresh, lang = "en" }: DealerRecordsProps) {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [totals, setTotals] = useState({ dealerCount: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [purchaseForm, setPurchaseForm] = useState({
    productId: products[0]?.id || 0,
    dealerName: "",
    dealerPhone: "",
    billNumber: "",
    quantity: "",
    billAmount: "",
    paidAmount: "",
    reason: "Product purchase from dealer",
    returnStatus: "",
    damagedReason: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    productId: products[0]?.id || 0,
    dealerName: "",
    dealerPhone: "",
    amount: "",
    note: "Dealer payment",
  });

  const load = async () => {
    const data = await api("/admin/dealers");
    setDealers(data.dealers || []);
    setTotals(data.totals || { dealerCount: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 });
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    if (!purchaseForm.productId && products[0]?.id) {
      setPurchaseForm((current) => ({ ...current, productId: products[0].id }));
      setPaymentForm((current) => ({ ...current, productId: products[0].id }));
    }
  }, [products, purchaseForm.productId]);

  const filteredDealers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return dealers;
    return dealers.filter((dealer) =>
      [dealer.name, dealer.phone, ...dealer.entries.map((entry) => entry.productName)]
        .some((value) => String(value || "").toLowerCase().includes(search))
    );
  }, [dealers, query]);

  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!purchaseForm.productId || !purchaseForm.dealerName || !Number(purchaseForm.quantity)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/admin/products/${purchaseForm.productId}/adjust-stock`, {
        method: "PUT",
        body: JSON.stringify({
          quantity: Number(purchaseForm.quantity),
          reason: purchaseForm.reason || "Product purchase from dealer",
          transactionType: purchaseForm.damagedReason ? "damaged" : purchaseForm.returnStatus ? "return" : "purchase",
          dealerName: purchaseForm.dealerName,
          dealerPhone: purchaseForm.dealerPhone,
          billNumber: purchaseForm.billNumber,
          billAmount: Number(purchaseForm.billAmount || 0),
          paidAmount: Number(purchaseForm.paidAmount || 0),
          returnStatus: purchaseForm.returnStatus,
          damagedReason: purchaseForm.damagedReason,
        }),
      });
      setPurchaseForm((current) => ({
        ...current,
        billNumber: "",
        quantity: "",
        billAmount: "",
        paidAmount: "",
        reason: "Product purchase from dealer",
        returnStatus: "",
        damagedReason: "",
      }));
      await load();
      await onRefresh?.();
      setMessage("Dealer purchase saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save dealer purchase.");
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentForm.productId || !paymentForm.dealerName || !Number(paymentForm.amount)) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/admin/dealer-payments", {
        method: "POST",
        body: JSON.stringify({
          productId: paymentForm.productId,
          dealerName: paymentForm.dealerName,
          dealerPhone: paymentForm.dealerPhone,
          amount: Number(paymentForm.amount),
          note: paymentForm.note,
        }),
      });
      setPaymentForm((current) => ({ ...current, amount: "", note: "Dealer payment" }));
      await load();
      setMessage("Dealer payment saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save dealer payment.");
    } finally {
      setBusy(false);
    }
  };

  const selectDealerForPayment = (dealer: Dealer) => {
    setPaymentForm((current) => ({
      ...current,
      dealerName: dealer.name,
      dealerPhone: dealer.phone || "",
      productId: dealer.entries[0]?.productId || current.productId,
      amount: dealer.totalDue ? String(dealer.totalDue) : current.amount,
    }));
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold text-slate-950">
              {lang === "ne" ? "डिलर / साहु हिसाब" : "Dealer / Creditor Records"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {lang === "ne" ? "कसबाट सामान आयो, कति तिर्न बाँकी छ, फिर्ता/ड्यामेज सबै।" : "Track supplier purchases, payments, due amounts, returns, and damaged goods."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Dealers", totals.dealerCount, "text-slate-950"],
          ["Bought", money(totals.totalBilled), "text-slate-950"],
          ["Paid", money(totals.totalPaid), "text-emerald-700"],
          ["We Owe", money(totals.totalDue), "text-rose-700"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {message ? <p className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <form onSubmit={savePurchase} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <PackagePlus className="h-5 w-5 text-blue-700" />
            Add Dealer Purchase / Return / Damage
          </h4>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={purchaseForm.productId} onChange={(event) => setPurchaseForm((current) => ({ ...current, productId: Number(event.target.value) }))}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={purchaseForm.dealerName} onChange={(event) => setPurchaseForm((current) => ({ ...current, dealerName: event.target.value }))} placeholder="Dealer name" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={purchaseForm.dealerPhone} onChange={(event) => setPurchaseForm((current) => ({ ...current, dealerPhone: event.target.value }))} placeholder="Dealer phone" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={purchaseForm.billNumber} onChange={(event) => setPurchaseForm((current) => ({ ...current, billNumber: event.target.value }))} placeholder="Bill number" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="number" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity (+ purchase, - return/damage)" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="number" value={purchaseForm.billAmount} onChange={(event) => setPurchaseForm((current) => ({ ...current, billAmount: event.target.value }))} placeholder="Bill amount" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="number" value={purchaseForm.paidAmount} onChange={(event) => setPurchaseForm((current) => ({ ...current, paidAmount: event.target.value }))} placeholder="Paid now" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={purchaseForm.returnStatus} onChange={(event) => setPurchaseForm((current) => ({ ...current, returnStatus: event.target.value }))} placeholder="Return status, if any" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" value={purchaseForm.damagedReason} onChange={(event) => setPurchaseForm((current) => ({ ...current, damagedReason: event.target.value }))} placeholder="Damaged reason, if any" />
            <textarea className="min-h-20 rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" value={purchaseForm.reason} onChange={(event) => setPurchaseForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Note" />
            <button disabled={busy} className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 md:col-span-2">
              Save Dealer Record
            </button>
          </div>
        </form>

        <form onSubmit={savePayment} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <CreditCard className="h-5 w-5 text-emerald-700" />
            Pay Dealer
          </h4>
          <div className="mt-4 grid gap-3">
            <select className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={paymentForm.productId} onChange={(event) => setPaymentForm((current) => ({ ...current, productId: Number(event.target.value) }))}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={paymentForm.dealerName} onChange={(event) => setPaymentForm((current) => ({ ...current, dealerName: event.target.value }))} placeholder="Dealer name" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={paymentForm.dealerPhone} onChange={(event) => setPaymentForm((current) => ({ ...current, dealerPhone: event.target.value }))} placeholder="Dealer phone" />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Payment amount" />
            <textarea className="min-h-20 rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Payment note" />
            <button disabled={busy} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              Save Payment
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm"
            placeholder="Search dealer, phone, or product"
          />
        </div>
        <div className="mt-4 space-y-3">
          {filteredDealers.map((dealer) => {
            const key = `${dealer.name}|${dealer.phone || ""}`;
            const isOpen = expanded === key;
            return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-950">{dealer.name}</h4>
                    <p className="text-sm text-slate-600">{dealer.phone || "No phone saved"}</p>
                    <p className="mt-1 text-xs text-slate-500">Last activity: {new Date(dealer.lastActivity).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-600">We owe</p>
                    <p className="text-2xl font-extrabold text-rose-700">{money(dealer.totalDue)}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <span className="rounded-xl bg-white px-3 py-2 text-sm">Bought: <b>{money(dealer.totalBilled)}</b></span>
                  <span className="rounded-xl bg-white px-3 py-2 text-sm">Paid: <b className="text-emerald-700">{money(dealer.totalPaid)}</b></span>
                  <span className="rounded-xl bg-white px-3 py-2 text-sm">Returns: <b>{dealer.returnCount}</b></span>
                  <span className="rounded-xl bg-white px-3 py-2 text-sm">Damaged: <b>{dealer.damagedCount}</b></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : key)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    {isOpen ? "Hide Records" : "View Records"}
                  </button>
                  <button type="button" onClick={() => selectDealerForPayment(dealer)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                    Pay / Fill Form
                  </button>
                </div>
                {isOpen ? (
                  <div className="mt-4 space-y-2">
                    {dealer.entries.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-950">{entry.productName} • {entry.transactionType}</p>
                            <p className="text-slate-600">{entry.reason || "-"}</p>
                            <p className="text-xs text-slate-500">{new Date(entry.date).toLocaleString()} {entry.billNumber ? `• Bill ${entry.billNumber}` : ""}</p>
                          </div>
                          <div className="text-right">
                            <p>Billed: <b>{money(entry.billAmount)}</b></p>
                            <p>Paid: <b className="text-emerald-700">{money(entry.paidAmount)}</b></p>
                            {entry.dealerDue > 0 ? <p>Due: <b className="text-rose-700">{money(entry.dealerDue)}</b></p> : null}
                          </div>
                        </div>
                        {entry.returnStatus ? <p className="mt-2 flex items-center gap-2 text-amber-700"><RotateCcw className="h-4 w-4" />{entry.returnStatus}</p> : null}
                        {entry.damagedReason ? <p className="mt-2 flex items-center gap-2 text-rose-700"><ShieldAlert className="h-4 w-4" />{entry.damagedReason}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          {filteredDealers.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No dealer records yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
