"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Eye, ReceiptText, TrendingDown } from "lucide-react";

interface CreditManagerProps {
  customers: any[];
  lang?: "en" | "ne";
  api?: (url: string, opts?: any) => Promise<any>;
  onRefresh?: () => Promise<void> | void;
  onOpenCustomer?: (id: number) => void;
}

const labels = {
  en: {
    title: "Customer Credit Collection",
    subtitle: "Search, review, and collect product + transport credit in one place.",
    dueAmount: "Due Amount",
    totalDue: "Total Due",
    customersWithDue: "Customers With Due",
    highestDue: "Highest Due",
    totalSpent: "Total Spent",
    rewardPoints: "Reward Points",
    noDue: "All customers have no pending credit",
    recordPayment: "Record Payment",
    payFull: "Pay Full",
    save: "Save Payment",
    cancel: "Cancel",
    amount: "Amount",
    notes: "Note / receipt reference",
    method: "Method",
    details: "Details",
    paymentRecorded: "Payment saved and customer balance updated.",
    paymentFailed: "Could not record the payment.",
  },
  ne: {
    title: "ग्राहक उधारो असुली",
    subtitle: "सामान र ट्रान्सपोर्ट उधारो एउटै ठाउँबाट हेर्नुहोस् र भुक्तानी राख्नुहोस्।",
    dueAmount: "बाँकी रकम",
    totalDue: "कुल बाँकी",
    customersWithDue: "उधारो ग्राहक",
    highestDue: "सबैभन्दा धेरै बाँकी",
    totalSpent: "कुल खर्च",
    rewardPoints: "पुरस्कार अंक",
    noDue: "कुनै ग्राहकको उधारो बाँकी छैन",
    recordPayment: "भुक्तानी राख्नुहोस्",
    payFull: "पूरा तिर्नुहोस्",
    save: "भुक्तानी सेभ",
    cancel: "रद्द",
    amount: "रकम",
    notes: "नोट / रसिद विवरण",
    method: "तरिका",
    details: "विवरण",
    paymentRecorded: "भुक्तानी सेभ भयो र ग्राहक हिसाब अपडेट भयो।",
    paymentFailed: "भुक्तानी राख्न सकिएन।",
  },
};

export function CreditManager({
  customers,
  lang = "en",
  api,
  onRefresh,
  onOpenCustomer,
}: CreditManagerProps) {
  const dict = labels[lang];
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    referenceNote: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const customersWithDue = customers
    .filter((customer: any) => Number(customer.creditBalance || 0) > 0)
    .sort((a: any, b: any) => Number(b.creditBalance || 0) - Number(a.creditBalance || 0));

  const money = (value: number) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(value);

  const resetPaymentForm = () => {
    setSelectedCustomer(null);
    setPaymentForm({ amount: "", paymentMethod: "cash", referenceNote: "" });
  };

  const handleRecordPayment = async (customerId: number) => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || !api) return;

    setBusy(true);
    setMessage(null);
    try {
      await api("/admin/payments", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          amount,
          paymentMethod: paymentForm.paymentMethod,
          referenceNote: paymentForm.referenceNote || "Customer credit repayment",
        }),
      });

      resetPaymentForm();
      await onRefresh?.();
      setMessage({ type: "success", text: dict.paymentRecorded });
      window.setTimeout(() => setMessage(null), 3500);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : dict.paymentFailed,
      });
    } finally {
      setBusy(false);
    }
  };

  const totalDue = customersWithDue.reduce((sum, customer) => sum + Number(customer.creditBalance || 0), 0);
  const highestDue = customersWithDue.length ? Number(customersWithDue[0].creditBalance || 0) : 0;

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
              <TrendingDown className="h-6 w-6 text-rose-600" />
              {dict.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{dict.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-700">{dict.customersWithDue}</p>
          <p className="mt-1 text-3xl font-bold text-orange-950">{customersWithDue.length}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-700">{dict.totalDue}</p>
          <p className="mt-1 text-3xl font-bold text-rose-950">{money(totalDue)}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">{dict.highestDue}</p>
          <p className="mt-1 text-3xl font-bold text-blue-950">{money(highestDue)}</p>
        </div>
      </div>

      <AnimatePresence>
        {message ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-2xl border p-4 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {customersWithDue.length > 0 ? (
        <div className="space-y-3">
          {customersWithDue.map((customer: any) => {
            const due = Number(customer.creditBalance || 0);
            const isSelected = selectedCustomer === customer.id;

            return (
              <article key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-950">{customer.name}</h4>
                    <p className="text-sm text-slate-600">{customer.phone || customer.customerCode || "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        {dict.totalSpent}: {money(Number(customer.totalSpent || 0))}
                      </span>
                      <span className="rounded-full bg-purple-100 px-3 py-1 font-semibold text-purple-700">
                        {dict.rewardPoints}: {Number(customer.rewardPoints || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">{dict.dueAmount}</p>
                    <p className="text-2xl font-extrabold text-rose-700">{money(due)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(isSelected ? null : customer.id);
                      setPaymentForm((current) => ({
                        ...current,
                        amount: isSelected ? "" : current.amount,
                      }));
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                  >
                    <ReceiptText className="h-4 w-4" />
                    {dict.recordPayment}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCustomer?.(customer.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                  >
                    <Eye className="h-4 w-4" />
                    {dict.details}
                  </button>
                </div>

                <AnimatePresence>
                  {isSelected ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 overflow-hidden border-t border-slate-200 pt-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_150px]">
                        <input
                          type="number"
                          min="0"
                          value={paymentForm.amount}
                          onChange={(event) =>
                            setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                          }
                          placeholder={dict.amount}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentForm((current) => ({
                              ...current,
                              amount: String(due),
                            }))
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          {dict.payFull}
                        </button>
                        <select
                          value={paymentForm.paymentMethod}
                          onChange={(event) =>
                            setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          aria-label={dict.method}
                        >
                          {["cash", "esewa", "khalti", "bank"].map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy || Number(paymentForm.amount) <= 0}
                          onClick={() => handleRecordPayment(customer.id)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "..." : dict.save}
                        </button>
                        <textarea
                          value={paymentForm.referenceNote}
                          onChange={(event) =>
                            setPaymentForm((current) => ({ ...current, referenceNote: event.target.value }))
                          }
                          placeholder={dict.notes}
                          className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
                        />
                        <button
                          type="button"
                          onClick={resetPaymentForm}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 md:col-span-2"
                        >
                          {dict.cancel}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="font-semibold text-emerald-700">{dict.noDue}</p>
        </div>
      )}
    </section>
  );
}
