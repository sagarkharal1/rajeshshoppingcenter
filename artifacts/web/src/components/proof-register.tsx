"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, Search, ShieldCheck } from "lucide-react";

type ProofRecord = {
  type: string;
  id: number;
  reference: string;
  date: string;
  partyName: string;
  partyPhone?: string | null;
  totalAmount: number;
  amountPaid: number;
  dueAmount: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  note?: string | null;
  proofStatus?: string | null;
};

type ProofRegisterProps = {
  lang?: "en" | "ne";
  api: (url: string, opts?: any) => Promise<any>;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value || 0);

function when(value: string) {
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ProofRegister({ lang = "en", api }: ProofRegisterProps) {
  const [period, setPeriod] = useState<"day" | "month" | "year">("month");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{ records: ProofRecord[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period, date, type, search });
      const result = await api(`/admin/proof-register?${params.toString()}`);
      setData(result);
    } catch {
      setError(lang === "ne" ? "प्रमाण रजिस्टर लोड गर्न सकिएन।" : "Could not load proof register.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period, date, type]);

  const records = data?.records || [];
  const summary = data?.summary || {};
  const typeOptions = useMemo(
    () => [
      ["all", lang === "ne" ? "सबै" : "All"],
      ["invoice", lang === "ne" ? "बिल" : "Invoices"],
      ["payment", lang === "ne" ? "भुक्तानी" : "Payments"],
      ["booking", lang === "ne" ? "बुकिङ" : "Bookings"],
      ["order", lang === "ne" ? "अर्डर" : "Orders"],
      ["dealer", lang === "ne" ? "डिलर" : "Dealers"],
    ],
    [lang],
  );

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            {lang === "ne" ? "व्यवसाय प्रमाण रजिस्टर" : "Business Proof Register"}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {lang === "ne"
              ? "बिल, भौचर, भुक्तानी, बुकिङ, अर्डर र डिलर रेकर्ड एउटै ठाउँमा।"
              : "Invoices, vouchers, payments, bookings, orders, and dealer records in one searchable book."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {lang === "ne" ? "ताजा गर्नुहोस्" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_auto_auto_1fr_auto]">
        <select value={period} onChange={(event) => setPeriod(event.target.value as any)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold">
          <option value="day">{lang === "ne" ? "दैनिक" : "Daily"}</option>
          <option value="month">{lang === "ne" ? "मासिक" : "Monthly"}</option>
          <option value="year">{lang === "ne" ? "वार्षिक" : "Yearly"}</option>
        </select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold">
          {typeOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") load();
            }}
            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm"
            placeholder={lang === "ne" ? "नाम, फोन, बिल नम्बर खोज्नुहोस्" : "Search name, phone, bill or voucher number"}
          />
        </div>
        <button type="button" onClick={load} className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
          {lang === "ne" ? "खोज्नुहोस्" : "Search"}
        </button>
      </div>

      {error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          [lang === "ne" ? "रेकर्ड" : "Records", String(summary.count || 0), "text-slate-950"],
          [lang === "ne" ? "बिल/शुल्क" : "Billed", money(summary.totalBilled || 0), "text-slate-950"],
          [lang === "ne" ? "उठेको" : "Paid", money(summary.totalPaid || 0), "text-emerald-700"],
          [lang === "ne" ? "बाँकी" : "Due", money(summary.totalDue || 0), "text-rose-700"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {records.map((record) => (
          <article key={`${record.type}-${record.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  <FileText className="h-4 w-4" />
                  {record.type} / {record.reference}
                </p>
                <h5 className="mt-1 text-lg font-bold text-slate-950">{record.partyName || "-"}</h5>
                <p className="text-sm text-slate-500">{record.partyPhone || "-"} · {when(record.date)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-slate-950">{money(record.totalAmount)}</p>
                <p className="text-sm font-semibold text-emerald-700">{lang === "ne" ? "तिरेको" : "Paid"}: {money(record.amountPaid)}</p>
                {record.dueAmount > 0 ? <p className="text-sm font-semibold text-rose-700">{lang === "ne" ? "बाँकी" : "Due"}: {money(record.dueAmount)}</p> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{record.paymentMethod || "-"}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{record.paymentStatus || record.status || "-"}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{record.proofStatus || "saved"}</span>
            </div>
            {record.note ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">{record.note}</p> : null}
          </article>
        ))}
        {!loading && records.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{lang === "ne" ? "यो छनोटमा रेकर्ड भेटिएन।" : "No records found for this selection."}</p>
        ) : null}
      </div>
    </section>
  );
}
