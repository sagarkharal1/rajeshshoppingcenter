import { db } from "@workspace/db";
import { telegramQueueTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";

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
    value.trim().replace(/^[[\]"']+/, "").replace(/[[\]"']+$/, "");

  return Array.from(
    new Set(
      combined.split(/[\s,;]+/g).map(sanitizeChatId).filter(Boolean),
    ),
  );
}

function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTelegramDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Kathmandu",
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function trySendNow(chatId: string, message: string): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const plainText = message.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "");

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
    }, 10_000);

    if (res.ok) return true;

    // Fallback to plain text
    const fallback = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: plainText, disable_web_page_preview: true }),
    }, 10_000);

    return fallback.ok;
  } catch {
    return false;
  }
}

// Enqueue message to DB then attempt immediately in background
export function sendTelegramMessage(message: string): void {
  const chatIds = getTelegramChatIds();
  const token = getTelegramBotToken();

  if (!token || !chatIds.length) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return;
  }

  const maxChunkSize = 3500;
  const chunks = message.length <= maxChunkSize
    ? [message]
    : Array.from({ length: Math.ceil(message.length / maxChunkSize) }, (_, i) =>
        message.slice(i * maxChunkSize, (i + 1) * maxChunkSize));

  for (const chatId of chatIds) {
    for (const chunk of chunks) {
      // Save to DB first (survives server restarts), then try immediately
      db.insert(telegramQueueTable)
        .values({ message: chunk, chatId, status: "pending" })
        .returning({ id: telegramQueueTable.id })
        .then(async ([row]) => {
          if (!row) return;
          const sent = await trySendNow(chatId, chunk);
          if (sent) {
            await db.update(telegramQueueTable)
              .set({ status: "sent", sentAt: new Date(), attempts: 1, lastAttemptedAt: new Date() })
              .where(eq(telegramQueueTable.id, row.id));
            console.info(`[Telegram] Sent immediately (queue #${row.id})`);
          } else {
            await db.update(telegramQueueTable)
              .set({ attempts: 1, lastAttemptedAt: new Date() })
              .where(eq(telegramQueueTable.id, row.id));
            console.warn(`[Telegram] First attempt failed, queued for retry (queue #${row.id})`);
          }
        })
        .catch((err) => {
          // If DB save fails, fall back to in-memory retry
          console.error("[Telegram] Failed to queue message, trying directly:", err);
          trySendNow(chatId, chunk).catch(() => {});
        });
    }
  }
}

// Background worker — call once on server startup
export function startTelegramQueueWorker(): void {
  const INTERVAL_MS = 30_000; // check every 30 seconds
  const MAX_ATTEMPTS = 240;   // give up after 2 hours

  async function processPending() {
    try {
      const pending = await db
        .select()
        .from(telegramQueueTable)
        .where(
          and(
            eq(telegramQueueTable.status, "pending"),
            lt(telegramQueueTable.attempts, MAX_ATTEMPTS),
          )
        )
        .limit(20);

      for (const item of pending) {
        const sent = await trySendNow(item.chatId, item.message);
        const newAttempts = item.attempts + 1;

        if (sent) {
          await db.update(telegramQueueTable)
            .set({ status: "sent", sentAt: new Date(), attempts: newAttempts, lastAttemptedAt: new Date() })
            .where(eq(telegramQueueTable.id, item.id));
          console.info(`[Telegram] Queue #${item.id} sent on attempt ${newAttempts}`);
        } else if (newAttempts >= MAX_ATTEMPTS) {
          await db.update(telegramQueueTable)
            .set({ status: "failed", attempts: newAttempts, lastAttemptedAt: new Date() })
            .where(eq(telegramQueueTable.id, item.id));
          console.error(`[Telegram] Queue #${item.id} permanently failed after ${newAttempts} attempts`);
        } else {
          await db.update(telegramQueueTable)
            .set({ attempts: newAttempts, lastAttemptedAt: new Date() })
            .where(eq(telegramQueueTable.id, item.id));
        }
      }
    } catch (err) {
      console.error("[Telegram] Queue worker error:", err);
    }
  }

  setInterval(processPending, INTERVAL_MS);
  console.info("[Telegram] Queue worker started (checks every 30s)");
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
  if (order.customerEmail) lines.push(`Email: ${escapeTelegramHtml(order.customerEmail)}`);
  lines.push(`Address: ${escapeTelegramHtml(order.customerAddress)}`);
  lines.push(`Payment: ${escapeTelegramHtml(order.paymentMethod || "bank")}`);
  lines.push(`Payment status: ${escapeTelegramHtml(order.paymentStatus || "unpaid")}`);
  lines.push(`Total: NPR ${Math.round(order.totalAmount)}`);
  lines.push("");
  lines.push("<b>Items</b>");
  for (const item of order.items) {
    lines.push(`- ${escapeTelegramHtml(item.productName)} x${item.quantity} ${escapeTelegramHtml(item.unit || "pc")} = NPR ${Math.round(item.price * item.quantity)}`);
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
    booking.serviceType === "jeep" ? "Bolero / Jeep"
    : booking.serviceType === "telcoline" ? "Tata Telcoline"
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
  if (booking.notes) lines.push(`Notes: ${escapeTelegramHtml(booking.notes)}`);
  return lines.join("\n");
}
