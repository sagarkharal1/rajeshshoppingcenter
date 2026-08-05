/**
 * What a product actually sells for right now.
 *
 * A sale price only applies inside its window, and only if it is genuinely
 * lower than the normal price — a "sale" that charges more would be a
 * data-entry mistake, and the customer should never pay for it.
 *
 * Every path that puts a price on a bill or an order must go through this,
 * on the server, so a browser can never claim a discount that is not running.
 */
export type PricedProduct = {
  price: unknown;
  salePrice?: unknown;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
};

const toNumber = (value: unknown) => Number(value ?? 0);

export function saleIsRunning(product: PricedProduct, now: Date = new Date()): boolean {
  const sale = product.salePrice == null ? null : toNumber(product.salePrice);
  if (sale == null || !Number.isFinite(sale) || sale <= 0) return false;
  if (sale >= toNumber(product.price)) return false;

  const startsAt = product.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product.saleEndsAt ? new Date(product.saleEndsAt) : null;
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}

export function effectivePrice(product: PricedProduct, now: Date = new Date()): number {
  return saleIsRunning(product, now) ? toNumber(product.salePrice) : toNumber(product.price);
}

/** Everything a screen needs to show a price, with the saving spelled out. */
export function priceInfo(product: PricedProduct, now: Date = new Date()) {
  const onSale = saleIsRunning(product, now);
  const normalPrice = toNumber(product.price);
  const price = onSale ? toNumber(product.salePrice) : normalPrice;
  return {
    price,
    normalPrice,
    onSale,
    saving: onSale ? normalPrice - price : 0,
    savingPercent: onSale && normalPrice > 0 ? ((normalPrice - price) / normalPrice) * 100 : 0,
  };
}
