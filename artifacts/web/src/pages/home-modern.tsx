import { Link } from "wouter";
import { useGetCategories, useGetProducts, useGetSettings } from "@workspace/api-client-react";
import { getImageUrl } from "@/lib/utils";
import { useLanguage } from "@/lib/language";
import { ProductCard } from "@/components/product-card";
import { CategoryIcon } from "@/components/category-icon";
import { ArrowRight, Megaphone, MessageCircle, Phone, ShoppingBag, Star, Truck } from "lucide-react";

const DEFAULT_SHOP_BANNER = "/shop-banner-default.jpeg";

export default function HomeModern() {
  const { lang } = useLanguage();
  const { data: settings, isLoading: loadingSettings } = useGetSettings();
  const { data: categories, isLoading: loadingCategories } = useGetCategories();
  const { data: featuredProducts, isLoading: loadingProducts } = useGetProducts({ featured: true });

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
  const categoriesToShow = visibleCategories.slice(0, 6);
  const featuredToShow = (featuredProducts ?? [])
    .filter((product) => !hiddenCustomerCategories.has((product.categoryName || "").trim().toLowerCase()))
    .slice(0, 4);
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
      <section className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <div className="overflow-hidden rounded-[1.35rem] border border-[#d69e10]/30 bg-[linear-gradient(135deg,#fff8ef_0%,#f7ecd9_44%,#ead0a2_100%)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.24)]">
          <div className="grid gap-0 lg:grid-cols-[1.55fr_0.45fr]">
            <div className="p-4 sm:p-4 lg:p-4">
              <div className="inline-flex rounded-full bg-[#0f3d7a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                {copy.easyOrder}
              </div>
              <h1 className="mt-2 text-xl font-bold leading-tight text-slate-950 sm:text-[1.65rem]">
                {lang === "ne" ? (settings?.shopName || "राजेश सिपिङ् सेन्टर") : "Rajesh Shopping Center"}
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-800">
                {copy.heroDesc}
              </p>

              <div className="mt-3 flex flex-wrap gap-2.5">
                <Link href="/catalog" className="inline-flex min-w-[190px] items-center justify-between gap-3 rounded-xl bg-[#d69e10] px-4 py-2.5 font-bold text-white shadow-[0_10px_20px_-14px_rgba(214,158,16,0.9)]">
                  <span>{copy.browseProducts}</span>
                  <ShoppingBag className="h-5 w-5" />
                </Link>
                <Link href="/book" className="inline-flex min-w-[190px] items-center justify-between gap-3 rounded-xl bg-[#0f3d7a] px-4 py-2.5 font-bold text-white shadow-[0_10px_20px_-16px_rgba(15,61,122,0.9)]">
                  <span>{copy.bookTransport}</span>
                  <Truck className="h-5 w-5" />
                </Link>
                <a href={`tel:${shopPhone}`} className="inline-flex min-w-[190px] items-center justify-between gap-3 rounded-xl border border-[#0f3d7a]/20 bg-white px-4 py-2.5 font-bold text-[#0f3d7a]">
                  <span>{lang === "ne" ? "अहिले फोन गर्नुहोस्" : "Call now"}</span>
                  <Phone className="h-5 w-5" />
                </a>
                <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" className="inline-flex min-w-[190px] items-center justify-between gap-3 rounded-xl bg-[#22c55e] px-4 py-2.5 font-bold text-white shadow-[0_10px_20px_-14px_rgba(34,197,94,0.8)]">
                  <span>{lang === "ne" ? "व्हाट्सएप" : "WhatsApp"}</span>
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="relative min-h-[132px] bg-[linear-gradient(160deg,#f2c14f,#a86d0f)] lg:min-h-full">
              {heroImage ? (
                <img src={heroImage} alt="Shop" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[132px] items-center justify-center">
                  <ShoppingBag className="h-10 w-10 text-white/85" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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

      {categoriesToShow.length > 0 ? (
        <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{copy.mainCategories}</h2>
              <p className="text-sm text-muted-foreground">{copy.oneTap}</p>
            </div>
            <Link href="/catalog" className="text-sm font-bold text-primary">
              {copy.all}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categoriesToShow.map((category) => (
              <Link key={category.id} href={`/catalog?category=${category.id}`} className="rounded-[1.5rem] border border-border bg-card px-4 py-5 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <CategoryIcon icon={category.icon} className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-bold text-foreground">{category.name}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}


