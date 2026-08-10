/**
 * Splitting one supplier bill across the products it covers.
 *
 * Dealer totals are summed from each stock-ledger row's billAmount, so a
 * Rs 10,000 bill written as five rows of Rs 10,000 would make the shop look
 * Rs 40,000 further in debt. Each line therefore has to carry its own share,
 * and the shares have to add back up to the bill exactly — including the last
 * paisa, which is why the final line absorbs the rounding rather than each
 * line rounding independently.
 *
 * Deliberately free of imports so a test can load it directly.
 */

export type DealerBillItem = {
  productId: number;
  quantity: number;
  /** What the supplier's bill charges for this line, when it is itemised. */
  amount?: number;
};

export type AllocatedLine = DealerBillItem & {
  /** This line's share of the bill. */
  amount: number;
  /** This line's share of what was handed over. */
  paid: number;
  /** Still owed on this line. */
  due: number;
};

export const round2 = (value: number) => Math.round(value * 100) / 100;

export function allocateDealerBill(
  items: DealerBillItem[],
  statedBillTotal: number | undefined,
  paidAmount: number,
): { lines: AllocatedLine[]; billTotal: number; paidTotal: number; dueTotal: number } {
  const knownTotal = round2(items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0));
  const billTotal = round2(statedBillTotal ?? knownTotal);

  // Lines the shopkeeper did not price individually share whatever the bill
  // total does not already account for, in proportion to quantity.
  const blankLines = items.filter((item) => item.amount == null);
  const unaccounted = Math.max(0, round2(billTotal - knownTotal));
  const blankQuantity = blankLines.reduce((sum, item) => sum + item.quantity, 0);

  let assignedToBlanks = 0;
  const withAmounts = items.map((item) => {
    if (item.amount != null) return { ...item, amount: Math.max(0, round2(item.amount)) };
    if (blankQuantity <= 0) return { ...item, amount: 0 };
    const isLastBlank = blankLines[blankLines.length - 1] === item;
    const amount = isLastBlank
      ? round2(unaccounted - assignedToBlanks)
      : round2((unaccounted * item.quantity) / blankQuantity);
    assignedToBlanks = round2(assignedToBlanks + amount);
    return { ...item, amount: Math.max(0, amount) };
  });

  // The payment covers the bill, not any one line, so it is spread by value and
  // the last line absorbs the rounding — the parts always add back up.
  let allocatedPaid = 0;
  const lines: AllocatedLine[] = withAmounts.map((line, index) => {
    const isLast = index === withAmounts.length - 1;
    let paid: number;
    if (isLast) {
      paid = round2(paidAmount - allocatedPaid);
    } else if (billTotal > 0) {
      paid = round2((paidAmount * line.amount) / billTotal);
    } else {
      paid = 0;
    }
    paid = Math.max(0, paid);
    allocatedPaid = round2(allocatedPaid + paid);
    return { ...line, paid, due: Math.max(0, round2(line.amount - paid)) };
  });

  return {
    lines,
    billTotal,
    paidTotal: round2(lines.reduce((sum, line) => sum + line.paid, 0)),
    dueTotal: Math.max(0, round2(billTotal - paidAmount)),
  };
}
