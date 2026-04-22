import { ReactNode, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, Grid2x2, Home, Info, Languages, Menu, PackageSearch, Search, Share2, ShoppingBag, Truck, X } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { INSTALL_APP_EVENT, InstallAppBanner } from "@/components/install-app-banner";
import { GaneshBlessing } from "@/components/ganesh-blessing";
import { NepalDateTime } from "@/components/nepal-date-time";

export function PublicLayoutModern({
  children,
  onOwnerAccessRequest,
}: {
  children: ReactNode;
  onOwnerAccessRequest?: () => void;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [shareFeedback, setShareFeedback] = useState("");
  const logoTapResetRef = useRef<number | null>(null);
  const shareFeedbackResetRef = useRef<number | null>(null);
  const [location] = useLocation();
  const { totalItems } = useCart();
  const { data: settings } = useGetSettings();
  const { t, lang, toggleLanguage } = useLanguage();

  const shopName = settings?.shopName || "Rajesh Shopping Center";
  const facebookUrl = "https://www.facebook.com/anpchaurpiplarukhaGulmi/";
  const tiktokUrl = "https://www.tiktok.com/@rajeshshoppingcenter";
  const homeLabel = lang === "ne" ? "होम" : "Home";

  const trackLabel = lang === "ne" ? "अर्डर ट्र्याक" : "Track Order";

  const navLinks = [
    { href: "/", label: homeLabel, icon: Home },
    { href: "/catalog", label: t.nav.catalog, icon: Grid2x2 },
    { href: "/book", label: t.nav.transport, icon: Truck },
    { href: "/track", label: trackLabel, icon: PackageSearch },
    { href: "/about", label: t.nav.about, icon: Info },
  ];

  const termsLabel = lang === "ne" ? "सेवाका सर्तहरू" : "Terms of Service";
  const accountLabel = lang === "ne" ? "मेरो खाता" : "My Account";
  const downloadAppLabel = lang === "ne" ? "एप डाउनलोड" : "Download app";

  const handleLogoSecretTap = () => {
    if (!onOwnerAccessRequest) return;
    const next = logoTapCount + 1;
    setLogoTapCount(next);
    if (next >= 5) {
      setLogoTapCount(0);
      onOwnerAccessRequest();
      return;
    }
    if (logoTapResetRef.current) window.clearTimeout(logoTapResetRef.current);
    logoTapResetRef.current = window.setTimeout(() => setLogoTapCount(0), 2200);
  };

  const handleDownloadApp = () => {
    window.dispatchEvent(new Event(INSTALL_APP_EVENT));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#fffdf9_0%,#f5ede1_100%)]">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 outline-none" onClick={handleLogoSecretTap}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src="/rajesh-logo.png" alt="Rajesh Shopping Center logo" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-bold text-primary sm:text-xl">{shopName}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">{settings?.phone || "+9779814401716"}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-3 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold outline-none transition-colors",
                  location === link.href ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground/70 transition-all hover:border-primary hover:text-primary"
              title={lang === "ne" ? "Switch to English" : "Switch to Nepali"}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "ne" ? "EN" : "ने"}
            </button>
            <button
              onClick={handleDownloadApp}
              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 transition-all hover:border-amber-400 hover:bg-amber-100"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadAppLabel}
            </button>
            <Link href="/cart" className="relative flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-foreground outline-none transition-colors hover:bg-secondary/80 hover:text-accent">
              <ShoppingBag className="h-5 w-5" />
              <span className="text-sm font-bold">{t.nav.cart}</span>
              {totalItems > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow-md">
                  {totalItems}
                </span>
              ) : null}
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground/70 transition-all hover:border-primary hover:text-primary"
              title={lang === "ne" ? "Switch to English" : "Switch to Nepali"}
            >
              <Languages className="h-3 w-3" />
              {lang === "ne" ? "EN" : "ने"}
            </button>
            <Link href="/cart" className="relative rounded-full bg-secondary p-2.5 text-foreground outline-none">
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 ? (
                <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {totalItems}
                </span>
              ) : null}
            </Link>
            <button onClick={() => setIsMobileMenuOpen((value) => !value)} className="rounded-full bg-card p-2.5 text-foreground" aria-label="Toggle menu">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-background md:hidden"
            >
              <nav className="space-y-3 px-4 py-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold",
                      location === link.href ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                    )}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleDownloadApp();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-base font-bold text-amber-950"
                >
                  <Download className="h-5 w-5" />
                  {downloadAppLabel}
                </button>
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1 pb-24 md:pb-0">
        <div className="pt-3">
          <InstallAppBanner />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <div className="grid items-center gap-3 overflow-hidden rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8ef_0%,#f4e0ba_100%)] px-4 py-3 shadow-sm lg:grid-cols-[0.9fr_1.3fr_0.9fr]">
            <div className="flex h-12 items-center justify-center rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-3 text-center text-sm font-bold leading-tight text-amber-50 shadow-sm sm:h-14 sm:text-base">
              ॐ श्री गणेशाय नमः
            </div>
            <div className="flex items-center justify-center">
              <img
                src="/ganesh-banner.png"
                alt="Shree Ganesh"
                className="h-14 w-full max-w-[420px] rounded-[1rem] object-cover shadow-sm sm:h-16"
              />
            </div>
            <NepalDateTime lang={lang} compact />
          </div>
        </div>
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/96 px-3 pb-3 pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
          {[
            { href: "/", label: homeLabel, icon: Home },
            { href: "/catalog", label: t.nav.catalog, icon: Search },
            { href: "/book", label: t.nav.transport, icon: Truck },
            { href: "/track", label: trackLabel, icon: PackageSearch },
            { href: "/cart", label: t.nav.cart, icon: ShoppingBag, badge: totalItems },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold",
                location === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
              {item.badge ? (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      <footer className="mt-auto border-t-[6px] border-accent bg-primary py-10 text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <img src="/rajesh-logo.png" alt="Rajesh Shopping Center logo" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/20" />
              <span className="font-serif text-xl font-bold">{shopName}</span>
            </div>
            <p className="max-w-sm text-sm leading-6 text-primary-foreground/80">{t.nav.servingCommunity}</p>
          </div>
          <div>
            <h3 className="mb-4 font-serif text-lg font-bold text-accent">{t.nav.quickLinks}</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/80">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/account" className="transition-colors hover:text-white">
                  {accountLabel}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  {termsLabel}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-serif text-lg font-bold text-accent">{t.nav.contactLocation}</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/80">
              <li>{settings?.address || "मुसिकोट–५, आपचौर, गुल्मी"}</li>
              {settings?.phone ? <li>{t.nav.phone} {settings.phone}</li> : null}
              <li>{lang === "ne" ? "पान नं." : "PAN No."} {(settings as any)?.panNumber || "३०२९५१८१७"}</li>
              {settings?.email ? <li>{t.nav.email} {settings.email}</li> : null}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Facebook
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                TikTok
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
