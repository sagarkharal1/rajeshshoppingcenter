import { useState } from "react";
import { useEffect, useRef } from "react";
import { BarChart3, Bell, CheckCircle2, Clock3, CreditCard, ExternalLink, Gift, Home, KeyRound, Languages, LoaderCircle, LockKeyhole, PackagePlus, Printer, ReceiptText, RefreshCw, Save, Settings2, ShieldAlert, ShieldCheck, Sparkles, Store, Truck, Upload, Users, XCircle } from "lucide-react";
import { FlashNotice } from "@/components/flash-notice";
import { scanBillImage } from "@/lib/bill-ocr";
import { GlobalSearch } from "@/components/global-search";
import { CustomerDetailModal } from "@/components/customer-detail-modal";
import { TransactionHistory } from "@/components/transaction-history";
import { EditOrderModal } from "@/components/edit-order-modal";
import { EditBookingModal } from "@/components/edit-booking-modal";
import { StockTracker } from "@/components/stock-tracker";
import { PaymentDashboard } from "@/components/payment-dashboard";
import { CreditManager } from "@/components/credit-manager";
import { BusinessSummary } from "@/components/business-summary";
import { DealerRecords } from "@/components/dealer-records";
import { ProofRegister } from "@/components/proof-register";
import { BackupExportPanel } from "@/components/backup-export-panel";

const DEFAULT_SHOP_BANNER = "/shop-banner-default.jpeg";
import { GaneshBlessing } from "@/components/ganesh-blessing";
import { NepalDateTime } from "@/components/nepal-date-time";
import { formatNepalDate, formatNepalDateTime, isSameNepalDay } from "@/lib/nepal-time";
import { paymentMethodLabel } from "@/lib/payment-labels";

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
const when = (value: string) =>
  new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const num = (value: unknown) => Number(value ?? 0);
// Must match the phrase the server checks in POST /admin/factory-reset.
const RESET_PHRASE = "DELETE ALL DATA";

type BillScanState = {
  image: string;
  text: string;
  summary: string[];
  loading: boolean;
  error: string;
  suggestion: {
    amount?: string;
    invoiceNumber?: string;
    phone?: string;
    quantity?: string;
    buyingPrice?: string;
    transportCost?: string;
  };
};

function createBillScanState(): BillScanState {
  return {
    image: "",
    text: "",
    summary: [],
    loading: false,
    error: "",
    suggestion: {},
  };
}

function shortScanText(value: string) {
  if (!value) return "";
  return value.length > 320 ? `${value.slice(0, 320)}...` : value;
}

function findCustomerIdByPhone(customers: any[], phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return 0;
  const matched = customers.find((customer: any) => String(customer.phone || "").replace(/\D/g, "").endsWith(digits.slice(-8)));
  return matched?.id || 0;
}

function shellInput() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
}

function getOwnerOrderStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "delivered") {
    return { label: lang === "ne" ? "डेलिभर भयो" : "Delivered", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "cancelled") {
    return { label: lang === "ne" ? "रद्द" : "Rejected / Cancelled", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  if (normalized === "dispatched") {
    return { label: lang === "ne" ? "पठाइयो" : "Dispatched", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
  }
  if (normalized === "preparing") {
    return { label: lang === "ne" ? "पुष्टि / तयारी" : "Confirmed / Preparing", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
  }
  return { label: lang === "ne" ? "नयाँ अर्डर" : "New order", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
}

function getOwnerPaymentStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") {
    return { label: lang === "ne" ? "भुक्तानी पुष्टि" : "Confirmed", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  return { label: lang === "ne" ? "बाँकी" : "Pending", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
}

function getOwnerBookingStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "delivered") {
    return { label: lang === "ne" ? "सम्पन्न" : "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return { label: lang === "ne" ? "रद्द" : "Rejected", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  if (normalized === "confirmed") {
    return { label: lang === "ne" ? "पुष्टि" : "Confirmed", className: "border-amber-200 bg-amber-50 text-amber-800", icon: CheckCircle2 };
  }
  return { label: lang === "ne" ? "नयाँ बुकिङ" : "New booking", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
}

// ── Print helpers: open a printable slip in a new window ──────────────────
type ShopInfo = { name: string; phone: string; address: string; pan: string };

function printOrderSlip(order: any, lang: string, shop: ShopInfo) {
  const payMethod = order.paymentMethod === "esewa" ? "eSewa" : order.paymentMethod === "khalti" ? "Khalti" : order.paymentMethod === "bank" ? "Bank/QR" : order.paymentMethod === "cash" ? "Cash" : order.paymentMethod || "—";
  const isPaid = order.paymentStatus === "paid";
  const isCredited = !isPaid; // treat non-paid as credit/pending
  const items = (order.items || []).map((item: any) =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${item.productName}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:center">${item.quantity} ${item.unit || "pc"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right">NPR ${(Number(item.price) * Number(item.quantity)).toLocaleString()}</td>
    </tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order #${order.id}</title>
<style>body{font-family:sans-serif;max-width:420px;margin:20px auto;padding:20px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}.badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700}.paid{background:#dcfce7;color:#166534}.credit{background:#fef3c7;color:#92400e}@media print{button{display:none}}</style>
</head><body>
<h2>${shop.name}</h2>
<p style="margin:0;color:#64748b;font-size:13px">${lang === "ne" ? "अनलाइन अर्डर स्लिप" : "Online Order Slip"}${shop.pan ? " · PAN: " + shop.pan : ""}</p>
<p style="margin:2px 0;color:#64748b;font-size:12px">${shop.address}${shop.phone ? " · " + shop.phone : ""}</p>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p><strong>Order #${order.id}</strong> &nbsp;<span style="color:#64748b;font-size:13px">${new Date(order.createdAt).toLocaleString()}</span></p>
<p style="margin:4px 0"><strong>${order.customerName}</strong></p>
<p style="margin:2px 0;color:#64748b;font-size:13px">📞 ${order.customerPhone}</p>
${order.customerAddress ? `<p style="margin:2px 0;color:#64748b;font-size:13px">📍 ${order.customerAddress}</p>` : ""}
${order.customerEmail ? `<p style="margin:2px 0;color:#64748b;font-size:13px">✉ ${order.customerEmail}</p>` : ""}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<table><thead><tr>
  <th style="text-align:left;padding:6px 8px;font-size:12px;color:#64748b;background:#f8fafc">Item</th>
  <th style="text-align:center;padding:6px 8px;font-size:12px;color:#64748b;background:#f8fafc">Qty</th>
  <th style="text-align:right;padding:6px 8px;font-size:12px;color:#64748b;background:#f8fafc">Amount</th>
</tr></thead><tbody>${items}</tbody></table>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<div style="text-align:right">
  <p style="margin:4px 0;font-size:18px;font-weight:700">Total: NPR ${Number(order.totalAmount).toLocaleString()}</p>
  <p style="margin:4px 0;color:#64748b;font-size:13px">Payment method: ${payMethod}</p>
  <span class="badge ${isPaid ? "paid" : "credit"}">${isPaid ? (lang === "ne" ? "✅ भुक्तानी भयो (नगद)" : "✅ Paid — Cash / Digital") : (lang === "ne" ? "📒 उधारो / बाँकी" : "📒 On Credit / Pending")}</span>
</div>
${order.notes ? `<hr style="margin:12px 0;border:1px solid #e2e8f0"><p style="font-size:13px;color:#64748b"><strong>Notes:</strong> ${order.notes}</p>` : ""}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p style="text-align:center;color:#64748b;font-size:12px">${shop.name}${shop.phone ? " · " + shop.phone : ""}${shop.address ? " · " + shop.address : ""}</p>
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ Print</button>
</body></html>`;
  const w = window.open("", "_blank", "width=500,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

function printBookingSlip(booking: any, lang: string, shop: ShopInfo) {
  const serviceLabel = booking.serviceType === "tractor" ? (lang === "ne" ? "ट्र्याक्टर" : "Tractor") : booking.serviceType === "telcoline" ? "Tata Telcoline" : (lang === "ne" ? "बोलेरो / जिप" : "Bolero / Jeep");
  const charged = Number(booking.chargedAmount ?? 0);
  const paid = Number(booking.amountPaid ?? 0);
  const due = Math.max(0, charged - paid);
  const payMethod = booking.paymentMethod || "cash";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking #${booking.id}</title>
<style>body{font-family:sans-serif;max-width:420px;margin:20px auto;padding:20px}h2{margin:0 0 4px}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}.badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700}.paid{background:#dcfce7;color:#166534}.due{background:#fef3c7;color:#92400e}@media print{button{display:none}}</style>
</head><body>
<h2>${shop.name}</h2>
<p style="margin:0;color:#64748b;font-size:13px">${lang === "ne" ? "यातायात बुकिङ स्लिप" : "Transport Booking Slip"}${shop.pan ? " · PAN: " + shop.pan : ""}</p>
<p style="margin:2px 0;color:#64748b;font-size:12px">${shop.address}${shop.phone ? " · " + shop.phone : ""}</p>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p><strong>Booking #${booking.id}</strong> &nbsp;<span style="color:#64748b;font-size:13px">${new Date(booking.bookingDate || booking.createdAt).toLocaleString()}</span></p>
<p style="margin:4px 0"><strong>${booking.customerName}</strong></p>
<p style="margin:2px 0;color:#64748b;font-size:13px">📞 ${booking.customerPhone}</p>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<div class="row"><span style="color:#64748b">${lang === "ne" ? "सेवा" : "Service"}</span><strong>${serviceLabel}</strong></div>
<div class="row"><span style="color:#64748b">${lang === "ne" ? "रुट" : "Route"}</span><strong>${booking.pickupLocation} → ${booking.destination}</strong></div>
<div class="row"><span style="color:#64748b">${lang === "ne" ? "मिति" : "Date"}</span><strong>${new Date(booking.bookingDate || booking.createdAt).toLocaleDateString()}</strong></div>
${booking.notes ? `<div class="row"><span style="color:#64748b">${lang === "ne" ? "नोट" : "Notes"}</span><span>${booking.notes}</span></div>` : ""}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<div class="row"><span>${lang === "ne" ? "कुल शुल्क" : "Total Charged"}</span><strong>NPR ${charged.toLocaleString()}</strong></div>
<div class="row"><span>${lang === "ne" ? "तिरेको" : "Paid"}</span><strong style="color:${due > 0 ? "#b45309" : "#166534"}">NPR ${paid.toLocaleString()}</strong></div>
${due > 0 ? `<div class="row"><span>${lang === "ne" ? "बाँकी" : "Remaining Due"}</span><strong style="color:#b45309">NPR ${due.toLocaleString()}</strong></div>` : ""}
<div style="text-align:right;margin-top:8px">
  <p style="margin:4px 0;color:#64748b;font-size:13px">${lang === "ne" ? "भुक्तानी तरिका" : "Payment method"}: ${payMethod}</p>
  <span class="badge ${due <= 0 ? "paid" : "due"}">${due <= 0 ? (lang === "ne" ? "✅ पूरा भुक्तानी" : "✅ Fully Paid") : (lang === "ne" ? `📒 बाँकी: NPR ${due.toLocaleString()}` : `📒 Due: NPR ${due.toLocaleString()}`)}</span>
</div>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p style="text-align:center;color:#64748b;font-size:12px">${shop.name}${shop.phone ? " · " + shop.phone : ""}${shop.address ? " · " + shop.address : ""}</p>
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ Print</button>
</body></html>`;
  const w = window.open("", "_blank", "width=500,height=660");
  if (w) { w.document.write(html); w.document.close(); }
}

export function OwnerLoginModern({
  shopName,
  text,
  lang,
  login,
  setLogin,
  submitLogin,
  requestLoginOtp,
  forgotMode,
  setForgotMode,
  forgotForm,
  setForgotForm,
  requestPasswordReset,
  resetPassword,
  resetBusy,
  recoveryInfo,
  toggleLanguage,
  setOwnerEntryRequested,
  setError,
  loginOtpInfo,
  totpStep,
  setTotpStep,
  error,
}: any) {
  const identifierRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [allowCredentialsTyping, setAllowCredentialsTyping] = useState(false);

  useEffect(() => {
    setLogin({ identifier: "", password: "", otp: "" });
    setError("");
  }, [setLogin, setError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (identifierRef.current) identifierRef.current.value = "";
      if (passwordRef.current) passwordRef.current.value = "";
      setLogin({ identifier: "", password: "", otp: "" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setLogin]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7efe1_0%,#eadfcd_52%,#e4d4bf_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] bg-[linear-gradient(160deg,#16345f_0%,#24497d_65%,#2f5d97_100%)] p-7 text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] sm:p-10">
          <div className="inline-flex rounded-full bg-amber-100/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a5200]">
            {text.ownerWorkspace}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <img
              src="/rajesh-logo.png"
              alt="Rajesh Shopping Center logo"
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/30"
            />
            <h1 className="text-4xl font-bold leading-tight">{shopName}</h1>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/88">
            {lang === "ne"
              ? "मालिकका लागि सजिलो निजी लगइन। बिल, ग्राहक उधारो, स्टक र सेटिङ सबै मोबाइलमा पनि सजिलै चल्ने गरी राखिएको छ।"
              : "Simple private owner login. Billing, customer credit, stock, and settings are designed to be easy on mobile too."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ReceiptText, title: text.billing },
              { icon: Users, title: text.customers },
              { icon: PackagePlus, title: text.products },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/14 px-4 py-4 ring-1 ring-white/10">
                <item.icon className="h-5 w-5 text-amber-200" />
                <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={forgotMode ? resetPassword : submitLogin} autoComplete="off" className="rounded-[2rem] border border-[#d7c3a0] bg-[#fffdf9] p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.4)] sm:p-8">
          <input type="text" name="fake-owner-name" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
          <input type="password" name="fake-owner-password" autoComplete="current-password" className="hidden" tabIndex={-1} aria-hidden="true" />
          <GaneshBlessing compact centered />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/rajesh-logo.png"
                alt="Rajesh Shopping Center logo"
                className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
              />
              <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">{text.ownerLogin}</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">{shopName}</h2>
              </div>
            </div>
            <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <Languages className="h-3.5 w-3.5" />
              {lang === "ne" ? "EN" : "ने"}
            </button>
          </div>

          {/* ── TOTP step: show only the authenticator code input ── */}
          {totpStep ? (
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 shrink-0 text-indigo-600" />
                  <p className="text-sm font-semibold text-indigo-900">
                    {lang === "ne"
                      ? "Google Authenticator कोड राख्नुहोस्"
                      : "Enter your Google Authenticator code"}
                  </p>
                </div>
                <p className="mt-1 pl-8 text-xs text-indigo-700">
                  {lang === "ne"
                    ? "फोनको Authenticator app खोल्नुस् र ६ अङ्कको कोड राख्नुस्।"
                    : "Open the Authenticator app on your phone and enter the 6-digit code."}
                </p>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {lang === "ne" ? "Authenticator कोड" : "Authenticator code"}
                <input
                  className={shellInput()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={login.otp}
                  onChange={(e) => setLogin((v: any) => ({ ...v, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  autoFocus
                />
              </label>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {text.usernameLabel}
                  <input
                    ref={identifierRef}
                    className={shellInput()}
                    name="shop-access-id"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    spellCheck={false}
                    readOnly={!allowCredentialsTyping}
                    onFocus={() => setAllowCredentialsTyping(true)}
                    value={forgotMode ? forgotForm.identifier : login.identifier}
                    onChange={(e) =>
                      forgotMode
                      ? setForgotForm((v: any) => ({ ...v, identifier: e.target.value }))
                      : setLogin((v: any) => ({ ...v, identifier: e.target.value }))
                  }
                />
              </label>
              {forgotMode ? (
                <>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {lang === "ne" ? "रिसेट कोड" : "Reset code"}
                    <input
                      className={shellInput()}
                      value={forgotForm.otp}
                      onChange={(e) => setForgotForm((v: any) => ({ ...v, otp: e.target.value }))}
                      placeholder={lang === "ne" ? "टेलिग्राममा आएको ६ अङ्कको कोड" : "6-digit code sent to Telegram"}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {lang === "ne" ? "नयाँ पासवर्ड" : "New password"}
                    <input
                      type="password"
                      className={shellInput()}
                      value={forgotForm.newPassword}
                      onChange={(e) => setForgotForm((v: any) => ({ ...v, newPassword: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {lang === "ne" ? "नयाँ पासवर्ड पुनः लेख्नुहोस्" : "Confirm new password"}
                    <input
                      type="password"
                      className={shellInput()}
                      value={forgotForm.confirmPassword}
                      onChange={(e) => setForgotForm((v: any) => ({ ...v, confirmPassword: e.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {text.passwordLabel}
                    <input
                      ref={passwordRef}
                      type="password"
                      className={shellInput()}
                      name="shop-access-key"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      spellCheck={false}
                      readOnly={!allowCredentialsTyping}
                      onFocus={() => setAllowCredentialsTyping(true)}
                      value={login.password}
                      onChange={(e) => setLogin((v: any) => ({ ...v, password: e.target.value }))}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {forgotMode ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-semibold">
                {lang === "ne"
                  ? "पहिले रिसेट कोड माग्नुहोस्, त्यसपछि कोड र नयाँ पासवर्ड राखेर रिसेट गर्नुहोस्।"
                  : "Request a reset code first, then enter the code and your new password."}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {lang === "ne"
                  ? "Telegram मा कोड आउनेछ। कोड सफल भएपछि Google Authenticator स्वतः हटाइनेछ — नयाँ फोनमा फेरि सेटअप गर्न सकिनेछ।"
                  : "The code will arrive on your Telegram. After a successful reset, Google Authenticator is automatically removed — you can re-set it up on your new phone."}
              </p>
              {recoveryInfo?.message ? <p className="mt-2">{recoveryInfo.message}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {totpStep ? (
              <>
                <button className="w-full rounded-2xl bg-indigo-600 px-4 py-4 font-semibold text-white shadow-lg">
                  {lang === "ne" ? "पुष्टि गर्नुहोस्" : "Verify code"}
                </button>
                {/* Lost phone recovery — goes to forgot-password, which clears TOTP once the
                    Telegram-delivered reset code is confirmed. */}
                <button
                  type="button"
                  className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                  onClick={() => {
                    setError("");
                    setTotpStep(false);
                    setForgotMode(true);
                  }}
                >
                  {lang === "ne" ? "📱 फोन हराएको / बिग्रेको? यहाँ क्लिक गर्नुहोस्" : "📱 Lost or damaged your phone? Click here"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                  onClick={() => { setError(""); setTotpStep(false); setLogin((v: any) => ({ ...v, otp: "" })); }}
                >
                  {lang === "ne" ? "← पासवर्डमा फर्कनुहोस्" : "← Back to password"}
                </button>
              </>
            ) : forgotMode ? (
              <>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
                  onClick={requestPasswordReset}
                  disabled={resetBusy}
                >
                  {lang === "ne" ? "रिसेट कोड पठाउनुहोस्" : "Send reset code"}
                </button>
                <button className="w-full rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground shadow-lg" disabled={resetBusy}>
                  {resetBusy ? (lang === "ne" ? "रिसेट हुँदैछ..." : "Resetting...") : (lang === "ne" ? "पासवर्ड रिसेट गर्नुहोस्" : "Reset password")}
                </button>
              </>
            ) : (
              <>
                <button className="w-full rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground shadow-lg">
                  {lang === "ne" ? "लगइन गर्नुहोस्" : "Log in"}
                </button>
              </>
            )}
          </div>
          {!totpStep && (
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
              onClick={() => {
                setError("");
                setForgotMode((current: boolean) => !current);
              }}
            >
              {forgotMode
                ? (lang === "ne" ? "लगइनमा फर्कनुहोस्" : "Back to login")
                : (lang === "ne" ? "पासवर्ड बिर्सनुभयो?" : "Forgot password?")}
            </button>
          )}
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
            onClick={() => {
              setError("");
              setOwnerEntryRequested(false);
            }}
          >
            {lang === "ne" ? "पसलमा फर्कनुहोस्" : "Back to shop"}
          </button>
        </form>
      </div>
      <FlashNotice message={error || null} type="error" onClose={() => setError("")} />
    </div>
  );
}

// ── BookingList: booking cards with per-booking payment form ─────────────────
function BookingList({ bookings, lang, updateBookingStatus, runOwnerAction, confirmOwnerAction, shopInfo, onEditBooking }: {
  bookings: any[];
  lang: string;
  updateBookingStatus: (id: number, status: string, payment?: any) => Promise<void>;
  runOwnerAction: (fn: () => Promise<void>, ok: string, fail: string) => Promise<void>;
  confirmOwnerAction: (
    prompt: { title: string; message: string; confirmLabel: string },
    fn: () => Promise<void>,
    ok: string,
    fail: string,
  ) => void;
  shopInfo: ShopInfo;
  onEditBooking?: (id: number) => void;
}) {
  const [paymentForms, setPaymentForms] = useState<Record<number, { charged: string; paid: string; method: string; proofPath: string }>>({});
  const [showCompletedBookings, setShowCompletedBookings] = useState(false);

  const getForm = (id: number) => paymentForms[id] ?? { charged: "", paid: "", method: "cash", proofPath: "" };
  const setForm = (id: number, patch: Partial<{ charged: string; paid: string; method: string; proofPath: string }>) =>
    setPaymentForms((prev) => ({ ...prev, [id]: { ...getForm(id), ...patch } }));
  const readProof = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read proof image"));
      reader.readAsDataURL(file);
    });

  if (bookings.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{lang === "ne" ? "कुनै बुकिङ छैन।" : "No transport bookings yet."}</p>;
  }

  const isBookingDone = (b: any) => {
    const s = String(b.status || "").toLowerCase();
    return s === "completed" || s === "delivered" || s === "cancelled" || s === "rejected";
  };
  const orderedBookings = bookings.slice().reverse();
  const activeBookings = orderedBookings.filter((b: any) => !isBookingDone(b));
  const completedBookings = orderedBookings.filter(isBookingDone);
  const visibleBookings = showCompletedBookings ? [...activeBookings, ...completedBookings] : activeBookings;

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {visibleBookings.map((booking: any) => {
        const bookingStatus = getOwnerBookingStatusMeta(booking.status, lang === "ne" ? "ne" : "en");
        const bookingLabel = booking.serviceType === "tractor" ? "Tractor" : booking.serviceType === "telcoline" ? "Tata Telcoline" : "Bolero";
        const form = getForm(booking.id);
        const charged = Number(booking.chargedAmount ?? 0);
        const paid = Number(booking.amountPaid ?? 0);
        const isFinanciallySet = charged > 0;
        const isPending = booking.status !== "confirmed" && booking.status !== "completed" && booking.status !== "cancelled";
        const isActive = booking.status !== "cancelled" && booking.status !== "completed";

        return (
          <article key={`booking-${booking.id}`} className="rounded-[1.5rem] border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-950">#{booking.id} {booking.customerName}</p>
                <p className="text-sm font-medium text-amber-700">{bookingLabel} booking</p>
                <p className="text-sm text-slate-500">{booking.customerPhone}</p>
                <p className="text-sm text-slate-500">{booking.pickupLocation} → {booking.destination}</p>
                <p className="mt-1 text-sm text-slate-400">{when(booking.bookingDate || booking.createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${bookingStatus.className}`}>
                  <bookingStatus.icon className="h-4 w-4" />
                  {bookingStatus.label}
                </span>
                {isFinanciallySet ? (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-slate-700">{lang === "ne" ? "शुल्क:" : "Charge:"} {money(charged)}</p>
                    <p className={paid >= charged ? "text-emerald-700 font-bold" : "text-amber-700 font-semibold"}>
                      {lang === "ne" ? "भुक्तानी:" : "Paid:"} {money(paid)}
                      {paid < charged ? ` (${lang === "ne" ? "बाँकी" : "due"}: ${money(charged - paid)})` : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            {booking.notes ? (
              <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">{booking.notes}</div>
            ) : null}

            {/* Payment input panel — shown for active bookings */}
            {isActive ? (
              <div className="mt-4 grid gap-2 rounded-2xl border border-amber-100 bg-white p-3 sm:grid-cols-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{lang === "ne" ? "शुल्क (NPR)" : "Charge (NPR)"}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.charged || (charged > 0 ? String(charged) : "")}
                    onChange={(e) => setForm(booking.id, { charged: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{lang === "ne" ? "तिरेको (NPR)" : "Paid (NPR)"}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.paid || (paid > 0 ? String(paid) : "")}
                    onChange={(e) => setForm(booking.id, { paid: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{lang === "ne" ? "भुक्तानी तरिका" : "Method"}</label>
                  <select
                    value={form.method}
                    onChange={(e) => setForm(booking.id, { method: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {["cash", "esewa", "khalti", "bank", "credit"].map((m) => <option key={m} value={m}>{paymentMethodLabel(m, lang)}</option>)}
                  </select>
                </div>
                <label className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 sm:col-span-3">
                  {lang === "ne" ? "भुक्तानी प्रमाण / भौचर फोटो" : "Payment proof / voucher photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-2 block w-full text-xs"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await readProof(file);
                      setForm(booking.id, { proofPath: dataUrl });
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.proofPath || booking.proofPath ? (
                  <img src={form.proofPath || booking.proofPath} alt="Transport proof" className="max-h-40 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain p-2 sm:col-span-3" />
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {isPending ? (
                <button
                  type="button"
                  disabled={!form.charged || Number(form.charged) <= 0}
                  onClick={() => {
                    const chargedAmt = Number(form.charged) || charged;
                    const paidAmt = Number(form.paid) || 0;
                    runOwnerAction(
                      () => updateBookingStatus(booking.id, "confirmed", { chargedAmount: chargedAmt, amountPaid: paidAmt, paymentMethod: form.method, proofPath: form.proofPath }),
                      lang === "ne" ? "बुकिङ पुष्टि भयो" : "Booking confirmed",
                      lang === "ne" ? "बुकिङ पुष्टि गर्न सकिएन।" : "Could not confirm the booking.",
                    );
                  }}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  title={lang === "ne" ? "शुल्क दर्ता गरेर पुष्टि गर्नुहोस्" : "Enter charge amount first"}
                >
                  {lang === "ne" ? "पुष्टि गर्नुहोस्" : "Confirm"}
                </button>
              ) : null}
              {isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    const chargedAmt = Number(form.charged) || charged;
                    const paidAmt = Number(form.paid) || paid;
                    runOwnerAction(
                      () => updateBookingStatus(booking.id, "completed", { chargedAmount: chargedAmt, amountPaid: paidAmt, paymentMethod: form.method, proofPath: form.proofPath }),
                      lang === "ne" ? "डेलिभर सम्पन्न भयो" : "Marked delivered",
                      lang === "ne" ? "सम्पन्न गर्न सकिएन।" : "Could not complete.",
                    );
                  }}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                >
                  {lang === "ne" ? "डेलिभर भयो" : "Mark delivered"}
                </button>
              ) : null}
              {onEditBooking ? (
                <button
                  type="button"
                  onClick={() => onEditBooking(booking.id)}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  {lang === "ne" ? "सम्पादन" : "Edit"}
                </button>
              ) : null}
              {isActive ? (
                <button
                  type="button"
                  onClick={() => confirmOwnerAction(
                    {
                      title: lang === "ne" ? "बुकिङ रद्द गर्ने?" : "Reject this booking?",
                      message: lang === "ne"
                        ? `${booking.customerName} को ${booking.pickupLocation} → ${booking.destination} बुकिङ रद्द गरिनेछ।`
                        : `${booking.customerName}'s trip ${booking.pickupLocation} → ${booking.destination} will be cancelled.`,
                      confirmLabel: lang === "ne" ? "रद्द गर्नुहोस्" : "Reject booking",
                    },
                    () => updateBookingStatus(booking.id, "cancelled"),
                    lang === "ne" ? "रद्द भयो" : "Rejected",
                    lang === "ne" ? "रद्द गर्न सकिएन।" : "Could not reject.",
                  )}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  {lang === "ne" ? "रद्द" : "Reject"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => printBookingSlip(booking, lang, shopInfo)}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                title={lang === "ne" ? "स्लिप प्रिन्ट" : "Print slip"}
              >
                🖨️ {lang === "ne" ? "स्लिप प्रिन्ट" : "Print slip"}
              </button>
            </div>
          </article>
        );
      })}
      {activeBookings.length === 0 && !showCompletedBookings ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {completedBookings.length > 0
            ? (lang === "ne" ? "हाल कुनै सक्रिय बुकिङ छैन।" : "No active bookings right now.")
            : (lang === "ne" ? "कुनै बुकिङ छैन।" : "No transport bookings yet.")}
        </p>
      ) : null}
      {completedBookings.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowCompletedBookings((v) => !v)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"
        >
          {showCompletedBookings
            ? (lang === "ne" ? `सम्पन्न लुकाउनुहोस् (${completedBookings.length})` : `Hide completed (${completedBookings.length})`)
            : (lang === "ne" ? `सम्पन्न / रद्द हेर्नुहोस् (${completedBookings.length})` : `Show completed / cancelled (${completedBookings.length})`)}
        </button>
      ) : null}
    </div>
  );
}

// ── ReportsTab: daily / monthly / yearly analytics ───────────────────────────
function ReportsTab({ lang, api, token }: { lang: string; api: (url: string, opts?: any) => Promise<any>; token?: string }) {
  const [period, setPeriod] = useState<"day" | "month" | "year">("day");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api(`/admin/analytics?period=${period}&date=${date}`);
      setData(result);
    } catch {
      setError(lang === "ne" ? "रिपोर्ट लोड गर्न सकिएन।" : "Could not load report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period, date]);

  const fmt = (v: number) => money(v);
  const report = data
    ? {
        combined: {
          totalBilled: num(data.combined?.totalBilled ?? data.summary?.totalBilled ?? data.summary?.totalAmount),
          totalCollected: num(data.combined?.totalCollected ?? data.summary?.totalCollected ?? data.summary?.totalPaymentsMade),
          totalCredit: num(data.combined?.totalCredit ?? data.summary?.totalCredit),
        },
        shop: {
          invoiceCount: num(data.shop?.invoiceCount ?? data.summary?.totalInvoices ?? data.summary?.totalOrders),
          totalBilled: num(data.shop?.totalBilled ?? data.summary?.totalInvoiceAmount ?? data.summary?.totalOrderAmount),
          totalCollected: num(data.shop?.totalCollected ?? data.summary?.totalInvoicePaid),
          totalCredit: num(data.shop?.totalCredit ?? data.summary?.totalInvoiceCredit),
        },
        transport: {
          bookingCount: num(data.transport?.bookingCount ?? data.summary?.totalBookings),
          totalBilled: num(data.transport?.totalBilled ?? data.summary?.totalBookingAmount),
          totalCollected: num(data.transport?.totalCollected ?? data.summary?.totalBookingPaid),
          totalCredit: num(data.transport?.totalCredit ?? data.summary?.totalBookingCredit),
        },
        dealer: {
          dealerCount: num(data.dealer?.dealerCount ?? data.summary?.dealerCount),
          totalBilled: num(data.dealer?.totalBilled ?? data.summary?.dealerTotalBilled),
          totalPaid: num(data.dealer?.totalPaid ?? data.summary?.dealerTotalPaid),
          totalDue: num(data.dealer?.totalDue ?? data.summary?.dealerTotalDue),
          currentDue: num(data.dealer?.currentDue ?? data.summary?.dealerCurrentDue),
          returnCount: num(data.dealer?.returnCount ?? data.summary?.dealerReturnCount),
          damagedCount: num(data.dealer?.damagedCount ?? data.summary?.dealerDamagedCount),
          netCreditPosition: num(data.dealer?.netCreditPosition ?? data.summary?.netCreditPosition),
        },
      }
    : null;

  return (
    <section className="space-y-5">
      {/* Period selector */}
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "व्यवसाय रिपोर्ट" : "Business Report"}</h3>
        <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "पसल + ट्रान्सपोर्ट मिलाएर दैनिक/मासिक/वार्षिक हिसाब" : "Combined shop + transport — daily, monthly, or yearly"}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["day", "month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${period === p ? "bg-primary text-primary-foreground" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              {p === "day" ? (lang === "ne" ? "दैनिक" : "Daily") : p === "month" ? (lang === "ne" ? "मासिक" : "Monthly") : (lang === "ne" ? "वार्षिक" : "Yearly")}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {loading ? "..." : (lang === "ne" ? "ताजा गर्नुहोस्" : "Refresh")}
          </button>
        </div>
      </div>

      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}

      {data ? (
        <>
          {/* Combined totals */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: lang === "ne" ? "कुल बिल" : "Total Billed", value: fmt(report?.combined.totalBilled ?? 0), cls: "text-slate-950" },
              { label: lang === "ne" ? "नगद/डिजिटल उठेको" : "Total Collected", value: fmt(report?.combined.totalCollected ?? 0), cls: "text-emerald-700" },
              { label: lang === "ne" ? "बाँकी उधारो" : "Total Credit Due", value: fmt(report?.combined.totalCredit ?? 0), cls: "text-rose-700" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className={`mt-2 text-2xl font-extrabold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
            <h4 className="text-lg font-bold text-slate-950">
              {lang === "ne" ? "उधारो स्थिति" : "Credit Position"}
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: lang === "ne" ? "ग्राहकले हामीलाई दिनुपर्ने" : "Customers owe us", value: fmt(report?.combined.totalCredit ?? 0), cls: "text-emerald-700" },
                { label: lang === "ne" ? "हामीले डिलरलाई दिनुपर्ने" : "We owe dealers", value: fmt(report?.dealer.currentDue ?? 0), cls: "text-rose-700" },
                { label: lang === "ne" ? "नेट स्थिति" : "Net position", value: fmt(report?.dealer.netCreditPosition ?? 0), cls: (report?.dealer.netCreditPosition ?? 0) >= 0 ? "text-blue-700" : "text-rose-700" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shop breakdown */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary text-xs font-bold uppercase">🛒 {lang === "ne" ? "पसल बिक्री" : "Shop Sales"}</span>
              <span className="text-sm font-normal text-slate-400">({report?.shop.invoiceCount ?? 0} {lang === "ne" ? "बिल" : "invoices"})</span>
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: lang === "ne" ? "बिल रकम" : "Billed", value: fmt(report?.shop.totalBilled ?? 0) },
                { label: lang === "ne" ? "उठेको" : "Collected", value: fmt(report?.shop.totalCollected ?? 0), cls: "text-emerald-700" },
                { label: lang === "ne" ? "उधारो" : "Credit", value: fmt(report?.shop.totalCredit ?? 0), cls: "text-rose-700" },
              ].map(({ label, value, cls = "text-slate-950" }) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transport breakdown */}
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/30 p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800 text-xs font-bold uppercase">🚗 {lang === "ne" ? "ट्रान्सपोर्ट" : "Transport"}</span>
              <span className="text-sm font-normal text-slate-400">({report?.transport.bookingCount ?? 0} {lang === "ne" ? "बुकिङ" : "bookings"})</span>
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: lang === "ne" ? "शुल्क रकम" : "Charged", value: fmt(report?.transport.totalBilled ?? 0) },
                { label: lang === "ne" ? "उठेको" : "Collected", value: fmt(report?.transport.totalCollected ?? 0), cls: "text-emerald-700" },
                { label: lang === "ne" ? "उधारो" : "Credit", value: fmt(report?.transport.totalCredit ?? 0), cls: "text-rose-700" },
              ].map(({ label, value, cls = "text-slate-950" }) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            {(report?.transport.totalCredit ?? 0) > 0 ? (
              <p className="mt-3 text-xs text-amber-700">
                ⚠ {lang === "ne" ? `NPR ${(report?.transport.totalCredit ?? 0).toFixed(0)} ट्रान्सपोर्ट शुल्क बाँकी छ।` : `NPR ${(report?.transport.totalCredit ?? 0).toFixed(0)} transport charge is still unpaid.`}
              </p>
            ) : null}
          </div>

          <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/30 p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-800 text-xs font-bold uppercase">
                {lang === "ne" ? "डिलर / साहु" : "Dealers / Creditors"}
              </span>
              <span className="text-sm font-normal text-slate-400">({report?.dealer.dealerCount ?? 0} {lang === "ne" ? "डिलर" : "dealers"})</span>
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              {[
                { label: lang === "ne" ? "खरिद" : "Bought", value: fmt(report?.dealer.totalBilled ?? 0) },
                { label: lang === "ne" ? "तिरेको" : "Paid", value: fmt(report?.dealer.totalPaid ?? 0), cls: "text-emerald-700" },
                { label: lang === "ne" ? "यो अवधिको बाँकी" : "Period due", value: fmt(report?.dealer.totalDue ?? 0), cls: "text-rose-700" },
                { label: lang === "ne" ? "फिर्ता" : "Returns", value: String(report?.dealer.returnCount ?? 0) },
                { label: lang === "ne" ? "ड्यामेज" : "Damaged", value: String(report?.dealer.damagedCount ?? 0), cls: "text-rose-700" },
              ].map(({ label, value, cls = "text-slate-950" }) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {/* Business Summary */}
      <BusinessSummary lang={lang as "en" | "ne"} api={api} />

      {/* Backup and Export */}
      <BackupExportPanel lang={lang as "en" | "ne"} api={api} token={token} />

      {/* Business Proof Register */}
      <ProofRegister lang={lang as "en" | "ne"} api={api} />

      {/* Payment Methods Breakdown */}
      <PaymentDashboard lang={lang as "en" | "ne"} api={api} />

      {/* Transaction History */}
      <TransactionHistory lang={lang as "en" | "ne"} api={api} />
    </section>
  );
}

export function OwnerWorkspaceModern(props: any) {
  const {
    tab, setTab, text, lang, toggleLanguage, shopName, shopAddress, shopPhone,
    summary, orders, bookings, customers, products, categories, preview, invoiceForm, setInvoiceForm, lines, setLines,
    createInvoice, lastInvoice, paymentMethodLabel, paymentForm, setPaymentForm, recordPayment,
    customerForm, setCustomerForm, createCustomer, editingCustomerId, setEditingCustomerId,
    deleteCustomer, startEditCustomer, productForm, setProductForm, createProduct,
    editingProductId, setEditingProductId, startEditProduct, deleteProduct, settingsForm,
    setSettingsForm, saveMediaSettings, settingsBusy, passwordForm, setPasswordForm, passwordBusy, changePassword, readFileAsDataUrl,
    handleSettingsMediaUpload, setToken, setOwnerEntryRequested, updateOrderStatus, confirmOrderPayment, updateBookingStatus,
    externalFeedback, token,
  } = props;

  const currentCustomer = customers.find((item: any) => item.id === invoiceForm.customerId) || null;
  const todayInvoices = (summary?.recentInvoices || []).filter((invoice: any) => isSameNepalDay(invoice.createdAt, new Date()));
  const todaySales = todayInvoices.reduce((sum: number, invoice: any) => sum + num(invoice.amountPaid), 0);
  const todayDue = todayInvoices.reduce((sum: number, invoice: any) => sum + num(invoice.dueAmount), 0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [walkInBusy, setWalkInBusy] = useState(false);
  const [resetForm, setResetForm] = useState({ confirmText: "", password: "" });
  const [resetBusy, setResetBusy] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [purchaseBillScan, setPurchaseBillScan] = useState<BillScanState>(createBillScanState);
  const [customerBillScan, setCustomerBillScan] = useState<BillScanState>(createBillScanState);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [expandedRecentId, setExpandedRecentId] = useState<string | null>(null);
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  useEffect(() => {
    if (!invoiceForm?.proofPath && !paymentForm?.proofPath && customerBillScan.image) {
      setCustomerBillScan(createBillScanState());
    }
  }, [invoiceForm?.proofPath, paymentForm?.proofPath]);

  const filteredCustomers = customers.filter((customer: any) => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return false;
    return [customer.name, customer.phone, customer.customerCode].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const filteredProducts = products.filter((product: any) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return false;
    return [product.name, product.sku, product.categoryName].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const quickCustomers = filteredCustomers.slice(0, 5);
  const quickProducts = filteredProducts.slice(0, 8);
  const newOrders = (orders || []).filter((order: any) => order.status === "order-received");
  const newBookings = (bookings || []).filter((booking: any) => {
    const status = String(booking.status || "").toLowerCase();
    return !status || status === "pending" || status === "requested";
  });
  const newActivityCount = newOrders.length + newBookings.length;
  const shopInfo: ShopInfo = {
    name: shopName || "Rajesh Shopping Center",
    phone: shopPhone || settingsForm?.phone || "+977-9814401716",
    address: shopAddress || settingsForm?.address || "Musikot-5, Gulmi",
    pan: settingsForm?.panNumber || "302951817",
  };

  const showFeedback = (type: "success" | "error", message: string) => {
    setActionFeedback({ type, message });
    window.setTimeout(() => {
      setActionFeedback((current) => (current?.message === message ? null : current));
    }, 3000);
  };

  const runOwnerAction = async (action: () => Promise<any> | any, successMessage: string, failureMessage: string) => {
    try {
      await action();
      showFeedback("success", successMessage);
    } catch (error) {
      const details = error instanceof Error && error.message ? ` ${error.message}` : "";
      showFeedback("error", `${failureMessage}${details}`);
    }
  };

  const runFactoryReset = async () => {
    setResetBusy(true);
    try {
      const result = await props.api("/admin/factory-reset", {
        method: "POST",
        body: JSON.stringify({
          confirmation: resetForm.confirmText.trim(),
          password: resetForm.password,
        }),
      });
      setResetForm({ confirmText: "", password: "" });
      await props.reloadOwnerData?.();
      showFeedback(
        "success",
        result?.backupFile
          ? (lang === "ne"
              ? `सबै डाटा मेटियो। ब्याकअप सुरक्षित छ (${result.backupFile}).`
              : `All data erased. A backup was saved (${result.backupFile}).`)
          : (lang === "ne" ? "सबै डाटा मेटियो।" : "All data erased."),
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error && error.message
          ? error.message
          : lang === "ne" ? "मेटाउन सकिएन।" : "Could not erase the data.",
      );
    } finally {
      setResetBusy(false);
    }
  };

  const requestFactoryReset = () => {
    if (resetForm.confirmText.trim() !== RESET_PHRASE) {
      showFeedback(
        "error",
        lang === "ne" ? `पक्का गर्न "${RESET_PHRASE}" लेख्नुहोस्।` : `Type "${RESET_PHRASE}" exactly to confirm.`,
      );
      return;
    }
    if (!resetForm.password) {
      showFeedback("error", lang === "ne" ? "पासवर्ड लेख्नुहोस्।" : "Enter your admin password.");
      return;
    }
    setConfirmDialog({
      title: lang === "ne" ? "साँच्चै सबै मेटाउने?" : "Erase everything?",
      message:
        lang === "ne"
          ? "सबै ग्राहक, बिल, उधारो, बुकिङ र सामान मेटिनेछ। यो फिर्ता ल्याउन मिल्दैन।"
          : "Every customer, bill, udharo balance, booking and product will be removed. This cannot be undone.",
      confirmLabel: lang === "ne" ? "मेटाउनुहोस्" : "Erase everything",
      onConfirm: async () => {
        setConfirmDialog(null);
        await runFactoryReset();
      },
    });
  };

  // Counter sales to someone who isn't a saved customer reuse one shared
  // walk-in record, so the shopkeeper never has to register a stranger.
  const startWalkInSale = async () => {
    setWalkInBusy(true);
    try {
      const walkIn = await props.api("/admin/customers/walk-in", { method: "POST" });
      setInvoiceForm((v: any) => ({ ...v, customerId: walkIn.id, paymentMethod: "cash" }));
      setCustomerSearch("");
      await props.reloadOwnerData?.();
      showFeedback(
        "success",
        lang === "ne" ? "नगद बिक्री तयार छ — सामान थप्नुहोस्।" : "Cash sale ready — now add the products.",
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error && error.message
          ? error.message
          : lang === "ne" ? "सुरु गर्न सकिएन।" : "Could not start the sale.",
      );
    } finally {
      setWalkInBusy(false);
    }
  };

  // Destructive actions (delete, cancel, reject) route through here so a single
  // mis-tap on a phone can never wipe a record outright.
  const confirmOwnerAction = (
    prompt: { title: string; message: string; confirmLabel: string },
    action: () => Promise<any> | any,
    successMessage: string,
    failureMessage: string,
  ) => {
    setConfirmDialog({
      ...prompt,
      onConfirm: async () => {
        setConfirmDialog(null);
        await runOwnerAction(action, successMessage, failureMessage);
      },
    });
  };

  const runBillScan = async (kind: "purchase" | "customer") => {
    const current = kind === "purchase" ? purchaseBillScan : customerBillScan;
    const setter = kind === "purchase" ? setPurchaseBillScan : setCustomerBillScan;
    if (!current.image) return;
    setter((state) => ({ ...state, loading: true, error: "" }));
    try {
      const result = await scanBillImage(current.image);
      setter((state) => ({
        ...state,
        loading: false,
        text: result.text,
        summary: result.summary,
        suggestion: result.suggestion,
      }));
    } catch (error) {
      setter((state) => ({
        ...state,
        loading: false,
        error: lang === "ne" ? "बिल पढ्न सकेन। फोटो स्पष्ट राखेर फेरि प्रयास गर्नुहोस्।" : "Could not read the bill. Try again with a clearer photo.",
      }));
    }
  };

  const applyCustomerBillScan = () => {
    const suggestion = customerBillScan.suggestion;
    const matchedCustomerId = findCustomerIdByPhone(customers, suggestion.phone);
    setPaymentForm((current: any) => ({
      ...current,
      customerId: matchedCustomerId || current.customerId,
      amount: suggestion.amount || current.amount,
      referenceNote: [current.referenceNote, customerBillScan.text].filter(Boolean).join("\n\n").slice(0, 1200),
    }));
  };

  const applyPurchaseBillScan = () => {
    const suggestion = purchaseBillScan.suggestion;
    setProductForm((current: any) => ({
      ...current,
      sku: current.sku || suggestion.invoiceNumber || "",
      buyingPrice: suggestion.buyingPrice || current.buyingPrice,
      transportationCost: suggestion.transportCost || current.transportationCost,
      stockQuantity: suggestion.quantity || current.stockQuantity,
      description: current.description || shortScanText(purchaseBillScan.text),
    }));
  };

  const nav = [
    { name: "overview", label: text.overview, icon: Home },
    { name: "billing", label: text.billing, icon: ReceiptText },
    { name: "orders", label: lang === "ne" ? "अर्डर" : "Orders", icon: Bell },
    { name: "customers", label: text.customers, icon: Users },
    { name: "products", label: text.products, icon: PackagePlus },
    { name: "reports", label: lang === "ne" ? "रिपोर्ट" : "Reports", icon: BarChart3 },
    { name: "branding", label: text.branding, icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9f1_0%,#f2ebdf_100%)] pb-24">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/rajesh-logo.png"
              alt="Rajesh Shopping Center logo"
              className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">{text.ownerWorkspace}</p>
              <h1 className="truncate text-2xl font-bold text-slate-950">{shopName}</h1>
              <p className="truncate text-xs text-slate-500">{shopAddress}</p>
            </div>
          </div>
          <div className="hidden md:flex flex-1 px-4">
            <div className="w-full max-w-sm">
              <GlobalSearch
                lang={lang as "en" | "ne"}
                onResultClick={(result: any) => {
                  if (result.type === "product") {
                    setTab("products");
                    setProductSearch(result.label);
                  } else if (result.type === "customer") {
                    setTab("customers");
                    setCustomerSearch(result.label);
                    setSelectedCustomerId(Number(result.id));
                  } else if (result.type === "order") {
                    setTab("orders");
                  } else if (result.type === "booking") {
                    setTab("orders");
                  } else if (result.type === "invoice") {
                    setTab("billing");
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <Languages className="h-3.5 w-3.5" />
              {lang === "ne" ? "EN" : "ने"}
            </button>
            <button
              type="button"
              // Re-fetch the data rather than reloading the whole page: a full
              // reload re-downloads the app on a connection that can least
              // afford it, and drops the owner back to the first tab.
              onClick={() => void runOwnerAction(
                async () => { await props.reloadOwnerData?.(); },
                lang === "ne" ? "ताजा भयो।" : "Updated.",
                lang === "ne" ? "ताजा गर्न सकिएन।" : "Could not refresh.",
              )}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              title={lang === "ne" ? "ताजा गर्नुहोस्" : "Refresh data"}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {lang === "ne" ? "ताजा" : "Refresh"}
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => {
                setToken("");
                setOwnerEntryRequested(false);
              }}
            >
              {text.logout}
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 no-scrollbar">
          {nav.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setTab(item.name)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === item.name ? "bg-primary text-primary-foreground" : "bg-white text-slate-700 border border-slate-200"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.name === "orders" && newActivityCount ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === item.name ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
                  {newActivityCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <FlashNotice
          message={(externalFeedback || actionFeedback)?.message ?? null}
          type={(externalFeedback || actionFeedback)?.type ?? "success"}
          onClose={() => setActionFeedback(null)}
        />

        <div className="grid items-center gap-3 overflow-hidden rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8ef_0%,#f4e0ba_100%)] px-4 py-3 shadow-sm lg:grid-cols-[0.9fr_1.3fr_0.9fr]">
          <div className="flex h-12 items-center justify-center rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-3 text-center text-sm font-bold leading-tight text-amber-50 shadow-sm sm:h-14 sm:text-base">
            ॐ श्री गणेशाय नमः
          </div>
          <div className="flex items-center justify-center">
            <img
              src="/ganesh-banner.png"
              alt="Shree Ganesh"
              className="h-14 w-full max-w-[420px] rounded-[1rem] object-cover shadow-sm sm:h-16"
            />
          </div>
          <NepalDateTime lang={lang} compact />
        </div>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-950">{shopName}</h2>
              <p className="truncate text-sm text-slate-500">{shopPhone}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                {lang === "ne" ? "मालिक कार्यस्थल" : "Owner workspace"}
              </span>
              {newActivityCount ? (
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className="rounded-full bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950"
                >
                  {lang === "ne" ? `नयाँ अर्डर / बुकिङ ${newActivityCount}` : `New orders / bookings ${newActivityCount}`}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {tab === "overview" && summary ? (
          <section className="space-y-5">
            <div className="rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff9ef_0%,#f5ead8_100%)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">
                    {lang === "ne" ? "नेपाल आज" : "Today in Nepal"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">{formatNepalDate(new Date(), lang)}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "आजका बिल" : "Bills today"}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{summary.totals.todayShopInvoices ?? todayInvoices.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "🛒 पसल उठेको" : "🛒 Shop collected"}</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-700">{money(summary.totals.todayShopCollected ?? todaySales)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "🚗 ट्रान्सपोर्ट उठेको" : "🚗 Transport collected"}</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-700">{money(summary.totals.todayTransportCollected ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-700">{lang === "ne" ? "💰 आज कुल" : "💰 Today total"}</p>
                    <p className="mt-2 text-xl font-bold text-amber-900">{money(summary.totals.todayCombinedCollected ?? todaySales)}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Online order action banner — only when orders need payment decision */}
            {summary.totals.pendingOnlineOrders > 0 ? (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-[1.5rem] border-2 border-amber-300 bg-amber-50 px-5 py-4 shadow-sm"
                onClick={() => setTab("orders")}
              >
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {lang === "ne"
                      ? `${summary.totals.pendingOnlineOrders} अर्डर भुक्तानी पुष्टि पर्खिरहेको छ`
                      : `${summary.totals.pendingOnlineOrders} online order${summary.totals.pendingOnlineOrders > 1 ? "s" : ""} waiting for payment decision`}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    {lang === "ne" ? "भुक्तानी पुष्टि वा उधारो राख्न यहाँ थिच्नुहोस्" : "Tap to confirm payment or move to credit tab"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-white">
                  {lang === "ne" ? "हेर्नुहोस्" : "View →"}
                </span>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [text.totalProducts, summary.totals.totalProducts, PackagePlus],
                [text.lowStock, summary.totals.lowStockProducts, Store],
                [text.creditDue, money(summary.totals.totalCreditBalance), CreditCard],
                [text.rewardPoints, summary.totals.totalRewardPoints, Gift],
              ].map(([label, value, Icon]: any) => (
                <article key={label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{label}</p>
                      <h3 className="mt-3 text-3xl font-bold text-slate-950">{value}</h3>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3 text-amber-800"><Icon className="h-5 w-5" /></div>
                  </div>
                </article>
              ))}
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">
                    {lang === "ne" ? "उधारो र डिलर स्थिति" : "Credit and Dealer Position"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {lang === "ne" ? "ग्राहकबाट उठाउनुपर्ने र डिलरलाई तिर्नुपर्ने रकम।" : "What customers owe us versus what we owe dealers."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("products")}
                  className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  {lang === "ne" ? "डिलर हेर्नुहोस्" : "View dealers"}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  { label: lang === "ne" ? "ग्राहकले हामीलाई दिनुपर्ने" : "Customers owe us", value: money(summary.totals.totalCreditBalance), cls: "text-emerald-700" },
                  { label: lang === "ne" ? "हामीले डिलरलाई दिनुपर्ने" : "We owe dealers", value: money(summary.totals.dealerTotalDue || 0), cls: "text-rose-700" },
                  { label: lang === "ne" ? "नेट स्थिति" : "Net position", value: money(summary.totals.netCreditPosition || 0), cls: num(summary.totals.netCreditPosition) >= 0 ? "text-blue-700" : "text-rose-700" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className={`mt-2 text-2xl font-extrabold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  {lang === "ne" ? "डिलर" : "Dealers"}: <strong>{summary.totals.dealerCount || 0}</strong>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  {lang === "ne" ? "फिर्ता" : "Returns"}: <strong>{summary.totals.dealerReturnCount || 0}</strong>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  {lang === "ne" ? "ड्यामेज" : "Damaged"}: <strong>{summary.totals.dealerDamagedCount || 0}</strong>
                </div>
              </div>
            </div>
            {/* Online order revenue summary */}
            {summary.totals.totalOnlineOrders > 0 ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">{lang === "ne" ? "कुल अनलाइन अर्डर" : "Total online orders"}</p>
                  <h3 className="mt-3 text-3xl font-bold text-slate-950">{summary.totals.totalOnlineOrders}</h3>
                </article>
                <article className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <p className="text-sm text-amber-700">{lang === "ne" ? "भुक्तानी बाँकी" : "Awaiting payment"}</p>
                  <h3 className="mt-3 text-3xl font-bold text-amber-900">{summary.totals.pendingOnlineOrders}</h3>
                </article>
                <article className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                  <p className="text-sm text-emerald-700">{lang === "ne" ? "पुष्टि भएको अनलाइन आम्दानी" : "Confirmed online revenue"}</p>
                  <h3 className="mt-3 text-2xl font-bold text-emerald-900">{money(summary.totals.confirmedOnlineRevenue)}</h3>
                </article>
              </div>
            ) : null}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.recentInvoices}</h3>
              <p className="mt-1 text-xs text-slate-500">{lang === "ne" ? "विवरण हेर्न क्लिक गर्नुहोस्" : "Click an invoice to see full details"}</p>
              <div className="mt-4 grid gap-3">
                {summary.recentInvoices.map((invoice: any) => {
                  const isOpen = expandedInvoiceId === invoice.id;
                  const total = num(invoice.amountPaid) + num(invoice.dueAmount);
                  return (
                    <div key={invoice.id} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedInvoiceId(isOpen ? null : invoice.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="font-semibold text-slate-950">{invoice.invoiceNumber} {isOpen ? "▾" : "▸"}</p>
                          <p className="text-slate-500">{invoice.customerName}</p>
                          <p className="text-slate-400">{formatNepalDateTime(invoice.createdAt, lang)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.paid} {money(invoice.amountPaid)}</span>
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{text.due} {money(invoice.dueAmount)}</span>
                        </div>
                        <span className="text-slate-500">{when(invoice.createdAt)}</span>
                      </button>
                      {isOpen ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-slate-500">{lang === "ne" ? "ग्राहक" : "Customer"}</p>
                              <p className="font-semibold text-slate-950">{invoice.customerName}</p>
                              {invoice.customerPhone ? <p className="text-slate-500">{invoice.customerPhone}</p> : null}
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wider text-slate-500">{lang === "ne" ? "भुक्तानी तरिका" : "Payment method"}</p>
                              <p className="font-semibold text-slate-950">{invoice.paymentMethod || "—"}</p>
                            </div>
                          </div>
                          {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
                            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                              <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr] bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                                <span>{lang === "ne" ? "सामान" : "Item"}</span>
                                <span>{lang === "ne" ? "परिमाण" : "Qty"}</span>
                                <span>{lang === "ne" ? "दर" : "Rate"}</span>
                                <span className="text-right">{lang === "ne" ? "रकम" : "Amount"}</span>
                              </div>
                              {invoice.items.map((item: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr] border-t border-slate-100 px-3 py-2 text-sm">
                                  <span className="font-medium text-slate-900">{item.productName || item.name}</span>
                                  <span>{item.quantity} {item.unit || ""}</span>
                                  <span>{money(num(item.price))}</span>
                                  <span className="text-right font-semibold">{money(num(item.price) * num(item.quantity))}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-xs text-slate-500">{lang === "ne" ? "जम्मा" : "Total"}</p>
                              <p className="font-bold text-slate-950">{money(total)}</p>
                            </div>
                            <div className="rounded-xl bg-emerald-50 px-3 py-2">
                              <p className="text-xs text-emerald-700">{lang === "ne" ? "उठेको" : "Paid"}</p>
                              <p className="font-bold text-emerald-800">{money(num(invoice.amountPaid))}</p>
                            </div>
                            <div className="rounded-xl bg-amber-50 px-3 py-2">
                              <p className="text-xs text-amber-700">{lang === "ne" ? "बाँकी" : "Due"}</p>
                              <p className="font-bold text-amber-900">{money(num(invoice.dueAmount))}</p>
                            </div>
                          </div>
                          {invoice.note ? (
                            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{invoice.note}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "हालका अर्डर र बुकिङ" : "Recent orders & bookings"}</h3>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">
                  {(orders || []).length + (bookings || []).length}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {[...(orders || []).map((order: any) => ({ kind: "order", createdAt: order.createdAt, data: order })), ...(bookings || []).map((booking: any) => ({ kind: "booking", createdAt: booking.createdAt || booking.bookingDate, data: booking }))]
                  .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .slice(0, 6)
                  .map((entry: any) => {
                    const key = `${entry.kind}-${entry.data.id}`;
                    const isOpen = expandedRecentId === key;
                    return (
                      <div key={key} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedRecentId(isOpen ? null : key)}
                          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                        >
                          {entry.kind === "order" ? (
                            <>
                              <div>
                                <p className="font-semibold text-slate-950">#{entry.data.id} {entry.data.customerName} {isOpen ? "▾" : "▸"}</p>
                                <p className="text-slate-500">{lang === "ne" ? "सामान अर्डर" : "Product order"}</p>
                                <p className="text-slate-400">{when(entry.data.createdAt)}</p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">{money(num(entry.data.totalAmount))}</span>
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="font-semibold text-slate-950">#{entry.data.id} {entry.data.customerName} {isOpen ? "▾" : "▸"}</p>
                                <p className="text-slate-500">
                                  {entry.data.serviceType === "tractor"
                                    ? (lang === "ne" ? "ट्र्याक्टर बुकिङ" : "Tractor booking")
                                    : entry.data.serviceType === "telcoline"
                                      ? (lang === "ne" ? "टाटा टेल्कोलाइन बुकिङ" : "Tata Telcoline booking")
                                      : (lang === "ne" ? "बोलेरो बुकिङ" : "Bolero booking")}
                                </p>
                                <p className="text-slate-400">{when(entry.data.createdAt || entry.data.bookingDate)}</p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">
                                {entry.data.pickupLocation || (lang === "ne" ? "बुकिङ" : "Booking")}
                              </span>
                            </>
                          )}
                        </button>
                        {isOpen ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                            {entry.kind === "order" ? (
                              <>
                                <p className="text-slate-500">{entry.data.customerPhone}</p>
                                <p className="text-slate-500">{entry.data.customerAddress}</p>
                                {Array.isArray(entry.data.items) ? (
                                  <div className="mt-2 space-y-1">
                                    {entry.data.items.map((it: any, i: number) => (
                                      <div key={i} className="flex justify-between border-t border-slate-100 pt-1">
                                        <span>{it.productName} ({it.quantity} {it.unit || "pc"})</span>
                                        <strong>{money(num(it.price) * num(it.quantity))}</strong>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); printOrderSlip(entry.data, lang, shopInfo); }} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">🖨️ {lang === "ne" ? "स्लिप प्रिन्ट" : "Print slip"}</button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setTab("orders"); }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">{lang === "ne" ? "अर्डर ट्याबमा →" : "Open in Orders →"}</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-slate-500">{entry.data.customerPhone}</p>
                                <p className="text-slate-500">{entry.data.pickupLocation} → {entry.data.destination}</p>
                                {entry.data.notes ? <p className="mt-1 text-slate-600">{entry.data.notes}</p> : null}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); printBookingSlip(entry.data, lang, shopInfo); }} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">🖨️ {lang === "ne" ? "स्लिप प्रिन्ट" : "Print slip"}</button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setTab("orders"); }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">{lang === "ne" ? "बुकिङ ट्याबमा →" : "Open in Bookings →"}</button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </div>

          </section>
        ) : null}

        {tab === "billing" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <form onSubmit={createInvoice} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "काउन्टर बिक्री" : "Counter Sale"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "दैनिक पसल बिक्री, नगद, उधारो, र स्टक रेकर्ड यहीँ राख्नुहोस्।" : "Record daily shop sales, cash, credit, and stock changes here."}</p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white">{text.totalPreview}: {money(preview.total)}</div>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "छिटो ग्राहक छनोट" : "Quick customer pick"}</p>
                  <button
                    type="button"
                    onClick={() => void startWalkInSale()}
                    disabled={walkInBusy}
                    className="mt-3 w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 disabled:opacity-60"
                  >
                    {walkInBusy
                      ? (lang === "ne" ? "तयार गर्दै..." : "Preparing...")
                      : (lang === "ne"
                          ? "🧾 नयाँ/अपरिचित ग्राहक — नगद बिक्री"
                          : "🧾 New / unknown customer — cash sale")}
                  </button>
                  <p className="mt-2 text-xs text-slate-500">
                    {lang === "ne"
                      ? "दर्ता नगरी बिक्री गर्न यो थिच्नुहोस्। उधारो दिनुपरे तल ग्राहक खोजेर छान्नुहोस्।"
                      : "Tap this to sell without registering anyone. For credit (udharo), pick a saved customer below instead."}
                  </p>
                  <input
                    className={`${shellInput()} mt-3`}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder={lang === "ne" ? "नाम, फोन वा ग्राहक कोड खोज्नुहोस्" : "Search name, phone, or customer code"}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickCustomers.map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setInvoiceForm((v: any) => ({ ...v, customerId: customer.id }))}
                        className={`rounded-full px-3 py-2 text-sm font-semibold ${invoiceForm.customerId === customer.id ? "bg-primary text-primary-foreground" : "bg-white text-slate-700 border border-slate-200"}`}
                      >
                        {customer.name}
                      </button>
                    ))}
                  </div>
                </div>
                <select className={shellInput()} value={invoiceForm.customerId} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, customerId: Number(e.target.value) }))}>
                  <option value={0}>{lang === "ne" ? "पहिले ग्राहक खोज्नुहोस्" : "Search and select customer"}</option>
                  {filteredCustomers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name} ({money(num(customer.creditBalance))} {text.due})</option>)}
                </select>
                {currentCustomer ? (
                  <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "ग्राहक" : "Customer"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{currentCustomer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "पुरानो बाँकी" : "Previous due"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{money(preview.previousDue)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "फोन" : "Phone"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{currentCustomer.phone || text.noPhoneSaved}</p>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "छिटो सामान थप्नुहोस्" : "Quick add products"}</p>
                  <input
                    className={`${shellInput()} mt-3`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={lang === "ne" ? "सामान वा SKU खोज्नुहोस्" : "Search product or SKU"}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickProducts.filter((product: any) => {
                      const query = productSearch.trim().toLowerCase();
                      if (!query) return true;
                      return [product.name, product.sku].some((value) => String(value || "").toLowerCase().includes(query));
                    }).map((product: any) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setLines((items: any[]) => [...items, { productId: product.id, quantity: 1 }])}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        {product.name}
                      </button>
                    ))}
                  </div>
                </div>
                {lines.map((line: any, index: number) => (
                  <div key={`${line.productId}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_110px_auto]">
                    <select className={shellInput()} value={line.productId} onChange={(e) => setLines((items: any[]) => items.map((item, i) => i === index ? { ...item, productId: Number(e.target.value) } : item))}>
                      {filteredProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({product.stockQuantity} {product.unit})</option>)}
                    </select>
                    <input type="number" min={1} className={shellInput()} value={line.quantity} onChange={(e) => setLines((items: any[]) => items.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} />
                    <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700" onClick={() => setLines((items: any[]) => items.filter((_, i) => i !== index))}>{text.remove}</button>
                  </div>
                ))}
                <button type="button" className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-medium text-slate-900" onClick={() => setProductSearch("")}>{lang === "ne" ? "अर्को सामान खोज्नुहोस्" : "Search another product"}</button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className={shellInput()} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, paymentMethod: e.target.value }))}>
                    {["cash", "credit", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{paymentMethodLabel(method, lang)}</option>)}
                  </select>
                  <input type="number" min={0} className={shellInput()} value={invoiceForm.amountPaid} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, amountPaid: e.target.value }))} placeholder={text.amountReceivedNow} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "cash", amountPaid: String(preview.total) }))}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  >
                    {lang === "ne" ? "पूरा नगद" : "Full Cash"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "credit", amountPaid: "0" }))}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
                  >
                    {lang === "ne" ? "पूरा उधारो" : "Full Credit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "cash", amountPaid: String(Math.max(Math.round(preview.total / 2), 0)) }))}
                    className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    {lang === "ne" ? "आधा भुक्तानी" : "Partial Payment"}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    [text.currentBill, money(preview.subtotal)],
                    [text.previousDue, money(preview.previousDue)],
                    [text.paidNow, money(preview.amountPaid)],
                    [text.remainingDue, money(preview.due)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                      <p className="mt-2 font-semibold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "ग्राहक बिल फोटो" : "Customer bill photo"}</p>
                  <label className="mt-3 block rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
                    {lang === "ne" ? "बिलको फोटो खिच्नुहोस् वा अपलोड गर्नुहोस्" : "Take or upload the bill photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="mt-3 block w-full text-sm"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readFileAsDataUrl(file);
                        setCustomerBillScan({
                          image: dataUrl,
                          text: "",
                          summary: [],
                          loading: false,
                          error: "",
                          suggestion: {},
                        });
                        setInvoiceForm((current: any) => ({ ...current, proofPath: dataUrl }));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {customerBillScan.image ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <img src={customerBillScan.image} alt="Customer bill" className="max-h-72 w-full rounded-2xl object-contain" />
                      <button
                        type="button"
                        onClick={() => setCustomerBillScan(createBillScanState())}
                        className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        {lang === "ne" ? "फोटो हटाउनुहोस्" : "Remove photo"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <textarea className={`${shellInput()} min-h-24`} value={invoiceForm.note} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, note: e.target.value }))} placeholder={text.billNote} />
                <button className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-foreground shadow-lg">{lang === "ne" ? "बिक्री सुरक्षित गर्नुहोस्" : "Save Sale"}</button>
              </div>
            </form>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.invoicePreview}</h3>
              <div className="mt-4 rounded-[1.5rem] bg-[linear-gradient(135deg,#fffdf8_0%,#f7ebdd_100%)] p-5 print-hidden">
                <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
                  <GaneshBlessing compact />
                  <NepalDateTime lang={lang} compact />
                </div>
                <div className="border-b border-dashed border-slate-300 pb-4">
                  <h4 className="text-2xl font-bold text-slate-950">{shopName}</h4>
                  <p className="mt-1 text-sm text-slate-500">{shopAddress}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatNepalDateTime(new Date(), lang)}</p>
                  <div className="mt-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">{currentCustomer?.name || "Customer"}</p>
                    <p>{currentCustomer?.phone || text.noPhoneSaved}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    [text.previousDue, money(preview.previousDue)],
                    [text.currentBill, money(preview.subtotal)],
                    [text.paidNow, money(preview.amountPaid)],
                    [text.remainingDue, money(preview.due)],
                  ].map(([label, value]) => (
                    <article key={String(label)} className="rounded-2xl bg-white/90 p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span>{lang === "ne" ? "सामान" : "Item"}</span>
                    <span>{lang === "ne" ? "परिमाण" : "Qty"}</span>
                    <span>{lang === "ne" ? "दर" : "Rate"}</span>
                    <span>{lang === "ne" ? "रकम" : "Amount"}</span>
                  </div>
                  {preview.items.length ? preview.items.map((item: any) => (
                    <div key={`preview-${item.productId}-${item.name}`} className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr] px-4 py-3 text-sm text-slate-700 border-b border-slate-100 last:border-b-0">
                      <span className="font-semibold text-slate-950">{item.name}</span>
                      <span>{item.quantity} {item.unit}</span>
                      <span>{money(item.price)}</span>
                      <span>{money(item.total)}</span>
                    </div>
                  )) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">
                      {lang === "ne" ? "सामान थपेपछि बिल विवरण यहाँ देखिन्छ।" : "Add products to see the bill details here."}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">{text.payment}: {paymentMethodLabel}</span>
                  <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">{text.rewardEarned}: {preview.rewardPoints}</span>
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                    <Printer className="h-4 w-4" />
                    {text.print}
                  </button>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════
                  PRINT BILL — hidden on screen, visible when printing
                  ══════════════════════════════════════════════════ */}
              <div className="print-bill-sheet hidden">
                <div className="mx-auto max-w-[780px] bg-white text-slate-950" style={{ fontFamily: "Arial, sans-serif" }}>

                  {/* ── Header: Ganesh blessing ── */}
                  <div className="border-b-2 border-slate-800 pb-3 text-center">
                    <p className="text-xs font-bold tracking-widest text-slate-700">ॐ श्री गणेशाय नमः</p>
                    <img
                      src="/ganesh-banner.png"
                      alt="Shree Ganesh"
                      className="mx-auto mt-1 h-16 w-auto max-w-xs rounded object-contain"
                    />
                  </div>

                  {/* ── Shop identity + Invoice meta ── */}
                  <div className="mt-3 flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
                    {/* Left: shop details */}
                    <div className="flex items-start gap-3">
                      <img src="/rajesh-logo.png" alt="Logo" className="h-16 w-16 rounded object-cover" />
                      <div>
                        <p className="text-xl font-extrabold leading-tight">{lang === "ne" ? "राजेश सिपिङ् सेन्टर" : "Rajesh Shopping Center"}</p>
                        <p className="mt-0.5 text-sm text-slate-600">{shopAddress}</p>
                        <p className="text-sm text-slate-600">{lang === "ne" ? "फोन:" : "Ph:"} {shopPhone}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800">
                          {lang === "ne" ? "प्यान नं.:" : "PAN No.:"} {(settingsForm as any)?.panNumber || "302951817"}
                        </p>
                      </div>
                    </div>
                    {/* Right: invoice number + date (always from saved invoice) */}
                    <div className="text-right">
                      <p className="rounded bg-slate-800 px-3 py-1 text-sm font-bold uppercase tracking-widest text-white">
                        {lang === "ne" ? "बिल / रसिद" : "INVOICE / RECEIPT"}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold">{lang === "ne" ? "बिल नं.:" : "Bill No.:"}</span>{" "}
                        {lastInvoice?.invoice?.invoiceNumber || "—"}
                      </p>
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">{lang === "ne" ? "मिति:" : "Date:"}</span>{" "}
                        {formatNepalDateTime(lastInvoice?.invoice?.createdAt ? new Date(lastInvoice.invoice.createdAt) : new Date(), lang)}
                      </p>
                    </div>
                  </div>

                  {/* ── Customer + Summary grid (from saved invoice, not live preview) ── */}
                  <div className="mt-3 grid grid-cols-2 gap-4 border-b border-slate-300 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{lang === "ne" ? "ग्राहकको विवरण" : "Bill To"}</p>
                      <p className="mt-1.5 text-base font-bold">{lastInvoice?.customer?.name || currentCustomer?.name || "—"}</p>
                      <p className="text-sm text-slate-600">{lastInvoice?.customer?.phone || currentCustomer?.phone || ""}</p>
                      <p className="text-sm text-slate-600">{lastInvoice?.customer?.address || currentCustomer?.address || ""}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        [lang === "ne" ? "पुरानो बाँकी" : "Previous Due", money(lastInvoice?.invoice?.previousDueAmount ?? 0), "text-rose-700"],
                        [lang === "ne" ? "हालको बिल" : "Current Bill", money(lastInvoice?.invoice?.subtotalAmount ?? 0), "text-slate-950"],
                        [lang === "ne" ? "अहिले तिरेको" : "Paid Now", money(lastInvoice?.invoice?.amountPaid ?? 0), "text-emerald-700"],
                        [lang === "ne" ? "बाँकी रकम" : "Balance Due", money(lastInvoice?.invoice?.dueAmount ?? 0), "text-rose-700 font-extrabold"],
                      ].map(([label, value, cls]) => (
                        <div key={String(label)} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                          <p className={`mt-1 text-sm font-bold ${cls}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Items table (from saved invoice items) ── */}
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-800 bg-slate-100 text-left">
                        <th className="px-3 py-2 text-xs uppercase tracking-wider">#</th>
                        <th className="px-3 py-2 text-xs uppercase tracking-wider">{lang === "ne" ? "सामानको नाम" : "Item"}</th>
                        <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">{lang === "ne" ? "परिमाण" : "Qty"}</th>
                        <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">{lang === "ne" ? "दर" : "Rate"}</th>
                        <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">{lang === "ne" ? "रकम" : "Amount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastInvoice?.items?.length ? lastInvoice.items.map((item: any, idx: number) => (
                        <tr key={`bill-${item.id ?? idx}`} className="border-b border-slate-200">
                          <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{item.productName}</td>
                          <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(item.lineTotal)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                            {lang === "ne" ? "बिल सुरक्षित भएपछि प्रिन्ट गर्नुहोस्।" : "Save the invoice first, then print."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-800">
                        <td colSpan={4} className="px-3 py-2 text-right font-bold">{lang === "ne" ? "कुल जम्मा:" : "Grand Total:"}</td>
                        <td className="px-3 py-2 text-right text-base font-extrabold">{money(lastInvoice?.invoice?.subtotalAmount ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* ── Payment method + reward ── */}
                  <div className="mt-3 flex items-start justify-between gap-4 border-t border-slate-200 pt-3 text-sm">
                    <div>
                      <span className="font-semibold">{lang === "ne" ? "भुक्तानी तरिका:" : "Payment:"}</span>{" "}
                      <span>{lastInvoice?.invoice?.paymentMethod || paymentMethodLabel}</span>
                      {lastInvoice?.invoice?.note ? <p className="mt-1 text-slate-600">{lastInvoice.invoice.note}</p> : null}
                    </div>
                    {(lastInvoice?.invoice?.rewardPointsEarned ?? 0) > 0 ? (
                      <div className="text-right text-xs text-slate-500">
                        {lang === "ne" ? "पुरस्कार अंक:" : "Reward points:"} <strong>{lastInvoice.invoice.rewardPointsEarned}</strong>
                      </div>
                    ) : null}
                  </div>

                  {/* ── Footer / terms ── */}
                  {settingsForm.invoiceFooter ? (
                    <p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">{settingsForm.invoiceFooter}</p>
                  ) : (
                    <p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
                      {lang === "ne"
                        ? "सामान लिएपछि फिर्ता हुँदैन। धन्यवाद!"
                        : "Goods once sold are not returnable. Thank you for your business!"}
                    </p>
                  )}

                  {/* ── Signature & Stamp area ── */}
                  <div className="mt-8 grid grid-cols-2 gap-8 border-t-2 border-slate-800 pt-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {lang === "ne" ? "ग्राहकको दस्तखत" : "Customer Signature"}
                      </p>
                      <div className="mt-6 border-b border-slate-400"></div>
                      <p className="mt-1 text-center text-xs text-slate-400">{currentCustomer?.name || ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {lang === "ne" ? "अधिकृत दस्तखत र छाप" : "Authorised Signature & Stamp"}
                      </p>
                      <div className="ml-auto mt-1 h-20 w-28 rounded border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <p className="text-[10px] text-slate-300">{lang === "ne" ? "छाप" : "STAMP"}</p>
                      </div>
                      <div className="mt-1 border-b border-slate-400"></div>
                      <p className="mt-1 text-xs text-slate-400">{lang === "ne" ? "राजेश सिपिङ् सेन्टर" : "Rajesh Shopping Center"}</p>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          </section>
        ) : null}

        {tab === "orders" ? (
          <section className="space-y-5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "अनलाइन अर्डर र बुकिङ" : "Online Orders & Bookings"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "वेबसाइटबाट आएका अर्डर र बुकिङ यहाँ देखिन्छन्।" : "Orders and bookings created from the website appear here."}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  {lang === "ne" ? "नयाँ अर्डर / बुकिङ" : "New orders / bookings"}: {newActivityCount}
                </div>
              </div>
            </div>

            {/* Side-by-side: Product Orders | Transport Bookings */}
            <div className="grid gap-5 lg:grid-cols-2">

              {/* ── Product Orders ── */}
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-950">{lang === "ne" ? "उत्पादन अर्डर" : "Product Orders"}</h4>
                    <p className="text-xs text-slate-500">{lang === "ne" ? "सामान खरिद अर्डरहरू" : "Shop purchases"}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                    {(orders || []).length} {lang === "ne" ? "अर्डर" : "orders"}
                    {newOrders.length > 0 && (
                      <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{newOrders.length} new</span>
                    )}
                  </span>
                </div>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {(() => {
                  const isCompleted = (o: any) => o.status === "delivered" || o.status === "cancelled";
                  const list = (orders || []).slice().reverse();
                  const active = list.filter((o: any) => !isCompleted(o));
                  const completed = list.filter(isCompleted);
                  const visible = showCompletedOrders ? [...active, ...completed] : active;
                  return <>
                {visible.map((order: any) => (
                  <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-slate-950">#{order.id} {order.customerName}</p>
                        <p className="text-sm text-slate-500">{order.customerPhone}</p>
                        <p className="text-sm text-slate-500">{order.customerAddress}</p>
                        <p className="mt-1 text-sm text-slate-400">{when(order.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{money(num(order.totalAmount))}</span>
                        {order.paymentMethod ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                            {order.paymentMethod === "esewa" ? "eSewa" : order.paymentMethod === "khalti" ? "Khalti" : "Bank"}
                          </span>
                        ) : null}
                        {(() => {
                          const statusMeta = getOwnerOrderStatusMeta(order.status, lang === "ne" ? "ne" : "en");
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${statusMeta.className}`}>
                              <statusMeta.icon className="h-4 w-4" />
                              {statusMeta.label}
                            </span>
                          );
                        })()}
                        {(() => {
                          const paymentMeta = getOwnerPaymentStatusMeta(order.paymentStatus, lang === "ne" ? "ne" : "en");
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${paymentMeta.className}`}>
                              <paymentMeta.icon className="h-4 w-4" />
                              {paymentMeta.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Payment proof screenshot — for eSewa/Khalti */}
                    {order.paymentScreenshotPath && (order.paymentMethod === "esewa" || order.paymentMethod === "khalti") ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold text-amber-700 mb-2">📱 {lang === "ne" ? "भुक्तानी प्रमाण" : "Payment proof"}</p>
                        <img src={order.paymentScreenshotPath} alt="Payment screenshot" className="h-40 w-full rounded-xl object-contain border border-amber-200 bg-white" />
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2">
                      {(order.items || []).map((item: any, index: number) => (
                        <div key={`${order.id}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                          <span>{item.productName} ({item.quantity} {item.unit || "pc"})</span>
                          <strong>{money(num(item.price) * num(item.quantity))}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.status === "order-received" ? (
                        <button
                          type="button"
                          disabled={order.paymentStatus !== "paid"}
                          onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "preparing"), lang === "ne" ? "अर्डर पुष्टि भयो।" : "Order confirmed", lang === "ne" ? "अर्डर पुष्टि गर्न सकिएन।" : "Could not confirm the order.")}
                          className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                          title={order.paymentStatus !== "paid" ? (lang === "ne" ? "भुक्तानी पुष्टि गरेर पहिले अर्डर पुष्टि गर्नुहोस्" : "Confirm payment first") : ""}
                        >
                          {lang === "ne" ? "अर्डर पुष्टि गर्नुहोस्" : "Confirm order"}
                        </button>
                      ) : null}
                      {order.status === "preparing" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "dispatched"), lang === "ne" ? "अर्डर पठाइयो।" : "Order dispatched", lang === "ne" ? "अर्डर पठाउन सकिएन।" : "Could not mark the order as dispatched.")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                          {lang === "ne" ? "पठाइयो" : "Mark dispatched"}
                        </button>
                      ) : null}
                      {order.status === "dispatched" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "delivered"), lang === "ne" ? "अर्डर डेलिभर भयो।" : "Order delivered", lang === "ne" ? "अर्डर डेलिभर गर्न सकिएन।" : "Could not mark the order as delivered.")} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                          {lang === "ne" ? "डेलिभर भयो" : "Mark delivered"}
                        </button>
                      ) : null}
                      {order.paymentStatus !== "paid" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => runOwnerAction(
                              () => confirmOrderPayment(order.id, "confirmed", order.paymentMethod || "bank"),
                              lang === "ne" ? "भुक्तानी खाताबहीमा राखियो ✅" : "Payment confirmed & recorded in ledger ✅",
                              lang === "ne" ? "भुक्तानी पुष्टि गर्न सकिएन।" : "Could not confirm payment."
                            )}
                            className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
                            title={lang === "ne" ? "ग्राहकले वास्तवमा पैसा पठायो — खाताबहीमा राख्नुहोस्" : "Customer actually sent money — record in ledger"}
                          >
                            ✅ {lang === "ne" ? "भुक्तानी पायो (खाताबही)" : `Received via ${order.paymentMethod === "esewa" ? "eSewa" : order.paymentMethod === "khalti" ? "Khalti" : "Bank"}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => runOwnerAction(
                              () => confirmOrderPayment(order.id, "credit", order.paymentMethod || "bank"),
                              lang === "ne" ? "उधारो खाताबहीमा थपियो 📒" : "Added to customer credit tab 📒",
                              lang === "ne" ? "उधारो थप्न सकिएन।" : "Could not add to credit tab."
                            )}
                            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
                            title={lang === "ne" ? "ग्राहकले पैसा पठाएन — उनको उधारो खातामा राख्नुहोस्" : "Customer didn't pay — add to their credit tab"}
                          >
                            📒 {lang === "ne" ? "उधारो खातामा राख्नुहोस्" : "Add to credit tab"}
                          </button>
                        </>
                      ) : null}
                      {order.status !== "cancelled" && order.status !== "delivered" ? (
                        <button type="button" onClick={() => confirmOwnerAction(
                          {
                            title: lang === "ne" ? "अर्डर रद्द गर्ने?" : "Cancel this order?",
                            message: lang === "ne"
                              ? `${order.customerName} को अर्डर #${order.id} रद्द गरिनेछ।`
                              : `Order #${order.id} from ${order.customerName} will be cancelled.`,
                            confirmLabel: lang === "ne" ? "रद्द गर्नुहोस्" : "Cancel order",
                          },
                          () => updateOrderStatus(order.id, "cancelled"),
                          lang === "ne" ? "अर्डर रद्द भयो।" : "Order rejected",
                          lang === "ne" ? "अर्डर रद्द गर्न सकिएन।" : "Could not cancel the order.",
                        )} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                          {lang === "ne" ? "रद्द" : "Cancel"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditingOrderId(order.id)}
                        className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                      >
                        {lang === "ne" ? "सम्पादन" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => printOrderSlip(order, lang, shopInfo)}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        title={lang === "ne" ? "बिल/स्लिप प्रिन्ट" : "Print invoice / slip"}
                      >
                        🖨️ {lang === "ne" ? "बिल प्रिन्ट" : "Print invoice"}
                      </button>
                    </div>
                  </article>
                ))}
                {active.length === 0 && !showCompletedOrders ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    {completed.length > 0
                      ? (lang === "ne" ? "हाल कुनै सक्रिय अर्डर छैन।" : "No active orders right now.")
                      : (lang === "ne" ? "कुनै अर्डर छैन।" : "No product orders yet.")}
                  </p>
                ) : null}
                {completed.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowCompletedOrders((v) => !v)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"
                  >
                    {showCompletedOrders
                      ? (lang === "ne" ? `सम्पन्न लुकाउनुहोस् (${completed.length})` : `Hide completed (${completed.length})`)
                      : (lang === "ne" ? `सम्पन्न / रद्द हेर्नुहोस् (${completed.length})` : `Show completed / cancelled (${completed.length})`)}
                  </button>
                ) : null}
                  </>;
                })()}
                </div>
              </div>

              {/* ── Transport Bookings ── */}
              <div className="rounded-[1.5rem] border border-amber-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-950">{lang === "ne" ? "यातायात बुकिङ" : "Transport Bookings"}</h4>
                    <p className="text-xs text-slate-500">{lang === "ne" ? "बोलेरो, ट्र्याक्टर, टेल्कोलाइन" : "Bolero, Tractor, Telcoline"}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                    {(bookings || []).length} {lang === "ne" ? "बुकिङ" : "bookings"}
                    {newBookings.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{newBookings.length} new</span>
                    )}
                  </span>
                </div>
                <BookingList
                  bookings={bookings || []}
                  lang={lang}
                  updateBookingStatus={updateBookingStatus}
                  runOwnerAction={runOwnerAction}
                  confirmOwnerAction={confirmOwnerAction}
                  shopInfo={shopInfo}
                  onEditBooking={setEditingBookingId}
                />
              </div>

            </div>{/* end side-by-side grid */}
          </section>
        ) : null}

        {tab === "customers" ? (
          <section className="space-y-5">
            {/* Credit Manager */}
            <CreditManager
              customers={customers}
              lang={lang as "en" | "ne"}
              api={props.api}
              onRefresh={props.reloadOwnerData}
              onOpenCustomer={setSelectedCustomerId}
            />

            {/* Customer Ledger and Forms */}
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.customerLedger}</h3>
              <input
                className={`${shellInput()} mt-4`}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={lang === "ne" ? "नाम, फोन वा ग्राहक कोड खोज्नुहोस्" : "Search name, phone, or customer code"}
              />
              <div className="mt-4 grid gap-3">
                {filteredCustomers.map((customer: any) => (
                  <article key={customer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-bold text-slate-950">{customer.name}</h4>
                        <p className="text-sm text-slate-500">{customer.phone || text.noPhoneSaved}</p>
                        <p className="text-sm text-slate-500">{customer.address || text.noAddressSaved}</p>
                        <p className="mt-1 text-sm font-semibold text-rose-700">{lang === "ne" ? "कुल बाँकी" : "Total due"}: {money(num(customer.creditBalance))}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{text.due}: {money(num(customer.creditBalance))}</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.rewardPoints}: {customer.rewardPoints}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedCustomerId(customer.id)} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">{lang === "ne" ? "विवरण" : "Details"}</button>
                      {num(customer.creditBalance) > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPaymentForm((v: any) => ({
                            ...v,
                            customerId: customer.id,
                            amount: String(num(customer.creditBalance)),
                            referenceNote: lang === "ne" ? "पूरा उधारो भुक्तानी" : "Full credit repayment",
                          }))}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                        >
                          {lang === "ne" ? "पूरा तिर्नुहोस्" : "Pay full"}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => startEditCustomer(customer)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{text.edit}</button>
                      <button type="button" onClick={() => confirmOwnerAction(
                        {
                          title: lang === "ne" ? "ग्राहक हटाउने?" : "Delete this customer?",
                          message: lang === "ne"
                            ? `${customer.name} लाई हटाइनेछ। यो फिर्ता गर्न मिल्दैन।`
                            : `${customer.name} will be removed. This cannot be undone.`,
                          confirmLabel: lang === "ne" ? "हटाउनुहोस्" : "Delete",
                        },
                        () => deleteCustomer(customer.id),
                        lang === "ne" ? "ग्राहक हटाइयो।" : "Customer deleted successfully.",
                        lang === "ne" ? "ग्राहक हटाउन सकिएन।" : "Could not delete the customer.",
                      )} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{text.delete}</button>
                    </div>
                  </article>
                ))}
                {customerSearch.trim() && filteredCustomers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{lang === "ne" ? "ग्राहक भेटिएन।" : "No matching customer found."}</p>
                ) : null}
                {!customerSearch.trim() ? (
                  <p className="py-6 text-center text-sm text-slate-500">{lang === "ne" ? "ग्राहक हेर्न पहिले खोज्नुहोस्।" : "Search a customer to view details."}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-5">
              <form onSubmit={recordPayment} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-950">{text.recordPayment}</h3>
                <div className="mt-4 grid gap-4">
                  <select className={shellInput()} value={paymentForm.customerId} onChange={(e) => setPaymentForm((v: any) => ({ ...v, customerId: Number(e.target.value) }))}>
                    <option value={0}>{lang === "ne" ? "ग्राहक छनोट गर्नुहोस्" : "Select customer"}</option>
                    {customers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                  <input type="number" min={0} className={shellInput()} value={paymentForm.amount} onChange={(e) => setPaymentForm((v: any) => ({ ...v, amount: e.target.value }))} placeholder={text.amount} />
                  <select className={shellInput()} value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((v: any) => ({ ...v, paymentMethod: e.target.value }))}>
                    {["cash", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{paymentMethodLabel(method, lang)}</option>)}
                  </select>
                  <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                    {lang === "ne" ? "भुक्तानी रसिद/बिलको फोटो" : "Payment receipt/bill photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="mt-3 block w-full text-sm"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readFileAsDataUrl(file);
                        setCustomerBillScan({
                          image: dataUrl,
                          text: "",
                          summary: [],
                          loading: false,
                          error: "",
                          suggestion: {},
                        });
                        setPaymentForm((current: any) => ({ ...current, proofPath: dataUrl }));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {customerBillScan.image ? <img src={customerBillScan.image} alt="Payment bill" className="h-48 w-full rounded-2xl border border-slate-200 object-contain bg-slate-50 p-2" /> : null}
                  <textarea className={`${shellInput()} min-h-24`} value={paymentForm.referenceNote} onChange={(e) => setPaymentForm((v: any) => ({ ...v, referenceNote: e.target.value }))} placeholder={text.note} />
                  <button className="rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">{text.saveRepayment}</button>
                </div>
              </form>

              <form onSubmit={createCustomer} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-950">{editingCustomerId ? `${text.edit} ${lang === "ne" ? "ग्राहक" : "customer"}` : text.addCustomer}</h3>
                <div className="mt-4 grid gap-4">
                  <input className={shellInput()} value={customerForm.name} onChange={(e) => setCustomerForm((v: any) => ({ ...v, name: e.target.value }))} placeholder={lang === "ne" ? "नाम" : "Name"} />
                  <input className={shellInput()} value={customerForm.phone} onChange={(e) => setCustomerForm((v: any) => ({ ...v, phone: e.target.value }))} placeholder={lang === "ne" ? "फोन" : "Phone"} />
                  <textarea className={`${shellInput()} min-h-24`} value={customerForm.address} onChange={(e) => setCustomerForm((v: any) => ({ ...v, address: e.target.value }))} placeholder={lang === "ne" ? "ठेगाना" : "Address"} />
                  <textarea className={`${shellInput()} min-h-24`} value={customerForm.notes} onChange={(e) => setCustomerForm((v: any) => ({ ...v, notes: e.target.value }))} placeholder={text.notes} />
                  <button className="rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">{editingCustomerId ? (lang === "ne" ? "ग्राहक अपडेट गर्नुहोस्" : "Update customer") : text.createCustomerButton}</button>
                </div>
              </form>
            </div>
            </div>
          </section>
        ) : null}

        {tab === "products" ? (
          <section className="space-y-5">
            <DealerRecords products={products} lang={lang as "en" | "ne"} api={props.api} onRefresh={props.reloadOwnerData} />

            {/* Stock Tracker */}
            <StockTracker products={products} lang={lang as "en" | "ne"} api={props.api} />

            {/* Product Costs & Management */}
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{text.productCosts}</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {products.map((product: any) => {
                  const cost = num(product.buyingPrice) + num(product.transportationCost) + num(product.extraCost);
                  return (
                    <article key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover"
                            />
                          ) : null}
                          <div>
                          <h4 className="text-lg font-bold text-slate-950">{product.name}</h4>
                          <p className="text-sm text-slate-500">
                            SKU: {product.sku || "-"}
                          </p>
                          <p className="text-sm text-slate-500">
                            Description: {product.description || "-"}
                          </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedProductId((current) => current === product.id ? null : product.id)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                          >
                            {expandedProductId === product.id ? (lang === "ne" ? "लुकाउनुहोस्" : "Hide") : (lang === "ne" ? "हेर्नुहोस्" : "View")}
                          </button>
                          <button type="button" onClick={() => startEditProduct(product)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{text.edit}</button>
                          <button type="button" onClick={() => confirmOwnerAction(
                            {
                              title: lang === "ne" ? "सामान हटाउने?" : "Delete this product?",
                              message: lang === "ne"
                                ? `${product.name} लाई सूचीबाट हटाइनेछ। यो फिर्ता गर्न मिल्दैन।`
                                : `${product.name} will be removed from your catalog. This cannot be undone.`,
                              confirmLabel: lang === "ne" ? "हटाउनुहोस्" : "Delete",
                            },
                            () => deleteProduct(product.id),
                            lang === "ne" ? "सामान हटाइयो।" : "Product deleted successfully.",
                            lang === "ne" ? "सामान हटाउन सकिएन।" : "Could not delete the product.",
                          )} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{text.delete}</button>
                        </div>
                      </div>
                      {expandedProductId === product.id ? (
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Buying</p><strong className="mt-2 block">{money(num(product.buyingPrice))}</strong></div>
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Transport</p><strong className="mt-2 block">{money(num(product.transportationCost))}</strong></div>
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selling</p><strong className="mt-2 block">{money(num(product.price))}</strong></div>
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Profit</p><strong className="mt-2 block text-emerald-700">{money(num(product.price) - cost)}</strong></div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Stock quantity</p><strong className="mt-2 block">{product.stockQuantity || 0}</strong></div>
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reorder level</p><strong className="mt-2 block">{product.reorderLevel || 0}</strong></div>
                            <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Unit</p><strong className="mt-2 block">{product.unit || "-"}</strong></div>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Description</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{product.description || "-"}</p>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <form onSubmit={createProduct} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{editingProductId ? text.updateProduct : text.addProduct}</h3>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>{lang === "ne" ? "कुन श्रेणीमा राख्ने?" : "Which category?"}</span>
                  <select
                    className={shellInput()}
                    value={(productForm as any).categoryId || ""}
                    onChange={(e) => setProductForm((v: any) => ({ ...v, categoryId: e.target.value }))}
                  >
                    <option value="">{lang === "ne" ? "श्रेणी छान्नुहोस्" : "Select a category"}</option>
                    {(categories || []).map((category: any) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  { key: "name", label: lang === "ne" ? "सामानको नाम" : "Product name" },
                  { key: "sku", label: lang === "ne" ? "कोड / SKU" : "SKU / code" },
                  { key: "description", label: lang === "ne" ? "विवरण" : "Description" },
                  { key: "price", label: lang === "ne" ? "बिक्री मूल्य" : "Selling price" },
                  { key: "buyingPrice", label: lang === "ne" ? "खरिद मूल्य" : "Buying price" },
                  { key: "transportationCost", label: lang === "ne" ? "ढुवानी खर्च" : "Transport cost" },
                  { key: "extraCost", label: lang === "ne" ? "अन्य खर्च" : "Extra cost" },
                  { key: "stockQuantity", label: lang === "ne" ? "स्टक परिमाण" : "Stock quantity" },
                  { key: "reorderLevel", label: lang === "ne" ? "कम भएको चेतावनी तह" : "Reorder level" },
                  { key: "unit", label: lang === "ne" ? "एकाइ (केजी/गोटा/बोरा)" : "Unit" },
                ].map((field) =>
                  field.key === "description" ? (
                    <label key={field.key} className="grid gap-2 text-sm font-medium text-slate-700">
                      <span>{field.label}</span>
                      <textarea
                        className={`${shellInput()} min-h-28`}
                        value={(productForm as any)[field.key]}
                        onChange={(e) => setProductForm((v: any) => ({ ...v, [field.key]: e.target.value }))}
                        placeholder={field.label}
                      />
                    </label>
                  ) : (
                    <label key={field.key} className="grid gap-2 text-sm font-medium text-slate-700">
                      <span>{field.label}</span>
                      <input
                        className={shellInput()}
                        value={(productForm as any)[field.key]}
                        onChange={(e) => setProductForm((v: any) => ({ ...v, [field.key]: e.target.value }))}
                        placeholder={field.label}
                      />
                    </label>
                  )
                )}
                <input
                  className={shellInput()}
                  value={(productForm as any).imageUrl || ""}
                  onChange={(e) => setProductForm((v: any) => ({ ...v, imageUrl: e.target.value }))}
                  placeholder={lang === "ne" ? "उत्पादन फोटो लिंक वा data url" : "Product image URL or data URL"}
                />
                <label className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{lang === "ne" ? "खरिद बिल / सप्लायर बिलको फोटो" : "Purchase bill / supplier bill photo"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-3 block w-full text-sm"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await readFileAsDataUrl(file);
                      setPurchaseBillScan({
                        image: dataUrl,
                        text: "",
                        summary: [],
                        loading: false,
                        error: "",
                        suggestion: {},
                      });
                      e.target.value = "";
                    }}
                  />
                </label>
                {purchaseBillScan.image ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <img src={purchaseBillScan.image} alt="Purchase bill" className="h-56 w-full rounded-2xl bg-white object-contain" />
                    <button
                      type="button"
                      onClick={() => setPurchaseBillScan(createBillScanState())}
                      className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      {lang === "ne" ? "बिल फोटो हटाउनुहोस्" : "Remove bill photo"}
                    </button>
                  </div>
                ) : null}
                <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{lang === "ne" ? "उपकरणबाट उत्पादन फोटो अपलोड गर्नुहोस्" : "Upload product photo from device"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-3 block w-full text-sm"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await readFileAsDataUrl(file);
                      setProductForm((v: any) => ({ ...v, imageUrl: dataUrl }));
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{lang === "ne" ? "क्यामेरा प्रयोग गरेर उत्पादन फोटो खिच्नुहोस्" : "Use camera for product photo"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-3 block w-full text-sm"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await readFileAsDataUrl(file);
                      setProductForm((v: any) => ({ ...v, imageUrl: dataUrl }));
                      e.target.value = "";
                    }}
                  />
                </label>
                {(productForm as any).imageUrl ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <img src={(productForm as any).imageUrl} alt="Product preview" className="h-48 w-full rounded-2xl bg-white object-cover" />
                    <button
                      type="button"
                      onClick={() => setProductForm((v: any) => ({ ...v, imageUrl: "" }))}
                      className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700"
                    >
                      {lang === "ne" ? "फोटो हटाउनुहोस्" : "Remove photo"}
                    </button>
                  </div>
                ) : null}
                <button className="rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">{editingProductId ? text.updateProduct : text.saveProduct}</button>
              </div>
            </form>
            </div>
          </section>
        ) : null}

        {tab === "reports" ? (
          <ReportsTab lang={lang} api={props.api} token={token} />
        ) : null}

        {tab === "branding" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <form onSubmit={saveMediaSettings} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.mediaCenter}</h3>
              <div className="mt-4 grid gap-4">
                <input className={shellInput()} value={settingsForm.shopName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, shopName: e.target.value }))} placeholder={lang === "ne" ? "पसल नाम" : "Shop name"} />
                <input className={shellInput()} value={settingsForm.proprietorName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, proprietorName: e.target.value }))} placeholder={lang === "ne" ? "प्रोप्राइटर नाम" : "Proprietor name"} />
                <input className={shellInput()} value={settingsForm.phone || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, phone: e.target.value }))} placeholder={lang === "ne" ? "फोन नम्बर" : "Phone number"} />
                <textarea className={`${shellInput()} min-h-24`} value={settingsForm.address || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, address: e.target.value }))} placeholder={lang === "ne" ? "ठेगाना" : "Address"} />
                <input className={shellInput()} value={settingsForm.esewaId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, esewaId: e.target.value }))} placeholder="eSewa ID" />
                <input className={shellInput()} value={settingsForm.khaltiId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, khaltiId: e.target.value }))} placeholder="Khalti ID" />
                <textarea className={`${shellInput()} min-h-28`} value={settingsForm.aboutText || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, aboutText: e.target.value }))} placeholder={lang === "ne" ? "व्यवसाय परिचय" : "Business introduction"} />
                <textarea className={`${shellInput()} min-h-28`} value={settingsForm.deliveryPolicy || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, deliveryPolicy: e.target.value }))} placeholder={lang === "ne" ? "डेलिभरी नीति" : "Delivery policy"} />
                <textarea className={`${shellInput()} min-h-24`} value={settingsForm.invoiceFooter || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, invoiceFooter: e.target.value }))} placeholder={lang === "ne" ? "बिल फुटर" : "Invoice footer"} />
                <button disabled={settingsBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">
                  <Save className="h-4 w-4" />
                  {settingsBusy ? (lang === "ne" ? "सेभ हुँदैछ..." : "Saving...") : text.saveMediaSettings}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-950">{lang === "ne" ? "मालिक सुरक्षा" : "Owner security"}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne"
                      ? "मालिक सेसन १५ मिनेट निष्क्रिय भएपछि आफैं बन्द हुन्छ। यहाँबाट पासवर्ड परिवर्तन गर्नुहोस्।"
                      : "Owner sessions lock automatically after 15 minutes of inactivity. Change the owner password here."}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" />{lang === "ne" ? "हालको पासवर्ड" : "Current password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, currentPassword: e.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>{lang === "ne" ? "नयाँ पासवर्ड" : "New password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, newPassword: e.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>{lang === "ne" ? "नयाँ पासवर्ड पुनः लेख्नुहोस्" : "Confirm new password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, confirmPassword: e.target.value }))} />
                </label>
                <button disabled={passwordBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
                  <ShieldCheck className="h-4 w-4" />
                  {passwordBusy ? (lang === "ne" ? "परिवर्तन हुँदैछ..." : "Updating...") : (lang === "ne" ? "पासवर्ड परिवर्तन गर्नुहोस्" : "Change password")}
                </button>
              </div>
            </form>

            {/* Danger zone — wipes demo/test data so the shop can start clean.
                Deliberately placed last, behind a typed phrase and the admin
                password, because it cannot be undone from inside the app. */}
            <section className="rounded-[1.5rem] border-2 border-rose-200 bg-rose-50/40 p-5 shadow-sm">
              <h4 className="flex items-center gap-2 text-xl font-bold text-rose-900">
                <ShieldAlert className="h-5 w-5" />
                {lang === "ne" ? "खतरा क्षेत्र — सबै डाटा मेटाउने" : "Danger zone — erase all data"}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-rose-800">
                {lang === "ne"
                  ? "यसले सबै ग्राहक, बिल, उधारो, भुक्तानी, बुकिङ, डिलर र सामानको रेकर्ड मेटाउँछ। पसलको सेटिङ र तपाईंको लगइन रहन्छ। मेटाउनुअघि ब्याकअप आफैं बन्छ, तर एपभित्रबाट फिर्ता ल्याउन मिल्दैन।"
                  : "This erases every customer, bill, udharo balance, payment, booking, dealer record and product. Your shop settings and login stay. A backup is saved automatically first, but this cannot be undone from inside the app."}
              </p>

              <div className="mt-4 grid gap-3 sm:max-w-md">
                <label className="grid gap-2 text-sm font-medium text-rose-900">
                  <span>{lang === "ne" ? `पक्का गर्न "${RESET_PHRASE}" लेख्नुहोस्` : `Type "${RESET_PHRASE}" to confirm`}</span>
                  <input
                    className={shellInput()}
                    value={resetForm.confirmText}
                    onChange={(e) => setResetForm((v) => ({ ...v, confirmText: e.target.value }))}
                    placeholder={RESET_PHRASE}
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-rose-900">
                  <span>{lang === "ne" ? "आफ्नो पासवर्ड" : "Your admin password"}</span>
                  <input
                    type="password"
                    className={shellInput()}
                    value={resetForm.password}
                    onChange={(e) => setResetForm((v) => ({ ...v, password: e.target.value }))}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  onClick={requestFactoryReset}
                  disabled={resetBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-4 font-semibold text-white disabled:opacity-60"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {resetBusy
                    ? (lang === "ne" ? "मेटाउँदै..." : "Erasing...")
                    : (lang === "ne" ? "सबै डाटा मेटाउनुहोस्" : "Delete all data")}
                </button>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-bold text-slate-950">{lang === "ne" ? "पसल सूचना" : "Shop notices"}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne" ? "होमपेजमा देखिने सूचना यहीँबाट राख्नुहोस्।" : "Manage the notices shown on the homepage here."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((current: any) => ({
                        ...current,
                        announcements: [...(current.announcements || []), { title: "", body: "", status: "active", type: "news", imageUrl: "" }],
                      }))
                    }
                    className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900"
                  >
                    {lang === "ne" ? "सूचना थप्नुहोस्" : "Add notice"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runOwnerAction(
                        () => saveMediaSettings(),
                        lang === "ne" ? "सूचना सेभ भयो" : "Notices saved",
                        lang === "ne" ? "सूचना सेभ गर्न सकिएन।" : "Could not save notices.",
                      )
                    }
                    className="rounded-2xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {lang === "ne" ? "सूचना सेभ गर्नुहोस्" : "Save notices"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                {(settingsForm.announcements || []).length ? (
                  (settingsForm.announcements || []).map((item: any, index: number) => (
                    <div key={`notice-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3">
                        <input
                          className={shellInput()}
                          value={item.title || ""}
                          onChange={(e) =>
                            setSettingsForm((current: any) => ({
                              ...current,
                              announcements: current.announcements.map((entry: any, entryIndex: number) =>
                                entryIndex === index ? { ...entry, title: e.target.value } : entry,
                              ),
                            }))
                          }
                          placeholder={lang === "ne" ? "सूचना शीर्षक" : "Notice title"}
                        />
                        <textarea
                          className={`${shellInput()} min-h-24`}
                          value={item.body || ""}
                          onChange={(e) =>
                            setSettingsForm((current: any) => ({
                              ...current,
                              announcements: current.announcements.map((entry: any, entryIndex: number) =>
                                entryIndex === index ? { ...entry, body: e.target.value } : entry,
                              ),
                            }))
                          }
                          placeholder={lang === "ne" ? "सूचना विवरण" : "Notice details"}
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSettingsForm((current: any) => ({
                                ...current,
                                announcements: current.announcements.filter((_: any, entryIndex: number) => entryIndex !== index),
                              }))
                            }
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                          >
                            {lang === "ne" ? "हटाउनुहोस्" : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {lang === "ne" ? "अहिलेसम्म कुनै सूचना राखिएको छैन।" : "No notices added yet."}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-5">
              {[
                ["bankQrPath", lang === "ne" ? "बैंक QR फोटो" : "Bank QR photo"],
                ["esewaQrPath", lang === "ne" ? "eSewa QR फोटो" : "eSewa QR photo"],
                ["khaltiQrPath", lang === "ne" ? "Khalti QR फोटो" : "Khalti QR photo"],
              ].map(([field, label]) => (
                <div key={field} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xl font-bold text-slate-950">{label}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne"
                      ? "ग्राहकले QR बाट भुक्तानी गर्नु अघि फोन गरेर नाम/युजरनेम पुष्टि गर्नुपर्ने सूचना देखाइनेछ।"
                      : "Customers will be warned to call and confirm the payment name/username before using this QR."}
                  </p>
                  <input className={`${shellInput()} mt-4`} value={settingsForm[field] || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, [field]: e.target.value }))} placeholder={lang === "ne" ? "QR फोटो लिंक वा data url" : "QR image URL or data URL"} />
                  <label className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                    <Upload className="h-4 w-4" />
                    {text.uploadImage}
                    <input type="file" accept="image/*" capture="environment" className="mt-3 block w-full text-sm" onChange={(e) => handleSettingsMediaUpload(e, field as any)} />
                  </label>
                  {settingsForm[field] ? <img src={settingsForm[field]} alt={String(label)} className="mt-4 h-48 w-full rounded-2xl object-contain bg-slate-50 p-3" /> : null}
                </div>
              ))}

              {[
                ["shopPhotoPath", text.shopPhoto],
                ["ownerPhotoPath", text.ownerPhoto],
                ["homeBannerPath", text.bannerPhoto],
              ].map(([field, label]) => (
                <div key={field} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xl font-bold text-slate-950">{label}</h4>
                  <input className={`${shellInput()} mt-4`} value={settingsForm[field] || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, [field]: e.target.value }))} placeholder={lang === "ne" ? "तस्बिर लिंक वा data url" : "Image URL or data URL"} />
                  <label className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                    <Upload className="h-4 w-4" />
                    {text.uploadImage}
                    <input type="file" accept="image/*" capture="environment" className="mt-3 block w-full text-sm" onChange={(e) => handleSettingsMediaUpload(e, field as any)} />
                  </label>
                  {(settingsForm[field] || (field !== "ownerPhotoPath" ? DEFAULT_SHOP_BANNER : "")) ? (
                    <img
                      src={settingsForm[field] || (field !== "ownerPhotoPath" ? DEFAULT_SHOP_BANNER : "")}
                      alt={String(label)}
                      className="mt-4 h-40 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </section>
          </section>
        ) : null}
      </main>

      {confirmDialog ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{confirmDialog.message}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {lang === "ne" ? "पर्दैन" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void confirmDialog.onConfirm()}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CustomerDetailModal
        isOpen={selectedCustomerId !== null}
        onClose={() => setSelectedCustomerId(null)}
        customerId={selectedCustomerId || 0}
        lang={lang as "en" | "ne"}
        api={props.api}
        onRefresh={props.reloadOwnerData}
      />

      <EditOrderModal
        isOpen={editingOrderId !== null}
        onClose={() => setEditingOrderId(null)}
        orderId={editingOrderId || 0}
        onSave={props.reloadOwnerData}
        lang={lang as "en" | "ne"}
        api={props.api}
      />

      <EditBookingModal
        isOpen={editingBookingId !== null}
        onClose={() => setEditingBookingId(null)}
        bookingId={editingBookingId || 0}
        onSave={props.reloadOwnerData}
        lang={lang as "en" | "ne"}
        api={props.api}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-background/96 px-3 pb-3 pt-2 backdrop-blur-xl md:hidden">
        {/* One scrollable row rather than a fixed 5-column grid: the grid wrapped
            the last tabs onto a cramped second line as sections were added. */}
        <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setTab(item.name)}
              className={`flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold ${tab === item.name ? "bg-primary text-primary-foreground" : "text-slate-500"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

