import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { formatNPR, getImageUrl } from "@/lib/utils";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Cart() {
  const { t } = useLanguage();
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-32 text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-8">
          <ShoppingBag className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-serif font-bold mb-4">{t.cart.empty}</h1>
        <p className="text-muted-foreground text-lg mb-8">{t.cart.emptyDesc}</p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
        >
          {t.cart.startShopping} <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-4xl font-serif font-bold text-foreground mb-10">{t.cart.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-4 px-2">
            <span className="font-bold text-muted-foreground">{t.cart.product}</span>
            <button
              onClick={clearCart}
              className="text-sm font-bold text-destructive hover:underline"
            >
              {t.cart.clearCart}
            </button>
          </div>

          <AnimatePresence>
            {items.map((item) => {
              const imgUrl = getImageUrl(item.product.imageUrl);
              return (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-card p-4 rounded-2xl shadow-sm border border-border/50"
                >
                  <Link href={`/product/${item.product.id}`} className="shrink-0 w-full sm:w-24 h-24 bg-muted rounded-xl overflow-hidden block">
                    {imgUrl ? (
                      <img src={imgUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{t.cart.noImg}</div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.product.id}`} className="font-bold text-lg text-foreground hover:text-primary transition-colors truncate block">
                      {item.product.name}
                    </Link>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatNPR(item.product.price)} / {item.product.unit}
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full sm:w-auto gap-6 mt-4 sm:mt-0">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden h-10">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-10 h-full flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors text-foreground"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="w-12 h-full flex items-center justify-center font-bold text-sm bg-background border-x border-border">
                        {item.quantity}
                      </div>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-10 h-full flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors text-foreground"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className="font-bold text-lg">{formatNPR(item.product.price * item.quantity)}</div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-primary/5 rounded-3xl p-8 sticky top-28 border border-primary/10">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-6">{t.cart.orderSummary}</h2>

            <div className="space-y-4 mb-6 text-foreground/80">
              <div className="flex justify-between">
                <span>{t.cart.subtotal} ({items.length} {t.cart.items})</span>
                <span className="font-bold text-foreground">{formatNPR(totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.cart.shipping}</span>
                <span className="text-muted-foreground italic">{t.cart.shippingCalc}</span>
              </div>
            </div>

            <div className="border-t border-primary/20 pt-6 mb-8 flex justify-between items-end">
              <span className="text-lg font-bold">{t.cart.totalEstimated}</span>
              <span className="text-3xl font-bold text-primary">{formatNPR(totalPrice)}</span>
            </div>

            <button
              onClick={() => setLocation("/checkout")}
              className="w-full py-4 bg-accent text-accent-foreground rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
            >
              {t.cart.proceedCheckout} <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-xs text-center text-muted-foreground mt-6">
              {t.cart.bankTransferNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
