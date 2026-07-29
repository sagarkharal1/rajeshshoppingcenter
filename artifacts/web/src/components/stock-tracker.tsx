"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, TrendingDown, TrendingUp, Package } from "lucide-react";
import { LoadError } from "@/components/load-error";

interface Product {
  id: number;
  name: string;
  stockQuantity: number;
  reorderLevel?: number;
  categoryName?: string;
  imageUrl?: string;
}

interface StockHistory {
  date: string;
  quantity: number;
  change: number;
  reason: string;
}

interface StockTrackerProps {
  products: Product[];
  lang?: "en" | "ne";
  api?: (url: string, opts?: any) => Promise<any>;
}

const labels = {
  en: {
    title: "Stock Status",
    inStock: "In Stock",
    lowStock: "Low Stock",
    outOfStock: "Out of Stock",
    quantity: "Quantity",
    reorderLevel: "Reorder Level",
    history: "Stock History",
    noHistory: "No stock history",
    alerts: "Low Stock Alerts",
    noAlerts: "All stock levels healthy",
    suggestedReorder: "Suggested Reorder",
    lastUpdated: "Last Updated",
  },
  ne: {
    title: "स्टक स्थिति",
    inStock: "स्टकमा छ",
    lowStock: "कम स्टक",
    outOfStock: "स्टक खत्म",
    quantity: "मात्रा",
    reorderLevel: "पुनः अर्डर स्तर",
    history: "स्टक इतिहास",
    noHistory: "कुनै स्टक इतिहास छैन",
    alerts: "कम स्टक सूचनाहरू",
    noAlerts: "सबै स्टक स्तर स्वस्थ छन्",
    suggestedReorder: "सुझाव पुनः अर्डर",
    lastUpdated: "अन्तिम अपडेट",
  },
};

export function StockTracker({ products, lang = "en", api }: StockTrackerProps) {
  const dict = labels[lang];
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [stockHistories, setStockHistories] = useState<Record<number, StockHistory[]>>({});
  const [historyFailedFor, setHistoryFailedFor] = useState<number | null>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  // Categorize products by stock status
  const getStockStatus = (product: Product) => {
    const reorderLevel = product.reorderLevel || 10;
    if (product.stockQuantity <= 0) return "out";
    if (product.stockQuantity <= reorderLevel) return "low";
    return "good";
  };

  const inStockProducts = products.filter((p) => getStockStatus(p) === "good");
  const lowStockProducts = products.filter((p) => getStockStatus(p) === "low");
  const outOfStockProducts = products.filter((p) => getStockStatus(p) === "out");

  // Fetch stock history for a product
  useEffect(() => {
    const fetchHistory = async () => {
      if (!expandedProductId) return;

      setHistoryFailedFor(null);
      try {
        const path = `/admin/products/${expandedProductId}/stock-history`;
        const data = api
          ? await api(path)
          : await fetch(`/api${path}`).then((response) => {
              if (!response.ok) throw new Error("Failed to load stock history");
              return response.json();
            });
        if (data) {
          setStockHistories((prev) => ({
            ...prev,
            [expandedProductId]: data.history || [],
          }));
        }
      } catch (err) {
        console.error("Failed to fetch stock history:", err);
        setHistoryFailedFor(expandedProductId);
      }
    };

    fetchHistory();
  }, [expandedProductId, api, historyReloadKey]);

  const StockCard = ({ product }: { product: Product }) => {
    const status = getStockStatus(product);
    const reorderLevel = product.reorderLevel || 10;
    const suggestedQty = Math.max(30, reorderLevel * 3);

    const statusConfig = {
      good: {
        icon: Package,
        label: dict.inStock,
        color: "bg-green-50 border-green-200",
        textColor: "text-green-900",
        badgeColor: "bg-green-100 text-green-700",
      },
      low: {
        icon: AlertCircle,
        label: dict.lowStock,
        color: "bg-yellow-50 border-yellow-200",
        textColor: "text-yellow-900",
        badgeColor: "bg-yellow-100 text-yellow-700",
      },
      out: {
        icon: AlertCircle,
        label: dict.outOfStock,
        color: "bg-red-50 border-red-200",
        textColor: "text-red-900",
        badgeColor: "bg-red-100 text-red-700",
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-4 ${config.color} cursor-pointer hover:shadow-md transition`}
        onClick={() =>
          setExpandedProductId(
            expandedProductId === product.id ? null : product.id
          )
        }
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-10 w-10 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-gray-300 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">
                {product.name}
              </p>
              {product.categoryName && (
                <p className="text-xs text-gray-600">{product.categoryName}</p>
              )}
            </div>
          </div>
          <Icon className={`h-5 w-5 flex-shrink-0 ${config.textColor}`} />
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <p className={`text-2xl font-bold ${config.textColor}`}>
            {product.stockQuantity}
          </p>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${config.badgeColor}`}>
            {config.label}
          </span>
        </div>

        {reorderLevel > 0 && (
          <p className="text-xs text-gray-600 mb-2">
            {lang === "ne" ? "पुनः अर्डर:" : "Reorder:"}
            {" "}
            <span className="font-semibold text-gray-900">{reorderLevel}</span>
          </p>
        )}

        <AnimatePresence>
          {expandedProductId === product.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-current mt-3 pt-3 text-sm"
            >
              {status === "low" || status === "out" ? (
                <div className="mb-3 p-2 bg-white/50 rounded flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">
                      {lang === "ne"
                        ? "पुनः अर्डर सुझाव"
                        : "Reorder Suggested"}
                    </p>
                    <p className="text-xs">
                      {lang === "ne"
                        ? `${suggestedQty} इकाई अर्डर गर्नुहोस्`
                        : `Order ${suggestedQty} units`}
                    </p>
                  </div>
                </div>
              ) : null}

              {historyFailedFor === product.id ? (
                <LoadError
                  lang={lang}
                  onRetry={() => setHistoryReloadKey((key) => key + 1)}
                />
              ) : stockHistories[product.id]?.length > 0 ? (
                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    {dict.history}
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {stockHistories[product.id].slice(0, 5).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1 bg-white/50 rounded">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {entry.reason}
                          </p>
                          <p className="text-gray-600">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`font-bold ${
                            entry.change > 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {entry.change > 0 ? "+" : ""}
                          {entry.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">{dict.noHistory}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-semibold text-green-700 mb-1">
            {dict.inStock}
          </p>
          <p className="text-3xl font-bold text-green-900">
            {inStockProducts.length}
          </p>
          <p className="text-xs text-green-700 mt-2">
            {lang === "ne" ? "सामान उपलब्ध" : "Products available"}
          </p>
        </div>

        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm font-semibold text-yellow-700 mb-1">
            {dict.lowStock}
          </p>
          <p className="text-3xl font-bold text-yellow-900">
            {lowStockProducts.length}
          </p>
          <p className="text-xs text-yellow-700 mt-2">
            {lang === "ne"
              ? "अर्डर गर्न आवश्यक"
              : "Action needed"}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {dict.outOfStock}
          </p>
          <p className="text-3xl font-bold text-red-900">
            {outOfStockProducts.length}
          </p>
          <p className="text-xs text-red-700 mt-2">
            {lang === "ne" ? "तत्काल अर्डर गर्नुहोस्" : "Urgent"}
          </p>
        </div>
      </div>

      {/* Alerts Section */}
      {lowStockProducts.length > 0 || outOfStockProducts.length > 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {dict.alerts}
          </h3>
          <div className="space-y-2">
            {[...lowStockProducts, ...outOfStockProducts].map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between text-sm p-2 bg-white/50 rounded"
              >
                <p className="font-semibold text-amber-900">{product.name}</p>
                <p className="text-xs text-amber-700">
                  {lang === "ne" ? "स्टक:" : "Stock:"} {product.stockQuantity}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-semibold text-green-700">
            ✅ {dict.noAlerts}
          </p>
        </div>
      )}

      {/* In Stock Products */}
      {inStockProducts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            {dict.inStock} ({inStockProducts.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {inStockProducts.map((product) => (
              <StockCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Products */}
      {lowStockProducts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-yellow-900 mb-3">
            ⚠️ {dict.lowStock} ({lowStockProducts.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {lowStockProducts.map((product) => (
              <StockCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Out of Stock Products */}
      {outOfStockProducts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-red-900 mb-3">
            🚨 {dict.outOfStock} ({outOfStockProducts.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {outOfStockProducts.map((product) => (
              <StockCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
