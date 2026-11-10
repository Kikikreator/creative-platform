"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

export type RevenueEarning = {
  id: string;
  order_id: string;
  order_item_id: string;
  course_id: string;
  mentor_user_id: string;
  member_user_id: string;
  currency: string;
  basis_amount: number | string;
  mentor_amount: number | string;
  platform_amount: number | string;
  status: string;
  created_at: string;
};

export type RevenueWithdrawal = {
  id: string;
  mentor_user_id: string;
  full_name_snapshot: string;
  bank_name: string;
  account_number: string;
  amount: number | string;
  currency: string;
  status: string;
  admin_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
};

export type RevenueCourse = { id: string; title: string };

type Props = {
  orders: RevenueOrder[];
  profiles: RevenueProfile[];
  earnings: RevenueEarning[];
  withdrawals: RevenueWithdrawal[];
  courses: RevenueCourse[];
  error: string | null;
};

function currency(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: string) {
  if (status === "pending") return "Menunggu Admin";
  if (status === "processing") return "Sedang diproses";
  if (status === "paid") return "Sudah dibayar";
  if (status === "rejected") return "Ditolak";
  if (status === "reversed") return "Dibatalkan";
  return status;
}

export default function RevenueDashboard({ orders, profiles, earnings, withdrawals, courses, error }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const profileMap = new Map<string, string | null>(profiles.map((profile) => [profile.id, profile.full_name] as const));
  const courseMap = new Map<string, string>(courses.map((course) => [course.id, course.title] as const));
  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const availableEarnings = earnings.filter((item) => item.status === "available");
  const mentorPayoutTotal = availableEarnings.reduce((sum, item) => sum + (Number(item.mentor_amount) || 0), 0);
  const platformShareTotal = availableEarnings.reduce((sum, item) => sum + (Number(item.platform_amount) || 0), 0);
  const pendingWithdrawals = withdrawals.filter((item) => item.status === "pending" || item.status === "processing");
  const paidWithdrawals = withdrawals.filter((item) => item.status === "paid");
  const pendingWithdrawalTotal = pendingWithdrawals.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paidWithdrawalTotal = paidWithdrawals.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const value = orders
        .filter((order) => {
          const created = new Date(order.created_at);
          return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
        })
        .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      return { key, label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date), value };
    });
  }, [orders]);
  const maxMonth = Math.max(...monthly.map((item) => item.value), 1);

  const mentorSummaries = useMemo(() => {
    const map = new Map<string, { mentorId: string; amount: number; platform: number; count: number }>();
    for (const item of availableEarnings) {
      const current = map.get(item.mentor_user_id) ?? { mentorId: item.mentor_user_id, amount: 0, platform: 0, count: 0 };
      current.amount += Number(item.mentor_amount) || 0;
      current.platform += Number(item.platform_amount) || 0;
      current.count += 1;
      map.set(item.mentor_user_id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [availableEarnings]);

  async function reviewWithdrawal(item: RevenueWithdrawal, decision: "processing" | "paid" | "rejected") {
    const note = notes[item.id]?.trim() ?? "";
    if (decision === "rejected" && !note) {
      setActionError("Catatan penolakan wajib diisi sebelum pengajuan ditolak.");
      return;
    }
    setBusyId(item.id);
    setActionError("");
    setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("admin_review_mentor_withdrawal", {
        p_request_id: item.id,
        p_decision: decision,
        p_note: note || null,
      });
      if (rpcError) throw rpcError;
      setNotice(decision === "processing" ? "Pengajuan penarikan dipindahkan ke status sedang diproses." : decision === "paid" ? "Penarikan berhasil ditandai sudah dibayar." : "Pengajuan penarikan berhasil ditolak.");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal memperbarui status penarikan.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-page-heading">
        <div>
          <p className="app-eyebrow">Finance overview</p>
          <h2 className="app-page-title">Pendapatan</h2>
          <p className="app-page-description">Pantau transaksi kelas, pembagian hasil mentor, dan pengajuan penarikan.</p>
        </div>
        <span className="rounded-full bg-[#e9e7f1] px-3 py-2 text-[10px] font-bold text-[#463b68]">{orders.length} pesanan berhasil</span>
      </div>

      {error && <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">Sebagian data pendapatan belum dapat dimuat: {error}</div>}
      {actionError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} className="mt-0.5 shrink-0" />{actionError}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{notice}</div>}
      {pendingWithdrawals.length > 0 && <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><Clock3 size={17} className="mt-0.5 shrink-0" /><div><p className="font-extrabold">Ada {pendingWithdrawals.length} pengajuan penarikan Mentor yang memerlukan tindakan Admin.</p><p className="mt-1 text-[10px] leading-5">Periksa nama pemilik rekening, bank, nomor rekening, dan nominal sebelum memproses pembayaran.</p></div></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Total pembayaran", value: currency(totalRevenue), note: "Akumulasi pesanan paid", icon: Wallet },
          { label: "Bagian mentor", value: currency(mentorPayoutTotal), note: "Ledger dari peserta dengan akses aktif", icon: Banknote },
          { label: "Bagian platform", value: currency(platformShareTotal), note: "Bagian platform dari ledger 80:20", icon: TrendingUp },
          { label: "Pesanan berhasil", value: orders.length.toLocaleString("id-ID"), note: "Pesanan terverifikasi", icon: ReceiptText },
          { label: "Penarikan diproses", value: currency(pendingWithdrawalTotal), note: "Menunggu atau sedang diproses", icon: Clock3 },
          { label: "Penarikan dibayar", value: currency(paidWithdrawalTotal), note: "Total penarikan yang sudah lunas", icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return <article key={item.label} className="app-stat-card min-w-0"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{item.label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#efedf5] text-[#51436f]"><Icon size={17} /></span></div><p className="mt-3 break-words text-xl font-extrabold tracking-tight text-[#1c2340] sm:text-2xl">{item.value}</p><p className="mt-1 text-[10px] text-slate-400">{item.note}</p></article>;
        })}
      </div>

      <section className="app-surface p-5 sm:p-6">
        <div className="mb-5"><h3 className="text-sm font-bold text-[#202742]">Pendapatan enam bulan terakhir</h3><p className="mt-1 text-[11px] text-slate-500">Berdasarkan tanggal pesanan berhasil dibayar.</p></div>
        <div className="grid grid-cols-6 items-end gap-2 sm:gap-4">{monthly.map((month) => <div key={month.key} className="flex min-w-0 flex-col items-center gap-2"><span className="max-w-full truncate text-center text-[9px] font-semibold text-slate-500">{month.value ? currency(month.value) : "—"}</span><div className="flex h-36 w-full items-end rounded-xl bg-[#f2f1f7] p-1.5"><div className="w-full rounded-lg bg-gradient-to-t from-[#263b60] to-[#69578a] transition-all" style={{ height: `${month.value ? Math.max(8, (month.value / maxMonth) * 100) : 3}%` }} title={currency(month.value)} /></div><span className="text-[10px] font-bold text-[#51436f]">{month.label}</span></div>)}</div>
      </section>

      <section className="app-surface overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-[#202742]">Ringkasan pendapatan mentor</h3><p className="mt-1 text-[11px] text-slate-500">Bagian mentor dihitung dari pesanan paid yang cocok dengan enrollment aktif dan kesepakatan kelas.</p></div>
        {mentorSummaries.length === 0 ? <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada pendapatan mentor yang tercatat.</p> : <div className="divide-y divide-slate-100">{mentorSummaries.map((item) => <div key={item.mentorId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-bold text-slate-800">{profileMap.get(item.mentorId) || "Mentor"}</p><p className="mt-1 text-[9px] text-slate-400">{item.count} item transaksi · ID {item.mentorId}</p></div><div className="flex flex-wrap gap-4"><div><p className="text-[9px] text-slate-400">Bagian mentor</p><p className="text-xs font-extrabold text-[#260047]">{currency(item.amount)}</p></div><div><p className="text-[9px] text-slate-400">Bagian platform</p><p className="text-xs font-bold text-[#09483F]">{currency(item.platform)}</p></div></div></div>)}</div>}
      </section>

      <section className="app-surface overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-[#202742]">Data pembelian kelas yang menghasilkan pendapatan</h3><p className="mt-1 text-[11px] text-slate-500">Peserta, kelas, nilai transaksi, dan bagian Mentor setelah pembagian 80:20.</p></div>
        {earnings.filter((item) => item.status === "available").length === 0 ? <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada transaksi yang memenuhi syarat pembagian hasil.</p> : <div className="divide-y divide-slate-100">{earnings.filter((item) => item.status === "available").slice(0, 40).map((item) => <article key={item.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-bold text-slate-800">{profileMap.get(item.member_user_id) || "Peserta"}</p><p className="mt-1 truncate text-[10px] text-slate-500">{courseMap.get(item.course_id) || "Kelas"} · Mentor: {profileMap.get(item.mentor_user_id) || "Mentor"}</p><p className="mt-1 text-[9px] text-slate-400">{dateTime(item.created_at)} · Invoice {item.order_id.slice(0, 8)}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div><p className="text-[9px] text-slate-400">Nilai transaksi</p><p className="text-[10px] font-semibold text-slate-600">{currency(item.basis_amount)}</p></div><div className="text-right"><p className="text-[9px] text-slate-400">Bagian Mentor</p><p className="text-xs font-extrabold text-[#09483F]">{currency(item.mentor_amount)}</p></div></div></article>)}</div>}
      </section>

      <section className="app-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold text-[#202742]">Permintaan penarikan mentor</h3><p className="mt-1 text-[11px] text-slate-500">Admin memproses, menandai pembayaran, atau menolak dengan catatan.</p></div><Banknote size={19} className="text-[#51436f]" /></div>
        {withdrawals.length === 0 ? <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada permintaan penarikan.</p> : <div className="divide-y divide-slate-100">{withdrawals.map((item) => {
          const canReview = item.status === "pending" || item.status === "processing";
          return <article key={item.id} className="space-y-3 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-800">{item.full_name_snapshot || profileMap.get(item.mentor_user_id) || "Mentor"}</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${item.status === "paid" ? "bg-emerald-50 text-emerald-700" : item.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{statusLabel(item.status)}</span></div><p className="mt-1 text-[10px] text-slate-600">{item.bank_name} · {item.account_number}</p><p className="mt-1 text-[9px] text-slate-400">Diajukan {dateTime(item.requested_at)} · ID {item.mentor_user_id}</p>{item.admin_note && <p className="mt-1 text-[10px] text-rose-700">Catatan: {item.admin_note}</p>}</div>
              <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end"><p className="text-base font-extrabold tabular-nums text-[#260047]">{currency(item.amount)}</p><p className="text-[9px] text-slate-400">{item.status === "paid" && item.paid_at ? `Dibayar ${dateTime(item.paid_at)}` : ""}</p></div>
            </div>
            {canReview && <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_auto] lg:items-end"><label className="block text-[9px] font-bold text-slate-500">Catatan Admin (wajib jika menolak)<input value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-[10px] outline-none focus:border-violet-500" placeholder="Tambahkan catatan jika diperlukan" /></label><div className="flex flex-wrap gap-2">{item.status === "pending" && <button type="button" disabled={busyId === item.id} onClick={() => void reviewWithdrawal(item, "processing")} className="h-9 rounded-lg bg-[#260047] px-3 text-[10px] font-bold text-white disabled:opacity-50">{busyId === item.id ? "Memproses..." : "Proses"}</button>}{item.status === "processing" && <button type="button" disabled={busyId === item.id} onClick={() => void reviewWithdrawal(item, "paid")} className="h-9 rounded-lg bg-[#09483F] px-3 text-[10px] font-bold text-white disabled:opacity-50">Tandai Dibayar</button>}<button type="button" disabled={busyId === item.id} onClick={() => void reviewWithdrawal(item, "rejected")} className="h-9 rounded-lg border border-rose-200 px-3 text-[10px] font-bold text-rose-700 disabled:opacity-50">Tolak</button></div></div>}
          </article>;
        })}</div>}
      </section>

      <section className="app-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold text-[#202742]">Pesanan berhasil terbaru</h3><p className="mt-1 text-[11px] text-slate-500">Total pembayaran invoice dari peserta.</p></div><ReceiptText size={19} className="text-[#51436f]" /></div>
        <div className="divide-y divide-slate-100">{orders.length === 0 ? <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada pesanan berhasil.</p> : orders.slice(0, 30).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="break-all text-xs font-bold text-[#202742]">{order.invoice_number}</p><p className="mt-1 text-[10px] text-slate-500">{profileMap.get(order.user_id) || "Member"}</p><p className="mt-1 text-[10px] text-slate-400">{dateTime(order.created_at)}</p></div><p className="text-sm font-extrabold tabular-nums text-[#263b60]">{currency(Number(order.total) || 0)}</p></div>)}</div>
      </section>

      <p className="text-[9px] leading-5 text-slate-400">Dasar perhitungan ledger: total invoice setelah diskon dialokasikan secara proporsional ke item kelas. Biaya transfer/payment provider tidak dikurangi pada tahap ini. Jika kebijakan dasar hitung berbeda, migrasi perlu disesuaikan sebelum dijalankan.</p>
    </div>
  );
}
