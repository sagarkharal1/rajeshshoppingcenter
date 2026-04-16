import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, PackageCheck, PhoneCall, Search } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { formatNPR } from "@/lib/utils";
import { GaneshBlessing } from "@/components/ganesh-blessing";
import { NepalDateTime } from "@/components/nepal-date-time";
import { formatNepalDateTime } from "@/lib/nepal-time";

type TrackOrderResponse = {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: "paid" | "unpaid";
  status: "order-received" | "preparing" | "dispatched" | "delivered" | "cancelled";
  notes?: string | null;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
};

const NEPALI_WARNING =
  "भुक्तानी गर्नु अघि कृपया फोन गरेर भुक्तानी प्राप्त गर्ने नाम वा युजरनेम पुष्टि गर्नुहोस्। QR कोड वा भुक्तानी विवरण परिवर्तन भएको हुन सक्छ। सुरक्षित भुक्तानीका लागि पहिले पुष्टि गर्नुहोस्।";

const LABELS = {
  en: {
    title: "Track your order",
    id: "Order number",
    phone: "Phone number",
    search: "Track order",
    back: "Back to checkout",
    notFound: "Order not found or phone number did not match.",
    items: "Items",
    orderStatus: "Order status",
    paymentStatus: "Payment status",
    total: "Total",
    call: "Call shop",
    placedAt: "Placed at",
  },
  ne: {
    title: "अर्डर ट्र्याक गर्नुहोस्",
    id: "अर्डर नम्बर",
    phone: "फोन नम्बर",
    search: "अर्डर हेर्नुहोस्",
    back: "चेकआउटमा फर्कनुहोस्",
    notFound: "अर्डर फेला परेन वा फोन नम्बर मिलेन।",
    items: "सामानहरू",
    orderStatus: "अर्डर स्थिति",
    paymentStatus: "भुक्तानी स्थिति",
    total: "जम्मा",
    call: "पसलमा फोन गर्नुहोस्",
    placedAt: "अर्डर राखिएको समय",
  },
} as const;

function humanizeOrderStatus(status: TrackOrderResponse["status"], lang: "en" | "ne") {
  const map = {
    "order-received": { en: "Order received", ne: "अर्डर प्राप्त भयो" },
    preparing: { en: "Preparing", ne: "तयारी हुँदैछ" },
    dispatched: { en: "Dispatched", ne: "पठाइएको छ" },
    delivered: { en: "Delivered", ne: "डेलिभर भयो" },
    cancelled: { en: "Cancelled", ne: "रद्द भयो" },
  } as const;
  return map[status]?.[lang] ?? status;
}

function humanizePaymentStatus(status: TrackOrderResponse["paymentStatus"], lang: "en" | "ne") {
  const map = {
    unpaid: { en: "Payment pending", ne: "भुक्तानी बाँकी" },
    paid: { en: "Payment completed", ne: "भुक्तानी पूरा भयो" },
  } as const;
  return map[status]?.[lang] ?? status;
}

export default function TrackOrderModern() {
  const { lang } = useLanguage();
  const currentLang = lang === "ne" ? "ne" : "en";
  const labels = LABELS[currentLang];
  const [location, setLocation] = useLocation();
  const query = new URLSearchParams(location.split("?")[1] || "");
  const [orderId, setOrderId] = useState(query.get("id") || "");
  const [phone, setPhone] = useState(query.get("phone") || "");
  const [result, setResult] = useState<TrackOrderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrack = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!orderId || !phone) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/track?phone=${encodeURIComponent(phone)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || labels.notFound);
      }
      setResult(body);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : labels.notFound);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query.get("id") && query.get("phone")) {
      handleTrack().catch?.(() => {});
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center text-sm text-muted-foreground mb-10 font-bold">
        <span className="cursor-pointer hover:text-primary" onClick={() => setLocation("/checkout")}>{labels.back}</span>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-foreground">{labels.title}</span>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <GaneshBlessing compact />
          <NepalDateTime lang={currentLang} compact />
        </div>
        <div className="flex items-center gap-3">
          <PackageCheck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-foreground">{labels.title}</h1>
        </div>

        <form onSubmit={handleTrack} className="mt-6 grid gap-4 md:grid-cols-[1fr,1fr,auto]">
          <input className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={labels.id} />
          <input className="rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={labels.phone} />
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">
            <Search className="h-4 w-4" />
            {loading ? "..." : labels.search}
          </button>
        </form>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        {result ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">{NEPALI_WARNING}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.orderStatus}</p>
                <p className="mt-2 font-bold text-foreground">{humanizeOrderStatus(result.status, currentLang)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.paymentStatus}</p>
                <p className="mt-2 font-bold text-foreground">{humanizePaymentStatus(result.paymentStatus, currentLang)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.total}</p>
                <p className="mt-2 font-bold text-foreground">{formatNPR(result.totalAmount)}</p>
                <p className="mt-2 text-sm text-muted-foreground">#{result.id}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.placedAt}</p>
              <p className="mt-2 font-semibold text-foreground">{formatNepalDateTime(result.createdAt, currentLang)}</p>
            </div>

            <div className="rounded-2xl border border-border p-5">
              <h2 className="text-xl font-bold text-foreground">{labels.items}</h2>
              <div className="mt-4 space-y-3">
                {result.items.map((item, index) => (
                  <div key={`${item.productName}-${index}`} className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{item.productName}</p>
                      <p className="text-muted-foreground">{item.quantity} {item.unit || "pc"}</p>
                    </div>
                    <div className="font-semibold text-foreground">{formatNPR(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            <a href="tel:+9779814401716" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-accent-foreground">
              <PhoneCall className="h-4 w-4" />
              {labels.call}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
