import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Boxes,
  CreditCard,
  Gift,
  ImagePlus,
  Languages,
  LayoutDashboard,
  Megaphone,
  Pencil,
  PackagePlus,
  ReceiptText,
  Trash2,
  Users,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { PublicLayoutModern } from "@/components/public-layout-modern";
import { Toaster } from "@/components/ui/toaster";
import { CartProvider } from "@/lib/cart";
import { LanguageProvider, useLanguage } from "@/lib/language";
import AboutPage from "@/pages/about-page";
import AccountPage from "@/pages/account-page";
import BookService from "@/pages/book";
import CartPage from "@/pages/cart-modern";
import Catalog from "@/pages/catalog-modern";
import Checkout from "@/pages/checkout-modern";
import Home from "@/pages/home-modern";
import NotFound from "@/pages/not-found";
import ProductDetail from "@/pages/product-detail";
import TermsPage from "@/pages/terms-page";
import TrackOrderPage from "@/pages/track-order-modern";
import { OwnerLoginModern, OwnerWorkspaceModern } from "@/components/owner-modern";

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
const when = (value: string) =>
  new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const num = (value: unknown) => Number(value ?? 0);
const queryClient = new QueryClient();
const OWNER_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function shellCard(classes = "") {
  return `rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.45)] ${classes}`;
}

function inputClasses() {
  return "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
}

function buildProductImage(label: string, accent: string, subtext: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <rect width="600" height="420" rx="36" fill="url(#g)"/>
    <circle cx="500" cy="95" r="74" fill="rgba(255,255,255,0.12)"/>
    <circle cx="110" cy="330" r="88" fill="rgba(255,255,255,0.08)"/>
    <text x="48" y="200" fill="white" font-size="48" font-family="DM Sans, Arial, sans-serif" font-weight="700">${label}</text>
    <text x="48" y="252" fill="rgba(255,255,255,0.82)" font-size="24" font-family="DM Sans, Arial, sans-serif">${subtext}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const shopCategories = [
  { name: "Fruits", description: "Fresh seasonal fruits and family fruit packs.", icon: "fruits", sortOrder: 1 },
  { name: "Vegetables", description: "Daily fresh vegetables for home kitchens and hotels.", icon: "vegetables", sortOrder: 2 },
  { name: "Food Items", description: "Rice, dal, oil, spices, noodles, and daily food staples.", icon: "foods", sortOrder: 3 },
  { name: "Groceries", description: "Soap, detergent, biscuits, snacks, and daily household goods.", icon: "grocery", sortOrder: 4 },
  { name: "LPG Cylinder", description: "Cooking LPG cylinders and LPG accessories.", icon: "gas", sortOrder: 5 },
  { name: "Hardware", description: "Cement, rods, tools, fittings, and building materials.", icon: "hardware", sortOrder: 6 },
  { name: "Beverages", description: "Soft drinks, juice, water, and cold beverages.", icon: "beverages", sortOrder: 7 },
  { name: "Smoke & Tobacco", description: "Cigarettes, tobacco, and smoking accessories.", icon: "smoke", sortOrder: 8 },
  { name: "Remittance", description: "Money transfer and remittance support service.", icon: "remittance", sortOrder: 9 },
  { name: "Transport Services", description: "Bolero, tractor, delivery, and travel service booking.", icon: "transport", sortOrder: 10 },
  { name: "Clothes", description: "Daily wear, school wear, and family clothing items.", icon: "clothes", sortOrder: 11 },
  { name: "Shoes and Slippers", description: "Shoes, sandals, slippers, and school footwear.", icon: "shoes", sortOrder: 12 },
] as const;

function makeSampleProduct(
  name: string,
  categoryName: (typeof shopCategories)[number]["name"],
  sku: string,
  price: number,
  buyingPrice: number,
  transportationCost: number,
  extraCost: number,
  stockQuantity: number,
  reorderLevel: number,
  unit: string,
  accent: string,
  subtext: string,
  description: string,
  featured = false,
) {
  return {
    name,
    categoryName,
    description,
    sku,
    price,
    buyingPrice,
    transportationCost,
    extraCost,
    stockQuantity,
    reorderLevel,
    unit,
    imageUrl: buildProductImage(name, accent, subtext),
    inStock: stockQuantity > 0,
    featured,
  };
}

const sampleCatalogProducts = [
  makeSampleProduct("Fresh Apple", "Fruits", "RSC-FRU-001", 280, 225, 10, 5, 32, 10, "kg", "#DC2626", "Sweet fruit", "Fresh apples popular in Nepali homes for snacks, puja, and family fruit bowls.", true),
  makeSampleProduct("Banana Dozen", "Fruits", "RSC-FRU-002", 140, 110, 6, 4, 26, 8, "dozen", "#F59E0B", "Morning energy", "Locally sold banana bunch for daily breakfast, children, and travel snacks."),
  makeSampleProduct("Fresh Tomato", "Vegetables", "RSC-VEG-001", 95, 70, 5, 3, 72, 18, "kg", "#E11D48", "Daily kitchen", "Clean ripe tomatoes for curry, achar, salad, and daily home cooking.", true),
  makeSampleProduct("Cauliflower", "Vegetables", "RSC-VEG-002", 110, 82, 6, 4, 24, 8, "kg", "#F8FAFC", "Seasonal fresh", "Fresh cauliflower for tarkari, mixed vegetable dishes, and hotel cooking."),
  makeSampleProduct("Sona Masuli Rice 25kg", "Food Items", "RSC-FOOD-001", 1850, 1610, 65, 20, 26, 8, "bag", "#C18F2D", "Family rice pack", "Soft fragrant rice suitable for daily meals, family feasts, and guest hospitality.", true),
  makeSampleProduct("Masoor Dal", "Food Items", "RSC-FOOD-002", 225, 190, 7, 4, 48, 12, "kg", "#C2410C", "Daily dal", "Reliable red lentils for everyday dal, soups, and family cooking."),
  makeSampleProduct("Wai Wai Noodles Pack", "Food Items", "RSC-FOOD-003", 30, 23, 2, 1, 120, 30, "packet", "#B91C1C", "Popular snack", "Quick noodles for tea-time, tiffin, and emergency snacks."),
  makeSampleProduct("Sunflower Oil 1L", "Groceries", "RSC-GRO-001", 290, 248, 8, 5, 35, 10, "bottle", "#FBBF24", "Cooking oil", "Refined oil used for daily frying, cooking, and household grocery stock."),
  makeSampleProduct("Laundry Soap", "Groceries", "RSC-GRO-002", 45, 32, 2, 1, 80, 20, "piece", "#2563EB", "Household use", "Affordable washing soap for home laundry and everyday cleaning."),
  makeSampleProduct("Biscuit Family Pack", "Groceries", "RSC-GRO-003", 120, 92, 4, 2, 42, 12, "packet", "#A16207", "Tea snack", "Popular biscuit pack for tea shops, homes, and school snacks."),
  makeSampleProduct("LPG Cylinder Refill", "LPG Cylinder", "RSC-GAS-001", 1950, 1810, 40, 15, 12, 4, "cylinder", "#64748B", "Cooking LPG", "Cooking LPG refill service for homes, tea shops, and small hotels.", true),
  makeSampleProduct("LPG Regulator", "LPG Cylinder", "RSC-GAS-002", 850, 720, 18, 8, 14, 5, "piece", "#475569", "Safe fitting", "Useful LPG regulator spare for secure kitchen connection and replacement."),
  makeSampleProduct("PPC Cement Bag", "Hardware", "RSC-HRD-001", 970, 830, 55, 12, 34, 10, "bag", "#78716C", "Construction item", "Quality cement for building work, plaster, and small house construction.", true),
  makeSampleProduct("Steel Rod Bundle", "Hardware", "RSC-HRD-002", 1320, 1160, 55, 18, 12, 5, "bundle", "#4B5563", "Building support", "Strong construction rod bundle suitable for home, shop, and local building work."),
  makeSampleProduct("GI Pipe", "Hardware", "RSC-HRD-003", 640, 525, 28, 10, 20, 6, "piece", "#334155", "Plumbing use", "Galvanized pipe for water line, plumbing repair, and hardware supply."),
  makeSampleProduct("Mineral Water 1L", "Beverages", "RSC-BEV-001", 35, 24, 2, 1, 96, 24, "bottle", "#0284C7", "Cold refreshment", "Safe bottled drinking water for travel, school, and shop customers."),
  makeSampleProduct("Cold Drink Bottle", "Beverages", "RSC-BEV-002", 185, 145, 6, 2, 18, 10, "bottle", "#1D4ED8", "Family beverage", "Popular cold drink for guests, celebrations, and family meals."),
  makeSampleProduct("Energy Drink Can", "Beverages", "RSC-BEV-003", 140, 108, 4, 2, 22, 8, "can", "#7C3AED", "Quick energy", "Energy drink can for travel, work, and youth customers."),
  makeSampleProduct("Surya Cigarette", "Smoke & Tobacco", "RSC-SMK-001", 25, 20, 1, 1, 180, 50, "piece", "#6B7280", "Popular smoke", "Widely sold cigarette item for tobacco customers.", false),
  makeSampleProduct("Khaini Pack", "Smoke & Tobacco", "RSC-SMK-002", 35, 28, 1, 1, 90, 20, "packet", "#92400E", "Tobacco pack", "Chewing tobacco pack commonly sold in local markets.", false),
  makeSampleProduct("IME Remit Service", "Remittance", "RSC-REM-001", 0, 0, 0, 0, 999, 0, "service", "#0F766E", "Money transfer", "Remittance assistance for sending and receiving money through supported service desks.", true),
  makeSampleProduct("eSewa Cash In Support", "Remittance", "RSC-REM-002", 0, 0, 0, 0, 999, 0, "service", "#16A34A", "Wallet support", "Support service for wallet payment help, cash in guidance, and digital transfer assistance.", false),
  makeSampleProduct("Bolero Delivery Booking", "Transport Services", "RSC-TRN-001", 2500, 1900, 180, 90, 12, 0, "trip", "#1E3A8A", "Local trip", "Bolero double cab booking for village delivery, tours, and transport needs.", true),
  makeSampleProduct("Tractor Sand Delivery", "Transport Services", "RSC-TRN-002", 4500, 3700, 250, 120, 8, 0, "trip", "#92400E", "Construction transport", "Tractor delivery service for sand, stones, cement support, and hardware transport."),
  makeSampleProduct("Ladies Kurta Set", "Clothes", "RSC-CLT-001", 1650, 1380, 42, 16, 16, 5, "set", "#DB2777", "Festive wear", "Simple and attractive kurta set for daily wear, gatherings, and festivals."),
  makeSampleProduct("School Uniform Shirt", "Clothes", "RSC-CLT-002", 780, 630, 25, 10, 22, 8, "piece", "#2563EB", "School wear", "School shirt item for students and uniform shopping."),
  makeSampleProduct("Walking Shoes", "Shoes and Slippers", "RSC-SHO-001", 1650, 1390, 40, 15, 14, 6, "pair", "#0F766E", "Comfortable pair", "Comfortable shoes for market, school, work, and daily outside movement."),
  makeSampleProduct("Rubber Slippers", "Shoes and Slippers", "RSC-SHO-002", 320, 240, 10, 5, 40, 12, "pair", "#0891B2", "Daily home use", "Affordable slippers for home use, bathing area, and daily quick wear."),
  makeSampleProduct("Orange 1kg", "Fruits", "RSC-FRU-003", 180, 145, 8, 4, 36, 10, "kg", "#EA580C", "Vitamin fruit", "Seasonal oranges for family fruit bowls, school tiffin, and guests."),
  makeSampleProduct("Pomegranate 1kg", "Fruits", "RSC-FRU-004", 360, 310, 12, 6, 18, 6, "kg", "#BE123C", "Premium fruit", "Fresh pomegranate for health, puja, and family use."),
  makeSampleProduct("Potato 1kg", "Vegetables", "RSC-VEG-003", 70, 52, 4, 2, 110, 25, "kg", "#A16207", "Daily vegetable", "Daily potato stock for tarkari, snacks, and hotel cooking."),
  makeSampleProduct("Onion 1kg", "Vegetables", "RSC-VEG-004", 95, 72, 5, 2, 95, 20, "kg", "#7E22CE", "Kitchen staple", "Onion for dal, curry, achar, chowmein, and daily kitchen use."),
  makeSampleProduct("Atta Flour 5kg", "Food Items", "RSC-FOOD-004", 520, 445, 18, 8, 30, 8, "packet", "#B45309", "Roti flour", "Wheat flour pack for roti, puri, and daily family cooking."),
  makeSampleProduct("Sugar 1kg", "Food Items", "RSC-FOOD-005", 115, 94, 4, 2, 75, 18, "kg", "#F8FAFC", "Tea staple", "Sugar for tea, sweets, snacks, and household grocery needs."),
  makeSampleProduct("Iodized Salt 1kg", "Groceries", "RSC-GRO-004", 25, 18, 1, 1, 140, 35, "packet", "#CBD5E1", "Daily salt", "Iodized salt packet for every household kitchen."),
  makeSampleProduct("Surf Excel Detergent", "Groceries", "RSC-GRO-005", 185, 150, 5, 3, 40, 10, "packet", "#2563EB", "Laundry care", "Detergent powder for clothes washing and household use."),
  makeSampleProduct("Milk Tea 250g", "Groceries", "RSC-GRO-006", 210, 175, 6, 3, 28, 8, "packet", "#854D0E", "Tea pack", "Tea packet for daily Nepali milk tea at home and shops."),
  makeSampleProduct("Gas Pipe 1m", "LPG Cylinder", "RSC-GAS-003", 180, 135, 6, 4, 24, 8, "piece", "#64748B", "Kitchen safety", "Gas pipe for LPG stove connection and safe kitchen replacement."),
  makeSampleProduct("Gas Lighter", "LPG Cylinder", "RSC-GAS-004", 140, 95, 4, 2, 30, 10, "piece", "#F97316", "Kitchen tool", "Gas lighter for home kitchens, tea shops, and small hotels."),
  makeSampleProduct("Nails 1kg", "Hardware", "RSC-HRD-004", 190, 148, 8, 4, 38, 10, "kg", "#334155", "Repair item", "Mixed nails for furniture repair, roofing work, and small construction jobs."),
  makeSampleProduct("PVC Pipe 20mm", "Hardware", "RSC-HRD-005", 260, 205, 14, 6, 22, 6, "piece", "#0F766E", "Water line", "PVC pipe for household water line, farm repair, and plumbing work."),
  makeSampleProduct("Frooti Mango Drink", "Beverages", "RSC-BEV-004", 35, 26, 2, 1, 72, 24, "packet", "#F59E0B", "Mango drink", "Mango drink pack for children, travel, and quick refreshment."),
  makeSampleProduct("Dew Bottle 500ml", "Beverages", "RSC-BEV-005", 80, 62, 3, 1, 36, 12, "bottle", "#65A30D", "Cold drink", "Cold drink bottle for guests, snacks, and shop customers."),
  makeSampleProduct("Cardamom Pack", "Smoke & Tobacco", "RSC-SMK-003", 20, 15, 1, 1, 100, 25, "packet", "#92400E", "Mouth freshener", "Small cardamom or mouth freshener pack sold near the counter."),
  makeSampleProduct("Mobile Recharge Support", "Remittance", "RSC-REM-003", 0, 0, 0, 0, 999, 0, "service", "#1D4ED8", "Recharge help", "Support service for mobile top-up and customer recharge assistance."),
  makeSampleProduct("Tata Telcoline Booking", "Transport Services", "RSC-TRN-003", 2800, 2150, 180, 95, 10, 0, "trip", "#334155", "Pickup service", "Tata Telcoline pickup booking for goods delivery and local transport."),
  makeSampleProduct("Men T-Shirt", "Clothes", "RSC-CLT-003", 650, 490, 20, 8, 24, 8, "piece", "#0F172A", "Daily wear", "Men's cotton T-shirt for daily wear, travel, and casual use."),
  makeSampleProduct("Ladies Shawl", "Clothes", "RSC-CLT-004", 950, 760, 24, 10, 18, 6, "piece", "#BE185D", "Warm clothing", "Warm shawl for winter, travel, and household use."),
  makeSampleProduct("School Shoes", "Shoes and Slippers", "RSC-SHO-003", 1450, 1180, 35, 14, 18, 6, "pair", "#111827", "School pair", "Black school shoes for students and uniform shopping."),
  makeSampleProduct("Ladies Sandal", "Shoes and Slippers", "RSC-SHO-004", 980, 760, 26, 10, 16, 6, "pair", "#A21CAF", "Daily sandal", "Comfortable ladies sandal for market, travel, and daily use."),
] as const;

function PublicApp({ onOwnerAccessRequest }: { onOwnerAccessRequest: () => void }) {
  return (
    <>
      <PublicLayoutModern onOwnerAccessRequest={onOwnerAccessRequest}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/catalog" component={Catalog} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/track" component={TrackOrderPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/account" component={AccountPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/book" component={BookService} />
          <Route path="/product/:id" component={ProductDetail} />
          <Route component={NotFound} />
        </Switch>
      </PublicLayoutModern>
      <Toaster />
    </>
  );
}

function OwnerApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem("owner-token") || "");
  const [ownerEntryRequested, setOwnerEntryRequested] = useState(() => sessionStorage.getItem("owner-entry") === "true");
  const [tab, setTab] = useState("overview");
  const [login, setLogin] = useState({ identifier: "", password: "", otp: "" });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotForm, setForgotForm] = useState({ identifier: "", otp: "", newPassword: "", confirmPassword: "" });
  const [recoveryInfo, setRecoveryInfo] = useState<any>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [publicSettings, setPublicSettings] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" });
  const [paymentForm, setPaymentForm] = useState({ customerId: 0, amount: "", paymentMethod: "cash", referenceNote: "" });
  const [productForm, setProductForm] = useState({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "grocery", sortOrder: "1" });
  const [invoiceForm, setInvoiceForm] = useState({ customerId: 0, paymentMethod: "cash", amountPaid: "", note: "" });
  const [lines, setLines] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [settingsForm, setSettingsForm] = useState<any>({
    shopName: "",
    proprietorName: "",
    phone: "",
    email: "",
    address: "",
    bankName: "",
    bankBranch: "",
    accountName: "",
    accountNumber: "",
    whatsappPhone: "",
    whatsappApiKey: "",
    bankQrPath: "",
    esewaId: "",
    esewaQrPath: "",
    khaltiId: "",
    khaltiQrPath: "",
    rewardRate: 1,
    rewardUnitAmount: "100",
    invoiceFooter: "",
    aboutText: "",
    deliveryPolicy: "",
    termsConditions: "",
    shopPhotoPath: "",
    ownerPhotoPath: "",
    homeBannerPath: "",
    announcements: [],
    featuredMedia: [],
  });
const [settingsBusy, setSettingsBusy] = useState(false);
const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
const [passwordBusy, setPasswordBusy] = useState(false);
const [loginOtpInfo, setLoginOtpInfo] = useState<any>(null);
const [totpStep, setTotpStep] = useState(false);
const [ownerFeedback, setOwnerFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const { lang, toggleLanguage } = useLanguage();

  // Persist owner session through page refresh (sessionStorage clears on tab close)
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("owner-token", token);
    } else {
      sessionStorage.removeItem("owner-token");
      sessionStorage.removeItem("owner-entry");
    }
  }, [token]);

  useEffect(() => {
    if (ownerEntryRequested) {
      sessionStorage.setItem("owner-entry", "true");
    } else {
      sessionStorage.removeItem("owner-entry");
    }
  }, [ownerEntryRequested]);

  useEffect(() => {
    if (!token) return;

    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };

    const check = window.setInterval(() => {
      if (Date.now() - lastActivity > OWNER_SESSION_TIMEOUT_MS) {
        setToken("");
        setOwnerEntryRequested(false);
          setError(lang === "ne" ? "मालिक सेसन सुरक्षाका लागि बन्द भयो। फेरि लगइन गर्नुहोस्।" : "Owner session was locked for safety. Please log in again.");
      }
    }, 30000);

    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    window.addEventListener("touchstart", touch);

    return () => {
      window.clearInterval(check);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("touchstart", touch);
    };
  }, [token, lang]);

  const text = lang === "ne"
    ? {
        ownerWorkspace: "मालिक कार्यक्षेत्र",
        ownerLogin: "मालिक लगइन",
        openDashboard: "मालिक ड्यासबोर्ड खोल्नुहोस्",
        businessCockpit: "व्यवसाय ककपिट",
        createBill: "बिल बनाउनुहोस्",
        customerLedger: "ग्राहक हिसाब",
        productCosts: "उत्पादन लागत विवरण",
        addCustomer: "ग्राहक थप्नुहोस्",
        addProduct: "उत्पादन थप्नुहोस्",
        recordPayment: "पुरानो भुक्तानी राख्नुहोस्",
        print: "प्रिन्ट",
        logout: "लग आउट",
        customerPreview: "ग्राहक दृश्य",
        backToOwner: "मालिक लगइनमा फर्कनुहोस्",
        customerWelcome: "ग्राहक दृश्य",
        browseProducts: "उत्पादन र भुक्तानी विवरण हेर्नुहोस्",
        publicHero: "ग्राहकका लागि उत्पादन हेर्न, पसल विवरण बुझ्न र QR भुक्तानी विकल्प जाँच्न बनाइएको सार्वजनिक दृश्य।",
        simpleProductView: "ग्राहकले हेर्ने सरल उत्पादन दृश्य।",
        inStock: "मौज्दात",
        outOfStock: "स्टक छैन",
        per: "प्रति",
        overview: "अवलोकन",
        billing: "बिलिङ",
        customers: "ग्राहक",
        products: "उत्पादन",
        branding: "मिडिया र सूचना",
        ownerOnlyNote: "यो केवल मालिकका लागि निजी भाग हो। यहाँ स्टक, ग्राहक उधारो, बिलिङ र व्यवसाय रेकर्ड राखिन्छ।",
        ownerHero: "बिलिङ, स्टक, ग्राहक हिसाब, QR पछ्याइ र दैनिक व्यवसाय नियन्त्रणका लागि निजी ड्यासबोर्ड।",
        stockIntelligence: "स्टक जानकारी",
        stockIntelligenceDesc: "खरिद लागत, ढुवानी, अतिरिक्त खर्च, स्टक र नाफा एकै ठाउँमा।",
        ledgerBilling: "हिसाब बिलिङ",
        ledgerBillingDesc: "ग्राहकको पुरानो बाँकी, नयाँ खरिद, भुक्तानी र बाँकी एकै बिलमा।",
        customerRewards: "ग्राहक पुरस्कार",
        customerRewardsDesc: "ग्राहकले किनमेल गर्दा अंक जम्मा हुन्छ।",
        privateOwnerText: "यो निजी मालिक लगइन हो। अधिकृत व्यक्तिले मात्र प्रवेश गर्नुपर्छ।",
        usernameLabel: "यूजरनेम / फोन / इमेल",
        passwordLabel: "पासवर्ड",
        authCodeLabel: "मालिक OTP कोड",
        authCodePlaceholder: "पहिले OTP पठाउनुहोस्",
        recentInvoices: "हालका बिलहरू",
        recentInvoicesDesc: "पछिल्ला बिल र तिनको भुक्तानी अवस्था।",
        paid: "तिरेको",
        due: "बाँकी",
        currentSaleNote: "हालको किनमेल र पुरानो बाँकी एकै बिलमा।",
        totalPreview: "जम्मा",
        addLineItem: "उत्पादन थप्नुहोस्",
        amountReceivedNow: "अहिले लिएको रकम",
        billNote: "बिल टिप्पणी",
        saveBill: "बिल सुरक्षित गर्नुहोस्",
        invoicePreview: "बिल पूर्वावलोकन",
        previousDue: "पुरानो बाँकी",
        currentBill: "हालको बिल",
        paidNow: "अहिले तिरेको",
        remainingDue: "बाँकी रकम",
        payment: "भुक्तानी",
        rewardEarned: "अंक",
        lastInvoice: "पछिल्लो बिल",
        customerLedgerDesc: "ग्राहकको बाँकी, पुरस्कार र हालका हिसाब गतिविधि।",
        noPhoneSaved: "फोन छैन",
        noAddressSaved: "ठेगाना छैन",
        spent: "खर्च",
        amount: "रकम",
        note: "टिप्पणी",
        saveRepayment: "भुक्तानी सुरक्षित गर्नुहोस्",
        notes: "नोटहरू",
        createCustomerButton: "ग्राहक बनाउनुहोस्",
        productCostsDesc: "यो भागमा लागत, स्टक र बिक्री विवरण राखिन्छ।",
        saveProduct: "उत्पादन सुरक्षित गर्नुहोस्",
        updateProduct: "उत्पादन अपडेट गर्नुहोस्",
        edit: "सम्पादन",
        delete: "हटाउनुहोस्",
        mediaCenter: "मिडिया र सूचना",
        mediaCenterDesc: "पसल फोटो, QR फोटो, सूचना, सामाजिक लिंक र ग्राहकतर्फ देखिने मिडिया यहीँबाट राख्नुहोस्।",
        shopPhoto: "पसल फोटो",
        ownerPhoto: "मालिक फोटो",
        bannerPhoto: "ब्यानर फोटो",
        uploadImage: "तस्बिर अपलोड / खिच्नुहोस्",
        uploadVideo: "भिडियो अपलोड",
        pasteVideoUrl: "भिडियो लिंक",
        announcements: "सूचना",
        featuredMedia: "विशेष मिडिया",
        addAnnouncement: "सूचना थप्नुहोस्",
        addMedia: "मिडिया थप्नुहोस्",
        saveMediaSettings: "मिडिया सेटिङ सुरक्षित गर्नुहोस्",
        titleLabel: "शीर्षक",
        bodyLabel: "विवरण",
        statusLabel: "स्थिति",
        activeStatus: "सक्रिय",
        draftStatus: "मस्यौदा",
        occasionLabel: "अवसर / पर्व",
        imageLabel: "तस्बिर",
        videoLabel: "भिडियो",
        featuredLabel: "विशेष",
        noProductsYet: "अहिलेसम्म कुनै उत्पादन छैन।",
        totalProducts: "कुल उत्पादन",
        totalProductsDesc: "जम्मा राखिएका सबै उत्पादन",
        lowStock: "कम स्टक",
        lowStockDesc: "चाँडै सकिन लागेका वस्तु",
        inventoryCost: "स्टक लागत",
        inventoryCostDesc: "हाल स्टकमाथि लागेको कुल लागत",
        projectedSales: "अनुमानित बिक्री",
        projectedSalesDesc: "हालको स्टकबाट अनुमानित बिक्री",
        totalCustomers: "कुल ग्राहक",
        totalCustomersDesc: "जम्मा राखिएका ग्राहक संख्या",
        creditDue: "उधारो",
        creditDueDesc: "ग्राहकबाट आउन बाँकी रकम",
        rewardPoints: "पुरस्कार अंक",
        rewardPointsDesc: "ग्राहकमा रहेका जम्मा अंक",
        remove: "हटाउनुहोस्",
        left: "बाँकी",
        balanceShort: "ब्यालेन्स",
      }
    : {
        ownerWorkspace: "Owner workspace",
        ownerLogin: "Owner Login",
        openDashboard: "Open owner dashboard",
        businessCockpit: "Business cockpit",
        createBill: "Create bill",
        customerLedger: "Customer ledger",
        productCosts: "Owner-only product costs",
        addCustomer: "Add customer",
        addProduct: "Add product",
        recordPayment: "Record old payment",
        print: "Print",
        logout: "Log out",
        customerPreview: "Customer preview",
        backToOwner: "Back to owner login",
        customerWelcome: "Customer view",
        browseProducts: "Browse products and payment details",
        publicHero: "A customer-facing view for browsing products, seeing shop details, and checking available payment options.",
        simpleProductView: "A simple product view like customers would see.",
        inStock: "In Stock",
        outOfStock: "Out",
        per: "per",
        overview: "Overview",
        billing: "Billing",
        customers: "Customers",
        products: "Products",
        branding: "Media & updates",
        ownerOnlyNote: "Private Rajesh Shopping Center owner panel for stock cost, customer credit, billing, delivery tracking, and business records.",
        ownerHero: "Private dashboard for Rajesh Shopping Center owner operations, billing, credit control, QR payment follow-up, and profit visibility.",
        stockIntelligence: "Stock Intelligence",
        stockIntelligenceDesc: "Buying cost, transport, extra cost, stock, and profit across groceries, clothing, and hardware items.",
        ledgerBilling: "Ledger Billing",
        ledgerBillingDesc: "Previous due, current purchase, payment, and remaining balance in one bill for daily customers and credit customers.",
        customerRewards: "Customer Rewards",
        customerRewardsDesc: "Reward points grow automatically as customers buy from your shop.",
        privateOwnerText: "Private owner login for Rajesh Shopping Center. This area is only for Sandesh Kharal and authorized business use.",
        usernameLabel: "Username / phone / email",
        passwordLabel: "Password",
        authCodeLabel: "Owner OTP code",
        authCodePlaceholder: "Send OTP first",
        recentInvoices: "Recent invoices",
        recentInvoicesDesc: "Latest bills and their payment status.",
        paid: "Paid",
        due: "Due",
        currentSaleNote: "Current sale plus previous due in one printable invoice.",
        totalPreview: "Total",
        addLineItem: "Add product",
        amountReceivedNow: "Amount received now",
        billNote: "Bill note",
        saveBill: "Save bill",
        invoicePreview: "Invoice preview",
        previousDue: "Previous due",
        currentBill: "Current bill",
        paidNow: "Paid now",
        remainingDue: "Remaining due",
        payment: "Payment",
        rewardEarned: "Reward",
        lastInvoice: "Last invoice",
        customerLedgerDesc: "Customer balances, rewards, and recent ledger activity.",
        noPhoneSaved: "No phone saved",
        noAddressSaved: "No address saved",
        spent: "Spent",
        amount: "Amount",
        note: "Note",
        saveRepayment: "Save repayment",
        notes: "Notes",
        createCustomerButton: "Create customer",
        productCostsDesc: "This private section shows the true margin behind each item.",
        saveProduct: "Save product",
        updateProduct: "Update product",
        edit: "Edit",
        delete: "Delete",
        mediaCenter: "Media and announcements",
        mediaCenterDesc: "Manage shop photos, owner profile, app background, announcements, special occasions, featured images, and video content.",
        shopPhoto: "Shop photo",
        ownerPhoto: "Owner profile photo",
        bannerPhoto: "Background banner",
        uploadImage: "Upload image / use camera",
        uploadVideo: "Upload video",
        pasteVideoUrl: "Video URL",
        announcements: "Announcements",
        featuredMedia: "Featured media",
        addAnnouncement: "Add announcement",
        addMedia: "Add media",
        saveMediaSettings: "Save media settings",
        titleLabel: "Title",
        bodyLabel: "Description",
        statusLabel: "Status",
        activeStatus: "Active",
        draftStatus: "Draft",
        occasionLabel: "Occasion / type",
        imageLabel: "Image",
        videoLabel: "Video",
        featuredLabel: "Featured",
        noProductsYet: "No products added yet.",
        totalProducts: "Products",
        totalProductsDesc: "Visible stock records in the system",
        lowStock: "Low stock",
        lowStockDesc: "Items close to reorder level",
        inventoryCost: "Inventory cost",
        inventoryCostDesc: "Your true cost locked in stock",
        projectedSales: "Projected sales",
        projectedSalesDesc: "Sales value at current selling price",
        totalCustomers: "Customers",
        totalCustomersDesc: "Saved people with billing history",
        creditDue: "Credit due",
        creditDueDesc: "Total unpaid balance across customers",
        rewardPoints: "Reward points",
        rewardPointsDesc: "Active reward points issued",
        remove: "Remove",
        left: "left",
        balanceShort: "Bal",
      };

  const api = async <T,>(path: string, init?: RequestInit) => {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      throw new Error(
        lang === "ne"
        ? "सुरक्षा सेटिङ बचत गर्न API तयार छैन।"
          : "The app server is not running. Please start the local API again."
      );
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body as T;
  };

  const publicApi = async <T,>(path: string) => {
    const response = await fetch(`/api${path}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body as T;
  };

  const load = async () => {
    if (!token) return;
    const [summaryData, customersData, productsData, categoriesData, settingsData, ordersData, bookingsData] = await Promise.all([
      api<any>("/admin/dashboard-summary"),
      api<any[]>("/admin/customers"),
      api<any[]>("/admin/products"),
      api<any[]>("/admin/categories"),
      api<any>("/settings"),
      api<any[]>("/admin/orders"),
      api<any[]>("/admin/bookings"),
    ]);
    setSummary(summaryData);
    setCustomers(customersData);
    setProducts(productsData);
    setCategories(categoriesData);
    setOrders(ordersData);
    setBookings(bookingsData);
    setSettings(settingsData);
    setSettingsForm({
      shopName: settingsData?.shopName ?? "",
      proprietorName: settingsData?.proprietorName ?? "",
      phone: settingsData?.phone ?? "",
      email: settingsData?.email ?? "",
      address: settingsData?.address ?? "",
      bankName: settingsData?.bankName ?? "",
      bankBranch: settingsData?.bankBranch ?? "",
      accountName: settingsData?.accountName ?? "",
      accountNumber: settingsData?.accountNumber ?? "",
      whatsappPhone: settingsData?.whatsappPhone ?? "",
      whatsappApiKey: settingsData?.whatsappApiKey ?? "",
      bankQrPath: settingsData?.bankQrPath ?? "",
      esewaId: settingsData?.esewaId ?? "",
      esewaQrPath: settingsData?.esewaQrPath ?? "",
      khaltiId: settingsData?.khaltiId ?? "",
      khaltiQrPath: settingsData?.khaltiQrPath ?? "",
      rewardRate: settingsData?.rewardRate ?? 1,
      rewardUnitAmount: String(settingsData?.rewardUnitAmount ?? "100"),
      invoiceFooter: settingsData?.invoiceFooter ?? "",
      aboutText: settingsData?.aboutText ?? "",
      deliveryPolicy: settingsData?.deliveryPolicy ?? "",
      termsConditions: settingsData?.termsConditions ?? "",
      shopPhotoPath: settingsData?.shopPhotoPath ?? "",
      ownerPhotoPath: settingsData?.ownerPhotoPath ?? "",
      homeBannerPath: settingsData?.homeBannerPath ?? "",
      announcements: Array.isArray(settingsData?.announcements) ? settingsData.announcements : [],
      featuredMedia: Array.isArray(settingsData?.featuredMedia) ? settingsData.featuredMedia : [],
    });
    setProductForm((current: any) => ({
      ...current,
      categoryId: current.categoryId && current.categoryId !== "1"
        ? current.categoryId
        : String(categoriesData[0]?.id ?? 1),
    }));
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(() => {
    publicApi<any>("/settings")
      .then((settingsData) => {
        setPublicSettings(settingsData);
      })
      .catch(() => {});
  }, []);

  const currentCustomer = customers.find((item) => item.id === invoiceForm.customerId) || null;
  const preview = useMemo(() => {
    const items = lines.map((line) => {
      const product = products.find((entry) => entry.id === line.productId);
      return product ? { ...line, name: product.name, unit: product.unit, price: num(product.price), total: num(product.price) * line.quantity } : null;
    }).filter(Boolean) as Array<{ productId: number; quantity: number; name: string; unit: string; price: number; total: number }>;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const previousDue = num(currentCustomer?.creditBalance);
    const total = subtotal + previousDue;
    const amountPaid = invoiceForm.amountPaid === "" ? (invoiceForm.paymentMethod === "credit" ? 0 : total) : num(invoiceForm.amountPaid);
    const due = Math.max(total - amountPaid, 0);
    const rewardRate = Number(settings?.rewardRate ?? 1);
    const rewardUnitAmount = Number(settings?.rewardUnitAmount ?? 100);
    const rewardPoints = rewardUnitAmount > 0 ? Math.floor(subtotal / rewardUnitAmount) * rewardRate : 0;
    return { items, subtotal, previousDue, total, amountPaid, due, rewardPoints };
  }, [currentCustomer, invoiceForm.amountPaid, invoiceForm.paymentMethod, lines, products, settings]);

  const paymentMethodLabel = useMemo(() => {
    const labels = lang === "ne"
      ? {
      cash: "नगद",
      credit: "उधारो",
          esewa: "eSewa",
          khalti: "Khalti",
      bank: "बैंक QR",
        }
      : {
          cash: "Cash",
          credit: "Credit",
          esewa: "eSewa",
          khalti: "Khalti",
          bank: "Bank QR",
        };
    return labels[invoiceForm.paymentMethod as keyof typeof labels] ?? invoiceForm.paymentMethod;
  }, [invoiceForm.paymentMethod, lang]);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const handleSettingsMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "shopPhotoPath" | "ownerPhotoPath" | "homeBannerPath",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSettingsForm((current: any) => ({ ...current, [field]: dataUrl }));
    event.target.value = "";
  };

  const handleAnnouncementImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSettingsForm((current: any) => ({
      ...current,
      announcements: current.announcements.map((item: any, itemIndex: number) =>
        itemIndex === index ? { ...item, imageUrl: dataUrl } : item,
      ),
    }));
    event.target.value = "";
  };

  const handleFeaturedMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSettingsForm((current: any) => ({
      ...current,
      featuredMedia: current.featuredMedia.map((item: any, itemIndex: number) =>
        itemIndex === index
          ? { ...item, url: dataUrl, mediaType: file.type.startsWith("video/") ? "video" : "image" }
          : item,
      ),
    }));
    event.target.value = "";
  };

  const showOwnerFeedback = (type: "success" | "error", message: string) => {
    setOwnerFeedback({ type, message });
    window.setTimeout(() => {
      setOwnerFeedback((current) => (current?.message === message ? null : current));
    }, 3500);
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const body: Record<string, string> = {
        identifier: login.identifier.trim(),
        password: login.password,
      };
      // If we're already in the TOTP step, include the authenticator code
      if (totpStep && login.otp.trim()) {
        body.totp = login.otp.trim().replace(/\s/g, "");
      }
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (result as any)?.error ||
          (result as any)?.message ||
      (lang === "ne" ? "लगइन सफल भएन।" : "Login failed."),
        );
      }
      // Server says TOTP is required — show the authenticator step
      if ((result as any)?.requiresTotp) {
        setTotpStep(true);
        setLogin((current) => ({ ...current, otp: "" }));
        return;
      }
      setToken(result.token);
      setTotpStep(false);
      setForgotMode(false);
      setRecoveryInfo(null);
      setLoginOtpInfo(null);
      setLogin((current) => ({ ...current, password: "", otp: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const requestLoginOtp = async () => {
    if (!login.identifier.trim() || !login.password) {
      setError(lang === "ne" ? "पहिले प्रयोगकर्ता नाम र पासवर्ड राख्नुहोस्।" : "Enter username and password first.");
      return;
    }
    setError("");
    try {
      const response = await fetch("/api/admin/login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: login.identifier.trim(), password: login.password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (result as any)?.error ||
          (result as any)?.message ||
      (lang === "ne" ? "लगइन कोड पठाउन सकिएन।" : "Failed to send login code."),
        );
      }
      setLoginOtpInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send login OTP");
    }
  };

  const requestPasswordReset = async () => {
    if (!forgotForm.identifier.trim()) {
      setError(lang === "ne" ? "पहिले अनुमति भएको मालिक प्रयोगकर्ता नाम राख्नुहोस्।" : "Enter an allowed owner username first.");
      return;
    }
    setResetBusy(true);
    setError("");
    try {
      const result = await api<any>("/admin/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: forgotForm.identifier.trim() }),
      });
      setRecoveryInfo(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed");
    } finally {
      setResetBusy(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forgotForm.identifier.trim() || !forgotForm.otp.trim() || !forgotForm.newPassword) {
      setError(lang === "ne" ? "प्रयोगकर्ता नाम, रिसेट कोड र नयाँ पासवर्ड चाहिन्छ।" : "Identifier, reset code, and new password are required.");
      return;
    }
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setError(lang === "ne" ? "नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।" : "New password and confirm password do not match.");
      return;
    }
    setResetBusy(true);
    setError("");
    try {
      const result = await api<any>("/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({
          identifier: forgotForm.identifier.trim(),
          otp: forgotForm.otp.trim(),
          newPassword: forgotForm.newPassword,
        }),
      });
      setRecoveryInfo(result);
      setForgotMode(false);
      setLogin((current) => ({ ...current, identifier: forgotForm.identifier.trim(), password: "", otp: "" }));
      setForgotForm((current) => ({ ...current, otp: "", newPassword: "", confirmPassword: "" }));
      setError(lang === "ne" ? "पासवर्ड परिवर्तन भयो। अब नयाँ पासवर्डले लगइन गर्नुहोस्।" : "Password reset completed. Log in with the new password now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setResetBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      showOwnerFeedback("error", lang === "ne" ? "पुरानो र नयाँ पासवर्ड दुवै चाहिन्छ।" : "Both current and new passwords are required.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showOwnerFeedback("error", lang === "ne" ? "नयाँ पासवर्ड कम्तीमा ६ अक्षर हुनुपर्छ।" : "New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showOwnerFeedback("error", lang === "ne" ? "नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।" : "New password and confirm password do not match.");
      return;
    }
    setPasswordBusy(true);
    setOwnerFeedback(null);
    try {
      await api("/admin/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showOwnerFeedback("success", lang === "ne" ? "पासवर्ड परिवर्तन भयो।" : "Password changed.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPasswordBusy(false);
    }
  };


  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setOwnerFeedback(null);
    try {
      if (editingCustomerId) {
        await api(`/admin/customers/${editingCustomerId}`, { method: "PUT", body: JSON.stringify(customerForm) });
      } else {
        await api("/admin/customers", { method: "POST", body: JSON.stringify(customerForm) });
      }
      setEditingCustomerId(null);
      setCustomerForm({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" });
      await load();
      showOwnerFeedback("success", lang === "ne" ? "ग्राहक सुरक्षित भयो।" : "Customer saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "ग्राहक बचत गर्न सकिएन।" : "Could not save the customer."));
    }
  };
  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setOwnerFeedback(null);
    if (!paymentForm.customerId) {
      showOwnerFeedback("error", lang === "ne" ? "पहिले ग्राहक छनोट गर्नुहोस्।" : "Select a customer first.");
      return;
    }
    try {
      await api("/admin/payments", { method: "POST", body: JSON.stringify({ ...paymentForm, amount: num(paymentForm.amount) }) });
      setPaymentForm({ customerId: 0, amount: "", paymentMethod: "cash", referenceNote: "" });
      await load();
      showOwnerFeedback("success", lang === "ne" ? "भुक्तानी सुरक्षित भयो।" : "Payment saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "भुक्तानी राख्न सकिएन।" : "Could not record the payment."));
    }
  };
  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setOwnerFeedback(null);
    const payload = {
      ...productForm,
      categoryId: Number(productForm.categoryId),
      price: num(productForm.price),
      buyingPrice: num(productForm.buyingPrice),
      transportationCost: num(productForm.transportationCost),
      extraCost: num(productForm.extraCost),
      stockQuantity: Number(productForm.stockQuantity || 0),
      reorderLevel: Number(productForm.reorderLevel || 0),
      inStock: Number(productForm.stockQuantity || 0) > 0,
      featured: Boolean((productForm as any).featured),
      imageUrl: (productForm as any).imageUrl || null,
    };
    try {
      if (editingProductId) {
        await api(`/admin/products/${editingProductId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/admin/products", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditingProductId(null);
      setProductForm({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: String(categories[0]?.id ?? 1), imageUrl: "", featured: false } as any);
      await load();
      showOwnerFeedback("success", lang === "ne" ? "सामान सुरक्षित भयो।" : "Product saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "सामान बचत गर्न सकिएन।" : "Could not save the product."));
    }
  };
  const createCategory = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setOwnerFeedback(null);
    const payload = {
      ...categoryForm,
      sortOrder: Number(categoryForm.sortOrder || 0),
    };
    try {
      if (editingCategoryId) {
        await api(`/admin/categories/${editingCategoryId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/admin/categories", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditingCategoryId(null);
      setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 1) });
      await load();
      showOwnerFeedback("success", lang === "ne" ? "वर्ग सुरक्षित भयो।" : "Category saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "वर्ग बचत गर्न सकिएन।" : "Could not save the category."));
    }
  };
  const createInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setOwnerFeedback(null);
    if (!invoiceForm.customerId) {
      showOwnerFeedback("error", lang === "ne" ? "पहिले ग्राहक खोजेर छनोट गर्नुहोस्।" : "Search and select a customer first.");
      return;
    }
    if (lines.length === 0) {
      showOwnerFeedback("error", lang === "ne" ? "पहिले सामान खोजेर थप्नुहोस्।" : "Search and add at least one product first.");
      return;
    }
    try {
      const result = await api<any>("/admin/invoices", { method: "POST", body: JSON.stringify({ customerId: invoiceForm.customerId, paymentMethod: invoiceForm.paymentMethod, amountPaid: preview.amountPaid, note: invoiceForm.note, items: lines }) });
      setLastInvoice(result);
      setInvoiceForm({ customerId: 0, amountPaid: "", note: "", paymentMethod: "cash" });
      setLines([]);
      await load();
      showOwnerFeedback("success", lang === "ne" ? "बिक्री सुरक्षित भयो।" : "Sale saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "बिक्री बचत गर्न सकिएन।" : "Could not save the invoice."));
    }
  };

  const startEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name ?? "",
      sku: product.sku ?? "",
      description: product.description ?? "",
      price: String(num(product.price)),
      buyingPrice: String(num(product.buyingPrice)),
      transportationCost: String(num(product.transportationCost)),
      extraCost: String(num(product.extraCost)),
      stockQuantity: String(product.stockQuantity ?? 0),
      reorderLevel: String(product.reorderLevel ?? 0),
      unit: product.unit ?? "piece",
      categoryId: String(product.categoryId ?? 1),
      imageUrl: product.imageUrl ?? "",
      featured: Boolean(product.featured),
      inStock: Boolean(product.inStock),
    } as any);
    setTab("products");
  };

  const startEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name ?? "",
      description: category.description ?? "",
      icon: category.icon ?? "grocery",
      sortOrder: String(category.sortOrder ?? 0),
    });
    setTab("products");
  };

  const deleteProduct = async (productId: number) => {
    setOwnerFeedback(null);
    try {
      await api(`/admin/products/${productId}`, { method: "DELETE" });
      if (editingProductId === productId) {
        setEditingProductId(null);
        setProductForm({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: String(categories[0]?.id ?? 1), imageUrl: "", featured: false } as any);
      }
      await load();
      showOwnerFeedback("success", lang === "ne" ? "सामान हटाइयो।" : "Product removed.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "सामान हटाउन सकिएन।" : "Could not delete the product."));
    }
  };

  const deleteCategory = async (categoryId: number) => {
    setOwnerFeedback(null);
    try {
      await api(`/admin/categories/${categoryId}`, { method: "DELETE" });
      if (editingCategoryId === categoryId) {
        setEditingCategoryId(null);
        setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 1) });
      }
      await load();
      showOwnerFeedback("success", lang === "ne" ? "वर्ग हटाइयो।" : "Category removed.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "वर्ग हटाउन सकिएन।" : "Could not delete the category."));
    }
  };

  const startEditCustomer = (customer: any) => {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      customerCode: customer.customerCode ?? "",
      photoPath: customer.photoPath ?? "",
    });
    setTab("customers");
  };

  const deleteCustomer = async (customerId: number) => {
    setOwnerFeedback(null);
    try {
      await api(`/admin/customers/${customerId}`, { method: "DELETE" });
      if (editingCustomerId === customerId) {
        setEditingCustomerId(null);
        setCustomerForm({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" });
      }
      await load();
      showOwnerFeedback("success", lang === "ne" ? "ग्राहक हटाइयो।" : "Customer removed.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "ग्राहक हटाउन सकिएन।" : "Could not delete the customer."));
    }
  };

  const updateOrderStatus = async (orderId: number, status: string, paymentStatus?: string) => {
    await api(`/admin/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...(paymentStatus ? { paymentStatus } : {}) }),
    });
    await load();
  };

  const confirmOrderPayment = async (orderId: number, action: "confirmed" | "credit", paymentMethod: string) => {
    await api(`/admin/orders/${orderId}/settle`, {
      method: "POST",
      body: JSON.stringify({ action, paymentMethod }),
    });
    await load();
  };

  const updateBookingStatus = async (bookingId: number, status: string, payment?: { chargedAmount: number; amountPaid: number; paymentMethod: string }) => {
    await api(`/admin/bookings/${bookingId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...payment }),
    });
    await load();
  };

  const saveMediaSettings = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSettingsBusy(true);
    setOwnerFeedback(null);
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          shopName: settingsForm.shopName || null,
          proprietorName: settingsForm.proprietorName || null,
          phone: settingsForm.phone || null,
          email: settingsForm.email || null,
          address: settingsForm.address || null,
          bankName: settingsForm.bankName || null,
          bankBranch: settingsForm.bankBranch || null,
          accountName: settingsForm.accountName || null,
          accountNumber: settingsForm.accountNumber || null,
          whatsappPhone: settingsForm.whatsappPhone || null,
          whatsappApiKey: settingsForm.whatsappApiKey || null,
          bankQrPath: settingsForm.bankQrPath || null,
          esewaId: settingsForm.esewaId || null,
          esewaQrPath: settingsForm.esewaQrPath || null,
          khaltiId: settingsForm.khaltiId || null,
          khaltiQrPath: settingsForm.khaltiQrPath || null,
          rewardRate: Number(settingsForm.rewardRate || 1),
          rewardUnitAmount: String(settingsForm.rewardUnitAmount || "100"),
          invoiceFooter: settingsForm.invoiceFooter || null,
          aboutText: settingsForm.aboutText || null,
          deliveryPolicy: settingsForm.deliveryPolicy || null,
          termsConditions: settingsForm.termsConditions || null,
          shopPhotoPath: settingsForm.shopPhotoPath || null,
          ownerPhotoPath: settingsForm.ownerPhotoPath || null,
          homeBannerPath: settingsForm.homeBannerPath || null,
          announcements: settingsForm.announcements || [],
          featuredMedia: settingsForm.featuredMedia || [],
        }),
      });
      await load();
      const latest = await publicApi<any>("/settings");
      setPublicSettings(latest);
      showOwnerFeedback("success", lang === "ne" ? "मिडिया र सूचना सुरक्षित भयो।" : "Media settings saved.");
    } catch (err) {
      showOwnerFeedback("error", err instanceof Error ? err.message : (lang === "ne" ? "सेटिङ बचत गर्न सकिएन।" : "Could not save media settings."));
    } finally {
      setSettingsBusy(false);
    }
  };

  const shopInfo = settings || publicSettings || {};
  const shopName = lang === "ne"
    ? String(shopInfo?.shopName ?? "राजेश सिपिङ् सेन्टर")
    : "Rajesh Shopping Center";
  const shopAddress = String(shopInfo?.address ?? "Musikot-5, Anpchaur, Gulmi, Nepal");
  const shopPhone = String(shopInfo?.phone ?? "+977-XXXXXXXXXX");
  const shopEmail = String(shopInfo?.email ?? "rajeshshoppingcenter@gmail.com");
  if (!token && !ownerEntryRequested) {
    return <PublicApp onOwnerAccessRequest={() => { setError(""); setOwnerEntryRequested(true); }} />;
  }

  if (!token) {
    return (
        <OwnerLoginModern
          shopName={shopName}
          text={text}
          lang={lang}
          login={login}
          setLogin={setLogin}
          submitLogin={submitLogin}
          requestLoginOtp={requestLoginOtp}
          forgotMode={forgotMode}
          setForgotMode={(v: boolean) => { setForgotMode(v); if (v) setTotpStep(false); }}
          forgotForm={forgotForm}
          setForgotForm={setForgotForm}
          requestPasswordReset={requestPasswordReset}
          resetPassword={resetPassword}
          resetBusy={resetBusy}
          recoveryInfo={recoveryInfo}
          toggleLanguage={toggleLanguage}
          setOwnerEntryRequested={(v: boolean) => { setOwnerEntryRequested(v); if (!v) setTotpStep(false); }}
          setError={setError}
          loginOtpInfo={loginOtpInfo}
          totpStep={totpStep}
          setTotpStep={setTotpStep}
          error={error}
        />
    );
  }

  return (
    <OwnerWorkspaceModern
      tab={tab}
      setTab={setTab}
      text={text}
      lang={lang}
      toggleLanguage={toggleLanguage}
      shopName={shopName}
      shopAddress={shopAddress}
      shopPhone={shopPhone}
      settings={settings}
      summary={summary}
      orders={orders}
      bookings={bookings}
      customers={customers}
      products={products}
      preview={preview}
      invoiceForm={invoiceForm}
      setInvoiceForm={setInvoiceForm}
      lines={lines}
      setLines={setLines}
      createInvoice={createInvoice}
      lastInvoice={lastInvoice}
      paymentMethodLabel={paymentMethodLabel}
      paymentForm={paymentForm}
      setPaymentForm={setPaymentForm}
      recordPayment={recordPayment}
      customerForm={customerForm}
      setCustomerForm={setCustomerForm}
      createCustomer={createCustomer}
      editingCustomerId={editingCustomerId}
      setEditingCustomerId={setEditingCustomerId}
      deleteCustomer={deleteCustomer}
      startEditCustomer={startEditCustomer}
      productForm={productForm}
      setProductForm={setProductForm}
      createProduct={createProduct}
      editingProductId={editingProductId}
      setEditingProductId={setEditingProductId}
      startEditProduct={startEditProduct}
      deleteProduct={deleteProduct}
      settingsForm={settingsForm}
      setSettingsForm={setSettingsForm}
      saveMediaSettings={saveMediaSettings}
      settingsBusy={settingsBusy}
      passwordForm={passwordForm}
      setPasswordForm={setPasswordForm}
      passwordBusy={passwordBusy}
      changePassword={changePassword}
      readFileAsDataUrl={readFileAsDataUrl}
      handleSettingsMediaUpload={handleSettingsMediaUpload}
      setToken={setToken}
      setOwnerEntryRequested={setOwnerEntryRequested}
      updateOrderStatus={updateOrderStatus}
      confirmOrderPayment={confirmOrderPayment}
      updateBookingStatus={updateBookingStatus}
      externalFeedback={ownerFeedback}
      api={api}
      reloadOwnerData={load}
    />
  );

}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <OwnerApp />
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}













