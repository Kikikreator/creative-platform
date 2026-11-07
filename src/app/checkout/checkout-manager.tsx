
"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  CreditCard,
  FileImage,
  GraduationCap,
  Info,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Tag,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// ======================================================
// TYPES
// ======================================================

export type CheckoutCourse = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number | string;
};

export type CheckoutOrder = {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  currency: string;
  promo_code_id: string | null;
  promo_code: string | null;
};

export type CheckoutPayment = {
  id: string;
  order_id: string;
  payment_method_id: string | null;
  amount: number | string;
  proof_path: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

export type CheckoutPaymentMethod = {
  id: string;
  name: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qr_image_path: string | null;
  instructions: string | null;
  is_active: boolean;
  position: number;
};

export type CheckoutProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type CheckoutManagerProps = {
  initialCourse: CheckoutCourse | null;
  initialOrder: CheckoutOrder | null;
  initialPayment: CheckoutPayment | null;
  initialPaymentMethods: CheckoutPaymentMethod[];
  initialProfile: CheckoutProfile | null;
  userId: string;
  userEmail: string;
  initialError: string | null;
};

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

function getAbsoluteUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function getFileExtension(file: File) {
  const extension =
    file.name.split(".").pop()?.toLowerCase() ?? "jpg";

  return ["jpg", "jpeg", "png", "webp"].includes(extension)
    ? extension
    : "jpg";
}

type PromoApplyResult = {
  result_promo_code_id: string;
  result_promo_code: string;
  result_discount: number | string;
  result_total: number | string;
};

type PromoRemoveResult = {
  result_total: number | string;
};

type PromoRpcName = "apply_course_promo" | "remove_course_promo";

async function callPromoRpc(
  supabase: ReturnType<typeof createClient>,
  functionName: PromoRpcName,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: { message: string } | null }> {
  // Cast ini menjaga file tetap kompatibel dengan Database type lama.
  // Setelah SQL dijalankan, nama RPC tetap diverifikasi oleh PostgreSQL.
  // WAJIB bind ke instance Supabase. Tanpa bind, method rpc kehilangan
  // konteks `this` dan memicu: Cannot read properties of undefined (reading 'rest').
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  return rpc(functionName, args);
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function CheckoutManager({
  initialCourse,
  initialOrder,
  initialPayment,
  initialPaymentMethods,
  initialProfile,
  userId,
  userEmail,
  initialError,
}: CheckoutManagerProps) {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [order, setOrder] = useState<CheckoutOrder | null>(initialOrder);

  const [promoCode, setPromoCode] = useState(
    initialOrder?.promo_code ?? ""
  );
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  const [selectedMethodId, setSelectedMethodId] =
    useState(
      initialPayment?.payment_method_id ??
        initialPaymentMethods[0]?.id ??
        ""
    );

  const [proofFile, setProofFile] =
    useState<File | null>(null);

  const [proofPreview, setProofPreview] =
    useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(
    initialPayment?.status === "waiting_verification"
  );

  const [paymentStatus, setPaymentStatus] = useState<string | null>(
    initialPayment?.status ?? null
  );

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [copied, setCopied] = useState("");

  const selectedMethod = useMemo(
    () =>
      initialPaymentMethods.find(
        (method) => method.id === selectedMethodId
      ) ?? null,
    [initialPaymentMethods, selectedMethodId]
  );

  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  // Sinkronkan data server setelah router.refresh(), termasuk ketika
  // admin menyetujui atau menolak pembayaran.
  useEffect(() => {
    if (initialOrder) {
      setOrder((current) =>
        !current || current.id !== initialOrder.id
          ? initialOrder
          : { ...current, ...initialOrder }
      );
    }
  }, [
    initialOrder?.id,
    initialOrder?.invoice_number,
    initialOrder?.status,
    initialOrder?.subtotal,
    initialOrder?.discount,
    initialOrder?.total,
    initialOrder?.currency,
    initialOrder?.promo_code_id,
    initialOrder?.promo_code,
  ]);

  useEffect(() => {
    setPaymentStatus(initialPayment?.status ?? null);

    if (initialPayment?.payment_method_id) {
      setSelectedMethodId(initialPayment.payment_method_id);
    }
  }, [initialPayment?.id, initialPayment?.status, initialPayment?.payment_method_id]);

  // ====================================================
  // STATUS
  // ====================================================

  const isPaid =
    order?.status === "paid" ||
    paymentStatus === "approved";

  const isRejected =
    order?.status === "rejected" ||
    paymentStatus === "rejected";

  // Status paid/rejected mengalahkan state lokal submitted.
  // Ini juga memungkinkan member mengirim ulang bukti setelah ditolak.
  const isWaiting =
    !isPaid &&
    !isRejected &&
    (
      submitted ||
      order?.status === "waiting_verification" ||
      paymentStatus === "waiting_verification"
    );

  const coursePrice = Number(initialCourse?.price ?? 0);

  const subtotal = Number(order?.subtotal ?? coursePrice);
  const discount = Number(order?.discount ?? 0);
  const total = Number(order?.total ?? coursePrice);
  const hasAppliedPromo = Boolean(
    order?.promo_code_id && order?.promo_code
  );

  // ====================================================
  // ADMIN WHATSAPP CONFIRMATION
  // ====================================================

  const adminWhatsAppNumber = "6281270885153";

  const whatsappMessage = [
    "Assalamu'alaikum Admin Kiki Creator Class,",
    "",
    "Saya sudah mengirim bukti pembayaran kelas melalui website Kiki Creator Class. Mohon bantu verifikasi pembayaran saya.",
    "",
    `Nama: ${initialProfile?.full_name?.trim() || "Tidak dicantumkan"}`,
    `Email: ${userEmail || "-"}`,
    `No. HP/WhatsApp: ${initialProfile?.phone || "-"}`,
    `Kelas: ${initialCourse?.title || "-"}`,
    `Nomor Invoice: ${order?.invoice_number || "-"}`,
    `Total Pembayaran: ${formatMoney(total, order?.currency || "IDR")}`,
    `Metode Pembayaran: ${selectedMethod?.name || "Tidak tercatat"}`,
    "Status: Menunggu verifikasi admin",
    "",
    "Mohon informasikan kepada saya setelah pembayaran selesai diperiksa. Terima kasih."
  ].join("\n");

  const adminWhatsAppUrl =
    `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  // ====================================================
  // PROMO CODE
  // ====================================================

  async function applyPromo() {
    if (!order) {
      setPromoError("Data pesanan tidak tersedia.");
      return;
    }

    const normalizedCode = promoCode.trim().toUpperCase();

    if (!normalizedCode) {
      setPromoError("Masukkan kode promo terlebih dahulu.");
      setPromoMessage("");
      return;
    }

    if (promoLoading) return;

    setPromoLoading(true);
    setPromoError("");
    setPromoMessage("");

    try {
      const { data, error: promoRpcError } = await callPromoRpc(
        supabase,
        "apply_course_promo",
        {
          p_order_id: order.id,
          p_code: normalizedCode,
        }
      );

      if (promoRpcError) throw new Error(promoRpcError.message);

      const result = (
        Array.isArray(data) ? data[0] : data
      ) as PromoApplyResult | null;

      if (!result) {
        throw new Error("Respons validasi promo tidak ditemukan.");
      }

      setOrder((current) =>
        current
          ? {
              ...current,
              promo_code_id: result.result_promo_code_id,
              promo_code: result.result_promo_code,
              discount: Number(result.result_discount),
              total: Number(result.result_total),
            }
          : current
      );

      setPromoCode(String(result.result_promo_code ?? normalizedCode));
      setPromoMessage(
        `Kode promo ${String(result.result_promo_code ?? normalizedCode)} berhasil diterapkan.`
      );
    } catch (err) {
      setPromoError(
        err instanceof Error
          ? err.message
          : "Kode promo gagal diterapkan. Silakan coba kembali."
      );
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromo() {
    if (!order || promoLoading) return;

    setPromoLoading(true);
    setPromoError("");
    setPromoMessage("");

    try {
      const { data, error: promoRpcError } = await callPromoRpc(
        supabase,
        "remove_course_promo",
        { p_order_id: order.id }
      );

      if (promoRpcError) throw new Error(promoRpcError.message);

      const result = (
        Array.isArray(data) ? data[0] : data
      ) as PromoRemoveResult | null;

      setOrder((current) =>
        current
          ? {
              ...current,
              promo_code_id: null,
              promo_code: null,
              discount: 0,
              total: Number(
                result?.result_total ?? current.subtotal
              ),
            }
          : current
      );

      setPromoCode("");
      setPromoMessage("Kode promo berhasil dihapus.");
    } catch (err) {
      setPromoError(
        err instanceof Error
          ? err.message
          : "Kode promo gagal dihapus. Silakan coba kembali."
      );
    } finally {
      setPromoLoading(false);
    }
  }

  // ====================================================
  // FILE VALIDATION
  // ====================================================

  function handleProofChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    event.target.value = "";

    if (!file) return;

    setError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Bukti pembayaran harus berupa JPG, PNG, atau WebP."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Ukuran bukti pembayaran maksimal 5 MB."
      );
      return;
    }

    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  function removeProof() {
    setProofFile(null);
    setProofPreview(null);
  }

  // ====================================================
  // COPY ACCOUNT NUMBER
  // ====================================================

  async function copyText(
    value: string,
    key: string
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);

      window.setTimeout(() => {
        setCopied((current) =>
          current === key ? "" : current
        );
      }, 1800);
    } catch {
      setError("Gagal menyalin informasi rekening.");
    }
  }

  // ====================================================
  // SUBMIT PAYMENT
  // ====================================================

  async function submitPayment() {
    if (!order || !initialCourse) {
      setError("Data pesanan tidak tersedia.");
      return;
    }

    if (!selectedMethod) {
      setError("Silakan pilih metode pembayaran.");
      return;
    }

    if (!proofFile) {
      setError(
        "Silakan upload bukti pembayaran terlebih dahulu."
      );
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      // -----------------------------------------------
      // AUTHENTICATION
      // -----------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace(
          `/register?course=${encodeURIComponent(
            initialCourse.id
          )}`
        );

        return;
      }

      if (user.id !== userId) {
        throw new Error(
          "Sesi pengguna berubah. Silakan muat ulang halaman."
        );
      }

      // -----------------------------------------------
      // FILE PATH
      // Format wajib sesuai fungsi SQL:
      // user_id/order_id/nama-file
      // -----------------------------------------------

      const extension = getFileExtension(proofFile);

      uploadedPath =
        `${user.id}/${order.id}/` +
        `bukti-${Date.now()}.${extension}`;

      // -----------------------------------------------
      // UPLOAD PAYMENT PROOF
      // -----------------------------------------------

      const { error: uploadError } =
        await supabase.storage
          .from("payment-proofs")
          .upload(uploadedPath, proofFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: proofFile.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      // -----------------------------------------------
      // SUBMIT PAYMENT RPC
      // -----------------------------------------------

      const { error: submitError } =
        await supabase.rpc(
          "submit_course_payment",
          {
            p_order_id: order.id,
            p_payment_method_id: selectedMethod.id,
            p_proof_path: uploadedPath,
          }
        );

      if (submitError) {
        await supabase.storage
          .from("payment-proofs")
          .remove([uploadedPath]);

        uploadedPath = null;

        throw submitError;
      }

      uploadedPath = null;

      setSubmitted(true);
      setPaymentStatus("waiting_verification");
      setOrder((current) =>
        current
          ? { ...current, status: "waiting_verification" }
          : current
      );

      setMessage(
        "Bukti pembayaran berhasil dikirim dan sedang menunggu verifikasi Admin."
      );

      setProofFile(null);
setProofPreview(null);

// Pindah ke halaman status pembayaran khusus.
router.replace(`/checkout/${order.id}`);
    } catch (err) {
      console.error(err);

      if (uploadedPath) {
        await supabase.storage
          .from("payment-proofs")
          .remove([uploadedPath]);
      }

      setError(
        err instanceof Error
          ? err.message
          : "Pembayaran gagal dikirim. Silakan coba kembali."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ====================================================
  // ERROR STATE
  // ====================================================

  if (!initialCourse || !order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-[#EEEAF7] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Info size={25} />
          </div>

          <h1 className="mt-5 text-xl font-bold text-[#251A3D]">
            Checkout tidak tersedia
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#9B95AB]">
            {initialError ||
              "Data checkout tidak dapat dimuat."}
          </p>

          <Link
            href="/kelas"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
          >
            <ArrowLeft size={16} />
            Kembali ke Kelas
          </Link>
        </div>
      </main>
    );
  }

  // ====================================================
  // CHECKOUT PAGE
  // ====================================================

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F6FC] text-[#1B1730]">

      {/* ================================================
          HEADER
      ================================================ */}

      <header className="sticky top-0 z-40 border-b border-[#EEEAF7] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">

          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5B21B6] text-white">
              <GraduationCap size={21} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-[#251A3D]">
                Kiki Creator Class
              </p>

              <p className="text-[10px] text-[#9D97B4]">
                Learn · Create · Grow
              </p>
            </div>
          </Link>

          <Link
            href={`/kelas/${encodeURIComponent(initialCourse.slug)}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#716687] transition hover:bg-[#F6F2FC] hover:text-[#6D28D9]"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">
              Kembali ke Kelas
            </span>
            <span className="sm:hidden">Kembali</span>
          </Link>

        </div>
      </header>

      {/* ================================================
          MAIN
      ================================================ */}

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">

        {/* TITLE */}

        <div className="mb-7">
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#F3EEFF] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">
            <CreditCard size={14} />
            Checkout Pembelajaran
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#251A3D] sm:text-3xl">
            Selesaikan Pembayaran
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9B95AB]">
            Periksa informasi pesanan dan pilih metode pembayaran untuk melanjutkan pembelian kelas.
          </p>
        </div>

        {/* ERROR INFORMATION */}

        {initialError && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
            <Info size={17} className="mt-0.5 shrink-0" />
            <p>{initialError}</p>
          </div>
        )}

        {/* ================================================
            TWO COLUMN LAYOUT
        ================================================ */}

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">

          {/* ============================================
              LEFT COLUMN
          ============================================ */}

          <section className="min-w-0 space-y-5">

            {/* CUSTOMER INFORMATION */}

            <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)] sm:p-6">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#3E315D]">
                    Informasi Pembeli
                  </h2>

                  <p className="mt-1 text-[11px] text-[#9D97B4]">
                    Informasi akun yang digunakan untuk transaksi.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 border-t border-[#F8F6FD] pt-5">

                <div>
                  <p className="text-[10px] font-medium text-[#9D97B4]">
                    Nama Lengkap
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#5D5473]">
                    {initialProfile?.full_name?.trim() ||
                      "Nama belum dilengkapi"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-[#9D97B4]">
                    Email
                  </p>

                  <p className="mt-1 break-all text-sm font-medium text-[#5D5473]">
                    {userEmail || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-[#9D97B4]">
                    Nomor HP / WhatsApp
                  </p>

                  <p className="mt-1 text-sm font-medium text-[#5D5473]">
                    {initialProfile?.phone || "Belum diisi"}
                  </p>
                </div>

              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#FAF9FF] p-3">
                <Info
                  size={15}
                  className="mt-0.5 shrink-0 text-[#6D28D9]"
                />

                <p className="text-[10px] leading-5 text-[#817A97]">
                  Pembelian kelas akan tercatat menggunakan akun yang sedang login.
                </p>
              </div>

            </div>

            {/* PRODUCT SUMMARY */}

            <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)] sm:p-6">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                  <BookOpen size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-[#3E315D]">
                    Ringkasan Kelas
                  </h2>

                  <p className="mt-1 text-[11px] text-[#9D97B4]">
                    Produk pembelajaran yang akan dibeli.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-4 border-t border-[#F8F6FD] pt-5 sm:flex-row">

                <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-[#F2EEFA] sm:h-[105px] sm:w-[150px]">
                  {initialCourse.cover_image_url ? (
                    <img
                      src={initialCourse.cover_image_url}
                      alt={initialCourse.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#6D28D9]">
                      <BookOpen size={35} />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">

                  <div>
                    {initialCourse.category && (
                      <span className="inline-flex rounded-md bg-[#F3EEFF] px-2 py-1 text-[9px] font-bold text-[#6D28D9]">
                        {initialCourse.category}
                      </span>
                    )}

                    <h3 className="mt-2 text-sm font-bold leading-6 text-[#3E315D]">
                      {initialCourse.title}
                    </h3>

                    <p className="mt-1 text-[11px] leading-5 text-[#9D97B4]">
                      {initialCourse.short_description ||
                        "Program pembelajaran Kiki Creator Class."}
                    </p>
                  </div>

                  <p className="text-sm font-bold text-[#5B21B6]">
                    {formatMoney(initialCourse.price)}
                  </p>

                </div>

              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-[#F8F6FD] pt-4 text-[10px] text-[#9B95AB]">
                <ShieldCheck
                  size={15}
                  className="shrink-0 text-[#8B5CF6]"
                />
                Akses kelas diberikan setelah pembayaran disetujui Admin.
              </div>

            </div>

            {/* PAYMENT PROOF */}

            {!isPaid && !isWaiting && (
              <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)] sm:p-6">

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                    <UploadCloud size={19} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#3E315D]">
                      Bukti Pembayaran
                    </h2>

                    <p className="mt-1 text-[11px] text-[#9D97B4]">
                      Upload bukti transfer setelah melakukan pembayaran.
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-[#F8F6FD] pt-5">

                  {!proofPreview ? (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E3D8FF] bg-[#FAF9FF] px-5 py-9 text-center transition hover:border-[#8B5CF6] hover:bg-[#F8F6FD]">

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#6D28D9]">
                        <FileImage size={23} />
                      </div>

                      <p className="mt-4 text-sm font-bold text-[#5D5473]">
                        Pilih Bukti Pembayaran
                      </p>

                      <p className="mt-2 text-[11px] text-[#9D97B4]">
                        JPG, PNG, atau WebP
                      </p>

                      <p className="mt-1 text-[10px] text-[#9D97B4]">
                        Maksimal 5 MB
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleProofChange}
                        className="hidden"
                      />

                    </label>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-[#EEEAF7]">

                      <div className="relative flex max-h-[360px] items-center justify-center bg-[#F7F6FC] p-3">
                        <img
                          src={proofPreview}
                          alt="Preview bukti pembayaran"
                          className="max-h-[330px] max-w-full rounded-xl object-contain"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-[#EEEAF7] p-3">

                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#5D5473]">
                            {proofFile?.name}
                          </p>

                          <p className="mt-1 text-[10px] text-[#9D97B4]">
                            {proofFile
                              ? `${(
                                  proofFile.size /
                                  1024 /
                                  1024
                                ).toFixed(2)} MB`
                              : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={removeProof}
                          className="shrink-0 rounded-lg border border-rose-100 px-3 py-2 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Ganti File
                        </button>

                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}

          </section>

          {/* ============================================
              RIGHT COLUMN
          ============================================ */}

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-[88px]">

            {/* PAYMENT DETAIL */}

            <div className="overflow-hidden rounded-[20px] border border-[#EEEAF7] bg-white shadow-[0_5px_22px_rgba(25,65,52,0.05)]">

              <div className="bg-[#5B21B6] px-5 py-5 text-white sm:px-6">

                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#E8DEFF]">
                    Payment Detail
                  </p>

                  <Wallet size={20} />
                </div>

                <p className="mt-3 text-[27px] font-bold tracking-tight">
                  {formatMoney(total, order.currency)}
                </p>

                <p className="mt-1 text-[10px] text-[#D8C7FF]">
                  Total pembayaran
                </p>

              </div>

              <div className="space-y-3 p-5 sm:p-6">

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#9B95AB]">
                    Subtotal
                  </span>

                  <span className="font-semibold text-[#5D5473]">
                    {formatMoney(subtotal, order.currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#9B95AB]">
                    Diskon
                  </span>

                  <span className="font-semibold text-[#6D28D9]">
                    -{formatMoney(discount, order.currency)}
                  </span>
                </div>

                <div className="border-t border-dashed border-[#EEEAF7] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#5D5473]">
                      Total
                    </span>

                    <span className="text-lg font-bold text-[#5B21B6]">
                      {formatMoney(total, order.currency)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-[#F7F6FC] px-3 py-2">
                  <p className="text-[9px] text-[#9D97B4]">
                    Nomor Invoice
                  </p>

                  <p className="mt-1 break-all text-[11px] font-bold text-[#5D5473]">
                    {order.invoice_number}
                  </p>
                </div>

              </div>

            </div>

            {/* PROMO CODE */}

            {!isPaid && !isWaiting && (
              <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                    <Tag size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#3E315D]">
                      Kode Promo
                    </h2>
                    <p className="mt-1 text-[10px] text-[#9D97B4]">
                      Gunakan kode promo untuk mendapatkan potongan harga.
                    </p>
                  </div>
                </div>

                {hasAppliedPromo ? (
                  <div className="mt-4 rounded-xl border border-[#E3D8FF] bg-[#F8F6FD] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#817A97]">
                          Promo diterapkan
                        </p>
                        <p className="mt-1 break-all text-sm font-bold tracking-wide text-[#5B21B6]">
                          {order.promo_code}
                        </p>
                        <p className="mt-1 text-[10px] text-[#6D28D9]">
                          Potongan {formatMoney(discount, order.currency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removePromo}
                        disabled={promoLoading}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#EAE1FF] bg-white px-2.5 text-[10px] font-semibold text-[#716687] transition hover:bg-[#F3EEFF] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {promoLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <X size={13} />
                        )}
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(event) => {
                        setPromoCode(event.target.value.toUpperCase());
                        setPromoError("");
                        setPromoMessage("");
                      }}
                      placeholder="Masukkan kode promo"
                      maxLength={40}
                      autoComplete="off"
                      disabled={promoLoading}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-[#EEEAF7] bg-[#FFFFFF] px-3 text-xs font-semibold uppercase tracking-wide text-[#5D5473] outline-none transition placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#AAA5B8] focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/10 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-4 text-xs font-bold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {promoLoading ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          Memeriksa
                        </>
                      ) : (
                        "Gunakan"
                      )}
                    </button>
                  </div>
                )}

                {promoError && (
                  <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-700">
                    {promoError}
                  </p>
                )}

                {promoMessage && !promoError && (
                  <p role="status" className="mt-3 rounded-lg bg-[#F8F6FD] px-3 py-2 text-[10px] leading-5 text-[#6D28D9]">
                    {promoMessage}
                  </p>
                )}
              </div>
            )}

            {/* PAYMENT METHOD */}

            {!isPaid && !isWaiting && (
              <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)] sm:p-6">

                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                    <CreditCard size={18} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#3E315D]">
                      Payment Method
                    </h2>

                    <p className="mt-1 text-[10px] text-[#9D97B4]">
                      Pilih metode pembayaran.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">

                  {initialPaymentMethods.length > 0 ? (
                    initialPaymentMethods.map((method) => {
                      const selected =
                        selectedMethodId === method.id;

                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => {
                            setSelectedMethodId(method.id);
                            setError("");
                          }}
                          aria-pressed={selected}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                            selected
                              ? "border-[#6D28D9] bg-[#F8F6FD] ring-2 ring-[#6D28D9]/10"
                              : "border-[#EEEAF7] bg-white hover:border-[#D0BCFF] hover:bg-[#FFFFFF]"
                          }`}
                        >

                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            selected
                              ? "bg-[#5B21B6] text-white"
                              : "bg-[#F7F4FD] text-[#6D28D9]"
                          }`}>
                            <Wallet size={19} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-[#5D5473]">
                              {method.name}
                            </p>

                            <p className="mt-1 truncate text-[10px] text-[#9D97B4]">
                              {method.bank_name ||
                                "Metode pembayaran"}
                            </p>
                          </div>

                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[#6D28D9] bg-[#6D28D9] text-white"
                              : "border-[#DED0FF] bg-white"
                          }`}>
                            {selected && (
                              <CheckCircle2 size={13} />
                            )}
                          </div>

                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#EEEAF7] bg-[#FAF9FF] p-5 text-center">
                      <CreditCard
                        size={24}
                        className="mx-auto text-[#9D97B4]"
                      />

                      <p className="mt-3 text-xs font-semibold text-[#5D5473]">
                        Belum ada metode pembayaran
                      </p>

                      <p className="mt-1 text-[10px] leading-5 text-[#9D97B4]">
                        Admin belum menambahkan metode pembayaran yang aktif.
                      </p>
                    </div>
                  )}

                </div>

                {/* SELECTED METHOD DETAILS */}

                {selectedMethod && (
                  <div className="mt-4 rounded-xl border border-[#EEEAF7] bg-[#F8F7FC] p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">
                      Detail Pembayaran
                    </p>

                    {selectedMethod.bank_name && (
                      <div className="mt-4">
                        <p className="text-[10px] text-[#9D97B4]">
                          Bank / Provider
                        </p>

                        <p className="mt-1 text-xs font-semibold text-[#5D5473]">
                          {selectedMethod.bank_name}
                        </p>
                      </div>
                    )}

                    {selectedMethod.account_name && (
                      <div className="mt-3">
                        <p className="text-[10px] text-[#9D97B4]">
                          Atas Nama
                        </p>

                        <p className="mt-1 text-xs font-semibold text-[#5D5473]">
                          {selectedMethod.account_name}
                        </p>
                      </div>
                    )}

                    {selectedMethod.account_number && (
                      <div className="mt-3">
                        <p className="text-[10px] text-[#9D97B4]">
                          Nomor Rekening / Akun
                        </p>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="break-all text-sm font-bold tracking-wide text-[#5B21B6]">
                            {selectedMethod.account_number}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                selectedMethod.account_number!,
                                selectedMethod.id
                              )
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#6D28D9] transition hover:bg-[#F3EEFF]"
                            aria-label="Salin nomor rekening"
                          >
                            {copied === selectedMethod.id ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {getAbsoluteUrl(
                      selectedMethod.qr_image_path
                    ) && (
                      <div className="mt-4 border-t border-[#EEEAF7] pt-4">
                        <p className="mb-3 text-[10px] font-semibold text-[#5D5473]">
                          QR Pembayaran
                        </p>

                        <img
                          src={
                            getAbsoluteUrl(
                              selectedMethod.qr_image_path
                            )!
                          }
                          alt="QR pembayaran"
                          className="mx-auto max-h-52 rounded-xl border border-[#EEEAF7] bg-white p-2 object-contain"
                        />
                      </div>
                    )}

                    {selectedMethod.instructions && (
                      <div className="mt-4 border-t border-[#EEEAF7] pt-4">
                        <p className="text-[10px] font-bold text-[#5D5473]">
                          Instruksi Pembayaran
                        </p>

                        <p className="mt-2 whitespace-pre-line text-[10px] leading-6 text-[#817A97]">
                          {selectedMethod.instructions}
                        </p>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

            {/* PAYMENT STATUS */}

            {isPaid && (
              <div className="rounded-[20px] border border-emerald-200 bg-white p-6 shadow-sm">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={25} />
                </div>

                <h2 className="mt-4 text-base font-bold text-[#3E315D]">
                  Pembayaran Berhasil!
                </h2>

                <p className="mt-2 text-xs leading-6 text-[#817A97]">
                  Pembayaran telah disetujui. Akses kelas sudah diaktifkan untuk akunmu.
                </p>

                <Link
                  href="/dashboard"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
                >
                  Masuk ke Dashboard
                  <ArrowRight size={16} />
                </Link>

              </div>
            )}

            {isWaiting && !isPaid && (
              <div className="rounded-[20px] border border-amber-200 bg-white p-5 shadow-sm sm:p-6">

                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Loader2 size={24} className="animate-spin" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-[#3E315D]">
                        Pembayaran Menunggu Verifikasi
                      </h2>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold text-amber-800">
                        Dalam pemeriksaan
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-6 text-[#817A97]">
                      Bukti pembayaran berhasil dikirim. Admin Kiki Creator Class akan memeriksa pembayaran dan mencocokkan nominal dengan invoice. Akses kelas akan aktif setelah pembayaran disetujui.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-[#EEEAF7] bg-[#FAF9FF] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9B95AB]">
                      Invoice Pembayaran
                    </p>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800">
                      Menunggu verifikasi
                    </span>
                  </div>

                  <p className="mt-2 break-all text-sm font-bold text-[#5B21B6]">
                    {order.invoice_number}
                  </p>

                  <div className="mt-4 space-y-3 border-t border-[#EEEAF7] pt-4">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[#9B95AB]">Nama kelas</span>
                      <span className="max-w-[65%] text-right font-semibold text-[#5D5473]">
                        {initialCourse.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#9B95AB]">Subtotal</span>
                      <span className="font-semibold text-[#5D5473]">
                        {formatMoney(subtotal, order.currency)}
                      </span>
                    </div>

                    {discount > 0 && (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[#9B95AB]">
                          Diskon{order.promo_code ? ` (${order.promo_code})` : ""}
                        </span>
                        <span className="font-semibold text-[#6D28D9]">
                          -{formatMoney(discount, order.currency)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#EEEAF7] pt-3">
                      <span className="text-xs font-bold text-[#5D5473]">
                        Total dibayarkan
                      </span>
                      <span className="text-base font-bold text-[#5B21B6]">
                        {formatMoney(total, order.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#9B95AB]">Metode pembayaran</span>
                      <span className="font-semibold text-[#5D5473]">
                        {selectedMethod?.name || "Tercatat pada pembayaran"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">
                  Kamu tidak perlu mengirim pembayaran ulang. Simpan nomor invoice ini dan tunggu proses verifikasi admin.
                </div>

                <a
                  href={adminWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-3 text-xs font-bold text-white shadow-[0_4px_12px_rgba(22,163,74,0.14)] transition hover:bg-[#15803D] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:ring-offset-2"
                >
                  <MessageCircle size={17} />
                  Konfirmasi Admin via WhatsApp
                  <ArrowRight size={15} />
                </a>

                <p className="mt-2 text-center text-[9px] leading-5 text-[#9D97B4]">
                  WhatsApp akan terbuka dengan pesan konfirmasi dan detail invoice yang sudah disiapkan. Periksa pesan, lalu tekan Kirim.
                </p>

              </div>
            )}

            {/* REJECTION NOTICE */}

            {isRejected && !isWaiting && !isPaid && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">

                <p className="text-xs font-bold text-rose-700">
                  Pembayaran sebelumnya ditolak
                </p>

                <p className="mt-2 text-[11px] leading-6 text-rose-700">
                  {initialPayment?.rejection_reason ||
                    "Silakan periksa kembali pembayaran dan kirim bukti yang benar."}
                </p>

                <p className="mt-2 text-[10px] leading-5 text-rose-600">
                  Kamu dapat melakukan pembayaran kembali menggunakan metode yang tersedia.
                </p>

              </div>
            )}

            {/* ERROR MESSAGE */}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-700"
              >
                {error}
              </div>
            )}

            {/* SUCCESS MESSAGE */}

            {message && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-700"
              >
                {message}
              </div>
            )}

            {/* SUBMIT BUTTON */}

            {!isPaid && !isWaiting && (
              <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-5 shadow-[0_3px_16px_rgba(25,65,52,0.035)]">

                <div className="flex items-start gap-2 text-[10px] leading-5 text-[#9B95AB]">
                  <ShieldCheck
                    size={15}
                    className="mt-0.5 shrink-0 text-[#6D28D9]"
                  />

                  <p>
                    Pastikan nominal dan metode pembayaran sudah benar sebelum mengirim bukti pembayaran.
                  </p>
                </div>

                <div className="mt-4 border-t border-[#F8F6FD] pt-4">

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#9B95AB]">
                      Total Pembayaran
                    </span>

                    <span className="text-base font-bold text-[#5B21B6]">
                      {formatMoney(total, order.currency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={submitPayment}
                    disabled={
                      submitting ||
                      !selectedMethod ||
                      !proofFile ||
                      initialPaymentMethods.length === 0
                    }
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5B21B6] px-4 text-sm font-bold text-white shadow-[0_4px_12px_rgba(91,33,182,0.13)] transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Mengirim Pembayaran...
                      </>
                    ) : (
                      <>
                        Kirim Bukti Pembayaran
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[9px] leading-5 text-[#9D97B4]">
                    Pembayaran akan diperiksa oleh Admin sebelum akses kelas diberikan.
                  </p>

                </div>

              </div>
            )}

          </aside>

        </div>

        {/* FOOTER */}

        <footer className="mt-9 border-t border-[#EEEAF7] pt-5">
          <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
            <p className="text-xs font-bold text-[#5B21B6]">
              Kiki Creator Class
            </p>

            <p className="text-[10px] text-[#9D97B4]">
              © {new Date().getFullYear()} Kiki Creator Class. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </main>
  );
}
