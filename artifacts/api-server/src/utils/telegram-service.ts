const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() || "";

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.warn("[Telegram] sendMessage responded with status", response.status);
    }
  } catch (error) {
    console.warn("[Telegram] Failed to send notification:", error);
  }
}

export function formatTelegramOrderMessage(order: {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  totalAmount: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  notes?: string | null;
  items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
}): string {
  const lines = [
    "<b>New Online Order</b>",
    `Order ID: #${order.id}`,
    `Customer: ${escapeTelegramHtml(order.customerName)}`,
    `Phone: ${escapeTelegramHtml(order.customerPhone)}`,
  ];

  if (order.customerEmail) {
    lines.push(`Email: ${escapeTelegramHtml(order.customerEmail)}`);
  }

  lines.push(`Address: ${escapeTelegramHtml(order.customerAddress)}`);
  lines.push(`Payment: ${escapeTelegramHtml(order.paymentMethod || "bank")}`);
  lines.push(`Payment status: ${escapeTelegramHtml(order.paymentStatus || "unpaid")}`);
  lines.push(`Total: NPR ${Math.round(order.totalAmount)}`);
  lines.push("");
  lines.push("<b>Items</b>");

  for (const item of order.items) {
    lines.push(
      `- ${escapeTelegramHtml(item.productName)} x${item.quantity} ${escapeTelegramHtml(item.unit || "pc")} = NPR ${Math.round(
        item.price * item.quantity,
      )}`,
    );
  }

  if (order.notes) {
    lines.push("");
    lines.push(`<b>Note</b>: ${escapeTelegramHtml(order.notes)}`);
  }

  return lines.join("\n");
}
