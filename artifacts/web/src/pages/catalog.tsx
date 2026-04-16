import { useState, useMemo } from "react";
import { useGetProducts, useGetCategories } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language";
import { ProductCard } from "@/components/product-card";
import { CategoryIcon } from "@/components/category-icon";
import { Search, Filter, X, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Catalog() {
  const { t } = useLanguage();
  const urlParams = new URLSearchParams(window.location.search);
  const initialCat = urlParams.get("category");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    initialCat ? parseInt(initialCat) : null
  );
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const { data: allProducts, isLoading: loadingProducts } = useGetProducts();
  const { data: categories, isLoading: loadingCats } = useGetCategories();

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCat = selectedCategory ? p.categoryId === selectedCategory : true;
      return matchesSearch && matchesCat;
    });
  }, [allProducts, searchTerm, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">{t.catalog.title}</h1>
          <p className="text-muted-foreground mt-2">{t.catalog.subtitle}</p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder={t.catalog.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Mobile Filter Toggle */}
        <button
          className="lg:hidden flex items-center justify-center gap-2 w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-bold"
          onClick={() => setIsMobileFilterOpen(true)}
        >
          <Filter className="w-5 h-5" /> {t.catalog.filterByCategory}
        </button>

        {/* Sidebar / Filters */}
        <aside className={`
          lg:w-64 shrink-0 
          ${isMobileFilterOpen ? 'fixed inset-0 z-50 bg-background p-6 overflow-y-auto' : 'hidden lg:block'}
        `}>
          <div className="flex items-center justify-between lg:hidden mb-6">
            <h2 className="text-xl font-bold font-serif">{t.catalog.filters}</h2>
            <button onClick={() => setIsMobileFilterOpen(false)} className="p-2 bg-muted rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="sticky top-28">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 hidden lg:block">
              {t.catalog.categories}
            </h3>

            {loadingCats ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : (
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => { setSelectedCategory(null); setIsMobileFilterOpen(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${
                      selectedCategory === null
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {t.catalog.allProducts}
                  </button>
                </li>
                {categories?.map((cat) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => { setSelectedCategory(cat.id); setIsMobileFilterOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium flex items-center gap-3 ${
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <CategoryIcon icon={cat.icon} className="h-5 w-5" />
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-[400px] bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border">
              <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-foreground mb-2 font-serif">{t.catalog.noProducts}</h3>
              <p className="text-muted-foreground">{t.catalog.noProductsDesc}</p>
              {(searchTerm || selectedCategory) && (
                <button
                  onClick={() => { setSearchTerm(""); setSelectedCategory(null); }}
                  className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
                >
                  {t.catalog.clearFilters}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
