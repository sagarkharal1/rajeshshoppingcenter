/**
 * Printable slips for the records that are not counter bills: online orders,
 * transport bookings, and money taken against an udharo balance.
 *
 * These used to live inside the owner dashboard component, which meant the
 * customer screen could not reach them — a payment or a booking could be seen
 * in a list but never opened as the original document. They belong here, where
 * any screen can print one, and they all carry the same sign-and-stamp footer
 * as a counter bill.
 */

import { signStampBlock, type BillShopInfo } from "@/lib/print-bill";

// The slip opens in a blank window, so the logo needs an absolute URL —
// a relative path would resolve against about:blank and never load.
// The 160px print copy keeps the slip fast on slow connections (the full
// logo is 1.7 MB); if it's missing we fall back to the full logo once.
export function printedLetterhead(shop: BillShopInfo, subtitle: string) {
  const logoUrl = `${window.location.origin}/rajesh-logo-print.png`;
  const fallbackUrl = `${window.location.origin}/rajesh-logo.png`;
  return `
<div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #1e3a5f;padding-bottom:12px">
  <img src="${logoUrl}" alt="" style="width:64px;height:64px;object-fit:contain;flex:none"
       onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${fallbackUrl}'}else{this.style.display='none'}">
  <div style="min-width:0">
    <h2 style="margin:0;font-size:20px;color:#1e3a5f;line-height:1.2">${shop.name}</h2>
    <p style="margin:2px 0 0;color:#64748b;font-size:13px">${subtitle}${shop.pan ? " · PAN: " + shop.pan : ""}</p>
    <p style="margin:2px 0 0;color:#64748b;font-size:12px">${shop.address || ""}${shop.phone ? " · " + shop.phone : ""}</p>
  </div>
</div>`;
}

function openSlip(html: string, height: number) {
  const w = window.open("", "_blank", `width=500,height=${height}`);
  if (!w) return { ok: false as const, reason: "popup-blocked" as const };
  w.document.write(html);
  w.document.close();
  return { ok: true as const };
}

/**
 * Opens a document the shop received rather than issued — a supplier's bill, a
 * payment screenshot, a photographed receipt.
 *
 * No letterhead and no sign-and-stamp footer: this is somebody else's paper,
 * and dressing it in our own would misrepresent who issued it. It gets a
 * caption saying what it is attached to, and a print button.
 */
export function openProofDocument(
  src: string,
  caption: string,
  lang: string,
  subCaption?: string,
) {
  const ne = lang === "ne";
  const escape = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(caption)}</title>
<style>body{font-family:"Nirmala UI","Noto Sans Devanagari",sans-serif;margin:0;padding:16px;background:#f8fafc;color:#1e293b}
img{max-width:100%;height:auto;display:block;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px}
@media print{body{background:#fff;padding:0}button,.note{display:none}img{border:0}}</style>
</head><body>
<p style="margin:0 0 4px;font-weight:700">${escape(caption)}</p>
${subCaption ? `<p style="margin:0 0 10px;font-size:13px;color:#64748b">${escape(subCaption)}</p>` : ""}
<p class="note" style="margin:0 0 12px;font-size:12px;color:#94a3b8">${ne ? "यो कागज सप्लायरले दिएको हो — पसलले बनाएको होइन।" : "This document was issued by the supplier, not by the shop."}</p>
<img src="${escape(src)}" alt="${escape(caption)}">
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ ${ne ? "प्रिन्ट गर्नुहोस्" : "Print"}</button>
</body></html>`;
  return openSlip(html, 720);
}

export function printOrderSlip(order: any, lang: string, shop: BillShopInfo) {
  const payMethod = order.paymentMethod === "esewa" ? "eSewa" : order.paymentMethod === "khalti" ? "Khalti" : order.paymentMethod === "bank" ? "Bank/QR" : order.paymentMethod === "cash" ? "Cash" : order.paymentMethod || "—";
  const isPaid = order.paymentStatus === "paid";
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
${printedLetterhead(shop, lang === "ne" ? "अनलाइन अर्डर स्लिप" : "Online Order Slip")}
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
  ${(() => {
    const total = Number(order.totalAmount || 0);
    const paidAmount = Number(order.amountPaid || 0);
    const dueAmount = Math.max(total - paidAmount, 0);
    if (isPaid || paidAmount <= 0) return "";
    return `<p style="margin:4px 0;color:#166534;font-size:14px;font-weight:600">${lang === "ne" ? "बुझेको" : "Paid"}: NPR ${paidAmount.toLocaleString()}</p>
  <p style="margin:4px 0;color:#92400e;font-size:14px;font-weight:600">${lang === "ne" ? "बाँकी" : "Due"}: NPR ${dueAmount.toLocaleString()}</p>`;
  })()}
  <p style="margin:4px 0;color:#64748b;font-size:13px">Payment method: ${payMethod}</p>
  <span class="badge ${isPaid ? "paid" : "credit"}">${isPaid ? (lang === "ne" ? "✅ भुक्तानी भयो (नगद)" : "✅ Paid — Cash / Digital") : Number(order.amountPaid || 0) > 0 ? (lang === "ne" ? "📒 आंशिक भुक्तानी" : "📒 Partially Paid") : (lang === "ne" ? "📒 उधारो / बाँकी" : "📒 On Credit / Pending")}</span>
</div>
${order.notes ? `<hr style="margin:12px 0;border:1px solid #e2e8f0"><p style="font-size:13px;color:#64748b"><strong>Notes:</strong> ${order.notes}</p>` : ""}
${signStampBlock(shop, lang === "ne" ? "ne" : "en")}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p style="text-align:center;color:#64748b;font-size:12px">${shop.name}${shop.phone ? " · " + shop.phone : ""}${shop.address ? " · " + shop.address : ""}</p>
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ Print</button>
</body></html>`;
  return openSlip(html, 700);
}

export function printBookingSlip(booking: any, lang: string, shop: BillShopInfo) {
  const serviceLabel = booking.serviceType === "tractor" ? (lang === "ne" ? "ट्र्याक्टर" : "Tractor") : booking.serviceType === "telcoline" ? "Tata Telcoline" : (lang === "ne" ? "बोलेरो / जिप" : "Bolero / Jeep");
  const charged = Number(booking.chargedAmount ?? 0);
  const paid = Number(booking.amountPaid ?? 0);
  const due = Math.max(0, charged - paid);
  const payMethod = booking.paymentMethod || "cash";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking #${booking.id}</title>
<style>body{font-family:sans-serif;max-width:420px;margin:20px auto;padding:20px}h2{margin:0 0 4px}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}.badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700}.paid{background:#dcfce7;color:#166534}.due{background:#fef3c7;color:#92400e}@media print{button{display:none}}</style>
</head><body>
${printedLetterhead(shop, lang === "ne" ? "यातायात बुकिङ स्लिप" : "Transport Booking Slip")}
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
${signStampBlock(shop, lang === "ne" ? "ne" : "en")}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p style="text-align:center;color:#64748b;font-size:12px">${shop.name}${shop.phone ? " · " + shop.phone : ""}${shop.address ? " · " + shop.address : ""}</p>
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ Print</button>
</body></html>`;
  return openSlip(html, 660);
}

/**
 * Receipt for money taken against an udharo balance.
 *
 * A customer clearing part of their khata had nothing to take away proving it,
 * which is exactly the transaction most likely to be argued about later. The
 * balance before and after is spelled out so the arithmetic is checkable on
 * the spot.
 */
export function printPaymentReceipt(
  payment: any,
  customer: any,
  lang: string,
  shop: BillShopInfo,
  balanceAfter?: number | null,
) {
  const ne = lang === "ne";
  const amount = Number(payment.amount ?? 0);
  const after = balanceAfter == null ? null : Number(balanceAfter);
  const before = after == null ? null : after + amount;
  const voided = Boolean(payment.voidedAt);
  const escape = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ne ? "भुक्तानी रसिद" : "Payment receipt"}</title>
<style>body{font-family:"Nirmala UI","Noto Sans Devanagari",sans-serif;max-width:420px;margin:20px auto;padding:20px;color:#1e293b}
.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f1f5f9}
.info{font-size:13px;color:#64748b;margin:3px 0}
@media print{button{display:none}}</style>
</head><body>
${voided ? `<div style="border:2px solid #b91c1c;background:#fee2e2;color:#7f1d1d;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:800;text-align:center">
  ${ne ? "यो रसिद रद्द गरिएको हो" : "THIS RECEIPT IS VOIDED"}
  ${payment.voidReason ? `<div style="font-weight:600;font-size:13px;margin-top:4px">${escape(payment.voidReason)}</div>` : ""}
</div>` : ""}
${printedLetterhead(shop, ne ? "उधारो भुक्तानी रसिद" : "Credit Payment Receipt")}
<p class="info" style="margin-top:12px"><strong>${ne ? "रसिद नं." : "Receipt no."}:</strong> RCP-${String(payment.id).padStart(5, "0")}</p>
<p class="info"><strong>${ne ? "ग्राहक" : "Customer"}:</strong> ${escape(customer?.name || "—")}${customer?.customerCode || customer?.code ? ` (${escape(customer.customerCode || customer.code)})` : ""}</p>
${customer?.phone ? `<p class="info"><strong>${ne ? "फोन" : "Phone"}:</strong> ${escape(customer.phone)}</p>` : ""}
<p class="info"><strong>${ne ? "मिति" : "Date"}:</strong> ${new Date(payment.createdAt || payment.date || Date.now()).toLocaleString()}</p>
<hr style="margin:12px 0;border:1px solid #e2e8f0">
${before == null ? "" : `<div class="row"><span>${ne ? "अघिको बाँकी" : "Balance before"}</span><strong>NPR ${before.toLocaleString()}</strong></div>`}
<div class="row"><span>${ne ? "बुझेको रकम" : "Amount received"}</span><strong style="color:#166534;font-size:17px">NPR ${amount.toLocaleString()}</strong></div>
${after == null ? "" : `<div class="row"><span>${ne ? "अब बाँकी" : "Balance after"}</span><strong style="color:${after > 0 ? "#b91c1c" : "#166534"}">NPR ${after.toLocaleString()}</strong></div>`}
<p class="info" style="margin-top:8px">${ne ? "भुक्तानी तरिका" : "Payment method"}: ${escape(payment.method || payment.paymentMethod || "cash")}</p>
${payment.referenceNote ? `<p class="info"><strong>${ne ? "नोट" : "Note"}:</strong> ${escape(payment.referenceNote)}</p>` : ""}
${signStampBlock(shop, ne ? "ne" : "en")}
<hr style="margin:12px 0;border:1px solid #e2e8f0">
<p style="text-align:center;color:#64748b;font-size:12px">${escape(shop.name)}${shop.phone ? " · " + escape(shop.phone) : ""}</p>
<button onclick="window.print()" style="margin-top:16px;width:100%;padding:10px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer">🖨️ ${ne ? "प्रिन्ट गर्नुहोस्" : "Print"}</button>
</body></html>`;
  return openSlip(html, 640);
}
