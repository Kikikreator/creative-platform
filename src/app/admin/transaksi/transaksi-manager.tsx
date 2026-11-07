
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
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
  ShoppingBag,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================

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

type TransaksiManagerProps = {
  initialOrders: OrderRow[];
  initialPayments: PaymentRow[];
  initialOrderItems: OrderItemRow[];
  initialPaymentMethods: PaymentMethodRow[];
  initialProfiles: ProfileRow[];
  initialError: string | null;
};

type OrderStatusFilter =
  | "all"
  | "pending_payment"
  | "waiting_verification"
  | "paid"
  | "rejected"
  | "cancelled";

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

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "Menunggu Pembayaran",
    waiting_verification: "Menunggu Verifikasi",
    paid: "Berhasil",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };

  return labels[status] ?? status;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "paid":
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";

    case "waiting_verification":
      return "bg-amber-50 text-amber-700 ring-amber-100";

    case "pending_payment":
      return "bg-slate-100 text-slate-600 ring-slate-200";

    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-100";

    case "cancelled":
      return "bg-slate-100 text-slate-500 ring-slate-200";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-semibold ring-1 ${getStatusStyle(
        status
      )}`}
    >
      {getStatusLabel(status)}
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
  icon: typeof ShoppingBag;
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

export default function TransaksiManager({
  initialOrders,
  initialPayments,
  initialOrderItems,
  initialPaymentMethods,
  initialProfiles,
  initialError,
}: TransaksiManagerProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<OrderStatusFilter>("all");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedOrder, setSelectedOrder] =
    useState<OrderRow | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------
  // DATABASE MAPS
  // ----------------------------------------------------

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

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();

    for (const payment of initialPayments) {
      const current = map.get(payment.order_id) ?? [];

      current.push(payment);

      map.set(payment.order_id, current);
    }

    return map;
  }, [initialPayments]);

  // ----------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------

  const statistics = useMemo(() => {
    const totalOrders = initialOrders.length;

    const paidOrders = initialOrders.filter(
      (order) => order.status === "paid"
    );

    const waitingOrders = initialOrders.filter(
      (order) =>
        order.status === "pending_payment" ||
        order.status === "waiting_verification"
    );

    const totalRevenue = paidOrders.reduce(
      (total, order) => total + Number(order.total || 0),
      0
    );

    return {
      totalOrders,
      paidCount: paidOrders.length,
      waitingCount: waitingOrders.length,
      totalRevenue,
    };
  }, [initialOrders]);

  // ----------------------------------------------------
  // SEARCH & FILTER
  // ----------------------------------------------------

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return initialOrders.filter((order) => {
      const profile = profilesById.get(order.user_id);

      const items = itemsByOrder.get(order.id) ?? [];

      const orderPayments =
        paymentsByOrder.get(order.id) ?? [];

      const searchContent = [
        order.invoice_number,
        order.user_id,
        profile?.full_name ?? "",
        profile?.phone ?? "",
        ...items.map((item) => item.course_title_snapshot),
        ...orderPayments.map((payment) => payment.id),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !keyword || searchContent.includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      const orderDate = order.created_at.slice(0, 10);

      const matchesFrom =
        !dateFrom || orderDate >= dateFrom;

      const matchesTo =
        !dateTo || orderDate <= dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    initialOrders,
    profilesById,
    itemsByOrder,
    paymentsByOrder,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // ----------------------------------------------------
  // SELECTED ORDER DETAILS
  // ----------------------------------------------------

  const selectedProfile = selectedOrder
    ? profilesById.get(selectedOrder.user_id)
    : undefined;

  const selectedItems = selectedOrder
    ? itemsByOrder.get(selectedOrder.id) ?? []
    : [];

  const selectedPayments = selectedOrder
    ? paymentsByOrder.get(selectedOrder.id) ?? []
    : [];

  // ----------------------------------------------------
  // REFRESH
  // ----------------------------------------------------

  async function handleRefresh() {
    setRefreshing(true);

    try {
      router.refresh();
    } finally {
      window.setTimeout(() => {
        setRefreshing(false);
      }, 700);
    }
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
            <span className="h-2 w-2 rounded-full bg-violet-500" />

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
              Finance Management
            </span>
          </div>

          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Pantau seluruh pesanan, pembayaran, dan aktivitas
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
          <strong>Perhatian:</strong> Sebagian data tidak berhasil
          dimuat. {initialError}
        </div>
      )}

      {/* STATISTICS */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Pesanan"
          value={statistics.totalOrders.toLocaleString("id-ID")}
          description="Seluruh pesanan terdaftar"
          icon={ShoppingBag}
          iconStyle="bg-violet-50 text-violet-700"
        />

        <StatCard
          title="Total Pendapatan"
          value={formatMoney(statistics.totalRevenue)}
          description="Akumulasi pesanan berhasil"
          icon={Wallet}
          iconStyle="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          title="Menunggu Proses"
          value={statistics.waitingCount.toLocaleString("id-ID")}
          description="Menunggu pembayaran atau verifikasi"
          icon={Clock3}
          iconStyle="bg-amber-50 text-amber-600"
        />

        <StatCard
          title="Transaksi Berhasil"
          value={statistics.paidCount.toLocaleString("id-ID")}
          description="Pesanan dengan status paid"
          icon={CheckCircle2}
          iconStyle="bg-violet-50 text-cyan-700"
        />
      </section>

      {/* TRANSACTION TABLE */}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* PANEL HEADER */}

        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <FileText size={19} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Transaksi
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Kelola dan pantau seluruh pesanan member.
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
                placeholder="Cari invoice, member, kelas..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:w-64"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as OrderStatusFilter
                  )
                }
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs text-slate-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 sm:w-48"
              >
                <option value="all">Semua Status</option>
                <option value="pending_payment">
                  Menunggu Pembayaran
                </option>
                <option value="waiting_verification">
                  Menunggu Verifikasi
                </option>
                <option value="paid">Berhasil</option>
                <option value="rejected">Ditolak</option>
                <option value="cancelled">Dibatalkan</option>
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
            Periode transaksi
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-violet-500"
            />

            <span className="text-xs text-slate-400">s/d</span>

            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-violet-500"
            />

            {(dateFrom || dateTo || search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-xs font-semibold text-violet-700 hover:text-violet-900"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-4">Invoice / Member</th>
                <th className="px-5 py-4">Kelas</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Nominal</th>
                <th className="px-5 py-4">Pembayaran</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                      <ShoppingBag size={25} />
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-slate-700">
                      {initialOrders.length === 0
                        ? "Belum Ada Transaksi"
                        : "Transaksi Tidak Ditemukan"}
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-400">
                      {initialOrders.length === 0
                        ? "Pesanan member akan muncul otomatis di sini setelah melakukan pembelian."
                        : "Coba ubah kata kunci pencarian atau filter yang digunakan."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const profile = profilesById.get(
                    order.user_id
                  );

                  const items =
                    itemsByOrder.get(order.id) ?? [];

                  const payments =
                    paymentsByOrder.get(order.id) ?? [];

                  const latestPayment = payments[0];

                  const method = latestPayment?.payment_method_id
                    ? methodsById.get(
                        latestPayment.payment_method_id
                      )
                    : undefined;

                  const memberName =
                    profile?.full_name?.trim() || "Member";

                  return (
                    <tr
                      key={order.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      {/* INVOICE / MEMBER */}

                      <td className="px-5 py-4">
                        <p className="whitespace-nowrap text-xs font-bold text-slate-800">
                          {order.invoice_number}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-[10px] font-bold text-violet-700">
                            {getInitial(memberName)}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[150px] truncate text-[11px] font-medium text-slate-600">
                              {memberName}
                            </p>

                            <p className="text-[9px] text-slate-400">
                              ID: {shortId(order.user_id)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* COURSES */}

                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2">
                          <BookOpen
                            size={14}
                            className="mt-0.5 shrink-0 text-violet-600"
                          />

                          <div>
                            {items.length > 0 ? (
                              <>
                                <p className="max-w-[180px] text-xs font-medium text-slate-700">
                                  {items[0].course_title_snapshot}
                                </p>

                                {items.length > 1 && (
                                  <p className="mt-1 text-[10px] text-slate-400">
                                    +{items.length - 1} kelas lainnya
                                  </p>
                                )}

                                <p className="mt-1 text-[10px] text-slate-400">
                                  {items.reduce(
                                    (sum, item) =>
                                      sum + Number(item.quantity),
                                    0
                                  )}{" "}
                                  item
                                </p>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Tidak ada rincian
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* DATE */}

                      <td className="whitespace-nowrap px-5 py-4 text-[11px] text-slate-500">
                        {formatDate(order.created_at)}
                      </td>

                      {/* AMOUNT */}

                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-xs font-bold text-slate-800">
                          {formatMoney(order.total, order.currency)}
                        </p>

                        {Number(order.discount) > 0 && (
                          <p className="mt-1 text-[10px] text-emerald-600">
                            Diskon{" "}
                            {formatMoney(
                              order.discount,
                              order.currency
                            )}
                          </p>
                        )}
                      </td>

                      {/* PAYMENT */}

                      <td className="px-5 py-4">
                        {latestPayment ? (
                          <>
                            <p className="text-xs font-medium text-slate-700">
                              {method?.name ?? "Metode pembayaran"}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {getStatusLabel(latestPayment.status)}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Belum ada pembayaran
                          </span>
                        )}
                      </td>

                      {/* ORDER STATUS */}

                      <td className="px-5 py-4">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-[11px] font-semibold text-white transition hover:bg-violet-800"
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
            Menampilkan {filteredOrders.length} dari{" "}
            {initialOrders.length} transaksi.
          </p>

          <div className="flex items-center gap-2 text-[10px] text-violet-700">
            <ShieldCheck size={13} />
            Data bersumber dari Supabase
          </div>
        </div>
      </section>

      {/* TRANSACTION DETAIL MODAL */}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detail transaksi"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Transaction Detail
                </p>

                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Detail Transaksi
                </h2>

                <p className="mt-1 text-[11px] text-slate-400">
                  {selectedOrder.invoice_number}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL CONTENT */}

            <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
              {/* STATUS */}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <p className="text-[10px] text-slate-400">
                    Status pesanan
                  </p>

                  <div className="mt-2">
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-400">
                    Total pembayaran
                  </p>

                  <p className="mt-1 text-lg font-bold text-violet-700">
                    {formatMoney(
                      selectedOrder.total,
                      selectedOrder.currency
                    )}
                  </p>
                </div>
              </div>

              {/* MEMBER */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound size={16} className="text-violet-700" />

                  <h3 className="text-xs font-bold text-slate-800">
                    Informasi Member
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedProfile?.full_name?.trim() ||
                      "Member"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedProfile?.phone || "Nomor telepon tidak tersedia"}
                  </p>

                  <p className="mt-2 break-all text-[10px] text-slate-400">
                    User ID: {selectedOrder.user_id}
                  </p>
                </div>
              </div>

              {/* ORDER INFORMATION */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-violet-700" />

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
                      {selectedOrder.invoice_number}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Tanggal Pesanan
                    </span>

                    <span className="text-right text-xs text-slate-700">
                      {formatDate(selectedOrder.created_at)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Subtotal
                    </span>

                    <span className="text-xs font-medium text-slate-700">
                      {formatMoney(
                        selectedOrder.subtotal,
                        selectedOrder.currency
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 border-b border-slate-100 p-3">
                    <span className="text-xs text-slate-500">
                      Diskon
                    </span>

                    <span className="text-xs font-medium text-emerald-600">
                      -{" "}
                      {formatMoney(
                        selectedOrder.discount,
                        selectedOrder.currency
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 bg-slate-50 p-3">
                    <span className="text-xs font-bold text-slate-700">
                      Total
                    </span>

                    <span className="text-sm font-bold text-violet-700">
                      {formatMoney(
                        selectedOrder.total,
                        selectedOrder.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* ORDER ITEMS */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-violet-700" />

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
                              selectedOrder.currency
                            )}
                          </p>
                        </div>

                        <p className="text-xs font-bold text-slate-800">
                          {formatMoney(
                            item.line_total,
                            selectedOrder.currency
                          )}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* PAYMENTS */}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard size={16} className="text-violet-700" />

                  <h3 className="text-xs font-bold text-slate-800">
                    Informasi Pembayaran
                  </h3>
                </div>

                {selectedPayments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                    <Wallet
                      size={23}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-2 text-xs font-medium text-slate-600">
                      Belum ada pembayaran
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Informasi pembayaran akan muncul setelah member melakukan pembayaran.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPayments.map((payment) => {
                      const method = payment.payment_method_id
                        ? methodsById.get(payment.payment_method_id)
                        : undefined;

                      return (
                        <div
                          key={payment.id}
                          className="rounded-xl border border-slate-100 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-800">
                              {method?.name ?? "Metode pembayaran"}
                            </p>

                            <StatusBadge status={payment.status} />
                          </div>

                          {method?.bank_name && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Bank: {method.bank_name}
                            </p>
                          )}

                          <p className="mt-2 text-sm font-bold text-violet-700">
                            {formatMoney(
                              payment.amount,
                              selectedOrder.currency
                            )}
                          </p>

                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[10px] text-slate-400">
                                Waktu pembayaran
                              </p>

                              <p className="mt-1 text-[11px] text-slate-600">
                                {formatDate(payment.created_at)}
                              </p>
                            </div>

                            {payment.proof_path && (
                              <div>
                                <p className="text-[10px] text-slate-400">
                                  Lokasi bukti pembayaran
                                </p>

                                <p className="mt-1 break-all text-[10px] text-slate-600">
                                  {payment.proof_path}
                                </p>
                              </div>
                            )}

                            {payment.rejection_reason && (
                              <div className="rounded-lg bg-rose-50 p-3">
                                <p className="text-[10px] font-semibold text-rose-700">
                                  Alasan penolakan
                                </p>

                                <p className="mt-1 text-xs text-rose-600">
                                  {payment.rejection_reason}
                                </p>
                              </div>
                            )}

                            {payment.reviewed_at && (
                              <div>
                                <p className="text-[10px] text-slate-400">
                                  Diperiksa pada
                                </p>

                                <p className="mt-1 text-[11px] text-slate-600">
                                  {formatDate(payment.reviewed_at)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
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
