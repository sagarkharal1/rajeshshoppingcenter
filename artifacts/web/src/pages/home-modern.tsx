import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCategories, useGetProducts, useGetSettings } from "@workspace/api-client-react";
import { getImageUrl } from "@/lib/utils";
import { useLanguage } from "@/lib/language";
import { ProductCard } from "@/components/product-card";
import { salePriceInfo } from "@/lib/sale-price";
import { CategoryIcon } from "@/components/category-icon";
import { ArrowRight, Megaphone, MessageCircle, Phone, Search, ShoppingBag, Star, Truck } from "lucide-react";

const DEFAULT_SHOP_BANNER = "/shop-banner-default.jpeg";

export default function HomeModern() {
  const { lang } = useLanguage();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const { data: settings, isLoading: loadingSettings } = useGetSettings();
  const { data: categories, isLoading: loadingCategories } = useGetCategories();
  const { data: featuredProducts, isLoading: loadingProducts } = useGetProducts({ featured: true });
  // Same query the catalog uses, so React Query serves it from cache rather
  // than fetching the list twice.
  const { data: allProducts } = useGetProducts();

  if (loadingSettings || loadingCategories || loadingProducts) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
      </div>
    );
  }

  const heroImage = getImageUrl((settings as any)?.homeBannerPath || settings?.shopPhotoPath) || DEFAULT_SHOP_BANNER;
  const hiddenCustomerCategories = new Set(["general", "remittance", "transport services"]);
  const visibleCategories = (categories ?? []).filter(
    (category) => !hiddenCustomerCategories.has(category.name.trim().toLowerCase()),
  );
  // Shown as a scrolling chip row now rather than a grid at the foot of the
  // page, so there is room for more of them.
  const categoriesToShow = visibleCategories.slice(0, 10);
  const featuredToShow = (featuredProducts ?? [])
    .filter((product) => !hiddenCustomerCategories.has((product.categoryName || "").trim().toLowerCase()))
    .slice(0, 4);
  // Anything discounted right now, biggest saving first. A shop runs a sale to
  // be noticed, so this goes above the popular items rather than leaving the
  // customer to find the discounts by opening products one at a time.
  const onSaleToShow = (allProducts ?? [])
    .filter((product) => !hiddenCustomerCategories.has((product.categoryName || "").trim().toLowerCase()))
    .filter((product) => salePriceInfo(product as any).onSale && (product as any).inStock !== false)
    .sort((a, b) => salePriceInfo(b as any).savingPercent - salePriceInfo(a as any).savingPercent)
    .slice(0, 8);

  const notices = Array.isArray((settings as any)?.announcements) ? (settings as any).announcements.slice(0, 3) : [];

  // Mirrors activeRewardBonus() on the server: an offer counts only while its
  // window is open, so an expired promotion stops advertising itself.
  const rewardOffer = (() => {
    const s = settings as any;
    const multiplier = Math.max(Number(s?.rewardBonusMultiplier ?? 1) || 1, 1);
    const startsAt = s?.rewardBonusStartsAt ? new Date(s.rewardBonusStartsAt) : null;
    const endsAt = s?.rewardBonusEndsAt ? new Date(s.rewardBonusEndsAt) : null;
    const now = new Date();
    const active = multiplier > 1 && (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
    return {
      active,
      multiplier,
      label: s?.rewardBonusLabel || null,
      endsText:
        active && endsAt
          ? (lang === "ne"
              ? `${endsAt.toLocaleDateString("en-NP", { day: "numeric", month: "short" })} सम्म मात्र`
              : `Only until ${endsAt.toLocaleDateString("en-NP", { day: "numeric", month: "short" })}`)
          : null,
    };
  })();
  const shopPhoto = getImageUrl((settings as any)?.shopPhotoPath) || DEFAULT_SHOP_BANNER;
  const businessStory = String((settings as any)?.aboutText || "");
  const shopPhone = String((settings as any)?.whatsappPhone || settings?.phone || "+9779814401716");
  const whatsappPhone = shopPhone.replace(/[^\d+]/g, "").replace(/^\+/, "");

  const copy = {
    searchPlaceholder: lang === "ne" ? "सामान खोज्नुहोस्…" : "Search for products…",
    shopTile: lang === "ne" ? "सामान किन्नुहोस्" : "Shop products",
    shopTileDesc: lang === "ne" ? "किराना, तरकारी, हार्डवेयर" : "Groceries, veg, hardware",
    bookTile: lang === "ne" ? "गाडी बुक" : "Book transport",
    bookTileDesc: lang === "ne" ? "बोलेरो र ट्र्याक्टर" : "Bolero and tractor",
    aboutShop: lang === "ne" ? "पसलको बारेमा" : "About the shop",
    easyOrder: lang === "ne" ? "सजिलो अर्डर" : "Easy Order",
    heroDesc:
      lang === "ne"
        ? "घरका सामान, तरकारी, फलफूल, हार्डवेयर, ग्यास र गाडी सेवा एउटै ठाउँबाट सजिलै अर्डर गर्नुहोस्।"
        : "Order groceries, vegetables, fruits, hardware items, and delivery services from one simple place.",
    browseProducts: lang === "ne" ? "सामान हेर्नुहोस्" : "Browse products",
    bookTransport: lang === "ne" ? "गाडी बुक गर्नुहोस्" : "Book transport",
    call: lang === "ne" ? "फोन" : "Call",
    location: lang === "ne" ? "स्थान" : "Location",
    service: lang === "ne" ? "सेवा" : "Service",
    ordersDelivery: lang === "ne" ? "अर्डर र डेलिभरी" : "Orders and delivery",
    featuredTitle: lang === "ne" ? "लोकप्रिय सामान" : "Popular products",
    featuredDesc: lang === "ne" ? "छिटो हेर्नुहोस् र सजिलै अर्डर गर्नुहोस्" : "See products quickly and order faster",
    catalog: lang === "ne" ? "क्याटलग" : "Catalog",
    quick: lang === "ne" ? "छिटो" : "Quick",
    orderItems: lang === "ne" ? "सामान अर्डर" : "Order items",
    orderItemsDesc: lang === "ne" ? "मोबाइलबाट सजिलै सामान छान्नुहोस्" : "Choose products easily on mobile",
    track: lang === "ne" ? "ट्र्याक" : "Track",
    trackOrder: lang === "ne" ? "अर्डर हेर्नुहोस्" : "Track order",
    trackOrderDesc: lang === "ne" ? "अर्डरको अवस्था तुरुन्त हेर्नुहोस्" : "Check the latest order status fast",
    deliveryVehicle: lang === "ne" ? "डेलिभरी / गाडी" : "Delivery / vehicle",
    deliveryVehicleDesc: lang === "ne" ? "बोलेरो र ट्रयाक्टर सेवा बुक गर्नुहोस्" : "Book Bolero and tractor service",
    mainCategories: lang === "ne" ? "मुख्य विभाग" : "Main categories",
    oneTap: lang === "ne" ? "एक ट्यापमा छान्नुहोस्" : "Pick with one tap",
    all: lang === "ne" ? "सबै" : "All",
    servingSince: lang === "ne" ? "१९९७ देखि सेवा" : "Serving since 1997",
    proprietor: lang === "ne" ? "प्रोप्राइटर" : "Proprietor",
    callHelp: lang === "ne" ? "अर्डर वा सहयोगका लागि फोन गर्नुहोस्" : "Call for orders or help",
    notices: lang === "ne" ? "सूचना" : "Notices",
    latestFromShop: lang === "ne" ? "पसलबाट नयाँ सूचना" : "Latest from the shop",
    noNotice: lang === "ne" ? "अहिलेसम्म कुनै विशेष सूचना राखिएको छैन।" : "No special notice has been posted yet.",
    defaultNotice: lang === "ne" ? "छिट्टै थप जानकारी आउनेछ।" : "More updates will be added soon.",
    partnerTitle: lang === "ne" ? "हाम्रा साझेदार व्यवसाय" : "Our partner businesses",
    partnerDesc: lang === "ne" ? "थप सेवा र सप्लाइका लागि हाम्रो भरोसायोग्य साझेदार व्यवसायहरू।" : "Trusted partner businesses for more services and supply support.",
    story:
      lang === "ne"
        ? "राजेश सिपिङ् सेन्टर १९९७ देखि मुसिकोट–५, आपचौर, गुल्मीमा सेवा दिँदै आएको बहुउपयोगी स्थानीय व्यवसाय हो। यहाँ तरकारी, फलफूल, खाद्यान्न, किराना, लत्ताकपडा, हार्डवेयर, ग्यास, जुत्ता–चप्पल र दैनिक चाहिने धेरै सामान पाइन्छ। यहाँ डेलिभरी सेवा, बोलेरो डबल क्याब सेवा र ट्र्याक्टर सहयोग पनि उपलब्ध छ।"
        : "Rajesh Shopping Center has been serving Musikot-5, Aapchaur, Gulmi since 1997. We offer groceries, vegetables, fruits, food items, clothing, hardware, gas, shoes, and daily essentials. Bolero, tractor, and delivery services are also available.",
    highlights:
      lang === "ne"
        ? ["तरकारी, फलफूल, किराना", "हार्डवेयर र निर्माण सामान", "बोलेरो डबल क्याब सेवा", "डेलिभरी र ट्रयाक्टर सहयोग"]
        : ["Vegetables, fruits, groceries", "Hardware and building materials", "Bolero double cab service", "Delivery and tractor support"],
  };

  return (
    <div className="pb-10">
      {/* Kept, but slim. homeBannerPath is owner-configurable, so it stays a
          real feature — it just no longer costs half the first screen. */}
      <section className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <div className="relative h-24 overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#f2c14f,#a86d0f)] sm:h-32">
          {heroImage ? (
            <img src={heroImage} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.68)_0%,rgba(15,23,42,0.15)_75%)]" />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200">
              {copy.easyOrder}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-tight text-white sm:text-2xl">
              {lang === "ne" ? (settings?.shopName || "राजेश सिपिङ् सेन्टर") : "Rajesh Shopping Center"}
            </h1>
          </div>
        </div>
      </section>

      {/* Search next. Customers arrive wanting a specific thing, and the old
          layout made them scroll past the whole shop history to look for it. */}
      <section className="mx-auto mt-3 max-w-6xl px-4 sm:px-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const term = query.trim();
            navigate(term ? `/catalog?search=${encodeURIComponent(term)}` : "/catalog");
          }}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
        >
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </form>
      </section>

      {/* Categories, one tap from opening the app rather than buried at the
          bottom of the page. Scrolls sideways so a long list costs no height. */}
      {categoriesToShow.length > 0 ? (
        <section className="mt-3">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-1 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/catalog"
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <ShoppingBag className="h-4 w-4" />
              {copy.all}
            </Link>
            {categoriesToShow.map((category) => (
              <Link
                key={category.id}
                href={`/catalog?category=${category.id}`}
                className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm"
              >
                <CategoryIcon icon={category.icon} className="h-4 w-4 text-primary" />
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* The two things the shop actually sells: goods and transport. The old
          hero stacked four equal-weight buttons, which read as a menu rather
          than a choice. */}
      <section className="mx-auto mt-3 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/catalog"
            className="flex flex-col justify-between rounded-2xl bg-[#d69e10] p-4 text-white shadow-[0_10px_20px_-14px_rgba(214,158,16,0.9)]"
          >
            <ShoppingBag className="h-7 w-7" />
            <div className="mt-4">
              <p className="text-base font-bold leading-tight">{copy.shopTile}</p>
              <p className="mt-0.5 text-xs text-white/85">{copy.shopTileDesc}</p>
            </div>
          </Link>
          <Link
            href="/book"
            className="flex flex-col justify-between rounded-2xl bg-[#0f3d7a] p-4 text-white shadow-[0_10px_20px_-16px_rgba(15,61,122,0.9)]"
          >
            <Truck className="h-7 w-7" />
            <div className="mt-4">
              <p className="text-base font-bold leading-tight">{copy.bookTile}</p>
              <p className="mt-0.5 text-xs text-white/85">{copy.bookTileDesc}</p>
            </div>
          </Link>
        </div>

        {/* Calling and WhatsApp still matter here, but they are how you ask a
            question — not the main way to order. Sized to match. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <a
            href={`tel:${shopPhone}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0f3d7a]/20 bg-card px-4 py-3 text-sm font-bold text-[#0f3d7a]"
          >
            <Phone className="h-4 w-4" />
            {lang === "ne" ? "फोन" : "Call"}
          </a>
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {lang === "ne" ? "व्हाट्सएप" : "WhatsApp"}
          </a>
        </div>
      </section>

      {onSaleToShow.length > 0 ? (
        <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
          <div className="rounded-[2rem] border-2 border-destructive/25 bg-destructive/[0.04] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <span aria-hidden>🏷️</span>
                  {lang === "ne" ? "आजको छुट" : "Today's offers"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "ne"
                    ? "घटेको मूल्यमा — सकिनुअघि लिनुहोस्"
                    : "Reduced prices — while stocks last"}
                </p>
              </div>
              <span className="rounded-full bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">
                {onSaleToShow.length} {lang === "ne" ? "सामानमा छुट" : onSaleToShow.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {onSaleToShow.map((product) => (
                <ProductCard key={`sale-${product.id}`} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {featuredToShow.length > 0 ? (
        <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{copy.featuredTitle}</h2>
              <p className="text-sm text-muted-foreground">{copy.featuredDesc}</p>
            </div>
            <Link href="/catalog" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
              {copy.catalog} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featuredToShow.map((product) => (
              <ProductCard key={`featured-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
            <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
              <div className="min-h-[220px] bg-[linear-gradient(160deg,#f5ead8,#ead4ac)]">
                {shopPhoto ? (
                  <img src={shopPhoto} alt="Rajesh Shopping Center" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center">
                    <ShoppingBag className="h-16 w-16 text-primary/50" />
                  </div>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  <Star className="h-4 w-4" />
                  {copy.servingSince}
                </div>
                <h2 className="mt-4 text-3xl font-bold text-foreground">{settings?.shopName || "Rajesh Shopping Center"}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.story}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {copy.highlights.map((item) => (
                    <div key={item} className="rounded-2xl bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {/* A declared bonus period is only worth running if customers see
                it, so it sits above the notices. */}
            {rewardOffer.active ? (
              <div className="rounded-[2rem] border-2 border-violet-300 bg-violet-50 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">
                  {lang === "ne" ? "विशेष अफर" : "Special offer"}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-violet-950">
                  🎉 {rewardOffer.label
                    || (lang === "ne"
                      ? `${rewardOffer.multiplier}× पुरस्कार अंक`
                      : `${rewardOffer.multiplier}× reward points`)}
                </h3>
                <p className="mt-2 text-sm text-violet-900">
                  {lang === "ne"
                    ? `अहिले किनमेल गर्दा ${rewardOffer.multiplier} गुणा अंक पाइन्छ। अंक जम्मा गरेर पछि बिलमा छुट लिन सकिन्छ।`
                    : `Shop now and earn ${rewardOffer.multiplier}× the usual points. Points come off a future bill.`}
                </p>
                {rewardOffer.endsText ? (
                  <p className="mt-2 text-xs font-semibold text-violet-800">{rewardOffer.endsText}</p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{copy.notices}</p>
                  <h3 className="text-xl font-bold text-foreground">{copy.latestFromShop}</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {notices.length ? notices.map((notice: any, index: number) => (
                  <div key={`${notice.title || "notice"}-${index}`} className="rounded-2xl bg-muted/50 px-4 py-4">
                    <p className="font-semibold text-foreground">{notice.title || copy.notices}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{notice.body || notice.description || copy.defaultNotice}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
                    {copy.noNotice}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-foreground">{copy.partnerTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.partnerDesc}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">
              <h3 className="text-xl font-bold text-slate-900">Sandesh Hardware and Suppliers</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {lang === "ne"
                  ? "निर्माण सामग्री, हार्डवेयर, सिमेन्ट, रड, पाइप, फिटिङ र सप्लाइ सहयोगका लागि हाम्रो साझेदार व्यवसाय।"
                  : "Our partner business for hardware items, construction materials, cement, rods, pipes, fittings, and supply support."}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">
              <h3 className="text-xl font-bold text-slate-900">Sagar Shree Stores</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {lang === "ne"
                  ? "ग्राहकलाई थप सामान, सेवा र स्थानीय व्यापार सहयोग उपलब्ध गराउने हाम्रो साझेदार व्यवसाय।"
                  : "Our partner business helping customers with additional products, services, and local business support."}
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}


