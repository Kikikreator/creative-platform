"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileImage,
  FileText,
  Loader2,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export type CheckoutPaymentMethod = {
  id: string;
  name: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qr_image_path: string | null;
  instructions: string | null;
};

export type CheckoutLatestPayment = {
  id: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
} | null;

type CheckoutFormProps = {
  orderId: string;
  invoiceNumber: string;
  orderStatus: string;
  amount: number | string;
  currency: string;
  paymentMethods: CheckoutPaymentMethod[];
  latestPayment: CheckoutLatestPayment;
  courseSlug: string | null;
  initialError: string | null;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

function formatMoney(value: number | string, currency = "IDR") {
  const amount = Number(value) || 0;
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "IDR";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getHttpUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default function CheckoutForm({
  orderId,
  invoiceNumber,
  orderStatus,
  amount,
  currency,
  paymentMethods,
  latestPayment,
  courseSlug,
  initialError,
}: CheckoutFormProps) {
  const router = useRouter();

  const [selectedMethodId, setSelectedMethodId] = useState(
    paymentMethods[0]?.id ?? ""
  );

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedMethod = useMemo(
    () =>
      paymentMethods.find(
        (method) => method.id === selectedMethodId
      ) ?? null,
    [paymentMethods, selectedMethodId]
  );

  // ==========================================
  // FILE VALIDATION
  // ==========================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const nextFile = event.target.files?.[0] ?? null;

    setError(null);
    setSuccess(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      setFile(null);
      event.target.value = "";

      setError(
        "Format file harus JPG, PNG, WEBP, atau PDF."
      );

      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      event.target.value = "";

      setError("Ukuran file maksimal 5 MB.");

      return;
    }

    setFile(nextFile);
  }

  // ==========================================
  // SUBMIT PAYMENT
  // ==========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setSuccess(null);

    if (!selectedMethodId) {
      setError(
        "Pilih metode pembayaran terlebih dahulu."
      );
      return;
    }

    if (!file) {
      setError(
        "Unggah bukti transfer terlebih dahulu."
      );
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format file tidak didukung.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // CEK USER
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );
      }

      // NAMA FILE AMAN
      const extensionFromName = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase() ?? ""
        : "";

      const safeExtension =
        extensionFromName.replace(/[^a-z0-9]/g, "") || "file";

      const safeBaseName =
        file.name
          .replace(/\.[^.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 60) || "bukti-transfer";

      // STRUKTUR STORAGE:
      // user_id/order_id/nama-file
      // Sesuai validasi RPC submit_course_payment.

      const proofPath =
        `${user.id}/${orderId}/${Date.now()}-${safeBaseName}.${safeExtension}`;

      // ========================================
      // UPLOAD STORAGE
      // ========================================

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(proofPath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Bukti pembayaran gagal diunggah: ${uploadError.message}`
        );
      }

      // ========================================
      // SUBMIT PAYMENT RPC
      // ========================================

      const { error: submitError } = await supabase.rpc(
        "submit_course_payment",
        {
          p_order_id: orderId,
          p_payment_method_id: selectedMethodId,
          p_proof_path: proofPath,
        }
      );

      if (submitError) {
        throw new Error(
          `File sudah masuk ke penyimpanan, tetapi konfirmasi pembayaran belum berhasil: ${submitError.message}. Muat ulang halaman sebelum mencoba kembali.`
        );
      }

      // ========================================
      // SUCCESS
      // ========================================

      setFile(null);

      setSuccess(
        `Bukti pembayaran untuk invoice ${invoiceNumber} berhasil dikirim. Pembayaran sedang menunggu verifikasi admin.`
      );

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Terjadi kesalahan saat mengirim pembayaran. Silakan coba kembali."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // STATUS: PAID
  // ==========================================

  if (orderStatus === "paid") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-[0_4px_18px_rgba(25,65,52,0.025)] sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={25} />
        </div>

        <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
          PEMBAYARAN LUNAS
        </span>

        <h2 className="mt-3 text-lg font-extrabold text-[#251A3D]">
          Pesanan berhasil!
        </h2>

        <p className="mt-2 text-xs leading-6 text-[#817A97]">
          Pesanan ini telah berstatus lunas. Akses kelas akan tersedia melalui akunmu.
        </p>

        <Link
          href={
            courseSlug
              ? `/kelas/${encodeURIComponent(courseSlug)}`
              : "/kelas"
          }
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
        >
          Buka Kelas
          <BookOpen size={16} />
        </Link>
      </section>
    );
  }

  // ==========================================
  // STATUS: WAITING VERIFICATION
  // ==========================================

  if (orderStatus === "waiting_verification") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-[0_4px_18px_rgba(25,65,52,0.025)] sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <Clock3 size={24} />
        </div>

        <span className="mt-4 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">
          MENUNGGU VERIFIKASI
        </span>

        <h2 className="mt-3 text-lg font-extrabold text-[#251A3D]">
          Bukti pembayaran diterima
        </h2>

        <p className="mt-2 text-xs leading-6 text-[#817A97]">
          Admin sedang memeriksa pembayaranmu. Kamu tidak perlu mengirim bukti lagi untuk invoice ini.
        </p>

        {latestPayment?.created_at && (
          <p className="mt-4 rounded-xl bg-[#F8F7FC] p-3 text-[10px] text-[#817A97]">
            Dikirim pada {formatDate(latestPayment.created_at)}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#EEEAF7] bg-white px-4 text-xs font-semibold text-[#5D5473] transition hover:bg-[#FBFAFF]"
        >
          Perbarui Status
        </button>
      </section>
    );
  }

  // ==========================================
  // UNKNOWN STATUS
  // ==========================================

  if (
    orderStatus !== "pending_payment" &&
    orderStatus !== "rejected"
  ) {
    return (
      <section className="rounded-2xl border border-[#EEEAF7] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F6FD] text-[#6D28D9]">
          <AlertCircle size={23} />
        </div>

        <h2 className="mt-4 text-base font-bold text-[#3E315D]">
          Status pesanan belum dapat diproses
        </h2>

        <p className="mt-2 text-xs leading-6 text-[#817A97]">
          Status invoice saat ini: {orderStatus}.
        </p>

        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-5 h-11 w-full rounded-xl bg-[#6D28D9] px-4 text-xs font-bold text-white hover:bg-[#5B21B6]"
        >
          Perbarui Status
        </button>
      </section>
    );
  }

  // ==========================================
  // PAYMENT FORM
  // ==========================================

  return (
    <section className="rounded-2xl border border-[#EEEAF7] bg-white p-5 shadow-[0_4px_18px_rgba(25,65,52,0.025)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
          <LockKeyhole size={18} />
        </span>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">
            PEMBAYARAN
          </p>

          <h2 className="mt-1 text-sm font-bold text-[#3E315D]">
            Pilih Metode Pembayaran
          </h2>
        </div>
      </div>

      {/* PREVIOUS REJECTION */}
      {orderStatus === "rejected" &&
        latestPayment?.rejection_reason && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
              Pembayaran sebelumnya ditolak
            </p>

            <p className="mt-2 text-xs leading-5 text-rose-700">
              {latestPayment.rejection_reason}
            </p>

            <p className="mt-2 text-[10px] leading-5 text-rose-600">
              Silakan perbaiki pembayaran dan kirim bukti yang baru.
            </p>
          </div>
        )}

      {/* SERVER ERROR */}
      {initialError && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
          Sebagian informasi pembayaran tidak berhasil dimuat: {initialError}
        </div>
      )}

      {/* EMPTY PAYMENT METHODS */}
      {paymentMethods.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#EEEAF7] px-4 py-8 text-center">
          <AlertCircle
            className="mx-auto text-[#9D97B4]"
            size={22}
          />

          <p className="mt-3 text-xs font-semibold text-[#716687]">
            Belum ada metode pembayaran aktif
          </p>

          <p className="mt-1 text-[10px] leading-5 text-[#9D97B4]">
            Silakan hubungi administrator atau coba kembali nanti.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-5"
        >
          {/* PAYMENT METHOD OPTIONS */}
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const active = selectedMethodId === method.id;

              return (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                    active
                      ? "border-[#8B5CF6] bg-[#F8F6FD] ring-2 ring-[#8B5CF6]/10"
                      : "border-[#F1EDF8] bg-white hover:border-[#D0BCFF] hover:bg-[#FFFFFF]"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={active}
                    onChange={() => {
                      setSelectedMethodId(method.id);
                      setError(null);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#6D28D9]"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#5D5473]">
                      {method.name}
                    </span>

                    {method.bank_name && (
                      <span className="mt-1 block text-[10px] text-[#81958D]">
                        {method.bank_name}
                      </span>
                    )}
                  </span>

                  {active && (
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-[#6D28D9]"
                    />
                  )}
                </label>
              );
            })}
          </div>

          {/* SELECTED METHOD DETAILS */}
          {selectedMethod && (
            <div className="rounded-xl border border-[#F1EDF8] bg-[#FAF9FF] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B5CF6]">
                INFORMASI TRANSFER
              </p>

              {selectedMethod.bank_name && (
                <p className="mt-3 text-xs text-[#817A97]">
                  Bank / Penyedia:{" "}
                  <strong className="text-[#5D5473]">
                    {selectedMethod.bank_name}
                  </strong>
                </p>
              )}

              {selectedMethod.account_name && (
                <p className="mt-2 text-xs text-[#817A97]">
                  Atas nama:{" "}
                  <strong className="text-[#5D5473]">
                    {selectedMethod.account_name}
                  </strong>
                </p>
              )}

              {selectedMethod.account_number && (
                <p className="mt-2 break-all text-xs text-[#817A97]">
                  Nomor rekening:{" "}
                  <strong className="font-bold text-[#3E315D]">
                    {selectedMethod.account_number}
                  </strong>
                </p>
              )}

              {selectedMethod.instructions && (
                <p className="mt-3 whitespace-pre-line border-t border-[#F1EDF8] pt-3 text-[11px] leading-5 text-[#817A97]">
                  {selectedMethod.instructions}
                </p>
              )}

              {getHttpUrl(selectedMethod.qr_image_path) && (
                <div className="mt-4 border-t border-[#F1EDF8] pt-4">
                  <p className="mb-2 text-[10px] font-semibold text-[#716687]">
                    QR Pembayaran
                  </p>

                  <img
                    src={
                      getHttpUrl(selectedMethod.qr_image_path) ??
                      undefined
                    }
                    alt={`QR pembayaran ${selectedMethod.name}`}
                    className="mx-auto max-h-56 w-auto max-w-full rounded-xl border border-[#F1EDF8] bg-white p-2 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* FILE UPLOAD */}
          <div>
            <label
              htmlFor="payment-proof"
              className="mb-2 block text-xs font-bold text-[#5D5473]"
            >
              Bukti transfer
            </label>

            <label
              htmlFor="payment-proof"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D8C7FF] bg-[#FFFFFF] px-4 py-6 text-center transition hover:border-[#8B5CF6] hover:bg-[#F8F6FD]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
                {file?.type === "application/pdf" ? (
                  <FileText size={21} />
                ) : (
                  <FileImage size={21} />
                )}
              </span>

              <span className="mt-3 break-all text-xs font-semibold text-[#5D5473]">
                {file
                  ? file.name
                  : "Pilih file bukti pembayaran"}
              </span>

              <span className="mt-1 text-[10px] text-[#9D97B4]">
                JPG, PNG, WEBP, atau PDF · Maksimal 5 MB
              </span>

              <span className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-white px-3 text-[10px] font-bold text-[#6D28D9] shadow-sm">
                <UploadCloud size={14} />
                Pilih File
              </span>

              <input
                id="payment-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700"
            >
              <AlertCircle
                size={15}
                className="mt-0.5 shrink-0"
              />
              <span>{error}</span>
            </div>
          )}

          {/* SUCCESS */}
          {success && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-700"
            >
              <CheckCircle2
                size={15}
                className="mt-0.5 shrink-0"
              />
              <span>{success}</span>
            </div>
          )}

          {/* PAYMENT REMINDER */}
          <div className="rounded-xl bg-[#F8F7FC] p-3 text-[10px] leading-5 text-[#81958D]">
            Pastikan nominal transfer sesuai total invoice sebesar{" "}
            <strong className="text-[#5D5473]">
              {formatMoney(amount, currency)}
            </strong>
            . Jangan mengirim bukti yang sama untuk invoice berbeda.
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={
              loading ||
              !selectedMethodId ||
              !file ||
              paymentMethods.length === 0
            }
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-sm font-bold text-white shadow-[0_4px_12px_rgba(109,40,217,0.15)] transition hover:bg-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Mengirim bukti...
              </>
            ) : (
              <>
                Kirim Bukti Pembayaran
                <UploadCloud size={17} />
              </>
            )}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-[10px] leading-5 text-[#9D97B4]">
        Pembayaran diproses dengan aman melalui Kiki Creator Class.
      </p>
    </section>
  );
}