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

function getTelegramChatIds(): string[] {
  const combined = [
    process.env.TELEGRAM_CHAT_IDS,
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_CHAT_II,
    process.env.TELEGRAM_CHAT,
    process.env.TELEGRAM_OWNER_CHAT_ID,
  ]
    .filter(Boolean)
    .join(",");

  return Array.from(
    new Set(
      combined
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTelegramDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  });
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const telegramBotToken = getTelegramBotToken();
  const telegramChatIds = getTelegramChatIds();

  if (!telegramBotToken || !telegramChatIds.length) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return;
  }

  const endpoint = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const plainTextMessage = message.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "");

  for (const telegramChatId of telegramChatIds) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      if (response.ok) {
        console.info("[Telegram] HTML notification sent successfully.", telegramChatId);
        continue;
      }

      const errorText = await response.text().catch(() => "");
      console.warn("[Telegram] HTML sendMessage responded with status", response.status, telegramChatId, errorText);
    } catch (error) {
      console.warn("[Telegram] Failed HTML notification attempt:", telegramChatId, error);
    }

    try {
      const fallbackResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: plainTextMessage,
          disable_web_page_preview: true,
        }),
      });

      if (!fallbackResponse.ok) {
        const fallbackErrorText = await fallbackResponse.text().catch(() => "");
        console.warn("[Telegram] Plain text sendMessage responded with status", fallbackResponse.status, telegramChatId, fallbackErrorText);
        continue;
      }

      console.info("[Telegram] Plain text fallback notification sent successfully.", telegramChatId);
    } catch (error) {
      console.warn("[Telegram] Failed plain text notification attempt:", telegramChatId, error);
    }
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
  const serviceLabel =
    booking.serviceType === "jeep"
      ? "Bolero / Jeep"
      : booking.serviceType === "telcoline"
        ? "Tata Telcoline"
        : "Tractor";

  const lines = [
    "<b>New Transport Booking</b>",
    `Booking ID: #${booking.id}`,
    `Service: ${escapeTelegramHtml(serviceLabel)}`,
    `Customer: ${escapeTelegramHtml(booking.customerName)}`,
    `Phone: ${escapeTelegramHtml(booking.customerPhone)}`,
    `Pickup: ${escapeTelegramHtml(booking.pickupLocation)}`,
    `Destination: ${escapeTelegramHtml(booking.destination)}`,
    `Date: ${escapeTelegramHtml(formatTelegramDate(booking.bookingDate))}`,
  ];

  if (booking.notes) {
    lines.push(`Notes: ${escapeTelegramHtml(booking.notes)}`);
  }

  return lines.join("\n");
}
