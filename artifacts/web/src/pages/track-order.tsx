import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language";
import { formatNPR } from "@/lib/utils";
import { ChevronRight, PackageCheck, PhoneCall, Search } from "lucide-react";

type TrackOrderResponse = {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  paymentStatus: string;
  items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
};

export default function TrackOrderPage() {
  const { lang } = useLanguage();
  const [location, setLocation] = useLocation();
  const query = new URLSearchParams(location.split("?")[1] || "");
  const initialId = query.get("id") || "";
  const initialPhone = query.get("phone") || "";
  const [orderId, setOrderId] = useState(initialId);
  const [phone, setPhone] = useState(initialPhone);
  const [result, setResult] = useState<TrackOrderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const labels =
    lang === "ne"
      ? {
          title: "अर्डर ट्र्याक गर्नुहोस्",
          id: "अर्डर नम्बर",
          phone: "फोन नम्बर",
          search: "ट्र्याक गर्नुहोस्",
          back: "कार्टमा फर्कनुहोस्",
          pending: "तपाईंको अर्डर प्राप्त भएको छ। पसलले चाँडै पुष्टि गर्नेछ।",
          processing: "अर्डर तयार हुँदैछ वा प्रक्रिया भइरहेको छ।",
          delivered: "अर्डर डेलिभरी / पूरा भएको छ।",
          cancelled: "अर्डर रद्द गरिएको छ।",
          paymentWarn: "भुक्तानी गर्नु अघि फोन गरेर QR वा खाताको नाम पक्का गर्नुहोस्।",
          status: "स्थिति",
          payment: "भुक्तानी",
          total: "जम्मा",
          items: "सामानहरू",
          call: "फोन गर्नुहोस्",
          notFound: "अर्डर फेला परेन वा फोन नम्बर मिलेन।",
        }
      : {
          title: "Track your order",
          id: "Order number",
          phone: "Phone number",
          search: "Track order",
          back: "Back to cart",
          pending: "Your order has been received. The shop will confirm it soon.",
          processing: "Your order is being prepared or processed.",
          delivered: "Your order has been delivered / completed.",
          cancelled: "This order was cancelled.",
          paymentWarn: "Please call and confirm the QR or account name before making payment.",
          status: "Status",
          payment: "Payment",
          total: "Total",
          items: "Items",
          call: "Call shop",
          notFound: "Order not found or phone number did not match.",
        };

  const statusText = (status: string) => {
    if (status === "processing" || status === "confirmed") return labels.processing;
    if (status === "delivered") return labels.delivered;
    if (status === "cancelled") return labels.cancelled;
    return labels.pending;
  };

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
    if (initialId && initialPhone) {
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
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">{labels.paymentWarn}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.status}</p>
                <p className="mt-2 font-bold capitalize text-foreground">{result.status}</p>
                <p className="mt-2 text-sm text-muted-foreground">{statusText(result.status)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.payment}</p>
                <p className="mt-2 font-bold capitalize text-foreground">{result.paymentMethod}</p>
                <p className="mt-2 text-sm text-muted-foreground">{result.paymentStatus}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{labels.total}</p>
                <p className="mt-2 font-bold text-foreground">{formatNPR(result.totalAmount)}</p>
                <p className="mt-2 text-sm text-muted-foreground">#{result.id}</p>
              </div>
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
