"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { reviewPayment } from "./actions";

// ======================================================
// TYPES
// ======================================================

export type PaymentRow = {
  id: string;
  order_id: string;
  payment_method_id: string | null;
  amount: number | string;
  proof_path: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  course_id: string;
  course_title_snapshot: string;
  unit_price: number | string;
  quantity: number;
  line_total: number | string;
};

export type PaymentMethodRow = {
  id: string;
  name: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qr_image_path: string | null;
  instructions: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

type PembayaranManagerProps = {
  initialPayments: PaymentRow[];
  initialOrders: OrderRow[];
  initialOrderItems: OrderItemRow[];
  initialPaymentMethods: PaymentMethodRow[];
  initialProfiles: ProfileRow[];
  initialError: string | null;
};

type PaymentStatusFilter =
  | "all"
  | "waiting_verification"
  | "approved"
  | "rejected";

// ======================================================
// HELPERS
// ======================================================

function formatMoney(
  value: number | string,
  currency = "IDR"
) {
  const amount = Number(value) || 0;

  const safeCurrency = /^[A-Z]{3}$/.test(currency)
    ? currency
    : "IDR";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "M";
}

function getPaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    waiting_verification: "Menunggu Verifikasi",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return labels[status] ?? status;
}

function getPaymentStatusStyle(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";

    case "waiting_verification":
      return "bg-amber-50 text-amber-700 ring-amber-100";

    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-100";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function getProofUrl(path: string | null) {
  if (!path) return null;

  try {
    const url = new URL(path);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-semibold ring-1 ${getPaymentStatusStyle(
        status
      )}`}
    >
      {getPaymentStatusLabel(status)}
    </span>
  );
}

// ======================================================
// STAT CARD
// ======================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconStyle,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconStyle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <h3 className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>

          <p className="mt-2 text-[11px] text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function PembayaranManager({
  initialPayments,
  initialOrders,
  initialOrderItems,
  initialPaymentMethods,
  initialProfiles,
  initialError,
}: PembayaranManagerProps) {
  const confirmDialog = useConfirmDialog();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PaymentStatusFilter>("all");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRow | null>(null);

  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(
    null
  );

  const [refreshing, startRefresh] = useTransition();

  // ----------------------------------------------------
  // DATABASE MAPS
  // ----------------------------------------------------

  const ordersById = useMemo(
    () =>
      new Map(
        initialOrders.map((order) => [order.id, order])
      ),
    [initialOrders]
  );

  const profilesById = useMemo(
    () =>
      new Map(
        initialProfiles.map((profile) => [
          profile.id,
          profile,
        ])
      ),
    [initialProfiles]
  );

  const methodsById = useMemo(
    () =>
      new Map(
        initialPaymentMethods.map((method) => [
          method.id,
          method,
        ])
      ),
    [initialPaymentMethods]
  );

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemRow[]>();

    for (const item of initialOrderItems) {
      const current = map.get(item.order_id) ?? [];

      current.push(item);
      map.set(item.order_id, current);
    }

    return map;
  }, [initialOrderItems]);

  // ----------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------

  const statistics = useMemo(() => {
    const waiting = initialPayments.filter(
      (payment) => payment.status === "waiting_verification"
    );

    const approved = initialPayments.filter(
      (payment) => payment.status === "approved"
    );

    const rejected = initialPayments.filter(
      (payment) => payment.status === "rejected"
    );

    const approvedAmount = approved.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    return {
      total: initialPayments.length,
      waiting: waiting.length,
      approved: approved.length,
      rejected: rejected.length,
      approvedAmount,
    };
  }, [initialPayments]);

  // ----------------------------------------------------
  // SEARCH & FILTER
  // ----------------------------------------------------

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return initialPayments.filter((payment) => {
      const order = ordersById.get(payment.order_id);

      const profile = order
        ? profilesById.get(order.user_id)
        : undefined;

      const method = payment.payment_method_id
        ? methodsById.get(payment.payment_method_id)
        : undefined;

      const items = itemsByOrder.get(payment.order_id) ?? [];

      const searchContent = [
        payment.id,
        payment.proof_path ?? "",
        order?.invoice_number ?? "",
        order?.user_id ?? "",
        profile?.full_name ?? "",
        profile?.phone ?? "",
        method?.name ?? "",
        method?.bank_name ?? "",
        ...items.map((item) => item.course_title_snapshot),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword || searchContent.includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        payment.status === statusFilter;

      const paymentDate = payment.created_at.slice(0, 10);

      const matchesFrom =
        !dateFrom || paymentDate >= dateFrom;

      const matchesTo =
        !dateTo || paymentDate <= dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    initialPayments,
    ordersById,
    profilesById,
    methodsById,
    itemsByOrder,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // ----------------------------------------------------
  // SELECTED PAYMENT DETAILS
  // ----------------------------------------------------

  const selectedOrder = selectedPayment
    ? ordersById.get(selectedPayment.order_id)
    : undefined;

  const selectedProfile = selectedOrder
    ? profilesById.get(selectedOrder.user_id)
    : undefined;

  const selectedMethod = selectedPayment?.payment_method_id
    ? methodsById.get(selectedPayment.payment_method_id)
    : undefined;

  const selectedItems = selectedPayment
    ? itemsByOrder.get(selectedPayment.order_id) ?? []
    : [];

  const proofUrl = getProofUrl(
    selectedPayment?.proof_path ?? null
  );

  // ----------------------------------------------------
  // REFRESH
  // ----------------------------------------------------

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  // ----------------------------------------------------
  // REVIEW PAYMENT
  // ----------------------------------------------------

  async function handleApprove() {
    if (!selectedPayment) return;

    const confirmed = await confirmDialog({
      title: "Setujui pembayaran?",
      message: "Pastikan nominal dan bukti pembayaran sudah sesuai sebelum menyetujui transaksi ini.",
      confirmLabel: "Setujui pembayaran",
      variant: "primary",
    });
    if (!confirmed) return;

    await submitReview("approve");
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      setActionError("Alasan penolakan wajib diisi.");
      return;
    }

    await submitReview("reject");
  }

  async function submitReview(
    decision: "approve" | "reject"
  ) {
    if (!selectedPayment) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const result = await reviewPayment({
        paymentId: selectedPayment.id,
        decision,
        reason: rejectionReason,
      });

      if (!result.success) {
        setActionError(result.message);
        return;
      }

      setSelectedPayment(null);
      setRejectOpen(false);
      setRejectionReason("");
      router.refresh();
    } catch {
      setActionError(
        "Terjadi kesalahan. Silakan coba kembali."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function closeDetail() {
    if (actionLoading) return;

    setSelectedPayment(null);
    setRejectOpen(false);
    setRejectionReason("");
    setActionError(null);
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}

      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-600" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-800">
              Finance Management
            </span>
          </div>

          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Periksa bukti pembayaran dan kelola verifikasi
            transaksi member Kiki Creator Class.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          Perbarui Data
        </button>
      </section>

      {/* ERROR */}

      {initialError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          <strong>Perhatian:</strong> Sebagian data tidak
          berhasil dimuat. {initialError}
        </div>
      )}

      {/* STATISTICS */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Pembayaran"
          value={statistics.total.toLocaleString("id-ID")}
          description="Seluruh pembayaran masuk"
          icon={Wallet}
          iconStyle="bg-violet-50 text-violet-700"
        />

        <StatCard
          title="Menunggu Verifikasi"
          value={statistics.waiting.toLocaleString("id-ID")}
          description="Perlu pemeriksaan administrator"
          icon={Clock3}
          iconStyle="bg-amber-50 text-amber-600"
        />

        <StatCard
          title="Pembayaran Disetujui"
          value={statistics.approved.toLocaleString("id-ID")}
          description="Pembayaran berhasil diverifikasi"
          icon={CheckCircle2}
          iconStyle="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          title="Pembayaran Ditolak"
          value={statistics.rejected.toLocaleString("id-ID")}
          description="Pembayaran yang ditolak"
          icon={XCircle}
          iconStyle="bg-rose-50 text-rose-600"
        />
      </section>

      {/* APPROVED AMOUNT */}

      <div className="flex flex-col justify-between gap-2 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 text-white shadow-sm">
            <Wallet size={19} />
          </div>

          <div>
            <p className="text-[11px] text-slate-500">
              Total nominal pembayaran disetujui
            </p>

            <p className="mt-1 text-lg font-bold text-violet-800">
              {formatMoney(statistics.approvedAmount)}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-medium text-slate-400">
          Berdasarkan pembayaran berstatus approved
        </span>
      </div>

      {/* PAYMENT TABLE */}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* PANEL HEADER */}

        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 text-white shadow-sm">
              <CreditCard size={19} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Pembayaran
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Kelola dan verifikasi pembayaran member.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cari invoice, member..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:w-64"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as PaymentStatusFilter
                  )
                }
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs text-slate-700 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100 sm:w-48"
              >
                <option value="all">Semua Status</option>
                <option value="waiting_verification">
                  Menunggu Verifikasi
                </option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>

              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* DATE FILTER */}

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <CalendarDays size={15} />
            Periode pembayaran
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-violet-600"
            />

            <span className="text-xs text-slate-400">s/d</span>

            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-violet-600"
            />

            {(dateFrom ||
              dateTo ||
              search ||
              statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-xs font-semibold text-violet-800 hover:text-violet-950"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-4">
                  Invoice / Member
                </th>
                <th className="px-5 py-4">Metode</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Nominal</th>
                <th className="px-5 py-4">Bukti</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                      <Wallet size={25} />
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-slate-700">
                      {initialPayments.length === 0
                        ? "Belum Ada Pembayaran"
                        : "Pembayaran Tidak Ditemukan"}
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-400">
                      {initialPayments.length === 0
                        ? "Pembayaran member akan muncul otomatis di sini setelah mereka mengirimkan bukti pembayaran."
                        : "Coba ubah kata kunci pencarian atau filter yang digunakan."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const order = ordersById.get(
                    payment.order_id
                  );

                  const profile = order
                    ? profilesById.get(order.user_id)
                    : undefined;

                  const method = payment.payment_method_id
                    ? methodsById.get(payment.payment_method_id)
                    : undefined;

                  const memberName =
                    profile?.full_name?.trim() || "Member";

                  const paymentProofUrl = getProofUrl(
                    payment.proof_path
                  );

                  return (
                    <tr
                      key={payment.id}
                      className="transition hover:bg-violet-50/30"
                    >
                      {/* INVOICE / MEMBER */}

                      <td className="px-5 py-4">
                        <p className="whitespace-nowrap text-xs font-bold text-slate-800">
                          {order?.invoice_number ?? "Invoice tidak tersedia"}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-700 text-[10px] font-bold text-white">
                            {getInitial(memberName)}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[150px] truncate text-[11px] font-medium text-slate-600">
                              {memberName}
                            </p>

                            <p className="text-[9px] text-slate-400">
                              ID: {order ? shortId(order.user_id) : "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* METHOD */}

                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-700">
                          {method?.name ?? "Metode tidak tersedia"}
                        </p>

                        {method?.bank_name && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            {method.bank_name}
                          </p>
                        )}
                      </td>

                      {/* DATE */}

                      <td className="whitespace-nowrap px-5 py-4 text-[11px] text-slate-500">
                        {formatDate(payment.created_at)}
                      </td>

                      {/* AMOUNT */}

                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-xs font-bold text-slate-800">
                          {formatMoney(
                            payment.amount,
                            order?.currency ?? "IDR"
                          )}
                        </p>
                      </td>

                      {/* PROOF */}

                      <td className="px-5 py-4">
                        {paymentProofUrl ? (
                          <a
                            href={paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-800 hover:text-violet-950"
                          >
                            <Eye size={14} />
                            Lihat Bukti
                          </a>
                        ) : payment.proof_path ? (
                          <span className="text-[10px] text-slate-400">
                            Path tersimpan
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Belum tersedia
                          </span>
                        )}
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4">
                        <StatusBadge status={payment.status} />
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPayment(payment)
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-800"
                        >
                          <Eye size={13} />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* TABLE FOOTER */}

        <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-[10px] text-slate-400">
            Menampilkan {filteredPayments.length} dari{" "}
            {initialPayments.length} pembayaran.
          </p>

          <div className="flex items-center gap-2 text-[10px] text-violet-800">
            <ShieldCheck size={13} />
            Data bersumber dari Supabase
          </div>
        </div>
      </section>

      {/* PAYMENT DETAIL MODAL */}

      {selectedPayment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detail pembayaran"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
                  Payment Verification
                </p>

                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Detail Pembayaran
                </h2>

                <p className="mt-1 text-[11px] text-slate-400">
                  {selectedOrder?.invoice_number ?? "Invoice tidak tersedia"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetail}
                disabled={actionLoading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL CONTENT */}

            <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
              {/* STATUS */}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <div>
                  <p className="text-[10px] text-slate-500">
                    Status pembayaran
                  </p>

                  <div className="mt-2">
                    <StatusBadge status={selectedPayment.status} />
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-500">
                    Nominal pembayaran
                  </p>

                  <p className="mt-1 text-lg font-bold text-violet-800">
                    {formatMoney(
                      selectedPayment.amount,
                      selectedOrder?.currency ?? "IDR"
                    )}
                  </p>
                </div>
              </div>

              {/* MEMBER */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound
                    size={16}
                    className="text-violet-800"
                  />

                  <h3 className="text-xs font-bold text-slate-800">
                    Informasi Member
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedProfile?.full_name?.trim() || "Member"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedProfile?.phone ||
                      "Nomor telepon tidak tersedia"}
                  </p>

                  <p className="mt-2 break-all text-[10px] text-slate-400">
                    User ID: {selectedOrder?.user_id ?? "—"}
                  </p>
                </div>
              </div>

              {/* ORDER */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText
                    size={16}
                    className="text-violet-800"
                  />

                  <h3 className="text-xs font-bold text-slate-800">
                    Informasi Pesanan
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Nomor Invoice
                    </span>

                    <span className="text-right text-xs font-semibold text-slate-800">
                      {selectedOrder?.invoice_number ?? "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Tanggal Pesanan
                    </span>

                    <span className="text-right text-xs text-slate-700">
                      {selectedOrder
                        ? formatDate(selectedOrder.created_at)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Subtotal
                    </span>

                    <span className="text-xs text-slate-700">
                      {selectedOrder
                        ? formatMoney(
                            selectedOrder.subtotal,
                            selectedOrder.currency
                          )
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Diskon
                    </span>

                    <span className="text-xs font-medium text-emerald-600">
                      {selectedOrder
                        ? `- ${formatMoney(
                            selectedOrder.discount,
                            selectedOrder.currency
                          )}`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 bg-slate-50 p-3">
                    <span className="text-xs font-bold text-slate-700">
                      Total Pesanan
                    </span>

                    <span className="text-sm font-bold text-violet-800">
                      {selectedOrder
                        ? formatMoney(
                            selectedOrder.total,
                            selectedOrder.currency
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* COURSE ITEMS */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen
                    size={16}
                    className="text-violet-800"
                  />

                  <h3 className="text-xs font-bold text-slate-800">
                    Rincian Kelas
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100">
                  {selectedItems.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400">
                      Tidak ada rincian kelas.
                    </p>
                  ) : (
                    selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between gap-2 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {item.course_title_snapshot}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {item.quantity} x{" "}
                            {formatMoney(
                              item.unit_price,
                              selectedOrder?.currency ?? "IDR"
                            )}
                          </p>
                        </div>

                        <p className="text-xs font-bold text-slate-800">
                          {formatMoney(
                            item.line_total,
                            selectedOrder?.currency ?? "IDR"
                          )}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PAYMENT METHOD */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard
                    size={16}
                    className="text-violet-800"
                  />

                  <h3 className="text-xs font-bold text-slate-800">
                    Metode Pembayaran
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedMethod?.name ?? "Metode tidak tersedia"}
                  </p>

                  {selectedMethod?.bank_name && (
                    <p className="mt-2 text-xs text-slate-500">
                      Bank: {selectedMethod.bank_name}
                    </p>
                  )}

                  {selectedMethod?.account_name && (
                    <p className="mt-2 text-xs text-slate-500">
                      Atas nama: {selectedMethod.account_name}
                    </p>
                  )}

                  {selectedMethod?.account_number && (
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      Nomor rekening: {selectedMethod.account_number}
                    </p>
                  )}

                  {selectedMethod?.instructions && (
                    <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-500">
                      {selectedMethod.instructions}
                    </p>
                  )}
                </div>
              </div>

              {/* PROOF OF PAYMENT */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Eye
                    size={16}
                    className="text-violet-800"
                  />

                  <h3 className="text-xs font-bold text-slate-800">
                    Bukti Pembayaran
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-100 p-4">
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800"
                    >
                      <Eye size={15} />
                      Buka Bukti Pembayaran
                    </a>
                  ) : selectedPayment.proof_path ? (
                    <>
                      <p className="break-all text-xs text-slate-600">
                        {selectedPayment.proof_path}
                      </p>

                      <p className="mt-2 text-[10px] leading-5 text-amber-700">
                        File tersimpan sebagai path storage.
                        Pratinjau memerlukan URL atau signed URL
                        dari bucket Supabase.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Member belum mengunggah bukti pembayaran.
                    </p>
                  )}

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-[10px] text-slate-400">
                      Waktu pembayaran
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      {formatDate(selectedPayment.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* REJECTION REASON */}

              {selectedPayment.rejection_reason && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-xs font-bold text-rose-700">
                    Alasan Penolakan
                  </p>

                  <p className="mt-2 text-xs leading-5 text-rose-600">
                    {selectedPayment.rejection_reason}
                  </p>
                </div>
              )}

              {/* REVIEW INFORMATION */}

              {selectedPayment.reviewed_at && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] text-slate-400">
                    Diperiksa pada
                  </p>

                  <p className="mt-1 text-xs font-medium text-slate-700">
                    {formatDate(selectedPayment.reviewed_at)}
                  </p>
                </div>
              )}

              {/* REJECTION FORM */}

              {rejectOpen && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <label
                    htmlFor="rejection-reason"
                    className="text-xs font-bold text-rose-800"
                  >
                    Alasan Penolakan
                  </label>

                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => {
                      setRejectionReason(event.target.value);
                      setActionError(null);
                    }}
                    rows={3}
                    placeholder="Contoh: Bukti transfer tidak sesuai dengan nominal pesanan."
                    className="mt-3 w-full resize-y rounded-xl border border-rose-200 bg-white p-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />

                  <p className="mt-2 text-[10px] text-rose-600">
                    Berikan alasan yang jelas agar member
                    mengetahui penyebab penolakan.
                  </p>
                </div>
              )}

              {/* ACTION ERROR */}

              {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                  {actionError}
                </div>
              )}

              {/* REVIEW ACTIONS */}

              {selectedPayment.status === "waiting_verification" && (
                <div className="border-t border-slate-100 pt-4">
                  {!rejectOpen ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        Setujui Pembayaran
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRejectOpen(true);
                          setActionError(null);
                        }}
                        disabled={actionLoading}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        <XCircle size={16} />
                        Tolak Pembayaran
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        <XCircle size={16} />
                        {actionLoading
                          ? "Memproses..."
                          : "Konfirmasi Penolakan"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRejectOpen(false);
                          setRejectionReason("");
                          setActionError(null);
                        }}
                        disabled={actionLoading}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL FOOTER */}

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeDetail}
                  disabled={actionLoading}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}