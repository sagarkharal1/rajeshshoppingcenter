import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";

const CACHE_TTL_MS = 5 * 60 * 1000;
// Hardcoded owner WhatsApp number — used when no number is stored in settings/env
const OWNER_WHATSAPP_PHONE = "+9779814401716";

type WhatsAppConfig = {
  phone: string;
  provider: "callmebot";
  apiKey: string;
};

let cachedConfig: WhatsAppConfig | null = null;
let cacheExpiry = 0;

function asNonEmpty(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function invalidateWhatsAppCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;

  const envPhone = asNonEmpty(process.env.WHATSAPP_OWNER_NUMBER);
  const envApiKey = asNonEmpty(process.env.WHATSAPP_API_KEY);
  const envProvider = asNonEmpty(process.env.WHATSAPP_PROVIDER) ?? "callmebot";

  if (envPhone && envApiKey) {
    cachedConfig = {
      phone: envPhone,
      apiKey: envApiKey,
      provider: envProvider === "callmebot" ? "callmebot" : "callmebot",
    };
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedConfig;
  }

  const [settings] = await db
    .select({
      whatsappPhone: settingsTable.whatsappPhone,
      whatsappApiKey: settingsTable.whatsappApiKey,
    })
    .from(settingsTable)
    .limit(1);

  if (!settings?.whatsappApiKey) {
    cachedConfig = null;
    cacheExpiry = now + CACHE_TTL_MS;
    return null;
  }

  cachedConfig = {
    // Use stored phone if set, otherwise fall back to the hardcoded owner number
    phone: settings.whatsappPhone || OWNER_WHATSAPP_PHONE,
    apiKey: settings.whatsappApiKey,
    provider: "callmebot",
  };
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedConfig;
}

export async function sendWhatsApp(message: string): Promise<void> {
  const config = await getWhatsAppConfig();
  if (!config) return;

  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${encoded}&apikey=${config.apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[WhatsApp] CallMeBot responded with status", response.status);
    }
  } catch (error) {
    console.warn("[WhatsApp] Failed to send notification:", error);
  }
}

function paymentMethodLabel(method?: string | null): string {
  switch (method) {
    case "esewa":
      return "eSewa";
    case "khalti":
      return "Khalti";
    case "bank":
      return "Bank / QR";
    default:
      return "Unknown";
  }
}

function paymentStatusLabel(status?: string | null): string {
  return status === "paid" ? "Paid" : "Unpaid";
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case "order-received":
      return "Order received";
    case "preparing":
      return "Preparing";
    case "dispatched":
      return "Dispatched";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
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
  paymentStatus?: string | null;
  notes?: string | null;
  items: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
}): string {
  const itemSummary = order.items
    .map((item) => `- ${item.productName} x${item.quantity} @ NPR ${item.price}/${item.unit ?? "pc"}`)
    .join("\n");

  return [
    `NEW ORDER #${order.id}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    order.customerEmail ? `Email: ${order.customerEmail}` : null,
    `Address: ${order.customerAddress}`,
    "",
    "Items:",
    itemSummary,
    "",
    `Total: NPR ${order.totalAmount.toLocaleString()}`,
    `Payment method: ${paymentMethodLabel(order.paymentMethod)}`,
    `Payment status: ${paymentStatusLabel(order.paymentStatus)}`,
    order.notes ? `Notes: ${order.notes}` : null,
    "",
    "Rajesh Shopping Center",
  ]
    .filter(Boolean)
    .join("\n");
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
  const serviceLabel = booking.serviceType === "jeep" ? "Bolero / Jeep" : "Tractor";
  return [
    `NEW BOOKING #${booking.id}`,
    `Service: ${serviceLabel}`,
    `Customer: ${booking.customerName}`,
    `Phone: ${booking.customerPhone}`,
    `Pickup: ${booking.pickupLocation}`,
    `Destination: ${booking.destination}`,
    `Date: ${booking.bookingDate}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
    "",
    "Rajesh Shopping Center",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatStatusMessage(order: {
  id: number;
  customerName: string;
  status: string;
  paymentStatus?: string | null;
  totalAmount: number;
}): string {
  return [
    `ORDER UPDATE #${order.id}`,
    `Customer: ${order.customerName}`,
    `Order status: ${orderStatusLabel(order.status)}`,
    `Payment status: ${paymentStatusLabel(order.paymentStatus)}`,
    `Total: NPR ${order.totalAmount.toLocaleString()}`,
    "",
    "Rajesh Shopping Center",
  ].join("\n");
}
