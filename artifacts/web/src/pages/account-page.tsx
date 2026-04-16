import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CreditCard, FileDown, History, Search, ShieldCheck, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { formatNPR } from "@/lib/utils";

type CustomerProfileResponse = {
  customer: {
    id: number;
    customerCode: string;
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    photoPath?: string | null;
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

function printVoucher(title: string, lines: string[]) {
  const popup = window.open("", "_blank", "width=760,height=900");
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; }
          .line { margin: 10px 0; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>${title}</h1>
          ${lines.map((line) => `<div class="line">${line}</div>`).join("")}
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function AccountPage() {
  const { lang } = useLanguage();
  const [location] = useLocation();
  const query = new URLSearchParams(location.split("?")[1] || "");
  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);

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
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      {profile ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-primary" />
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
                      <span className="rounded-full bg-slate-200 px-3 py-1.5 text-slate-700">{order.status}</span>
                      <span className={`rounded-full px-3 py-1.5 ${order.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {order.paymentStatus}
                      </span>
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
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                {profile.invoices.map((invoice) => (
                  <article key={invoice.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-slate-500">{formatWhen(invoice.createdAt)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-sm ${invoice.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {invoice.paymentStatus}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-white px-4 py-3">Total: <strong>{formatNPR(invoice.totalAmount)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Paid: <strong>{formatNPR(invoice.amountPaid)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Due: <strong>{formatNPR(invoice.dueAmount)}</strong></div>
                      <div className="rounded-2xl bg-white px-4 py-3">Method: <strong>{invoice.paymentMethod}</strong></div>
                    </div>
                    {invoice.amountPaid > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          printVoucher(text.paymentVoucher, [
                            `Invoice: ${invoice.invoiceNumber}`,
                            `Customer: ${profile.customer.name}`,
                            `Customer code: ${profile.customer.customerCode}`,
                            `Paid amount: ${formatNPR(invoice.amountPaid)}`,
                            `Due amount: ${formatNPR(invoice.dueAmount)}`,
                            `Payment method: ${invoice.paymentMethod}`,
                            `Payment status: ${invoice.paymentStatus}`,
                            `Date: ${formatWhen(invoice.createdAt)}`,
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
