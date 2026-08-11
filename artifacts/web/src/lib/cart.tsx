import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Product } from "@workspace/api-client-react";
import { normalizeQuantity } from "@/lib/quantity";
import { salePriceInfo } from "@/lib/sale-price";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "rajesh_shopping_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to parse cart from local storage", error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Every route into the cart passes through here, which is the only place a
  // stock limit can actually hold. The product page capped its own picker, but
  // pressing "add" twice still stacked 148 onto 297 and sailed past 147 in
  // stock — the limit has to be applied to the running total, not the picker.
  const stockLimit = (product: Product) => Number((product as any).stockQuantity ?? 0);
  const capToStock = (product: Product, quantity: number) => {
    const available = stockLimit(product);
    return available > 0 ? Math.min(quantity, available) : quantity;
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const cleanQuantity = normalizeQuantity(quantity, product.unit);
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                // Refresh the stored product too: the cart keeps a snapshot in
                // local storage, so a days-old copy would price and limit the
                // item on figures the shop has since changed.
                product,
                quantity: capToStock(product, normalizeQuantity(item.quantity + cleanQuantity, product.unit)),
              }
            : item
        );
      }
      return [...prev, { product, quantity: capToStock(product, cleanQuantity) }];
    });
  };

  const removeFromCart = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: capToStock(item.product, normalizeQuantity(quantity, item.product.unit)) }
          : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  // A running discount has to reach the cart, not just the product page. This
  // used to add up the normal price, so a customer was shown NPR 115 on the
  // product and then charged NPR 125 a kilo at checkout.
  const totalPrice = items.reduce(
    (sum, item) => sum + salePriceInfo(item.product as any).price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
