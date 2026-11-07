"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  History,
  Pencil,
  Plus,
  Power,
  Search,
  Tag,
  TicketPercent,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  deletePromoCode,
  savePromoCode,
  setPromoCodeStatus,
  type PromoCodeInput,
} from "./actions";

export type PromoCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  min_purchase: number | string;
  max_discount: number | string | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  redeemed_count: number | string;
  reserved_count: number | string;
  linked_order_count: number | string;
  redemption_history_count: number | string;
  applies_to_all: boolean;
  course_id: string | null;
  course_title: string | null;
};

export type PromoCourseOption = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived" | string;
};

export type PromoRedemptionRow = {
  id: string;
  promo_code: string;
  order_id: string;
  invoice_number: string;
  member_name: string;
  redemption_status: "reserved" | "redeemed" | "released" | "expired" | string;
  reserved_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  discount: number | string;
  total: number | string;
};

type PromoManagerProps = {
  initialPromos: PromoCodeRow[];
  initialRedemptions: PromoRedemptionRow[];
  initialCourses: PromoCourseOption[];
  initialError: string | null;
};

type PromoFormState = {
  code: string;
  description: string;
  appliesToAll: boolean;
  courseId: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minPurchase: string;
  maxDiscount: string;
  maxUses: string;
  maxUsesPerUser: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

const EMPTY_FORM: PromoFormState = {
  code: "",
  description: "",
  appliesToAll: true,
  courseId: "",
  discountType: "percentage",
  discountValue: "10",
  minPurchase: "0",
  maxDiscount: "",
  maxUses: "",
  maxUsesPerUser: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Tanpa batas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function currentLocalDateTimeInput() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function discountLabel(promo: PromoCodeRow) {
  if (promo.discount_type === "percentage") {
    const value = Number(promo.discount_value);
    const maximum = promo.max_discount
      ? ` · maks. ${formatMoney(promo.max_discount)}`
      : "";
    return `${value}%${maximum}`;
  }

  return formatMoney(promo.discount_value);
}

function getPromoStatus(promo: PromoCodeRow) {
  const now = Date.now();

  if (!promo.is_active) {
    return { label: "Nonaktif", className: "bg-slate-100 text-slate-600" };
  }

  if (new Date(promo.starts_at).getTime() > now) {
    return { label: "Terjadwal", className: "bg-sky-50 text-sky-700" };
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) {
    return { label: "Kedaluwarsa", className: "bg-amber-50 text-amber-700" };
  }

  return { label: "Aktif", className: "bg-emerald-50 text-emerald-700" };
}

function redemptionStatus(status: string) {
  switch (status) {
    case "redeemed":
      return { label: "Terpakai", className: "bg-emerald-50 text-emerald-700" };
    case "reserved":
      return { label: "Direservasi", className: "bg-sky-50 text-sky-700" };
    case "expired":
      return { label: "Kedaluwarsa", className: "bg-amber-50 text-amber-700" };
    default:
      return { label: "Dilepas", className: "bg-slate-100 text-slate-600" };
  }
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Tag;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_18px_rgba(31,22,55,.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">
            {description}
          </p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

export default function PromoManager({
  initialPromos,
  initialRedemptions,
  initialCourses,
  initialError,
}: PromoManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCodeRow | null>(null);
  const [form, setForm] = useState<PromoFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<Notice>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoCodeRow | null>(null);
  const [pendingPromoId, setPendingPromoId] = useState("");

  const editingPromoHasHistory = Boolean(
    editingPromo &&
      (
        Number(editingPromo.linked_order_count || 0) > 0 ||
        Number(editingPromo.redemption_history_count || 0) > 0
      )
  );

  const filteredPromos = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return initialPromos;

    return initialPromos.filter((promo) =>
      `${promo.code} ${promo.description ?? ""} ${
        promo.applies_to_all ? "semua kelas" : promo.course_title ?? "kelas tidak tersedia"
      }`
        .toLowerCase()
        .includes(keyword)
    );
  }, [initialPromos, search]);

  const stats = useMemo(() => {
    const activeCount = initialPromos.filter((promo) => {
      const status = getPromoStatus(promo).label;
      return status === "Aktif";
    }).length;

    const redeemedCount = initialPromos.reduce(
      (sum, promo) => sum + Number(promo.redeemed_count || 0),
      0
    );

    const reservedCount = initialPromos.reduce(
      (sum, promo) => sum + Number(promo.reserved_count || 0),
      0
    );

    return {
      total: initialPromos.length,
      active: activeCount,
      redeemed: redeemedCount,
      reserved: reservedCount,
    };
  }, [initialPromos]);

  function openCreateForm() {
    setEditingPromo(null);
    setForm({
      ...EMPTY_FORM,
      startsAt: currentLocalDateTimeInput(),
    });
    setNotice(null);
    setFormOpen(true);
  }

  function openEditForm(promo: PromoCodeRow) {
    setEditingPromo(promo);
    setForm({
      code: promo.code,
      description: promo.description ?? "",
      appliesToAll: promo.applies_to_all !== false,
      courseId: promo.course_id ?? "",
      discountType: promo.discount_type,
      discountValue: String(promo.discount_value),
      minPurchase: String(promo.min_purchase ?? 0),
      maxDiscount: promo.max_discount == null ? "" : String(promo.max_discount),
      maxUses: promo.max_uses == null ? "" : String(promo.max_uses),
      maxUsesPerUser:
        promo.max_uses_per_user == null
          ? ""
          : String(promo.max_uses_per_user),
      startsAt: toLocalDateTimeInput(promo.starts_at),
      expiresAt: toLocalDateTimeInput(promo.expires_at),
      isActive: promo.is_active,
    });
    setNotice(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (isPending) return;
    setFormOpen(false);
    setEditingPromo(null);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const startsAt = new Date(form.startsAt);
    const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;

    if (!form.startsAt || Number.isNaN(startsAt.getTime())) {
      setNotice({ type: "error", message: "Tanggal mulai promo wajib diisi." });
      return;
    }

    if (
      expiresAt &&
      (Number.isNaN(expiresAt.getTime()) ||
        expiresAt.getTime() <= startsAt.getTime())
    ) {
      setNotice({
        type: "error",
        message: "Tanggal berakhir harus setelah tanggal mulai.",
      });
      return;
    }

    const numberOrNull = (value: string) =>
      value.trim() === "" ? null : Number(value);

    if (!form.appliesToAll && !form.courseId) {
      setNotice({
        type: "error",
        message: "Pilih kelas yang akan menerima promo ini.",
      });
      return;
    }

    const input: PromoCodeInput = {
      id: editingPromo?.id ?? null,
      code: form.code,
      description: form.description,
      appliesToAll: form.appliesToAll,
      courseId: form.appliesToAll ? "" : form.courseId,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minPurchase: Number(form.minPurchase || 0),
      maxDiscount: numberOrNull(form.maxDiscount),
      maxUses: numberOrNull(form.maxUses),
      maxUsesPerUser: numberOrNull(form.maxUsesPerUser),
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isActive: form.isActive,
    };

    startTransition(async () => {
      const result = await savePromoCode(input);

      setNotice({
        type: result.success ? "success" : "error",
        message: result.message,
      });

      if (result.success) {
        setFormOpen(false);
        setEditingPromo(null);
        router.refresh();
      }
    });
  }

  function handleStatusChange(promo: PromoCodeRow) {
    setNotice(null);
    setPendingPromoId(promo.id);

    startTransition(async () => {
      const result = await setPromoCodeStatus(promo.id, !promo.is_active);

      setNotice({
        type: result.success ? "success" : "error",
        message: result.success
          ? `Kode ${promo.code} berhasil ${promo.is_active ? "dinonaktifkan" : "diaktifkan"}.`
          : result.message,
      });

      setPendingPromoId("");
      if (result.success) router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;
    setPendingPromoId(target.id);

    startTransition(async () => {
      const result = await deletePromoCode(target.id);

      setNotice({
        type: result.success ? "success" : "error",
        message: result.message,
      });

      setPendingPromoId("");
      setDeleteTarget(null);
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
              Marketing Management
            </span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Promo & Voucher
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Buat kode diskon, atur kuota dan masa berlaku, serta pantau
            reservasi dan penggunaan promo pada pembelian kelas.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#3B1260]"
        >
          <Plus size={15} />
          Buat Kode Promo
        </button>
      </section>

      {initialError && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div>
            <strong>Data promo atau daftar kelas belum dapat dimuat.</strong>
            <p className="mt-1">
              Pastikan migration Promo & Voucher sudah dijalankan dan Admin
              memiliki akses baca ke daftar kelas. Detail: {initialError}
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto rounded-md p-0.5 opacity-70 hover:opacity-100"
            aria-label="Tutup pesan"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Kode Promo"
          value={String(stats.total)}
          description="Seluruh kode yang pernah dibuat"
          icon={TicketPercent}
          tone="bg-violet-50 text-violet-700"
        />
        <StatCard
          title="Promo Aktif"
          value={String(stats.active)}
          description="Sedang dapat digunakan member"
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Sudah Digunakan"
          value={String(stats.redeemed)}
          description="Pembayaran berhasil dan promo ditebus"
          icon={Tag}
          tone="bg-sky-50 text-sky-700"
        />
        <StatCard
          title="Reservasi Berjalan"
          value={String(stats.reserved)}
          description="Menunggu pembayaran atau verifikasi"
          icon={Clock3}
          tone="bg-amber-50 text-amber-700"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_18px_rgba(31,22,55,.035)]">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Daftar Kode Promo
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Kelola diskon persentase maupun potongan nominal.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kode atau deskripsi..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              style={{ paddingLeft: "2.5rem", paddingRight: "0.75rem" }}
              aria-label="Cari kode promo atau kelas"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Kode Promo</th>
                <th className="px-5 py-3.5">Berlaku Untuk</th>
                <th className="px-5 py-3.5">Potongan</th>
                <th className="px-5 py-3.5">Masa Berlaku</th>
                <th className="px-5 py-3.5">Penggunaan</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                      <TicketPercent size={22} />
                    </span>
                    <p className="mt-3 text-sm font-bold text-slate-700">
                      {initialPromos.length === 0
                        ? "Belum Ada Kode Promo"
                        : "Kode Promo Tidak Ditemukan"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {initialPromos.length === 0
                        ? "Buat kode promo pertama untuk mulai memberikan diskon kelas."
                        : "Coba gunakan kata kunci pencarian lain."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => {
                  const status = getPromoStatus(promo);
                  const used =
                    Number(promo.redeemed_count || 0) +
                    Number(promo.reserved_count || 0);
                  const hasHistory =
                    Number(promo.linked_order_count || 0) > 0 ||
                    Number(promo.redemption_history_count || 0) > 0 ||
                    used > 0;

                  return (
                    <tr key={promo.id} className="align-top transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-extrabold tracking-wide text-[#260047]">
                          {promo.code}
                        </p>
                        <p className="mt-1 max-w-[230px] text-[10px] leading-4 text-slate-400">
                          {promo.description || "Tanpa deskripsi"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Min. {formatMoney(promo.min_purchase)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {promo.applies_to_all ? (
                          <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-[#260047]">
                            Semua kelas
                          </span>
                        ) : (
                          <span className="inline-flex max-w-[190px] rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold leading-4 text-sky-800">
                            {promo.course_title || "Kelas tidak tersedia"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-slate-800">
                          {discountLabel(promo)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {promo.discount_type === "percentage"
                            ? "Persentase"
                            : "Nominal tetap"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[11px] font-medium text-slate-700">
                          {formatDate(promo.starts_at)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          s/d {formatDate(promo.expires_at)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-slate-800">
                          {used.toLocaleString("id-ID")}
                          {promo.max_uses
                            ? ` / ${Number(promo.max_uses).toLocaleString("id-ID")}`
                            : ""}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {Number(promo.redeemed_count || 0)} terpakai ·{" "}
                          {Number(promo.reserved_count || 0)} reservasi
                        </p>
                        {promo.max_uses_per_user && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Maks. {promo.max_uses_per_user} per member
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditForm(promo)}
                            title="Edit kode promo"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(promo)}
                            disabled={isPending && pendingPromoId === promo.id}
                            title={promo.is_active ? "Nonaktifkan promo" : "Aktifkan promo"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(promo)}
                            disabled={hasHistory}
                            title={
                              hasHistory
                                ? "Promo memiliki riwayat; nonaktifkan saja agar data transaksi tetap tersimpan."
                                : "Hapus kode promo"
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_18px_rgba(31,22,55,.035)]">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <History size={18} />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Riwayat Penggunaan Promo
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Reservasi dihitung final ketika invoice berubah menjadi paid.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Kode / Invoice</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Potongan</th>
                <th className="px-5 py-3.5">Waktu</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <p className="text-xs text-slate-400">
                      Belum ada riwayat penggunaan kode promo.
                    </p>
                  </td>
                </tr>
              ) : (
                initialRedemptions.map((item) => {
                  const status = redemptionStatus(item.redemption_status);
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-[11px] font-bold text-[#260047]">
                          {item.promo_code}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {item.invoice_number}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[11px] font-semibold text-slate-700">
                          {item.member_name || "Member"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[11px] font-bold text-emerald-700">
                          -{formatMoney(item.discount)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Total {formatMoney(item.total)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[10px] text-slate-600">
                          Reservasi: {formatDateTime(item.reserved_at)}
                        </p>
                        {item.redeemed_at && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Terpakai: {formatDateTime(item.redeemed_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-[11px] leading-5 text-violet-900">
        <Users size={16} className="mt-0.5 shrink-0" />
        <p>
          Kode promo berlaku untuk checkout kelas. Kuota yang sedang
          direservasi akan dilepas setelah masa reservasi 24 jam berakhir,
          kecuali pembayaran sudah berhasil dan promo berubah menjadi
          <strong> Terpakai</strong>.
        </p>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17112b]/55 p-3 backdrop-blur-[2px] sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-form-title"
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 id="promo-form-title" className="text-base font-extrabold text-slate-900">
                  {editingPromo ? "Edit Kode Promo" : "Buat Kode Promo"}
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tentukan kelas tujuan, nilai diskon, kuota, dan masa berlaku.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isPending}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                aria-label="Tutup formulir"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    Kode Promo
                  </span>
                  <input
                    required
                    minLength={2}
                    maxLength={40}
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase().replace(/\s+/g, ""),
                      }))
                    }
                    placeholder="CONTOH: HEMAT20"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm font-bold tracking-wider text-[#260047] outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                  <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
                    Gunakan huruf, angka, tanda hubung, atau garis bawah.
                  </span>
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    Deskripsi (opsional)
                  </span>
                  <input
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    maxLength={180}
                    placeholder="Contoh: Promo pembukaan kelas bulan November"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    Berlaku Untuk
                  </span>
                  <select
                    value={form.appliesToAll ? "all" : form.courseId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((current) => ({
                        ...current,
                        appliesToAll: value === "all",
                        courseId: value === "all" ? "" : value,
                      }));
                    }}
                    disabled={editingPromoHasHistory}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="all">Semua kelas</option>
                    {!form.appliesToAll &&
                      form.courseId &&
                      !initialCourses.some((course) => course.id === form.courseId) && (
                        <option value={form.courseId}>Kelas sebelumnya tidak tersedia</option>
                      )}
                    <option value="" disabled>
                      Pilih kelas tertentu
                    </option>
                    {initialCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} · {course.status === "published" ? "Dipublikasikan" : course.status === "draft" ? "Draft" : "Diarsipkan"}
                      </option>
                    ))}
                  </select>
                  <span className="block text-[11px] leading-4 text-slate-500">
                    Pilih Semua Kelas atau batasi kode promo untuk satu kelas. Daftar mengikuti kelas yang dibuat di Manajemen Kelas.
                  </span>
                  {editingPromoHasHistory && (
                    <span className="block text-[11px] leading-4 text-amber-700">
                      Target kelas dikunci karena kode promo sudah memiliki invoice atau riwayat penggunaan.
                    </span>
                  )}
                  {!form.appliesToAll && initialCourses.length === 0 && (
                    <span className="block text-[11px] leading-4 text-rose-600">
                      Belum ada kelas yang dapat dipilih. Buat kelas terlebih dahulu di Manajemen Kelas.
                    </span>
                  )}
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Jenis Diskon
                  </span>
                  <select
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountType: event.target.value as "percentage" | "fixed",
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Nominal (Rp)</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Nilai Diskon {form.discountType === "percentage" ? "(%)" : "(Rp)"}
                  </span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    max={form.discountType === "percentage" ? "99.99" : undefined}
                    step="0.01"
                    value={form.discountValue}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountValue: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Minimum Pembelian (Rp)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minPurchase}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minPurchase: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                {form.discountType === "percentage" && (
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700">
                      Maksimum Potongan (Rp)
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.maxDiscount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxDiscount: event.target.value,
                        }))
                      }
                      placeholder="Kosong = tanpa batas"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </label>
                )}

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Kuota Penggunaan
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.maxUses}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxUses: event.target.value,
                      }))
                    }
                    placeholder="Kosong = tanpa batas"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Batas per Member
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.maxUsesPerUser}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxUsesPerUser: event.target.value,
                      }))
                    }
                    placeholder="Kosong = tanpa batas"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Mulai Berlaku
                  </span>
                  <input
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startsAt: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Berakhir (opsional)
                  </span>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    min={form.startsAt || undefined}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expiresAt: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 accent-[#260047]"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-800">
                    Aktifkan kode promo
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                    Member dapat menggunakan kode saat checkout jika periode dan kuota memenuhi.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isPending}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 text-sm font-semibold text-white transition hover:bg-[#3B1260] disabled:opacity-60"
                >
                  {isPending ? "Menyimpan..." : editingPromo ? "Simpan Perubahan" : "Buat Kode Promo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#17112b]/55 p-4 backdrop-blur-[2px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-promo-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Trash2 size={19} />
            </span>
            <h2 id="delete-promo-title" className="mt-4 text-base font-extrabold text-slate-900">
              Hapus kode promo?
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Kode <strong className="font-mono text-[#260047]">{deleteTarget.code}</strong>{" "}
              akan dihapus permanen. Penghapusan hanya tersedia jika belum
              ada invoice atau riwayat yang memakai kode ini.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="h-10 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
