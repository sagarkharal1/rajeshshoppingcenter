"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Filter, Download, TrendingUp, TrendingDown } from "lucide-react";

interface Transaction {
  id: string | number;
  type: "order" | "booking" | "payment";
  date: string;
  customerId: number;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  details?: any;
}

interface TransactionHistoryProps {
  lang?: "en" | "ne";
}

const labels = {
  en: {
    title: "Transaction History",
    dateRange: "Date Range",
    from: "From",
    to: "To",
    viewType: "View Type",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    custom: "Custom",
    filterType: "Filter By Type",
    allTransactions: "All Transactions",
    ordersOnly: "Product Orders",
    bookingsOnly: "Transport Bookings",
    paymentsOnly: "Payments",
    type: "Type",
    date: "Date",
    customer: "Customer",
    amount: "Amount",
    method: "Method",
    status: "Status",
    noTransactions: "No transactions found",
    totalAmount: "Total Amount",
    transactionCount: "Count",
    ordersCount: "Orders",
    bookingsCount: "Bookings",
    paymentsCount: "Payments",
    export: "Export",
  },
  ne: {
    title: "लेनदेन इतिहास",
    dateRange: "मिति दायरा",
    from: "देखि",
    to: "सम्म",
    viewType: "दृश्य प्रकार",
    daily: "दैनिक",
    weekly: "साप्ताहिक",
    monthly: "मासिक",
    yearly: "वार्षिक",
    custom: "अनुकूल",
    filterType: "प्रकार अनुसार फिल्टर गर्नुहोस्",
    allTransactions: "सबै लेनदेन",
    ordersOnly: "पण्य अर्डर",
    bookingsOnly: "यातायात बुकिङ",
    paymentsOnly: "भुक्तानी",
    type: "प्रकार",
    date: "मिति",
    customer: "ग्राहक",
    amount: "रकम",
    method: "तरिका",
    status: "स्थिति",
    noTransactions: "कुनै लेनदेन भेटिएन",
    totalAmount: "कुल रकम",
    transactionCount: "गणना",
    ordersCount: "अर्डर",
    bookingsCount: "बुकिङ",
    paymentsCount: "भुक्तानी",
    export: "निर्यात",
  },
};

const TRANSACTION_TYPES = {
  all: "all",
  orders: "orders",
  bookings: "bookings",
  payments: "payments",
} as const;

const VIEW_TYPES = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
  custom: "custom",
} as const;

export function TransactionHistory({ lang = "en" }: TransactionHistoryProps) {
  const dict = labels[lang];
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Date filters
  const [viewType, setViewType] = useState<keyof typeof VIEW_TYPES>("monthly");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

  // Type filter
  const [filterType, setFilterType] = useState<keyof typeof TRANSACTION_TYPES>("all");

  // Expanded transaction
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: fromDate,
        endDate: toDate,
        type: filterType === "all" ? "all" : filterType.slice(0, -4), // Remove "Only" suffix
        period: viewType,
      });

      const response = await fetch(`/api/admin/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [viewType, fromDate, toDate, filterType]);

  const getTypeIcon = (type: string) => {
    if (type === "order") return "📋";
    if (type === "booking") return "🚗";
    if (type === "payment") return "💰";
    return "📊";
  };

  const getStatusColor = (status: string) => {
    if (status === "paid") return "text-green-600 bg-green-50";
    if (status === "unpaid" || status === "pending") return "text-amber-600 bg-amber-50";
    return "text-gray-600 bg-gray-50";
  };

  const getStatusLabel = (status: string) => {
    if (status === "paid") return lang === "ne" ? "✅ भुक्तानी भयो" : "✅ Paid";
    if (status === "unpaid") return lang === "ne" ? "📒 भुक्तानी बाँकी" : "📒 Unpaid";
    if (status === "pending") return lang === "ne" ? "⏳ प्रतीक्षमान" : "⏳ Pending";
    return status;
  };

  const money = (value: number) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950 mb-4">
          <Filter className="h-5 w-5" />
          {dict.filterType}
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* View Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {dict.viewType}
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(VIEW_TYPES).map(([key]) => (
                <button
                  key={key}
                  onClick={() => setViewType(key as keyof typeof VIEW_TYPES)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    viewType === key
                      ? "bg-blue-500 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {dict[key as keyof typeof labels.en]}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {dict.filterType}
            </label>
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as keyof typeof TRANSACTION_TYPES)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">{dict.allTransactions}</option>
              <option value="orders">{dict.ordersOnly}</option>
              <option value="bookings">{dict.bookingsOnly}</option>
              <option value="payments">{dict.paymentsOnly}</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {dict.from}
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {dict.to}
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900 mb-1">
              {dict.totalAmount}
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {money(summary.totalAmount || 0)}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-900 mb-1">
              {dict.ordersCount}
            </p>
            <p className="text-2xl font-bold text-blue-900">
              {summary.totalOrders || 0}
            </p>
            {summary.totalOrderAmount && (
              <p className="text-xs text-blue-700 mt-1">
                {money(summary.totalOrderAmount)}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-semibold text-cyan-900 mb-1">
              {dict.bookingsCount}
            </p>
            <p className="text-2xl font-bold text-cyan-900">
              {summary.totalBookings || 0}
            </p>
            {summary.totalBookingAmount && (
              <p className="text-xs text-cyan-700 mt-1">
                {money(summary.totalBookingAmount)}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-semibold text-green-900 mb-1">
              {dict.paymentsCount}
            </p>
            <p className="text-2xl font-bold text-green-900">
              {money(summary.totalPaymentsMade || 0)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Transactions List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-lg font-bold text-slate-950 mb-4">{dict.title}</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500" />
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.map((txn) => (
              <motion.div
                key={`${txn.type}-${txn.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition cursor-pointer"
                onClick={() =>
                  setExpandedId(
                    expandedId === txn.id ? null : txn.id
                  )
                }
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-xl mt-0.5">
                      {getTypeIcon(txn.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">
                        {txn.type === "order"
                          ? `Order #${txn.id}`
                          : txn.type === "booking"
                          ? `Booking #${txn.id}`
                          : "Payment"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {txn.customerName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(txn.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {txn.amount > 0 ? "+" : ""}
                      {money(txn.amount)}
                    </p>
                    <p
                      className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getStatusColor(
                        txn.paymentStatus
                      )}`}
                    >
                      {getStatusLabel(txn.paymentStatus)}
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === txn.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200 pt-3 mt-3"
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-600">
                            {dict.method}
                          </p>
                          <p className="font-semibold text-slate-900">
                            {txn.paymentMethod}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">
                            {dict.type}
                          </p>
                          <p className="font-semibold text-slate-900 capitalize">
                            {txn.type}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-slate-500">{dict.noTransactions}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
