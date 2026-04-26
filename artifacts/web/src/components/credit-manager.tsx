"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, TrendingDown } from "lucide-react";

interface CustomerCredit {
  id: number;
  name: string;
  phone: string;
  creditBalance: number;
  rewardPoints: number;
  totalSpent: number;
}

interface CreditManagerProps {
  customers: any[];
  lang?: "en" | "ne";
  onRefresh?: () => void;
}

const labels = {
  en: {
    title: "Customer Credit Management",
    dueAmount: "Due Amount",
    customer: "Customer",
    phone: "Phone",
    totalSpent: "Total Spent",
    rewardPoints: "Reward Points",
    noDue: "All customers have no pending credit",
    sendReminder: "Send Reminder",
    recordPayment: "Record Payment",
    amount: "Amount",
    notes: "Notes",
    pay: "Pay",
    cancel: "Cancel",
    paymentRecorded: "Payment recorded successfully",
    reminderSent: "Reminder sent to customer",
  },
  ne: {
    title: "ग्राहक उधारो व्यवस्थापन",
    dueAmount: "बकाया रकम",
    customer: "ग्राहक",
    phone: "फोन",
    totalSpent: "कुल खर्च",
    rewardPoints: "पुरस्कार अंक",
    noDue: "सबै ग्राहकको कुनै बकाया उधारो छैन",
    sendReminder: "सूचना पठाउनुहोस्",
    recordPayment: "भुक्तानी दर्ता गर्नुहोस्",
    amount: "रकम",
    notes: "नोट",
    pay: "भुक्तानी गर्नुहोस्",
    cancel: "रद्द गर्नुहोस्",
    paymentRecorded: "भुक्तानी दर्ता भयो",
    reminderSent: "ग्राहकलाई सूचना पठाइयो",
  },
};

export function CreditManager({ customers, lang = "en", onRefresh }: CreditManagerProps) {
  const dict = labels[lang];
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", notes: "" });
  const [message, setMessage] = useState("");

  // Filter customers with due amount
  const customersWithDue = customers
    .filter((c: any) => Number(c.creditBalance || 0) > 0)
    .sort((a: any, b: any) => Number(b.creditBalance) - Number(a.creditBalance));

  const money = (value: number) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(value);

  const handleRecordPayment = async (customerId: number) => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) return;

    try {
      const token = localStorage.getItem("owner_token");
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId,
          amount,
          paymentMethod: "cash",
          referenceNote: paymentForm.notes || undefined,
        }),
      });

      if (!res.ok) throw new Error("Payment failed");

      setMessage(dict.paymentRecorded);
      setPaymentForm({ amount: "", notes: "" });
      setSelectedCustomer(null);
      setTimeout(() => setMessage(""), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to record payment:", err);
      setMessage(lang === "ne" ? "भुक्तानी दर्ता गर्न सकिएन।" : "Failed to record payment.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-950 flex items-center gap-2 mb-2">
          <TrendingDown className="h-6 w-6" />
          {dict.title}
        </h3>
        <p className="text-sm text-slate-600">
          {lang === "ne"
            ? "बकाया उधारो भएका ग्राहकहरूलाई व्यवस्थापन गर्नुहोस्"
            : "Manage customers with pending credit balance"}
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
          <p className="text-sm font-semibold text-orange-700 mb-1">
            {lang === "ne" ? "बकाया ग्राहकहरू" : "Customers with Due"}
          </p>
          <p className="text-3xl font-bold text-orange-900">
            {customersWithDue.length}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {dict.dueAmount}
          </p>
          <p className="text-3xl font-bold text-red-900">
            {money(
              customersWithDue.reduce(
                (sum, c) => sum + Number(c.creditBalance || 0),
                0
              )
            )}
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-semibold text-blue-700 mb-1">
            {lang === "ne" ? "सर्वोच्च बकाया" : "Highest Due"}
          </p>
          <p className="text-3xl font-bold text-blue-900">
            {customersWithDue.length > 0
              ? money(Number(customersWithDue[0].creditBalance || 0))
              : money(0)}
          </p>
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl bg-green-50 border border-green-200 p-4"
          >
            <p className="text-green-700 font-semibold">✅ {message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer List */}
      {customersWithDue.length > 0 ? (
        <div className="space-y-3">
          {customersWithDue.map((customer: any) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">{customer.name}</p>
                  <p className="text-sm text-slate-600">{customer.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    {money(Number(customer.creditBalance || 0))}
                  </p>
                  <p className="text-xs text-slate-500">
                    {dict.dueAmount}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-xs text-slate-600">{dict.totalSpent}</p>
                  <p className="font-semibold text-slate-900">
                    {money(Number(customer.totalSpent || 0))}
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-xs text-slate-600">{dict.rewardPoints}</p>
                  <p className="font-semibold text-slate-900">
                    {customer.rewardPoints || 0}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCustomer(
                    selectedCustomer === customer.id ? null : customer.id
                  )}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  {lang === "ne" ? "भुक्तानी दर्ता" : "Record Payment"}
                </button>
              </div>

              {/* Payment Form */}
              <AnimatePresence>
                {selectedCustomer === customer.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 border-t border-slate-200 pt-3 space-y-2"
                  >
                    <input
                      type="number"
                      min="0"
                      placeholder={dict.amount}
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <textarea
                      placeholder={dict.notes}
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRecordPayment(customer.id)}
                        disabled={!paymentForm.amount}
                        className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {dict.pay}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setPaymentForm({ amount: "", notes: "" });
                        }}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {dict.cancel}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
          <p className="text-green-700 font-semibold">✅ {dict.noDue}</p>
        </div>
      )}
    </div>
  );
}
