"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Landmark,
  MessageCircle,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type MentorEarningRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  course_id: string;
  mentor_user_id: string;
  member_user_id: string;
  participant_name: string;
  currency: string;
  basis_amount: number | string;
  mentor_amount: number | string;
  platform_amount: number | string;
  status: string;
  created_at: string;
};

export type MentorAgreementRow = {
  id: string;
  course_id: string;
  mentor_user_id: string;
  mentor_share_percent: number | string;
  platform_percent: number | string;
  is_active: boolean;
  agreed_at: string;
};

export type MentorWithdrawalRow = {
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

export type MentorCourseLabel = { id: string; title: string };

type Props = {
  mentorName: string;
  mentorHeadline: string | null;
  mentorExpertise: string[];
  earnings: MentorEarningRow[];
  agreements: MentorAgreementRow[];
  withdrawals: MentorWithdrawalRow[];
  courses: MentorCourseLabel[];
  initialError: string | null;
};

function money(value: number | string) {
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
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function maskedAccount(value: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "Tidak tersedia";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Menunggu Admin",
    processing: "Sedang diproses",
    paid: "Sudah dicairkan",
    rejected: "Ditolak",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  if (status === "processing") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-800";
}

export default function MentorEarningsDashboard({
  mentorName,
  mentorHeadline,
  mentorExpertise,
  earnings,
  agreements,
  withdrawals,
  courses,
  initialError,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(mentorName);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"withdrawals" | "purchases">("withdrawals");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<MentorWithdrawalRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const adminWhatsAppNumber = (
    process.env.NEXT_PUBLIC_ALUMNI_ADMIN_WHATSAPP || "6281270885153"
  ).replace(/\D/g, "");

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title] as const)),
    [courses],
  );

  const activeClassCount = agreements.filter(
    (item) => item.is_active,
  ).length;

  const availableEarnings = earnings.filter(
    (item) => item.status === "available",
  );

  const earnedTotal = availableEarnings.reduce(
    (sum, item) => sum + (Number(item.mentor_amount) || 0),
    0,
  );

  const reservedTotal = withdrawals
    .filter((item) =>
      ["pending", "processing", "paid"].includes(item.status),
    )
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const availableTotal = Math.max(0, earnedTotal - reservedTotal);

  const pendingWithdrawals = withdrawals.filter((item) =>
    ["pending", "processing"].includes(item.status),
  );
  const paidWithdrawals = withdrawals.filter((item) => item.status === "paid");
  const pendingWithdrawalTotal = pendingWithdrawals.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const paidWithdrawalTotal = paidWithdrawals.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const mentorRole = mentorHeadline?.trim() || "Mentor/Pengajar Kiki Creator Class";
  const expertiseLabel = (mentorExpertise ?? []).filter(Boolean).join(" · ");

  useEffect(() => {
    if (!isWithdrawalOpen && !selectedWithdrawal) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedWithdrawal) setSelectedWithdrawal(null);
        if (isWithdrawalOpen && !submitting) setIsWithdrawalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [isWithdrawalOpen, selectedWithdrawal, submitting]);

  function openWithdrawal() {
    setFormError("");
    setSuccess("");
    setIsWithdrawalOpen(true);
  }

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setFormError("");
    setSuccess("");

    const requestedAmount = Number(amount);

    let validationError = "";

    if (fullName.trim().length < 3) {
      validationError = "Nama pemilik rekening minimal 3 karakter.";
    } else if (bankName.trim().length < 2) {
      validationError = "Masukkan nama bank atau e-wallet.";
    } else if (!/^\d{6,30}$/.test(accountNumber)) {
      validationError =
        "Nomor rekening harus terdiri dari 6 sampai 30 digit.";
    } else if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      validationError =
        "Nominal penarikan harus lebih besar dari nol.";
    } else if (requestedAmount > availableTotal) {
      validationError =
        "Nominal penarikan melebihi saldo yang tersedia.";
    }

    if (validationError) {
      setFormError(validationError);
      setSubmitting(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "request_mentor_withdrawal",
        {
          p_full_name: fullName.trim(),
          p_bank_name: bankName.trim(),
          p_account_number: accountNumber,
          p_amount: requestedAmount,
        },
      );

      if (rpcError) throw rpcError;

      if (!data) {
        throw new Error(
          "Database tidak mengembalikan ID pengajuan penarikan.",
        );
      }

      setBankName("");
      setAccountNumber("");
      setAmount("");

      setIsWithdrawalOpen(false);

      setSuccess("Pengajuan penarikan berhasil dikirim.");

      router.refresh();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Pengajuan penarikan gagal dikirim.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* TOTAL SALDO DAN TOMBOL AKSI */}

      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#260047] via-[#321052] to-[#09483F] p-5 text-white shadow-[0_16px_38px_rgba(38,0,71,.16)] sm:p-7">

        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-white/[0.07] blur-2xl" />

        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-emerald-300/[0.08] blur-2xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

          <div className="min-w-0">

            <div className="flex items-center gap-2 text-white/75">

              <Wallet size={16} />

              <p className="text-[10px] font-extrabold uppercase tracking-[.2em]">
                Total Saldo
              </p>

            </div>

            <p className="mt-3 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">
              {money(availableTotal)}
            </p>

            <p className="mt-2 text-xs text-white/65">
              Saldo yang tersedia untuk ditarik
            </p>

          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">

            <Link
              href="/mentor/kelas"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <BookOpen size={16} />

              <span>Kelas</span>

              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                {activeClassCount}
              </span>
            </Link>

            <button
              type="button"
              onClick={openWithdrawal}
              disabled={availableTotal <= 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-extrabold text-[#260047] shadow-lg shadow-black/10 transition hover:bg-[#F1EAF7] focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownToLine size={16} />

              <span>Penarikan</span>
            </button>

          </div>

        </div>

      </section>

      {initialError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />

          <span>{initialError}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700"
        >
          <CheckCircle2 size={15} className="shrink-0" />

          {success}
        </div>
      )}

      {/* RINGKASAN PENCAIRAN */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <article className="relative overflow-hidden rounded-[22px] border border-amber-100 bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.045)] sm:p-6">

          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-50" />

          <div className="relative flex items-start justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 size={19} />
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-500">
                  Proses Pencairan
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Menunggu atau sedang diproses
                </p>
              </div>

            </div>

            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
              {pendingWithdrawals.length} transaksi
            </span>

          </div>

          <p className="relative mt-5 text-2xl font-extrabold tracking-tight tabular-nums text-[#26143A] sm:text-[28px]">
            {money(pendingWithdrawalTotal)}
          </p>

        </article>

        <article className="relative overflow-hidden rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.045)] sm:p-6">

          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-50" />

          <div className="relative flex items-start justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={19} />
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-500">
                  Sudah Dicairkan
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Dana yang telah dibayarkan
                </p>
              </div>

            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              {paidWithdrawals.length} transaksi
            </span>

          </div>

          <p className="relative mt-5 text-2xl font-extrabold tracking-tight tabular-nums text-[#087F5B] sm:text-[28px]">
            {money(paidWithdrawalTotal)}
          </p>

        </article>

      </section>

      {/* TAB RIWAYAT PENARIKAN DAN DATA PEMBELIAN */}
      <section className="space-y-4">
        <div className="px-1">
          <h3 className="text-sm font-extrabold text-slate-900">
            Aktivitas Mentor
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Pilih riwayat penarikan atau data pembelian kelas.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Aktivitas pendapatan mentor"
          aria-orientation="horizontal"
          className="grid grid-cols-2 gap-2 rounded-2xl border border-[#EEEAF7] bg-[#F8F6FA] p-1.5"
        >
          <button
            type="button"
            role="tab"
            id="mentor-tab-withdrawals"
            aria-selected={activeTab === "withdrawals"}
            aria-controls="mentor-panel-withdrawals"
            tabIndex={activeTab === "withdrawals" ? 0 : -1}
            onClick={() => setActiveTab("withdrawals")}
            className={`inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-extrabold leading-tight transition sm:gap-2 sm:text-xs ${
              activeTab === "withdrawals"
                ? "bg-white text-[#260047] shadow-sm ring-1 ring-[#EDE8F2]"
                : "text-slate-500 hover:bg-white/70 hover:text-[#260047]"
            }`}
          >
            <Landmark size={15} className="shrink-0" />
            <span>Riwayat Penarikan</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                activeTab === "withdrawals"
                  ? "bg-[#F4EFF8] text-[#5A3475]"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {withdrawals.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="mentor-tab-purchases"
            aria-selected={activeTab === "purchases"}
            aria-controls="mentor-panel-purchases"
            tabIndex={activeTab === "purchases" ? 0 : -1}
            onClick={() => setActiveTab("purchases")}
            className={`inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-extrabold leading-tight transition sm:gap-2 sm:text-xs ${
              activeTab === "purchases"
                ? "bg-white text-[#260047] shadow-sm ring-1 ring-[#EDE8F2]"
                : "text-slate-500 hover:bg-white/70 hover:text-[#260047]"
            }`}
          >
            <BookOpen size={15} className="shrink-0" />
            <span>Data Pembelian</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                activeTab === "purchases"
                  ? "bg-[#E8F4F0] text-[#087F5B]"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {availableEarnings.length}
            </span>
          </button>
        </div>

        <div
          id="mentor-panel-withdrawals"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="mentor-tab-withdrawals"
          hidden={activeTab !== "withdrawals"}
          className="outline-none"
        >
          {/* RIWAYAT PENARIKAN - CARD RINGKAS */}
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Riwayat Penarikan
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Klik transaksi untuk melihat informasi lengkap.
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {withdrawals.length} transaksi
                    </span>
                  </div>

                  {withdrawals.length === 0 ? (
                    <div className="rounded-[22px] border border-[#EEEAF7] bg-white px-5 py-12 text-center shadow-[0_8px_24px_rgba(38,0,71,.04)]">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4EFF8] text-[#5A3475]">
                        <Clock3 size={19} />
                      </div>
                      <p className="mt-3 text-xs font-semibold text-slate-600">
                        Belum ada riwayat penarikan.
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Pengajuan pencairan yang kamu buat akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {withdrawals.map((item) => {
                        const transactionCode = `WD-${item.id.slice(0, 8).toUpperCase()}`;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedWithdrawal(item)}
                            aria-label={`Lihat detail penarikan ${money(item.amount)}, status ${statusLabel(item.status)}`}
                            className="group flex w-full items-center gap-3 rounded-[20px] border border-[#EDE8F2] bg-white p-4 text-left shadow-[0_5px_18px_rgba(38,0,71,.035)] transition hover:-translate-y-0.5 hover:border-[#D8CBE5] hover:shadow-[0_10px_24px_rgba(38,0,71,.07)] focus:outline-none focus:ring-4 focus:ring-[#6D4388]/10 sm:gap-4 sm:p-5"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4EFF8] text-[#5A3475] transition group-hover:bg-[#EDE4F4]">
                              <Landmark size={19} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400">
                                  Penarikan saldo
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusClass(item.status)}`}
                                >
                                  {statusLabel(item.status)}
                                </span>
                              </span>

                              <span className="mt-1 block break-words text-xl font-extrabold tracking-tight tabular-nums text-[#260047] sm:text-[23px]">
                                {money(item.amount)}
                              </span>

                              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <Landmark size={11} />
                                  {item.bank_name || "Rekening tujuan"} · {maskedAccount(item.account_number)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays size={11} />
                                  {dateTime(item.requested_at)}
                                </span>
                              </span>

                              <span className="mt-1 block text-[9px] tracking-wide text-slate-300">
                                {transactionCode}
                              </span>
                            </span>

                            <span className="flex shrink-0 flex-col items-center gap-1 text-[#8B78A0] transition group-hover:text-[#260047]">
                              <ChevronRight size={20} />
                              <span className="hidden text-[9px] font-semibold sm:block">
                                Detail
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
        </div>

        <div
          id="mentor-panel-purchases"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="mentor-tab-purchases"
          hidden={activeTab !== "purchases"}
          className="outline-none"
        >
          {/* DATA PEMBELIAN KELAS */}

                <section className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-[0_8px_24px_rgba(38,0,71,.04)]">

                  <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Data Pembelian Kelas
                    </h3>
                  </div>

                  {availableEarnings.length === 0 ? (

                    <div className="px-5 py-12 text-center">

                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4EFF8] text-[#5A3475]">
                        <BookOpen size={19} />
                      </div>

                      <p className="mt-3 text-xs font-semibold text-slate-600">
                        Belum ada pembelian kelas.
                      </p>

                    </div>

                  ) : (

                    <>

                      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] gap-5 bg-[#FBFAFC] px-6 py-3 text-[10px] font-bold text-slate-400 sm:grid">

                        <span>Peserta</span>

                        <span>Kelas</span>

                        <span className="text-right">
                          Nilai pembelian
                        </span>

                        <span className="min-w-[130px] text-right">
                          Pendapatan Mentor
                        </span>

                      </div>

                      <div className="divide-y divide-slate-100">

                        {availableEarnings.slice(0, 50).map((item) => (

                          <article
                            key={item.id}
                            className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5 sm:px-6"
                          >

                            <div className="min-w-0">

                              <p className="truncate text-xs font-bold text-slate-800">
                                {item.participant_name || "Peserta"}
                              </p>

                              <p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                                <CalendarDays size={12} />
                                {dateTime(item.created_at)}
                              </p>

                            </div>

                            <p className="truncate text-xs font-medium text-slate-600">
                              {courseMap.get(item.course_id) ?? "Kelas"}
                            </p>

                            <div className="flex items-center justify-between gap-3 sm:block sm:text-right">

                              <span className="text-[10px] text-slate-400 sm:hidden">
                                Nilai pembelian
                              </span>

                              <span className="text-xs font-semibold tabular-nums text-slate-600">
                                {money(item.basis_amount)}
                              </span>

                            </div>

                            <div className="flex items-center justify-between gap-3 sm:block sm:min-w-[130px] sm:text-right">

                              <span className="text-[10px] text-slate-400 sm:hidden">
                                Pendapatan Mentor
                              </span>

                              <span className="text-sm font-extrabold tabular-nums text-[#09483F]">
                                {money(item.mentor_amount)}
                              </span>

                            </div>

                          </article>

                        ))}

                      </div>

                    </>

                  )}

                </section>
        </div>
      </section>

      {/* POPUP DETAIL RIWAYAT PENARIKAN */}
      {selectedWithdrawal && (() => {
        const item = selectedWithdrawal;
        const canConfirm = ["pending", "processing"].includes(item.status);
        const transactionCode = `WD-${item.id.slice(0, 8).toUpperCase()}`;
        const whatsappMessage = [
          "Assalamu'alaikum Admin Kiki Creator Class,",
          "",
          "Saya ingin mengonfirmasi pengajuan pencairan saldo mentor.",
          "",
          `Nama Mentor: ${mentorName || "Mentor Kiki Creator Class"}`,
          `Peran: ${mentorRole}`,
          `Bidang keahlian: ${expertiseLabel || "-"}`,
          `Nama pemilik rekening: ${item.full_name_snapshot || mentorName || "-"}`,
          `Nominal penarikan: ${money(item.amount)}`,
          `Bank tujuan: ${item.bank_name || "-"}`,
          `Nomor rekening: ${maskedAccount(item.account_number)}`,
          `ID penarikan: ${item.id}`,
          `Tanggal pengajuan: ${dateTime(item.requested_at)}`,
          `Status: ${statusLabel(item.status)}`,
          "",
          "Mohon bantu periksa dan proses pencairan tersebut. Terima kasih.",
        ].join("\n");
        const whatsappUrl = `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(whatsappMessage)}`;

        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedWithdrawal(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="withdrawal-detail-title"
              className="my-auto w-full max-w-[520px] overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,.28)]"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-[#260047] via-[#321052] to-[#09483F] px-5 pb-6 pt-5 text-white sm:px-6">
                <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/[0.08] blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-white/70">
                      <Landmark size={15} />
                      <span className="text-[9px] font-extrabold uppercase tracking-[.17em]">
                        Detail transaksi
                      </span>
                    </div>
                    <h2
                      id="withdrawal-detail-title"
                      className="mt-2 text-lg font-extrabold tracking-tight"
                    >
                      Penarikan Saldo Mentor
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    aria-label="Tutup detail transaksi"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="relative mt-6">
                  <p className="text-[10px] font-semibold text-white/65">
                    Nominal penarikan
                  </p>
                  <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                    {money(item.amount)}
                  </p>
                  <div className="mt-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${
                        item.status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : item.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="rounded-2xl border border-[#EEEAF7] bg-[#FAF8FC] p-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-slate-400">
                    Informasi mentor
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-slate-800">
                    {mentorName || "Mentor Kiki Creator Class"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {mentorRole}
                  </p>
                  {expertiseLabel && (
                    <p className="mt-1 text-[10px] leading-5 text-slate-400">
                      Bidang keahlian: {expertiseLabel}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-400">
                    Rincian pencairan
                  </p>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 px-4">
                    <div className="flex items-start justify-between gap-4 py-3 text-xs">
                      <span className="text-slate-400">Nama pemilik rekening</span>
                      <span className="text-right font-semibold text-slate-700">
                        {item.full_name_snapshot || mentorName || "-"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-3 text-xs">
                      <span className="text-slate-400">Bank / e-wallet</span>
                      <span className="text-right font-semibold text-slate-700">
                        {item.bank_name || "-"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-3 text-xs">
                      <span className="text-slate-400">Nomor rekening</span>
                      <span className="text-right font-semibold tracking-wide text-slate-700">
                        {maskedAccount(item.account_number)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-3 text-xs">
                      <span className="text-slate-400">Tanggal pengajuan</span>
                      <span className="text-right font-semibold text-slate-700">
                        {dateTime(item.requested_at)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-3 text-xs">
                      <span className="text-slate-400">ID transaksi</span>
                      <span className="text-right font-bold tracking-wide text-slate-700">
                        {transactionCode}
                      </span>
                    </div>
                    {item.reviewed_at && (
                      <div className="flex items-start justify-between gap-4 py-3 text-xs">
                        <span className="text-slate-400">Tanggal ditinjau</span>
                        <span className="text-right font-semibold text-slate-700">
                          {dateTime(item.reviewed_at)}
                        </span>
                      </div>
                    )}
                    {item.status === "paid" && (
                      <div className="flex items-start justify-between gap-4 py-3 text-xs">
                        <span className="text-slate-400">Tanggal pencairan</span>
                        <span className="text-right font-semibold text-emerald-700">
                          {dateTime(item.paid_at || item.reviewed_at || item.requested_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {item.admin_note && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3">
                    <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-rose-500">
                      Catatan Admin
                    </p>
                    <p className="mt-1 text-xs leading-5 text-rose-700">
                      {item.admin_note}
                    </p>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Tutup
                  </button>

                  {canConfirm && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0E9F6E] to-[#087F5B] px-5 text-xs font-extrabold text-white shadow-[0_6px_16px_rgba(8,127,91,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_9px_20px_rgba(8,127,91,.2)] focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    >
                      <MessageCircle size={15} />
                      Konfirmasi Admin
                      <ArrowUpRight size={13} />
                    </a>
                  )}

                  {item.status === "paid" && (
                    <div className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 size={15} />
                      Dana diterima
                    </div>
                  )}

                  {item.status === "rejected" && (
                    <div className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-50 px-5 text-xs font-bold text-rose-700">
                      <AlertCircle size={15} />
                      Pengajuan ditolak
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* POPUP FORM PENARIKAN */}

      {isWithdrawalOpen && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-dialog-title"
            className="my-auto w-full max-w-[480px] overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,.28)]"
          >

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">

              <div>

                <div className="flex items-center gap-2 text-[#09483F]">

                  <Landmark size={17} />

                  <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">
                    Penarikan Saldo
                  </span>

                </div>

                <h2
                  id="withdrawal-dialog-title"
                  className="mt-2 text-lg font-extrabold tracking-tight text-[#260047]"
                >
                  Ajukan Penarikan
                </h2>

              </div>

              <button
                type="button"
                onClick={() => !submitting && setIsWithdrawalOpen(false)}
                disabled={submitting}
                aria-label="Tutup popup"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
              >
                <X size={17} />
              </button>

            </div>

            <form
              onSubmit={submitWithdrawal}
              className="space-y-4 px-5 py-5 sm:px-6"
            >

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F5F1F8] px-4 py-3">

                <span className="text-xs font-medium text-slate-600">
                  Saldo tersedia
                </span>

                <strong className="text-sm font-extrabold tabular-nums text-[#260047]">
                  {money(availableTotal)}
                </strong>

              </div>

              <label className="block text-xs font-bold text-slate-700">

                Nama lengkap pemilik rekening

                <input
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                  placeholder="Nama sesuai rekening"
                />

              </label>

              <label className="block text-xs font-bold text-slate-700">

                Nama bank / e-wallet

                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                  placeholder="Contoh: BCA, BSI, DANA"
                />

              </label>

              <label className="block text-xs font-bold text-slate-700">

                Nomor rekening

                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={30}
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(
                      event.target.value.replace(/\D/g, "").slice(0, 30),
                    )
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                  placeholder="Masukkan nomor rekening"
                />

              </label>

              <label className="block text-xs font-bold text-slate-700">

                Nominal penarikan

                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={Math.floor(availableTotal)}
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                  placeholder="Masukkan nominal"
                />

              </label>

              {formError && (

                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-700"
                >

                  <AlertCircle size={15} className="mt-0.5 shrink-0" />

                  <span>{formError}</span>

                </div>

              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={() => setIsWithdrawalOpen(false)}
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    availableTotal <= 0 ||
                    !fullName.trim() ||
                    !bankName.trim() ||
                    !accountNumber ||
                    !amount
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#260047] to-[#09483F] px-5 text-xs font-extrabold text-white shadow-lg shadow-[#260047]/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Mengirim..." : "Ajukan Penarikan"}

                  {!submitting && <ArrowDownToLine size={15} />}
                </button>

              </div>

            </form>

          </section>

        </div>

      )}

    </div>
  );
}