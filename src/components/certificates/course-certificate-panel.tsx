"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Award,
  CheckCircle2,
  Download,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Send,
  Star,
  X,
} from "lucide-react";

type CertificateStatus = {
  enabled: boolean;
  total_lessons: number;
  completed_lessons: number;
  lessons_complete: boolean;
  chapter_tasks_total: number;
  chapter_tasks_passed: number;
  chapter_tasks_complete: boolean;
  final_task_id: string | null;
  final_task_title: string | null;
  final_task_required: boolean;
  final_task_passed: boolean;
  passing_score: number;
  eligible_for_mentor_review: boolean;
  mentor_approval_status:
    | "not_requested"
    | "pending"
    | "approved"
    | "revision_requested";
  mentor_feedback: string | null;
  review_submitted: boolean;
  can_request_approval: boolean;
  can_submit_review: boolean;
  can_download: boolean;
  template_ready: boolean;
  certificate: null | {
    id: string;
    certificate_number: string;
    issued_at: string;
    full_name: string;
    course_title: string;
  };
};


const REVIEW_TOPIC_PATTERN =
  /\b(?:kelas|kursus|materi|mentor|tugas|belajar|pembelajaran|penjelasan|praktik|latihan|video|modul|desain|aplikasi|instruktur|pelatihan|pengalaman|proyek|project|kemampuan|keterampilan|pemahaman|metode|tutorial|bimbingan|contoh|pembahasan|platform|software|ilmu|fitur|editing|grafis|animasi|fotografi|konten|bisnis|marketing|keuangan|pemrograman|coding|website|hasil|proses|waktu|akses|peserta|coreldraw|photoshop|illustrator|canva|figma|premiere|capcut|excel|powerpoint|akuntansi|pemasaran)\b/i;

function getReviewValidationMessage(rawText: string): string {
  const text = rawText.trim().replace(/\s+/g, " ");

  if (!text) return "Tuliskan pengalamanmu mengikuti kelas.";
  if (text.length < 80) {
    return `Ulasan minimal 80 karakter. Saat ini ${text.length} karakter.`;
  }

  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 12) {
    return `Ulasan minimal 12 kata. Saat ini ${words.length} kata.`;
  }

  const uniqueWords = new Set(words.map((word) => word.toLocaleLowerCase("id-ID")));
  if (uniqueWords.size < 8) {
    return "Ulasan terlalu banyak mengulang kata. Gunakan kalimat sendiri untuk menceritakan pengalaman belajar.";
  }

  if (!/[.!?]$/.test(text)) {
    return "Akhiri ulasan dengan tanda titik, tanda tanya, atau tanda seru agar menjadi kalimat utuh.";
  }

  if (/[.!?]\s+[\p{L}\p{N}]/u.test(text)) {
    return "Tuliskan ulasan dalam satu kalimat utuh, bukan beberapa kalimat terpisah.";
  }

  if (!REVIEW_TOPIC_PATTERN.test(text)) {
    return "Ulasan harus membahas pengalaman mengikuti kelas, misalnya materi, tugas, praktik, mentor, atau kemampuan yang diperoleh.";
  }

  return "";
}

const primaryButtonClass =
  "inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:bg-[#EAE7EF] disabled:text-[#A49BAA] disabled:shadow-none md:w-auto";

export default function CourseCertificatePanel({
  courseId,
  refreshKey = 0,
}: {
  courseId: string;
  refreshKey?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await (supabase as any).rpc(
      "get_member_course_certificate_status",
      { p_course_id: courseId }
    );

    if (loadError) {
      setError(loadError.message);
      setStatus(null);
      setLoading(false);
      return;
    }

    const { data: templateSetting, error: templateError } = await (supabase as any)
      .from("course_certificate_settings")
      .select("template_path")
      .eq("course_id", courseId)
      .maybeSingle();

    if (templateError) setError(templateError.message);

    const nextStatus = data as CertificateStatus;
    const templateReady = Boolean(templateSetting?.template_path);

    setStatus({
      ...nextStatus,
      template_ready: templateReady,
      can_submit_review: Boolean(nextStatus.can_submit_review && templateReady),
    });
    setLoading(false);
  }, [courseId, supabase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  async function requestMentorApproval() {
    setBusy(true);
    setError("");
    setNotice("");

    const { error: actionError } = await (supabase as any).rpc(
      "request_course_completion_approval",
      { p_course_id: courseId }
    );

    if (actionError) {
      setError(actionError.message);
    } else {
      setNotice("Permintaan persetujuan kelulusan berhasil dikirim kepada Mentor.");
      await loadStatus();
    }

    setBusy(false);
  }

  async function submitReview() {
    const validationMessage = getReviewValidationMessage(reviewText);

    if (rating < 1) {
      setError("Pilih rating antara 1 sampai 5 bintang.");
      return;
    }

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    const { error: actionError } = await (supabase as any).rpc(
      "submit_course_feedback_and_issue_certificate",
      {
        p_course_id: courseId,
        p_rating: rating,
        p_review_text: reviewText.trim(),
      }
    );

    if (actionError) {
      setError(actionError.message);
    } else {
      setNotice("Terima kasih! Ulasan diterima dan sertifikatmu berhasil diterbitkan.");
      setShowReviewForm(false);
      setRating(0);
      setReviewText("");
      await loadStatus();
    }

    setBusy(false);
  }

  const certificateIssued = Boolean(
    status?.can_download && status.certificate
  );
  const canOpenCertificateStep = Boolean(
    status?.mentor_approval_status === "approved" &&
      status.can_submit_review
  );
  const canRequestApproval = Boolean(status?.can_request_approval);
  const approvalPending = status?.mentor_approval_status === "pending";
  const revisionRequested =
    status?.mentor_approval_status === "revision_requested";
  const mentorApproved = status?.mentor_approval_status === "approved";
  const reviewValidationMessage = getReviewValidationMessage(reviewText);

  let buttonLabel = "Dapatkan Sertifikat";
  let buttonDisabled = true;
  let buttonAction: (() => void) | undefined;

  if (loading) {
    buttonLabel = "Memeriksa...";
  } else if (!status || !status.enabled) {
    buttonLabel = "Dapatkan Sertifikat";
  } else if (certificateIssued) {
    buttonLabel = "Unduh Sertifikat";
  } else if (canRequestApproval) {
    buttonLabel = revisionRequested
      ? "Ajukan Ulang Persetujuan Mentor"
      : "Ajukan Persetujuan Mentor";
    buttonDisabled = busy;
    buttonAction = () => void requestMentorApproval();
  } else if (approvalPending) {
    buttonLabel = "Menunggu Persetujuan Mentor";
  } else if (canOpenCertificateStep) {
    buttonLabel = "Dapatkan Sertifikat";
    buttonDisabled = false;
    buttonAction = () => {
      setError("");
      setShowReviewForm(true);
    };
  } else if (mentorApproved && !status.template_ready) {
    buttonLabel = "Menyiapkan Sertifikat";
  }

  return (
    <section
      aria-labelledby="course-certificate-title"
      className="rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_2px_10px_rgba(38,0,71,.025)] sm:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0 text-[#260047]">
            <Award size={23} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <h2
              id="course-certificate-title"
              className="text-base font-extrabold text-[#260047] sm:text-lg"
            >
              Sertifikat Peserta Kelas
            </h2>

            <p className="mt-2 max-w-3xl text-xs leading-6 text-[#746D7B]">
              Sertifikat dapat diperoleh setelah peserta menyelesaikan seluruh
              materi utama dan tugas yang diwajibkan, dinyatakan lulus pada
              Tugas Akhir, serta mendapatkan persetujuan kelulusan dari Mentor.
            </p>

            {loading && (
              <p className="mt-2 flex items-center gap-2 text-[10px] text-[#938BA5]">
                <RefreshCw size={12} className="animate-spin" />
                Memeriksa status penyelesaian kelas...
              </p>
            )}

            {!loading && status && !status.enabled && (
              <p className="mt-2 flex items-center gap-2 text-[10px] leading-5 text-[#938BA5]">
                <LockKeyhole size={12} className="shrink-0" />
                Fitur sertifikat untuk kelas ini belum diaktifkan oleh Admin.
              </p>
            )}

            {!loading && status?.enabled && approvalPending && (
              <p className="mt-2 text-[10px] leading-5 text-amber-700">
                Permintaan persetujuan sudah dikirim. Sertifikat dapat
                diperoleh setelah Mentor menyetujui kelulusan.
              </p>
            )}

            {!loading && status?.enabled && revisionRequested && (
              <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-800">
                <p className="font-bold">Catatan Mentor:</p>
                <p>
                  {status.mentor_feedback ||
                    "Mentor meminta perbaikan sebelum menyetujui kelulusan."}
                </p>
              </div>
            )}

            {!loading &&
              status?.enabled &&
              mentorApproved &&
              !status.template_ready && (
                <p className="mt-2 text-[10px] leading-5 text-[#746D7B]">
                  Kelulusan telah disetujui Mentor. Admin sedang menyiapkan
                  desain sertifikat.
                </p>
              )}

            {!loading &&
              status?.enabled &&
              canRequestApproval && (
                <p className="mt-2 text-[10px] leading-5 text-[#746D7B]">
                  Persyaratan kelas telah terpenuhi. Silakan ajukan persetujuan
                  kelulusan kepada Mentor.
                </p>
              )}
          </div>
        </div>

        {certificateIssued && status?.certificate ? (
          <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:items-end">
            <a
              href={`/api/certificates/${status.certificate.id}/pdf`}
              className={primaryButtonClass}
            >
              <Download size={15} />
              Unduh Sertifikat
            </a>
            <Link
              href={`/sertifikat/verifikasi/${encodeURIComponent(
                status.certificate.certificate_number
              )}`}
              className="text-center text-[10px] font-semibold text-[#746D7B] underline underline-offset-2 hover:text-[#260047]"
            >
              Verifikasi Sertifikat
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={buttonAction}
            disabled={buttonDisabled}
            className={primaryButtonClass}
          >
            {busy ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : canRequestApproval ? (
              <Send size={14} />
            ) : (
              <Award size={15} />
            )}
            {busy ? "Memproses..." : buttonLabel}
          </button>
        )}
      </div>

      {!loading && canOpenCertificateStep && showReviewForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setShowReviewForm(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-review-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareText size={19} className="text-[#260047]" />
                  <h3
                    id="certificate-review-title"
                    className="text-base font-extrabold text-[#260047]"
                  >
                    Rating dan Ulasan Kelas
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#746D7B]">
                  Kelulusanmu telah disetujui Mentor. Isi rating dan ulasan
                  berdasarkan pengalaman belajarmu untuk menerbitkan sertifikat.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup formulir ulasan"
                disabled={busy}
                onClick={() => setShowReviewForm(false)}
                className="rounded-lg p-2 text-[#746D7B] transition hover:bg-[#F5F2F8] disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-[#F8F6FC] p-3">
              <p className="text-xs font-bold text-[#302647]">
                Ketentuan ulasan
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-[#746D7B]">
                <li>Minimal 80 karakter dan 12 kata.</li>
                <li>Ditulis dalam satu kalimat utuh.</li>
                <li>Menggambarkan pengalaman mengikuti kelas.</li>
                <li>Hindari pengulangan kata atau ulasan singkat seperti “bagus”.</li>
              </ul>
              <p className="mt-2 text-[11px] leading-5 text-[#746D7B]">
                Berikan rating sesuai pengalaman sebenarnya. Rating rendah
                tetap diterima dan tidak menghalangi penerbitan sertifikat.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2" aria-label="Pilih rating">
              <span className="mr-1 text-xs font-bold text-[#51476B]">
                Rating
              </span>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} bintang`}
                  className="rounded-lg p-1 transition hover:bg-[#F8F6FC]"
                >
                  <Star
                    size={27}
                    className={
                      value <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-[#C8BED8]"
                    }
                  />
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs font-bold text-[#51476B]">
              Ceritakan pengalaman belajarmu
              <textarea
                value={reviewText}
                onChange={(event) => {
                  setReviewText(event.target.value);
                  setError("");
                }}
                rows={5}
                maxLength={3000}
                className="mt-2 w-full rounded-xl border border-[#E7DFF4] bg-white px-3 py-3 text-xs leading-5 text-[#28213D] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                placeholder="Ceritakan hal yang kamu pelajari, pengalaman mengerjakan tugas, manfaat materi, atau saran untuk kelas..."
              />
            </label>

            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-[#9A91AA]">
              <span>
                {reviewText.trim().split(/\s+/).filter(Boolean).length} kata
                · {reviewText.trim().length}/3000 karakter
              </span>
              <span>Minimal 12 kata dan 80 karakter</span>
            </div>

            {reviewText.trim().length > 0 && reviewValidationMessage && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                {reviewValidationMessage}
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowReviewForm(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E7DFF4] px-5 text-xs font-bold text-[#51476B] transition hover:bg-[#F8F6FC] disabled:opacity-40"
              >
                Nanti
              </button>
              <button
                type="button"
                onClick={() => void submitReview()}
                disabled={busy || rating === 0 || Boolean(reviewValidationMessage)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 text-xs font-extrabold text-white transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Award size={15} />
                )}
                Kirim Rating & Ulasan
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {notice}
        </div>
      )}
    </section>
  );
}
