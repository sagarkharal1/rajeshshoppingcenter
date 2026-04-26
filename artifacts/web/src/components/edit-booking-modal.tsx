"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle } from "lucide-react";
import { AuditLogViewer } from "@/components/audit-log-viewer";

interface BookingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  onSave?: () => void;
  lang?: "en" | "ne";
}

const labels = {
  en: {
    title: "Edit Booking",
    close: "Close",
    save: "Save Changes",
    cancel: "Cancel",
    customerPhone: "Customer Phone",
    pickupLocation: "Pickup Location",
    destination: "Destination",
    bookingDate: "Booking Date",
    notes: "Notes",
    serviceType: "Service Type",
    chargedAmount: "Charged Amount",
    amountPaid: "Amount Paid",
    paymentMethod: "Payment Method",
    loading: "Loading...",
    error: "Error loading booking",
    saving: "Saving...",
    warning: "Changes will be recorded in audit log",
  },
  ne: {
    title: "बुकिङ सम्पादन गर्नुहोस्",
    close: "बन्द गर्नुहोस्",
    save: "परिवर्तन सेभ गर्नुहोस्",
    cancel: "रद्द गर्नुहोस्",
    customerPhone: "ग्राहक फोन",
    pickupLocation: "पिकअप स्थान",
    destination: "गन्तव्य",
    bookingDate: "बुकिङ मिति",
    notes: "नोट",
    serviceType: "सेवा प्रकार",
    chargedAmount: "शुल्क रकम",
    amountPaid: "भुक्तानी रकम",
    paymentMethod: "भुक्तानी विधि",
    loading: "लोड हुँदैछ...",
    error: "बुकिङ लोड गर्न सकिएन",
    saving: "सेभ हुँदैछ...",
    warning: "परिवर्तनहरू अडिट लगमा रेकर्ड गरिनेछ",
  },
};

export function EditBookingModal({
  isOpen,
  onClose,
  bookingId,
  onSave,
  lang = "en",
}: BookingEditModalProps) {
  const dict = labels[lang];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<any>(null);

  const [formData, setFormData] = useState({
    customerPhone: "",
    pickupLocation: "",
    destination: "",
    bookingDate: "",
    notes: "",
    serviceType: "bolero",
    chargedAmount: 0,
    amountPaid: 0,
    paymentMethod: "cash",
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchBooking = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/bookings/${bookingId}`);
        if (response.ok) {
          const data = await response.json();
          setBooking(data);
          setFormData({
            customerPhone: data.customerPhone || "",
            pickupLocation: data.pickupLocation || "",
            destination: data.destination || "",
            bookingDate: data.bookingDate?.split("T")[0] || "",
            notes: data.notes || "",
            serviceType: data.serviceType || "bolero",
            chargedAmount: Number(data.chargedAmount || 0),
            amountPaid: Number(data.amountPaid || 0),
            paymentMethod: data.paymentMethod || "cash",
          });
        } else {
          setError(dict.error);
        }
      } catch (err) {
        console.error("Failed to fetch booking:", err);
        setError(dict.error);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [isOpen, bookingId, dict.error]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSave?.();
        onClose();
      } else {
        setError("Failed to save booking");
      }
    } catch (err) {
      console.error("Failed to save booking:", err);
      setError("Failed to save booking");
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
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-cyan-50 px-6 py-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {dict.title} #{bookingId}
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
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-cyan-500" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : booking ? (
            <div className="p-6 space-y-6">
              {/* Warning */}
              <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{dict.warning}</p>
              </div>

              {/* Booking Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Booking ID</p>
                <p className="text-lg font-semibold text-gray-900">#{booking.id}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(booking.createdAt).toLocaleString()}
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.serviceType}
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        serviceType: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="bolero">
                      {lang === "ne" ? "बोलेरो/जिप" : "Bolero/Jeep"}
                    </option>
                    <option value="tractor">
                      {lang === "ne" ? "ट्र्याक्टर" : "Tractor"}
                    </option>
                    <option value="telcoline">Tata Telcoline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.pickupLocation}
                  </label>
                  <input
                    type="text"
                    value={formData.pickupLocation}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pickupLocation: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.destination}
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        destination: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {dict.bookingDate}
                  </label>
                  <input
                    type="date"
                    value={formData.bookingDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bookingDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {dict.chargedAmount}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.chargedAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          chargedAmount: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {dict.amountPaid}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.amountPaid}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          amountPaid: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>

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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>

              {/* Audit History */}
              <div className="border-t border-gray-200 pt-6">
                <AuditLogViewer
                  entityType="booking"
                  entityId={bookingId}
                  lang={lang as "en" | "ne"}
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
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition disabled:opacity-50"
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
