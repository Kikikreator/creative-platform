"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CalendarDays,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
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

export type RevenueCourse = {
  id: string;
  title: string;
};

type Props = {
  orders: RevenueOrder[];
  profiles: RevenueProfile[];
  earnings: RevenueEarning[];
  withdrawals: RevenueWithdrawal[];
  courses: RevenueCourse[];
  error: string | null;
};

type ActiveTab = "earnings" | "withdrawals";
type PeriodKey = "today" | "7d" | "30d" | "90d" | "12m" | "custom";

type DateRange = {
  start: Date;
  end: Date;
};

type ChartBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  mentor: number;
  platform: number;
  total: number;
};

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hari ini",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  "12m": "12 bulan terakhir",
  custom: "Rentang khusus",
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string, endOfDay = false): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function isWithinRange(value: string | null, range: DateRange) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp >= range.start.getTime() &&
    timestamp <= range.end.getTime()
  );
}

function formatRangeDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(value);
}

function buildChartBuckets(
  range: DateRange,
  earnings: RevenueEarning[],
): ChartBucket[] {
  const firstDay = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate(),
  );
  const lastDay = new Date(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate(),
  );
  const dayCount =
    Math.round((lastDay.getTime() - firstDay.getTime()) / 86400000) + 1;

  const slots: Array<{ key: string; label: string; start: Date; end: Date }> = [];

  if (dayCount <= 1) {
    for (let hour = 0; hour < 24; hour += 4) {
      const start = new Date(firstDay);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(firstDay);
      end.setHours(hour + 4, 0, 0, -1);
      slots.push({
        key: `hour-${hour}`,
        label: `${String(hour).padStart(2, "0")}.00`,
        start,
        end,
      });
    }
  } else if (dayCount <= 14) {
    for (
      let cursor = new Date(firstDay);
      cursor <= lastDay;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      slots.push({
        key: `day-${toDateInputValue(start)}`,
        label: formatShortDate(start),
        start,
        end,
      });
    }
  } else if (dayCount <= 60) {
    for (
      let cursor = new Date(firstDay);
      cursor <= lastDay;
    ) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (end > lastDay) {
        end.setTime(lastDay.getTime());
        end.setHours(23, 59, 59, 999);
      }

      slots.push({
        key: `week-${toDateInputValue(start)}`,
        label: `${formatShortDate(start)}–${formatShortDate(end)}`,
        start,
        end,
      });

      cursor = new Date(end);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
  } else {
    for (
      let cursor = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
      cursor <= lastDay;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const start =
        monthStart < range.start ? new Date(range.start) : monthStart;
      const end = monthEnd > range.end ? new Date(range.end) : monthEnd;

      slots.push({
        key: `month-${cursor.getFullYear()}-${cursor.getMonth()}`,
        label: new Intl.DateTimeFormat("id-ID", {
          month: "short",
          year: "2-digit",
        }).format(cursor),
        start,
        end,
      });
    }
  }

  return slots.map((slot) => {
    const rows = earnings.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return (
        Number.isFinite(createdAt) &&
        createdAt >= slot.start.getTime() &&
        createdAt <= slot.end.getTime()
      );
    });

    const mentor = rows.reduce(
      (sum, item) => sum + (Number(item.mentor_amount) || 0),
      0,
    );
    const platform = rows.reduce(
      (sum, item) => sum + (Number(item.platform_amount) || 0),
      0,
    );

    return {
      ...slot,
      mentor,
      platform,
      total: mentor + platform,
    };
  });
}

function currency(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    available: "Tersedia",
    pending: "Menunggu Admin",
    processing: "Sedang diproses",
    paid: "Sudah dibayar",
    rejected: "Ditolak",
    reversed: "Dibatalkan",
    withdrawn: "Sudah ditarik",
  };

  return labels[status] ?? status;
}

function statusStyle(status: string) {
  if (status === "paid" || status === "available" || status === "withdrawn") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected" || status === "reversed") {
    return "border-rose-100 bg-rose-50 text-rose-700";
  }

  return "border-amber-100 bg-amber-50 text-amber-800";
}

function maskAccount(value: string) {
  if (!value) return "-";
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function DetailRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-slate-50 px-3 py-3">
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      <span className={`break-words text-xs font-semibold text-slate-800 ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

export default function RevenueDashboard({
  orders,
  profiles,
  earnings,
  withdrawals,
  courses,
  error,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>("earnings");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEarning, setSelectedEarning] = useState<RevenueEarning | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<RevenueWithdrawal | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("12m");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const initialToday = new Date();
  const initialYearAgo = new Date(initialToday);
  initialYearAgo.setFullYear(initialYearAgo.getFullYear() - 1);
  const [customStart, setCustomStart] = useState(toDateInputValue(initialYearAgo));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(initialToday));

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.full_name] as const)),
    [profiles],
  );

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title] as const)),
    [courses],
  );

  const customStartDate = parseLocalDate(customStart);
  const customEndDate = parseLocalDate(customEnd, true);
  const customRangeValid =
    !!customStartDate &&
    !!customEndDate &&
    customStartDate.getTime() <= customEndDate.getTime();

  const dateRange = useMemo<DateRange>(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    if (period === "custom") {
      return {
        start: parseLocalDate(customStart) ?? startOfToday,
        end: parseLocalDate(customEnd, true) ?? endOfToday,
      };
    }

    const start = new Date(startOfToday);

    if (period === "7d") start.setDate(start.getDate() - 6);
    if (period === "30d") start.setDate(start.getDate() - 29);
    if (period === "90d") start.setDate(start.getDate() - 89);
    if (period === "12m") start.setFullYear(start.getFullYear() - 1);

    return { start, end: endOfToday };
  }, [period, customStart, customEnd]);

  const dateRangeText = `${formatRangeDate(dateRange.start)} – ${formatRangeDate(dateRange.end)}`;

  const ordersInRange = useMemo(
    () => orders.filter((order) => isWithinRange(order.created_at, dateRange)),
    [orders, dateRange],
  );

  // Ringkasan pembagian hasil tetap menggunakan ledger available,
  // lalu dibatasi berdasarkan periode transaksi yang dipilih.
  const availableEarnings = useMemo(
    () => earnings.filter((item) => item.status === "available"),
    [earnings],
  );

  const availableEarningsInRange = useMemo(
    () =>
      availableEarnings.filter((item) =>
        isWithinRange(item.created_at, dateRange),
      ),
    [availableEarnings, dateRange],
  );

  const totalRevenue = useMemo(
    () =>
      ordersInRange.reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0,
      ),
    [ordersInRange],
  );

  const mentorAvailableTotal = useMemo(
    () =>
      availableEarningsInRange.reduce(
        (sum, item) => sum + (Number(item.mentor_amount) || 0),
        0,
      ),
    [availableEarningsInRange],
  );

  const platformAvailableTotal = useMemo(
    () =>
      availableEarningsInRange.reduce(
        (sum, item) => sum + (Number(item.platform_amount) || 0),
        0,
      ),
    [availableEarningsInRange],
  );

  // Pengajuan yang masih perlu ditangani tetap ditampilkan lintas periode,
  // agar pergantian filter tanggal tidak menyembunyikan pekerjaan Admin.
  const pendingWithdrawals = useMemo(
    () =>
      withdrawals.filter(
        (item) => item.status === "pending" || item.status === "processing",
      ),
    [withdrawals],
  );

  const withdrawalsInRange = useMemo(
    () =>
      withdrawals.filter((item) =>
        isWithinRange(item.requested_at, dateRange),
      ),
    [withdrawals, dateRange],
  );

  const paidWithdrawals = useMemo(
    () =>
      withdrawals.filter(
        (item) => item.status === "paid" && isWithinRange(item.paid_at, dateRange),
      ),
    [withdrawals, dateRange],
  );

  const pendingWithdrawalTotal = pendingWithdrawals.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  const paidWithdrawalTotal = paidWithdrawals.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  const chartBuckets = useMemo(
    () => buildChartBuckets(dateRange, availableEarningsInRange),
    [dateRange, availableEarningsInRange],
  );

  const maxChartBucket = Math.max(
    ...chartBuckets.map((item) => item.total),
    1,
  );

  const filteredEarnings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return availableEarningsInRange;

    return availableEarningsInRange.filter((item) => {
      const participant = profileMap.get(item.member_user_id) || "Peserta";
      const mentor = profileMap.get(item.mentor_user_id) || "Mentor";
      const course = courseMap.get(item.course_id) || "Kelas";
      const haystack = [
        participant,
        mentor,
        course,
        item.order_id,
        item.id,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [availableEarningsInRange, courseMap, profileMap, searchTerm]);

  const filteredWithdrawals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return withdrawalsInRange;

    return withdrawalsInRange.filter((item) => {
      const mentor =
        item.full_name_snapshot ||
        profileMap.get(item.mentor_user_id) ||
        "Mentor";

      const haystack = [
        mentor,
        item.bank_name,
        item.account_number,
        item.status,
        item.id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [profileMap, searchTerm, withdrawalsInRange]);

  useEffect(() => {
    if (!selectedEarning && !selectedWithdrawal) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedEarning(null);
        setSelectedWithdrawal(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedEarning, selectedWithdrawal]);

  async function reviewWithdrawal(
    item: RevenueWithdrawal,
    decision: "processing" | "paid" | "rejected",
  ) {
    const note = notes[item.id]?.trim() ?? "";

    if (decision === "rejected" && !note) {
      setActionError("Catatan penolakan wajib diisi sebelum pengajuan ditolak.");
      return;
    }

    setBusyId(item.id);
    setActionError("");
    setNotice("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_review_mentor_withdrawal",
        {
          p_request_id: item.id,
          p_decision: decision,
          p_note: note || null,
        },
      );

      if (rpcError) throw rpcError;

      setNotice(
        decision === "processing"
          ? "Pengajuan penarikan dipindahkan ke status sedang diproses."
          : decision === "paid"
            ? "Penarikan berhasil ditandai sudah dibayar."
            : "Pengajuan penarikan berhasil ditolak.",
      );

      setSelectedWithdrawal(null);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui status penarikan.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const summaryCards = [
    {
      label: "Total pembayaran",
      value: currency(totalRevenue),
      note: `${ordersInRange.length.toLocaleString("id-ID")} pesanan paid pada periode ini`,
      icon: Wallet,
      iconClass: "bg-violet-50 text-violet-700",
      accent: "border-t-violet-500",
    },
    {
      label: "Bagian mentor tersedia",
      value: currency(mentorAvailableTotal),
      note: `${availableEarningsInRange.length.toLocaleString("id-ID")} item ledger tersedia`,
      icon: Banknote,
      iconClass: "bg-emerald-50 text-emerald-700",
      accent: "border-t-emerald-500",
    },
    {
      label: "Pendapatan platform tersedia",
      value: currency(platformAvailableTotal),
      note: "Akumulasi bagian platform pada periode ini",
      icon: TrendingUp,
      iconClass: "bg-indigo-50 text-indigo-700",
      accent: "border-t-indigo-500",
    },
    {
      label: "Penarikan dibayar",
      value: currency(paidWithdrawalTotal),
      note: `${paidWithdrawals.length.toLocaleString("id-ID")} pencairan pada periode ini`,
      icon: CheckCircle2,
      iconClass: "bg-teal-50 text-teal-700",
      accent: "border-t-teal-500",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="app-page-heading">
        <div>
          
          <h2 className="app-page-title">Pendapatan</h2>
          <p className="app-page-description">
            Pantau pembayaran kelas, pembagian hasil, dan pencairan dana mentor
            dalam satu halaman.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              aria-expanded={dateFilterOpen}
              aria-haspopup="dialog"
              onClick={() => setDateFilterOpen((open) => !open)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-[10px] font-bold text-violet-900 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
            >
              <CalendarDays size={15} className="shrink-0 text-violet-700" />
              <span>
                <span className="block">{PERIOD_LABELS[period]}</span>
                <span className="mt-0.5 block text-[9px] font-medium text-slate-400">
                  {dateRangeText}
                </span>
              </span>
              <ChevronDown
                size={14}
                className={`ml-1 shrink-0 transition ${dateFilterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dateFilterOpen && (
              <div
                role="dialog"
                aria-label="Filter periode pendapatan"
                className="absolute right-0 z-50 mt-2 w-[min(92vw,390px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_55px_rgba(25,15,45,0.18)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Filter periode
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Pilih rentang data yang ingin ditampilkan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Tutup filter tanggal"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["today", "7d", "30d", "90d", "12m"] as PeriodKey[]).map(
                    (key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPeriod(key);
                          setSearchTerm("");
                          setDateFilterOpen(false);
                        }}
                        className={`min-h-9 rounded-lg border px-2 py-2 text-[10px] font-semibold transition ${
                          period === key
                            ? "border-violet-300 bg-violet-50 text-violet-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/50"
                        }`}
                      >
                        {PERIOD_LABELS[key]}
                      </button>
                    ),
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold text-slate-700">
                    Rentang tanggal khusus
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[9px] text-slate-400">
                        Tanggal awal
                      </span>
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd || undefined}
                        onChange={(event) => setCustomStart(event.target.value)}
                        className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[9px] text-slate-400">
                        Tanggal akhir
                      </span>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart || undefined}
                        onChange={(event) => setCustomEnd(event.target.value)}
                        className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!customRangeValid}
                    onClick={() => {
                      setPeriod("custom");
                      setSearchTerm("");
                      setDateFilterOpen(false);
                    }}
                    className="mt-3 h-10 w-full rounded-lg bg-[#260047] px-3 text-[10px] font-bold text-white transition hover:bg-[#35105b] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Terapkan tanggal
                  </button>
                  {!customRangeValid && (
                    <p className="mt-2 text-[9px] text-rose-600">
                      Pastikan tanggal awal tidak melewati tanggal akhir.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="hidden items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] font-semibold text-violet-800 sm:inline-flex">
            <ShieldCheck size={13} />
            Finance center
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            Sebagian data pendapatan belum dapat dimuat: {error}
          </span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError("")}
            className="ml-auto rounded-lg p-1 hover:bg-rose-100"
            aria-label="Tutup pesan kesalahan"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-auto rounded-lg p-1 hover:bg-emerald-100"
            aria-label="Tutup pemberitahuan"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pendingWithdrawals.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
            <Clock3 size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-950">
              Ada {pendingWithdrawals.length} pengajuan penarikan dari semua
              periode yang perlu diperiksa.
            </p>
            <p className="mt-1 text-[11px] leading-5 text-amber-800">
              Pengajuan yang masih tertunda tetap ditampilkan meskipun filter
              tanggal diubah.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("withdrawals");
                setSearchTerm("");
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:underline"
            >
              Periksa pengajuan <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <section
        aria-label="Ringkasan keuangan"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={`min-w-0 rounded-2xl border border-slate-100 border-t-[3px] ${item.accent} bg-white p-4 shadow-[0_8px_28px_rgba(29,20,54,0.045)] sm:p-5`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  {item.label}
                </p>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}
                >
                  <Icon size={17} />
                </span>
              </div>
              <p className="mt-4 break-words text-xl font-bold tracking-tight text-[#241638] sm:text-2xl">
                {item.value}
              </p>
              <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                {item.note}
              </p>
            </article>
          );
        })}
      </section>

      {/* Chart */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(29,20,54,0.045)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            
            <h3 className="mt-1 text-base font-bold text-[#241638]">
              Grafik pembagian hasil
            </h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
              Perbandingan bagian mentor dan platform dari ledger berstatus
              tersedia sesuai periode yang dipilih.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
            {dateRangeText}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
            Bagian mentor
          </span>
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
            Bagian platform
          </span>
          <span className="ml-auto text-[10px] text-slate-400">
            Total ledger:{" "}
            <strong className="font-bold text-slate-700">
              {currency(mentorAvailableTotal + platformAvailableTotal)}
            </strong>
          </span>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div
            className="grid min-w-[520px] items-end gap-2 sm:min-w-0 sm:gap-4"
            style={{ gridTemplateColumns: `repeat(${chartBuckets.length}, minmax(0, 1fr))` }}
          >
          {chartBuckets.map((month) => {
            const totalHeight =
              month.total > 0
                ? Math.max(7, (month.total / maxChartBucket) * 100)
                : 2;

            const mentorHeight =
              month.total > 0 ? (month.mentor / month.total) * 100 : 0;

            const platformHeight =
              month.total > 0 ? (month.platform / month.total) * 100 : 0;

            return (
              <div
                key={month.key}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                <span
                  className="max-w-full truncate text-center text-[9px] font-semibold text-slate-500 sm:text-[10px]"
                  title={currency(month.total)}
                >
                  {month.total > 0
                    ? `Rp ${compactCurrency(month.total)}`
                    : "—"}
                </span>

                <div
                  className="flex h-36 w-full items-end overflow-hidden rounded-xl bg-slate-50 p-1.5 sm:h-44 sm:p-2"
                  title={`Mentor: ${currency(month.mentor)} · Platform: ${currency(month.platform)}`}
                >
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-lg transition-all duration-500"
                    style={{ height: `${totalHeight}%` }}
                  >
                    <div
                      className="w-full bg-violet-500 transition-all duration-500"
                      style={{ height: `${platformHeight}%` }}
                    />
                    <div
                      className="w-full bg-emerald-600 transition-all duration-500"
                      style={{ height: `${mentorHeight}%` }}
                    />
                  </div>
                </div>

                <span className="text-[10px] font-bold text-slate-500">
                  {month.label}
                </span>
              </div>
            );
          })}
          </div>
        </div>

        {availableEarningsInRange.length === 0 && (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-400">
            Tidak ada ledger pembagian hasil berstatus tersedia pada periode
            yang dipilih.
          </p>
        )}
      </section>

      {/* Finance flow */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(29,20,54,0.045)] sm:p-6">
        <div>
          <h3 className="text-sm font-bold text-[#241638]">
            Alur pendapatan platform
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Urutan proses pembayaran kelas sampai dana mentor dicairkan.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              number: "01",
              title: "Peserta membayar",
              detail: "Peserta menyelesaikan pembayaran kelas.",
              icon: CreditCard,
            },
            {
              number: "02",
              title: "Pesanan paid",
              detail: "Pembayaran tercatat sebagai berhasil.",
              icon: ReceiptText,
            },
            {
              number: "03",
              title: "Pembagian hasil",
              detail: "Ledger membagi hak mentor dan platform.",
              icon: TrendingUp,
            },
            {
              number: "04",
              title: "Saldo mentor",
              detail: "Bagian mentor menjadi dasar penarikan.",
              icon: Wallet,
            },
            {
              number: "05",
              title: "Dana dibayarkan",
              detail: "Admin memproses dan mengonfirmasi pencairan.",
              icon: Landmark,
            },
          ].map((step, index) => {
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="relative rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-violet-600">
                    STEP {step.number}
                  </span>
                  <Icon size={16} className="text-violet-700" />
                </div>
                <p className="mt-3 text-[11px] font-bold text-slate-800">
                  {step.title}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  {step.detail}
                </p>
                {index < 4 && (
                  <ArrowRight
                    size={13}
                    className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-violet-500 xl:block"
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[10px] leading-5 text-slate-400">
          Catatan: pencairan mentor merupakan pembayaran atas hak mentor yang
          tercatat di ledger, bukan pendapatan baru platform.
        </p>
      </section>

      {/* Tabs */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            
            <h3 className="mt-1 text-base font-bold text-[#241638]">
              Aktivitas keuangan
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Pilih pembagian hasil atau pengajuan penarikan mentor.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Aktivitas keuangan"
            className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1"
          >
            <button
              id="tab-earnings"
              type="button"
              role="tab"
              aria-selected={activeTab === "earnings"}
              aria-controls="panel-earnings"
              onClick={() => {
                setActiveTab("earnings");
                setSearchTerm("");
              }}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-bold transition ${
                activeTab === "earnings"
                  ? "bg-white text-violet-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpen size={14} />
              Pembagian hasil
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px]">
                {availableEarningsInRange.length}
              </span>
            </button>

            <button
              id="tab-withdrawals"
              type="button"
              role="tab"
              aria-selected={activeTab === "withdrawals"}
              aria-controls="panel-withdrawals"
              onClick={() => {
                setActiveTab("withdrawals");
                setSearchTerm("");
              }}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-bold transition ${
                activeTab === "withdrawals"
                  ? "bg-white text-violet-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Landmark size={14} />
              Penarikan mentor
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px]">
                {withdrawalsInRange.length}
              </span>
            </button>
          </div>
        </div>

        {/* Earnings tab */}
        {activeTab === "earnings" && (
          <div
            id="panel-earnings"
            role="tabpanel"
            aria-labelledby="tab-earnings"
            className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(29,20,54,0.045)]"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
              <div>
                <h4 className="text-sm font-bold text-[#241638]">
                  Rincian pembagian hasil
                </h4>
                <p className="mt-1 text-[10px] text-slate-500">
                  Data transaksi yang memiliki ledger berstatus tersedia.
                </p>
              </div>

              <label className="relative block w-full sm:max-w-xs">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  placeholder="Cari peserta, mentor, atau kelas..."
                />
              </label>
            </div>

            {filteredEarnings.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <ReceiptText size={20} />
                </span>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {availableEarningsInRange.length === 0
                    ? "Belum ada pembagian hasil pada periode ini."
                    : "Data yang dicari tidak ditemukan."}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Transaksi akan muncul di sini setelah tercatat pada ledger.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[850px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-semibold text-slate-400">
                        <th className="px-5 py-3">Peserta dan kelas</th>
                        <th className="px-4 py-3">Tanggal / invoice</th>
                        <th className="px-4 py-3 text-right">Nilai dasar</th>
                        <th className="px-4 py-3 text-right">Bagian mentor</th>
                        <th className="px-4 py-3 text-right">Bagian platform</th>
                        <th className="px-5 py-3 text-right">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEarnings.slice(0, 100).map((item) => (
                        <tr
                          key={item.id}
                          className="transition hover:bg-violet-50/40"
                        >
                          <td className="px-5 py-4">
                            <p className="text-[11px] font-bold text-slate-800">
                              {profileMap.get(item.member_user_id) || "Peserta"}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {courseMap.get(item.course_id) || "Kelas"}
                            </p>
                            <p className="mt-1 text-[9px] text-slate-400">
                              Mentor:{" "}
                              {profileMap.get(item.mentor_user_id) || "Mentor"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[10px] text-slate-600">
                              {dateTime(item.created_at)}
                            </p>
                            <p className="mt-1 text-[9px] text-slate-400">
                              ID {item.order_id.slice(0, 8)}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-right text-[11px] font-semibold tabular-nums text-slate-700">
                            {currency(item.basis_amount)}
                          </td>
                          <td className="px-4 py-4 text-right text-[11px] font-bold tabular-nums text-emerald-700">
                            {currency(item.mentor_amount)}
                          </td>
                          <td className="px-4 py-4 text-right text-[11px] font-bold tabular-nums text-violet-800">
                            {currency(item.platform_amount)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedEarning(item)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredEarnings.slice(0, 100).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEarning(item)}
                      className="block w-full px-4 py-4 text-left transition hover:bg-violet-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">
                            {profileMap.get(item.member_user_id) || "Peserta"}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-slate-500">
                            {courseMap.get(item.course_id) || "Kelas"}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-400">
                            Mentor:{" "}
                            {profileMap.get(item.mentor_user_id) || "Mentor"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">
                          Detail
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[9px] text-slate-400">
                            Nilai dasar
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-700">
                            {currency(item.basis_amount)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2">
                          <p className="text-[9px] text-emerald-700">
                            Bagian mentor
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-emerald-800">
                            {currency(item.mentor_amount)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-[9px] text-slate-400">
                        {dateTime(item.created_at)} · ID{" "}
                        {item.order_id.slice(0, 8)}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">
                  Menampilkan maksimal 100 item dari {filteredEarnings.length}{" "}
                  hasil pencarian.
                </div>
              </>
            )}
          </div>
        )}

        {/* Withdrawals tab */}
        {activeTab === "withdrawals" && (
          <div
            id="panel-withdrawals"
            role="tabpanel"
            aria-labelledby="tab-withdrawals"
            className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(29,20,54,0.045)]"
          >
            <div className="border-b border-slate-100 p-4 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#241638]">
                    Pengajuan penarikan mentor
                  </h4>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Buka detail pengajuan untuk memeriksa rekening dan
                    memperbarui status pembayaran.
                  </p>
                </div>

                <label className="relative block w-full sm:max-w-xs">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="Cari nama mentor atau bank..."
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-amber-50 px-3 py-3">
                  <p className="text-[9px] font-semibold text-amber-700">
                    Belum dibayar · semua periode
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-900">
                    {currency(pendingWithdrawalTotal)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-amber-700">
                    {pendingWithdrawals.length} pengajuan tertunda
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-3">
                  <p className="text-[9px] font-semibold text-emerald-700">
                    Sudah dibayar · periode ini
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    {currency(paidWithdrawalTotal)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-emerald-700">
                    {paidWithdrawals.length} transaksi
                  </p>
                </div>
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Landmark size={20} />
                </span>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {withdrawalsInRange.length === 0
                    ? "Belum ada pengajuan pada periode ini."
                    : "Pengajuan yang dicari tidak ditemukan."}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Pengajuan mentor akan muncul di bagian ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredWithdrawals.map((item) => {
                  const mentorName =
                    item.full_name_snapshot ||
                    profileMap.get(item.mentor_user_id) ||
                    "Mentor";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedWithdrawal(item)}
                      className="group flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-violet-50/40 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
                          <Landmark size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-xs font-bold text-slate-800">
                              {mentorName}
                            </p>
                            <span
                              className={`rounded-full border px-2 py-1 text-[9px] font-bold ${statusStyle(item.status)}`}
                            >
                              {statusLabel(item.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {item.bank_name} · {maskAccount(item.account_number)}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-400">
                            Diajukan {dateTime(item.requested_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pl-[52px] sm:pl-0">
                        <div className="sm:text-right">
                          <p className="text-base font-bold tabular-nums text-[#241638]">
                            {currency(item.amount)}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-400">
                            Lihat detail pengajuan
                          </p>
                        </div>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition group-hover:border-violet-200 group-hover:bg-white group-hover:text-violet-800">
                          <ArrowRight size={15} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Data explanation */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        
      </div>

      {/* Earning detail modal */}
      {selectedEarning && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#16072b]/55 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEarning(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="earning-detail-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-800">
                  <ReceiptText size={20} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    Detail transaksi
                  </p>
                  <h3
                    id="earning-detail-title"
                    className="mt-1 text-base font-bold text-[#241638]"
                  >
                    Pembagian hasil kelas
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEarning(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup detail transaksi"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] text-slate-400">Peserta</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {profileMap.get(selectedEarning.member_user_id) || "Peserta"}
              </p>
              <p className="mt-2 text-[10px] text-slate-500">
                {courseMap.get(selectedEarning.course_id) || "Kelas"}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Mentor:{" "}
                {profileMap.get(selectedEarning.mentor_user_id) || "Mentor"}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow
                label="Tanggal pencatatan"
                value={dateTime(selectedEarning.created_at)}
              />
              <DetailRow
                label="ID pesanan"
                value={selectedEarning.order_id}
              />
              <DetailRow
                label="Nilai dasar pembagian"
                value={currency(selectedEarning.basis_amount)}
              />
              <DetailRow
                label="Status ledger"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[9px] ${statusStyle(selectedEarning.status)}`}
                  >
                    {statusLabel(selectedEarning.status)}
                  </span>
                }
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-semibold text-emerald-700">
                  Bagian mentor
                </p>
                <p className="mt-2 break-words text-lg font-bold text-emerald-800">
                  {currency(selectedEarning.mentor_amount)}
                </p>
                <p className="mt-1 text-[9px] text-emerald-700">
                  Alokasi sesuai ledger
                </p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-[10px] font-semibold text-violet-700">
                  Bagian platform
                </p>
                <p className="mt-2 break-words text-lg font-bold text-violet-800">
                  {currency(selectedEarning.platform_amount)}
                </p>
                <p className="mt-1 text-[9px] text-violet-700">
                  Alokasi sesuai ledger
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEarning(null)}
              className="mt-5 h-11 w-full rounded-xl bg-[#260047] text-xs font-bold text-white transition hover:bg-[#35105b]"
            >
              Tutup detail
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal detail modal */}
      {selectedWithdrawal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#16072b]/55 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedWithdrawal(null);
              setActionError("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-detail-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <Landmark size={20} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    Detail pencairan
                  </p>
                  <h3
                    id="withdrawal-detail-title"
                    className="mt-1 text-base font-bold text-[#241638]"
                  >
                    Penarikan saldo mentor
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedWithdrawal(null);
                  setActionError("");
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup detail penarikan"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#260047] p-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-white/65">
                  Nominal penarikan
                </p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${
                    selectedWithdrawal.status === "paid"
                      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                      : selectedWithdrawal.status === "rejected"
                        ? "border-rose-300/30 bg-rose-400/15 text-rose-100"
                        : "border-amber-300/30 bg-amber-400/15 text-amber-100"
                  }`}
                >
                  {statusLabel(selectedWithdrawal.status)}
                </span>
              </div>
              <p className="mt-2 break-words text-2xl font-bold tracking-tight">
                {currency(selectedWithdrawal.amount)}
              </p>
              <p className="mt-2 text-[11px] text-white/75">
                {selectedWithdrawal.full_name_snapshot ||
                  profileMap.get(selectedWithdrawal.mentor_user_id) ||
                  "Mentor"}
              </p>
              <p className="mt-0.5 text-[10px] text-white/55">
                Mentor/Pengajar Kiki Creator Class
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow
                label="Bank tujuan"
                value={selectedWithdrawal.bank_name || "-"}
              />
              <DetailRow
                label="Nomor rekening"
                value={selectedWithdrawal.account_number || "-"}
              />
              <DetailRow
                label="Tanggal pengajuan"
                value={dateTime(selectedWithdrawal.requested_at)}
              />
              <DetailRow
                label="Tanggal ditinjau"
                value={dateTime(selectedWithdrawal.reviewed_at)}
              />
              <DetailRow
                label="Tanggal dibayar"
                value={dateTime(selectedWithdrawal.paid_at)}
              />
              <DetailRow
                label="ID pengajuan"
                value={selectedWithdrawal.id}
              />
            </div>

            {selectedWithdrawal.admin_note && (
              <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
                <p className="text-[10px] font-bold text-rose-700">
                  Catatan Admin
                </p>
                <p className="mt-1 text-[11px] leading-5 text-rose-700">
                  {selectedWithdrawal.admin_note}
                </p>
              </div>
            )}

            {(selectedWithdrawal.status === "pending" ||
              selectedWithdrawal.status === "processing") && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <label className="block text-[10px] font-bold text-slate-600">
                  Catatan Admin
                  <span className="ml-1 font-normal text-slate-400">
                    (wajib jika menolak)
                  </span>
                  <textarea
                    value={notes[selectedWithdrawal.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [selectedWithdrawal.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-normal text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="Tambahkan catatan atau keterangan pembayaran..."
                  />
                </label>

                {actionError && (
                  <p className="mt-2 text-[10px] text-rose-600">
                    {actionError}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedWithdrawal.status === "pending" && (
                    <button
                      type="button"
                      disabled={busyId === selectedWithdrawal.id}
                      onClick={() =>
                        void reviewWithdrawal(selectedWithdrawal, "processing")
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-[11px] font-bold text-white transition hover:bg-[#35105b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Clock3 size={14} />
                      {busyId === selectedWithdrawal.id
                        ? "Memproses..."
                        : "Proses pengajuan"}
                    </button>
                  )}

                  {selectedWithdrawal.status === "processing" && (
                    <button
                      type="button"
                      disabled={busyId === selectedWithdrawal.id}
                      onClick={() =>
                        void reviewWithdrawal(selectedWithdrawal, "paid")
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold text-white shadow-sm shadow-emerald-600/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      {busyId === selectedWithdrawal.id
                        ? "Memproses..."
                        : "Tandai sudah dibayar"}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busyId === selectedWithdrawal.id}
                    onClick={() =>
                      void reviewWithdrawal(selectedWithdrawal, "rejected")
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tolak pengajuan
                  </button>
                </div>
              </div>
            )}

            {selectedWithdrawal.status === "paid" && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 size={16} />
                Penarikan ini sudah ditandai sebagai dibayar.
              </div>
            )}

            {selectedWithdrawal.status === "rejected" && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-[11px] font-semibold text-rose-800">
                <AlertCircle size={16} />
                Pengajuan penarikan ini telah ditolak.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedWithdrawal(null);
                setActionError("");
              }}
              className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
