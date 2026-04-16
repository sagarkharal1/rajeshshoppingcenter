import {
  Apple,
  Beef,
  BusFront,
  FlameKindling,
  Grid2X2,
  Hammer,
  Package,
  Cigarette,
  Shirt,
  ShoppingBasket,
  Footprints,
  Soup,
  Store,
  Wallet,
  Wine,
} from "lucide-react";

const iconMap = {
  grid: Grid2X2,
  general: Package,
  grocery: ShoppingBasket,
  vegetables: Apple,
  fruits: Apple,
  foods: Soup,
  gas: FlameKindling,
  clothes: Shirt,
  shoes: Footprints,
  hardware: Hammer,
  beverages: Wine,
  smoke: Cigarette,
  tobacco: Cigarette,
  transport: BusFront,
  remittance: Wallet,
  alcohol: Wine,
  meat: Beef,
  default: Store,
} as const;

export function CategoryIcon({
  icon,
  className = "h-8 w-8",
}: {
  icon?: string | null;
  className?: string;
}) {
  const normalized = (icon || "").trim().toLowerCase();
  const Icon = iconMap[normalized as keyof typeof iconMap] || iconMap.default;
  return <Icon className={className} />;
}
