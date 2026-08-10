import { Link, useLocation } from "wouter";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/language";
import { formatQuantity, getQuantityStep, normalizeQuantity } from "@/lib/quantity";
import { formatNPR, getImageUrl } from "@/lib/utils";

export default function CartModern() {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">{lang === "ne" ? "कार्ट खाली छ" : "Your cart is empty"}</h1>
        <p className="mt-3 text-muted-foreground">
          {lang === "ne" ? "सामान छान्न क्याटलगमा जानुहोस्" : "Go to the catalog to add products"}
        </p>
        <Link href="/catalog" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground">
          {lang === "ne" ? "सामान हेर्नुहोस्" : "Browse products"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{lang === "ne" ? "तपाईंको कार्ट" : "Your cart"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "ne" ? "अर्डर गर्नु अघि मात्रा जाँच गर्नुहोस्" : "Check quantities before checkout"}
          </p>
        </div>
        <button onClick={clearCart} className="text-sm font-bold text-destructive">
          {lang === "ne" ? "सबै हटाउनुहोस्" : "Clear all"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {items.map((item) => {
            const imageUrl = getImageUrl(item.product.imageUrl);
            const quantityStep = getQuantityStep(item.product.unit);
            const quantityLabel = lang === "ne" ? "मात्रा" : "Quantity";
            // The shop cannot sell what it does not have, so the cart refuses
            // to go past it rather than letting the customer fill in a form and
            // be turned away at the last step.
            const available = Number((item.product as any).stockQuantity ?? 0);
            const capped = (value: number) => (available > 0 ? Math.min(value, available) : value);
            const atLimit = available > 0 && item.quantity >= available;
            return (
              <div key={item.product.id} className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
                <div className="flex gap-4">
                  <Link href={`/product/${item.product.id}`} className="h-22 w-22 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {imageUrl ? (
                      <img src={imageUrl} alt={item.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.product.id}`} className="block truncate text-lg font-bold text-foreground">
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatNPR(item.product.price)} / {item.product.unit}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center overflow-hidden rounded-2xl border border-border">
                        <button onClick={() => updateQuantity(item.product.id, normalizeQuantity(item.quantity - quantityStep, item.product.unit))} className="flex h-10 w-10 items-center justify-center bg-muted/50">
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min={quantityStep}
                          max={available > 0 ? available : undefined}
                          step={quantityStep}
                          inputMode="decimal"
                          value={formatQuantity(item.quantity)}
                          onChange={(event) => updateQuantity(item.product.id, capped(normalizeQuantity(event.target.value, item.product.unit)))}
                          onFocus={(event) => event.currentTarget.select()}
                          className="flex h-10 w-16 border-x border-border bg-background px-2 text-center font-bold outline-none"
                          aria-label={quantityLabel}
                        />
                        <button
                          onClick={() => updateQuantity(item.product.id, capped(normalizeQuantity(item.quantity + quantityStep, item.product.unit)))}
                          disabled={atLimit}
                          className="flex h-10 w-10 items-center justify-center bg-muted/50 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {available <= 0 ? (
                        <p className="w-full text-sm font-semibold text-destructive">
                          {lang === "ne" ? "अहिले स्टकमा छैन" : "Out of stock right now"}
                        </p>
                      ) : atLimit ? (
                        <p className="w-full text-sm font-semibold text-amber-600">
                          {lang === "ne"
                            ? `पसलमा ${formatQuantity(available)} ${item.product.unit} मात्र छ`
                            : `Only ${formatQuantity(available)} ${item.product.unit} available`}
                        </p>
                      ) : null}
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{formatNPR(item.product.price * item.quantity)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="rounded-[2rem] border border-primary/10 bg-primary/5 p-6">
            <h2 className="text-2xl font-bold text-foreground">{lang === "ne" ? "जम्मा" : "Summary"}</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{lang === "ne" ? "सामान" : "Items"}</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{lang === "ne" ? "उप-जम्मा" : "Subtotal"}</span>
                <span>{formatNPR(totalPrice)}</span>
              </div>
            </div>
            <div className="mt-5 flex items-end justify-between border-t border-primary/20 pt-5">
              <span className="text-base font-bold">{lang === "ne" ? "कुल रकम" : "Total"}</span>
              <span className="text-3xl font-bold text-primary">{formatNPR(totalPrice)}</span>
            </div>
            <button onClick={() => setLocation("/checkout")} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 font-bold text-accent-foreground shadow-lg">
              {lang === "ne" ? "चेकआउट गर्नुहोस्" : "Go to checkout"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
