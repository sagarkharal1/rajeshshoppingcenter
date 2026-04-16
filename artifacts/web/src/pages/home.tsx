import { Link } from "wouter";
import { useGetSettings, useGetCategories, useGetProducts } from "@workspace/api-client-react";
import { getImageUrl } from "@/lib/utils";
import { useLanguage } from "@/lib/language";
import { ProductCard } from "@/components/product-card";
import { CategoryIcon } from "@/components/category-icon";
import { motion } from "framer-motion";
import { ArrowRight, Truck, Package, Clock, Phone, Store } from "lucide-react";

export default function Home() {
  const { t } = useLanguage();
  const { data: settings, isLoading: loadingSettings } = useGetSettings();
  const { data: categories, isLoading: loadingCats } = useGetCategories();
  const { data: featuredProducts, isLoading: loadingProducts } = useGetProducts({ featured: true });

  if (loadingSettings || loadingCats || loadingProducts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const shopPhoto = getImageUrl(settings?.shopPhotoPath);
  const ownerPhoto = getImageUrl(settings?.ownerPhotoPath);
  const homeBanner = getImageUrl((settings as any)?.homeBannerPath) || shopPhoto;
  const announcements = Array.isArray((settings as any)?.announcements)
    ? (settings as any).announcements.filter((item: any) => item?.status !== "draft")
    : [];
  const featuredMedia = Array.isArray((settings as any)?.featuredMedia)
    ? (settings as any).featuredMedia.filter((item: any) => item?.status !== "draft")
    : [];

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        {homeBanner ? (
          <>
            <div className="absolute inset-0 z-0">
              <img src={homeBanner} alt="Shop exterior" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-primary/90 to-primary/40"></div>
          </>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary to-primary/80">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          </div>
        )}

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <span className="inline-block py-1 px-3 rounded-full bg-accent/20 text-accent font-bold text-sm tracking-wider mb-6 border border-accent/30 backdrop-blur-sm">
              {t.home.established}
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight">
              {t.home.heroTitle1} <br /><span className="text-accent">{t.home.heroTitle2}</span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed">
              {t.home.heroDesc}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/catalog"
                className="px-8 py-4 rounded-xl font-bold bg-accent text-accent-foreground shadow-lg shadow-black/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              >
                {t.home.shopCatalog}
              </Link>
              <Link
                href="/book"
                className="px-8 py-4 rounded-xl font-bold bg-white/10 text-white backdrop-blur-md border border-white/20 shadow-lg shadow-black/10 hover:bg-white/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              >
                {t.home.bookTransport}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground">{t.home.contactTitle}</h2>
                <p className="mt-2 text-muted-foreground">
                  {t.nav.about}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {announcements.slice(0, 6).map((item: any, index: number) => (
                <article key={`${item.title}-${index}`} className="overflow-hidden rounded-3xl border border-border bg-muted/20">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.title || "announcement"} className="h-44 w-full object-cover" /> : null}
                  <div className="p-5">
                    {item.type ? <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accent">{item.type}</span> : null}
                    <h3 className="mt-3 text-xl font-serif font-bold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Banner */}
      <section className="bg-white border-b border-border shadow-sm relative z-30 -mt-8 mx-4 sm:mx-8 max-w-7xl lg:mx-auto rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t.home.vastCatalog}</h3>
              <p className="text-sm text-muted-foreground">{t.home.vastCatalogDesc}</p>
            </div>
          </div>
          <div className="p-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t.home.heavyTransport}</h3>
              <p className="text-sm text-muted-foreground">{t.home.heavyTransportDesc}</p>
            </div>
          </div>
          <div className="p-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t.home.trustedSince}</h3>
              <p className="text-sm text-muted-foreground">{t.home.trustedSinceDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-serif font-bold text-foreground">{t.home.shopByCategory}</h2>
              <p className="text-muted-foreground mt-2">{t.home.shopByCategoryDesc}</p>
            </div>
            <Link href="/catalog" className="hidden sm:flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
              {t.home.viewAll} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((cat, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={cat.id}
              >
                <Link
                  href={`/catalog?category=${cat.id}`}
                  className="group block bg-card rounded-2xl p-6 text-center shadow-sm border border-border hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                >
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:bg-primary/5 transition-all">
                     <CategoryIcon icon={cat.icon} className="h-8 w-8" />
                    </div>
                  <h3 className="font-bold text-foreground">{cat.name}</h3>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground">{t.home.featuredProducts}</h2>
                <p className="text-muted-foreground mt-2">{t.home.featuredProductsDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {featuredProducts.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {featuredMedia.length > 0 && (
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl font-serif font-bold text-foreground">{t.home.featuredProducts}</h2>
            <p className="mt-2 text-muted-foreground">{t.home.featuredProductsDesc}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {featuredMedia.slice(0, 4).map((item: any, index: number) => (
              <article key={`${item.title}-${index}`} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                {item.mediaType === "video" ? (
                  <video src={item.url} controls className="h-72 w-full object-cover" />
                ) : (
                  <img src={item.url} alt={item.title || "featured media"} className="h-72 w-full object-cover" />
                )}
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground">{item.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Quick About & Contact */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-primary rounded-3xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 md:p-16 flex flex-col justify-center text-white">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{t.home.contactTitle}</h2>
              <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
                {t.home.contactDesc}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                <a
                  href={`tel:${settings?.phone}`}
                  className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-accent text-accent-foreground font-bold hover:bg-accent/90 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  {t.home.callUs} {settings?.phone || ""}
                </a>
                <Link
                  href="/about"
                  className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                >
                  {t.home.readStory}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[300px] lg:min-h-full">
              {ownerPhoto ? (
                <img src={ownerPhoto} alt="Store Owner" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-primary-foreground/10 flex items-center justify-center">
                  <Store className="w-24 h-24 text-white/20" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
