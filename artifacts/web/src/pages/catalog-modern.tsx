import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useGetCategories, useGetProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { CategoryIcon } from "@/components/category-icon";
import { Search, SlidersHorizontal, Store } from "lucide-react";
import { useLanguage } from "@/lib/language";

export default function CatalogModern() {
  const { lang } = useLanguage();
  // Read through the router rather than window.location. Arriving from a
  // category chip on the home screen, wouter has not finished pushing the query
  // string when this first renders, so reading window.location directly left
  // the filter silently unapplied — the customer tapped किराना and got
  // everything.
  const search = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(search), [search]);

  const [searchTerm, setSearchTerm] = useState(() => urlParams.get("search") ?? "");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(() => {
    const value = urlParams.get("category");
    return value ? Number(value) : null;
  });

  // Keep the filters in step with the URL. Local changes (typing, tapping a
  // filter button) still work — this only re-syncs when the URL itself moves.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const category = params.get("category");
    setSearchTerm(params.get("search") ?? "");
    setSelectedCategory(category ? Number(category) : null);
  }, [search]);
  const { data: products, isLoading: loadingProducts, isError: productsFailed, refetch: refetchProducts } = useGetProducts();
  const { data: categories, isLoading: loadingCategories } = useGetCategories();
  const visibleCategories = useMemo(
    () => (categories ?? []).filter((category) => category.name.trim().toLowerCase() !== "general"),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((product) => {
      const matchesCategory = selectedCategory ? product.categoryId === selectedCategory : true;
      const text = `${product.name} ${product.description || ""}`.toLowerCase();
      const matchesSearch = text.includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="rounded-[2rem] bg-card p-5 shadow-sm ring-1 ring-border">
        <h1 className="text-3xl font-bold text-foreground">{lang === "ne" ? "क्याटलग" : "Catalog"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "ne" ? "सजिलै सामान खोज्नुहोस् र कार्टमा थप्नुहोस्" : "Search products quickly and add them to cart"}
        </p>

        <div className="mt-5">
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={lang === "ne" ? "सामान खोज्नुहोस्" : "Search products"}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {lang === "ne" ? "श्रेणी छान्नुहोस्" : "Choose a category"}
            </p>
          </div>
          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-2xl px-4 py-4 text-left font-semibold ${selectedCategory === null ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"}`}
              >
                {lang === "ne" ? "सबै सामान" : "All products"}
              </button>
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-left font-semibold ${selectedCategory === category.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"}`}
                >
                  <CategoryIcon icon={category.icon} className="h-5 w-5" />
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        {loadingProducts ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[300px] animate-pulse rounded-[1.5rem] bg-muted"></div>
            ))}
          </div>
        ) : productsFailed ? (
          <div className="rounded-[2rem] border border-dashed border-border bg-card px-6 py-14 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">
              {lang === "ne" ? "सामान देखाउन सकिएन" : "Could not load products"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ne"
                ? "इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।"
                : "Please check your internet connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => void refetchProducts()}
              className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              {lang === "ne" ? "फेरि प्रयास गर्नुहोस्" : "Try again"}
            </button>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-border bg-card px-6 py-14 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">{lang === "ne" ? "सामान भेटिएन" : "No products found"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ne" ? "खोज शब्द वा श्रेणी परिवर्तन गरेर फेरि हेर्नुहोस्" : "Try another search or category filter"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

