"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, TrendingUp, BarChart3, AlertCircle } from "lucide-react";

interface PaymentMethod {
  method: string;
  total: number;
  count: number;
  percentage: number;
}

interface PaymentDashboardProps {
  lang?: "en" | "ne";
}

const labels = {
  en: {
    title: "Payment Methods Breakdown",
    totalCollected: "Total Collected",
    transactions: "Transactions",
    cash: "Cash",
    esewa: "eSewa",
    khalti: "Khalti",
    bank: "Bank/QR",
    outstanding: "Outstanding Amount",
    loading: "Loading payment data...",
    error: "Failed to load payment data",
  },
  ne: {
    title: "भुक्तानी विधि विश्लेषण",
    totalCollected: "कुल संकलन",
    transactions: "लेनदेन",
    cash: "नगद",
    esewa: "eSewa",
    khalti: "Khalti",
    bank: "बैंक/QR",
    outstanding: "बकाया रकम",
    loading: "भुक्तानी डेटा लोड हुँदैछ...",
    error: "भुक्तानी डेटा लोड गर्न सकिएन",
  },
};

const METHOD_COLORS = {
  cash: { bg: "bg-green-50", border: "border-green-200", icon: "💵", label: "Cash" },
  esewa: { bg: "bg-blue-50", border: "border-blue-200", icon: "📱", label: "eSewa" },
  khalti: { bg: "bg-purple-50", border: "border-purple-200", icon: "💜", label: "Khalti" },
  bank: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "🏦", label: "Bank" },
};

export function PaymentDashboard({ lang = "en" }: PaymentDashboardProps) {
  const dict = labels[lang];
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/analytics?period=monthly");
        if (response.ok) {
          const data = await response.json();

          // Process payment data
          const totalCollected = data.summary?.totalPaymentsMade || 0;
          const paymentsByMethod = data.summary?.paymentsByMethod || {
            cash: 0,
            esewa: 0,
            khalti: 0,
            bank: 0,
          };

          const payments: PaymentMethod[] = Object.entries(paymentsByMethod).map(
            ([method, total]: [string, any]) => ({
              method,
              total: Number(total),
              count: 0, // Would need transaction count from API
              percentage: totalCollected > 0 ? (Number(total) / totalCollected) * 100 : 0,
            })
          );

          setPaymentData({
            totalCollected,
            outstanding: data.summary?.totalCredit || 0,
            payments: payments.filter((p) => p.total > 0),
          });
        }
      } catch (err) {
        console.error("Failed to fetch payment data:", err);
        setError(dict.error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dict.error]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-slate-500">{dict.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-red-600">{error}</p>
      </div>
    );
  }

  if (!paymentData) {
    return null;
  }

  const money = (value: number) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-50 border border-emerald-200 p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">
              {dict.totalCollected}
            </p>
          </div>
          <p className="text-3xl font-bold text-emerald-900">
            {money(paymentData.totalCollected)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-orange-50 border border-orange-200 p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-semibold text-orange-700">
              {dict.outstanding}
            </p>
          </div>
          <p className="text-3xl font-bold text-orange-900">
            {money(paymentData.outstanding)}
          </p>
        </motion.div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {dict.title}
        </h3>

        <div className="space-y-4">
          {paymentData.payments.map((payment: PaymentMethod, index: number) => {
            const methodKey = payment.method as keyof typeof METHOD_COLORS;
            const config = METHOD_COLORS[methodKey] || METHOD_COLORS.cash;

            return (
              <motion.div
                key={payment.method}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl border p-4 ${config.bg} ${config.border}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
                      <span className="text-2xl">{config.icon}</span>
                      {payment.method === "cash"
                        ? dict.cash
                        : payment.method === "esewa"
                        ? dict.esewa
                        : payment.method === "khalti"
                        ? dict.khalti
                        : dict.bank}
                    </p>
                    <p className="text-xs text-gray-600">
                      {payment.count} {dict.transactions}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {money(payment.total)}
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {payment.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${payment.percentage}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }}
                    className={`h-full ${
                      payment.method === "cash"
                        ? "bg-green-500"
                        : payment.method === "esewa"
                        ? "bg-blue-500"
                        : payment.method === "khalti"
                        ? "bg-purple-500"
                        : "bg-cyan-500"
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {paymentData.payments.length === 0 && (
          <p className="text-center text-slate-500 py-8">
            {lang === "ne"
              ? "कुनै भुक्तानी डेटा उपलब्ध छैन"
              : "No payment data available"}
          </p>
        )}
      </div>
    </div>
  );
}