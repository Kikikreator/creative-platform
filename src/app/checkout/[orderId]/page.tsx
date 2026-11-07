
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

type OrderRow = {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  currency: string;
};

type OrderItemRow = {
  id: string;
  course_id: string;
  course_title_snapshot: string;
  unit_price: number | string;
  quantity: number;
  line_total: number | string;
};

type PaymentRow = {
  id: string;
  payment_method_id: string | null;
  amount: number | string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
};

type PaymentMethodRow = {
  name: string;
  bank_name: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatMoney(
  value: number | string,
  currency = "IDR"
) {
  const safeCurrency = /^[A-Z]{3}$/.test(currency)
    ? currency
    : "IDR";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default async function PaymentStatusPage({
  params,
}: PageProps) {
  await connection();

  const { orderId } = await params;

  if (!UUID_REGEX.test(orderId)) {
    notFound();
  }

  const supabase = await createClient();

  // AUTHENTICATION
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Halaman invoice/pembayaran hanya untuk Peserta.
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(`Gagal memeriksa hak akses pembayaran: ${roleError.message}`);
  }

  const primaryRole = getPrimaryRole(normalizeRoles(roleRows));
  if (primaryRole === "admin") redirect("/admin");
  if (primaryRole === "instructor") redirect("/mentor");
  if (primaryRole !== "member") redirect("/login?reason=role-unassigned");

  // AMBIL INVOICE MILIK USER
  const { data: orderData, error: orderError } =
    await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        invoice_number,
        status,
        subtotal,
        discount,
        total,
        currency
      `)
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (orderError || !orderData) {
    notFound();
  }

  const order = orderData as OrderRow;

  // AMBIL DETAIL TRANSAKSI
  const [
    itemsResult,
    paymentResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select(`
        id,
        course_id,
        course_title_snapshot,
        unit_price,
        quantity,
        line_total
      `)
      .eq("order_id", order.id),

    supabase
      .from("payments")
      .select(`
        id,
        payment_method_id,
        amount,
        status,
        rejection_reason,
        created_at
      `)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (itemsResult.error || paymentResult.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#EEEAF7] bg-white p-7 text-center">
          <h1 className="text-lg font-bold text-[#251A3D]">
            Status pembayaran belum dapat dimuat
          </h1>
          <p className="mt-2 text-sm text-[#9B95AB]">
            Silakan muat ulang halaman beberapa saat lagi.
          </p>
          <Link
            href={`/checkout/${order.id}`}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5B21B6] px-5 py-3 text-sm font-bold text-white"
          >
            Muat Ulang
          </Link>
        </div>
      </main>
    );
  }

  const items = (itemsResult.data ?? []) as OrderItemRow[];
  const payment = paymentResult.data as PaymentRow | null;
  const profile = profileResult.data as ProfileRow | null;

  if (!items.length) {
    notFound();
  }

  const courseId = items[0].course_id;

  // METODE PEMBAYARAN
  let paymentMethod: PaymentMethodRow | null = null;

  if (payment?.payment_method_id) {
    const { data } = await supabase
      .from("payment_methods")
      .select("name, bank_name")
      .eq("id", payment.payment_method_id)
      .maybeSingle();

    paymentMethod = data as PaymentMethodRow | null;
  }

  // STATUS TRANSAKSI
  const isPaid =
    order.status === "paid" ||
    payment?.status === "approved";

  const isRejected =
    !isPaid &&
    (
      order.status === "rejected" ||
      payment?.status === "rejected"
    );

  const isWaiting =
    !isPaid &&
    !isRejected &&
    (
      order.status === "waiting_verification" ||
      payment?.status === "waiting_verification"
    );

  // Jika belum ada pembayaran, kembali ke checkout.
  if (!isWaiting && !isPaid && !isRejected) {
    redirect(
      `/checkout?course=${encodeURIComponent(courseId)}`
    );
  }

  // WHATSAPP ADMIN
  const whatsappMessage = [
    "Assalamu'alaikum Admin Kiki Creator Class,",
    "",
    "Saya sudah mengirim bukti pembayaran kelas melalui website Kiki Creator Class. Mohon bantu verifikasi pembayaran saya.",
    "",
    `Nama: ${profile?.full_name || "-"}`,
    `Email: ${user.email || "-"}`,
    `No. HP/WhatsApp: ${profile?.phone || "-"}`,
    `Kelas: ${items.map((item) => item.course_title_snapshot).join(", ")}`,
    `Nomor Invoice: ${order.invoice_number}`,
    `Total Pembayaran: ${formatMoney(order.total, order.currency)}`,
    `Metode Pembayaran: ${paymentMethod?.name || "Tidak tercatat"}`,
    `Status: ${isPaid ? "Sudah disetujui" : isRejected ? "Ditolak" : "Menunggu verifikasi admin"}`,
    "",
    "Mohon informasikan kepada saya setelah pembayaran selesai diperiksa. Terima kasih.",
  ].join("\n");

  const whatsappUrl =
    `https://wa.me/6281270885153?text=${encodeURIComponent(whatsappMessage)}`;

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  const total = Number(order.total);

  return (
    <main className="min-h-screen bg-[#F7F6FC] text-[#1B1730]">

      {/* HEADER */}
      <header className="border-b border-[#EEEAF7] bg-white">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B21B6] text-white">
              <GraduationCap size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-[#251A3D]">
                Kiki Creator Class
              </p>
              <p className="text-[10px] text-[#9D97B4]">
                Learn · Create · Grow
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#716687] hover:text-[#5B21B6]"
          >
            Dashboard
          </Link>

        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">

        {/* STATUS CARD */}
        <section className="rounded-[24px] border border-[#EEEAF7] bg-white p-6 text-center shadow-[0_8px_30px_rgba(25,65,52,0.045)] sm:p-10">

          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl ${
              isPaid
                ? "bg-emerald-50 text-emerald-600"
                : isRejected
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600"
            }`}
          >
            {isPaid ? (
              <CheckCircle2 size={38} />
            ) : isRejected ? (
              <XCircle size={38} />
            ) : (
              <Clock3 size={38} />
            )}
          </div>

          <div className="mt-5 flex justify-center">
            <span
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                isPaid
                  ? "bg-emerald-100 text-emerald-700"
                  : isRejected
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {isPaid
                ? "Pembayaran disetujui"
                : isRejected
                  ? "Pembayaran ditolak"
                  : "Dalam pemeriksaan"}
            </span>
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight text-[#251A3D] sm:text-2xl">
            {isPaid
              ? "Pembayaran Berhasil!"
              : isRejected
                ? "Pembayaran Belum Disetujui"
                : "Pembayaran Menunggu Verifikasi"}
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-xs leading-7 text-[#9B95AB] sm:text-sm">
            {isPaid
              ? "Pembayaran telah disetujui oleh Admin Kiki Creator Class. Akses kelas sudah diaktifkan untuk akunmu."
              : isRejected
                ? "Pembayaran belum dapat disetujui. Silakan periksa alasan penolakan dan lakukan pembayaran kembali."
                : "Bukti pembayaran berhasil kami terima. Admin Kiki Creator Class sedang memeriksa bukti pembayaran dan mencocokkan nominal dengan invoice. Akses kelas akan aktif setelah pembayaran disetujui."}
          </p>

          {isWaiting && (
            <div className="mx-auto mt-6 max-w-lg rounded-xl border border-amber-100 bg-amber-50 p-4 text-left">
              <div className="flex gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
                <p className="text-[11px] leading-6 text-amber-800">
                  Kamu tidak perlu mengirim pembayaran ulang. Simpan nomor invoice dan tunggu proses verifikasi Admin. Kami akan mengaktifkan akses kelas setelah pembayaran disetujui.
                </p>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left">
              <p className="text-xs font-bold text-rose-700">
                Alasan penolakan
              </p>
              <p className="mt-2 text-xs leading-6 text-rose-700">
                {payment?.rejection_reason ||
                  "Silakan periksa kembali bukti dan nominal pembayaran."}
              </p>
            </div>
          )}

        </section>

        {/* INVOICE */}
        <section className="mt-5 rounded-[22px] border border-[#EEEAF7] bg-white p-5 shadow-sm sm:p-7">

          <div className="flex items-center justify-between gap-3 border-b border-[#EEEAF7] pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9D97B4]">
                Invoice Pembayaran
              </p>
              <p className="mt-1 break-all text-base font-bold text-[#5B21B6]">
                {order.invoice_number}
              </p>
            </div>

            <div className="rounded-xl bg-[#F3EEFF] p-3 text-[#6D28D9]">
              <GraduationCap size={22} />
            </div>
          </div>

          <div className="mt-5 space-y-4">

            <div>
              <p className="text-[10px] text-[#9D97B4]">
                Detail Kelas
              </p>

              {items.map((item) => (
                <div
                  key={item.id}
                  className="mt-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#5D5473]">
                      {item.course_title_snapshot}
                    </p>
                    <p className="mt-1 text-[10px] text-[#9D97B4]">
                      {item.quantity} kelas
                    </p>
                  </div>

                  <p className="shrink-0 text-xs font-semibold text-[#5D5473]">
                    {formatMoney(item.line_total, order.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-[#EEEAF7] pt-4 space-y-3">

              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[#9B95AB]">Subtotal</span>
                <span className="font-semibold text-[#5D5473]">
                  {formatMoney(subtotal, order.currency)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-[#9B95AB]">Diskon</span>
                  <span className="font-semibold text-[#6D28D9]">
                    -{formatMoney(discount, order.currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-3 border-t border-[#EEEAF7] pt-4">
                <span className="text-sm font-bold text-[#5D5473]">
                  Total Pembayaran
                </span>
                <span className="text-lg font-bold text-[#5B21B6]">
                  {formatMoney(total, order.currency)}
                </span>
              </div>

              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[#9B95AB]">
                  Metode Pembayaran
                </span>
                <span className="font-semibold text-[#5D5473]">
                  {paymentMethod?.name || paymentMethod?.bank_name || "-"}
                </span>
              </div>

              {payment?.created_at && (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-[#9B95AB]">
                    Tanggal Pengiriman
                  </span>
                  <span className="text-right font-medium text-[#5D5473]">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(payment.created_at))}
                  </span>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* ACTIONS */}
        {isWaiting && (
          <section className="mt-5 rounded-[22px] border border-[#EEEAF7] bg-white p-5 shadow-sm sm:p-7">

            <h2 className="text-sm font-bold text-[#3E315D]">
              Langkah Selanjutnya
            </h2>

            <p className="mt-2 text-xs leading-6 text-[#9B95AB]">
              Agar Admin lebih cepat mengetahui pembayaranmu, silakan konfirmasi melalui WhatsApp menggunakan pesan yang sudah kami siapkan.
            </p>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#15803D]"
            >
              <MessageCircle size={18} />
              Konfirmasi Admin via WhatsApp
              <ArrowRight size={16} />
            </a>

            <p className="mt-3 text-center text-[10px] leading-5 text-[#9D97B4]">
              Pesan konfirmasi dan detail invoice sudah disiapkan secara otomatis. Periksa pesan WhatsApp, kemudian tekan Kirim.
            </p>

            <Link
              href={`/checkout/${order.id}`}
              className="mt-5 flex items-center justify-center gap-2 border-t border-[#EEEAF7] pt-5 text-xs font-semibold text-[#6D28D9]"
            >
              <RefreshCw size={14} />
              Perbarui Status Pembayaran
            </Link>

          </section>
        )}

        {isRejected && (
          <Link
            href={`/checkout?course=${encodeURIComponent(courseId)}`}
            className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-5 py-3 text-sm font-bold text-white hover:bg-[#6D28D9]"
          >
            <ArrowLeft size={17} />
            Kembali ke Pembayaran
          </Link>
        )}

        {isPaid && (
          <Link
            href="/dashboard"
            className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-5 py-3 text-sm font-bold text-white hover:bg-[#6D28D9]"
          >
            Masuk ke Dashboard
            <ArrowRight size={17} />
          </Link>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/kelas"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#9B95AB] hover:text-[#5B21B6]"
          >
            <ArrowLeft size={14} />
            Kembali ke Daftar Kelas
          </Link>

          <p className="mt-5 text-[10px] text-[#AAA5B8]">
            © {new Date().getFullYear()} Kiki Creator Class. All rights reserved.
          </p>
        </div>

      </div>
    </main>
  );
}
