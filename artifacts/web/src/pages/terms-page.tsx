import type { ReactNode } from "react";
import { AlertTriangle, BadgeCheck, CreditCard, MapPin, ReceiptText, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language";

type Section = {
  title: string;
  body: string[];
};

export default function TermsPage() {
  const { lang } = useLanguage();
  const { data: settings } = useGetSettings();

  const shopName = settings?.shopName || "Rajesh Shopping Center";
  const shopAddress = settings?.address || "Musikot-5, Aapchaur, Gulmi, Nepal";
  const primaryPhone = settings?.phone || "+9779814401716";
  const proprietorName = String((settings as any)?.proprietorName || "Sandesh Kharal");
  const secondaryOwner = "Yubraj Kharel";
  const secondaryPhone = "9819499002";
  const effectiveDate = "April 16, 2026";

  const intro =
    lang === "ne"
      ? `यी सेवा सर्तहरू ${shopName} बाट वस्तु, डेलिभरी, हार्डवेयर, भुक्तानी सहयोग, र सम्बन्धित सेवाहरू प्रयोग गर्ने ग्राहकहरूमा लागू हुन्छन्। सेवा प्रयोग गर्दा तपाईं यी सर्तहरू मान्न सहमत हुनुहुन्छ।`
      : `These Terms of Service apply to customers who buy goods or use delivery, hardware, transport, payment-support, or related services from ${shopName}. By using our services, you agree to these terms.`;

  const sections: Array<{ icon: ReactNode; section: Section }> =
    lang === "ne"
      ? [
          {
            icon: <BadgeCheck className="h-5 w-5" />,
            section: {
              title: "१. हाम्रो सेवा",
              body: [
                "हामी किराना, तरकारी, फलफूल, हार्डवेयर, घरायसी सामान, डेलिभरी, यातायात सहयोग, र केही भुक्तानी/रेमिटेन्स सहयोग सेवा उपलब्ध गराउँछौं।",
                "सबै सेवा उपलब्धता, मौसम, सडक अवस्था, स्टक, र स्थानीय सञ्चालन अवस्थाका आधारमा फरक हुन सक्छन्।",
              ],
            },
          },
          {
            icon: <ReceiptText className="h-5 w-5" />,
            section: {
              title: "२. अर्डर र पुष्टि",
              body: [
                "अर्डर राखेपछि फोन, वेबसाइट, वा प्रत्यक्ष पुष्टि हुन सक्छ। पुष्टि नभएसम्म अर्डर अन्तिम मानिने छैन।",
                "गलत फोन नम्बर, गलत ठेगाना, वा गलत वस्तु विवरणका कारण भएको ढिलाइ वा असफल डेलिभरीका लागि ग्राहक जिम्मेवार हुन सक्छ।",
              ],
            },
          },
          {
            icon: <CreditCard className="h-5 w-5" />,
            section: {
              title: "३. मूल्य र भुक्तानी",
              body: [
                "मूल्य नेपाली रुपैयाँ (NPR) मा हुन्छ र बजार अवस्था, ढुवानी खर्च, वा स्टक परिवर्तनका कारण बदलिन सक्छ।",
                "स्पष्ट गल्ती, टाइप त्रुटि, वा सिस्टम त्रुटिका कारण गलत मूल्य देखिएमा हामी अर्डर सच्याउन, पुनः पुष्टि गर्न, वा रद्द गर्न सक्छौं।",
                "उधारो, आंशिक भुक्तानी, डिजिटल भुक्तानी, वा बैंक भुक्तानी स्वीकार गर्दा प्रमाण वा सन्दर्भ माग्न सकिन्छ।",
              ],
            },
          },
          {
            icon: <Truck className="h-5 w-5" />,
            section: {
              title: "४. डेलिभरी र यातायात सेवा",
              body: [
                "डेलिभरी समय अनुमानित मात्र हो। मौसम, सडक, बन्द, इन्धन, गाडी उपलब्धता, वा अन्य स्थानीय कारणले ढिलाइ हुन सक्छ।",
                "बोलेरो, ट्र्याक्टर, वा अन्य यातायात सेवा बुक गर्दा दूरी, लोड, बाटोको अवस्था, र पर्खाइ समय अनुसार शुल्क बदलिन सक्छ।",
                "ग्राहक वा प्राप्तकर्ताको अनुपस्थितिका कारण फिर्ता यात्रा, अतिरिक्त पर्खाइ, वा पुनः डेलिभरी शुल्क लाग्न सक्छ।",
              ],
            },
          },
          {
            icon: <RefreshCcw className="h-5 w-5" />,
            section: {
              title: "५. फिर्ता, साटफेर, र गुनासो",
              body: [
                "खराब, बिग्रिएको, गलत, वा नपुगेको सामान भए सकेसम्म छिटो, राम्रो भएमा २४ घण्टा भित्र जानकारी दिनुहोस्।",
                "छिट्टै बिग्रिने वस्तु, खुलेको प्याकेट, प्रयोग गरिएको सामान, तम्बाकु, मदिरा, वा ग्राहकको कारणले बिग्रिएको सामान फिर्ता नहुन सक्छ।",
                "योग्य अवस्थामा मात्र साटफेर, आंशिक समायोजन, स्टोर क्रेडिट, वा फिर्ता रकम दिन सकिन्छ। अन्तिम निर्णय परिस्थितिअनुसार हुनेछ।",
              ],
            },
          },
          {
            icon: <ShieldCheck className="h-5 w-5" />,
            section: {
              title: "६. ग्राहकको जिम्मेवारी",
              body: [
                "सही नाम, फोन, ठेगाना, अर्डर विवरण, र भुक्तानी जानकारी दिनु ग्राहकको जिम्मेवारी हो।",
                "गालीगलौज, ठगी, नक्कली भुक्तानी दाबी, गलत अर्डर, वा स्टाफलाई धम्की दिने व्यवहारमा सेवा रोक्न सकिन्छ।",
              ],
            },
          },
          {
            icon: <AlertTriangle className="h-5 w-5" />,
            section: {
              title: "७. सीमित जिम्मेवारी",
              body: [
                "कानुनले अनुमति दिएको हदसम्म, अप्रत्यक्ष नोक्सानी, नाफा घाटा, व्यापार घाटा, वा तेस्रो पक्षको ढिलाइका लागि हामी जिम्मेवार हुने छैनौं।",
                "हाम्रो जिम्मेवारी सामान्यतया सम्बन्धित अर्डर वा सेवाको वास्तविक तिरेको रकमसम्म सीमित हुनेछ।",
              ],
            },
          },
          {
            icon: <MapPin className="h-5 w-5" />,
            section: {
              title: "८. लागू स्थान र विवाद समाधान",
              body: [
                `यी सर्तहरू ${shopAddress} मा सञ्चालन हुने व्यवसायका लागि लागू हुन्छन्।`,
                "समस्या वा गुनासो भए पहिले फोन वा प्रत्यक्ष सम्पर्कबाट मिलाएर समाधान गर्ने प्रयास गरिनेछ। समाधान नभए स्थानीय रूपमा लागू हुने कानुन अनुसार विषय हेरिनेछ।",
              ],
            },
          },
        ]
      : [
          {
            icon: <BadgeCheck className="h-5 w-5" />,
            section: {
              title: "1. Our Services",
              body: [
                "We provide groceries, vegetables, fruits, hardware items, household goods, delivery support, transport booking, and some payment-support services.",
                "All services are subject to availability, weather, road access, stock, local operating conditions, and practical limitations in rural service areas.",
              ],
            },
          },
          {
            icon: <ReceiptText className="h-5 w-5" />,
            section: {
              title: "2. Orders and Confirmation",
              body: [
                "Orders may be placed through the website, phone, or direct contact. An order is not final until it is accepted or confirmed by our business.",
                "Customers are responsible for correct phone numbers, addresses, item details, and delivery instructions.",
              ],
            },
          },
          {
            icon: <CreditCard className="h-5 w-5" />,
            section: {
              title: "3. Pricing and Payment",
              body: [
                "All prices are in Nepali Rupees (NPR) and may change due to supplier price changes, transport cost, stock conditions, or market conditions.",
                "If a price is shown incorrectly because of a typing mistake, technical issue, or system error, we may correct, reconfirm, or cancel the order.",
                "For credit, partial payment, digital wallet, or bank transfer transactions, we may require proof of payment or reference details before releasing goods or confirming service.",
              ],
            },
          },
          {
            icon: <Truck className="h-5 w-5" />,
            section: {
              title: "4. Delivery and Transport Services",
              body: [
                "Delivery times are estimates only. Delays may happen because of weather, road conditions, strikes, fuel issues, vehicle availability, or other local causes.",
                "Bolero, tractor, and transport bookings may be priced or adjusted based on distance, load, terrain, road access, waiting time, and actual service conditions.",
                "If the customer or recipient is unavailable, extra waiting, return-trip, or re-delivery charges may apply.",
              ],
            },
          },
          {
            icon: <RefreshCcw className="h-5 w-5" />,
            section: {
              title: "5. Returns, Replacements, and Complaints",
              body: [
                "Please report damaged, missing, incorrect, or spoiled items as soon as possible, preferably within 24 hours of delivery or collection.",
                "Perishable goods, opened packets, used items, tobacco, alcohol, and goods damaged after delivery may not be returnable.",
                "Where appropriate, we may offer replacement, store credit, partial adjustment, or refund depending on the situation and proof available.",
              ],
            },
          },
          {
            icon: <ShieldCheck className="h-5 w-5" />,
            section: {
              title: "6. Customer Responsibilities",
              body: [
                "Customers must provide accurate names, contact details, delivery addresses, and payment information.",
                "We may refuse service in cases of abuse, threats, fraud, fake payment claims, repeated false orders, or unsafe conduct toward our staff or drivers.",
              ],
            },
          },
          {
            icon: <AlertTriangle className="h-5 w-5" />,
            section: {
              title: "7. Limited Liability",
              body: [
                "To the extent allowed by law, we are not responsible for indirect loss, loss of profit, business interruption, or delays caused by third parties or local conditions outside our control.",
                "Our maximum liability will normally be limited to the amount actually paid for the relevant order or service.",
              ],
            },
          },
          {
            icon: <MapPin className="h-5 w-5" />,
            section: {
              title: "8. Governing Location and Disputes",
              body: [
                `These terms apply to services provided from ${shopAddress}.`,
                "If a complaint arises, both sides should first try to resolve it directly with the business by phone or in person. If not resolved, the matter will follow applicable local law and authority processes.",
              ],
            },
          },
        ];

  return (
    <div className="pb-20">
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-accent">
            {lang === "ne" ? "सेवा सर्तहरू" : "Terms of Service"}
          </p>
          <h1 className="font-serif text-4xl font-bold sm:text-5xl">
            {lang === "ne" ? `${shopName} का ग्राहक सेवा सर्तहरू` : `${shopName} Customer Terms of Service`}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-primary-foreground/85 sm:text-lg">
            {intro}
          </p>
          <p className="mt-5 text-sm text-primary-foreground/70">
            {lang === "ne" ? "लागू मिति" : "Effective date"}: {effectiveDate}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-6 text-slate-700 shadow-sm">
          <strong className="text-slate-900">{lang === "ne" ? "सम्पर्क" : "Contact"}:</strong>{" "}
          {proprietorName} ({primaryPhone}) | {secondaryOwner} ({secondaryPhone})
        </div>

        <div className="mt-8 grid gap-6">
          {sections.map(({ icon, section }) => (
            <article key={section.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3 text-slate-900">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {icon}
                </div>
                <h2 className="font-serif text-2xl font-bold">{section.title}</h2>
              </div>
              <div className="space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-6 py-6 text-sm leading-7 text-slate-700">
          <p>
            {lang === "ne"
              ? "हामी समय अनुसार यी सर्तहरू अद्यावधिक गर्न सक्छौं। वेबसाइट वा पसलमा राखिएको नयाँ संस्करण नै लागू हुनेछ।"
              : "We may update these terms from time to time. The latest version posted on our website or at our business location will apply."}
          </p>
        </div>
      </section>
    </div>
  );
}
