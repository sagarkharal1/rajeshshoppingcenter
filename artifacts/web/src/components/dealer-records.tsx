"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, PackagePlus, RefreshCw, RotateCcw, Search, ShieldAlert, Truck } from "lucide-react";
import { LoadError } from "@/components/load-error";
import { openProofDocument } from "@/lib/print-slips";

type Product = {
  id: number;
  name: string;
};

type DealerEntry = {
  id: string;
  entryId?: number;
  entryType?: "purchase" | "payment";
  transactionType: string;
  date: string;
  billNumber?: string | null;
  billAmount: number;
  paidAmount: number;
  dealerDue: number;
  note?: string | null;
  /** Photo of the bill the supplier handed over. */
  proofPath?: string | null;
  canVoid?: boolean;
  // Only on older records, which were tied to a product.
  productName?: string | null;
  quantity?: number;
  reason?: string | null;
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
  /** A dealer picked from the top search bar: filter to them and open them. */
  focusDealer?: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value || 0);

const field = "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm";

export function DealerRecords({ products, api, onRefresh, lang = "en", focusDealer }: DealerRecordsProps) {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [totals, setTotals] = useState({ dealerCount: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  const ne = lang === "ne";

  // A bill from a supplier is a debt, nothing more. What arrived and what it
  // cost per item is entered against each product, where prices differ every
  // delivery — repeating it here would be the same work twice, done worse.
  const [billForm, setBillForm] = useState({
    dealerName: "",
    dealerPhone: "",
    billNumber: "",
    billAmount: "",
    paidAmount: "",
    proofPath: "",
    note: "",
  });

  const [payForm, setPayForm] = useState({
    dealerName: "",
    dealerPhone: "",
    amount: "",
    billNumber: "",
    note: "",
    proofPath: "",
  });

  // Returns and damage really are stock leaving the shop, so unlike a bill
  // these do name a product and do move the stock count.
  const [returnForm, setReturnForm] = useState({
    dealerName: "",
    dealerPhone: "",
    productId: 0,
    quantity: "",
    kind: "return" as "return" | "damaged",
    reason: "",
    proofPath: "",
  });

  const readProofImage = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read proof image"));
      reader.readAsDataURL(file);
    });

  const load = async () => {
    const data = await api("/admin/dealers");
    setDealers(data.dealers || []);
    setTotals(data.totals || { dealerCount: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 });
    setLoadFailed(false);
  };

  const reload = () => {
    load().catch(() => setLoadFailed(true));
  };

  useEffect(() => {
    reload();
  }, []);

  // Arriving from the search bar should land on that dealer already open,
  // rather than on a list to scroll through again.
  useEffect(() => {
    if (!focusDealer) return;
    setQuery(focusDealer);
    const match = dealers.find((dealer) => dealer.name === focusDealer);
    if (match) setExpanded(`${match.name}|${match.phone}`);
  }, [focusDealer, dealers]);

  const filteredDealers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return dealers;
    return dealers.filter((dealer) =>
      [dealer.name, dealer.phone, ...dealer.entries.map((entry) => entry.billNumber)]
        .some((value) => String(value || "").toLowerCase().includes(search))
    );
  }, [dealers, query]);

  /**
   * Picking a dealer already on file rather than retyping the name. Two
   * spellings of the same supplier used to become two suppliers, each holding
   * half the balance — which is exactly the sum nobody notices is wrong.
   */
  const DealerPicker = ({
    value,
    onPick,
  }: {
    value: string;
    onPick: (name: string, phone: string) => void;
  }) => (
    <select
      className={field}
      value={dealers.some((dealer) => dealer.name === value) ? value : ""}
      onChange={(event) => {
        const dealer = dealers.find((entry) => entry.name === event.target.value);
        onPick(dealer?.name || "", dealer?.phone || "");
      }}
    >
      <option value="">{ne ? "सूचीबाट डिलर छान्नुहोस्" : "Pick a dealer from the list"}</option>
      {dealers.map((dealer) => (
        <option key={`${dealer.name}|${dealer.phone}`} value={dealer.name}>
          {dealer.name}
          {dealer.totalDue > 0 ? ` — ${ne ? "बाँकी" : "due"} ${money(dealer.totalDue)}` : ""}
        </option>
      ))}
    </select>
  );

  const PhotoPicker = ({
    label,
    value,
    onPick,
  }: {
    label: string;
    value: string;
    onPick: (dataUrl: string) => void;
  }) => (
    <>
      <label className="block rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
        {label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-2 block w-full text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onPick(await readProofImage(file));
            event.target.value = "";
          }}
        />
      </label>
      {value ? (
        <img src={value} alt="" className="max-h-48 w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain p-2" />
      ) : null}
    </>
  );

  const submit = async (run: () => Promise<any>, done: string) => {
    setBusy(true);
    setMessage("");
    try {
      await run();
      await load();
      await onRefresh?.();
      setMessage(done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ne ? "सेभ गर्न सकिएन।" : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  const saveBill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!billForm.dealerName.trim() || !Number(billForm.billAmount)) {
      setMessage(ne ? "डिलरको नाम र बिलको कुल रकम चाहिन्छ।" : "The dealer's name and the bill total are required.");
      return;
    }
    if (Number(billForm.paidAmount || 0) > Number(billForm.billAmount)) {
      setMessage(ne ? "तिरेको रकम बिलभन्दा बढी हुन सक्दैन।" : "Paid cannot be more than the bill total.");
      return;
    }
    submit(
      () =>
        api("/admin/dealer-entries", {
          method: "POST",
          body: JSON.stringify({
            entryType: "purchase",
            dealerName: billForm.dealerName.trim(),
            dealerPhone: billForm.dealerPhone.trim() || undefined,
            billNumber: billForm.billNumber.trim() || undefined,
            billAmount: Number(billForm.billAmount),
            paidAmount: Number(billForm.paidAmount || 0),
            proofPath: billForm.proofPath || undefined,
            note: billForm.note.trim() || undefined,
          }),
        }),
      ne ? "डिलरको बिल सेभ भयो।" : "Dealer bill saved.",
    ).then(() =>
      setBillForm({ dealerName: "", dealerPhone: "", billNumber: "", billAmount: "", paidAmount: "", proofPath: "", note: "" }),
    );
  };

  const savePayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!payForm.dealerName.trim() || !Number(payForm.amount)) {
      setMessage(ne ? "डिलर र रकम दुबै चाहिन्छ।" : "Pick a dealer and enter the amount.");
      return;
    }
    submit(
      () =>
        api("/admin/dealer-entries", {
          method: "POST",
          body: JSON.stringify({
            entryType: "payment",
            dealerName: payForm.dealerName.trim(),
            dealerPhone: payForm.dealerPhone.trim() || undefined,
            billNumber: payForm.billNumber.trim() || undefined,
            paidAmount: Number(payForm.amount),
            proofPath: payForm.proofPath || undefined,
            note: payForm.note.trim() || undefined,
          }),
        }),
      ne ? "भुक्तानी सेभ भयो।" : "Payment saved.",
    ).then(() => setPayForm({ dealerName: "", dealerPhone: "", amount: "", billNumber: "", note: "", proofPath: "" }));
  };

  const saveReturn = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(returnForm.quantity);
    if (!returnForm.dealerName.trim() || !returnForm.productId || !quantity) {
      setMessage(ne ? "डिलर, सामान र परिमाण तीनवटै चाहिन्छ।" : "Dealer, product and quantity are all required.");
      return;
    }
    const isDamage = returnForm.kind === "damaged";
    const reason =
      returnForm.reason.trim() ||
      (isDamage ? (ne ? "बिग्रिएको सामान" : "Damaged goods") : ne ? "डिलरलाई फिर्ता" : "Returned to dealer");
    submit(
      () =>
        // Stock genuinely leaves the shop here, so this stays on the stock
        // ledger and the count comes down with it.
        api(`/admin/products/${returnForm.productId}/adjust-stock`, {
          method: "PUT",
          body: JSON.stringify({
            quantity: -Math.abs(quantity),
            reason,
            transactionType: isDamage ? "damaged" : "return",
            dealerName: returnForm.dealerName.trim(),
            dealerPhone: returnForm.dealerPhone.trim(),
            billAmount: 0,
            paidAmount: 0,
            proofPath: returnForm.proofPath || undefined,
            returnStatus: isDamage ? "" : reason,
            damagedReason: isDamage ? reason : "",
          }),
        }),
      isDamage ? (ne ? "ड्यामेज रेकर्ड भयो।" : "Damage recorded.") : ne ? "फिर्ता रेकर्ड भयो।" : "Return recorded.",
    ).then(() =>
      setReturnForm({ dealerName: "", dealerPhone: "", productId: 0, quantity: "", kind: "return", reason: "", proofPath: "" }),
    );
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [ne ? "डिलर" : "Dealers", String(totals.dealerCount), "text-slate-950"],
          [ne ? "कुल बिल" : "Total billed", money(totals.totalBilled), "text-slate-950"],
          [ne ? "तिरेको" : "Paid", money(totals.totalPaid), "text-emerald-700"],
          [ne ? "तिर्न बाँकी" : "We owe", money(totals.totalDue), "text-rose-700"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {message ? (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{message}</p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── 1. A bill arrived ── */}
        <form onSubmit={saveBill} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <PackagePlus className="h-5 w-5 text-blue-700" />
            {ne ? "डिलरको बिल राख्नुहोस्" : "Record a dealer bill"}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {ne
              ? "बिलमा जे लेखिएको छ त्यति मात्र — सामानको विवरण सामान थप्ने ठाउँमा राख्नुहोस्।"
              : "Just what the bill says. Product details go in Add product, where you enter each cost."}
          </p>
          <div className="mt-4 grid gap-3">
            {dealers.length > 0 ? (
              <DealerPicker
                value={billForm.dealerName}
                onPick={(name, phone) => setBillForm((current) => ({ ...current, dealerName: name, dealerPhone: phone }))}
              />
            ) : null}
            <input
              className={field}
              value={billForm.dealerName}
              onChange={(event) => setBillForm((current) => ({ ...current, dealerName: event.target.value }))}
              placeholder={ne ? "डिलरको नाम" : "Dealer name"}
            />
            <input
              className={field}
              value={billForm.dealerPhone}
              onChange={(event) => setBillForm((current) => ({ ...current, dealerPhone: event.target.value }))}
              placeholder={ne ? "सम्पर्क नम्बर" : "Contact number"}
            />
            <input
              className={field}
              value={billForm.billNumber}
              onChange={(event) => setBillForm((current) => ({ ...current, billNumber: event.target.value }))}
              placeholder={ne ? "बिल / इनभ्वाइस / रसिद नम्बर" : "Bill / invoice / receipt number"}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={field}
                type="number"
                min={0}
                value={billForm.billAmount}
                onChange={(event) => setBillForm((current) => ({ ...current, billAmount: event.target.value }))}
                placeholder={ne ? "बिलको कुल रकम" : "Bill total"}
              />
              <input
                className={field}
                type="number"
                min={0}
                value={billForm.paidAmount}
                onChange={(event) => setBillForm((current) => ({ ...current, paidAmount: event.target.value }))}
                placeholder={ne ? "अहिले तिरेको" : "Paid now"}
              />
            </div>
            {Number(billForm.billAmount) > 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
                {ne ? "बाँकी रहन्छ" : "Will be owed"}:{" "}
                <span className="text-rose-700">
                  {money(Math.max(0, Number(billForm.billAmount) - Number(billForm.paidAmount || 0)))}
                </span>
              </p>
            ) : null}
            <PhotoPicker
              label={ne ? "बिलको फोटो" : "Photo of the bill"}
              value={billForm.proofPath}
              onPick={(dataUrl) => setBillForm((current) => ({ ...current, proofPath: dataUrl }))}
            />
            <input
              className={field}
              value={billForm.note}
              onChange={(event) => setBillForm((current) => ({ ...current, note: event.target.value }))}
              placeholder={ne ? "टिप्पणी (वैकल्पिक)" : "Note (optional)"}
            />
            <button disabled={busy} className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {ne ? "बिल सेभ गर्नुहोस्" : "Save bill"}
            </button>
          </div>
        </form>

        {/* ── 2. Money handed over ── */}
        <form onSubmit={savePayment} className="rounded-[1.5rem] border border-emerald-200 bg-white p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <CreditCard className="h-5 w-5 text-emerald-700" />
            {ne ? "डिलरलाई भुक्तानी" : "Pay a dealer"}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {ne ? "सूचीबाट डिलर छान्नुहोस् — हिसाब आफैं मिल्छ।" : "Pick the dealer from the list so the balance lines up."}
          </p>
          <div className="mt-4 grid gap-3">
            <DealerPicker
              value={payForm.dealerName}
              onPick={(name, phone) => setPayForm((current) => ({ ...current, dealerName: name, dealerPhone: phone }))}
            />
            <input
              className={field}
              value={payForm.dealerName}
              onChange={(event) => setPayForm((current) => ({ ...current, dealerName: event.target.value }))}
              placeholder={ne ? "वा नयाँ डिलरको नाम" : "Or type a new dealer name"}
            />
            <input
              className={field}
              type="number"
              min={0}
              value={payForm.amount}
              onChange={(event) => setPayForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder={ne ? "कति तिर्नुभयो" : "How much was paid"}
            />
            <input
              className={field}
              value={payForm.billNumber}
              onChange={(event) => setPayForm((current) => ({ ...current, billNumber: event.target.value }))}
              placeholder={ne ? "कुन बिलको हो (वैकल्पिक)" : "Against which bill (optional)"}
            />
            <PhotoPicker
              label={ne ? "रसिद / भौचरको फोटो" : "Photo of the receipt or voucher"}
              value={payForm.proofPath}
              onPick={(dataUrl) => setPayForm((current) => ({ ...current, proofPath: dataUrl }))}
            />
            <input
              className={field}
              value={payForm.note}
              onChange={(event) => setPayForm((current) => ({ ...current, note: event.target.value }))}
              placeholder={ne ? "टिप्पणी (वैकल्पिक)" : "Note (optional)"}
            />
            <button disabled={busy} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {ne ? "भुक्तानी सेभ गर्नुहोस्" : "Save payment"}
            </button>
          </div>
        </form>
      </div>

      {/* ── 3. Goods going back ── */}
      <form onSubmit={saveReturn} className="rounded-[1.5rem] border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
        <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
          <RotateCcw className="h-5 w-5 text-amber-700" />
          {ne ? "फिर्ता वा बिग्रिएको सामान" : "Return or damaged goods"}
        </h4>
        <p className="mt-1 text-sm text-slate-600">
          {ne
            ? "यहाँ सामान छान्नुपर्छ — किनभने सामान पसलबाट घट्छ।"
            : "This one does need the product, because the stock count comes down with it."}
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <DealerPicker
            value={returnForm.dealerName}
            onPick={(name, phone) => setReturnForm((current) => ({ ...current, dealerName: name, dealerPhone: phone }))}
          />
          <select
            className={field}
            value={returnForm.productId}
            onChange={(event) => setReturnForm((current) => ({ ...current, productId: Number(event.target.value) }))}
          >
            <option value={0}>{ne ? "सामान छान्नुहोस्" : "Select the product"}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setReturnForm((current) => ({ ...current, kind: "return" }))}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                returnForm.kind === "return" ? "border-amber-500 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {ne ? "फिर्ता" : "Returned"}
            </button>
            <button
              type="button"
              onClick={() => setReturnForm((current) => ({ ...current, kind: "damaged" }))}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                returnForm.kind === "damaged" ? "border-rose-400 bg-rose-100 text-rose-900" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {ne ? "बिग्रिएको" : "Damaged"}
            </button>
          </div>
          <input
            className={field}
            type="number"
            min={1}
            value={returnForm.quantity}
            onChange={(event) => setReturnForm((current) => ({ ...current, quantity: event.target.value }))}
            placeholder={ne ? "कति परिमाण" : "How many"}
          />
          <input
            className={`${field} lg:col-span-2`}
            value={returnForm.reason}
            onChange={(event) => setReturnForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder={ne ? "कारण (वैकल्पिक)" : "Reason (optional)"}
          />
          <div className="grid gap-3 lg:col-span-2">
            <PhotoPicker
              label={ne ? "फोटो (वैकल्पिक)" : "Photo (optional)"}
              value={returnForm.proofPath}
              onPick={(dataUrl) => setReturnForm((current) => ({ ...current, proofPath: dataUrl }))}
            />
          </div>
          <button disabled={busy} className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 lg:col-span-2">
            {returnForm.kind === "damaged"
              ? ne ? "ड्यामेज सेभ गर्नुहोस्" : "Save damage"
              : ne ? "फिर्ता सेभ गर्नुहोस्" : "Save return"}
          </button>
        </div>
      </form>

      {/* ── The dealers themselves ── */}
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <Truck className="h-5 w-5 text-slate-700" />
            {ne ? "डिलरहरू" : "Dealers"}
          </h4>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="rounded-2xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={ne ? "डिलर खोज्नुहोस्" : "Search dealer"}
              />
            </div>
            <button type="button" onClick={reload} className="rounded-2xl border border-slate-200 p-2.5 text-slate-600">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredDealers.map((dealer) => {
            const key = `${dealer.name}|${dealer.phone}`;
            const isOpen = expanded === key;
            return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-950">{dealer.name}</p>
                    <p className="text-sm text-slate-500">
                      {dealer.phone || (ne ? "फोन छैन" : "no phone")} · {dealer.entries.length}{" "}
                      {ne ? "रेकर्ड" : dealer.entries.length === 1 ? "record" : "records"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{ne ? "तिर्न बाँकी" : "We owe"}</p>
                    <p className={`text-2xl font-extrabold ${dealer.totalDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {money(dealer.totalDue)}
                    </p>
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-4 space-y-2">
                    {dealer.entries.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950">
                              {entry.entryType === "payment"
                                ? ne ? "भुक्तानी" : "Payment"
                                : entry.billNumber
                                  ? `${ne ? "बिल" : "Bill"} ${entry.billNumber}`
                                  : ne ? "बिल" : "Bill"}
                              {entry.productName ? ` • ${entry.productName}` : ""}
                            </p>
                            {entry.note || entry.reason ? (
                              <p className="text-slate-600">{entry.note || entry.reason}</p>
                            ) : null}
                            <p className="text-xs text-slate-500">{new Date(entry.date).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            {entry.entryType === "payment" ? (
                              <p className="font-bold text-emerald-700">− {money(entry.paidAmount)}</p>
                            ) : (
                              <>
                                <p>
                                  {ne ? "बिल" : "Billed"}: <b>{money(entry.billAmount)}</b>
                                </p>
                                {entry.paidAmount > 0 ? (
                                  <p className="text-emerald-700">
                                    {ne ? "तिरेको" : "Paid"}: <b>{money(entry.paidAmount)}</b>
                                  </p>
                                ) : null}
                                {entry.dealerDue > 0 ? (
                                  <p className="text-rose-700">
                                    {ne ? "बाँकी" : "Due"}: <b>{money(entry.dealerDue)}</b>
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                        {entry.returnStatus ? (
                          <p className="mt-2 flex items-center gap-2 text-amber-700">
                            <RotateCcw className="h-4 w-4" />
                            {entry.returnStatus}
                          </p>
                        ) : null}
                        {entry.damagedReason ? (
                          <p className="mt-2 flex items-center gap-2 text-rose-700">
                            <ShieldAlert className="h-4 w-4" />
                            {entry.damagedReason}
                          </p>
                        ) : null}
                        {entry.proofPath ? (
                          <button
                            type="button"
                            onClick={() =>
                              openProofDocument(
                                entry.proofPath as string,
                                `${dealer.name}${entry.billNumber ? ` • ${ne ? "बिल" : "Bill"} ${entry.billNumber}` : ""}`,
                                lang,
                                `${new Date(entry.date).toLocaleDateString()} · ${money(entry.billAmount || entry.paidAmount)}`,
                              )
                            }
                            className="mt-3 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100"
                          >
                            <img src={entry.proofPath} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-cover" />
                            <span className="text-xs font-bold text-slate-800">
                              {ne ? "डिलरले दिएको कागज हेर्नुहोस्" : "View the dealer's paper"}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          {loadFailed ? (
            <LoadError lang={lang as "en" | "ne"} onRetry={reload} />
          ) : filteredDealers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {ne ? "अहिलेसम्म कुनै डिलर रेकर्ड छैन।" : "No dealer records yet."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
