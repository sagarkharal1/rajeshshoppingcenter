import { Link, useLocation } from "wouter";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@workspace/api-client-react";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const productMeta = product as Product & { stockQuantity?: number; sku?: string };
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const cartActionText = lang === "ne" ? "कार्टमा जानुहोस्" : "Go to cart";
  const keepSelectingText = lang === "ne" ? "वा सामान छानिरहनुहोस्" : "Keep selecting items";
  const quantityInCart = useMemo(
    () => items.find((item) => item.product.id === product.id)?.quantity ?? 0,
    [items, product.id]
  );

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product, selectedQuantity);
    toast({
      title: t.product.addedToCart,
      description: `${selectedQuantity}x ${product.name} ${t.product.addedToCartDesc}`,
      action: (
        <ToastAction altText={cartActionText} onClick={() => navigate("/cart")}>
          {cartActionText}
        </ToastAction>
      ),
    });
  };

  const imageUrl = imageFailed ? null : getImageUrl(product.imageUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-xl"
    >
      <Link href={`/product/${product.id}`} className="relative block h-52 overflow-hidden bg-muted outline-none">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary/50">
            {t.product.noImage}
          </div>
        )}
        {!product.inStock && (
          <div className="absolute top-3 right-3 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {t.product.outOfStockBadge}
          </div>
        )}
        {product.featured && product.inStock && (
          <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {t.product.featuredBadge}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {product.categoryName}
        </div>
        <Link href={`/product/${product.id}`} className="outline-none group-hover:text-primary transition-colors">
          <h3 className="mb-1 line-clamp-2 text-base font-bold leading-tight text-foreground">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 flex-1 line-clamp-2 text-sm text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full px-3 py-1 font-semibold ${product.inStock ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {product.inStock ? t.product.inStock : t.product.outOfStock}
          </span>
          {typeof productMeta.stockQuantity === "number" ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {productMeta.stockQuantity} {product.unit}
            </span>
          ) : null}
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
            {product.featured ? "Premium quality" : "Good quality"}
          </span>
        </div>

        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Quantity
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selectedQuantity} {product.unit}
              </p>
            </div>
            <div className="flex items-center overflow-hidden rounded-2xl border border-border bg-background">
              <button
                type="button"
                onClick={() => setSelectedQuantity((value) => Math.max(1, value - 1))}
                className="px-3 py-2 text-base font-bold text-foreground transition hover:bg-muted"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="min-w-10 px-3 py-2 text-center text-sm font-semibold text-foreground">
                {selectedQuantity}
              </span>
              <button
                type="button"
                onClick={() => setSelectedQuantity((value) => value + 1)}
                disabled={!product.inStock}
                className="px-3 py-2 text-base font-bold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
          {quantityInCart > 0 ? (
            <p className="mt-2 text-xs font-medium text-primary">
              Already in cart: {quantityInCart} {product.unit}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex flex-col">
            <span className="font-bold text-base text-primary">{formatNPR(product.price)}</span>
            <span className="text-xs text-muted-foreground">{t.product.per} {product.unit}</span>
          </div>

          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-accent px-3 text-accent-foreground shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            aria-label={t.product.addToCart}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>{keepSelectingText}</span>
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="rounded-full bg-background px-3 py-1 font-semibold text-primary transition hover:bg-white"
          >
            {cartActionText}
          </button>
        </div>
        <Link
          href={`/product/${product.id}`}
          className="mt-2 inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          View quantity, quality, and price
        </Link>
      </div>
    </motion.div>
  );
}
