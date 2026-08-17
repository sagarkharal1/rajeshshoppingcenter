import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";

const router: IRouter = Router();

const OFFICIAL_SHOP_NAME = "राजेश सपिङ्ग सेन्टर";
const OFFICIAL_ADDRESS = "मुसिकोट–५, आपचौर, गुल्मी";
const OFFICIAL_PHONE = "९८१४४०१७१६";
const OFFICIAL_PAN = "३०२९५१८१७";
const OFFICIAL_ABOUT_NEPALI =
  "राजेश सपिङ्ग सेन्टर १९९७ देखि मुसिकोट–५, आपचौर, गुल्मीमा सेवा दिँदै आएको बहुउपयोगी स्थानीय व्यवसाय हो। यहाँ तरकारी, फलफूल, खाद्यान्न, किराना, लत्ताकपडा, हार्डवेयर, ग्यास, जुत्ता-चप्पल र दैनिक चाहिने धेरै सामान पाइन्छ। यहाँ डेलिभरी सेवा, बोलेरो डबल क्याब सेवा र ट्रयाक्टर सहयोग पनि उपलब्ध छ।";

const PUBLIC_FIELDS = [
  "shopName",
  "proprietorName",
  "phone",
  "panNumber",
  "email",
  "address",
  "bankName",
  "accountName",
  "accountNumber",
  "bankBranch",
  "aboutText",
  "deliveryPolicy",
  "termsConditions",
  "shopPhotoPath",
  "ownerPhotoPath",
  "homeBannerPath",
  "bankQrPath",
  "esewaId",
  "esewaQrPath",
  "khaltiId",
  "khaltiQrPath",
  "rewardRate",
  "rewardUnitAmount",
  // Customers need to see what a point is worth and whether a bonus offer is
  // running — that is the point of declaring one.
  "rewardPointValue",
  "rewardBonusMultiplier",
  "rewardBonusLabel",
  "rewardBonusStartsAt",
  "rewardBonusEndsAt",
  "invoiceFooter",
  "whatsappPhone",
  "announcements",
  "featuredMedia",
] as const;

const DEFAULT_PUBLIC_SETTINGS = {
  shopName: OFFICIAL_SHOP_NAME,
  proprietorName: "Sandesh Kharal",
  phone: OFFICIAL_PHONE,
  panNumber: OFFICIAL_PAN,
  email: "rajeshshoppingcenter@gmail.com",
  address: OFFICIAL_ADDRESS,
  bankName: null,
  accountName: null,
  accountNumber: null,
  bankBranch: null,
  aboutText: OFFICIAL_ABOUT_NEPALI,
  deliveryPolicy:
    "Delivery service is available for groceries, food, hardware materials, and other shop items. Rajesh Shopping Center also provides Bolero double cab service for tours, travel, and deliveries, plus tractor delivery for sand, cement, stones, rods, and other heavy hardware materials. Please call before confirming large or QR-based orders.",
  termsConditions:
    "Please confirm your order by phone before paying through Bank QR, eSewa, or Khalti. Delivery timing depends on product type, road access, and vehicle availability. Heavy hardware items and construction materials may be delivered by tractor or Bolero double cab depending on load and destination.",
  shopPhotoPath: null,
  ownerPhotoPath: null,
  homeBannerPath: null,
  bankQrPath: null,
  esewaId: null,
  esewaQrPath: null,
  khaltiId: null,
  khaltiQrPath: null,
  rewardRate: 1,
  rewardUnitAmount: 100,
  invoiceFooter: "Rajesh Shopping Center | Since 1997 | Proprietor: Sandesh Kharal | +9779814401716 | Please call before QR payment.",
  whatsappPhone: "+9779814401716",
  announcements: [],
  featuredMedia: [],
} as const;

function stripSensitiveFields(settings: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    safe[key] = settings[key] ?? null;
  }
  return safe;
}

function useDefaultIfPlaceholder(value: unknown, fallback: unknown) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "my business" || normalized === "nepal" || normalized === "+977") {
    return fallback;
  }
  return value;
}

function normalizeLegacyField(value: unknown, field: "shopName" | "address" | "aboutText" | "phone" | "panNumber") {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (field === "shopName") {
    const wrongNames = [
      "Rajesh Shopping Center",
      "राजेश शपिङ सेन्टर",
      "राजेश शपिङ्ग सेन्टर",
    ];
    if (wrongNames.includes(trimmed)) return OFFICIAL_SHOP_NAME;
  }

  if (field === "address") {
    const wrongAddresses = [
      "Musikot-5, Anpchaur, Gulmi, Nepal",
      "Musikot-5, Aapchaur, Gulmi, Nepal",
      "मुसिकोट-५, अनपचौर, गुल्मी, नेपाल",
      "मुसिकोट-५, आँपचौर",
      "मुसिकोट–५, अनपचौर, गुल्मी",
    ];
    if (wrongAddresses.includes(trimmed)) return OFFICIAL_ADDRESS;
  }

  if (field === "aboutText" && /(Anpchaur|Aapchaur|अनपचौर|आँपचौर|Rajesh Shopping Center|राजेश शपिङ)/i.test(trimmed)) {
    return OFFICIAL_ABOUT_NEPALI;
  }

  if (field === "phone" && (trimmed === "+9779814401716" || trimmed === "9814401716")) {
    return OFFICIAL_PHONE;
  }

  if (field === "panNumber" && trimmed === "302951817") {
    return OFFICIAL_PAN;
  }

  return value;
}

function normalizePublicSettings(settings: Record<string, unknown>) {
  return {
    ...DEFAULT_PUBLIC_SETTINGS,
    ...settings,
    shopName: normalizeLegacyField(useDefaultIfPlaceholder(settings.shopName, DEFAULT_PUBLIC_SETTINGS.shopName), "shopName"),
    proprietorName: useDefaultIfPlaceholder(settings.proprietorName, DEFAULT_PUBLIC_SETTINGS.proprietorName),
    phone: normalizeLegacyField(useDefaultIfPlaceholder(settings.phone, DEFAULT_PUBLIC_SETTINGS.phone), "phone"),
    panNumber: normalizeLegacyField(useDefaultIfPlaceholder(settings.panNumber, DEFAULT_PUBLIC_SETTINGS.panNumber), "panNumber"),
    email: useDefaultIfPlaceholder(settings.email, DEFAULT_PUBLIC_SETTINGS.email),
    address: normalizeLegacyField(useDefaultIfPlaceholder(settings.address, DEFAULT_PUBLIC_SETTINGS.address), "address"),
    aboutText: normalizeLegacyField(useDefaultIfPlaceholder(settings.aboutText, DEFAULT_PUBLIC_SETTINGS.aboutText), "aboutText"),
  };
}

router.get("/settings", async (_req, res) => {
  try {
    const [settings] = await db.select().from(settingsTable).orderBy(asc(settingsTable.id)).limit(1);
    if (!settings) {
      return res.json(stripSensitiveFields(DEFAULT_PUBLIC_SETTINGS));
    }
    res.json(stripSensitiveFields(normalizePublicSettings(settings as unknown as Record<string, unknown>)));
  } catch (err) {
    res.status(500).json({ error: "Failed to get settings" });
  }
});

export default router;
