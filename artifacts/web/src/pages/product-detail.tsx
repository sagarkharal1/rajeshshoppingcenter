import { useLocation, useRoute } from "wouter";
import { useState } from "react";
import { useGetProduct } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { formatQuantity, getQuantityStep, normalizeQuantity } from "@/lib/quantity";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { ShoppingCart, ArrowLeft, Minus, Plus, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  const { t, lang } = useLanguage();
  const { data: product, isLoading, isError } = useGetProduct(id);
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const quantityStep = getQuantityStep(product?.unit);
  const quantityLabel = lang === "ne" ? "मात्रा" : "Quantity";
  const cartActionText = lang === "ne" ? "कार्टमा जानुहोस्" : "Go to cart";
  const keepSelectingText = lang === "ne" ? "वा सामान छानिरहनुहोस्" : "Keep selecting items";

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold font-serif mb-4">{t.product.notFound}</h2>
        <Link href="/catalog" className="text-primary hover:underline font-bold">{t.product.returnToCatalog}</Link>
      </div>
    );
  }

  const handleAdd = () => {
    addToCart(product, quantity);
    toast({
      title: t.product.addedToCart,
      description: `${formatQuantity(quantity)}x ${product.name} ${t.product.addedToCartDesc}`,
      action: (
        <ToastAction altText={cartActionText} onClick={() => navigate("/cart")}>
          {cartActionText}
        </ToastAction>
      ),
    });
  };

  const imageUrl = getImageUrl(product.imageUrl);
  const productMeta = product as typeof product & { stockQuantity?: number; sku?: string };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/catalog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold mb-8">
        <ArrowLeft className="w-4 h-4" /> {t.product.backToCatalog}
      </Link>

      <div className="bg-card rounded-3xl shadow-lg border border-border/50 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image Side */}
          <div className="bg-muted relative min-h-[400px] md:min-h-[600px] flex items-center justify-center p-8">
            {imageUrl ? (
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl"
              />
            ) : (
              <div className="text-muted-foreground/50 text-2xl font-bold flex flex-col items-center">
                <ShoppingCart className="w-20 h-20 mb-4 opacity-20" />
                {t.product.noImage}
              </div>
            )}
            {product.featured && (
              <div className="absolute top-6 left-6 bg-accent text-accent-foreground px-4 py-1.5 rounded-full font-bold text-sm shadow-md">
                {t.product.featured}
              </div>
            )}
          </div>

          {/* Info Side */}
          <div className="p-8 md:p-12 flex flex-col">
            <div className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">
              {product.categoryName}
            </div>
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4 leading-tight">
              {product.name}
            </h1>

            <div className="text-3xl font-bold text-foreground mb-6">
              {formatNPR(product.price)} <span className="text-lg text-muted-foreground font-normal">/ {product.unit}</span>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {t.product.inStock}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {product.inStock ? `${productMeta.stockQuantity ?? 0} ${product.unit}` : t.product.outOfStock}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  SKU
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {productMeta.sku || "-"}
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                Quality
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {product.featured ? "Premium quality item" : "Good quality item"}
              </p>
            </div>

            <div className="prose prose-slate mb-10 text-muted-foreground leading-relaxed">
              <p>{product.description || t.product.noDescription}</p>
            </div>

            <div className="mt-auto space-y-8">
              {/* Stock Status */}
              <div className="flex items-center gap-2">
                {product.inStock ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <span className="font-bold text-green-700">{t.product.inStock}</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                    <span className="font-bold text-destructive">{t.product.outOfStock}</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center border-2 border-border rounded-xl overflow-hidden bg-background h-14 w-full sm:w-auto">
                  <button
                    onClick={() => setQuantity(normalizeQuantity(quantity - quantityStep, product.unit))}
                    disabled={!product.inStock || quantity <= quantityStep}
                    className="w-14 h-full flex items-center justify-center hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    min={quantityStep}
                    step={quantityStep}
                    inputMode="decimal"
                    value={formatQuantity(quantity)}
                    onChange={(event) => setQuantity(normalizeQuantity(event.target.value, product.unit))}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-full w-20 border-x-2 border-border bg-transparent px-2 text-center text-lg font-bold outline-none"
                    aria-label={quantityLabel}
                  />
                  <button
                    onClick={() => setQuantity(normalizeQuantity(quantity + quantityStep, product.unit))}
                    disabled={!product.inStock}
                    className="w-14 h-full flex items-center justify-center hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={!product.inStock}
                  className="flex-1 h-14 flex items-center justify-center gap-3 bg-accent text-accent-foreground font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {t.product.addToCart}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <span>{keepSelectingText}</span>
                <button
                  type="button"
                  onClick={() => navigate("/cart")}
                  className="rounded-full bg-background px-4 py-2 font-semibold text-primary transition hover:bg-white"
                >
                  {cartActionText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
