import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedConfig: { phone: string; apiKey: string } | null = null;
let cacheExpiry = 0;

export function invalidateWhatsAppCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

async function getWhatsAppConfig(): Promise<{ phone: string; apiKey: string } | null> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;

  const [settings] = await db.select({
    whatsappPhone: settingsTable.whatsappPhone,
    whatsappApiKey: settingsTable.whatsappApiKey,
  }).from(settingsTable).limit(1);

  if (!settings?.whatsappPhone || !settings?.whatsappApiKey) {
    cachedConfig = null;
    cacheExpiry = now + CACHE_TTL_MS;
    return null;
  }

  cachedConfig = { phone: settings.whatsappPhone, apiKey: settings.whatsappApiKey };
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedConfig;
}

export async function sendWhatsApp(message: string): Promise<void> {
  const config = await getWhatsAppConfig();
  if (!config) return;

  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${encoded}&apikey=${config.apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[WhatsApp] CallMeBot responded with status", res.status);
    }
  } catch (err) {
    console.warn("[WhatsApp] Failed to send notification:", err);
  }
}

export function formatOrderMessage(order: {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  totalAmount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
}): string {
  const itemLines = order.items
    .map((i) => `  • ${i.productName} x${i.quantity} @ NPR ${i.price}/${i.unit ?? "pc"}`)
    .join("\n");

  const payment = order.paymentMethod
    ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)
    : "Bank";

  return (
    `🛒 *NEW ORDER #${order.id}*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Customer:* ${order.customerName}\n` +
    `📞 *Phone:* ${order.customerPhone}\n` +
    `📍 *Address:* ${order.customerAddress}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `*Items:*\n${itemLines}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total:* NPR ${order.totalAmount.toLocaleString()}\n` +
    `💳 *Payment:* ${payment}\n` +
    (order.notes ? `📝 *Notes:* ${order.notes}\n` : "") +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `_Rajesh Shopping Center_`
  );
}

export function formatBookingMessage(booking: {
  id: number;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  destination: string;
  bookingDate: string;
  notes?: string | null;
}): string {
  const service = booking.serviceType === "jeep" ? "🚙 Jeep" : "🚜 Tractor";

  return (
    `📅 *NEW BOOKING #${booking.id}*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `${service} *Rental Request*\n` +
    `👤 *Customer:* ${booking.customerName}\n` +
    `📞 *Phone:* ${booking.customerPhone}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *From:* ${booking.pickupLocation}\n` +
    `🏁 *To:* ${booking.destination}\n` +
    `🗓️ *Date:* ${booking.bookingDate}\n` +
    (booking.notes ? `📝 *Notes:* ${booking.notes}\n` : "") +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `_Rajesh Shopping Center_`
  );
}

export function formatStatusMessage(order: {
  id: number;
  customerName: string;
  status: string;
  totalAmount: number;
}): string {
  const statusEmoji: Record<string, string> = {
    confirmed: "✅",
    processing: "⏳",
    delivered: "📦",
    cancelled: "❌",
  };
  const emoji = statusEmoji[order.status] ?? "🔔";
  const label = order.status.charAt(0).toUpperCase() + order.status.slice(1);

  return (
    `${emoji} *ORDER #${order.id} — ${label.toUpperCase()}*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Customer:* ${order.customerName}\n` +
    `💰 *Total:* NPR ${order.totalAmount.toLocaleString()}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `_Rajesh Shopping Center_`
  );
}
