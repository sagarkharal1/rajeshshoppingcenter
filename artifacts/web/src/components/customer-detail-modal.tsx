"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Download, ArrowUp, ArrowDown, Phone, MapPin, Gift } from "lucide-react";

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
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  date: string;
  referenceNote?: string;
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
}

const labels = {
  en: {
    title: "Customer Details",
    close: "Close",
    orders: "Orders",
    bookings: "Bookings",
    payments: "Payments",
    creditHistory: "Credit History",
    totalSpent: "Total Spent",
    rewardPoints: "Reward Points",
    creditBalance: "Credit Balance",
    noOrders: "No orders yet",
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
  ne: {
    title: "ग्राहकको विवरण",
    close: "बन्द गर्नुहोस्",
    orders: "अर्डर",
    bookings: "बुकिङ",
    payments: "भुक्तानी",
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
}: CustomerDetailModalProps) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "bookings" | "payments" | "ledger">(
    "orders"
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const dict = labels[lang];

  useEffect(() => {
    if (!isOpen || !customerId) return;

    const fetchCustomerData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/customers/${customerId}/full-profile`);
        if (response.ok) {
          const data = await response.json();
          setCustomer(data);
        }
      } catch (err) {
        console.error("Failed to fetch customer data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [isOpen, customerId]);

  if (!isOpen) return null;

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
          className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl"
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

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-1 flex-wrap">
                  {(
                    [
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
                                Order #{order.id}
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
                                  <button className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2">
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
                          className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {payment.method}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.date).toLocaleString()}
                            </p>
                          </div>
                          <p className="font-bold text-green-600">
                            +Rs. {payment.amount.toLocaleString()}
                          </p>
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
                    {customer.ledgerEntries?.length > 0 ? (
                      customer.ledgerEntries.map((entry, i) => (
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
      </motion.div>
    </AnimatePresence>
  );
}
