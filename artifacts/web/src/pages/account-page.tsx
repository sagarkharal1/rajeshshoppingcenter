import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Clock3, CreditCard, FileDown, History, Home, Search, ShieldCheck, Truck, UserRound, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { FlashNotice } from "@/components/flash-notice";
import { useGetSettings } from "@workspace/api-client-react";

type CustomerProfileResponse = {
  customer: {
    id: number;
    customerCode: string;
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    rewardPoints: number;
    creditBalance: number;
    totalSpent: number;
  };
  orders: Array<{
    id: number;
    customerCode?: string | null;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    notes?: string | null;
    createdAt: string;
    items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    subtotalAmount: number;
    previousDueAmount: number;
    totalAmount: number;
    amountPaid: number;
    dueAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    note?: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: number;
    invoiceId?: number | null;
    amount: number;
    paymentMethod: string;
    referenceNote?: string | null;
    createdAt: string;
  }>;
  ledger: Array<{
    id: number;
    entryType: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    balanceAfter: number;
    createdAt: string;
  }>;
};

const STORAGE_KEY = "rajesh_customer_portal";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function printInvoice(
  invoice: any,
  customer: any,
  lang: string,
  shop: { name: string; address: string; phone: string; pan?: string },
) {
  const popup = window.open("", "_blank", "width=520,height=720");
  if (!popup) return;

  const itemsHtml = Array.isArray(invoice.items)
    ? invoice.items.map((item: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.productName || item.name}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity} ${item.unit || "pc"}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">NPR ${(Number(item.price) * Number(item.quantity)).toLocaleString()}</td>
      </tr>
    `).join("")
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
<style>
  body { font-family: sans-serif; max-width: 480px; margin: 20px auto; padding: 20px; color: #1e293b; }
  h2 { margin: 0 0 4px; font-size: 20px; }
  .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 12px; }
  .info { font-size: 13px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; }
  td { padding: 8px; font-size: 14px; }
  .summary { background: #f8fafc; padding: 12px; border-radius: 8px; margin: 12px 0; }
  .summary-row { display: flex; justify-content: space-between; margin: 6px 0; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .paid { background: #dcfce7; color: #166534; }
  .due { background: #fef3c7; color: #92400e; }
  @media print { button { display: none; } }
</style>
</head><body>
<div class="header" style="display:flex;align-items:center;gap:14px">
  <!-- Absolute URL: the slip opens in a blank window, where a relative path
       would resolve against about:blank and the logo would never appear. -->
  <img src="${window.location.origin}/rajesh-logo-print.png" alt=""
       style="width:64px;height:64px;object-fit:contain;flex:none"
       onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${window.location.origin}/rajesh-logo.png'}else{this.style.display='none'}">
  <div style="min-width:0">
    <h2>${shop.name}</h2>
    <p class="info">${lang === "ne" ? "काउन्टर बिल / इनभयस" : "Counter Bill / Invoice"}${shop.pan ? " · PAN: " + shop.pan : ""}</p>
    <p class="info" style="margin:2px 0 0">${shop.address}${shop.phone ? " · " + shop.phone : ""}</p>
  </div>
</div>

<p class="info"><strong>Invoice:</strong> ${invoice.invoiceNumber}</p>
<p class="info"><strong>Customer:</strong> ${customer.name} (${customer.customerCode})</p>
<p class="info"><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleString()}</p>

${itemsHtml ? `
<table>
  <thead><tr>
    <th>${lang === "ne" ? "सामान" : "Item"}</th>
    <th>${lang === "ne" ? "परिमाण" : "Qty"}</th>
    <th>${lang === "ne" ? "रकम" : "Amount"}</th>
  </tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
` : ""}

<div class="summary">
  <div class="summary-row">
    <span>${lang === "ne" ? "कुल जम्मा" : "Total"}</span>
    <strong>NPR ${Number(invoice.totalAmount).toLocaleString()}</strong>
  </div>
  <div class="summary-row">
    <span>${lang === "ne" ? "तिरेको" : "Paid"}</span>
    <strong>NPR ${Number(invoice.amountPaid).toLocaleString()}</strong>
  </div>
  <div class="summary-row">
    <span>${lang === "ne" ? "बाँकी" : "Due"}</span>
    <strong style="color: ${Number(invoice.dueAmount) > 0 ? "#b91c1c" : "#16a34a"}">NPR ${Number(invoice.dueAmount).toLocaleString()}</strong>
  </div>
  <p class="info" style="margin-top: 8px; margin-bottom: 0;">
    <strong>${lang === "ne" ? "भुक्तानी तरिका" : "Payment method"}:</strong> ${invoice.paymentMethod}
  </p>
  <span class="badge ${Number(invoice.dueAmount) <= 0 ? "paid" : "due"}">
    ${Number(invoice.dueAmount) <= 0 ? (lang === "ne" ? "✅ पूरा भुक्तानी" : "✅ Fully Paid") : (lang === "ne" ? `📒 बाँकी: NPR ${Number(invoice.dueAmount).toLocaleString()}` : `📒 Due: NPR ${Number(invoice.dueAmount).toLocaleString()}`)}
  </span>
</div>

<button onclick="window.print()" style="margin-top: 16px; width: 100%; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600;">🖨️ Print</button>
</body></html>`;

  popup.document.write(html);
  popup.document.close();
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

function printVoucher(title: string, rows: string[]) {
  const popup = window.open("", "_blank", "width=420,height=640");
  if (!popup) return;

  const rowsHtml = rows
    .filter(Boolean)
    .map((row) => `<li>${escapeHtml(row)}</li>`)
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: sans-serif; max-width: 380px; margin: 20px auto; padding: 20px; color: #1e293b; }
  h2 { margin: 0 0 4px; font-size: 20px; }
  .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
  .info { font-size: 13px; color: #64748b; margin: 4px 0; }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  li { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  li:last-child { border-bottom: none; }
  @media print { button { display: none; } }
</style>
</head><body>
<div class="header">
  <h2>Rajesh Shopping Center</h2>
  <p class="info">${escapeHtml(title)}</p>
</div>
<ul>${rowsHtml}</ul>
<button onclick="window.print()" style="margin-top: 16px; width: 100%; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600;">Print</button>
</body></html>`;

  popup.document.write(html);
  popup.document.close();
}

function getOrderStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "delivered") {
    return {
      label: lang === "ne" ? "सफल डेलिभर" : "Delivered",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
    };
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return {
      label: lang === "ne" ? "रद्द / अस्वीकृत" : "Rejected / Cancelled",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: XCircle,
    };
  }
  if (normalized === "dispatched") {
    return {
      label: lang === "ne" ? "पठाइएको" : "On the way",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      icon: Truck,
    };
  }
  return {
    label: lang === "ne" ? "पुष्टि / तयारी" : "Confirmed / Preparing",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  };
}

function getPaymentStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "confirmed") {
    return {
      label: lang === "ne" ? "भुक्तानी पुष्टि" : "Confirmed",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
    };
  }
  if (normalized === "rejected" || normalized === "failed") {
    return {
      label: lang === "ne" ? "भुक्तानी अस्वीकृत" : "Rejected",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: XCircle,
    };
  }
  return {
    label: lang === "ne" ? "भुक्तानी बाँकी" : "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  };
}

function getSafeOrderStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "delivered") {
    return { label: lang === "ne" ? "\u0921\u0947\u0932\u093f\u092d\u0930 \u092d\u092f\u094b" : "Delivered", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return { label: lang === "ne" ? "\u0930\u0926\u094d\u0926 / \u0905\u0938\u094d\u0935\u0940\u0915\u0943\u0924" : "Rejected / Cancelled", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  if (normalized === "dispatched") {
    return { label: lang === "ne" ? "\u092a\u0920\u093e\u0907\u092f\u094b" : "On the way", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
  }
  return { label: lang === "ne" ? "\u092a\u0941\u0937\u094d\u091f\u093f / \u0924\u092f\u093e\u0930\u0940" : "Confirmed / Preparing", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
}

function getSafePaymentStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "confirmed") {
    return { label: lang === "ne" ? "\u092d\u0941\u0915\u094d\u0924\u093e\u0928\u0940 \u092a\u0941\u0937\u094d\u091f\u093f" : "Confirmed", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "rejected" || normalized === "failed") {
    return { label: lang === "ne" ? "\u092d\u0941\u0915\u094d\u0924\u093e\u0928\u0940 \u0905\u0938\u094d\u0935\u0940\u0915\u0943\u0924" : "Rejected", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  return { label: lang === "ne" ? "\u092d\u0941\u0915\u094d\u0924\u093e\u0928\u0940 \u092c\u093e\u0901\u0915\u0940" : "Pending", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
}

export default function AccountPage() {
  const { lang } = useLanguage();
  const [location, setLocation] = useLocation();
  const query = new URLSearchParams(location.split("?")[1] || "");
  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);
  const { data: shopSettings } = useGetSettings();
  // Letterhead details come from live shop settings, with sensible fallbacks
  // so a slip still prints correctly if that request hasn't finished.
  const shopForPrint = {
    name: (shopSettings as any)?.shopName || "Rajesh Shopping Center",
    address: (shopSettings as any)?.address || "Musikot-5, Aapchaur, Gulmi",
    phone: (shopSettings as any)?.phone || "+9779814401716",
    pan: (shopSettings as any)?.panNumber || "302951817",
  };

  const text = useMemo(
    () =>
      lang === "ne"
        ? {
            title: "मेरो खाता",
            subtitle: "पहिलो अर्डरपछि बनेको ग्राहक प्रोफाइल यहाँ हेर्नुहोस्।",
            code: "ग्राहक कोड",
            phone: "फोन नम्बर",
            open: "खाता खोल्नुहोस्",
            history: "अर्डर इतिहास",
            payments: "भुक्तानी र बाँकी",
            vouchers: "भौचर डाउनलोड",
            reward: "रिवार्ड पोइन्ट",
            spent: "जम्मा खरिद",
            credit: "उधारो बाँकी",
            notFound: "प्रोफाइल भेटिएन। ग्राहक कोड र फोन जाँच गर्नुहोस्।",
            orderVoucher: "अर्डर भौचर",
            paymentVoucher: "भुक्तानी भौचर",
            download: "डाउनलोड / प्रिन्ट",
            secure: "यो खाता ग्राहक कोड र फोन नम्बरले मात्र खुल्छ।",
          }
        : {
            title: "My Account",
            subtitle: "See the customer profile created after the first order.",
            code: "Customer code",
            phone: "Phone number",
            open: "Open account",
            history: "Order history",
            payments: "Payments and credit",
            vouchers: "Download vouchers",
            reward: "Reward points",
            spent: "Total spent",
            credit: "Credit due",
            notFound: "Profile not found. Please check customer code and phone number.",
            orderVoucher: "Order voucher",
            paymentVoucher: "Payment voucher",
            download: "Download / Print",
            secure: "This account opens only with customer code and phone number.",
          },
    [lang],
  );
  const loadProfile = async (codeValue = customerCode, phoneValue = phone) => {
    if (!codeValue || !phoneValue) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/customer-portal/profile?customerCode=${encodeURIComponent(codeValue)}&phone=${encodeURIComponent(phoneValue)}`,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || text.notFound);
      }
      setProfile(body);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ customerCode: codeValue, phone: phoneValue }));
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : text.notFound);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fromQueryCode = query.get("code") || "";
    const fromQueryPhone = query.get("phone") || "";
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    const saved = savedRaw ? JSON.parse(savedRaw) : null;
    const nextCode = fromQueryCode || saved?.customerCode || "";
    const nextPhone = fromQueryPhone || saved?.phone || "";
    if (nextCode) setCustomerCode(nextCode);
    if (nextPhone) setPhone(nextPhone);
    if (nextCode && nextPhone) {
      loadProfile(nextCode, nextPhone).catch?.(() => {});
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Home className="h-4 w-4" />
          {lang === "ne" ? "\u0939\u094b\u092e\u092e\u093e \u092b\u0930\u094d\u0915\u0928\u0941\u0939\u094b\u0938\u094d" : "Back to home"}
        </button>
      </div>
      <div className="rounded-[2rem] bg-primary px-6 py-10 text-primary-foreground">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-accent">{text.title}</p>
        <h1 className="mt-3 font-serif text-4xl font-bold">{text.title}</h1>
        <p className="mt-3 max-w-2xl text-primary-foreground/85">{text.subtitle}</p>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3 text-slate-700">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm">{text.secure}</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadProfile().catch?.(() => {});
          }}
          className="grid gap-4 md:grid-cols-[1fr,1fr,auto]"
        >
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500"
            value={customerCode}
            onChange={(e) => setCustomerCode(e.target.value)}
            placeholder={text.code}
          />
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={text.phone}
          />
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
            <Search className="h-4 w-4" />
            {loading ? "..." : text.open}
          </button>
        </form>
        <FlashNotice message={error || null} type="error" onClose={() => setError("")} />
      </div>

      {profile ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-slate-900">{profile.customer.name}</p>
              </div>
              <p className="mt-3 text-sm text-slate-500">{profile.customer.customerCode}</p>
              <p className="mt-1 text-sm text-slate-500">{profile.customer.phone}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{text.credit}</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{formatNPR(profile.customer.creditBalance)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{text.spent}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNPR(profile.customer.totalSpent)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{text.reward}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{profile.customer.rewardPoints}</p>
            </div>
          </div>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-slate-950">{text.history}</h2>
            </div>
            <div className="space-y-4">
              {profile.orders.map((order) => (
                <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">#{order.id}</p>
                      <p className="text-sm text-slate-500">{formatWhen(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {(() => {
                        const statusMeta = getSafeOrderStatusMeta(order.status, lang === "ne" ? "ne" : "en");
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${statusMeta.className}`}>
                            <statusMeta.icon className="h-4 w-4" />
                            {statusMeta.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const paymentMeta = getSafePaymentStatusMeta(order.paymentStatus, lang === "ne" ? "ne" : "en");
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${paymentMeta.className}`}>
                            <paymentMeta.icon className="h-4 w-4" />
                            {paymentMeta.label}
                          </span>
                        );
                      })()}
                      <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{formatNPR(order.totalAmount)}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${item.productName}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                        <span>{item.productName} ({item.quantity} {item.unit || "pc"})</span>
                        <strong>{formatNPR(item.price * item.quantity)}</strong>
                      </div>
                    ))}
                  </div>
                  {order.paymentStatus === "paid" ? (
                    <button
                      type="button"
                      onClick={() =>
                        printVoucher(text.orderVoucher, [
                          `Order number: #${order.id}`,
                          `Customer: ${profile.customer.name}`,
                          `Customer code: ${profile.customer.customerCode}`,
                          `Phone: ${profile.customer.phone}`,
                          `Amount: ${formatNPR(order.totalAmount)}`,
                          `Payment method: ${order.paymentMethod}`,
                          `Payment status: ${order.paymentStatus}`,
                          `Date: ${formatWhen(order.createdAt)}`,
                        ])
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      <FileDown className="h-4 w-4" />
                      {text.download}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-slate-950">{text.payments}</h2>
            </div>
            <p className="mb-5 text-sm text-slate-500">{lang === "ne" ? "पसलमा गरिएका काउन्टर बिक्री र भुक्तानीहरू" : "Counter sales invoices and payments from the shop"}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                {profile.invoices.map((invoice) => (
                  <article key={invoice.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-slate-500">{formatWhen(invoice.createdAt)}</p>
                      </div>
                      {(() => {
                        const paymentMeta = getSafePaymentStatusMeta(invoice.paymentStatus, lang === "ne" ? "ne" : "en");
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${paymentMeta.className}`}>
                            <paymentMeta.icon className="h-4 w-4" />
                            {paymentMeta.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-white px-4 py-3">Total: <strong>{formatNPR(invoice.totalAmount)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Paid: <strong>{formatNPR(invoice.amountPaid)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Due: <strong>{formatNPR(invoice.dueAmount)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Method: <strong>{invoice.paymentMethod}</strong></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => printInvoice(invoice, profile.customer, lang === "ne" ? "ne" : "en", shopForPrint)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <FileDown className="h-4 w-4" />
                      🖨️ {lang === "ne" ? "बिल प्रिन्ट गर्नुहोस्" : "Print invoice"}
                    </button>
                  </article>
                ))}
              </div>
              <div className="space-y-4">
                {profile.payments.map((payment) => (
                  <article key={payment.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-950">{formatNPR(payment.amount)}</p>
                    <p className="mt-1 text-sm text-slate-500">{payment.paymentMethod}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatWhen(payment.createdAt)}</p>
                    {payment.referenceNote ? <p className="mt-2 text-sm text-slate-600">{payment.referenceNote}</p> : null}
                    <button
                      type="button"
                      onClick={() =>
                        printVoucher(text.paymentVoucher, [
                          `Payment record: #${payment.id}`,
                          `Customer: ${profile.customer.name}`,
                          `Customer code: ${profile.customer.customerCode}`,
                          `Amount: ${formatNPR(payment.amount)}`,
                          `Method: ${payment.paymentMethod}`,
                          `Date: ${formatWhen(payment.createdAt)}`,
                          payment.referenceNote ? `Reference: ${payment.referenceNote}` : "",
                        ].filter(Boolean))}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      <FileDown className="h-4 w-4" />
                      {text.download}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
