/**
 * Opens a past bill as a printable slip.
 *
 * Written for the khata the shop actually keeps: a bill's total carries the
 * customer's earlier balance into it, so the slip has to show that carry
 * forward as its own line. Printing only "Total / Paid / Due" is what made a
 * Rs 500 sale look like a Rs 11,759 bill.
 *
 * Used for reprinting an old bill from the customer screen, and safe to show
 * a customer: it contains selling prices only, never buying cost.
 */

export type BillShopInfo = {
  name: string;
  phone?: string;
  address?: string;
  pan?: string;
  /** Optional images of the shop's rubber stamp and the owner's signature. */
  stampPath?: string | null;
  signaturePath?: string | null;
  /** Name printed under the signature line. Falls back to the shop name. */
  signatureName?: string | null;
};

/**
 * The sign-and-stamp footer, printed on every slip.
 *
 * A bill in this shop is proof of what was taken and what is owed, so it has
 * to be signable. This prints an empty ruled line and a stamp box by default —
 * paper the owner signs and stamps by hand, which needs no setup at all. If a
 * stamp or signature image has been uploaded it is printed in place of the
 * blank space, so reprints and emailed copies carry the same marks.
 */
export function signStampBlock(shop: BillShopInfo, lang: "en" | "ne") {
  const ne = lang === "ne";
  const escape = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const signatureFill = shop.signaturePath
    ? `<img src="${escape(shop.signaturePath)}" alt="" style="max-height:46px;max-width:100%;object-fit:contain">`
    : "";
  const stampFill = shop.stampPath
    ? `<img src="${escape(shop.stampPath)}" alt="" style="max-height:74px;max-width:100%;object-fit:contain">`
    : `<span style="font-size:10px;color:#cbd5e1">${ne ? "छाप यहाँ" : "Stamp here"}</span>`;

  return `
<div style="display:flex;gap:14px;margin-top:26px;page-break-inside:avoid">
  <div style="flex:1;min-width:0">
    <div style="height:48px"></div>
    <div style="border-top:1px solid #94a3b8;padding-top:5px;text-align:center;font-size:11px;color:#64748b">
      ${ne ? "ग्राहकको हस्ताक्षर" : "Customer signature"}
    </div>
  </div>
  <div style="flex:1;min-width:0">
    <div style="height:48px;display:flex;align-items:flex-end;justify-content:center">${signatureFill}</div>
    <div style="border-top:1px solid #94a3b8;padding-top:5px;text-align:center;font-size:11px;color:#64748b">
      ${ne ? "पसलको तर्फबाट" : "For"} ${escape(shop.signatureName || shop.name)}
    </div>
  </div>
  <div style="width:96px;flex:none">
    <div style="height:74px;border:1px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden">
      ${stampFill}
    </div>
    <div style="padding-top:5px;text-align:center;font-size:11px;color:#64748b">${ne ? "छाप" : "Stamp"}</div>
  </div>
</div>`;
}

type BillInvoice = {
  invoiceNumber: string;
  createdAt: string;
  subtotalAmount?: number;
  previousDueAmount?: number;
  rewardDiscount?: unknown;
  rewardPointsRedeemed?: number;
  rewardPointsEarned?: number;
  totalAmount: number;
  amountPaid: number;
  dueAmount: number;
  paymentMethod?: string;
  note?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
};

type BillItem = {
  productName: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number;
  lineTotal?: number;
};

type BillCustomer = {
  name?: string;
  customerCode?: string | null;
  code?: string | null;
  phone?: string | null;
};

const money = (value: unknown) => `NPR ${Number(value ?? 0).toLocaleString()}`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printBill(
  invoice: BillInvoice,
  items: BillItem[],
  customer: BillCustomer | null,
  lang: "en" | "ne",
  shop: BillShopInfo,
): { ok: true } | { ok: false; reason: "popup-blocked" } {
  const ne = lang === "ne";

  const subtotal = Number(invoice.subtotalAmount ?? 0);
  const previousDue = Number(invoice.previousDueAmount ?? 0);
  const discount = Number(invoice.rewardDiscount ?? 0);
  const total = Number(invoice.totalAmount ?? 0);
  const paid = Number(invoice.amountPaid ?? 0);
  const balance = Number(invoice.dueAmount ?? 0);
  const voided = Boolean(invoice.voidedAt);

  const rows = (items || [])
    .map((item) => {
      const qty = Number(item.quantity ?? 0);
      const rate = Number(item.unitPrice ?? 0);
      const amount = Number(item.lineTotal ?? rate * qty);
      return `<tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9">${escapeHtml(item.productName)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;text-align:center;white-space:nowrap">${qty} ${escapeHtml(item.unit || "pc")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">${money(rate)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap"><strong>${money(amount)}</strong></td>
    </tr>`;
    })
    .join("");

  const summaryRow = (label: string, value: string, style = "") =>
    `<div style="display:flex;justify-content:space-between;gap:16px;margin:5px 0;${style}"><span>${label}</span><span>${value}</span></div>`;

  const origin = window.location.origin;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  body { font-family: "Nirmala UI","Noto Sans Devanagari",sans-serif; max-width: 480px; margin: 20px auto; padding: 20px; color: #1e293b; }
  .info { font-size: 13px; color: #64748b; margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f1f5f9; padding: 7px 8px; text-align: left; font-size: 12px; color: #64748b; }
  .summary { background: #f8fafc; padding: 12px 14px; border-radius: 10px; font-size: 14px; }
  .badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 10px; }
  @media print { button { display: none; } }
</style>
</head><body>

${
  voided
    ? `<div style="border:2px solid #b91c1c;background:#fee2e2;color:#7f1d1d;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:800;text-align:center">
  ${ne ? "यो बिल रद्द गरिएको हो — हिसाबमा गनिँदैन" : "THIS BILL IS VOIDED — it does not count in any balance"}
  ${invoice.voidReason ? `<div style="font-weight:600;font-size:13px;margin-top:4px">${escapeHtml(invoice.voidReason)}</div>` : ""}
</div>`
    : ""
}

<div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #1e3a5f;padding-bottom:12px">
  <!-- Absolute URL: the slip opens in a blank window, where a relative path
       would resolve against about:blank and the logo would never appear. -->
  <img src="${origin}/rajesh-logo-print.png" alt="" style="width:64px;height:64px;object-fit:contain;flex:none"
       onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${origin}/rajesh-logo.png'}else{this.style.display='none'}">
  <div style="min-width:0">
    <h2 style="margin:0;font-size:20px;color:#1e3a5f;line-height:1.2">${escapeHtml(shop.name)}</h2>
    <p class="info">${ne ? "काउन्टर बिल" : "Counter Bill"}${shop.pan ? " · PAN: " + escapeHtml(shop.pan) : ""}</p>
    <p class="info">${escapeHtml(shop.address || "")}${shop.phone ? " · " + escapeHtml(shop.phone) : ""}</p>
  </div>
</div>

<p class="info" style="margin-top:12px"><strong>${ne ? "बिल नं." : "Bill no."}:</strong> ${escapeHtml(invoice.invoiceNumber)}</p>
<p class="info"><strong>${ne ? "ग्राहक" : "Customer"}:</strong> ${escapeHtml(customer?.name || "—")}${
    customer?.customerCode || customer?.code ? ` (${escapeHtml(customer.customerCode || customer.code)})` : ""
  }</p>
${customer?.phone ? `<p class="info"><strong>${ne ? "फोन" : "Phone"}:</strong> ${escapeHtml(customer.phone)}</p>` : ""}
<p class="info"><strong>${ne ? "मिति" : "Date"}:</strong> ${new Date(invoice.createdAt).toLocaleString()}</p>

${
  rows
    ? `<table>
  <thead><tr>
    <th>${ne ? "सामान" : "Item"}</th>
    <th style="text-align:center">${ne ? "परिमाण" : "Qty"}</th>
    <th style="text-align:right">${ne ? "दर" : "Rate"}</th>
    <th style="text-align:right">${ne ? "रकम" : "Amount"}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
    : `<p class="info" style="margin:14px 0">${ne ? "यो बिलमा कुनै सामान छैन।" : "No items on this bill."}</p>`
}

<div class="summary">
  ${summaryRow(ne ? "सामानको जम्मा" : "Items subtotal", money(subtotal))}
  ${previousDue > 0 ? summaryRow(ne ? "अघिको बाँकी" : "Previous balance", money(previousDue), "color:#b45309") : ""}
  ${
    discount > 0
      ? summaryRow(
          ne
            ? `पोइन्ट छुट (${Number(invoice.rewardPointsRedeemed ?? 0)} अंक)`
            : `Reward discount (${Number(invoice.rewardPointsRedeemed ?? 0)} pts)`,
          `− ${money(discount)}`,
          "color:#15803d",
        )
      : ""
  }
  <div style="border-top:1px solid #e2e8f0;margin:8px 0"></div>
  ${summaryRow(ne ? "कुल रकम" : "Total", `<strong>${money(total)}</strong>`, "font-size:16px")}
  ${summaryRow(ne ? "तिरेको" : "Paid", money(paid), "color:#166534")}
  ${summaryRow(
    ne ? "अब बाँकी" : "Balance remaining",
    `<strong>${money(balance)}</strong>`,
    `font-size:16px;color:${balance > 0 ? "#b91c1c" : "#166534"}`,
  )}
  <p class="info" style="margin-top:8px">${ne ? "भुक्तानी तरिका" : "Payment method"}: ${escapeHtml(invoice.paymentMethod || "—")}</p>
  ${
    Number(invoice.rewardPointsEarned ?? 0) > 0
      ? `<p class="info" style="color:#7c3aed">${ne ? "यो किनमेलबाट कमाएको अंक" : "Points earned on this bill"}: ${Number(invoice.rewardPointsEarned)}</p>`
      : ""
  }
  <span class="badge" style="background:${balance > 0 ? "#fef3c7" : "#dcfce7"};color:${balance > 0 ? "#92400e" : "#166534"}">
    ${balance > 0 ? (ne ? `📒 बाँकी: ${money(balance)}` : `📒 Due: ${money(balance)}`) : ne ? "✅ पूरा भुक्तानी" : "✅ Fully paid"}
  </span>
</div>

${invoice.note ? `<p class="info" style="margin-top:12px"><strong>${ne ? "नोट" : "Note"}:</strong> ${escapeHtml(invoice.note)}</p>` : ""}

${signStampBlock(shop, lang)}

<p style="text-align:center;color:#64748b;font-size:12px;margin-top:14px">
  ${escapeHtml(shop.name)}${shop.phone ? " · " + escapeHtml(shop.phone) : ""}
</p>

<button onclick="window.print()" style="margin-top:16px;width:100%;padding:11px;background:#1e3a5f;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">🖨️ ${ne ? "प्रिन्ट गर्नुहोस्" : "Print"}</button>
</body></html>`;

  const popup = window.open("", "_blank", "width=520,height=760");
  if (!popup) return { ok: false, reason: "popup-blocked" };
  popup.document.write(html);
  popup.document.close();
  return { ok: true };
}
