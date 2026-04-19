import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language";
import { ArrowLeft, Calendar, CheckCircle2, Home, MapPin, Tractor, Truck, XCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function BookService() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formData, setFormData] = useState({
    serviceType: "jeep" as "jeep" | "tractor",
    customerName: "",
    customerPhone: "",
    pickupLocation: "",
    destination: "",
    bookingDate: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      const dateObj = new Date(formData.bookingDate);
      if (isNaN(dateObj.getTime())) {
        setFeedback({ type: "error", message: t.book.invalidDate });
        return;
      }
      setIsPending(true);
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, bookingDate: dateObj.toISOString() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t.book.failedMsg);
      setIsSuccess(true);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : t.book.failedMsg });
    } finally {
      setIsPending(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-32 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">{t.book.successTitle}</h1>
        <p className="text-xl text-muted-foreground mb-8">{t.book.successDesc}</p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setFeedback(null);
            setFormData({
              serviceType: formData.serviceType,
              customerName: "",
              customerPhone: "",
              pickupLocation: "",
              destination: "",
              bookingDate: "",
              notes: "",
            });
          }}
          className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          {t.book.bookAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <Home className="h-4 w-4" />
          Home
        </button>
      </div>
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">{t.book.title}</h1>
        <p className="text-lg text-muted-foreground">{t.book.subtitle}</p>
      </div>

      <div className="bg-card p-6 sm:p-10 rounded-3xl shadow-xl border border-border/60">
        <form onSubmit={handleSubmit} className="space-y-8">
          {feedback ? (
            <div
              className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          ) : null}

          {/* Service Type */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-4">{t.book.selectService}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`relative cursor-pointer rounded-2xl border-2 p-6 flex flex-col items-center text-center transition-all ${
                formData.serviceType === 'jeep'
                  ? 'border-primary bg-primary/5 text-primary shadow-md'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/50'
              }`}>
                <input type="radio" name="serviceType" value="jeep" className="sr-only"
                  checked={formData.serviceType === 'jeep'}
                  onChange={() => setFormData({...formData, serviceType: 'jeep'})} />
                <Truck className="w-12 h-12 mb-3" />
                <span className="font-bold text-lg mb-1 text-foreground">{t.book.cargoJeep}</span>
                <span className="text-sm opacity-80">{t.book.cargoJeepDesc}</span>
                {formData.serviceType === 'jeep' && (
                  <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </label>

              <label className={`relative cursor-pointer rounded-2xl border-2 p-6 flex flex-col items-center text-center transition-all ${
                formData.serviceType === 'tractor'
                  ? 'border-primary bg-primary/5 text-primary shadow-md'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/50'
              }`}>
                <input type="radio" name="serviceType" value="tractor" className="sr-only"
                  checked={formData.serviceType === 'tractor'}
                  onChange={() => setFormData({...formData, serviceType: 'tractor'})} />
                <Tractor className="w-12 h-12 mb-3" />
                <span className="font-bold text-lg mb-1 text-foreground">{t.book.heavyTractor}</span>
                <span className="text-sm opacity-80">{t.book.heavyTractorDesc}</span>
                {formData.serviceType === 'tractor' && (
                  <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">{t.book.yourName}</label>
              <input required type="text" value={formData.customerName}
                onChange={e => setFormData({...formData, customerName: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">{t.book.contactNumber}</label>
              <input required type="tel" value={formData.customerPhone}
                onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" /> {t.book.pickupLocation}
              </label>
              <input required type="text" value={formData.pickupLocation}
                onChange={e => setFormData({...formData, pickupLocation: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> {t.book.destination}
              </label>
              <input required type="text" value={formData.destination}
                onChange={e => setFormData({...formData, destination: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" /> {t.book.preferredDate}
            </label>
            <input required type="date" value={formData.bookingDate}
              onChange={e => setFormData({...formData, bookingDate: e.target.value})}
              min={new Date().toISOString().split('T')[0]}
              className="w-full sm:w-1/2 px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2">{t.book.notes}</label>
            <textarea rows={3} value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder={t.book.notesPlaceholder}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none" />
          </div>

          <button type="submit" disabled={isPending}
            className="w-full py-5 bg-primary text-primary-foreground font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3"
          >
            {isPending ? t.book.sending : t.book.requestBooking}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {t.book.paymentNote}
          </p>
        </form>
      </div>
    </div>
  );
}
