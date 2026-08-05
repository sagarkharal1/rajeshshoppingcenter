/**
 * What a product costs the customer right now, for display.
 *
 * Mirrors effectivePrice() in the API server. This is only ever for showing a
 * price — the server decides what is actually charged, so a stale page or a
 * tampered browser cannot invent a discount.
 */
export type SaleFields = {
  price?: unknown;
  salePrice?: unknown;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
};

const toNumber = (value: unknown) => Number(value ?? 0);

export function salePriceInfo(product: SaleFields, now: Date = new Date()) {
  const normalPrice = toNumber(product.price);
  const sale = product.salePrice == null ? null : toNumber(product.salePrice);

  // A sale that is not lower than normal is a data-entry slip, not an offer.
  const validSale = sale != null && Number.isFinite(sale) && sale > 0 && sale < normalPrice;
  const startsAt = product.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product.saleEndsAt ? new Date(product.saleEndsAt) : null;
  const inWindow = (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
  const onSale = Boolean(validSale && inWindow);

  const price = onSale ? (sale as number) : normalPrice;
  return {
    onSale,
    price,
    normalPrice,
    saving: onSale ? normalPrice - price : 0,
    savingPercent: onSale && normalPrice > 0 ? Math.round(((normalPrice - price) / normalPrice) * 100) : 0,
  };
}
