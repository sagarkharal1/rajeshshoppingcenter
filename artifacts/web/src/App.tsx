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
          <Route path="/track-order" component={TrackOrderPage} />
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
  const [token, setToken] = useState("");
  const [ownerEntryRequested, setOwnerEntryRequested] = useState(false);
  const [tab, setTab] = useState("overview");
  const [login, setLogin] = useState({ identifier: "owner", password: "admin123", otp: "" });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotForm, setForgotForm] = useState({ identifier: "owner", otp: "", newPassword: "", confirmPassword: "" });
  const [recoveryInfo, setRecoveryInfo] = useState<any>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
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
  const [seedingProducts, setSeedingProducts] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [loginOtpInfo, setLoginOtpInfo] = useState<any>(null);
  const { lang, toggleLanguage } = useLanguage();

  useEffect(() => {
    localStorage.removeItem("biz-owner-token");
  }, []);

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
        setError(lang === "ne" ? "सुरक्षाका लागि मालिक सेसन स्वतः बन्द गरियो। फेरि लगइन गर्नुहोस्।" : "Owner session was locked for safety. Please log in again.");
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
        openDashboard: "ड्यासबोर्ड खोल्नुहोस्",
        businessCockpit: "व्यवसाय नियन्त्रण",
        createBill: "बिल बनाउनुहोस्",
        customerLedger: "ग्राहक लेजर",
        productCosts: "मालिकका लागि लागत विवरण",
        addCustomer: "ग्राहक थप्नुहोस्",
        addProduct: "उत्पादन थप्नुहोस्",
        recordPayment: "पुरानो भुक्तानी राख्नुहोस्",
        print: "प्रिन्ट",
        logout: "लगआउट",
        customerPreview: "ग्राहक दृश्य",
        backToOwner: "मालिक लगइनमा फर्कनुहोस्",
        customerWelcome: "ग्राहक दृश्य",
        browseProducts: "उत्पादन र भुक्तानी विवरण",
        publicHero: "ग्राहकले हेर्ने सार्वजनिक दृश्य जहाँ उत्पादन, पसल विवरण र QR भुक्तानी जानकारी देखिन्छ।",
        simpleProductView: "ग्राहकले देख्ने साधारण उत्पादन सूची",
        inStock: "स्टकमा",
        outOfStock: "स्टक छैन",
        per: "प्रति",
        overview: "सारांश",
        billing: "बिलिङ",
        customers: "ग्राहक",
        products: "उत्पादन",
        branding: "मिडिया र सूचना",
        ownerOnlyNote: "यो भाग मालिकका लागि मात्र हो। यहाँ लागत, नाफा, ग्राहक उधारो र रिवार्ड विवरण देखिन्छ।",
        ownerHero: "स्टक, बिलिङ, उधारो हिसाब, QR भुक्तानी र नाफा विवरणका लागि निजी मालिक ड्यासबोर्ड।",
        stockIntelligence: "स्टक जानकारी",
        stockIntelligenceDesc: "किन्ने मूल्य, ढुवानी, अतिरिक्त खर्च, स्टक र नाफा।",
        ledgerBilling: "लेजर बिलिङ",
        ledgerBillingDesc: "पुरानो बाँकी, नयाँ खरिद, भुक्तानी र बाँकी रकम एउटै बिलमा।",
        customerRewards: "ग्राहक रिवार्ड",
        customerRewardsDesc: "खरिदसँगै रिवार्ड अंक बढ्छ।",
        privateOwnerText: "यो निजी मालिक पक्ष हो। यहाँको लागत, नाफा र ग्राहक उधारो विवरण ग्राहकले देख्दैनन्।",
        usernameLabel: "युजरनेम / फोन / इमेल",
        passwordLabel: "पासवर्ड",
        authCodeLabel: "मालिक OTP कोड",
        authCodePlaceholder: "पहिले OTP पठाउनुहोस्",
        recentInvoices: "हालका बिलहरू",
        recentInvoicesDesc: "हालै बनेका बिल र तिनको भुक्तानी अवस्था।",
        paid: "भुक्तानी",
        due: "बाँकी",
        currentSaleNote: "पुरानो बाकी र नयाँ खरिद एउटै बिलमा।",
        totalPreview: "जम्मा",
        addLineItem: "उत्पादन थप्नुहोस्",
        amountReceivedNow: "अहिले लिएको रकम",
        billNote: "बिल नोट",
        saveBill: "बिल सेभ गर्नुहोस्",
        invoicePreview: "बिल पूर्वावलोकन",
        previousDue: "पुरानो बाकी",
        currentBill: "हालको बिल",
        paidNow: "अहिले भुक्तानी",
        remainingDue: "बाँकी रकम",
        payment: "भुक्तानी",
        rewardEarned: "रिवार्ड",
        lastInvoice: "अन्तिम बिल",
        customerLedgerDesc: "ग्राहकको बाँकी, रिवार्ड र हालका हिसाब चलनहरू।",
        noPhoneSaved: "फोन छैन",
        noAddressSaved: "ठेगाना छैन",
        spent: "जम्मा खरिद",
        amount: "रकम",
        note: "नोट",
        saveRepayment: "भुक्तानी सेभ गर्नुहोस्",
        notes: "नोटहरू",
        createCustomerButton: "ग्राहक सिर्जना गर्नुहोस्",
        productCostsDesc: "यो निजी भागले प्रत्येक वस्तुको वास्तविक नाफा देखाउँछ।",
        saveProduct: "उत्पादन सेभ गर्नुहोस्",
        updateProduct: "उत्पादन अपडेट गर्नुहोस्",
        sampleProducts: "नमुना उत्पादन हाल्नुहोस्",
        edit: "सम्पादन",
        delete: "हटाउनुहोस्",
        mediaCenter: "मिडिया र सूचना",
        mediaCenterDesc: "पसलका फोटो, प्रोफाइल फोटो, ब्याकग्राउन्ड, सूचना, विशेष अवसर र भिडियो सामग्री मिलाउनुहोस्।",
        shopPhoto: "पसल फोटो",
        ownerPhoto: "प्रोफाइल फोटो",
        bannerPhoto: "ब्याकग्राउन्ड फोटो",
        uploadImage: "तस्बिर अपलोड / क्यामेरा",
        uploadVideo: "भिडियो अपलोड",
        pasteVideoUrl: "भिडियो लिंक",
        announcements: "सूचना र खबर",
        featuredMedia: "विशेष मिडिया",
        addAnnouncement: "सूचना थप्नुहोस्",
        addMedia: "मिडिया थप्नुहोस्",
        saveMediaSettings: "मिडिया विवरण सेभ गर्नुहोस्",
        titleLabel: "शीर्षक",
        bodyLabel: "विवरण",
        statusLabel: "स्थिति",
        activeStatus: "सक्रिय",
        draftStatus: "ड्राफ्ट",
        occasionLabel: "अवसर / प्रकार",
        imageLabel: "तस्बिर",
        videoLabel: "भिडियो",
        featuredLabel: "विशेष",
        noProductsYet: "अहिलेसम्म उत्पादन थपिएको छैन।",
        totalProducts: "उत्पादन",
        totalProductsDesc: "सिस्टममा रहेका स्टक रेकर्ड",
        lowStock: "कम स्टक",
        lowStockDesc: "रिअर्डर नजिकका वस्तु",
        inventoryCost: "स्टक लागत",
        inventoryCostDesc: "स्टकमा अड्किएको वास्तविक लागत",
        projectedSales: "प्रक्षेपित बिक्री",
        projectedSalesDesc: "हालको बिक्री मूल्यमा अनुमान",
        totalCustomers: "ग्राहक",
        totalCustomersDesc: "सेभ भएका ग्राहक",
        creditDue: "उधारो",
        creditDueDesc: "सबै ग्राहकको बाकी रकम",
        rewardPoints: "रिवार्ड अंक",
        rewardPointsDesc: "जारी भएको कुल अंक",
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
        sampleProducts: "Load sample products",
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
          ? "सर्भर चलिरहेको छैन। कृपया स्थानीय API फेरि सुरु गर्नुहोस्।"
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
    const [summaryData, customersData, productsData, categoriesData, settingsData, ordersData] = await Promise.all([
      api<any>("/admin/dashboard-summary"),
      api<any[]>("/admin/customers"),
      api<any[]>("/admin/products"),
      api<any[]>("/admin/categories"),
      api<any>("/settings"),
      api<any[]>("/admin/orders"),
    ]);
    setSummary(summaryData);
    setCustomers(customersData);
    setProducts(productsData);
    setCategories(categoriesData);
    setOrders(ordersData);
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
    setPaymentForm((current) => ({ ...current, customerId: current.customerId || customersData[0]?.id || 0 }));
    setInvoiceForm((current) => ({ ...current, customerId: current.customerId || customersData[0]?.id || 0 }));
    setLines((current) => (current.length ? current : productsData[0] ? [{ productId: productsData[0].id, quantity: 1 }] : []));
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

  const currentCustomer = customers.find((item) => item.id === invoiceForm.customerId) || customers[0];
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

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ token: string }>("/admin/login", { method: "POST", body: JSON.stringify(login) });
      setToken(result.token);
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
      setError(lang === "ne" ? "पहिले युजरनेम र पासवर्ड लेख्नुहोस्।" : "Enter username and password first.");
      return;
    }
    setError("");
    try {
      const result = await api<any>("/admin/login/request-otp", {
        method: "POST",
        body: JSON.stringify({ identifier: login.identifier.trim(), password: login.password }),
      });
      setLoginOtpInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send login OTP");
    }
  };

  const requestPasswordReset = async () => {
    if (!forgotForm.identifier.trim()) {
      setError(lang === "ne" ? "पहिले अनुमति दिइएको युजरनेम राख्नुहोस्।" : "Enter an allowed owner username first.");
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
      setError(lang === "ne" ? "युजरनेम, रिसेट कोड र नयाँ पासवर्ड चाहिन्छ।" : "Identifier, reset code, and new password are required.");
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
      setError(lang === "ne" ? "पासवर्ड रिसेट भयो। अब नयाँ पासवर्डले लगइन गर्नुहोस्।" : "Password reset completed. Log in with the new password now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setResetBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError(lang === "ne" ? "हालको र नयाँ पासवर्ड दुबै चाहिन्छ।" : "Both current and new passwords are required.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError(lang === "ne" ? "नयाँ पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्छ।" : "New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(lang === "ne" ? "नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।" : "New password and confirm password do not match.");
      return;
    }
    setPasswordBusy(true);
    setError("");
    try {
      await api("/admin/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setError(lang === "ne" ? "पासवर्ड सफलतापूर्वक परिवर्तन भयो।" : "Password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPasswordBusy(false);
    }
  };


  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingCustomerId) {
      await api(`/admin/customers/${editingCustomerId}`, { method: "PUT", body: JSON.stringify(customerForm) });
    } else {
      await api("/admin/customers", { method: "POST", body: JSON.stringify(customerForm) });
    }
    setEditingCustomerId(null);
    setCustomerForm({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" });
    await load();
  };
  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    await api("/admin/payments", { method: "POST", body: JSON.stringify({ ...paymentForm, amount: num(paymentForm.amount) }) });
    setPaymentForm((current) => ({ ...current, amount: "", referenceNote: "" }));
    await load();
  };
  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
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
    if (editingProductId) {
      await api(`/admin/products/${editingProductId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/admin/products", { method: "POST", body: JSON.stringify(payload) });
    }
    setEditingProductId(null);
    setProductForm({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: String(categories[0]?.id ?? 1), imageUrl: "", featured: false } as any);
    await load();
  };
  const createCategory = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const payload = {
      ...categoryForm,
      sortOrder: Number(categoryForm.sortOrder || 0),
    };
    if (editingCategoryId) {
      await api(`/admin/categories/${editingCategoryId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/admin/categories", { method: "POST", body: JSON.stringify(payload) });
    }
    setEditingCategoryId(null);
    setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 1) });
    await load();
  };
  const createInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await api<any>("/admin/invoices", { method: "POST", body: JSON.stringify({ customerId: invoiceForm.customerId, paymentMethod: invoiceForm.paymentMethod, amountPaid: preview.amountPaid, note: invoiceForm.note, items: lines }) });
    setLastInvoice(result);
    setInvoiceForm((current) => ({ ...current, amountPaid: "", note: "", paymentMethod: "cash" }));
    setLines(products[0] ? [{ productId: products[0].id, quantity: 1 }] : []);
    await load();
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
    await api(`/admin/products/${productId}`, { method: "DELETE" });
    if (editingProductId === productId) {
      setEditingProductId(null);
      setProductForm({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: String(categories[0]?.id ?? 1), imageUrl: "", featured: false } as any);
    }
    await load();
  };

  const deleteCategory = async (categoryId: number) => {
    await api(`/admin/categories/${categoryId}`, { method: "DELETE" });
    if (editingCategoryId === categoryId) {
      setEditingCategoryId(null);
      setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 1) });
    }
    await load();
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
    await api(`/admin/customers/${customerId}`, { method: "DELETE" });
    if (editingCustomerId === customerId) {
      setEditingCustomerId(null);
      setCustomerForm({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" });
    }
    await load();
  };

  const updateOrderStatus = async (orderId: number, status: string, paymentStatus?: string) => {
    await api(`/admin/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...(paymentStatus ? { paymentStatus } : {}) }),
    });
    await load();
  };

  const seedSampleProducts = async () => {
    setSeedingProducts(true);
    try {
      const existingCategories = await api<any[]>("/admin/categories");
      const categoryMap = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category.id]));

      for (const category of shopCategories) {
        if (!categoryMap.has(category.name.toLowerCase())) {
          const created = await api<any>("/admin/categories", { method: "POST", body: JSON.stringify(category) });
          categoryMap.set(category.name.toLowerCase(), created.id);
        }
      }

      const existingProducts = await api<any[]>("/admin/products");
      const existingSkus = new Set(existingProducts.map((product) => String(product.sku || "")));

      for (const product of sampleCatalogProducts) {
        if (existingSkus.has(product.sku)) continue;
        const categoryId = categoryMap.get(product.categoryName.toLowerCase());
        if (!categoryId) continue;
        await api("/admin/products", {
          method: "POST",
          body: JSON.stringify({
            ...product,
            categoryId,
          }),
        });
      }
      await load();
    } finally {
      setSeedingProducts(false);
    }
  };

  const saveMediaSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsBusy(true);
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
    } finally {
      setSettingsBusy(false);
    }
  };

  const shopInfo = settings || publicSettings || {};
  const shopName = String(shopInfo?.shopName ?? "Rajesh Shopping Center");
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
          setForgotMode={setForgotMode}
          forgotForm={forgotForm}
          setForgotForm={setForgotForm}
          requestPasswordReset={requestPasswordReset}
          resetPassword={resetPassword}
          resetBusy={resetBusy}
          recoveryInfo={recoveryInfo}
          toggleLanguage={toggleLanguage}
          setOwnerEntryRequested={setOwnerEntryRequested}
          setError={setError}
          loginOtpInfo={loginOtpInfo}
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
    />
  );

  if (!token) return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(212,160,23,0.22),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(26,58,107,0.18),transparent_28%),linear-gradient(180deg,#fffaf1_0%,#f3eadc_100%)] px-6 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className={`${shellCard("overflow-hidden bg-slate-950 text-white")} relative p-8 lg:p-12`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,160,23,0.18),transparent_26%),linear-gradient(135deg,#0f172a_0%,#16294a_55%,#1A3A6B_100%)]" />
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="relative z-10 space-y-8">
            <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-200">
              {text.businessCockpit}
            </span>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl leading-[1.05] text-white lg:text-6xl">
                {shopName}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-200/85">
                {`${text.ownerHero} ${shopAddress}`}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Boxes, title: text.stockIntelligence, text: text.stockIntelligenceDesc },
                { icon: ReceiptText, title: text.ledgerBilling, text: text.ledgerBillingDesc },
                { icon: Gift, title: text.customerRewards, text: text.customerRewardsDesc },
              ].map((item) => (
                <article key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                  <item.icon className="mb-4 h-6 w-6 text-amber-300" />
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <form onSubmit={submitLogin} className={`${shellCard("my-auto p-7 lg:p-8")} grid gap-5`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-800">{text.ownerLogin}</p>
              <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                <Languages className="h-3.5 w-3.5" />
                {lang === "ne" ? "EN" : "ने"}
              </button>
            </div>
            <h2 className="text-3xl text-slate-950">{shopName}</h2>
            <p className="text-sm leading-6 text-slate-500">
              {text.privateOwnerText}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.usernameLabel}
            <input className={inputClasses()} value={login.identifier} onChange={(e) => setLogin((v) => ({ ...v, identifier: e.target.value }))} placeholder="admin" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.passwordLabel}
            <input type="password" className={inputClasses()} value={login.password} onChange={(e) => setLogin((v) => ({ ...v, password: e.target.value }))} placeholder="password" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {text.authCodeLabel}
            <input className={inputClasses()} value={login.otp} onChange={(e) => setLogin((v) => ({ ...v, otp: e.target.value }))} placeholder={text.authCodePlaceholder} />
          </label>
          <button className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3.5 font-semibold text-slate-950 transition hover:from-amber-300 hover:to-amber-400">
            {text.openDashboard}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => {
              setError("");
              setOwnerEntryRequested(false);
            }}
          >
            {lang === "ne" ? "पसलमा फर्कनुहोस्" : "Back to shop"}
          </button>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f0e6_0%,#f2efe9_100%)] text-slate-900">
      <div className="grid lg:grid-cols-[280px_1fr]">
        <aside className="min-h-screen bg-[linear-gradient(180deg,#0f172a_0%,#13264a_52%,#1A3A6B_100%)] px-6 py-8 text-white">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">{text.ownerWorkspace}</p>
              <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white">
                <Languages className="h-3.5 w-3.5" />
                {lang === "ne" ? "EN" : "ने"}
              </button>
            </div>
            <h2 className="mt-3 text-3xl text-white">{String(settings?.shopName ?? "Rajesh Shopping Center")}</h2>
            <p className="text-sm text-slate-300">{String(settings?.address ?? "Musikot-5, Anpchaur, Gulmi, Nepal")}</p>
          </div>
          <div className="mt-8 grid gap-3">
            {[
              { name: "overview", label: text.overview, Icon: LayoutDashboard },
              { name: "billing", label: text.billing, Icon: ReceiptText },
              { name: "customers", label: text.customers, Icon: Users },
              { name: "products", label: text.products, Icon: PackagePlus },
              { name: "branding", label: text.branding, Icon: Megaphone },
            ].map(({ name, label, Icon }) => (
              <button
                key={name}
                type="button"
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${tab === name ? "bg-white text-slate-950 shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
                onClick={() => setTab(name)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
            {text.ownerOnlyNote}
          </div>
          <button
            type="button"
            className="mt-6 rounded-2xl border border-white/10 px-4 py-3 text-left transition hover:bg-white/10"
            onClick={() => {
              setToken("");
              setOwnerEntryRequested(false);
            }}
          >
            {text.logout}
          </button>
        </aside>
        <main className="space-y-6 px-6 py-8">
          <section className={`${shellCard("overflow-hidden p-7")} relative bg-[linear-gradient(135deg,#fffaf3_0%,#f7e8d2_55%,#f0dbc1_100%)]`}>
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.14) 1px, transparent 0)", backgroundSize: "22px 22px" }} />
            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <span className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-300">{text.businessCockpit}</span>
                <h1 className="mt-4 text-4xl leading-tight text-slate-950 lg:text-5xl">{shopName}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  {lang === "ne"
                    ? `${shopAddress} को पसल सञ्चालनका लागि बनाइएको निजी ड्यासबोर्ड। यहाँ स्टक, उधारो हिसाब, पुरानो बाँकीसहित नयाँ बिल, QR भुक्तानी, र ग्राहक रिवार्ड सबै एकै ठाउँमा हेर्न सकिन्छ।`
                    : `Rajesh Shopping Center private dashboard for stock, customer credit, previous-due billing, QR payment tracking, reward records, and delivery operations for groceries, clothing, hardware, Bolero double cab service, and tractor-supported materials.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {[shopPhone, "Cash", "Credit", "eSewa", "Khalti", "Bank QR"].map((item) => (
                  <span key={item} className="rounded-full bg-white/85 px-4 py-2 font-semibold text-slate-700 shadow-sm">{item}</span>
                ))}
              </div>
            </div>
          </section>

          {tab === "overview" && summary ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              [text.totalProducts, summary.totals.totalProducts, Boxes, text.totalProductsDesc],
              [text.lowStock, summary.totals.lowStockProducts, PackagePlus, text.lowStockDesc],
              [text.inventoryCost, money(summary.totals.inventoryCost), BadgeIndianRupee, text.inventoryCostDesc],
              [text.projectedSales, money(summary.totals.inventoryRevenue), ReceiptText, text.projectedSalesDesc],
              [text.totalCustomers, summary.totals.totalCustomers, Users, text.totalCustomersDesc],
              [text.creditDue, money(summary.totals.totalCreditBalance), CreditCard, text.creditDueDesc],
              [text.rewardPoints, summary.totals.totalRewardPoints, Gift, text.rewardPointsDesc],
            ].map(([label, value, Icon, description]) => <article key={String(label)} className={`${shellCard("p-5")} bg-white`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{label}</p><h3 className="mt-3 text-3xl text-slate-950">{value}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div><div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><Icon className="h-5 w-5" /></div></div></article>)}
            <div className={`${shellCard("p-6")} md:col-span-2 xl:col-span-4`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-slate-950">{text.recentInvoices}</h3>
                  <p className="mt-1 text-sm text-slate-500">{text.recentInvoicesDesc}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">{summary.recentInvoices.map((invoice: any) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm"><div><span className="block font-semibold text-slate-950">{invoice.invoiceNumber}</span><span className="text-slate-500">{invoice.customerName}</span></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.paid} {money(invoice.amountPaid)}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{text.due} {money(invoice.dueAmount)}</span><span className="text-slate-500">{when(invoice.createdAt)}</span></div>)}</div>
            </div>
          </section> : null}

          {tab === "billing" ? <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <form onSubmit={createInvoice} className={`${shellCard("p-6 lg:p-7")} bg-white`}>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-slate-950">{text.createBill}</h3>
                  <p className="mt-1 text-sm text-slate-500">{text.currentSaleNote}</p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white">
                  {text.totalPreview}: <span className="font-semibold">{money(preview.total)}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <select className={inputClasses()} value={invoiceForm.customerId} onChange={(e) => setInvoiceForm((v) => ({ ...v, customerId: Number(e.target.value) }))}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({money(num(customer.creditBalance))} {text.due})</option>)}</select>
                {lines.map((line, index) => <div key={`${line.productId}-${index}`} className="grid gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_120px_100px]"><select className={inputClasses()} value={line.productId} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, productId: Number(e.target.value) } : item))}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.stockQuantity} {product.unit} {text.left})</option>)}</select><input type="number" min={1} className={inputClasses()} value={line.quantity} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} /><button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium transition hover:bg-slate-100" onClick={() => setLines((items) => items.filter((_, i) => i !== index))}>{text.remove}</button></div>)}
                <button type="button" className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-medium text-slate-900 transition hover:bg-slate-200" onClick={() => products[0] && setLines((items) => [...items, { productId: products[0].id, quantity: 1 }])}>{text.addLineItem}</button>
                <div className="grid gap-4 md:grid-cols-2">
                  <select className={inputClasses()} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm((v) => ({ ...v, paymentMethod: e.target.value }))}>{["cash", "credit", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{method}</option>)}</select>
                  <input type="number" min={0} className={inputClasses()} value={invoiceForm.amountPaid} onChange={(e) => setInvoiceForm((v) => ({ ...v, amountPaid: e.target.value }))} placeholder={text.amountReceivedNow} />
                </div>
                <textarea className={`${inputClasses()} min-h-24`} value={invoiceForm.note} onChange={(e) => setInvoiceForm((v) => ({ ...v, note: e.target.value }))} placeholder={text.billNote} />
                <button className="rounded-2xl bg-gradient-to-r from-slate-950 to-[#1A3A6B] px-4 py-3.5 font-semibold text-white transition hover:opacity-95">{text.saveBill}</button>
              </div>
            </form>
            <section className={`${shellCard("overflow-hidden p-6 print-hidden")} bg-white`}>
              <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fffdf8_0%,#f7ebdd_100%)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-800">{text.invoicePreview}</p>
                    <h3 className="mt-2 text-2xl text-slate-950">{String(settings?.shopName ?? "Rajesh Shopping Center")}</h3>
                    <p className="mt-1 text-sm text-slate-500">{String(settings?.address ?? "Musikot-5, Anpchaur, Gulmi, Nepal")}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">{currentCustomer?.name ?? (lang === "ne" ? "ग्राहक" : "Customer")}</p>
                    <p>{currentCustomer?.phone || text.noPhoneSaved}</p>
                    <p>{currentCustomer?.address || text.noAddressSaved}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    [text.previousDue, money(preview.previousDue)],
                    [text.currentBill, money(preview.subtotal)],
                    [text.paidNow, money(preview.amountPaid)],
                    [text.remainingDue, money(preview.due)],
                  ].map(([label, value]) => (
                    <article key={label} className="rounded-2xl bg-white/90 p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  {preview.items.length ? (
                    preview.items.map((item) => (
                      <div
                        key={`${item.productId}-${item.name}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm shadow-sm"
                      >
                        <span className="font-medium text-slate-900">{item.name}</span>
                        <span>{item.quantity} {item.unit}</span>
                        <span>{money(item.price)}</span>
                        <span>{money(item.total)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white/90 px-4 py-6 text-sm text-slate-500 shadow-sm">
                      {lang === "ne" ? "अहिलेसम्म बिलमा सामान थपिएको छैन।" : "No products have been added to this bill yet."}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-2">{text.payment}: {paymentMethodLabel}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">{text.rewardEarned}: {preview.rewardPoints}</span>
                <button
                  type="button"
                  className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-300"
                  onClick={() => window.print()}
                >
                  {text.print}
                </button>
              </div>
              {lastInvoice ? <div className="mt-4 rounded-[1.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#1A3A6B_100%)] p-5 text-sm text-white">{text.lastInvoice} <span className="font-semibold">{lastInvoice.invoice.invoiceNumber}</span> | {text.due} {money(lastInvoice.invoice.dueAmount)}</div> : null}
              <div className="print-bill-sheet hidden print:block">
                <div className="mx-auto max-w-[800px] bg-white px-8 py-8 text-slate-950">
                  <div className="mb-6 border-b border-slate-200 pb-5 text-center">
                    <img
                      src="/ganesh-banner.png"
                      alt="Om Shree Ganeshaya Namah"
                      className="mx-auto h-24 w-auto max-w-full rounded-[1.25rem] object-contain"
                    />
                  </div>
                  <div className="border-b-2 border-slate-900 pb-5">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <h1 className="text-3xl font-serif font-bold">{String(settings?.shopName ?? "Rajesh Shopping Center")}</h1>
                        <p className="mt-2 text-sm">{String(settings?.address ?? "Musikot-5, Anpchaur, Gulmi, Nepal")}</p>
                        <p className="text-sm">{String(settings?.phone ?? "+9779814401716")}</p>
                        <p className="text-sm">{String(settings?.email ?? "rajeshshoppingcenter@gmail.com")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
                          {lang === "ne" ? "बिल" : "Invoice"}
                        </p>
                        <p className="mt-2 text-sm">
                          <span className="font-semibold">{lang === "ne" ? "मिति:" : "Date:"}</span> {when(new Date().toISOString())}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">{lang === "ne" ? "भुक्तानी:" : "Payment:"}</span> {paymentMethodLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-300 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                        {lang === "ne" ? "ग्राहक विवरण" : "Customer Details"}
                      </p>
                      <p className="mt-3 text-lg font-semibold">{currentCustomer?.name ?? (lang === "ne" ? "ग्राहक" : "Customer")}</p>
                      <p className="text-sm">{currentCustomer?.phone || text.noPhoneSaved}</p>
                      <p className="text-sm">{currentCustomer?.address || text.noAddressSaved}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-300 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                        {lang === "ne" ? "बिल सारांश" : "Bill Summary"}
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-4"><span>{text.previousDue}</span><span>{money(preview.previousDue)}</span></div>
                        <div className="flex justify-between gap-4"><span>{text.currentBill}</span><span>{money(preview.subtotal)}</span></div>
                        <div className="flex justify-between gap-4"><span>{text.paidNow}</span><span>{money(preview.amountPaid)}</span></div>
                        <div className="flex justify-between gap-4 font-semibold"><span>{text.remainingDue}</span><span>{money(preview.due)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-300">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border-b border-slate-300 px-4 py-3 text-left">{lang === "ne" ? "सामान" : "Product"}</th>
                          <th className="border-b border-slate-300 px-4 py-3 text-left">{lang === "ne" ? "परिमाण" : "Qty"}</th>
                          <th className="border-b border-slate-300 px-4 py-3 text-left">{lang === "ne" ? "दर" : "Rate"}</th>
                          <th className="border-b border-slate-300 px-4 py-3 text-left">{lang === "ne" ? "जम्मा" : "Amount"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items.length ? (
                          preview.items.map((item) => (
                            <tr key={`print-${item.productId}-${item.name}`}>
                              <td className="border-b border-slate-200 px-4 py-3">{item.name}</td>
                              <td className="border-b border-slate-200 px-4 py-3">{item.quantity} {item.unit}</td>
                              <td className="border-b border-slate-200 px-4 py-3">{money(item.price)}</td>
                              <td className="border-b border-slate-200 px-4 py-3">{money(item.total)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                              {lang === "ne" ? "सामान थपेपछि बिल प्रिन्ट गर्नुहोस्।" : "Add products before printing the bill."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 ml-auto max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span>{text.previousDue}</span><span>{money(preview.previousDue)}</span></div>
                    <div className="flex justify-between gap-4"><span>{text.currentBill}</span><span>{money(preview.subtotal)}</span></div>
                    <div className="flex justify-between gap-4"><span>{text.paidNow}</span><span>{money(preview.amountPaid)}</span></div>
                    <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-base font-bold"><span>{text.remainingDue}</span><span>{money(preview.due)}</span></div>
                  </div>

                  {invoiceForm.note ? (
                    <div className="mt-6 rounded-2xl border border-slate-300 p-4 text-sm">
                      <p className="font-semibold">{lang === "ne" ? "नोट" : "Note"}</p>
                      <p className="mt-2 whitespace-pre-wrap">{invoiceForm.note}</p>
                    </div>
                  ) : null}

                  <div className="mt-8 border-t border-slate-300 pt-4 text-xs text-slate-500">
                    <p>{lang === "ne" ? "राजेश सपिङ सेन्टर - ग्राहक बिल" : "Rajesh Shopping Center - customer invoice"}</p>
                  </div>
                </div>
              </div>
            </section>
          </section> : null}

          {tab === "customers" ? <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={`${shellCard("p-6")} bg-white`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-slate-950">{text.customerLedger}</h3>
                  <p className="mt-1 text-sm text-slate-500">{text.customerLedgerDesc}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4">{customers.map((customer) => <article key={customer.id} className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-4"><div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">{customer.photoPath ? <img src={customer.photoPath} alt={customer.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">{lang === "ne" ? "फोटो छैन" : "No photo"}</div>}</div><div><h4 className="text-xl text-slate-950">{customer.name}</h4><p className="text-sm text-slate-500">{customer.customerCode || (lang === "ne" ? "कोड छैन" : "No code")}</p><p className="text-sm text-slate-500">{customer.phone || text.noPhoneSaved}</p><p className="text-sm text-slate-400">{customer.address || text.noAddressSaved}</p></div></div><div className="grid gap-2 text-sm"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{text.due}: {money(num(customer.creditBalance))}</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{text.rewardPoints}: {customer.rewardPoints}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{text.spent}: {money(num(customer.totalSpent))}</span><div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={() => startEditCustomer(customer)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">{text.edit}</button><button type="button" onClick={() => deleteCustomer(customer.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100">{text.delete}</button></div></div></div><div className="mt-4 grid gap-2">{(customer.ledger || []).slice(0, 4).map((entry: any) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span className="font-medium text-slate-900">{entry.description}</span><span className="text-slate-500">{when(entry.createdAt)}</span><span className="text-slate-700">{text.balanceShort} {money(num(entry.balanceAfter))}</span></div>)}</div></article>)}</div>
            </div>
            <div className="space-y-6">
              <form onSubmit={recordPayment} className={`${shellCard("p-6")} bg-white`}><h3 className="text-2xl text-slate-950">{text.recordPayment}</h3><div className="mt-4 grid gap-4"><select className={inputClasses()} value={paymentForm.customerId} onChange={(e) => setPaymentForm((v) => ({ ...v, customerId: Number(e.target.value) }))}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><input type="number" min={0} className={inputClasses()} value={paymentForm.amount} onChange={(e) => setPaymentForm((v) => ({ ...v, amount: e.target.value }))} placeholder={text.amount} /><select className={inputClasses()} value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((v) => ({ ...v, paymentMethod: e.target.value }))}>{["cash", "esewa", "khalti", "bank"].map((method) => <option key={method} value={method}>{method}</option>)}</select><textarea className={`${inputClasses()} min-h-24`} value={paymentForm.referenceNote} onChange={(e) => setPaymentForm((v) => ({ ...v, referenceNote: e.target.value }))} placeholder={text.note} /><button className="rounded-2xl bg-gradient-to-r from-slate-950 to-[#1A3A6B] px-4 py-3 font-semibold text-white">{text.saveRepayment}</button></div></form>
              <form onSubmit={createCustomer} className={`${shellCard("p-6")} bg-white`}><h3 className="text-2xl text-slate-950">{editingCustomerId ? `${text.edit} ${lang === "ne" ? "ग्राहक" : "customer"}` : text.addCustomer}</h3><div className="mt-4 grid gap-4">{["name", "phone", "address"].map((key) => <input key={key} className={inputClasses()} value={(customerForm as any)[key]} onChange={(e) => setCustomerForm((v) => ({ ...v, [key]: e.target.value }))} placeholder={key} />)}<input className={inputClasses()} value={customerForm.customerCode} onChange={(e) => setCustomerForm((v) => ({ ...v, customerCode: e.target.value }))} placeholder={lang === "ne" ? "ग्राहक कोड (खाली छोडे स्वतः बन्छ)" : "Customer code (leave blank to auto-generate)"} /><textarea className={`${inputClasses()} min-h-24`} value={customerForm.notes} onChange={(e) => setCustomerForm((v) => ({ ...v, notes: e.target.value }))} placeholder={text.notes} /><label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">{lang === "ne" ? "फोटो अपलोड / क्यामेरा" : "Upload photo / use camera"}<input type="file" accept="image/*" capture="user" className="mt-3 block w-full text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const dataUrl = await readFileAsDataUrl(file); setCustomerForm((v) => ({ ...v, photoPath: dataUrl })); e.target.value = ""; }} /></label>{customerForm.photoPath ? <img src={customerForm.photoPath} alt="customer preview" className="h-32 w-32 rounded-2xl object-cover border border-slate-200" /> : null}<div className="flex flex-wrap gap-3"><button className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 font-semibold text-slate-950">{editingCustomerId ? (lang === "ne" ? "ग्राहक अपडेट गर्नुहोस्" : "Update customer") : text.createCustomerButton}</button>{editingCustomerId ? <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700" onClick={() => { setEditingCustomerId(null); setCustomerForm({ name: "", phone: "", address: "", notes: "", customerCode: "", photoPath: "" }); }}>{lang === "ne" ? "रद्द गर्नुहोस्" : "Cancel"}</button> : null}</div></div></form>
            </div>
          </section> : null}

          {tab === "products" ? <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={`${shellCard("p-6")} bg-white`}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-slate-950">{text.productCosts}</h3>
                  <p className="mt-1 text-sm text-slate-500">{text.productCostsDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={seedSampleProducts}
                  className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
                >
                  {seedingProducts ? (lang === "ne" ? "लोड हुँदैछ..." : "Loading...") : text.sampleProducts}
                </button>
              </div>
              <div className="mt-4 grid gap-4">
                {products.length ? products.map((product) => {
                  const cost = num(product.buyingPrice) + num(product.transportationCost) + num(product.extraCost);
                  return (
                    <article key={product.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <div className="h-24 w-24 overflow-hidden rounded-2xl bg-white">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">{lang === "ne" ? "तस्बिर छैन" : "No image"}</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xl text-slate-950">{product.name}</h4>
                            <p className="mt-1 text-sm text-slate-500">{product.description || product.sku || "-"}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {product.categoryName ? <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{product.categoryName}</span> : null}
                              <span className={`rounded-full px-3 py-1 ${product.inStock ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{product.inStock ? text.inStock : text.outOfStock}</span>
                              {product.featured ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{text.featuredLabel}</span> : null}
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{product.stockQuantity} {product.unit}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => startEditProduct(product)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                            <span className="inline-flex items-center gap-2"><Pencil className="h-4 w-4" />{text.edit}</span>
                          </button>
                          <button type="button" onClick={() => deleteProduct(product.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
                            <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" />{text.delete}</span>
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white px-4 py-3"><span className="block text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "किन्ने" : "Buying"}</span><strong className="mt-2 block">{money(num(product.buyingPrice))}</strong></div>
                        <div className="rounded-2xl bg-white px-4 py-3"><span className="block text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "ढुवानी" : "Transport"}</span><strong className="mt-2 block">{money(num(product.transportationCost))}</strong></div>
                        <div className="rounded-2xl bg-white px-4 py-3"><span className="block text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "बिक्री" : "Selling"}</span><strong className="mt-2 block">{money(num(product.price))}</strong></div>
                        <div className="rounded-2xl bg-white px-4 py-3"><span className="block text-xs uppercase tracking-[0.2em] text-slate-500">{lang === "ne" ? "नाफा" : "Profit"}</span><strong className="mt-2 block text-emerald-700">{money(num(product.price) - cost)}</strong></div>
                      </div>
                    </article>
                  );
                }) : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-slate-500">{text.noProductsYet}</div>}
              </div>
            </div>
            <form onSubmit={createProduct} className={`${shellCard("p-6")} bg-white`}>
              <h3 className="text-2xl text-slate-950">{editingProductId ? text.updateProduct : text.addProduct}</h3>
              <div className="mt-4 grid gap-4">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-950">{lang === "ne" ? "श्रेणी व्यवस्थापन" : "Category management"}</h4>
                      <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "ग्राहक पक्षमा देखिने वर्गहरू यहाँबाट बदल्न सक्नुहुन्छ।" : "Edit the category list customers see in the shop."}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {categories.map((category) => (
                      <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-950">{category.name}</p>
                          <p className="text-sm text-slate-500">{category.description || "-"}</p>
                          <p className="text-xs text-slate-400">{category.productCount ?? 0} {lang === "ne" ? "उत्पादन" : "products"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{category.icon}</span>
                          <button type="button" onClick={() => startEditCategory(category)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">{text.edit}</button>
                          <button type="button" onClick={() => deleteCategory(category.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{text.delete}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3">
                    <input className={inputClasses()} value={categoryForm.name} onChange={(e) => setCategoryForm((v) => ({ ...v, name: e.target.value }))} placeholder={lang === "ne" ? "श्रेणी नाम" : "Category name"} />
                    <textarea className={`${inputClasses()} min-h-24`} value={categoryForm.description} onChange={(e) => setCategoryForm((v) => ({ ...v, description: e.target.value }))} placeholder={lang === "ne" ? "श्रेणी विवरण" : "Category description"} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <select className={inputClasses()} value={categoryForm.icon} onChange={(e) => setCategoryForm((v) => ({ ...v, icon: e.target.value }))}>
                        {["fruits", "vegetables", "foods", "grocery", "gas", "hardware", "beverages", "smoke", "remittance", "transport", "clothes", "shoes"].map((icon) => (
                          <option key={icon} value={icon}>{icon}</option>
                        ))}
                      </select>
                      <input className={inputClasses()} type="number" min={0} value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((v) => ({ ...v, sortOrder: e.target.value }))} placeholder={lang === "ne" ? "क्रम" : "Sort order"} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => createCategory()} className="rounded-2xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">{editingCategoryId ? (lang === "ne" ? "श्रेणी अपडेट गर्नुहोस्" : "Update category") : (lang === "ne" ? "श्रेणी थप्नुहोस्" : "Add category")}</button>
                      {editingCategoryId ? <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700" onClick={() => { setEditingCategoryId(null); setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder ?? 0) + 1) }); }}>{lang === "ne" ? "रद्द गर्नुहोस्" : "Cancel"}</button> : null}
                    </div>
                  </div>
                </div>
                {["name", "sku", "description", "price", "buyingPrice", "transportationCost", "extraCost", "stockQuantity", "reorderLevel", "unit"].map((key) => (
                  key === "description" ? (
                    <textarea key={key} className={`${inputClasses()} min-h-28`} value={(productForm as any)[key]} onChange={(e) => setProductForm((v: any) => ({ ...v, [key]: e.target.value }))} placeholder={key} />
                  ) : (
                    <input key={key} className={inputClasses()} value={(productForm as any)[key]} onChange={(e) => setProductForm((v: any) => ({ ...v, [key]: e.target.value }))} placeholder={key} />
                  )
                ))}
                <select className={inputClasses()} value={productForm.categoryId} onChange={(e) => setProductForm((v: any) => ({ ...v, categoryId: e.target.value }))}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input className={inputClasses()} value={(productForm as any).imageUrl || ""} onChange={(e) => setProductForm((v: any) => ({ ...v, imageUrl: e.target.value }))} placeholder="image url / data url" />
                <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                  {text.uploadImage}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-3 block w-full text-sm"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await readFileAsDataUrl(file);
                      setProductForm((v: any) => ({ ...v, imageUrl: dataUrl }));
                      e.target.value = "";
                    }}
                  />
                </label>
                {(productForm as any).imageUrl ? <img src={(productForm as any).imageUrl} alt="preview" className="h-40 w-full rounded-2xl object-cover" /> : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={Boolean((productForm as any).featured)} onChange={(e) => setProductForm((v: any) => ({ ...v, featured: e.target.checked }))} />
                    {text.featuredLabel}
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={Number((productForm as any).stockQuantity || 0) > 0} onChange={(e) => setProductForm((v: any) => ({ ...v, stockQuantity: e.target.checked ? (v.stockQuantity || "1") : "0" }))} />
                    {lang === "ne" ? "स्टक उपलब्ध" : "Available in stock"}
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="rounded-2xl bg-gradient-to-r from-slate-950 to-[#1A3A6B] px-4 py-3 font-semibold text-white">{editingProductId ? text.updateProduct : text.saveProduct}</button>
                  {editingProductId ? <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700" onClick={() => { setEditingProductId(null); setProductForm({ name: "", sku: "", description: "", price: "", buyingPrice: "", transportationCost: "", extraCost: "", stockQuantity: "", reorderLevel: "", unit: "piece", categoryId: String(categories[0]?.id ?? "") } as any); }}>{lang === "ne" ? "रद्द गर्नुहोस्" : "Cancel"}</button> : null}
                </div>
              </div>
            </form>
          </section> : null}

          {tab === "branding" ? <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={saveMediaSettings} className={`${shellCard("p-6")} bg-white`}>
              <h3 className="text-2xl text-slate-950">{text.mediaCenter}</h3>
              <p className="mt-1 text-sm text-slate-500">{text.mediaCenterDesc}</p>
              <div className="mt-5 grid gap-5">
                <div className="rounded-[1.5rem] border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{lang === "ne" ? "मुख्य व्यवसाय विवरण" : "Main business details"}</p>
                  <div className="mt-3 grid gap-4">
                    <input className={inputClasses()} value={settingsForm.shopName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, shopName: e.target.value }))} placeholder={lang === "ne" ? "पसल नाम" : "Shop name"} />
                    <input className={inputClasses()} value={settingsForm.proprietorName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, proprietorName: e.target.value }))} placeholder={lang === "ne" ? "प्रोप्राइटर नाम" : "Proprietor name"} />
                    <input className={inputClasses()} value={settingsForm.phone || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, phone: e.target.value }))} placeholder={lang === "ne" ? "फोन नम्बर" : "Phone number"} />
                    <input className={inputClasses()} value={settingsForm.email || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, email: e.target.value }))} placeholder={lang === "ne" ? "इमेल" : "Email"} />
                    <textarea className={`${inputClasses()} min-h-24`} value={settingsForm.address || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, address: e.target.value }))} placeholder={lang === "ne" ? "ठेगाना" : "Address"} />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{lang === "ne" ? "भुक्तानी र रिवार्ड विवरण" : "Payment and reward details"}</p>
                  <div className="mt-3 grid gap-4">
                    <input className={inputClasses()} value={settingsForm.bankName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, bankName: e.target.value }))} placeholder={lang === "ne" ? "बैंक नाम" : "Bank name"} />
                    <input className={inputClasses()} value={settingsForm.bankBranch || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, bankBranch: e.target.value }))} placeholder={lang === "ne" ? "शाखा" : "Branch"} />
                    <input className={inputClasses()} value={settingsForm.accountName || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, accountName: e.target.value }))} placeholder={lang === "ne" ? "खाता नाम" : "Account name"} />
                    <input className={inputClasses()} value={settingsForm.accountNumber || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, accountNumber: e.target.value }))} placeholder={lang === "ne" ? "खाता नम्बर" : "Account number"} />
                    <input className={inputClasses()} value={settingsForm.whatsappPhone || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, whatsappPhone: e.target.value }))} placeholder="WhatsApp" />
                    <input className={inputClasses()} value={settingsForm.whatsappApiKey || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, whatsappApiKey: e.target.value }))} placeholder="CallMeBot API key" />
                    <input className={inputClasses()} value={settingsForm.esewaId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, esewaId: e.target.value }))} placeholder="eSewa ID" />
                    <input className={inputClasses()} value={settingsForm.khaltiId || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, khaltiId: e.target.value }))} placeholder="Khalti ID" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <input className={inputClasses()} type="number" min={1} value={settingsForm.rewardRate || 1} onChange={(e) => setSettingsForm((current: any) => ({ ...current, rewardRate: e.target.value }))} placeholder={lang === "ne" ? "रिवार्ड दर" : "Reward rate"} />
                      <input className={inputClasses()} type="number" min={1} value={settingsForm.rewardUnitAmount || "100"} onChange={(e) => setSettingsForm((current: any) => ({ ...current, rewardUnitAmount: e.target.value }))} placeholder={lang === "ne" ? "रिवार्ड आधार रकम" : "Reward base amount"} />
                    </div>
                    <textarea className={`${inputClasses()} min-h-24`} value={settingsForm.invoiceFooter || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, invoiceFooter: e.target.value }))} placeholder={lang === "ne" ? "बिल फुटर" : "Invoice footer"} />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{lang === "ne" ? "सार्वजनिक जानकारी" : "Public business text"}</p>
                  <div className="mt-3 grid gap-4">
                    <textarea className={`${inputClasses()} min-h-28`} value={settingsForm.aboutText || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, aboutText: e.target.value }))} placeholder={lang === "ne" ? "व्यवसाय परिचय" : "Business introduction"} />
                    <textarea className={`${inputClasses()} min-h-28`} value={settingsForm.deliveryPolicy || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, deliveryPolicy: e.target.value }))} placeholder={lang === "ne" ? "डेलिभरी नीति" : "Delivery policy"} />
                    <textarea className={`${inputClasses()} min-h-28`} value={settingsForm.termsConditions || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, termsConditions: e.target.value }))} placeholder={lang === "ne" ? "नियम तथा सर्त" : "Terms and conditions"} />
                  </div>
                </div>
                {[
                  ["shopPhotoPath", text.shopPhoto],
                  ["ownerPhotoPath", text.ownerPhoto],
                  ["homeBannerPath", text.bannerPhoto],
                ].map(([field, label]) => (
                  <div key={field} className="rounded-[1.5rem] border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{label}</p>
                    <input className={`${inputClasses()} mt-3 w-full`} value={settingsForm[field] || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, [field]: e.target.value }))} placeholder={lang === "ne" ? "तस्बिर लिंक वा data url" : "Image URL or data URL"} />
                    <label className="mt-3 block rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                      {text.uploadImage}
                      <input type="file" accept="image/*" capture="environment" className="mt-3 block w-full text-sm" onChange={(e) => handleSettingsMediaUpload(e, field as any)} />
                    </label>
                    {settingsForm[field] ? <img src={settingsForm[field]} alt={String(label)} className="mt-3 h-36 w-full rounded-2xl object-cover" /> : null}
                  </div>
                ))}
                <button disabled={settingsBusy} className="rounded-2xl bg-gradient-to-r from-slate-950 to-[#1A3A6B] px-4 py-3 font-semibold text-white">{settingsBusy ? (lang === "ne" ? "सेभ हुँदैछ..." : "Saving...") : text.saveMediaSettings}</button>
              </div>
            </form>
            <div className="space-y-6">
              <section className={`${shellCard("p-6")} bg-white`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl text-slate-950">{text.announcements}</h3>
                    <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "विशेष अवसर, छुट, नयाँ स्टक वा सार्वजनिक सूचना राख्नुहोस्।" : "Post festival notices, offers, new stock updates, or public announcements."}</p>
                  </div>
                  <button type="button" onClick={() => setSettingsForm((current: any) => ({ ...current, announcements: [...(current.announcements || []), { title: "", body: "", status: "active", type: "news", imageUrl: "" }] }))} className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">{text.addAnnouncement}</button>
                </div>
                <div className="mt-4 grid gap-4">
                  {(settingsForm.announcements || []).map((item: any, index: number) => (
                    <div key={`announcement-${index}`} className="rounded-[1.5rem] border border-slate-200 p-4">
                      <div className="grid gap-4">
                        <input className={inputClasses()} value={item.title || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: e.target.value } : entry) }))} placeholder={text.titleLabel} />
                        <textarea className={`${inputClasses()} min-h-24`} value={item.body || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, body: e.target.value } : entry) }))} placeholder={text.bodyLabel} />
                        <div className="grid gap-4 md:grid-cols-2">
                          <input className={inputClasses()} value={item.type || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, type: e.target.value } : entry) }))} placeholder={text.occasionLabel} />
                          <select className={inputClasses()} value={item.status || "active"} onChange={(e) => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, status: e.target.value } : entry) }))}>
                            <option value="active">{text.activeStatus}</option>
                            <option value="draft">{text.draftStatus}</option>
                          </select>
                        </div>
                        <input className={inputClasses()} value={item.imageUrl || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, imageUrl: e.target.value } : entry) }))} placeholder={text.imageLabel} />
                        <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                          {text.uploadImage}
                          <input type="file" accept="image/*" capture="environment" className="mt-3 block w-full text-sm" onChange={(e) => handleAnnouncementImageUpload(e, index)} />
                        </label>
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.title || "announcement"} className="h-40 w-full rounded-2xl object-cover" /> : null}
                        <button type="button" onClick={() => setSettingsForm((current: any) => ({ ...current, announcements: current.announcements.filter((_: any, entryIndex: number) => entryIndex !== index) }))} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{text.delete}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${shellCard("p-6")} bg-white`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl text-slate-950">{text.featuredMedia}</h3>
                    <p className="mt-1 text-sm text-slate-500">{lang === "ne" ? "होमपेजमा देखाउने विशेष फोटो वा भिडियो राख्नुहोस्।" : "Add featured images or videos to highlight on the homepage."}</p>
                  </div>
                  <button type="button" onClick={() => setSettingsForm((current: any) => ({ ...current, featuredMedia: [...(current.featuredMedia || []), { title: "", mediaType: "image", url: "", status: "active" }] }))} className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">{text.addMedia}</button>
                </div>
                <div className="mt-4 grid gap-4">
                  {(settingsForm.featuredMedia || []).map((item: any, index: number) => (
                    <div key={`media-${index}`} className="rounded-[1.5rem] border border-slate-200 p-4">
                      <div className="grid gap-4">
                        <input className={inputClasses()} value={item.title || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, featuredMedia: current.featuredMedia.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: e.target.value } : entry) }))} placeholder={text.titleLabel} />
                        <div className="grid gap-4 md:grid-cols-2">
                          <select className={inputClasses()} value={item.mediaType || "image"} onChange={(e) => setSettingsForm((current: any) => ({ ...current, featuredMedia: current.featuredMedia.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, mediaType: e.target.value } : entry) }))}>
                            <option value="image">{text.imageLabel}</option>
                            <option value="video">{text.videoLabel}</option>
                          </select>
                          <select className={inputClasses()} value={item.status || "active"} onChange={(e) => setSettingsForm((current: any) => ({ ...current, featuredMedia: current.featuredMedia.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, status: e.target.value } : entry) }))}>
                            <option value="active">{text.activeStatus}</option>
                            <option value="draft">{text.draftStatus}</option>
                          </select>
                        </div>
                        <input className={inputClasses()} value={item.url || ""} onChange={(e) => setSettingsForm((current: any) => ({ ...current, featuredMedia: current.featuredMedia.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, url: e.target.value } : entry) }))} placeholder={item.mediaType === "video" ? text.pasteVideoUrl : text.imageLabel} />
                        <label className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600">
                          {item.mediaType === "video" ? text.uploadVideo : text.uploadImage}
                          <input type="file" accept={item.mediaType === "video" ? "video/*" : "image/*"} capture={item.mediaType === "video" ? undefined : "environment"} className="mt-3 block w-full text-sm" onChange={(e) => handleFeaturedMediaUpload(e, index)} />
                        </label>
                        {item.url ? item.mediaType === "video" ? <video src={item.url} controls className="h-48 w-full rounded-2xl object-cover" /> : <img src={item.url} alt={item.title || "media"} className="h-48 w-full rounded-2xl object-cover" /> : null}
                        <button type="button" onClick={() => setSettingsForm((current: any) => ({ ...current, featuredMedia: current.featuredMedia.filter((_: any, entryIndex: number) => entryIndex !== index) }))} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{text.delete}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section> : null}
        </main>
      </div>
    </div>
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














