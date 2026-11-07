"use client";

import { Banknote, ReceiptText, TrendingUp, Wallet } from "lucide-react";

export type RevenueOrder = {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  total: number | string;
  currency: string;
  created_at: string;
};

export type RevenueProfile = {
  id: string;
  full_name: string | null;
};

type Props = {
  orders: RevenueOrder[];
  profiles: RevenueProfile[];
  error: string | null;
};

function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RevenueDashboard({ orders, profiles, error }: Props) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const averageOrder = orders.length ? totalRevenue / orders.length : 0;

  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const value = orders
      .filter((order) => {
        const created = new Date(order.created_at);
        return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
      })
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    return {
      key,
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
      value,
    };
  });
  const maxMonth = Math.max(...monthly.map((item) => item.value), 1);

  return (
    <div className="space-y-6">
      <div className="app-page-heading">
        <div>
          <p className="app-eyebrow">Finance overview</p>
          <h2 className="app-page-title">Pendapatan</h2>
          <p className="app-page-description">
            Ringkasan pendapatan dari pesanan dengan status berhasil dibayar.
          </p>
        </div>
        <span className="rounded-full bg-[#e9e7f1] px-3 py-2 text-[10px] font-bold text-[#463b68]">
          {orders.length} pesanan berhasil
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Sebagian data pendapatan belum dapat dimuat: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Total pendapatan", value: currency(totalRevenue), note: "Akumulasi pesanan paid", icon: Wallet },
          { label: "Pesanan berhasil", value: orders.length.toLocaleString("id-ID"), note: "Pesanan terverifikasi", icon: ReceiptText },
          { label: "Rata-rata transaksi", value: currency(averageOrder), note: "Nilai rata-rata per pesanan", icon: TrendingUp },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="app-stat-card min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#efedf5] text-[#51436f]">
                  <Icon size={17} />
                </span>
              </div>
              <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-[#1c2340]">{item.value}</p>
              <p className="mt-1 text-[10px] text-slate-400">{item.note}</p>
            </article>
          );
        })}
      </div>

      <section className="app-surface p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-sm font-bold text-[#202742]">Pendapatan enam bulan terakhir</h3>
          <p className="mt-1 text-[11px] text-slate-500">Dihitung berdasarkan tanggal pesanan berhasil dibayar.</p>
        </div>
        <div className="grid grid-cols-6 items-end gap-2 sm:gap-4">
          {monthly.map((month) => (
            <div key={month.key} className="flex min-w-0 flex-col items-center gap-2">
              <span className="max-w-full truncate text-center text-[9px] font-semibold text-slate-500">
                {month.value ? currency(month.value) : "—"}
              </span>
              <div className="flex h-36 w-full items-end rounded-xl bg-[#f2f1f7] p-1.5">
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-[#263b60] to-[#69578a] transition-all"
                  style={{ height: `${month.value ? Math.max(8, (month.value / maxMonth) * 100) : 3}%` }}
                  title={currency(month.value)}
                />
              </div>
              <span className="text-[10px] font-bold text-[#51436f]">{month.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="app-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#202742]">Pesanan berhasil terbaru</h3>
            <p className="mt-1 text-[11px] text-slate-500">Riwayat transaksi yang dihitung sebagai pendapatan.</p>
          </div>
          <Banknote size={19} className="text-[#51436f]" />
        </div>
        <div className="divide-y divide-slate-100">
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada pesanan berhasil.</p>
          ) : orders.slice(0, 30).map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="break-all text-xs font-bold text-[#202742]">{order.invoice_number}</p>
                <p className="mt-1 text-[10px] text-slate-500">{profileMap.get(order.user_id) || "Member"}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}
                </p>
              </div>
              <p className="text-sm font-extrabold tabular-nums text-[#263b60]">{currency(Number(order.total) || 0)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
