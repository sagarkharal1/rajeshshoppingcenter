import { useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { useGetSettings, useCreateOrder } from "@workspace/api-client-react";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { Building2, CheckCircle2, ChevronRight, MessageCircle, Phone, Store } from "lucide-react";
import { motion } from "framer-motion";

export default function Checkout() {
  const { t, lang } = useLanguage();
  const { items, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { data: settings } = useGetSettings();
  const { mutateAsync: createOrder, isPending } = useCreateOrder();

  const [formData, setFormData] = useState({ name: "", phone: "", email: "", address: "", notes: "", customerPhotoPath: "" });
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "esewa" | "khalti">("bank");
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const publicSettings = (settings ?? {}) as Record<string, unknown>;
  const ownerPhone = String(publicSettings.whatsappPhone || publicSettings.phone || "+9779814401716");
  const proprietorName = String(publicSettings.proprietorName || "Sandesh Kharal");
  const bankName = String(publicSettings.bankName || "Rajesh Shopping Center Bank");
  const bankBranch = String(publicSettings.bankBranch || "Call for branch details");
  const accountName = String(publicSettings.accountName || "Rajesh Shopping Center");
  const accountNumber = String(publicSettings.accountNumber || "Call before payment");
  const esewaId = publicSettings.esewaId ? String(publicSettings.esewaId) : null;
  const khaltiId = publicSettings.khaltiId ? String(publicSettings.khaltiId) : null;

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
      `${t.checkout.address.replace(" *", "")}: ${formData.address}`,
      `${t.checkout.paymentChannel}: ${paymentMethod}`,
      `${t.checkout.total}: ${formatNPR(totalPrice)}`,
    ];
    if (formData.notes.trim()) {
      lines.push(`${t.checkout.notes}: ${formData.notes.trim()}`);
    }
    const normalizedPhone = ownerPhone.replace(/[^\d+]/g, "");
    return `https://wa.me/${normalizedPhone.replace(/^\+/, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const order = await createOrder({
        data: {
          customerName: formData.name,
          customerPhone: formData.phone,
          customerAddress: formData.address,
          customerEmail: formData.email || undefined,
          notes: formData.notes,
          customerPhotoPath: formData.customerPhotoPath || undefined,
          paymentMethod,
          items: items.map(i => ({
            productId: i.product.id,
            productName: i.product.name,
            price: i.product.price,
            quantity: i.quantity,
            unit: i.product.unit
          }))
        } as any
      });
      setOrderId(order.id);
      setIsSuccess(true);
      const whatsappUrl = createWhatsAppUrl(order.id);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      clearCart();
    } catch {
      alert(t.checkout.failedMsg);
    }
  };

  if (isSuccess) {
    const whatsappUrl = orderId ? createWhatsAppUrl(orderId) : "#";
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

        <div className="bg-card border border-border p-8 rounded-3xl shadow-sm text-left mb-10">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2 border-b border-border pb-4">
            <Building2 className="w-6 h-6 text-primary" />
            {t.checkout.nextSteps}
          </h2>
          <p className="mb-6 text-muted-foreground">
            {t.checkout.nextStepsDesc}{" "}
            <strong className="text-foreground">{formatNPR(totalPrice)}</strong>
          </p>
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">{t.checkout.callBeforePayment}</p>
            <p className="mt-2 text-sm leading-6 text-amber-900/80">{t.checkout.callBeforePaymentDesc}</p>
          </div>
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
          <p className="mt-5 text-sm text-muted-foreground">{t.checkout.whatsappHint}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              href={`tel:${ownerPhone}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
            >
              <Phone className="w-4 h-4" />
              {t.checkout.callOwner}
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white"
            >
              <MessageCircle className="w-4 h-4" />
              {t.checkout.whatsappOwner}
            </a>
            {orderId ? (
              <button
                type="button"
                onClick={() => setLocation(`/track-order?id=${orderId}&phone=${encodeURIComponent(formData.phone)}`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-bold text-foreground"
              >
                <Store className="w-4 h-4" />
                {lang === "ne" ? "अर्डर ट्र्याक गर्नुहोस्" : "Track order"}
              </button>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => setLocation("/")}
          className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          {t.checkout.returnHome}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center text-sm text-muted-foreground mb-10 font-bold">
        <span className="cursor-pointer hover:text-primary" onClick={() => setLocation("/cart")}>{t.checkout.cart}</span>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-foreground">{t.checkout.title}</span>
      </div>

      <h1 className="text-4xl font-serif font-bold text-foreground mb-10">{t.checkout.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
              <h2 className="text-2xl font-serif font-bold mb-6 border-b border-border pb-4">{t.checkout.deliveryDetails}</h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.fullName}</label>
                  <input
                    required type="text" value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder={t.checkout.fullNamePlaceholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.phone}</label>
                  <input
                    required type="tel" value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder={t.checkout.phonePlaceholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{lang === "ne" ? "इमेल" : "Email"}</label>
                  <input
                    type="email" value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.address}</label>
                  <textarea
                    required rows={3} value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none"
                    placeholder={t.checkout.addressPlaceholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">{t.checkout.notes}</label>
                  <textarea
                    rows={2} value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none"
                    placeholder={t.checkout.notesPlaceholder}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-muted/20 p-5">
                  <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={createCustomerId}
                      onChange={(e) => setCreateCustomerId(e.target.checked)}
                    />
                    {lang === "ne" ? "ग्राहक ID बनाउने" : "Create customer ID"}
                  </label>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lang === "ne"
                      ? "पुराना ग्राहक भए तपाईंको अर्डर त्यसै खातामा जोडिन्छ। नयाँ ग्राहक भए नयाँ ग्राहक विवरण बनाइन्छ। चाहनु भए फोटो पनि राख्न सक्नुहुन्छ।"
                      : "If you have ordered before, this order will be linked to your existing customer record. New buyers are added automatically. You can also upload a photo for your customer ID."}
                  </p>
                  <label className="mt-4 block rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                    {lang === "ne" ? "फोटो अपलोड / क्यामेरा प्रयोग" : "Upload photo / use camera"}
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
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-bold text-amber-900">{t.checkout.callBeforePayment}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900/80">{t.checkout.callBeforePaymentDesc}</p>
              </div>
              <div className="grid gap-4">
                {paymentOptions.map((option) => {
                  const selected = paymentMethod === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPaymentMethod(option.key)}
                      className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                      }`}
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

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-5 bg-accent text-accent-foreground font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3"
            >
              {isPending ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t.checkout.processing}
                </>
              ) : (
                <>{t.checkout.placeOrder} — {formatNPR(totalPrice)}</>
              )}
            </button>
          </form>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-2">
          <div className="bg-muted/30 rounded-3xl p-6 sm:p-8 border border-border sticky top-28">
            <h3 className="font-serif font-bold text-xl mb-6 flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              {t.checkout.orderItems}
            </h3>

            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {items.map(item => (
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
                <span className="text-primary">{formatNPR(totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
