"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3, Target } from "lucide-react";

interface BusinessSummaryProps {
  lang?: "en" | "ne";
  api?: (url: string, opts?: any) => Promise<any>;
}

const labels = {
  en: {
    title: "Monthly Business Summary",
    thisMonth: "This Month",
    lastMonth: "Last Month",
    comparison: "Comparison",
    totalOrders: "Total Orders",
    totalBookings: "Total Bookings",
    totalRevenue: "Total Revenue",
    totalPayments: "Total Payments",
    creditGiven: "Credit Given",
    creditRecovered: "Credit Recovered",
    topCustomer: "Top Customer",
    stockStatus: "Stock Status",
    netCashFlow: "Net Cash Flow",
    loading: "Loading summary...",
    increase: "increase",
    decrease: "decrease",
  },
  ne: {
    title: "मासिक व्यवसाय सारांश",
    thisMonth: "यो महीना",
    lastMonth: "गत महीना",
    comparison: "तुलना",
    totalOrders: "कुल अर्डर",
    totalBookings: "कुल बुकिङ",
    totalRevenue: "कुल राजस्व",
    totalPayments: "कुल भुक्तानी",
    creditGiven: "दिएको उधारो",
    creditRecovered: "वसुल गरेको उधारो",
    topCustomer: "शीर्ष ग्राहक",
    stockStatus: "स्टक स्थिति",
    netCashFlow: "शुद्ध नगद प्रवाह",
    loading: "सारांश लोड हुँदैछ...",
    increase: "वृद्धि",
    decrease: "गिरावट",
  },
};

export function BusinessSummary({ lang = "en", api }: BusinessSummaryProps) {
  const dict = labels[lang];
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        // Fetch current month data
        const currentPath = `/admin/analytics?period=monthly&date=${new Date().toISOString().split("T")[0]}`;
        const currentData = api
          ? await api(currentPath)
          : await fetch(`/api${currentPath}`).then((response) => response.ok ? response.json() : null);

        // Fetch last month data
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastPath = `/admin/analytics?period=monthly&date=${lastMonthDate.toISOString().split("T")[0]}`;
        const lastData = api
          ? await api(lastPath)
          : await fetch(`/api${lastPath}`).then((response) => response.ok ? response.json() : null);

        setSummary({
          current: currentData?.summary || {},
          last: lastData?.summary || {},
        });
      } catch (err) {
        console.error("Failed to fetch summary:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [api]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-slate-500">{dict.loading}</p>
      </div>
    );
  }

  if (!summary) return null;

  const money = (value: number) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(value);

  const calculateChange = (current: number, last: number) => {
    if (last === 0) return current > 0 ? 100 : 0;
    return ((current - last) / last) * 100;
  };

  const MetricCard = ({
    label,
    value,
    change,
    icon: Icon,
    color,
  }: {
    label: string;
    value: string;
    change: number;
    icon: any;
    color: string;
  }) => {
    const isPositive = change >= 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-4 ${color}`}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <p
            className={`text-sm font-semibold ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </p>
        </div>
      </motion.div>
    );
  };

  const currentTotal = summary.current.totalAmount || 0;
  const lastTotal = summary.last.totalAmount || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950 flex items-center gap-2 mb-2">
          <BarChart3 className="h-6 w-6" />
          {dict.title}
        </h2>
        <p className="text-sm text-slate-600">
          {lang === "ne"
            ? "यस महीनाको व्यवसाय प्रदर्शन र तुलना"
            : "Business performance for the current month and comparison"}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={dict.totalRevenue}
          value={money(currentTotal)}
          change={calculateChange(currentTotal, lastTotal)}
          icon={BarChart3}
          color="bg-blue-50 border-blue-200"
        />

        <MetricCard
          label={dict.totalOrders}
          value={String(summary.current.totalOrders || 0)}
          change={calculateChange(
            summary.current.totalOrders || 0,
            summary.last.totalOrders || 0
          )}
          icon={Target}
          color="bg-green-50 border-green-200"
        />

        <MetricCard
          label={dict.totalBookings}
          value={String(summary.current.totalBookings || 0)}
          change={calculateChange(
            summary.current.totalBookings || 0,
            summary.last.totalBookings || 0
          )}
          icon={BarChart3}
          color="bg-amber-50 border-amber-200"
        />

        <MetricCard
          label={dict.totalPayments}
          value={money(summary.current.totalPaymentsMade || 0)}
          change={calculateChange(
            summary.current.totalPaymentsMade || 0,
            summary.last.totalPaymentsMade || 0
          )}
          icon={TrendingUp}
          color="bg-emerald-50 border-emerald-200"
        />

        <MetricCard
          label={dict.creditGiven}
          value={money(summary.current.totalCredit || 0)}
          change={calculateChange(
            summary.current.totalCredit || 0,
            summary.last.totalCredit || 0
          )}
          icon={TrendingDown}
          color="bg-orange-50 border-orange-200"
        />

        <MetricCard
          label={dict.netCashFlow}
          value={money(
            (summary.current.totalPaymentsMade || 0) - (summary.current.totalCredit || 0)
          )}
          change={calculateChange(
            (summary.current.totalPaymentsMade || 0) - (summary.current.totalCredit || 0),
            (summary.last.totalPaymentsMade || 0) - (summary.last.totalCredit || 0)
          )}
          icon={TrendingUp}
          color="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* This Month */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-950 mb-4">
            {dict.thisMonth}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">{dict.totalOrders}</p>
              <p className="font-semibold text-slate-900">
                {summary.current.totalOrders || 0}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">{dict.totalBookings}</p>
              <p className="font-semibold text-slate-900">
                {summary.current.totalBookings || 0}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">{dict.totalPayments}</p>
              <p className="font-semibold text-emerald-900">
                {money(summary.current.totalPaymentsMade || 0)}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700">{dict.creditGiven}</p>
              <p className="font-semibold text-orange-900">
                {money(summary.current.totalCredit || 0)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Last Month */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-950 mb-4">
            {dict.lastMonth}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">{dict.totalOrders}</p>
              <p className="font-semibold text-slate-900">
                {summary.last.totalOrders || 0}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">{dict.totalBookings}</p>
              <p className="font-semibold text-slate-900">
                {summary.last.totalBookings || 0}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">{dict.totalPayments}</p>
              <p className="font-semibold text-emerald-900">
                {money(summary.last.totalPaymentsMade || 0)}
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700">{dict.creditGiven}</p>
              <p className="font-semibold text-orange-900">
                {money(summary.last.totalCredit || 0)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
