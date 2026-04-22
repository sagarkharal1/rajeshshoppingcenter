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

  const sanitizeChatId = (value: string) =>
    value
      .trim()
      .replace(/^[[\]"']+/, "")
      .replace(/[[\]"']+$/, "");

  return Array.from(
    new Set(
      combined
        .split(/[\s,;]+/g)
        .map(sanitizeChatId)
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Keeps retrying in the background until Telegram confirms success
async function sendWithPersistentRetry(
  endpoint: string,
  message: string,
  plainTextMessage: string,
  telegramChatId: string,
): Promise<void> {
  const TIMEOUT_MS = 10_000;
  const RETRY_DELAY_MS = 30_000; // 30 seconds between retries
  const MAX_ATTEMPTS = 240;      // keep trying for up to 2 hours

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        },
        TIMEOUT_MS,
      );

      if (response.ok) {
        console.info(
          `[Telegram] Notification sent successfully on attempt ${attempt}.`,
          telegramChatId,
        );
        return; // success — stop retrying
      }

      // Try plain text if HTML fails with a bad status
      const fallback = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: plainTextMessage,
            disable_web_page_preview: true,
          }),
        },
        TIMEOUT_MS,
      );

      if (fallback.ok) {
        console.info(
          `[Telegram] Plain text notification sent on attempt ${attempt}.`,
          telegramChatId,
        );
        return; // success — stop retrying
      }

      console.warn(
        `[Telegram] Attempt ${attempt}/${MAX_ATTEMPTS} failed with status ${response.status}. Retrying in 30s...`,
        telegramChatId,
      );
    } catch (error) {
      console.warn(
        `[Telegram] Attempt ${attempt}/${MAX_ATTEMPTS} failed (network error). Retrying in 30s...`,
        telegramChatId,
        error,
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.error(
    `[Telegram] Gave up after ${MAX_ATTEMPTS} attempts (2 hours).`,
    telegramChatId,
  );
}

export function sendTelegramMessage(message: string): void {
  const telegramBotToken = getTelegramBotToken();
  const telegramChatIds = getTelegramChatIds();

  if (!telegramBotToken || !telegramChatIds.length) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return;
  }

  const endpoint = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const plainTextMessage = message
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "");

  // Fire and forget — runs in background, never blocks the order response
  for (const telegramChatId of telegramChatIds) {
    sendWithPersistentRetry(
      endpoint,
      message,
      plainTextMessage,
      telegramChatId,
    ).catch((error) => {
      console.error("[Telegram] Unexpected error in retry loop:", error);
    });
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
      `- ${escapeTelegramHtml(item.productName)} x${item.quantity} ${escapeTelegramHtml(item.unit || "pc")} = NPR ${Math.round(item.price * item.quantity)}`,
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
