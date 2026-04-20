import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";

type PublicSettings = {
  shopName?: string | null;
  proprietorName?: string | null;
  phone?: string | null;
  panNumber?: string | null;
  email?: string | null;
  address?: string | null;
  aboutText?: string | null;
  termsConditions?: string | null;
  deliveryPolicy?: string | null;
  shopPhotoPath?: string | null;
  ownerPhotoPath?: string | null;
  homeBannerPath?: string | null;
};

type Category = {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

type Product = {
  id: number;
  name: string;
  description?: string | null;
  sku?: string | null;
  price: number | string;
  stockQuantity?: number;
  unit?: string | null;
  imageUrl?: string | null;
  categoryId?: number;
  categoryName?: string | null;
  featured?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type ShopOrder = {
  id: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalAmount: number | string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  items?: Array<{ productName: string; quantity: number; price: number; unit?: string }>;
};

type Booking = {
  id: number;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  destination: string;
  bookingDate: string;
  status: string;
  notes?: string | null;
  createdAt?: string;
};

type Customer = {
  id: number;
  name: string;
  customerCode?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photoPath?: string | null;
  creditBalance?: number | string;
  totalSpent?: number | string;
  notes?: string | null;
};

type DashboardSummary = {
  totals?: {
    totalProducts?: number;
    lowStockProducts?: number;
    inventoryRevenue?: number;
    totalCustomers?: number;
    totalCreditBalance?: number;
  };
  recentInvoices?: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    dueAmount: number;
    createdAt: string;
  }>;
};

type AlertState = { type: "success" | "error"; message: string } | null;

const API_BASE = "/api";
const OWNER_TOKEN_KEY = "rajesh-owner-token";

const FALLBACK_SETTINGS: Required<Pick<PublicSettings, "shopName" | "phone" | "address" | "aboutText">> = {
  shopName: "Rajesh Shopping Center",
  phone: "9814401716",
  address: "Musikot-5, Aapchaur, Gulmi",
  aboutText:
    "Rajesh Shopping Center is built for daily village business: groceries, hardware, delivery, booking services, and owner-side billing.",
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function asMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function asDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Request failed";
}

function cleanOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const details = Array.isArray(data?.details) ? ` ${data.details.join(", ")}` : "";
    throw new Error(data?.error ? `${data.error}${details}` : `Request failed (${response.status})`);
  }

  return data as T;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = ["confirmed", "paid", "delivered", "completed", "order-received", "dispatched"].some((item) =>
    normalized.includes(item),
  );
  const negative = ["rejected", "cancelled", "failed", "unpaid"].some((item) => normalized.includes(item));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        positive && "bg-emerald-100 text-emerald-700",
        negative && "bg-rose-100 text-rose-700",
        !positive && !negative && "bg-slate-100 text-slate-700",
      )}
    >
      <span>{positive ? "✓" : negative ? "✕" : "•"}</span>
      <span className="capitalize">{value.replaceAll("-", " ")}</span>
    </span>
  );
}

function Notice({ notice }: { notice: AlertState }) {
  if (!notice) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-medium",
        notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {notice.message}
    </div>
  );
}

function Shell({
  settings,
  children,
}: {
  settings: PublicSettings;
  children: React.ReactNode;
}) {
  const merged = { ...FALLBACK_SETTINGS, ...settings };

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <Link href="/" className="block text-2xl font-bold tracking-tight text-slate-900">
              {merged.shopName}
            </Link>
            <div className="text-sm text-slate-600">{merged.address}</div>
            <div className="text-sm font-medium text-slate-700">{merged.phone}</div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/catalog">Products</NavLink>
            <NavLink href="/book">Bookings</NavLink>
            <NavLink href="/checkout">Checkout</NavLink>
            <NavLink href="/track-order">Track Order</NavLink>
            <NavLink href="/account">Customer Account</NavLink>
            <NavLink href="/about">About</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-600 sm:px-6">
          <div>{merged.shopName}</div>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href="/owner" className="hover:text-slate-900">
              Owner
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-2 transition",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-stone-100 hover:text-slate-900",
      )}
    >
      {children}
    </Link>
  );
}

function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : <div />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function textInputClasses() {
  return "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-500";
}

function buttonClasses(kind: "primary" | "secondary" | "danger" = "primary") {
  return cn(
    "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
    kind === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
    kind === "secondary" && "border border-stone-300 bg-white text-slate-900 hover:bg-stone-50",
    kind === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
  );
}

function HomePage({ settings }: { settings: PublicSettings }) {
  const merged = { ...FALLBACK_SETTINGS, ...settings };
  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Since 1997</div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">{merged.shopName}</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">{merged.aboutText}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog" className={buttonClasses("primary")}>
                View Products
              </Link>
              <Link href="/book" className={buttonClasses("secondary")}>
                Book Bolero / Tractor
              </Link>
              <Link href="/track-order" className={buttonClasses("secondary")}>
                Track Order
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl bg-stone-100">
            {merged.homeBannerPath || merged.shopPhotoPath ? (
              <img
                src={String(merged.homeBannerPath || merged.shopPhotoPath)}
                alt={merged.shopName}
                className="h-full min-h-[280px] w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center px-8 text-center text-slate-500">
                Add your shop photo from owner settings to show it here.
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Phone">
          <div className="text-lg font-semibold text-slate-900">{merged.phone}</div>
        </Card>
        <Card title="Address">
          <div className="text-slate-700">{merged.address}</div>
        </Card>
        <Card title="PAN">
          <div className="text-slate-700">{merged.panNumber || "Add PAN in owner settings"}</div>
        </Card>
      </div>
    </div>
  );
}

function CatalogPage({
  products,
  categories,
  addToCart,
}: {
  products: Product[];
  categories: Category[];
  addToCart: (product: Product) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory;
      const matchesSearch =
        search.trim().length === 0 ||
        product.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (product.description || "").toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="space-y-6">
      <Card title="Products">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            <input
              className={textInputClasses()}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
            />
            <div className="space-y-2">
              <button className={cn(buttonClasses("secondary"), "w-full", selectedCategory === "all" && "bg-slate-900 text-white")} onClick={() => setSelectedCategory("all")}>
                All categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={cn(buttonClasses("secondary"), "w-full", selectedCategory === category.id && "bg-slate-900 text-white")}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <Card key={product.id}>
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl bg-stone-100">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-sm text-slate-500">No image</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{product.categoryName || "General"}</div>
                    <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                    <p className="min-h-[48px] text-sm text-slate-600">{product.description || "No description added."}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-slate-900">{asMoney(product.price)}</div>
                      <div className="text-xs text-slate-500">
                        Stock {product.stockQuantity ?? 0} {product.unit || "pcs"}
                      </div>
                    </div>
                  </div>
                  <button className={cn(buttonClasses("primary"), "w-full")} onClick={() => addToCart(product)}>
                    Add to order
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function CheckoutPage({
  cart,
  setCart,
}: {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}) {
  const [notice, setNotice] = useState<AlertState>(null);
  const [busy, setBusy] = useState(false);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    notes: "",
    paymentMethod: "bank",
  });

  const total = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!cart.length) {
      setNotice({ type: "error", message: "Add products before placing an order." });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const result = await api<any>("/orders", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          paymentStatus: "unpaid",
          items: cart.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            price: Number(item.product.price),
            quantity: item.quantity,
            unit: item.product.unit || "piece",
          })),
        }),
      });
      setOrderInfo(result);
      setCart([]);
      setNotice({ type: "success", message: `Order created successfully. Order ID: ${result.id}` });
      setForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        customerAddress: "",
        notes: "",
        paymentMethod: "bank",
      });
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card title="Customer details">
        <form className="space-y-4" onSubmit={placeOrder}>
          <Notice notice={notice} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer name">
              <input className={textInputClasses()} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
            <Field label="Phone number">
              <input className={textInputClasses()} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <input className={textInputClasses()} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
          </Field>
          <Field label="Address">
            <textarea className={cn(textInputClasses(), "min-h-[110px]")} value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={cn(textInputClasses(), "min-h-[110px]")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="Payment method">
            <select className={textInputClasses()} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="bank">Bank</option>
              <option value="esewa">eSewa</option>
              <option value="khalti">Khalti</option>
            </select>
          </Field>
          <button className={cn(buttonClasses("primary"), "w-full")} disabled={busy}>
            {busy ? "Creating order..." : "Create order"}
          </button>
          {orderInfo && (
            <div className="rounded-2xl bg-stone-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Order created</div>
              <div>Order ID: {orderInfo.id}</div>
              <div>Customer code: {orderInfo.customer?.customerCode || "-"}</div>
            </div>
          )}
        </form>
      </Card>

      <Card title="Order summary" action={<Link href="/catalog" className={buttonClasses("secondary")}>Back to products</Link>}>
        <div className="space-y-3">
          {cart.length === 0 ? (
            <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No products added yet.</div>
          ) : (
            cart.map((item, index) => (
              <div key={item.product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-3">
                <div>
                  <div className="font-semibold text-slate-900">{item.product.name}</div>
                  <div className="text-sm text-slate-600">{asMoney(item.product.price)} x {item.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={buttonClasses("secondary")} onClick={() => setCart((current) => current.map((entry, i) => i === index ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))}>-</button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <button className={buttonClasses("secondary")} onClick={() => setCart((current) => current.map((entry, i) => i === index ? { ...entry, quantity: entry.quantity + 1 } : entry))}>+</button>
                  <button className={buttonClasses("danger")} onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-300">Total</div>
            <div className="mt-1 text-3xl font-bold">{asMoney(total)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TrackOrderPage() {
  const [form, setForm] = useState({ id: "", phone: "" });
  const [result, setResult] = useState<ShopOrder | null>(null);
  const [notice, setNotice] = useState<AlertState>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api<ShopOrder>(`/orders/${form.id}/track?phone=${encodeURIComponent(form.phone)}`);
      setResult(data);
    } catch (err) {
      setResult(null);
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card title="Track your order">
        <form className="space-y-4" onSubmit={submit}>
          <Notice notice={notice} />
          <Field label="Order ID">
            <input className={textInputClasses()} value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          </Field>
          <Field label="Phone number">
            <input className={textInputClasses()} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <button className={cn(buttonClasses("primary"), "w-full")}>Track order</button>
          <Link href="/" className={cn(buttonClasses("secondary"), "w-full")}>Back to home</Link>
        </form>
      </Card>
      <Card title="Order status">
        {!result ? (
          <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">Track an order to see its current status here.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <StatusBadge value={result.status} />
              <StatusBadge value={result.paymentStatus || "unpaid"} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Customer" value={result.customerName} />
              <Info label="Phone" value={result.customerPhone} />
              <Info label="Payment" value={result.paymentMethod || "-"} />
              <Info label="Created" value={asDate(result.createdAt)} />
            </div>
            <Info label="Address" value={result.customerAddress} />
            <div className="space-y-2">
              {result.items?.map((item, index) => (
                <div key={`${item.productName}-${index}`} className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
                  <div>
                    <div className="font-semibold">{item.productName}</div>
                    <div className="text-sm text-slate-600">{item.quantity} {item.unit || "piece"}</div>
                  </div>
                  <div className="font-semibold">{asMoney(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <div className="text-sm text-slate-300">Total</div>
              <div className="text-2xl font-bold">{asMoney(result.totalAmount)}</div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BookPage() {
  const [form, setForm] = useState({
    serviceType: "jeep",
    customerName: "",
    customerPhone: "",
    pickupLocation: "",
    destination: "",
    bookingDate: "",
    notes: "",
  });
  const [notice, setNotice] = useState<AlertState>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice({ type: "success", message: "Booking created successfully." });
      setForm({
        serviceType: "jeep",
        customerName: "",
        customerPhone: "",
        pickupLocation: "",
        destination: "",
        bookingDate: "",
        notes: "",
      });
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card title="Book transport service">
        <form className="space-y-4" onSubmit={submit}>
          <Notice notice={notice} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Service">
              <select className={textInputClasses()} value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
                <option value="jeep">Bolero double cab</option>
                <option value="tractor">Tractor</option>
              </select>
            </Field>
            <Field label="Booking date">
              <input className={textInputClasses()} value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} placeholder="Example: 2026-04-20 or tomorrow morning" />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer name">
              <input className={textInputClasses()} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
            <Field label="Phone number">
              <input className={textInputClasses()} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </Field>
          </div>
          <Field label="Pickup location">
            <input className={textInputClasses()} value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} />
          </Field>
          <Field label="Destination">
            <input className={textInputClasses()} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={cn(textInputClasses(), "min-h-[100px]")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button className={buttonClasses("primary")} disabled={busy}>
              {busy ? "Saving..." : "Create booking"}
            </button>
            <Link href="/" className={buttonClasses("secondary")}>
              Back to home
            </Link>
          </div>
        </form>
      </Card>
      <Card title="Service notes">
        <div className="space-y-3 text-slate-700">
          <p>Use this page for Bolero double cab and tractor service booking.</p>
          <p>After booking, the owner side should show the request clearly so it can be confirmed or rejected.</p>
          <p>Customers should not be confused about where to go next, so the back-to-home button is always visible.</p>
        </div>
      </Card>
    </div>
  );
}

function AccountPage() {
  const [form, setForm] = useState({ customerCode: "", phone: "" });
  const [result, setResult] = useState<any>(null);
  const [notice, setNotice] = useState<AlertState>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api<any>(`/customer-portal/profile?customerCode=${encodeURIComponent(form.customerCode)}&phone=${encodeURIComponent(form.phone)}`);
      setResult(data);
    } catch (err) {
      setResult(null);
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card title="Customer account">
        <form className="space-y-4" onSubmit={submit}>
          <Notice notice={notice} />
          <Field label="Customer code">
            <input className={textInputClasses()} value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value })} />
          </Field>
          <Field label="Phone number">
            <input className={textInputClasses()} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <button className={cn(buttonClasses("primary"), "w-full")}>Open account</button>
        </form>
      </Card>
      <Card title="History and balances">
        {!result ? (
          <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">Open your account to see orders, invoices, payments, and balance.</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {result.customer.photoPath ? (
                <img src={result.customer.photoPath} alt={result.customer.name} className="h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-slate-500">No photo</div>
              )}
              <div>
                <div className="text-lg font-semibold">{result.customer.name}</div>
                <div className="text-sm text-slate-600">{result.customer.customerCode}</div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Credit balance" value={asMoney(result.customer.creditBalance)} />
              <Info label="Total spent" value={asMoney(result.customer.totalSpent)} />
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Recent orders</h3>
              {result.orders?.length ? result.orders.map((order: any) => (
                <div key={order.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold">Order #{order.id}</div>
                    <div className="flex gap-2">
                      <StatusBadge value={order.status} />
                      <StatusBadge value={order.paymentStatus} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">{asDate(order.createdAt)}</div>
                </div>
              )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No orders yet.</div>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function AboutPage({ settings }: { settings: PublicSettings }) {
  return (
    <Card title="About the shop">
      <div className="space-y-4 text-slate-700">
        <p>{settings.aboutText || FALLBACK_SETTINGS.aboutText}</p>
        <p>Phone: {settings.phone || FALLBACK_SETTINGS.phone}</p>
        <p>Address: {settings.address || FALLBACK_SETTINGS.address}</p>
        <p>Email: {settings.email || "rajeshshoppingcenter@gmail.com"}</p>
      </div>
    </Card>
  );
}

function TermsPage({ settings }: { settings: PublicSettings }) {
  return (
    <Card title="Terms and service">
      <div className="space-y-4 whitespace-pre-wrap text-slate-700">
        {settings.termsConditions || settings.deliveryPolicy || "Terms have not been added yet."}
      </div>
    </Card>
  );
}

function OwnerLoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ identifier: "owner", password: "admin123" });
  const [notice, setNotice] = useState<AlertState>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onLogin(result.token);
      navigate("/owner");
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card title="Owner login">
        <form className="space-y-4" onSubmit={submit}>
          <Notice notice={notice} />
          <Field label="Username / email / phone">
            <input className={textInputClasses()} value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className={textInputClasses()} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <button className={cn(buttonClasses("primary"), "w-full")} disabled={busy}>
            {busy ? "Signing in..." : "Log in"}
          </button>
          <Link href="/" className={cn(buttonClasses("secondary"), "w-full")}>
            Back to home
          </Link>
        </form>
      </Card>
    </div>
  );
}

function OwnerDashboard({ token, onLogout, settings }: { token: string; onLogout: () => void; settings: PublicSettings }) {
  const [tab, setTab] = useState<"overview" | "customers" | "products" | "orders" | "bookings" | "settings">("overview");
  const [notice, setNotice] = useState<AlertState>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", address: "", notes: "", customerCode: "", photoPath: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "grocery", sortOrder: "1" });
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    description: "",
    price: "",
    buyingPrice: "0",
    transportationCost: "0",
    extraCost: "0",
    stockQuantity: "0",
    reorderLevel: "0",
    unit: "piece",
    categoryId: "",
    imageUrl: "",
    featured: false,
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [settingsForm, setSettingsForm] = useState({
    shopName: settings.shopName || "",
    proprietorName: settings.proprietorName || "",
    phone: settings.phone || "",
    email: settings.email || "",
    address: settings.address || "",
    aboutText: settings.aboutText || "",
    termsConditions: settings.termsConditions || "",
    deliveryPolicy: settings.deliveryPolicy || "",
    shopPhotoPath: settings.shopPhotoPath || "",
    homeBannerPath: settings.homeBannerPath || "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [summaryData, customerData, categoryData, productData, orderData, bookingData, publicSettings] = await Promise.all([
        api<DashboardSummary>("/admin/dashboard-summary", undefined, token),
        api<Customer[]>("/admin/customers", undefined, token),
        api<Category[]>("/admin/categories", undefined, token),
        api<Product[]>("/admin/products", undefined, token),
        api<ShopOrder[]>("/admin/orders", undefined, token),
        api<Booking[]>("/admin/bookings", undefined, token),
        api<PublicSettings>("/settings"),
      ]);
      setSummary(summaryData);
      setCustomers(customerData);
      setCategories(categoryData);
      setProducts(productData);
      setOrders(orderData);
      setBookings(bookingData);
      setSettingsForm({
        shopName: publicSettings.shopName || "",
        proprietorName: publicSettings.proprietorName || "",
        phone: publicSettings.phone || "",
        email: publicSettings.email || "",
        address: publicSettings.address || "",
        aboutText: publicSettings.aboutText || "",
        termsConditions: publicSettings.termsConditions || "",
        deliveryPolicy: publicSettings.deliveryPolicy || "",
        shopPhotoPath: publicSettings.shopPhotoPath || "",
        homeBannerPath: publicSettings.homeBannerPath || "",
      });
      if (!productForm.categoryId && categoryData[0]) {
        setProductForm((current) => ({ ...current, categoryId: String(categoryData[0].id) }));
      }
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const uploadInto = async (
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setter(dataUrl);
      setNotice({ type: "success", message: "Image loaded successfully." });
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const saveCustomer = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api(
        "/admin/customers",
        {
          method: "POST",
          body: JSON.stringify({
            name: customerForm.name.trim(),
            phone: cleanOptionalText(customerForm.phone),
            email: cleanOptionalText(customerForm.email),
            address: cleanOptionalText(customerForm.address),
            notes: cleanOptionalText(customerForm.notes),
            customerCode: cleanOptionalText(customerForm.customerCode),
            photoPath: cleanOptionalText(customerForm.photoPath),
          }),
        },
        token,
      );
      setCustomerForm({ name: "", phone: "", email: "", address: "", notes: "", customerCode: "", photoPath: "" });
      setNotice({ type: "success", message: "Customer added successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          ...categoryForm,
          sortOrder: Number(categoryForm.sortOrder || 0),
        }),
      }, token);
      setCategoryForm({ name: "", description: "", icon: "grocery", sortOrder: String((categories.at(-1)?.sortOrder || 0) + 1) });
      setNotice({ type: "success", message: "Category added successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price || 0),
          buyingPrice: Number(productForm.buyingPrice || 0),
          transportationCost: Number(productForm.transportationCost || 0),
          extraCost: Number(productForm.extraCost || 0),
          stockQuantity: Number(productForm.stockQuantity || 0),
          reorderLevel: Number(productForm.reorderLevel || 0),
          categoryId: Number(productForm.categoryId || 0),
        }),
      }, token);
      setProductForm({
        name: "",
        sku: "",
        description: "",
        price: "",
        buyingPrice: "0",
        transportationCost: "0",
        extraCost: "0",
        stockQuantity: "0",
        reorderLevel: "0",
        unit: "piece",
        categoryId: String(categories[0]?.id || ""),
        imageUrl: "",
        featured: false,
      });
      setNotice({ type: "success", message: "Product added successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/admin/settings", { method: "PUT", body: JSON.stringify(settingsForm) }, token);
      setNotice({ type: "success", message: "Settings saved successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice({ type: "error", message: "New password and confirm password do not match." });
      return;
    }
    try {
      await api("/admin/change-password", { method: "POST", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) }, token);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice({ type: "success", message: "Password changed successfully." });
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const updateOrderStatus = async (orderId: number, status: string, paymentStatus?: string) => {
    try {
      await api(`/admin/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status, ...(paymentStatus ? { paymentStatus } : {}) }) }, token);
      setNotice({ type: "success", message: "Order updated successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const updateBookingStatus = async (bookingId: number, status: string) => {
    try {
      await api(`/admin/bookings/${bookingId}/status`, { method: "PUT", body: JSON.stringify({ status }) }, token);
      setNotice({ type: "success", message: "Booking updated successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const removeCustomer = async (id: number) => {
    try {
      await api(`/admin/customers/${id}`, { method: "DELETE" }, token);
      setNotice({ type: "success", message: "Customer deleted successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const removeProduct = async (id: number) => {
    try {
      await api(`/admin/products/${id}`, { method: "DELETE" }, token);
      setNotice({ type: "success", message: "Product deleted successfully." });
      await load();
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err) });
    }
  };

  const mergedSettings = { ...FALLBACK_SETTINGS, ...settingsForm };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Owner workspace</div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{mergedSettings.shopName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonClasses("secondary")}>Back to home</Link>
            <button className={buttonClasses("danger")} onClick={onLogout}>Logout</button>
          </div>
        </div>
      </Card>

      <Notice notice={notice} />

      <div className="flex flex-wrap gap-2">
        {(["overview", "customers", "products", "orders", "bookings", "settings"] as const).map((item) => (
          <button key={item} className={cn(buttonClasses(tab === item ? "primary" : "secondary"))} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="text-slate-600">Loading owner workspace...</div></Card>
      ) : null}

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Products" value={String(summary?.totals?.totalProducts || 0)} />
            <Metric title="Low stock" value={String(summary?.totals?.lowStockProducts || 0)} />
            <Metric title="Customers" value={String(summary?.totals?.totalCustomers || 0)} />
            <Metric title="Credit balance" value={asMoney(summary?.totals?.totalCreditBalance || 0)} />
          </div>
          <Card title="Recent invoices">
            <div className="space-y-3">
              {summary?.recentInvoices?.length ? summary.recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4">
                  <div>
                    <div className="font-semibold">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-slate-600">{invoice.customerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{asMoney(invoice.totalAmount)}</div>
                    <div className="text-sm text-slate-600">Due {asMoney(invoice.dueAmount)}</div>
                  </div>
                </div>
              )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No invoices yet.</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === "customers" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card title="Add customer">
            <form className="space-y-4" onSubmit={saveCustomer}>
              <Field label="Name"><input className={textInputClasses()} value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} /></Field>
              <Field label="Phone"><input className={textInputClasses()} value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></Field>
              <Field label="Email"><input className={textInputClasses()} value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></Field>
              <Field label="Address"><textarea className={cn(textInputClasses(), "min-h-[90px]")} value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} /></Field>
              <Field label="Notes"><textarea className={cn(textInputClasses(), "min-h-[90px]")} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} /></Field>
              <Field label="Photo">
                <input type="file" accept="image/*" onChange={(event) => void uploadInto(event, (value) => setCustomerForm((current) => ({ ...current, photoPath: value })))} />
              </Field>
              <button className={cn(buttonClasses("primary"), "w-full")}>Save customer</button>
            </form>
          </Card>
          <Card title="Customers">
            <div className="space-y-3">
              {customers.length ? customers.map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      {customer.photoPath ? (
                        <img src={customer.photoPath} alt={customer.name} className="h-14 w-14 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-xs text-slate-500">No photo</div>
                      )}
                      <div>
                        <div className="font-semibold">{customer.name}</div>
                        <div className="text-sm text-slate-600">{customer.customerCode || "No code"}</div>
                        <div className="text-sm text-slate-600">{customer.phone || "-"}</div>
                      </div>
                    </div>
                    <button className={buttonClasses("danger")} onClick={() => void removeCustomer(customer.id)}>Delete</button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Info label="Credit" value={asMoney(customer.creditBalance)} />
                    <Info label="Total spent" value={asMoney(customer.totalSpent)} />
                  </div>
                </div>
              )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No customers yet.</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
            <Card title="Add category">
              <form className="space-y-4" onSubmit={saveCategory}>
                <Field label="Name"><input className={textInputClasses()} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></Field>
                <Field label="Description"><textarea className={cn(textInputClasses(), "min-h-[90px]")} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /></Field>
                <button className={cn(buttonClasses("primary"), "w-full")}>Save category</button>
              </form>
            </Card>
            <Card title="Add product">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProduct}>
                <Field label="Name"><input className={textInputClasses()} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></Field>
                <Field label="SKU"><input className={textInputClasses()} value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} /></Field>
                <Field label="Price"><input className={textInputClasses()} value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></Field>
                <Field label="Stock quantity"><input className={textInputClasses()} value={productForm.stockQuantity} onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })} /></Field>
                <Field label="Buying price"><input className={textInputClasses()} value={productForm.buyingPrice} onChange={(e) => setProductForm({ ...productForm, buyingPrice: e.target.value })} /></Field>
                <Field label="Unit"><input className={textInputClasses()} value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} /></Field>
                <Field label="Category">
                  <select className={textInputClasses()} value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}>
                    <option value="">Select category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </Field>
                <Field label="Featured">
                  <select className={textInputClasses()} value={productForm.featured ? "yes" : "no"} onChange={(e) => setProductForm({ ...productForm, featured: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description"><textarea className={cn(textInputClasses(), "min-h-[90px]")} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Product image">
                    <input type="file" accept="image/*" onChange={(event) => void uploadInto(event, (value) => setProductForm((current) => ({ ...current, imageUrl: value })))} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <button className={cn(buttonClasses("primary"), "w-full")}>Save product</button>
                </div>
              </form>
            </Card>
          </div>

          <Card title="Products">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.length ? products.map((product) => (
                <div key={product.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="mb-3 overflow-hidden rounded-2xl bg-stone-100">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center text-sm text-slate-500">No image</div>}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-slate-500">{product.categoryName || "General"}</div>
                    <div className="text-lg font-semibold">{product.name}</div>
                    <div className="text-sm text-slate-600">{product.description || "No description."}</div>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{asMoney(product.price)}</div>
                      <div className="text-sm text-slate-600">Stock {product.stockQuantity ?? 0}</div>
                    </div>
                    <button className={cn(buttonClasses("danger"), "w-full")} onClick={() => void removeProduct(product.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No products yet.</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === "orders" && (
        <Card title="Orders">
          <div className="space-y-4">
            {orders.length ? orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Order #{order.id}</div>
                    <div className="text-sm text-slate-600">{order.customerName} • {order.customerPhone}</div>
                    <div className="text-sm text-slate-600">{order.customerAddress}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={order.status} />
                    <StatusBadge value={order.paymentStatus || "unpaid"} />
                  </div>
                </div>
                <div className="mb-3 text-sm text-slate-600">{asDate(order.createdAt)}</div>
                <div className="mb-4 text-lg font-bold">{asMoney(order.totalAmount)}</div>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClasses("secondary")} onClick={() => void updateOrderStatus(order.id, "confirmed")}>Confirm</button>
                  <button className={buttonClasses("secondary")} onClick={() => void updateOrderStatus(order.id, "dispatched")}>Dispatch</button>
                  <button className={buttonClasses("secondary")} onClick={() => void updateOrderStatus(order.id, "delivered", "paid")}>Deliver</button>
                  <button className={buttonClasses("secondary")} onClick={() => void updateOrderStatus(order.id, order.status, "paid")}>Confirm payment</button>
                  <button className={buttonClasses("danger")} onClick={() => void updateOrderStatus(order.id, "cancelled")}>Reject</button>
                </div>
              </div>
            )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No orders yet.</div>}
          </div>
        </Card>
      )}

      {tab === "bookings" && (
        <Card title="Transport bookings">
          <div className="space-y-4">
            {bookings.length ? bookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{booking.serviceType === "tractor" ? "Tractor" : "Bolero"} booking #{booking.id}</div>
                    <div className="text-sm text-slate-600">{booking.customerName} • {booking.customerPhone}</div>
                    <div className="text-sm text-slate-600">{booking.pickupLocation} → {booking.destination}</div>
                  </div>
                  <StatusBadge value={booking.status} />
                </div>
                <div className="mb-4 text-sm text-slate-600">For {booking.bookingDate}</div>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClasses("secondary")} onClick={() => void updateBookingStatus(booking.id, "confirmed")}>Confirm</button>
                  <button className={buttonClasses("secondary")} onClick={() => void updateBookingStatus(booking.id, "completed")}>Complete</button>
                  <button className={buttonClasses("danger")} onClick={() => void updateBookingStatus(booking.id, "rejected")}>Reject</button>
                </div>
              </div>
            )) : <div className="rounded-2xl bg-stone-50 p-4 text-slate-600">No bookings yet.</div>}
          </div>
        </Card>
      )}

      {tab === "settings" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card title="Business settings">
            <form className="space-y-4" onSubmit={saveSettings}>
              <Field label="Shop name"><input className={textInputClasses()} value={settingsForm.shopName} onChange={(e) => setSettingsForm({ ...settingsForm, shopName: e.target.value })} /></Field>
              <Field label="Proprietor name"><input className={textInputClasses()} value={settingsForm.proprietorName} onChange={(e) => setSettingsForm({ ...settingsForm, proprietorName: e.target.value })} /></Field>
              <Field label="Phone"><input className={textInputClasses()} value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} /></Field>
              <Field label="Email"><input className={textInputClasses()} value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} /></Field>
              <Field label="Address"><textarea className={cn(textInputClasses(), "min-h-[90px]")} value={settingsForm.address} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} /></Field>
              <Field label="About text"><textarea className={cn(textInputClasses(), "min-h-[120px]")} value={settingsForm.aboutText} onChange={(e) => setSettingsForm({ ...settingsForm, aboutText: e.target.value })} /></Field>
              <Field label="Terms"><textarea className={cn(textInputClasses(), "min-h-[120px]")} value={settingsForm.termsConditions} onChange={(e) => setSettingsForm({ ...settingsForm, termsConditions: e.target.value })} /></Field>
              <Field label="Shop photo"><input type="file" accept="image/*" onChange={(event) => void uploadInto(event, (value) => setSettingsForm((current) => ({ ...current, shopPhotoPath: value })))} /></Field>
              <Field label="Home banner"><input type="file" accept="image/*" onChange={(event) => void uploadInto(event, (value) => setSettingsForm((current) => ({ ...current, homeBannerPath: value })))} /></Field>
              <button className={cn(buttonClasses("primary"), "w-full")}>Save settings</button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card title="Preview">
              <div className="space-y-4">
                <div className="text-2xl font-bold">{mergedSettings.shopName}</div>
                <div className="text-slate-600">{mergedSettings.address}</div>
                <div className="font-medium">{mergedSettings.phone}</div>
                {mergedSettings.shopPhotoPath ? (
                  <img src={mergedSettings.shopPhotoPath} alt="Shop" className="h-56 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center rounded-2xl bg-stone-100 text-slate-500">No photo yet</div>
                )}
              </div>
            </Card>
            <Card title="Change password">
              <form className="space-y-4" onSubmit={changePassword}>
                <Field label="Current password"><input className={textInputClasses()} type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></Field>
                <Field label="New password"><input className={textInputClasses()} type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></Field>
                <Field label="Confirm new password"><input className={textInputClasses()} type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></Field>
                <button className={cn(buttonClasses("primary"), "w-full")}>Change password</button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <div className="text-sm uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-slate-900">{value}</div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(OWNER_TOKEN_KEY) || "");
  const [settings, setSettings] = useState<PublicSettings>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [settingsData, categoryData, productData] = await Promise.all([
          api<PublicSettings>("/settings"),
          api<Category[]>("/categories"),
          api<Product[]>("/products"),
        ]);
        setSettings(settingsData);
        setCategories(categoryData);
        setProducts(productData);
      } catch {
        // Keep the public shell usable even if one call fails.
      }
    })();
  }, []);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const handleLogin = (nextToken: string) => {
    localStorage.setItem(OWNER_TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(OWNER_TOKEN_KEY);
    setToken("");
  };

  return (
    <Shell settings={settings}>
      <Switch>
        <Route path="/">
          <HomePage settings={settings} />
        </Route>
        <Route path="/catalog">
          <CatalogPage products={products} categories={categories} addToCart={addToCart} />
        </Route>
        <Route path="/checkout">
          <CheckoutPage cart={cart} setCart={setCart} />
        </Route>
        <Route path="/track-order">
          <TrackOrderPage />
        </Route>
        <Route path="/book">
          <BookPage />
        </Route>
        <Route path="/account">
          <AccountPage />
        </Route>
        <Route path="/about">
          <AboutPage settings={settings} />
        </Route>
        <Route path="/terms">
          <TermsPage settings={settings} />
        </Route>
        <Route path="/owner">
          {token ? <OwnerDashboard token={token} onLogout={handleLogout} settings={settings} /> : <OwnerLoginPage onLogin={handleLogin} />}
        </Route>
        <Route>
          <Card title="Page not found">
            <div className="space-y-4">
              <div className="text-slate-600">This page does not exist.</div>
              <Link href="/" className={buttonClasses("primary")}>
                Back to home
              </Link>
            </div>
          </Card>
        </Route>
      </Switch>
    </Shell>
  );
}
