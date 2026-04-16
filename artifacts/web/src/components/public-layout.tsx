import { ReactNode, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Languages, Menu, ShoppingBag, Store, Truck, X } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

export function PublicLayout({
  children,
  onOwnerAccessRequest,
}: {
  children: ReactNode;
  onOwnerAccessRequest?: () => void;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const logoTapResetRef = useRef<number | null>(null);
  const [location] = useLocation();
  const { totalItems } = useCart();
  const { data: settings } = useGetSettings();
  const { t, lang, toggleLanguage } = useLanguage();

  const shopName = settings?.shopName || "Rajesh Shopping Center";

  const navLinks = [
    { href: "/catalog", label: t.nav.catalog, icon: Store },
    { href: "/book", label: t.nav.transport, icon: Truck },
    { href: "/about", label: t.nav.about, icon: Info },
  ];

  const handleLogoSecretTap = () => {
    if (!onOwnerAccessRequest) return;
    const next = logoTapCount + 1;
    setLogoTapCount(next);
    if (next >= 5) {
      setLogoTapCount(0);
      onOwnerAccessRequest();
      return;
    }
    if (logoTapResetRef.current) {
      window.clearTimeout(logoTapResetRef.current);
    }
    logoTapResetRef.current = window.setTimeout(() => {
      setLogoTapCount(0);
    }, 2200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="bg-primary text-primary-foreground py-2 px-4 text-xs sm:text-sm font-medium">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span>{t.nav.established}</span>
          <div className="hidden sm:flex gap-4">
            {settings?.phone && <span>{t.nav.call} {settings.phone}</span>}
            {settings?.email && <span>{settings.email}</span>}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link
              href="/"
              className="flex items-center gap-2 group outline-none"
              onClick={() => handleLogoSecretTap()}
            >
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-accent-foreground shadow-inner group-hover:scale-105 transition-transform duration-300">
                <Store className="w-6 h-6" />
              </div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-primary tracking-tight">
                {shopName}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-semibold transition-colors hover:text-accent outline-none",
                    location === link.href ? "text-accent" : "text-foreground/80"
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-foreground/70 hover:border-primary hover:text-primary transition-all"
                title={lang === "ne" ? "Switch to English" : "नेपालीमा जानुहोस्"}
              >
                <Languages className="w-3.5 h-3.5" />
                {lang === "ne" ? "EN" : "ने"}
              </button>

              <Link
                href="/cart"
                className="relative p-2 text-foreground hover:text-accent transition-colors outline-none flex items-center gap-2 bg-secondary rounded-full px-4 py-2 hover:bg-secondary/80"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="font-bold text-sm">{t.nav.cart}</span>
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </nav>

            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border border-border text-foreground/70 hover:border-primary hover:text-primary transition-all"
                title={lang === "ne" ? "Switch to English" : "नेपालीमा जानुहोस्"}
              >
                <Languages className="w-3 h-3" />
                {lang === "ne" ? "EN" : "ने"}
              </button>
              <Link href="/cart" className="relative p-2 text-foreground outline-none">
                <ShoppingBag className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md">
                    {totalItems}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-foreground hover:text-primary transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-background overflow-hidden"
            >
              <nav className="flex flex-col px-4 py-6 gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-colors",
                      location === link.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-muted"
                    )}
                  >
                    <link.icon className="w-5 h-5 opacity-70" />
                    {link.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <footer className="bg-primary text-primary-foreground py-12 mt-auto border-t-[8px] border-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Store className="w-6 h-6 text-accent" />
              <span className="font-serif text-xl font-bold">{shopName}</span>
            </div>
            <p className="text-primary-foreground/80 leading-relaxed max-w-sm">
              {t.nav.servingCommunity}
            </p>
          </div>

          <div>
            <h3 className="font-serif text-lg font-bold mb-6 text-accent">{t.nav.quickLinks}</h3>
            <ul className="space-y-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/80 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg font-bold mb-6 text-accent">{t.nav.contactLocation}</h3>
            <ul className="space-y-4 text-primary-foreground/80">
              <li>{settings?.address || "मुसिकोट–५, आपचौर, गुल्मी"}</li>
              {settings?.phone && <li>{t.nav.phone} {settings.phone}</li>}
              <li>{lang === "ne" ? "पान नं." : "PAN No."} {(settings as any)?.panNumber || "३०२९५१८१७"}</li>
              {settings?.email && <li>{t.nav.email} {settings.email}</li>}
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-primary-foreground/10 text-center text-primary-foreground/60 text-sm">
          &copy; {new Date().getFullYear()} {shopName}. {t.nav.allRightsReserved}
        </div>
      </footer>
    </div>
  );
}
