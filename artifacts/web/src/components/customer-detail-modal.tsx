"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, ArrowUp, ArrowDown, Phone, MapPin, Gift, ReceiptText, Truck, CreditCard } from "lucide-react";
import { printBill, type BillShopInfo } from "@/lib/print-bill";
import { printOrderSlip, printBookingSlip, printPaymentReceipt, openProofDocument } from "@/lib/print-slips";

interface Order {
  id: number;
  status: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  customerName: string;
  items?: Array<{
    productName: string;
    quantity: number;
    price: number;
    unit?: string;
  }>;
}

interface Booking {
  id: number;
  status: string;
  serviceType: string;
  chargedAmount: number;
  amountPaid: number;
  paymentMethod: string;
  pickupLocation: string;
  destination: string;
  bookingDate: string;
  customerName: string;
  proofPath?: string | null;
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  date: string;
  referenceNote?: string;
  proofPath?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  subtotalAmount: number;
  previousDueAmount: number;
  totalAmount: number;
  amountPaid: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  note?: string | null;
  proofPath?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
}

interface CustomerData {
  id: number;
  name: string;
  phone: string;
  code: string;
  address?: string;
  email?: string;
  totalSpent: number;
  rewardPoints: number;
  creditBalance: number;
  orders: Order[];
  invoices: Invoice[];
  bookings: Booking[];
  payments: Payment[];
  ledgerEntries?: Array<{
    date: string;
    type: "debit" | "credit";
    amount: number;
    reason: string;
  }>;
}

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  lang?: "en" | "ne";
  api?: (url: string, opts?: any) => Promise<any>;
  onRefresh?: () => Promise<void> | void;
  shop?: BillShopInfo;
}

const labels = {
  en: {
    title: "Customer Details",
    close: "Close",
    orders: "Orders",
    bookings: "Bookings",
    payments: "Payments",
    invoices: "Product Bills",
    allActivity: "All Activity",
    productDue: "Product Due",
    transportDue: "Transport Due",
    totalDue: "Total Due",
    creditHistory: "Credit History",
    totalSpent: "Total Spent",
    rewardPoints: "Reward Points",
    creditBalance: "Credit Balance",
    noOrders: "No orders yet",
    noInvoices: "No product bills yet",
    noBookings: "No bookings yet",
    noPayments: "No payments yet",
    print: "Print",
    amount: "Amount",
    date: "Date",
    status: "Status",
    method: "Method",
    service: "Service",
    route: "Route",
    debit: "Debit",
    credit: "Credit",
    reason: "Reason",
  },
  // Missing keys fall through to English, so anything absent here is a word the
  // shopkeeper reads in English while using the app in Nepali — which is how
  // "Product Due", "Transport Due" and "Total Due" stayed untranslated on the
  // screen he opens most.
  ne: {
    title: "ग्राहकको विवरण",
    close: "बन्द गर्नुहोस्",
    orders: "अर्डर",
    bookings: "बुकिङ",
    payments: "भुक्तानी",
    invoices: "सामानका बिल",
    allActivity: "सबै कारोबार",
    productDue: "सामानको बाँकी",
    transportDue: "यातायातको बाँकी",
    totalDue: "कुल बाँकी",
    noInvoices: "अझै कुनै बिल छैन",
    creditHistory: "उधारो इतिहास",
    totalSpent: "कुल खर्च",
    rewardPoints: "पुरस्कार अंक",
    creditBalance: "उधारो बाकी",
    noOrders: "अझै अर्डर छैन",
    noBookings: "अझै बुकिङ छैन",
    noPayments: "अझै भुक्तानी छैन",
    print: "प्रिन्ट",
    amount: "रकम",
    date: "मिति",
    status: "स्थिति",
    method: "तरिका",
    service: "सेवा",
    route: "रुट",
    debit: "खर्च",
    credit: "जमा",
    reason: "कारण",
  },
};

export function CustomerDetailModal({
  isOpen,
  onClose,
  customerId,
  lang = "en",
  api,
  onRefresh,
  shop = { name: "Rajesh Shopping Center" },
}: CustomerDetailModalProps) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "invoices" | "orders" | "bookings" | "payments" | "ledger">(
    "all"
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethod: "cash", referenceNote: "" });
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [voidBusyId, setVoidBusyId] = useState<number | null>(null);
  const [billBusyId, setBillBusyId] = useState<number | null>(null);
  // Voiding used to happen straight off a browser prompt: type anything, press
  // OK, the bill was gone. Now the bill is named and priced in a dialog first.
  const [voidTarget, setVoidTarget] = useState<
    { kind: "invoices" | "payments"; id: number; label: string; amount: number } | null
  >(null);
  const [voidReason, setVoidReason] = useState("");

  const dict: any = { ...labels.en, ...labels[lang] };

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const data = api
        ? await api(`/customers/${customerId}/full-profile`)
        : await fetch(`/api/customers/${customerId}/full-profile`).then((response) => {
            if (!response.ok) throw new Error("Failed to load customer");
            return response.json();
          });
      setCustomer(data);
    } catch (err) {
      console.error("Failed to fetch customer data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !customerId) return;

    fetchCustomerData();
  }, [isOpen, customerId]);

  const savePayment = async () => {
    if (!api || !customer) return;
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) return;
    setPaymentBusy(true);
    setPaymentMessage("");
    try {
      await api("/admin/payments", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          amount,
          paymentMethod: paymentForm.paymentMethod,
          referenceNote: paymentForm.referenceNote || "Customer account payment",
        }),
      });
      setPaymentForm({ amount: "", paymentMethod: "cash", referenceNote: "" });
      setPaymentMessage(lang === "ne" ? "भुक्तानी सेभ भयो" : "Payment saved");
      await fetchCustomerData();
      await onRefresh?.();
      window.setTimeout(() => setPaymentMessage(""), 3000);
    } catch (err) {
      setPaymentMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaymentBusy(false);
    }
  };

  // Fetches the bill with its lines and opens it as a printable slip. The list
  // only carries totals, so the items have to be loaded on demand.
  const openBill = async (invoiceId: number) => {
    if (!api) return;
    setBillBusyId(invoiceId);
    setPaymentMessage("");
    try {
      const data = await api(`/admin/invoices/${invoiceId}`);
      const result = printBill(
        data.invoice,
        data.items || [],
        data.customer || customer,
        lang,
        shop,
      );
      if (!result.ok) {
        setPaymentMessage(
          lang === "ne"
            ? "पप-अप रोकिएको छ। ब्राउजरमा पप-अप खोल्न दिनुहोस्।"
            : "The pop-up was blocked. Allow pop-ups for this site and try again.",
        );
      }
    } catch (err) {
      setPaymentMessage(
        err instanceof Error ? err.message : lang === "ne" ? "बिल खोल्न सकिएन।" : "Could not open the bill.",
      );
    } finally {
      setBillBusyId(null);
    }
  };

  // Orders, bookings and payments already hold everything their slip needs, so
  // unlike a bill they open without another round trip to the server.
  const popupBlocked = () =>
    setPaymentMessage(
      lang === "ne"
        ? "पप-अप रोकिएको छ। ब्राउजरमा पप-अप खोल्न दिनुहोस्।"
        : "The pop-up was blocked. Allow pop-ups for this site and try again.",
    );

  const openOrder = (order: any) => {
    setPaymentMessage("");
    if (!printOrderSlip({ ...order, customerName: order.customerName || customer?.name }, lang, shop).ok) popupBlocked();
  };
  const openBooking = (booking: any) => {
    setPaymentMessage("");
    if (!printBookingSlip({ ...booking, customerName: booking.customerName || customer?.name, customerPhone: booking.customerPhone || customer?.phone }, lang, shop).ok) popupBlocked();
  };
  const openPayment = (payment: any) => {
    setPaymentMessage("");
    // The ledger stores the balance left after each entry. Pulling it out here
    // is what lets the receipt print "was 11,759, paid 2,000, now 9,759" — the
    // only form a customer can actually check against their own khata.
    const entry = (customer?.ledgerEntries as any[] | undefined)?.find(
      (item) => Number(item?.paymentId) === Number(payment.id),
    );
    const balanceAfter = entry && entry.balanceAfter != null ? Number(entry.balanceAfter) : null;
    if (
      !printPaymentReceipt(
        { ...payment, createdAt: payment.createdAt || payment.date },
        customer,
        lang,
        shop,
        balanceAfter,
      ).ok
    ) {
      popupBlocked();
    }
  };

  // Voiding writes a reversing entry rather than deleting: the mistaken record
  // stays visible, and stock, credit balance, and reward points are corrected.
  const confirmVoid = async () => {
    if (!api || !voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      setPaymentMessage(lang === "ne" ? "कारण लेख्नु आवश्यक छ।" : "A reason is required.");
      return;
    }
    const { kind, id } = voidTarget;
    setVoidBusyId(id);
    setPaymentMessage("");
    try {
      const result = await api(`/admin/${kind}/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setPaymentMessage(
        result?.message || (lang === "ne" ? "रद्द भयो। हिसाब मिलाइयो।" : "Voided. Balance corrected."),
      );
      setVoidTarget(null);
      setVoidReason("");
      await fetchCustomerData();
      await onRefresh?.();
      window.setTimeout(() => setPaymentMessage(""), 5000);
    } catch (err) {
      setPaymentMessage(err instanceof Error ? err.message : "Could not void this record");
    } finally {
      setVoidBusyId(null);
    }
  };

  if (!isOpen) return null;

  // A bill's stored dueAmount is the customer's running balance at the moment
  // it was written — it already contains everything owed before it. Adding
  // those up counts the same debt once per bill (and counts voided bills too),
  // which is how someone owing 11,759 was shown as owing 22,359. The balance
  // the server maintains — surviving bills minus surviving payments — is the
  // one true figure, and it covers shop bills only; transport is separate.
  const productDue = customer ? Math.max(Number(customer.creditBalance || 0), 0) : 0;
  const transportDue = customer
    ? (customer.bookings || []).reduce((sum, booking) => {
        const status = String(booking.status || "").toLowerCase();
        if (status === "cancelled") return sum;
        return sum + Math.max(0, Number(booking.chargedAmount || 0) - Number(booking.amountPaid || 0));
      }, 0)
    : 0;
  const activity = customer
    ? [
        ...(customer.invoices || []).map((invoice) => ({
          id: `invoice-${invoice.id}`,
          date: invoice.createdAt,
          title: `${lang === "ne" ? "बिल" : "Bill"} ${invoice.invoiceNumber}`,
          meta: `${invoice.paymentMethod} - ${invoice.paymentStatus}`,
          amount: Number(invoice.totalAmount || 0),
          due: Number(invoice.dueAmount || 0),
          kind: "invoice" as const,
        })),
        ...(customer.bookings || []).map((booking) => ({
          id: `booking-${booking.id}`,
          date: booking.bookingDate,
          title: `Transport #${booking.id}`,
          meta: `${booking.serviceType}: ${booking.pickupLocation} -> ${booking.destination}`,
          amount: Number(booking.chargedAmount || 0),
          due: Math.max(0, Number(booking.chargedAmount || 0) - Number(booking.amountPaid || 0)),
          kind: "booking" as const,
        })),
        ...(customer.payments || []).map((payment) => ({
          id: `payment-${payment.id}`,
          date: payment.date,
          title: payment.referenceNote || "Payment received",
          meta: payment.method,
          amount: Number(payment.amount || 0),
          due: 0,
          kind: "payment" as const,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{dict.title}</h2>
              {customer && (
                <p className="text-sm text-gray-600 mt-1">
                  {customer.phone} • {customer.code}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-500" />
            </div>
          ) : customer ? (
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-900 mb-1">
                    <Phone className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {lang === "ne" ? "फोन" : "Phone"}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {customer.phone}
                  </p>
                </div>

                {customer.address && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-900 mb-1">
                      <MapPin className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {lang === "ne" ? "ठेगाना" : "Address"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{customer.address}</p>
                  </div>
                )}

                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1">
                    {dict.totalSpent}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    Rs. {customer.totalSpent.toLocaleString()}
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-purple-900 mb-1">
                    <Gift className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {dict.rewardPoints}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {customer.rewardPoints} pts
                  </p>
                </div>

                <div className={`rounded-lg p-4 ${
                  customer.creditBalance > 0
                    ? "bg-orange-50"
                    : "bg-green-50"
                }`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                    customer.creditBalance > 0
                      ? "text-orange-900"
                      : "text-green-900"
                  }`}>
                    {dict.creditBalance}
                  </p>
                  <p className={`text-lg font-bold ${
                    customer.creditBalance > 0
                      ? "text-orange-900"
                      : "text-green-900"
                  }`}>
                    Rs. {Math.abs(customer.creditBalance).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: dict.productDue, value: productDue, icon: ReceiptText, className: "border-blue-200 bg-blue-50 text-blue-900" },
                  { label: dict.transportDue, value: transportDue, icon: Truck, className: "border-amber-200 bg-amber-50 text-amber-900" },
                  {
                    label: dict.totalDue,
                    // Shop bills plus unpaid jeep/tractor trips. Showing only
                    // the shop balance here understated what a customer owes.
                    value: productDue + transportDue,
                    icon: CreditCard,
                    className: productDue + transportDue > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
                  },
                ].map((card) => (
                  <div key={card.label} className={`rounded-2xl border p-4 ${card.className}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wider">{card.label}</p>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold">Rs. {Number(card.value || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {customer.creditBalance > 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-emerald-950">
                        {lang === "ne" ? "उधारो भुक्तानी लिनुहोस्" : "Collect Credit Payment"}
                      </h3>
                      <p className="text-sm text-emerald-700">
                        {/* Money taken here settles shop bills only; an unpaid
                            jeep or tractor trip is collected on the booking. */}
                        {lang === "ne" ? "सामानको उधारो बाँकी" : "Shop credit outstanding"}: Rs. {productDue.toLocaleString()}
                      </p>
                    </div>
                    {paymentMessage ? (
                      <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700">
                        {paymentMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px]">
                    <input
                      type="number"
                      min="0"
                      value={paymentForm.amount}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder={dict.amount}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPaymentForm((current) => ({ ...current, amount: String(customer.creditBalance) }))}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700"
                    >
                      {lang === "ne" ? "पूरा तिर्नुहोस्" : "Pay Full"}
                    </button>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                    >
                      {["cash", "esewa", "khalti", "bank"].map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={paymentBusy || Number(paymentForm.amount) <= 0}
                      onClick={savePayment}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {paymentBusy ? "..." : (lang === "ne" ? "भुक्तानी सेभ" : "Save Payment")}
                    </button>
                    <textarea
                      value={paymentForm.referenceNote}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, referenceNote: event.target.value }))}
                      placeholder={lang === "ne" ? "नोट / रसिद विवरण" : "Note / receipt reference"}
                      className="min-h-20 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm md:col-span-2"
                    />
                  </div>
                </div>
              ) : null}

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-1 flex-wrap">
                  {(
                    [
                      { id: "all" as const, label: dict.allActivity },
                      { id: "invoices" as const, label: dict.invoices },
                      { id: "orders" as const, label: dict.orders },
                      { id: "bookings" as const, label: dict.bookings },
                      { id: "payments" as const, label: dict.payments },
                      { id: "ledger" as const, label: dict.creditHistory },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
                        activeTab === tab.id
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {tab.label}
                      {tab.id === "orders" && customer.orders.length > 0 && (
                        <span className="ml-2 inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {customer.orders.length}
                        </span>
                      )}
                      {tab.id === "invoices" && customer.invoices.length > 0 && (
                        <span className="ml-2 inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {customer.invoices.length}
                        </span>
                      )}
                      {tab.id === "bookings" && customer.bookings.length > 0 && (
                        <span className="ml-2 inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {customer.bookings.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div>
                {activeTab === "all" && (
                  <div className="space-y-3">
                    {activity.length > 0 ? (
                      activity.map((item) => {
                        const Icon = item.kind === "invoice" ? ReceiptText : item.kind === "booking" ? Truck : CreditCard;
                        const color = item.kind === "payment" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : item.due > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-700 bg-slate-50 border-slate-200";
                        return (
                          <div key={item.id} className={`rounded-2xl border p-4 ${color}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <Icon className="mt-1 h-5 w-5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-950">{item.title}</p>
                                  <p className="text-sm text-slate-600">{item.meta}</p>
                                  <p className="text-xs text-slate-500">{new Date(item.date).toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-extrabold text-slate-950">
                                  {item.kind === "payment" ? "+" : ""}Rs. {item.amount.toLocaleString()}
                                </p>
                                {item.due > 0 ? (
                                  <p className="text-sm font-bold text-rose-700">
                                    {lang === "ne" ? "यसपछिको बाँकी" : "Balance after"}: Rs. {item.due.toLocaleString()}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-8 text-gray-500">{lang === "ne" ? "अहिलेसम्म कुनै कारोबार छैन" : "No account activity yet"}</p>
                    )}
                  </div>
                )}

                {activeTab === "invoices" && (
                  <div className="space-y-3">
                    {customer.invoices.length > 0 ? (
                      customer.invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className={`rounded-2xl border p-4 ${invoice.voidedAt ? "border-slate-200 bg-slate-50" : "border-gray-200"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${invoice.voidedAt ? "text-slate-500 line-through" : "text-gray-900"}`}>
                                {invoice.invoiceNumber}
                              </p>
                              <p className="text-sm text-gray-600">{new Date(invoice.createdAt).toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{invoice.paymentMethod} - {invoice.paymentStatus}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${invoice.voidedAt ? "text-slate-400 line-through" : "text-gray-900"}`}>
                                Rs. {invoice.totalAmount.toLocaleString()}
                              </p>
                              {invoice.voidedAt ? null : invoice.dueAmount > 0 ? (
                                // Not this bill's own due — the khata balance
                                // once this bill was added.
                                <p className="text-sm font-bold text-rose-700">
                                  {lang === "ne" ? "यसपछिको बाँकी" : "Balance after"}: Rs. {invoice.dueAmount.toLocaleString()}
                                </p>
                              ) : (
                                <p className="text-sm font-bold text-emerald-700">{lang === "ne" ? "भुक्तानी भयो" : "Paid"}</p>
                              )}
                            </div>
                          </div>
                          {invoice.voidedAt ? (
                            <p className="mt-2 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                              {lang === "ne" ? "रद्द गरिएको" : "VOIDED"}
                              {invoice.voidReason ? ` — ${invoice.voidReason}` : ""}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {/* Opens even for a voided bill: seeing what was
                                cancelled is how a mistake gets understood. */}
                            <button
                              type="button"
                              onClick={() => openBill(invoice.id)}
                              disabled={billBusyId === invoice.id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              {billBusyId === invoice.id
                                ? (lang === "ne" ? "खोल्दै..." : "Opening...")
                                : (lang === "ne" ? "बिल हेर्नुहोस् / छाप्नुहोस्" : "View / print bill")}
                            </button>
                            {invoice.voidedAt ? null : (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidReason("");
                                  setVoidTarget({
                                    kind: "invoices",
                                    id: invoice.id,
                                    label: invoice.invoiceNumber,
                                    amount: invoice.totalAmount,
                                  });
                                }}
                                disabled={voidBusyId === invoice.id}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                              >
                                {lang === "ne" ? "गलत भयो? बिल रद्द गर्नुहोस्" : "Made a mistake? Void this bill"}
                              </button>
                            )}
                          </div>
                          {invoice.proofPath ? (
                            // Tap to see it full size — a thumbnail of a payment
                            // screenshot is too small to read a reference from.
                            <button type="button" onClick={() => openProofDocument(invoice.proofPath as string, `${invoice.invoiceNumber} — ${lang === "ne" ? "भुक्तानीको प्रमाण" : "payment proof"}`, lang)} className="mt-3 block w-full">
                              <img src={invoice.proofPath} alt="Invoice proof" className="max-h-56 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain p-2" />
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">{dict.noInvoices}</p>
                    )}
                  </div>
                )}

                {activeTab === "orders" && (
                  <div className="space-y-3">
                    {customer.orders.length > 0 ? (
                      customer.orders.map((order) => (
                        <div
                          key={order.id}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedId(
                                expandedId === order.id ? null : order.id
                              )
                            }
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                          >
                            <div className="flex-1 text-left">
                              <p className="font-semibold text-gray-900">
                                {lang === "ne" ? "अर्डर" : "Order"} #{order.id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(order.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">
                                Rs. {order.totalAmount.toLocaleString()}
                              </p>
                              <p className={`text-xs font-semibold ${
                                order.paymentStatus === "paid"
                                  ? "text-green-600"
                                  : "text-amber-600"
                              }`}>
                                {order.paymentStatus === "paid"
                                  ? "✅ Paid"
                                  : Number((order as any).amountPaid || 0) > 0
                                    // Show what is still owed rather than a bare
                                    // "Pending", which hides a part-payment.
                                    ? `📒 ${lang === "ne" ? "बाँकी" : "Due"} Rs. ${Math.max(
                                        Number(order.totalAmount || 0) - Number((order as any).amountPaid || 0),
                                        0,
                                      ).toLocaleString()}`
                                    : "📒 Pending"}
                              </p>
                            </div>
                          </button>

                          <AnimatePresence>
                            {expandedId === order.id && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                className="border-t border-gray-200 bg-gray-50 p-4 space-y-2"
                              >
                                {order.items?.map((item, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {item.productName} x{item.quantity}{" "}
                                      {item.unit || "pc"}
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      Rs.{" "}
                                      {(item.price * item.quantity).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                                <div className="pt-2 border-t border-gray-200 flex gap-2">
                                  {/* Had no handler at all until now: pressing
                                      Print simply did nothing. */}
                                  <button
                                    type="button"
                                    onClick={() => openOrder(order)}
                                    className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                                  >
                                    <Printer className="h-4 w-4" />
                                    {dict.print}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">
                        {dict.noOrders}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "bookings" && (
                  <div className="space-y-3">
                    {customer.bookings.length > 0 ? (
                      customer.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-900">
                                Booking #{booking.id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(booking.bookingDate).toLocaleString()}
                              </p>
                            </div>
                            <p className="font-bold text-gray-900">
                              Rs. {booking.chargedAmount.toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 text-sm text-gray-700">
                            <p>
                              <span className="font-semibold">{dict.service}:</span>{" "}
                              {booking.serviceType}
                            </p>
                            <p>
                              <span className="font-semibold">{dict.route}:</span>{" "}
                              {booking.pickupLocation} → {booking.destination}
                            </p>
                            {booking.amountPaid < booking.chargedAmount && (
                              <p className="text-amber-600">
                                📒 Due: Rs.{" "}
                                {(booking.chargedAmount - booking.amountPaid).toLocaleString()}
                              </p>
                            )}
                          </div>
                          {booking.proofPath ? (
                            <button type="button" onClick={() => openProofDocument(booking.proofPath as string, `Booking #${booking.id} — ${lang === "ne" ? "भुक्तानीको प्रमाण" : "payment proof"}`, lang)} className="mt-3 block w-full">
                              <img src={booking.proofPath} alt="Booking proof" className="max-h-56 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain p-2" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openBooking(booking)}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            {lang === "ne" ? "स्लिप हेर्नुहोस् / छाप्नुहोस्" : "View / print slip"}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">
                        {dict.noBookings}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "payments" && (
                  <div className="space-y-3">
                    {customer.payments?.length > 0 ? (
                      customer.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className={`rounded-lg border p-4 ${payment.voidedAt ? "border-slate-200 bg-slate-50" : "border-gray-200"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${payment.voidedAt ? "text-slate-500 line-through" : "text-gray-900"}`}>
                                {payment.method}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(payment.date).toLocaleString()}
                              </p>
                            </div>
                            <p className={`font-bold ${payment.voidedAt ? "text-slate-400 line-through" : "text-green-600"}`}>
                              +Rs. {payment.amount.toLocaleString()}
                            </p>
                          </div>
                          {payment.referenceNote ? <p className="mt-2 text-sm text-gray-600">{payment.referenceNote}</p> : null}
                          {payment.voidedAt ? (
                            <p className="mt-2 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                              {lang === "ne" ? "रद्द गरिएको" : "VOIDED"}
                              {payment.voidReason ? ` — ${payment.voidReason}` : ""}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openPayment(payment)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              {lang === "ne" ? "रसिद हेर्नुहोस् / छाप्नुहोस्" : "View / print receipt"}
                            </button>
                            {payment.voidedAt ? null : (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidReason("");
                                  setVoidTarget({
                                    kind: "payments",
                                    id: payment.id,
                                    label: lang === "ne" ? "भुक्तानी" : "payment",
                                    amount: payment.amount,
                                  });
                                }}
                                disabled={voidBusyId === payment.id}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                              >
                                {lang === "ne" ? "गलत रकम? रद्द गर्नुहोस्" : "Wrong amount? Void this payment"}
                              </button>
                            )}
                          </div>
                          {payment.proofPath ? (
                            <button type="button" onClick={() => openProofDocument(payment.proofPath as string, `${lang === "ne" ? "भुक्तानीको प्रमाण" : "Payment proof"} — Rs. ${payment.amount.toLocaleString()}`, lang, new Date(payment.date).toLocaleString())} className="mt-3 block w-full">
                              <img src={payment.proofPath} alt="Payment proof" className="max-h-56 w-full rounded-xl border border-gray-200 bg-gray-50 object-contain p-2" />
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">
                        {dict.noPayments}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "ledger" && (
                  <div className="space-y-3">
                    {(customer.ledgerEntries?.length ?? 0) > 0 ? (
                      customer.ledgerEntries?.map((entry, i) => (
                        <div
                          key={i}
                          className={`border rounded-lg p-4 flex items-start justify-between ${
                            entry.type === "credit"
                              ? "border-green-200 bg-green-50"
                              : "border-orange-200 bg-orange-50"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {entry.type === "credit" ? (
                                <ArrowDown className="h-4 w-4 text-green-600" />
                              ) : (
                                <ArrowUp className="h-4 w-4 text-orange-600" />
                              )}
                              <p className="font-semibold text-gray-900">
                                {entry.reason}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(entry.date).toLocaleString()}
                            </p>
                          </div>
                          <p
                            className={`font-bold text-lg ${
                              entry.type === "credit"
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            {entry.type === "credit" ? "+" : "-"}Rs.{" "}
                            {entry.amount.toLocaleString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-gray-500">
                        {lang === "ne" ? "कुनै इतिहास छैन" : "No history yet"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <p className="text-gray-500">
                {lang === "ne" ? "ग्राहक डेटा लोड गर्न सकेन" : "Could not load customer data"}
              </p>
            </div>
          )}
        </motion.div>

        {voidTarget ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => (voidBusyId ? null : setVoidTarget(null))}
          >
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900">
                {voidTarget.kind === "invoices"
                  ? (lang === "ne" ? "यो बिल रद्द गर्ने?" : "Void this bill?")
                  : (lang === "ne" ? "यो भुक्तानी रद्द गर्ने?" : "Void this payment?")}
              </h3>
              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                {voidTarget.label} — Rs. {Number(voidTarget.amount || 0).toLocaleString()}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {voidTarget.kind === "invoices"
                  ? (lang === "ne"
                      ? "सामान स्टकमा फर्किन्छ, उधारो हिसाब मिल्छ र यसबाट पाएको अंक फिर्ता हुन्छ। बिल मेटिँदैन — रद्द भएको देखिन्छ।"
                      : "Stock goes back, the udharo balance is corrected, and points from this bill are taken back. The bill is not deleted — it stays visible, marked voided.")
                  : (lang === "ne"
                      ? "ग्राहकको उधारो यो रकमले बढ्नेछ। रेकर्ड मेटिँदैन — रद्द भएको देखिन्छ।"
                      : "The customer's udharo will go up by this amount. The record is not deleted — it stays visible, marked voided.")}
              </p>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                {lang === "ne" ? "किन रद्द गर्दै हुनुहुन्छ?" : "Why are you voiding it?"}
              </label>
              <input
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={lang === "ne" ? "जस्तै: गलत ग्राहकलाई हालियो" : "e.g. entered for the wrong customer"}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                {lang === "ne" ? "यो कारण रेकर्डमा सधैं देखिन्छ।" : "This reason stays on the record permanently."}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  disabled={voidBusyId !== null}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  {lang === "ne" ? "पर्दैन" : "Keep it"}
                </button>
                <button
                  type="button"
                  onClick={confirmVoid}
                  disabled={voidBusyId !== null || !voidReason.trim()}
                  className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {voidBusyId !== null
                    ? (lang === "ne" ? "रद्द गर्दै..." : "Voiding...")
                    : (lang === "ne" ? "हो, रद्द गर्नुहोस्" : "Yes, void it")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
