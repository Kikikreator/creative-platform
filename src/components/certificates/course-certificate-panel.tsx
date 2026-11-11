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
    if (rating < 1 || reviewText.trim().length < 10) return;

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
      setNotice("Terima kasih! Sertifikatmu berhasil diterbitkan.");
      setShowReviewForm(false);
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
    buttonAction = () => setShowReviewForm((current) => !current);
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
        <div className="mt-5 border-t border-[#EEEAF2] pt-5">
          <div className="flex items-center gap-2">
            <MessageSquareText size={17} className="text-[#260047]" />
            <h3 className="text-sm font-extrabold text-[#302647]">
              Satu langkah lagi: rating dan ulasan
            </h3>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#817991]">
            Kelulusanmu sudah disetujui Mentor. Berikan penilaian jujur tentang
            kelas ini untuk menerbitkan sertifikat. Rating rendah tidak akan
            menghalangi penerbitan sertifikat.
          </p>

          <div className="mt-4 flex items-center gap-2" aria-label="Pilih rating">
            <span className="mr-1 text-[10px] font-bold text-[#655A7B]">
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
                  size={25}
                  className={
                    value <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-[#C8BED8]"
                  }
                />
              </button>
            ))}
          </div>

          <label className="mt-3 block text-xs font-bold text-[#51476B]">
            Ulasan kelas
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              rows={4}
              maxLength={3000}
              className="mt-2 w-full rounded-xl border border-[#E7DFF4] bg-white px-3 py-3 text-xs leading-5 text-[#28213D] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              placeholder="Ceritakan pengalaman belajar, hal yang bermanfaat, atau saran perbaikan..."
            />
          </label>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-[#9A91AA]">
              Minimal 10 karakter · {reviewText.trim().length}/3000
            </p>
            <button
              type="button"
              onClick={() => void submitReview()}
              disabled={
                busy || rating === 0 || reviewText.trim().length < 10
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 text-xs font-extrabold text-white transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Award size={15} />
              )}
              Kirim & buka sertifikat
            </button>
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
