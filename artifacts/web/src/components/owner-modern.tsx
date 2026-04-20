import { useState } from "react";
import { Bell, CheckCircle2, Clock3, CreditCard, ExternalLink, Gift, Home, Languages, LoaderCircle, LockKeyhole, PackagePlus, Printer, ReceiptText, Save, Settings2, ShieldCheck, Sparkles, Store, Truck, Upload, Users, XCircle } from "lucide-react";
import { scanBillImage } from "@/lib/bill-ocr";

const DEFAULT_SHOP_BANNER = "/shop-banner-default.jpeg";
import { GaneshBlessing } from "@/components/ganesh-blessing";
import { NepalDateTime } from "@/components/nepal-date-time";
import { formatNepalDate, formatNepalDateTime, isSameNepalDay } from "@/lib/nepal-time";

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
const when = (value: string) =>
  new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const num = (value: unknown) => Number(value ?? 0);

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
    return { label: lang === "ne" ? "Ã Â¤Â¸Ã Â¤Â«Ã Â¤Â² Ã Â¤Â¡Ã Â¥â€¡Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â­Ã Â¤Â°" : "Delivered", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "cancelled") {
    return { label: lang === "ne" ? "Ã Â¤Â°Ã Â¤Â¦Ã Â¥ÂÃ Â¤Â¦" : "Rejected / Cancelled", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  if (normalized === "dispatched") {
    return { label: lang === "ne" ? "Ã Â¤ÂªÃ Â¤Â Ã Â¤Â¾Ã Â¤â€¡Ã Â¤ÂÃ Â¤â€¢Ã Â¥â€¹" : "Dispatched", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
  }
  if (normalized === "preparing") {
    return { label: lang === "ne" ? "Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â·Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â¿ Ã Â¤Â­Ã Â¤Âˆ Ã Â¤Â¤Ã Â¤Â¯Ã Â¤Â¾Ã Â¤Â°Ã Â¥â‚¬" : "Confirmed / Preparing", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
  }
  return { label: lang === "ne" ? "Ã Â¤Â¨Ã Â¤Â¯Ã Â¤Â¾Ã Â¤Â Ã Â¤â€¦Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¡Ã Â¤Â°" : "New order", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
}

function getOwnerPaymentStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") {
    return { label: lang === "ne" ? "Ã Â¤Â­Ã Â¥ÂÃ Â¤â€¢Ã Â¥ÂÃ Â¤Â¤Ã Â¤Â¾Ã Â¤Â¨Ã Â¥â‚¬ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â·Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â¿" : "Confirmed", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  return { label: lang === "ne" ? "Ã Â¤Â­Ã Â¥ÂÃ Â¤â€¢Ã Â¥ÂÃ Â¤Â¤Ã Â¤Â¾Ã Â¤Â¨Ã Â¥â‚¬ Ã Â¤Â¬Ã Â¤Â¾Ã Â¤ÂÃ Â¤â€¢Ã Â¥â‚¬" : "Pending", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
}

function getOwnerBookingStatusMeta(status: string, lang: "en" | "ne") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "delivered") {
    return { label: lang === "ne" ? "ÃƒÂ Ã‚Â¤Ã‚Â¸ÃƒÂ Ã‚Â¤Ã‚Â•ÃƒÂ Ã‚Â¤Ã‚Â¿ÃƒÂ Ã‚Â¤Ã‚Â¯ÃƒÂ Ã‚Â¥Ã¢â‚¬Â¹" : "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return { label: lang === "ne" ? "ÃƒÂ Ã‚Â¤Ã‚Â°ÃƒÂ Ã‚Â¤Ã‚Â¦ÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã‚Â¦" : "Rejected", className: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  if (normalized === "confirmed") {
    return { label: lang === "ne" ? "ÃƒÂ Ã‚Â¤Ã‚ÂªÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã‚Â·ÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã…Â¸ÃƒÂ Ã‚Â¤Ã‚Â¿" : "Confirmed", className: "border-amber-200 bg-amber-50 text-amber-800", icon: CheckCircle2 };
  }
  return { label: lang === "ne" ? "ÃƒÂ Ã‚Â¤Ã‚Â¨ÃƒÂ Ã‚Â¤Ã‚Â¯ÃƒÂ Ã‚Â¤Ã‚Â¾ÃƒÂ Ã‚Â¤Ã‚Â ÃƒÂ Ã‚Â¤Ã‚Â¬ÃƒÂ Ã‚Â¥Ã‚ÂÃƒÂ Ã‚Â¤Ã¢â‚¬Â¢ÃƒÂ Ã‚Â¤Ã‚Â¿ÃƒÂ Ã‚Â¤Ã¢â‚¬Å¡ÃƒÂ Ã‚Â¤Ã¢â‚¬â€" : "New booking", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Clock3 };
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
  error,
}: any) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7efe1_0%,#eadfcd_52%,#e4d4bf_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] bg-[linear-gradient(160deg,#16345f_0%,#24497d_65%,#2f5d97_100%)] p-7 text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] sm:p-10">
          <div className="inline-flex rounded-full bg-amber-100/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a5200]">
            {text.ownerWorkspace}
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight">{shopName}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/88">
            {lang === "ne"
              ? "à¤®à¤¾à¤²à¤¿à¤•à¤•à¤¾ à¤²à¤¾à¤—à¤¿ à¤¸à¤œà¤¿à¤²à¥‹ à¤¨à¤¿à¤œà¥€ à¤²à¤—à¤‡à¤¨à¥¤ à¤¬à¤¿à¤², à¤—à¥à¤°à¤¾à¤¹à¤• à¤‰à¤§à¤¾à¤°à¥‹, à¤¸à¥à¤Ÿà¤• à¤° à¤¸à¥‡à¤Ÿà¤¿à¤™ à¤¸à¤¬à¥ˆ à¤®à¥‹à¤¬à¤¾à¤‡à¤²à¤®à¤¾ à¤ªà¤¨à¤¿ à¤¸à¤œà¤¿à¤²à¥ˆ à¤šà¤²à¥à¤¨à¥‡ à¤—à¤°à¥€ à¤°à¤¾à¤–à¤¿à¤à¤•à¥‹ à¤›à¥¤"
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

        <form onSubmit={forgotMode ? resetPassword : submitLogin} className="rounded-[2rem] border border-[#d7c3a0] bg-[#fffdf9] p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.4)] sm:p-8">
          <GaneshBlessing compact centered />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">{text.ownerLogin}</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">{shopName}</h2>
            </div>
            <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <Languages className="h-3.5 w-3.5" />
              {lang === "ne" ? "EN" : "à¤¨à¥‡"}
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {text.usernameLabel}
              <input
                className={shellInput()}
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
                  {lang === "ne" ? "à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤•à¥‹à¤¡" : "Reset code"}
                  <input
                    className={shellInput()}
                    value={forgotForm.otp}
                    onChange={(e) => setForgotForm((v: any) => ({ ...v, otp: e.target.value }))}
                    placeholder={lang === "ne" ? "WhatsApp à¤µà¤¾ à¤«à¤²à¤¬à¥à¤¯à¤¾à¤• à¤•à¥‹à¤¡" : "Code from WhatsApp or fallback"}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  {lang === "ne" ? "à¤¨à¤¯à¤¾à¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡" : "New password"}
                  <input
                    type="password"
                    className={shellInput()}
                    value={forgotForm.newPassword}
                    onChange={(e) => setForgotForm((v: any) => ({ ...v, newPassword: e.target.value }))}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  {lang === "ne" ? "à¤¨à¤¯à¤¾à¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¥à¤¨à¤ƒ à¤²à¥‡à¤–à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Confirm new password"}
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
                  <input type="password" className={shellInput()} value={login.password} onChange={(e) => setLogin((v: any) => ({ ...v, password: e.target.value }))} />
                </label>
              </>
            )}
          </div>

          {forgotMode ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-semibold">
                {lang === "ne"
                  ? "à¤ªà¤¹à¤¿à¤²à¥‡ à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤•à¥‹à¤¡ à¤®à¤¾à¤—à¥à¤¨à¥à¤¹à¥‹à¤¸à¥, à¤¤à¥à¤¯à¤¸à¤ªà¤›à¤¿ à¤•à¥‹à¤¡ à¤° à¤¨à¤¯à¤¾à¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤°à¤¾à¤–à¥‡à¤° à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤"
                  : "Request a reset code first, then enter the code and your new password."}
              </p>
              {recoveryInfo?.message ? <p className="mt-2">{recoveryInfo.message}</p> : null}
              {recoveryInfo?.devRecoveryCode ? (
                <p className="mt-2 font-bold">
                  {lang === "ne" ? "à¤¡à¥‡à¤­à¤²à¤ªà¤®à¥‡à¤¨à¥à¤Ÿ à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤•à¥‹à¤¡" : "Development reset code"}: {recoveryInfo.devRecoveryCode}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {forgotMode ? (
              <>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
                  onClick={requestPasswordReset}
                  disabled={resetBusy}
                >
                  {lang === "ne" ? "à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤•à¥‹à¤¡ à¤ªà¤ à¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Send reset code"}
                </button>
                <button className="w-full rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground shadow-lg" disabled={resetBusy}>
                  {resetBusy ? (lang === "ne" ? "à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤¹à¥à¤à¤¦à¥ˆà¤›..." : "Resetting...") : (lang === "ne" ? "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤°à¤¿à¤¸à¥‡à¤Ÿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Reset password")}
                </button>
              </>
            ) : (
              <>
                <button className="w-full rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground shadow-lg">
                  {lang === "ne" ? "à¤²à¤—à¤‡à¤¨ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Log in"}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
            onClick={() => {
              setError("");
              setForgotMode((current: boolean) => !current);
            }}
          >
            {forgotMode
              ? (lang === "ne" ? "à¤²à¤—à¤‡à¤¨à¤®à¤¾ à¤«à¤°à¥à¤•à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Back to login")
              : (lang === "ne" ? "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¬à¤¿à¤°à¥à¤¸à¤¨à¥à¤­à¤¯à¥‹?" : "Forgot password?")}
          </button>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700"
            onClick={() => {
              setError("");
              setOwnerEntryRequested(false);
            }}
          >
            {lang === "ne" ? "à¤ªà¤¸à¤²à¤®à¤¾ à¤«à¤°à¥à¤•à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Back to shop"}
          </button>
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

export function OwnerWorkspaceModern(props: any) {
  const {
    tab, setTab, text, lang, toggleLanguage, shopName, shopAddress, shopPhone,
    summary, orders, bookings, customers, products, preview, invoiceForm, setInvoiceForm, lines, setLines,
    createInvoice, lastInvoice, paymentMethodLabel, paymentForm, setPaymentForm, recordPayment,
    customerForm, setCustomerForm, createCustomer, editingCustomerId, setEditingCustomerId,
    deleteCustomer, startEditCustomer, productForm, setProductForm, createProduct,
    editingProductId, setEditingProductId, startEditProduct, deleteProduct, settingsForm,
    setSettingsForm, saveMediaSettings, settingsBusy, passwordForm, setPasswordForm, passwordBusy, changePassword, readFileAsDataUrl,
    handleSettingsMediaUpload, setToken, setOwnerEntryRequested, updateOrderStatus, updateBookingStatus, externalFeedback,
  } = props;

  const currentCustomer = customers.find((item: any) => item.id === invoiceForm.customerId) || customers[0];
  const quickCustomers = customers.slice(0, 5);
  const quickProducts = products.slice(0, 8);
  const todayInvoices = (summary?.recentInvoices || []).filter((invoice: any) => isSameNepalDay(invoice.createdAt, new Date()));
  const todaySales = todayInvoices.reduce((sum: number, invoice: any) => sum + num(invoice.amountPaid), 0);
  const todayDue = todayInvoices.reduce((sum: number, invoice: any) => sum + num(invoice.dueAmount), 0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [purchaseBillScan, setPurchaseBillScan] = useState<BillScanState>(createBillScanState);
  const [customerBillScan, setCustomerBillScan] = useState<BillScanState>(createBillScanState);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const filteredCustomers = customers.filter((customer: any) => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return true;
    return [customer.name, customer.phone, customer.customerCode].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const filteredProducts = products.filter((product: any) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return true;
    return [product.name, product.sku, product.categoryName].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const newOrders = (orders || []).filter((order: any) => order.status === "order-received");
  const newBookings = (bookings || []).filter((booking: any) => {
    const status = String(booking.status || "").toLowerCase();
    return !status || status === "pending" || status === "requested";
  });

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
        error: lang === "ne" ? "à¤¬à¤¿à¤² à¤ªà¤¢à¥à¤¨ à¤¸à¤•à¥‡à¤¨à¥¤ à¤«à¥‹à¤Ÿà¥‹ à¤¸à¥à¤ªà¤·à¥à¤Ÿ à¤°à¤¾à¤–à¥‡à¤° à¤«à¥‡à¤°à¤¿ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤" : "Could not read the bill. Try again with a clearer photo.",
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
    { name: "orders", label: lang === "ne" ? "à¤…à¤°à¥à¤¡à¤°" : "Orders", icon: Bell },
    { name: "customers", label: text.customers, icon: Users },
    { name: "products", label: text.products, icon: PackagePlus },
    { name: "branding", label: text.branding, icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9f1_0%,#f2ebdf_100%)] pb-24">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">{text.ownerWorkspace}</p>
            <h1 className="truncate text-2xl font-bold text-slate-950">{shopName}</h1>
            <p className="truncate text-xs text-slate-500">{shopAddress}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <Languages className="h-3.5 w-3.5" />
              {lang === "ne" ? "EN" : "à¤¨à¥‡"}
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
              {item.name === "orders" && newOrders.length ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === item.name ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
                  {newOrders.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {(externalFeedback || actionFeedback) ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
              (externalFeedback || actionFeedback).type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {(externalFeedback || actionFeedback).type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
              <span>{(externalFeedback || actionFeedback).message}</span>
            </div>
          </div>
        ) : null}

        <div className="grid items-center gap-3 overflow-hidden rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8ef_0%,#f4e0ba_100%)] px-4 py-3 shadow-sm lg:grid-cols-[0.9fr_1.3fr_0.9fr]">
          <div className="flex h-12 items-center justify-center rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-3 text-center text-sm font-bold leading-tight text-amber-50 shadow-sm sm:h-14 sm:text-base">
            à¥ à¤¶à¥à¤°à¥€ à¤—à¤£à¥‡à¤¶à¤¾à¤¯ à¤¨à¤®à¤ƒ
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
                {lang === "ne" ? "à¤®à¤¾à¤²à¤¿à¤• à¤•à¤¾à¤® à¤ªà¥à¤¯à¤¾à¤¨à¤²" : "Owner workspace"}
              </span>
              {newOrders.length ? (
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className="rounded-full bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950"
                >
                  {lang === "ne" ? `à¤¨à¤¯à¤¾à¤ à¤…à¤°à¥à¤¡à¤° ${newOrders.length}` : `New orders ${newOrders.length}`}
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
                    {lang === "ne" ? "à¤¨à¥‡à¤ªà¤¾à¤² à¤†à¤œ" : "Today in Nepal"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">{formatNepalDate(new Date(), lang)}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤†à¤œà¤•à¤¾ à¤¬à¤¿à¤²" : "Bills today"}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{todayInvoices.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤†à¤œ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤" : "Collected today"}</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-700">{money(todaySales)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤†à¤œ à¤¬à¤¾à¤à¤•à¥€" : "Due today"}</p>
                    <p className="mt-2 text-xl font-semibold text-amber-700">{money(todayDue)}</p>
                  </div>
                </div>
              </div>
            </div>
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
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.recentInvoices}</h3>
              <div className="mt-4 grid gap-3">
                {summary.recentInvoices.map((invoice: any) => (
                  <div key={invoice.id} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{invoice.invoiceNumber}</p>
                        <p className="text-slate-500">{invoice.customerName}</p>
                        <p className="text-slate-400">{formatNepalDateTime(invoice.createdAt, lang)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.paid} {money(invoice.amountPaid)}</span>
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{text.due} {money(invoice.dueAmount)}</span>
                      </div>
                      <span className="text-slate-500">{when(invoice.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </section>
        ) : null}

        {tab === "billing" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <form onSubmit={createInvoice} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "à¤•à¤¾à¤‰à¤¨à¥à¤Ÿà¤° à¤¬à¤¿à¤•à¥à¤°à¥€" : "Counter Sale"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "à¤¦à¥ˆà¤¨à¤¿à¤• à¤ªà¤¸à¤² à¤¬à¤¿à¤•à¥à¤°à¥€, à¤¨à¤—à¤¦, à¤‰à¤§à¤¾à¤°à¥‹, à¤° à¤¸à¥à¤Ÿà¤• à¤°à¥‡à¤•à¤°à¥à¤¡ à¤¯à¤¹à¥€à¤ à¤°à¤¾à¤–à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤" : "Record daily shop sales, cash, credit, and stock changes here."}</p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white">{text.totalPreview}: {money(preview.total)}</div>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤›à¤¿à¤Ÿà¥‹ à¤—à¥à¤°à¤¾à¤¹à¤• à¤›à¤¨à¥‹à¤Ÿ" : "Quick customer pick"}</p>
                  <input
                    className={`${shellInput()} mt-3`}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder={lang === "ne" ? "à¤¨à¤¾à¤®, à¤«à¥‹à¤¨ à¤µà¤¾ à¤—à¥à¤°à¤¾à¤¹à¤• à¤•à¥‹à¤¡ à¤–à¥‹à¤œà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Search name, phone, or customer code"}
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
                  {filteredCustomers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name} ({money(num(customer.creditBalance))} {text.due})</option>)}
                </select>
                {currentCustomer ? (
                  <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤•" : "Customer"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{currentCustomer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "à¤ªà¥à¤°à¤¾à¤¨à¥‹ à¤¬à¤¾à¤à¤•à¥€" : "Previous due"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{money(preview.previousDue)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{lang === "ne" ? "à¤«à¥‹à¤¨" : "Phone"}</p>
                      <p className="mt-1 font-semibold text-slate-950">{currentCustomer.phone || text.noPhoneSaved}</p>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤›à¤¿à¤Ÿà¥‹ à¤¸à¤¾à¤®à¤¾à¤¨ à¤¥à¤ªà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Quick add products"}</p>
                  <input
                    className={`${shellInput()} mt-3`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨ à¤µà¤¾ SKU à¤–à¥‹à¤œà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Search product or SKU"}
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
                <button type="button" className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-medium text-slate-900" onClick={() => products[0] && setLines((items: any[]) => [...items, { productId: products[0].id, quantity: 1 }])}>{lang === "ne" ? "à¤…à¤°à¥à¤•à¥‹ à¤¸à¤¾à¤®à¤¾à¤¨ à¤¥à¤ªà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Add another item"}</button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className={shellInput()} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, paymentMethod: e.target.value }))}>
                    {["cash", "credit", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                  <input type="number" min={0} className={shellInput()} value={invoiceForm.amountPaid} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, amountPaid: e.target.value }))} placeholder={text.amountReceivedNow} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "cash", amountPaid: String(preview.total) }))}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  >
                    {lang === "ne" ? "à¤ªà¥‚à¤°à¤¾ à¤¨à¤—à¤¦" : "Full Cash"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "credit", amountPaid: "0" }))}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
                  >
                    {lang === "ne" ? "à¤ªà¥‚à¤°à¤¾ à¤‰à¤§à¤¾à¤°à¥‹" : "Full Credit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm((v: any) => ({ ...v, paymentMethod: "cash", amountPaid: String(Math.max(Math.round(preview.total / 2), 0)) }))}
                    className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    {lang === "ne" ? "à¤†à¤§à¤¾ à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€" : "Partial Payment"}
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
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤• à¤¬à¤¿à¤² à¤«à¥‹à¤Ÿà¥‹" : "Customer bill photo"}</p>
                  <label className="mt-3 block rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
                    {lang === "ne" ? "à¤¬à¤¿à¤²à¤•à¥‹ à¤«à¥‹à¤Ÿà¥‹ à¤–à¤¿à¤šà¥à¤¨à¥à¤¹à¥‹à¤¸à¥ à¤µà¤¾ à¤…à¤ªà¤²à¥‹à¤¡ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Take or upload the bill photo"}
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
                        {lang === "ne" ? "à¤«à¥‹à¤Ÿà¥‹ à¤¹à¤Ÿà¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Remove photo"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <textarea className={`${shellInput()} min-h-24`} value={invoiceForm.note} onChange={(e) => setInvoiceForm((v: any) => ({ ...v, note: e.target.value }))} placeholder={text.billNote} />
                <button className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-foreground shadow-lg">{lang === "ne" ? "à¤¬à¤¿à¤•à¥à¤°à¥€ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Save Sale"}</button>
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
                    <span>{lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨" : "Item"}</span>
                    <span>{lang === "ne" ? "à¤ªà¤°à¤¿à¤®à¤¾à¤£" : "Qty"}</span>
                    <span>{lang === "ne" ? "à¤¦à¤°" : "Rate"}</span>
                    <span>{lang === "ne" ? "à¤°à¤•à¤®" : "Amount"}</span>
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
                      {lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨ à¤¥à¤ªà¥‡à¤ªà¤›à¤¿ à¤¬à¤¿à¤² à¤µà¤¿à¤µà¤°à¤£ à¤¯à¤¹à¤¾à¤ à¤¦à¥‡à¤–à¤¿à¤¨à¥à¤›à¥¤" : "Add products to see the bill details here."}
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

              <div className="print-bill-sheet hidden">
                <div className="mx-auto max-w-[800px] bg-white px-8 py-8 text-slate-950">
                  <div className="mb-6 border-b-2 border-slate-200 pb-5 text-center">
                    <img
                      src="/ganesh-banner.png"
                      alt="Om Shree Ganeshaya Namah"
                      className="mx-auto h-24 w-auto max-w-full rounded-[1.25rem] object-contain"
                    />
                    <div className="mt-3">
                      <NepalDateTime lang={lang} centered />
                    </div>
                  </div>
                  <div className="border-b-2 border-slate-900 pb-5">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <h3 className="text-3xl font-bold">{shopName}</h3>
                        <p className="mt-2 text-sm text-slate-600">{shopAddress}</p>
                        <p className="text-sm text-slate-600">{shopPhone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-800">{text.invoicePreview}</p>
                        <p className="mt-2 text-sm text-slate-600">{lastInvoice?.invoice?.invoiceNumber || "Draft"}</p>
                        <p className="text-sm text-slate-600">{formatNepalDateTime(new Date(), lang)}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤•" : "Customer"}</p>
                        <p className="mt-2 text-lg font-semibold">{currentCustomer?.name || "-"}</p>
                        <p className="text-sm text-slate-600">{currentCustomer?.phone || text.noPhoneSaved}</p>
                        <p className="text-sm text-slate-600">{currentCustomer?.address || text.noAddressSaved}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                          [text.previousDue, money(preview.previousDue)],
                          [text.currentBill, money(preview.subtotal)],
                          [text.paidNow, money(preview.amountPaid)],
                          [text.remainingDue, money(preview.due)],
                        ].map(([label, value]) => (
                          <div key={`print-${String(label)}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                            <p className="mt-2 font-semibold text-slate-950">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <table className="mt-6 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="px-4 py-3">{lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨" : "Item"}</th>
                        <th className="px-4 py-3">{lang === "ne" ? "à¤ªà¤°à¤¿à¤®à¤¾à¤£" : "Qty"}</th>
                        <th className="px-4 py-3">{lang === "ne" ? "à¤¦à¤°" : "Rate"}</th>
                        <th className="px-4 py-3">{lang === "ne" ? "à¤°à¤•à¤®" : "Amount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.length ? preview.items.map((item: any) => (
                        <tr key={`print-${item.productId}-${item.name}`}>
                          <td className="border-b border-slate-200 px-4 py-3">{item.name}</td>
                          <td className="border-b border-slate-200 px-4 py-3">{item.quantity} {item.unit}</td>
                          <td className="border-b border-slate-200 px-4 py-3">{money(item.price)}</td>
                          <td className="border-b border-slate-200 px-4 py-3">{money(item.total)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            {lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨ à¤¥à¤ªà¥‡à¤ªà¤›à¤¿ à¤¬à¤¿à¤² à¤ªà¥à¤°à¤¿à¤¨à¥à¤Ÿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤" : "Add products before printing the bill."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                      <p className="font-semibold text-slate-950">{text.payment}</p>
                      <p className="mt-2 text-slate-700">{paymentMethodLabel}</p>
                      {invoiceForm.note ? <p className="mt-2 text-slate-600">{invoiceForm.note}</p> : null}
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                      <p className="font-semibold text-slate-950">{text.rewardEarned}</p>
                      <p className="mt-2 text-slate-700">{preview.rewardPoints}</p>
                    </div>
                  </div>

                  {settingsForm.invoiceFooter ? (
                    <p className="mt-8 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">{settingsForm.invoiceFooter}</p>
                  ) : null}
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
                  <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "à¤…à¤¨à¤²à¤¾à¤‡à¤¨ à¤…à¤°à¥à¤¡à¤°" : "Online Orders"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "à¤µà¥‡à¤¬à¤¸à¤¾à¤‡à¤Ÿà¤¬à¤¾à¤Ÿ à¤†à¤à¤•à¤¾ à¤…à¤°à¥à¤¡à¤° à¤¯à¤¹à¤¾à¤ à¤¦à¥‡à¤–à¤¿à¤¨à¥à¤›à¤¨à¥à¥¤" : "Orders created from the website appear here."}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  {lang === "ne" ? "à¤¨à¤¯à¤¾à¤ à¤…à¤°à¥à¤¡à¤°" : "New orders"}: {newOrders.length + newBookings.length}
                </div>
              </div>
              <div className="mt-5 grid gap-4">
                {(orders || []).slice().reverse().map((order: any) => (
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
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "preparing"), lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤­à¤¯à¥‹à¥¤" : "Order confirmed", lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤—à¤°à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not confirm the order.")} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                          {lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Confirm order"}
                        </button>
                      ) : null}
                      {order.status === "preparing" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "dispatched"), lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤ªà¤ à¤¾à¤‡à¤à¤•à¥‹ à¤°à¥‚à¤ªà¤®à¤¾ à¤°à¤¾à¤–à¤¿à¤¯à¥‹à¥¤" : "Order dispatched", lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤ªà¤ à¤¾à¤‡à¤à¤•à¥‹ à¤°à¥‚à¤ªà¤®à¤¾ à¤°à¤¾à¤–à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not mark the order as dispatched.")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                          {lang === "ne" ? "à¤ªà¤ à¤¾à¤‡à¤à¤•à¥‹" : "Mark dispatched"}
                        </button>
                      ) : null}
                      {order.status === "dispatched" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "delivered"), lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤¡à¥‡à¤²à¤¿à¤­à¤° à¤­à¤à¤•à¥‹ à¤°à¥‚à¤ªà¤®à¤¾ à¤°à¤¾à¤–à¤¿à¤¯à¥‹à¥¤" : "Order delivered", lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤¡à¥‡à¤²à¤¿à¤­à¤° à¤­à¤à¤•à¥‹ à¤°à¥‚à¤ªà¤®à¤¾ à¤°à¤¾à¤–à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not mark the order as delivered.")} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                          {lang === "ne" ? "à¤¡à¥‡à¤²à¤¿à¤­à¤° à¤­à¤¯à¥‹" : "Mark delivered"}
                        </button>
                      ) : null}
                      {order.paymentStatus !== "paid" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, order.status, "paid"), lang === "ne" ? "à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤­à¤¯à¥‹à¥¤" : "Payment received", lang === "ne" ? "à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤—à¤°à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not confirm the payment.")} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                          {lang === "ne" ? "à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿" : "Confirm payment"}
                        </button>
                      ) : null}
                      {order.status !== "cancelled" && order.status !== "delivered" ? (
                        <button type="button" onClick={() => runOwnerAction(() => updateOrderStatus(order.id, "cancelled"), lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤°à¤¦à¥à¤¦ à¤—à¤°à¤¿à¤¯à¥‹à¥¤" : "Order rejected", lang === "ne" ? "à¤…à¤°à¥à¤¡à¤° à¤°à¤¦à¥à¤¦ à¤—à¤°à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not cancel the order.")} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                          {lang === "ne" ? "à¤°à¤¦à¥à¤¦" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {(bookings || []).slice().reverse().map((booking: any) => {
                  const bookingStatus = getOwnerBookingStatusMeta(booking.status, lang === "ne" ? "ne" : "en");
                  const bookingLabel =
                    booking.serviceType === "tractor"
                      ? "Tractor"
                      : booking.serviceType === "telcoline"
                        ? "Tata Telcoline"
                        : "Bolero";

                  return (
                    <article key={`booking-${booking.id}`} className="rounded-[1.5rem] border border-amber-200 bg-amber-50/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-slate-950">#{booking.id} {booking.customerName}</p>
                          <p className="text-sm font-medium text-slate-700">{bookingLabel} booking</p>
                          <p className="text-sm text-slate-500">{booking.customerPhone}</p>
                          <p className="text-sm text-slate-500">{booking.pickupLocation} → {booking.destination}</p>
                          <p className="mt-1 text-sm text-slate-400">{when(booking.bookingDate || booking.createdAt)}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${bookingStatus.className}`}>
                          <bookingStatus.icon className="h-4 w-4" />
                          {bookingStatus.label}
                        </span>
                      </div>
                      {booking.notes ? (
                        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          {booking.notes}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {booking.status !== "confirmed" && booking.status !== "completed" && booking.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => runOwnerAction(() => updateBookingStatus(booking.id, "confirmed"), lang === "ne" ? "अर्डर पुष्टि भयो" : "Order confirmed", lang === "ne" ? "बुकिङ पुष्टि गर्न सकिएन।" : "Could not confirm the booking.")}
                            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                          >
                            {lang === "ne" ? "अर्डर पुष्टि गर्नुहोस्" : "Confirm order"}
                          </button>
                        ) : null}
                        {booking.status !== "completed" && booking.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => runOwnerAction(() => updateBookingStatus(booking.id, "completed"), lang === "ne" ? "अर्डर डेलिभर भयो" : "Order delivered", lang === "ne" ? "बुकिङ सम्पन्न गर्न सकिएन।" : "Could not complete the booking.")}
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                          >
                            {lang === "ne" ? "डेलिभर भयो" : "Mark delivered"}
                          </button>
                        ) : null}
                        {booking.status !== "cancelled" && booking.status !== "completed" ? (
                          <button
                            type="button"
                            onClick={() => runOwnerAction(() => updateBookingStatus(booking.id, "cancelled"), lang === "ne" ? "अर्डर रद्द भयो" : "Order rejected", lang === "ne" ? "बुकिङ रद्द गर्न सकिएन।" : "Could not reject the booking.")}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                          >
                            {lang === "ne" ? "रद्द" : "Reject"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "customers" ? (
          <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.customerLedger}</h3>
              <div className="mt-4 grid gap-3">
                {customers.map((customer: any) => (
                  <article key={customer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-bold text-slate-950">{customer.name}</h4>
                        <p className="text-sm text-slate-500">{customer.phone || text.noPhoneSaved}</p>
                        <p className="text-sm text-slate-500">{customer.address || text.noAddressSaved}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{text.due}: {money(num(customer.creditBalance))}</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.rewardPoints}: {customer.rewardPoints}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEditCustomer(customer)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{text.edit}</button>
                      <button type="button" onClick={() => runOwnerAction(() => deleteCustomer(customer.id), lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤• à¤¹à¤Ÿà¤¾à¤‡à¤¯à¥‹à¥¤" : "Customer deleted successfully.", lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤• à¤¹à¤Ÿà¤¾à¤‰à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not delete the customer.")} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{text.delete}</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <form onSubmit={recordPayment} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-950">{text.recordPayment}</h3>
                <div className="mt-4 grid gap-4">
                  <select className={shellInput()} value={paymentForm.customerId} onChange={(e) => setPaymentForm((v: any) => ({ ...v, customerId: Number(e.target.value) }))}>
                    {customers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                  <input type="number" min={0} className={shellInput()} value={paymentForm.amount} onChange={(e) => setPaymentForm((v: any) => ({ ...v, amount: e.target.value }))} placeholder={text.amount} />
                  <select className={shellInput()} value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((v: any) => ({ ...v, paymentMethod: e.target.value }))}>
                    {["cash", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                  <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                    {lang === "ne" ? "à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€ à¤°à¤¸à¤¿à¤¦/à¤¬à¤¿à¤²à¤•à¥‹ à¤«à¥‹à¤Ÿà¥‹" : "Payment receipt/bill photo"}
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
                <h3 className="text-2xl font-bold text-slate-950">{editingCustomerId ? `${text.edit} ${lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤•" : "customer"}` : text.addCustomer}</h3>
                <div className="mt-4 grid gap-4">
                  <input className={shellInput()} value={customerForm.name} onChange={(e) => setCustomerForm((v: any) => ({ ...v, name: e.target.value }))} placeholder={lang === "ne" ? "à¤¨à¤¾à¤®" : "Name"} />
                  <input className={shellInput()} value={customerForm.phone} onChange={(e) => setCustomerForm((v: any) => ({ ...v, phone: e.target.value }))} placeholder={lang === "ne" ? "à¤«à¥‹à¤¨" : "Phone"} />
                  <textarea className={`${shellInput()} min-h-24`} value={customerForm.address} onChange={(e) => setCustomerForm((v: any) => ({ ...v, address: e.target.value }))} placeholder={lang === "ne" ? "à¤ à¥‡à¤—à¤¾à¤¨à¤¾" : "Address"} />
                  <textarea className={`${shellInput()} min-h-24`} value={customerForm.notes} onChange={(e) => setCustomerForm((v: any) => ({ ...v, notes: e.target.value }))} placeholder={text.notes} />
                  <button className="rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">{editingCustomerId ? (lang === "ne" ? "à¤—à¥à¤°à¤¾à¤¹à¤• à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Update customer") : text.createCustomerButton}</button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {tab === "products" ? (
          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.productCosts}</h3>
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
                            {expandedProductId === product.id ? (lang === "ne" ? "à¤²à¥à¤•à¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Hide") : (lang === "ne" ? "à¤¹à¥‡à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "View")}
                          </button>
                          <button type="button" onClick={() => startEditProduct(product)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{text.edit}</button>
                          <button type="button" onClick={() => runOwnerAction(() => deleteProduct(product.id), lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨ à¤¹à¤Ÿà¤¾à¤‡à¤¯à¥‹à¥¤" : "Product deleted successfully.", lang === "ne" ? "à¤¸à¤¾à¤®à¤¾à¤¨ à¤¹à¤Ÿà¤¾à¤‰à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not delete the product.")} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{text.delete}</button>
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
                {[
                  { key: "name", label: "Product name" },
                  { key: "sku", label: "SKU / code" },
                  { key: "description", label: "Description" },
                  { key: "price", label: "Selling price" },
                  { key: "buyingPrice", label: "Buying price" },
                  { key: "transportationCost", label: "Transport cost" },
                  { key: "extraCost", label: "Extra cost" },
                  { key: "stockQuantity", label: "Stock quantity" },
                  { key: "reorderLevel", label: "Reorder level" },
                  { key: "unit", label: "Unit" },
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
                  placeholder={lang === "ne" ? "à¤‰à¤¤à¥à¤ªà¤¾à¤¦à¤¨ à¤«à¥‹à¤Ÿà¥‹ à¤²à¤¿à¤‚à¤• à¤µà¤¾ data url" : "Product image URL or data URL"}
                />
                <label className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{lang === "ne" ? "à¤–à¤°à¤¿à¤¦ à¤¬à¤¿à¤² / à¤¸à¤ªà¥à¤²à¤¾à¤¯à¤° à¤¬à¤¿à¤²à¤•à¥‹ à¤«à¥‹à¤Ÿà¥‹" : "Purchase bill / supplier bill photo"}</span>
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
                      {lang === "ne" ? "à¤¬à¤¿à¤² à¤«à¥‹à¤Ÿà¥‹ à¤¹à¤Ÿà¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Remove bill photo"}
                    </button>
                  </div>
                ) : null}
                <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{lang === "ne" ? "à¤‰à¤ªà¤•à¤°à¤£à¤¬à¤¾à¤Ÿ à¤‰à¤¤à¥à¤ªà¤¾à¤¦à¤¨ à¤«à¥‹à¤Ÿà¥‹ à¤…à¤ªà¤²à¥‹à¤¡ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Upload product photo from device"}</span>
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
                    <span>{lang === "ne" ? "à¤•à¥à¤¯à¤¾à¤®à¥‡à¤°à¤¾ à¤ªà¥à¤°à¤¯à¥‹à¤— à¤—à¤°à¥‡à¤° à¤‰à¤¤à¥à¤ªà¤¾à¤¦à¤¨ à¤«à¥‹à¤Ÿà¥‹ à¤–à¤¿à¤šà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Use camera for product photo"}</span>
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
                      {lang === "ne" ? "à¤«à¥‹à¤Ÿà¥‹ à¤¹à¤Ÿà¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Remove photo"}
                    </button>
                  </div>
                ) : null}
                <button className="rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">{editingProductId ? text.updateProduct : text.saveProduct}</button>
              </div>
            </form>
          </section>
        ) : null}

        {tab === "branding" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <form onSubmit={saveMediaSettings} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">{text.mediaCenter}</h3>
              <div className="mt-4 grid gap-4">
                <input className={shellInput()} value={settingsForm.shopName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, shopName: e.target.value }))} placeholder={lang === "ne" ? "à¤ªà¤¸à¤² à¤¨à¤¾à¤®" : "Shop name"} />
                <input className={shellInput()} value={settingsForm.proprietorName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, proprietorName: e.target.value }))} placeholder={lang === "ne" ? "à¤ªà¥à¤°à¥‹à¤ªà¥à¤°à¤¾à¤‡à¤Ÿà¤° à¤¨à¤¾à¤®" : "Proprietor name"} />
                <input className={shellInput()} value={settingsForm.phone || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, phone: e.target.value }))} placeholder={lang === "ne" ? "à¤«à¥‹à¤¨ à¤¨à¤®à¥à¤¬à¤°" : "Phone number"} />
                <textarea className={`${shellInput()} min-h-24`} value={settingsForm.address || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, address: e.target.value }))} placeholder={lang === "ne" ? "à¤ à¥‡à¤—à¤¾à¤¨à¤¾" : "Address"} />
                <input className={shellInput()} value={settingsForm.esewaId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, esewaId: e.target.value }))} placeholder="eSewa ID" />
                <input className={shellInput()} value={settingsForm.khaltiId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, khaltiId: e.target.value }))} placeholder="Khalti ID" />
                <textarea className={`${shellInput()} min-h-28`} value={settingsForm.aboutText || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, aboutText: e.target.value }))} placeholder={lang === "ne" ? "à¤µà¥à¤¯à¤µà¤¸à¤¾à¤¯ à¤ªà¤°à¤¿à¤šà¤¯" : "Business introduction"} />
                <textarea className={`${shellInput()} min-h-28`} value={settingsForm.deliveryPolicy || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, deliveryPolicy: e.target.value }))} placeholder={lang === "ne" ? "à¤¡à¥‡à¤²à¤¿à¤­à¤°à¥€ à¤¨à¥€à¤¤à¤¿" : "Delivery policy"} />
                <textarea className={`${shellInput()} min-h-24`} value={settingsForm.invoiceFooter || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, invoiceFooter: e.target.value }))} placeholder={lang === "ne" ? "à¤¬à¤¿à¤² à¤«à¥à¤Ÿà¤°" : "Invoice footer"} />
                <button disabled={settingsBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 font-semibold text-accent-foreground">
                  <Save className="h-4 w-4" />
                  {settingsBusy ? (lang === "ne" ? "à¤¸à¥‡à¤­ à¤¹à¥à¤à¤¦à¥ˆà¤›..." : "Saving...") : text.saveMediaSettings}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-950">{lang === "ne" ? "à¤®à¤¾à¤²à¤¿à¤• à¤¸à¥à¤°à¤•à¥à¤·à¤¾" : "Owner security"}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne"
                      ? "à¤®à¤¾à¤²à¤¿à¤• à¤¸à¥‡à¤¸à¤¨ à¥§à¥« à¤®à¤¿à¤¨à¥‡à¤Ÿ à¤¨à¤¿à¤·à¥à¤•à¥à¤°à¤¿à¤¯ à¤­à¤à¤ªà¤›à¤¿ à¤†à¤«à¥ˆà¤‚ à¤¬à¤¨à¥à¤¦ à¤¹à¥à¤¨à¥à¤›à¥¤ à¤¯à¤¹à¤¾à¤à¤¬à¤¾à¤Ÿ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤"
                      : "Owner sessions lock automatically after 15 minutes of inactivity. Change the owner password here."}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" />{lang === "ne" ? "à¤¹à¤¾à¤²à¤•à¥‹ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡" : "Current password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, currentPassword: e.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>{lang === "ne" ? "à¤¨à¤¯à¤¾à¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡" : "New password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, newPassword: e.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>{lang === "ne" ? "à¤¨à¤¯à¤¾à¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¥à¤¨à¤ƒ à¤²à¥‡à¤–à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Confirm new password"}</span>
                  <input type="password" className={shellInput()} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((current: any) => ({ ...current, confirmPassword: e.target.value }))} />
                </label>
                <button disabled={passwordBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
                  <ShieldCheck className="h-4 w-4" />
                  {passwordBusy ? (lang === "ne" ? "à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨ à¤¹à¥à¤à¤¦à¥ˆà¤›..." : "Updating...") : (lang === "ne" ? "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Change password")}
                </button>
              </div>
            </form>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-bold text-slate-950">{lang === "ne" ? "à¤ªà¤¸à¤² à¤¸à¥‚à¤šà¤¨à¤¾" : "Shop notices"}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne" ? "à¤¹à¥‹à¤®à¤ªà¥‡à¤œà¤®à¤¾ à¤¦à¥‡à¤–à¤¿à¤¨à¥‡ à¤¸à¥‚à¤šà¤¨à¤¾ à¤¯à¤¹à¥€à¤à¤¬à¤¾à¤Ÿ à¤°à¤¾à¤–à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤" : "Manage the notices shown on the homepage here."}
                  </p>
                </div>
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
                  {lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤¥à¤ªà¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Add notice"}
                </button>
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
                          placeholder={lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤¶à¥€à¤°à¥à¤·à¤•" : "Notice title"}
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
                          placeholder={lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤µà¤¿à¤µà¤°à¤£" : "Notice details"}
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
                            {lang === "ne" ? "à¤¹à¤Ÿà¤¾à¤‰à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {lang === "ne" ? "à¤…à¤¹à¤¿à¤²à¥‡à¤¸à¤®à¥à¤® à¤•à¥à¤¨à¥ˆ à¤¸à¥‚à¤šà¤¨à¤¾ à¤°à¤¾à¤–à¤¿à¤à¤•à¥‹ à¤›à¥ˆà¤¨à¥¤" : "No notices added yet."}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      runOwnerAction(
                        () => saveMediaSettings(),
                        lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤¸à¥‡à¤­" : "Notices saved",
                        lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤¸à¥‡à¤­ à¤—à¤°à¥à¤¨ à¤¸à¤•à¤¿à¤à¤¨à¥¤" : "Could not save notices.",
                      )
                    }
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {lang === "ne" ? "à¤¸à¥‚à¤šà¤¨à¤¾ à¤¸à¥‡à¤­ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥" : "Save notices"}
                  </button>
                  <p className="text-sm text-slate-500">
                    {lang === "ne" ? "à¤¯à¥‹ à¤¬à¤Ÿà¤¨à¤²à¥‡ à¤¸à¥‚à¤šà¤¨à¤¾ à¤®à¤¾à¤¤à¥à¤° à¤¸à¥‡à¤­ à¤—à¤°à¥à¤›à¥¤" : "This saves only the notices above."}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              {[
                ["bankQrPath", lang === "ne" ? "à¤¬à¥ˆà¤‚à¤• QR à¤«à¥‹à¤Ÿà¥‹" : "Bank QR photo"],
                ["esewaQrPath", lang === "ne" ? "eSewa QR à¤«à¥‹à¤Ÿà¥‹" : "eSewa QR photo"],
                ["khaltiQrPath", lang === "ne" ? "Khalti QR à¤«à¥‹à¤Ÿà¥‹" : "Khalti QR photo"],
              ].map(([field, label]) => (
                <div key={field} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xl font-bold text-slate-950">{label}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lang === "ne"
                      ? "à¤—à¥à¤°à¤¾à¤¹à¤•à¤²à¥‡ QR à¤¬à¤¾à¤Ÿ à¤­à¥à¤•à¥à¤¤à¤¾à¤¨à¥€ à¤—à¤°à¥à¤¨à¥ à¤…à¤˜à¤¿ à¤«à¥‹à¤¨ à¤—à¤°à¥‡à¤° à¤¨à¤¾à¤®/à¤¯à¥à¤œà¤°à¤¨à¥‡à¤® à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤—à¤°à¥à¤¨à¥à¤ªà¤°à¥à¤¨à¥‡ à¤¸à¥‚à¤šà¤¨à¤¾ à¤¦à¥‡à¤–à¤¾à¤‡à¤¨à¥‡à¤›à¥¤"
                      : "Customers will be warned to call and confirm the payment name/username before using this QR."}
                  </p>
                  <input className={`${shellInput()} mt-4`} value={settingsForm[field] || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, [field]: e.target.value }))} placeholder={lang === "ne" ? "QR à¤«à¥‹à¤Ÿà¥‹ à¤²à¤¿à¤‚à¤• à¤µà¤¾ data url" : "QR image URL or data URL"} />
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
                  <input className={`${shellInput()} mt-4`} value={settingsForm[field] || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, [field]: e.target.value }))} placeholder={lang === "ne" ? "à¤¤à¤¸à¥à¤¬à¤¿à¤° à¤²à¤¿à¤‚à¤• à¤µà¤¾ data url" : "Image URL or data URL"} />
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-background/96 px-3 pb-3 pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
          {nav.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setTab(item.name)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold ${tab === item.name ? "bg-primary text-primary-foreground" : "text-slate-500"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

