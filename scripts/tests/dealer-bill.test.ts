/**
 * Splitting one supplier bill across several products.
 *
 * Unlike the other suites, this imports the shipping module directly rather
 * than replaying its arithmetic, so the test cannot quietly drift from the code
 * the server runs.
 *
 * What matters here is that the parts add back up. Dealer totals are summed
 * from the per-line amounts, so if the split loses or gains a rupee the shop's
 * record of what it owes a supplier is wrong — and that is money someone will
 * eventually come asking for.
 */
import { allocateDealerBill, round2 } from "../../artifacts/api-server/src/lib/dealer-bill.js";

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));

// ── Itemised bill, paid in full ──────────────────────────────────────────────
{
  const { lines, billTotal, paidTotal } = allocateDealerBill(
    [
      { productId: 1, quantity: 10, amount: 5000 },
      { productId: 2, quantity: 5, amount: 3000 },
      { productId: 3, quantity: 2, amount: 2000 },
    ],
    undefined,
    10000,
  );
  check("itemised bill totals the lines", billTotal === 10000, `${billTotal}`);
  check("line amounts add back to the bill", sum(lines.map((l) => l.amount)) === 10000);
  check("paid in full leaves nothing owed", sum(lines.map((l) => l.due)) === 0);
  check("allocated payment equals what was handed over", paidTotal === 10000, `${paidTotal}`);
}

// ── Part payment spreads across the lines ────────────────────────────────────
{
  const { lines, paidTotal } = allocateDealerBill(
    [
      { productId: 1, quantity: 10, amount: 5000 },
      { productId: 2, quantity: 5, amount: 3000 },
      { productId: 3, quantity: 2, amount: 2000 },
    ],
    undefined,
    4000,
  );
  check("part payment is fully allocated", paidTotal === 4000, `${paidTotal}`);
  check("outstanding equals bill minus paid", sum(lines.map((l) => l.due)) === 6000, `${sum(lines.map((l) => l.due))}`);
  check("biggest line takes the biggest share", lines[0].paid >= lines[1].paid && lines[1].paid >= lines[2].paid);
  check("no line is paid more than it is worth", lines.every((l) => l.paid <= l.amount + 0.01));
}

// ── Rounding: thirds must not lose a paisa ───────────────────────────────────
{
  const { paidTotal } = allocateDealerBill(
    [
      { productId: 1, quantity: 1, amount: 3333.33 },
      { productId: 2, quantity: 1, amount: 3333.33 },
      { productId: 3, quantity: 1, amount: 3333.34 },
    ],
    undefined,
    5000,
  );
  check("awkward thirds still allocate exactly", paidTotal === 5000, `${paidTotal}`);
}

{
  // Seven lines and a payment that does not divide cleanly — the classic way a
  // per-line rounding loses money.
  const items = Array.from({ length: 7 }, (_, i) => ({ productId: i + 1, quantity: 1, amount: 1000 }));
  const { paidTotal, lines } = allocateDealerBill(items, undefined, 1234.56);
  check("seven-way split allocates exactly", paidTotal === 1234.56, `${paidTotal}`);
  check("seven-way split has no negative share", lines.every((l) => l.paid >= 0));
}

// ── Unpriced lines share the bill total by quantity ──────────────────────────
{
  const { lines, billTotal } = allocateDealerBill(
    [
      { productId: 1, quantity: 30 },
      { productId: 2, quantity: 10 },
    ],
    8000,
    0,
  );
  check("stated bill total is honoured", billTotal === 8000);
  check("blank lines share out the whole bill", sum(lines.map((l) => l.amount)) === 8000, `${sum(lines.map((l) => l.amount))}`);
  check("shared out by quantity, 30 vs 10", lines[0].amount === 6000 && lines[1].amount === 2000, `${lines[0].amount} / ${lines[1].amount}`);
}

// ── Mixed: some lines priced, some blank ─────────────────────────────────────
{
  const { lines, billTotal } = allocateDealerBill(
    [
      { productId: 1, quantity: 4, amount: 2500 },
      { productId: 2, quantity: 6 },
      { productId: 3, quantity: 2 },
    ],
    10000,
    0,
  );
  check("mixed bill keeps the stated total", billTotal === 10000);
  check("priced line keeps its own amount", lines[0].amount === 2500);
  check("the rest is shared by quantity", lines[1].amount === 5625 && lines[2].amount === 1875, `${lines[1].amount} / ${lines[2].amount}`);
  check("mixed lines still add to the bill", sum(lines.map((l) => l.amount)) === 10000);
}

// ── Edge cases ───────────────────────────────────────────────────────────────
{
  const single = allocateDealerBill([{ productId: 1, quantity: 3, amount: 750 }], undefined, 750);
  check("single line pays off cleanly", single.lines[0].due === 0 && single.paidTotal === 750);

  const nothingPaid = allocateDealerBill([{ productId: 1, quantity: 1, amount: 500 }], undefined, 0);
  check("nothing paid leaves the whole bill owed", nothingPaid.dueTotal === 500 && nothingPaid.paidTotal === 0);

  const freeGoods = allocateDealerBill([{ productId: 1, quantity: 5 }], undefined, 0);
  check("a bill with no amounts at all is zero, not NaN", freeGoods.billTotal === 0 && freeGoods.lines[0].amount === 0);

  const overpaid = allocateDealerBill(
    [
      { productId: 1, quantity: 1, amount: 400 },
      { productId: 2, quantity: 1, amount: 600 },
    ],
    undefined,
    1200,
  );
  check("overpayment is still fully accounted for", overpaid.paidTotal === 1200, `${overpaid.paidTotal}`);
  check("overpayment leaves nothing owed", overpaid.dueTotal === 0);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${"=".repeat(64)}\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exit(1);
