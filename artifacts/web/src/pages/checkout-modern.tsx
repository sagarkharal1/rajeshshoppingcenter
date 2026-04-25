import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, Home, MessageCircle, Phone, Printer, Search, Store } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { useGetSettings } from "@workspace/api-client-react";
import { FlashNotice } from "@/components/flash-notice";

const CUSTOMER_PORTAL_STORAGE_KEY = "rajesh_customer_portal";

function downloadImage(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const NEPALI_WARNING =
  "भुक्तानी गर्नु अघि कृपया फोन गरेर भुक्तानी प्राप्त गर्ने नाम वा युजरनेम पुष्टि गर्नुहोस्। QR कोड वा भुक्तानी विवरण परिवर्तन भएको हुन सक्छ। सुरक्षित भुक्तानीका लागि पहिले पुष्टि गर्नुहोस्।";

export default function CheckoutModern() {
  const { t, lang } = useLanguage();
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { data: settings } = useGetSettings();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    customerPhotoPath: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "esewa" | "khalti">("bank");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string>("");
  const [placedItems, setPlacedItems] = useState<typeof items>([]);
  const [placedTotal, setPlacedTotal] = useState(0);
  const [customerCode, setCustomerCode] = useState("");

  const publicSettings = (settings ?? {}) as Record<string, unknown>;
  const ownerPhone = String(publicSettings.whatsappPhone || publicSettings.phone || "+9779814401716");
  const proprietorName = String(publicSettings.proprietorName || "Sandesh Kharal");
  const bankName = String(publicSettings.bankName || "Rajesh Shopping Center Bank");
  const bankBranch = String(publicSettings.bankBranch || "Call for branch details");
  const accountName = String(publicSettings.accountName || "Rajesh Shopping Center");
  const accountNumber = String(publicSettings.accountNumber || "Call before payment");
  const bankQrPath = publicSettings.bankQrPath ? String(publicSettings.bankQrPath) : null;
  const esewaId = publicSettings.esewaId ? String(publicSettings.esewaId) : null;
  const esewaQrPath = publicSettings.esewaQrPath ? String(publicSettings.esewaQrPath) : null;
  const khaltiId = publicSettings.khaltiId ? String(publicSettings.khaltiId) : null;
  const khaltiQrPath = publicSettings.khaltiQrPath ? String(publicSettings.khaltiQrPath) : null;

  const selectedQrPath = paymentMethod === "bank"
    ? bankQrPath
    : paymentMethod === "esewa"
      ? esewaQrPath
      : khaltiQrPath;

  const paymentOptions = [
    { key: "bank", title: t.checkout.bankTransfer, desc: t.checkout.bankTransferDesc },
    { key: "esewa", title: t.checkout.esewa, desc: t.checkout.esewaDesc },
    { key: "khalti", title: t.checkout.khalti, desc: t.checkout.khaltiDesc },
  ] as const;

  const createWhatsAppUrl = (id: number) => {
    const lines = [
      `${t.checkout.successOrderId} #${id}`,
      `${t.checkout.fullName.replace(" *", "")}: ${formData.name}`,
      `${t.checkout.phone.replace(" *", "")}: ${formData.phone}`,
      formData.email ? `Email: ${formData.email}` : null,
      `${t.checkout.address.replace(" *", "")}: ${formData.address}`,
      `${t.checkout.paymentChannel}: ${paymentMethod}`,
      `${lang === "ne" ? "भुक्तानी स्थिति" : "Payment status"}: ${lang === "ne" ? "बाँकी" : "Unpaid"}`,
      `${t.checkout.total}: ${formatNPR(totalPrice)}`,
    ];
    if (formData.notes.trim()) lines.push(`${t.checkout.notes}: ${formData.notes.trim()}`);
    const normalizedPhone = ownerPhone.replace(/[^\d+]/g, "");
    return `https://wa.me/${normalizedPhone.replace(/^\+/, "")}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  if (items.length === 0 && !isSuccess) {
    setLocation("/cart");
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");

    const cleanedName = formData.name.trim();
    const cleanedPhone = formData.phone.trim();
    const cleanedEmail = formData.email.trim();
    const cleanedAddress = formData.address.trim();
    const cleanedNotes = formData.notes.trim();
    const validItems = items
      .filter((item) => Number(item.product.id) > 0 && Number(item.quantity) > 0)
      .map((item) => ({
        productId: Number(item.product.id),
        productName: item.product.name,
        price: Number(item.product.price),
        quantity: Number(item.quantity),
        unit: item.product.unit,
      }));

    if (!cleanedName || !cleanedPhone || !cleanedAddress) {
      setSubmitError(
        lang === "ne"
          ? "कृपया नाम, फोन नम्बर र ठेगाना भर्नुहोस्।"
          : "Please fill in name, phone number, and address."
      );
      return;
    }

    if (!validItems.length) {
      setSubmitError(
        lang === "ne"
          ? "कार्टमा मान्य सामान छैन। कृपया फेरि सामान छान्नुहोस्।"
          : "There are no valid items in the cart. Please select products again."
      );
      return;
    }

    try {
      setIsPending(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: cleanedName,
          customerPhone: cleanedPhone,
          customerEmail: cleanedEmail || undefined,
          customerAddress: cleanedAddress,
          notes: cleanedNotes || undefined,
          customerPhotoPath: formData.customerPhotoPath || undefined,
          paymentMethod,
          paymentStatus: "unpaid",
          items: validItems,
        }),
      });
      const order = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((order as any)?.error || t.checkout.failedMsg);
      }
      setPlacedItems(items);
      setPlacedTotal(totalPrice);
      setOrderId(order.id);
      setCustomerCode((order as any).customerCode || (order as any).customer?.customerCode || "");
      localStorage.setItem(
        CUSTOMER_PORTAL_STORAGE_KEY,
        JSON.stringify({
          customerCode: (order as any).customerCode || (order as any).customer?.customerCode || "",
          phone: cleanedPhone,
        }),
      );
      setIsSuccess(true);
      clearCart();
    } catch (error: any) {
      const details =
        error?.response?.data?.details ||
        error?.data?.details ||
        error?.details ||
        [];
      const message =
        (Array.isArray(details) && details.length ? details.join(", ") : null) ||
        error?.response?.data?.error ||
        error?.data?.error ||
        error?.message ||
        t.checkout.failedMsg;
      setSubmitError(String(message));
    } finally {
      setIsPending(false);
    }
  };

  if (isSuccess) {
    const whatsappUrl = orderId ? createWhatsAppUrl(orderId) : "#";
    const summaryItems = placedItems.length ? placedItems : items;
    const summaryTotal = placedTotal || totalPrice;
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">{t.checkout.successTitle}</h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t.checkout.successOrderId} <strong className="text-foreground">#{orderId}</strong>
        </p>
        {customerCode ? (
          <p className="mb-8 text-base text-muted-foreground">
            {lang === "ne" ? "ग्राहक कोड" : "Customer code"} <strong className="text-foreground">{customerCode}</strong>
          </p>
        ) : null}

        <div className="bg-card border border-border p-8 rounded-3xl shadow-sm text-left mb-10">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2 border-b border-border pb-4">
            <Building2 className="w-6 h-6 text-primary" />
            {t.checkout.nextSteps}
          </h2>
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
            {lang === "ne"
              ? "अर्डर सफल भयो। अब ट्र्याक वा भुक्तानी पुष्टि गर्न सकिन्छ।"
              : "Order placed successfully. You can now track it or confirm payment."}
          </div>
          <p className="mb-6 text-muted-foreground">
            {lang === "ne" ? "कुल रकम" : "Total amount"} <strong className="text-foreground">{formatNPR(summaryTotal)}</strong>.{" "}
            {lang === "ne"
              ? "आवश्यक परे फोन वा WhatsApp मार्फत पसललाई सन्देश पठाउन सक्नुहुन्छ।"
              : "If needed, you can call or send WhatsApp to the shop directly."}
          </p>
          <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <p className="font-bold text-amber-950">{NEPALI_WARNING}</p>
          </div>
          {selectedQrPath ? (
            <div className="mb-6 rounded-2xl border border-border bg-white p-4">
              <p className="mb-3 text-sm font-bold text-foreground">
                {lang === "ne" ? "तलको QR प्रयोग गर्नु अघि कृपया फोन गरेर पुष्टि गर्नुहोस्" : "Please call first before using this QR"}
              </p>
              <img src={selectedQrPath} alt={`${paymentMethod} QR`} className="mx-auto max-h-72 rounded-2xl object-contain bg-slate-50 p-2" />
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => downloadImage(selectedQrPath, `rajesh-${paymentMethod}-qr.png`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-5 py-3 font-bold text-primary"
                >
                  <Printer className="w-4 h-4" />
                  {lang === "ne" ? "QR डाउनलोड गर्नुहोस्" : "Download QR"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="bg-muted/50 p-6 rounded-xl border border-dashed border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-y-4 font-mono text-sm">
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.proprietorLabel}</span><strong className="text-lg">{proprietorName}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.paymentChannel}</span><strong className="text-lg">{paymentOptions.find((item) => item.key === paymentMethod)?.title}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.bankName}</span><strong className="text-lg">{bankName}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.bankBranch}</span><strong className="text-lg">{bankBranch}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.accountName}</span><strong className="text-lg">{accountName}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.accountNumber}</span><strong className="text-lg text-primary">{accountNumber}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.esewaId}</span><strong className="text-lg">{esewaId || t.checkout.qrNotSet}</strong></div>
            <div><span className="text-muted-foreground block text-xs uppercase mb-1">{t.checkout.khaltiId}</span><strong className="text-lg">{khaltiId || t.checkout.qrNotSet}</strong></div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {lang === "ne"
              ? "यदि चाहनुहुन्छ भने मात्र WhatsApp मार्फत पसललाई सन्देश पठाउनुहोस्।"
              : "Use WhatsApp only if you want to contact the shop directly."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-accent-foreground"
            >
              <Printer className="w-4 h-4" />
              {lang === "ne" ? "स्लिप प्रिन्ट गर्नुहोस्" : "Print slip"}
            </button>
            <a href={`tel:${ownerPhone}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">
              <Phone className="w-4 h-4" />
              {t.checkout.callOwner}
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white">
              <MessageCircle className="w-4 h-4" />
              {lang === "ne" ? "चाहिएमा WhatsApp पठाउनुहोस्" : "Send WhatsApp if needed"}
            </a>
            {orderId ? (
              <button
                type="button"
                onClick={() => setLocation(`/track?id=${orderId}&phone=${encodeURIComponent(formData.phone)}`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-bold text-foreground"
              >
                <Search className="w-4 h-4" />
                {lang === "ne" ? "अर्डर ट्र्याक गर्नुहोस्" : "Track order"}
              </button>
            ) : null}
            {customerCode ? (
              <button
                type="button"
                onClick={() => setLocation(`/account?code=${encodeURIComponent(customerCode)}&phone=${encodeURIComponent(formData.phone)}`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-5 py-3 font-bold text-primary"
              >
                <Store className="w-4 h-4" />
                {lang === "ne" ? "मेरो खाता खोल्नुहोस्" : "Open my account"}
              </button>
            ) : null}
            <button onClick={() => setLocation("/")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700">
              {t.checkout.returnHome}
            </button>
          </div>
        </div>

        <div className="print-bill-sheet hidden text-left">
          <div className="mx-auto mt-8 max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-900">
            {/* Shop header: logo + name + address + PAN */}
            <div className="flex items-start gap-4 border-b-2 border-slate-800 pb-5">
              <img src="/rajesh-logo.png" alt="Logo" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <h2 className="text-2xl font-extrabold leading-tight">{String(publicSettings.shopName || "Rajesh Shopping Center")}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{String(publicSettings.address || "Musikot-5, Aapchaur, Gulmi, Nepal")}</p>
                {publicSettings.phone ? <p className="text-sm text-slate-500">{lang === "ne" ? "फोन:" : "Ph:"} {String(publicSettings.phone)}</p> : null}
                <p className="mt-1 text-sm font-bold text-slate-800">{lang === "ne" ? "प्यान नं.:" : "PAN No.:"} {String((publicSettings as any).panNumber || "302951817")}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
              <div>
                <p className="font-semibold text-slate-500">{lang === "ne" ? "अर्डर नं" : "Order no."}</p>
                <p className="mt-1 text-lg font-bold">#{orderId}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">{lang === "ne" ? "फोन" : "Phone"}</p>
                <p className="mt-1 text-lg font-bold">{formData.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">{lang === "ne" ? "ग्राहक" : "Customer"}</p>
                <p className="mt-1 text-lg font-bold">{formData.name}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">{lang === "ne" ? "भुक्तानी" : "Payment"}</p>
                <p className="mt-1 text-lg font-bold">{paymentOptions.find((item) => item.key === paymentMethod)?.title}</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.4fr_0.5fr_0.7fr] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                <span>{lang === "ne" ? "सामान" : "Item"}</span>
                <span>{lang === "ne" ? "मात्रा" : "Qty"}</span>
                <span className="text-right">{lang === "ne" ? "रकम" : "Amount"}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {summaryItems.map((item) => (
                  <div key={`print-${item.product.id}`} className="grid grid-cols-[1.4fr_0.5fr_0.7fr] px-4 py-3 text-sm">
                    <span>{item.product.name}</span>
                    <span>{item.quantity}</span>
                    <span className="text-right font-semibold">{formatNPR(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl bg-amber-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>{lang === "ne" ? "कुल जम्मा" : "Total"}</span>
                <span className="text-xl font-bold">{formatNPR(summaryTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{lang === "ne" ? "भुक्तानी स्थिति" : "Payment status"}</span>
                <span className="font-semibold">{lang === "ne" ? "बाँकी" : "Unpaid"}</span>
              </div>
            </div>

            <p className="mt-6 text-sm text-slate-500">{NEPALI_WARNING}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Home className="w-4 h-4" />
          {lang === "ne" ? "होममा फर्कनुहोस्" : "Back to home"}
        </button>
        <button
          type="button"
          onClick={() => setLocation("/cart")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.checkout.cart}
        </button>
      </div>
      <div className="flex items-center text-sm text-muted-foreground mb-10 font-bold">
        <span className="cursor-pointer hover:text-primary" onClick={() => setLocation("/cart")}>{t.checkout.cart}</span>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-foreground">{t.checkout.title}</span>
      </div>

      <h1 className="text-4xl font-serif font-bold text-foreground mb-10">{t.checkout.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-8">
            <FlashNotice message={submitError || null} type="error" onClose={() => setSubmitError("")} />
            <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
              <h2 className="text-2xl font-serif font-bold mb-6 border-b border-border pb-4">{t.checkout.deliveryDetails}</h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.fullName}</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder={t.checkout.fullNamePlaceholder} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.phone}</label>
                  <input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder={t.checkout.phonePlaceholder} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{lang === "ne" ? "इमेल" : "Email"}</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="name@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.address}</label>
                  <textarea required rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none" placeholder={t.checkout.addressPlaceholder} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.notes}</label>
                  <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none" placeholder={t.checkout.notesPlaceholder} />
                </div>
                <div className="rounded-2xl border border-border bg-muted/20 p-5">
                  <p className="text-sm font-bold text-foreground">
                    {lang === "ne" ? "ग्राहक विवरण स्वचालित रूपमा सुरक्षित हुन्छ" : "Customer details are saved automatically"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lang === "ne"
                      ? "पुरानो ग्राहक भए यही फोन नम्बर वा इमेल भएको खातामा अर्डर जोडिन्छ। फोन नम्बर वा इमेल फरक भए एउटै नाम भए पनि छुट्टै ग्राहकको रूपमा सुरक्षित हुन्छ।"
                      : "This order automatically creates or updates the customer record. The app uses phone number and email as identifiers, so customers with the same name are stored separately when their phone or email is different."}
                  </p>
                  <label className="mt-4 block rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                    {lang === "ne" ? "फोटो अपलोड गर्नुहोस् वा क्यामेरा प्रयोग गर्नुहोस्" : "Upload photo or use camera"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="mt-3 block w-full text-sm"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readFileAsDataUrl(file);
                        setFormData((current) => ({ ...current, customerPhotoPath: dataUrl }));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {formData.customerPhotoPath ? (
                    <img src={formData.customerPhotoPath} alt="Customer preview" className="mt-4 h-32 w-32 rounded-2xl object-cover border border-border" />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
              <h2 className="text-2xl font-serif font-bold mb-6 border-b border-border pb-4">{t.checkout.paymentMethod}</h2>
              <div className="mb-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                <p className="font-bold text-amber-950">{NEPALI_WARNING}</p>
              </div>
              {selectedQrPath ? (
                <div className="mb-5 rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-sm font-bold text-foreground">
                    {lang === "ne" ? "फोन गरेर पुष्टि गरेपछि मात्र यो QR प्रयोग गर्नुहोस्" : "Use this QR only after confirming by phone"}
                  </p>
                  <img src={selectedQrPath} alt={`${paymentMethod} QR`} className="mx-auto max-h-72 rounded-2xl object-contain bg-slate-50 p-2" />
                </div>
              ) : null}
              <div className="grid gap-4">
                {paymentOptions.map((option) => {
                  const selected = paymentMethod === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPaymentMethod(option.key)}
                      className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}
                    >
                      {selected ? (
                        <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-2 py-1 text-[10px] font-bold text-white">
                          {t.checkout.selected}
                        </div>
                      ) : null}
                      <div className="flex gap-4 items-start">
                        <div className={`mt-1 h-6 w-6 shrink-0 rounded-full border-4 ${selected ? "border-primary bg-white" : "border-border bg-white"}`} />
                        <div>
                          <h3 className={`text-lg font-bold ${selected ? "text-primary" : "text-foreground"}`}>{option.title}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{option.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{t.checkout.proprietorLabel}:</span> {proprietorName}
                  <br />
                  <span className="font-semibold text-foreground">{t.checkout.phone.replace(" *", "")}:</span> {ownerPhone}
                </div>
              </div>
            </div>

            <button type="submit" disabled={isPending} className="w-full py-5 bg-accent text-accent-foreground font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3">
              {isPending ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t.checkout.processing}
                </>
              ) : (
                <>{t.checkout.placeOrder} - {formatNPR(totalPrice)}</>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-muted/30 rounded-3xl p-6 sm:p-8 border border-border sticky top-28">
            <h3 className="font-serif font-bold text-xl mb-6 flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              {t.checkout.orderItems}
            </h3>

            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center gap-4 text-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-card rounded-md border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <img src={getImageUrl(item.product.imageUrl)!} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{t.cart.noImg}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-foreground">{item.product.name}</p>
                      <p className="text-muted-foreground text-xs">{t.checkout.qty} {item.quantity}</p>
                    </div>
                  </div>
                  <div className="font-bold shrink-0">{formatNPR(item.product.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between text-muted-foreground">
                <span>{t.checkout.subtotal}</span>
                <span>{formatNPR(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-foreground pt-4 border-t border-border">
                <span>{t.checkout.total}</span>
                <span>{formatNPR(totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
