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

async function trySendNow(chatId: string, message: string, timeoutMs = 10_000): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const plainText = message.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "");

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
    }, timeoutMs);

    if (res.ok) return true;

    // Fallback to plain text
    const fallback = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: plainText, disable_web_page_preview: true }),
    }, timeoutMs);

    return fallback.ok;
  } catch {
    return false;
  }
}

// A real bot token is "<digits>:<35-ish letters, digits, _ and ->". Worth
// checking separately, because the commonest way to get this wrong is not a
// typo: DigitalOcean stores secrets encrypted and shows them as "EV[1:...]",
// so copying what is on screen carries the ciphertext across, not the token.
const TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

/**
 * Never let the token into a string that gets returned or logged.
 *
 * A failed fetch reports the URL it tried, and the URL contains the token —
 * so the diagnostic built to explain a broken token would have published a
 * working one.
 */
function scrub(text: string): string {
  const token = getTelegramBotToken();
  return token ? text.split(token).join("<token>") : text;
}

export type TelegramDiagnosis = {
  tokenPresent: boolean;
  tokenLooksValid: boolean;
  chatIdCount: number;
  chatIdsLookValid: boolean;
  botUsername: string | null;
  ok: boolean;
  problem: string | null;
  delivered: number;
};

/**
 * Answer "why is nothing arriving in Telegram?" without ever revealing the
 * credentials. Telegram's getMe validates a token without sending anything,
 * so the token and the chat ID can be diagnosed separately — which matters,
 * because a good token with a wrong chat ID fails identically to a bad token.
 */
export async function diagnoseTelegram(sendTest: boolean): Promise<TelegramDiagnosis> {
  const token = getTelegramBotToken();
  const chatIds = getTelegramChatIds();

  const result: TelegramDiagnosis = {
    tokenPresent: Boolean(token),
    tokenLooksValid: TOKEN_SHAPE.test(token),
    chatIdCount: chatIds.length,
    chatIdsLookValid: chatIds.length > 0 && chatIds.every((id) => /^-?\d+$/.test(id)),
    botUsername: null,
    ok: false,
    problem: null,
    delivered: 0,
  };

  if (!result.tokenPresent) {
    result.problem = "TELEGRAM_BOT_TOKEN is not set.";
    return result;
  }

  if (!result.tokenLooksValid) {
    result.problem =
      "TELEGRAM_BOT_TOKEN is not shaped like a Telegram token. If it was copied " +
      "from DigitalOcean it is probably the encrypted 'EV[1:...]' text rather " +
      "than the token itself. Get the real one from @BotFather.";
    return result;
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/getMe`,
      { method: "GET" },
      10_000,
    );
    const body = (await res.json().catch(() => ({}))) as any;

    if (!res.ok || !body?.ok) {
      result.problem = scrub(
        `Telegram rejected the token: ${body?.description || `HTTP ${res.status}`}`,
      );
      return result;
    }

    result.botUsername = body.result?.username ?? null;
  } catch (error) {
    result.problem = scrub(
      `Could not reach Telegram: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }

  if (!result.chatIdCount) {
    result.problem =
      "The token works, but TELEGRAM_CHAT_ID is not set, so there is nobody to send to.";
    return result;
  }

  if (!result.chatIdsLookValid) {
    result.problem =
      "The token works, but a chat ID is not a number. A chat ID looks like " +
      "123456789 for a person or -1001234567890 for a group.";
    return result;
  }

  if (sendTest) {
    for (const chatId of chatIds) {
      const sent = await trySendNow(
        chatId,
        "✅ Rajesh Shopping Center — test message. Notifications are working.",
      );
      if (sent) result.delivered += 1;
    }

    if (!result.delivered) {
      result.problem =
        "The token is valid but the message was not accepted. The usual cause " +
        "is the chat ID: open a chat with the bot and send it /start, because " +
        "a bot cannot message someone who has never messaged it.";
      return result;
    }
  }

  result.ok = true;
  return result;
}

// A customer is waiting on the order confirmation while this runs, so the
// notification gets a shorter budget than a login code does. Past it we stop
// waiting and leave the message queued for the next cron run rather than
// holding up the checkout.
const NOTIFY_TIMEOUT_MS = 6_000;

/**
 * Tell the owner about something that just happened, and wait long enough to
 * know whether it worked.
 *
 * `sendTelegramMessage()` below queues and returns immediately, leaving the
 * send to a floating promise. On a long-running server that is fine — the
 * process is still there, and a 30-second worker retries. On serverless it is
 * not: the instance is frozen the moment the response goes out, so the send
 * usually never runs at all, and the only thing that would drain the queue is
 * the daily cron at 01:45 Nepal time. A new order the shopkeeper hears about
 * the following night is not a notification.
 *
 * Failure leaves the row "pending", not "failed", so the cron still retries —
 * `sendTelegramMessageNow()` marks failures terminal, which is right for a
 * login code nobody wants resent hours later and wrong for an order.
 *
 * Never throws. Telegram being down must not fail a customer's order.
 */
export async function sendOwnerNotification(message: string): Promise<boolean> {
  const chatIds = getTelegramChatIds();
  const token = getTelegramBotToken();

  if (!token || !chatIds.length) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return false;
  }

  let delivered = false;

  for (const chatId of chatIds) {
    let sent = false;
    try {
      sent = await trySendNow(chatId, message, NOTIFY_TIMEOUT_MS);
    } catch (err) {
      console.error("[Telegram] Notification attempt threw:", err);
    }
    if (sent) delivered = true;

    try {
      await db.insert(telegramQueueTable).values({
        message,
        chatId,
        status: sent ? "sent" : "pending",
        attempts: 1,
        lastAttemptedAt: new Date(),
        ...(sent ? { sentAt: new Date() } : {}),
      });
    } catch (err) {
      console.error("[Telegram] Could not record a notification:", err);
    }
  }

  return delivered;
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

/**
 * Sends now, waits for the result, and reports whether Telegram actually took
 * the message.
 *
 * `sendTelegramMessage()` above queues and returns immediately, leaning on
 * `startTelegramQueueWorker()` to retry every 30 seconds. That is the right
 * trade for a new-order notification, and the wrong one for a login code:
 *
 * - On serverless there is no worker, and the queue is drained once a day. A
 *   queued login code is a lock-out, not a delayed message.
 * - Even with the worker running, the caller could not tell the owner whether
 *   the code was on its way, so the login screen said "code sent" either way.
 *
 * Anything a person is sitting and waiting for goes through here instead.
 */
export async function sendTelegramMessageNow(message: string): Promise<boolean> {
  const chatIds = getTelegramChatIds();
  const token = getTelegramBotToken();

  if (!token || !chatIds.length) {
    console.warn("[Telegram] Missing bot token or chat ID env var.");
    return false;
  }

  let delivered = false;

  for (const chatId of chatIds) {
    const sent = await trySendNow(chatId, message);
    if (sent) delivered = true;

    // Recorded so the attempt is visible alongside the queued messages. A
    // database problem must never decide whether we tell the owner their code
    // was sent — that answer comes from Telegram, above.
    try {
      await db.insert(telegramQueueTable).values({
        message,
        chatId,
        status: sent ? "sent" : "failed",
        attempts: 1,
        lastAttemptedAt: new Date(),
        ...(sent ? { sentAt: new Date() } : {}),
      });
    } catch (err) {
      console.error("[Telegram] Could not record a direct send:", err);
    }
  }

  return delivered;
}

const QUEUE_MAX_ATTEMPTS = 240; // 2 hours at one attempt every 30 seconds

/**
 * Drains one batch of the pending queue.
 *
 * Exported so it can be driven two ways: on a 30-second interval by
 * `startTelegramQueueWorker()` where a process stays alive, or once per run
 * from `/api/cron/daily` on serverless, where nothing does.
 *
 * Returns a small summary so the cron route can report what it did.
 */
export async function processTelegramQueueOnce(): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const summary = { attempted: 0, sent: 0, failed: 0 };

  try {
    const pending = await db
      .select()
      .from(telegramQueueTable)
      .where(
        and(
          eq(telegramQueueTable.status, "pending"),
          lt(telegramQueueTable.attempts, QUEUE_MAX_ATTEMPTS),
        )
      )
      .limit(20);

    for (const item of pending) {
      const sent = await trySendNow(item.chatId, item.message);
      const newAttempts = item.attempts + 1;
      summary.attempted += 1;

      if (sent) {
        await db.update(telegramQueueTable)
          .set({ status: "sent", sentAt: new Date(), attempts: newAttempts, lastAttemptedAt: new Date() })
          .where(eq(telegramQueueTable.id, item.id));
        summary.sent += 1;
        console.info(`[Telegram] Queue #${item.id} sent on attempt ${newAttempts}`);
      } else if (newAttempts >= QUEUE_MAX_ATTEMPTS) {
        await db.update(telegramQueueTable)
          .set({ status: "failed", attempts: newAttempts, lastAttemptedAt: new Date() })
          .where(eq(telegramQueueTable.id, item.id));
        summary.failed += 1;
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

  return summary;
}

// Background worker — call once on server startup. Has no effect on serverless,
// where the process does not outlive the response; `/api/cron/daily` covers it.
export function startTelegramQueueWorker(): void {
  const INTERVAL_MS = 30_000; // check every 30 seconds

  setInterval(() => {
    void processTelegramQueueOnce();
  }, INTERVAL_MS);

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
