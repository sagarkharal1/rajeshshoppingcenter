"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle } from "lucide-react";
import { AuditLogViewer } from "@/components/audit-log-viewer";

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  onSave?: () => void;
  lang?: "en" | "ne";
  api?: (url: string, opts?: any) => Promise<any>;
}

const labels = {
  en: {
    title: "Edit Order",
    close: "Close",
    save: "Save Changes",
    cancel: "Cancel",
    customerPhone: "Customer Phone",
    customerEmail: "Email",
    deliveryAddress: "Delivery Address",
    notes: "Order Notes",
    paymentMethod: "Payment Method",
    paymentStatus: "Payment Status",
    amount: "Amount",
    loading: "Loading...",
    error: "Error loading order",
    saving: "Saving...",
    success: "Order updated successfully",
    warning: "Changes will be recorded in audit log",
  },
  ne: {
    title: "अर्डर सम्पादन गर्नुहोस्",
    close: "बन्द गर्नुहोस्",
    save: "परिवर्तन सेभ गर्नुहोस्",
    cancel: "रद्द गर्नुहोस्",
    customerPhone: "ग्राहक फोन",
    customerEmail: "ईमेल",
    deliveryAddress: "डेलिभरी ठेगाना",
    notes: "अर्डर नोट",
    paymentMethod: "भुक्तानी विधि",
    paymentStatus: "भुक्तानी स्थिति",
    amount: "रकम",
    loading: "लोड हुँदैछ...",
    error: "अर्डर लोड गर्न सकिएन",
    saving: "सेभ हुँदैछ...",
    success: "अर्डर अपडेट भयो",
    warning: "परिवर्तनहरू अडिट लगमा रेकर्ड गरिनेछ",
  },
};

export function EditOrderModal({
  isOpen,
  onClose,
  orderId,
  onSave,
  lang = "en",
  api,
}: OrderEditModalProps) {
  const dict = labels[lang];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<any>(null);

  const [formData, setFormData] = useState({
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    notes: "",
    paymentMethod: "cash",
    paymentStatus: "unpaid",
    amountPaid: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      try {
        const data = api
          ? await api(`/admin/orders/${orderId}`)
          : await fetch(`/api/admin/orders/${orderId}`).then((response) => {
              if (!response.ok) throw new Error("Failed to load order");
              return response.json();
            });
        setOrder(data);
        setFormData({
          customerPhone: data.customerPhone || "",
          customerEmail: data.customerEmail || "",
          deliveryAddress: data.customerAddress || "",
          notes: data.notes || "",
          paymentMethod: data.paymentMethod || "cash",
          paymentStatus: data.paymentStatus || "unpaid",
          amountPaid: String(Number(data.amountPaid ?? 0) || ""),
        });
      } catch (err) {
        console.error("Failed to fetch order:", err);
        setError(dict.error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [isOpen, orderId, dict.error]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (api) {
        await api(`/admin/orders/${orderId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error("Failed to save order");
      }
      onSave?.();
      onClose();
    } catch (err) {
      console.error("Failed to save order:", err);
      setError("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

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
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-blue-50 px-6 py-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {dict.title} #{orderId}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-500" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : order ? (
            <div className="p-6 space-y-6">
              {/* Warning */}
              <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{dict.warning}</p>
              </div>

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Order ID</p>
                <p className="text-lg font-semibold text-gray-900">#{order.id}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.customerPhone}
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customerPhone: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.customerEmail}
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customerEmail: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.deliveryAddress}
                  </label>
                  <textarea
                    value={formData.deliveryAddress}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        deliveryAddress: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.notes}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {dict.paymentMethod}
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="cash">
                        {lang === "ne" ? "नगद" : "Cash"}
                      </option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                      <option value="bank">
                        {lang === "ne" ? "बैंक" : "Bank"}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {dict.paymentStatus}
                    </label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(e) => {
                        const status = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          paymentStatus: status,
                          // Keep the amount box in step with a quick toggle.
                          amountPaid:
                            status === "paid"
                              ? String(Number(order?.totalAmount ?? 0))
                              : status === "unpaid"
                                ? ""
                                : prev.amountPaid,
                        }));
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="unpaid">
                        {lang === "ne" ? "भुक्तानी बाँकी" : "Unpaid"}
                      </option>
                      <option value="partial">
                        {lang === "ne" ? "आधा/केही तिरेको" : "Partially paid"}
                      </option>
                      <option value="paid">
                        {lang === "ne" ? "भुक्तानी भयो" : "Paid"}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {lang === "ne" ? "हालसम्म बुझेको रकम (रु)" : "Amount received so far (NPR)"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={Number(order?.totalAmount ?? 0) || undefined}
                    value={formData.amountPaid}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const total = Number(order?.totalAmount ?? 0);
                      const amount = Number(raw);
                      setFormData((prev) => ({
                        ...prev,
                        amountPaid: raw,
                        // Typing an amount is what decides the status —
                        // the server derives the same way.
                        paymentStatus:
                          raw === "" || amount <= 0
                            ? "unpaid"
                            : amount >= total && total > 0
                              ? "paid"
                              : "partial",
                      }));
                    }}
                    placeholder={lang === "ne" ? "जस्तै 500" : "e.g. 500"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {(() => {
                    const total = Number(order?.totalAmount ?? 0);
                    const amount = Number(formData.amountPaid || 0);
                    const due = Math.max(total - amount, 0);
                    if (!total) return null;
                    return (
                      <p className={`mt-2 text-sm font-semibold ${due > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {due > 0
                          ? (lang === "ne"
                              ? `बाँकी: रु ${due.toLocaleString()} (जम्मा रु ${total.toLocaleString()})`
                              : `Remaining due: NPR ${due.toLocaleString()} (of NPR ${total.toLocaleString()})`)
                          : (lang === "ne" ? "पूरा भुक्तानी भयो ✓" : "Fully paid ✓")}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Audit History */}
              <div className="border-t border-gray-200 pt-6">
                <AuditLogViewer
                  entityType="order"
                  entityId={orderId}
                  lang={lang as "en" | "ne"}
                  api={api}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end border-t border-gray-200 pt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  {dict.cancel}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {saving ? dict.saving : dict.save}
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
