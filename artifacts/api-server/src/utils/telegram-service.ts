function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return "";
}

function getTelegramBotToken(): string {
  return firstNonEmpty(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_BOT_TOI,
    process.env.TELEGRAM_BOT,
    process.env.TELEGRAM_TOKEN,
  );
}

function getTelegramChatId(): string {
  return firstNonEmpty(
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_CHAT_II,
    process.env.TELEGRAM_CHAT,
    process.env.TELEGRAM_OWNER_CHAT_ID,
  );
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const telegramBotToken = getTelegramBotToken();
  const telegramChatId = getTelegramChatId();

  if (!telegramBotToken || !telegramChatId) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("[Telegram] sendMessage responded with status", response.status, errorText);
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

export function formatTelegramBookingMessage(booking: {
  id: number;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  destination: string;
  bookingDate: string;
  notes?: string | null;
}): string {
  const serviceLabel = booking.serviceType === "jeep" ? "Bolero / Jeep" : "Tractor";

  const lines = [
    "<b>New Transport Booking</b>",
    `Booking ID: #${booking.id}`,
    `Service: ${escapeTelegramHtml(serviceLabel)}`,
    `Customer: ${escapeTelegramHtml(booking.customerName)}`,
    `Phone: ${escapeTelegramHtml(booking.customerPhone)}`,
    `Pickup: ${escapeTelegramHtml(booking.pickupLocation)}`,
    `Destination: ${escapeTelegramHtml(booking.destination)}`,
    `Date: ${escapeTelegramHtml(booking.bookingDate)}`,
  ];

  if (booking.notes) {
    lines.push(`Notes: ${escapeTelegramHtml(booking.notes)}`);
  }

  return lines.join("\n");
}
