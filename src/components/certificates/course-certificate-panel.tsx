"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Award, CheckCircle2, Circle, Download, LockKeyhole, MessageSquareText, RefreshCw, Send, ShieldCheck, Star } from "lucide-react";

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
  mentor_approval_status: "not_requested" | "pending" | "approved" | "revision_requested";
  mentor_feedback: string | null;
  review_submitted: boolean;
  can_request_approval: boolean;
  can_submit_review: boolean;
  can_download: boolean;
  template_ready: boolean;
  certificate: null | { id: string; certificate_number: string; issued_at: string; full_name: string; course_title: string };
};

export default function CourseCertificatePanel({ courseId, refreshKey = 0 }: { courseId: string; refreshKey?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await (supabase as any).rpc("get_member_course_certificate_status", { p_course_id: courseId });
    if (loadError) {
      setError(loadError.message);
    } else {
      const { data: templateSetting, error: templateError } = await (supabase as any)
        .from("course_certificate_settings")
        .select("template_path")
        .eq("course_id", courseId)
        .maybeSingle();
      if (templateError) setError(templateError.message);
      const templateReady = Boolean(templateSetting?.template_path);
      const nextStatus = data as CertificateStatus;
      setStatus({
        ...nextStatus,
        template_ready: templateReady,
        can_submit_review: Boolean(nextStatus.can_submit_review && templateReady),
      });
    }
    setLoading(false);
  }, [courseId, supabase]);

  useEffect(() => { void loadStatus(); }, [loadStatus, refreshKey]);

  async function requestMentorApproval() {
    setBusy(true); setError(""); setNotice("");
    const { error: actionError } = await (supabase as any).rpc("request_course_completion_approval", { p_course_id: courseId });
    if (actionError) setError(actionError.message);
    else { setNotice("Permintaan persetujuan kelulusan berhasil dikirim kepada Mentor."); await loadStatus(); }
    setBusy(false);
  }

  async function submitReview() {
    if (rating < 1 || reviewText.trim().length < 10) return;
    setBusy(true); setError(""); setNotice("");
    const { error: actionError } = await (supabase as any).rpc("submit_course_feedback_and_issue_certificate", {
      p_course_id: courseId,
      p_rating: rating,
      p_review_text: reviewText.trim(),
    });
    if (actionError) setError(actionError.message);
    else { setNotice("Terima kasih! Sertifikatmu berhasil diterbitkan."); await loadStatus(); }
    setBusy(false);
  }

  const requirements = status ? [
    { label: "Seluruh materi inti selesai", done: status.lessons_complete, detail: `${status.completed_lessons}/${status.total_lessons} materi` },
    { label: "Seluruh tugas Bab wajib lulus", done: status.chapter_tasks_complete, detail: `${status.chapter_tasks_passed}/${status.chapter_tasks_total} tugas` },
    { label: status.final_task_title ? `Tugas Akhir: ${status.final_task_title}` : "Tugas Akhir dipilih Admin", done: status.final_task_passed, detail: status.final_task_passed ? "Lulus" : "Belum lulus" },
    { label: "Persetujuan kelulusan Mentor", done: status.mentor_approval_status === "approved", detail: status.mentor_approval_status === "approved" ? "Disetujui" : status.mentor_approval_status === "pending" ? "Menunggu Mentor" : status.mentor_approval_status === "revision_requested" ? "Perlu perbaikan" : "Belum diajukan" },
    { label: "Rating dan ulasan kelas", done: status.review_submitted, detail: status.review_submitted ? "Terkirim" : "Belum diisi" },
  ] : [];

  return (
    <section className="overflow-hidden rounded-[26px] bg-white shadow-[0_12px_34px_rgba(47,30,82,.065)]">
      <div className="bg-gradient-to-r from-[#5423A8] via-[#6D28D9] to-[#8B5CF6] px-5 py-5 text-white sm:px-7">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><Award size={23}/></span><div><p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-violet-100">Final achievement</p><h2 className="mt-1 text-lg font-extrabold">Sertifikat Penyelesaian</h2></div></div>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-violet-100">Sertifikat baru diterbitkan setelah seluruh materi wajib selesai, semua tugas Bab dan Tugas Akhir dinyatakan lulus, Mentor menyetujui kelulusan, lalu kamu mengirim rating dan ulasan kelas. Nilai rating boleh jujur sesuai pengalamanmu.</p>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        {loading ? <div className="flex items-center gap-2 py-5 text-xs text-[#938BA5]"><RefreshCw size={15} className="animate-spin text-violet-700"/>Memeriksa persyaratan sertifikat...</div> : !status ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">Status sertifikat belum dapat dimuat. {error}</div> : !status.enabled ? <div className="rounded-2xl bg-[#F8F6FC] p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#44375F]"><LockKeyhole size={17}/> Sertifikat belum diaktifkan</div><p className="mt-2 text-xs leading-5 text-[#938BA5]">Admin belum mengaktifkan sertifikat untuk kelas ini. Kamu tetap dapat melanjutkan pembelajaran seperti biasa.</p></div> : status.can_download && status.certificate ? <div className="rounded-2xl bg-emerald-50 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-emerald-700"><CheckCircle2 size={13}/> Sertifikat diterbitkan</div><h3 className="mt-3 text-lg font-extrabold text-emerald-950">Selamat, kelas berhasil diselesaikan!</h3><p className="mt-1 text-xs text-emerald-800">Nomor sertifikat: {status.certificate.certificate_number}</p></div><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700"><Award size={30}/></span></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><a href={`/api/certificates/${status.certificate.id}/pdf`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)]"><Download size={15}/> Unduh Sertifikat PDF</a><Link href={`/sertifikat/verifikasi/${encodeURIComponent(status.certificate.certificate_number)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-xs font-bold text-emerald-800">Verifikasi Sertifikat</Link></div></div> : <>
          <div><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-[#302647]">Persyaratan kelulusan</h3><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-bold text-violet-700">Nilai minimum {status.passing_score}%</span></div><div className="mt-4 space-y-3">{requirements.map((item) => <div key={item.label} className="flex items-start gap-3 rounded-xl bg-[#FAF9FC] px-4 py-3"><span className={`mt-0.5 ${item.done ? "text-emerald-600" : "text-[#B6AEC5]"}`}>{item.done ? <CheckCircle2 size={17}/> : <Circle size={17}/>}</span><div className="min-w-0 flex-1"><p className={`text-xs font-bold ${item.done ? "text-[#3D3156]" : "text-[#766D89]"}`}>{item.label}</p><p className="mt-1 text-[10px] text-[#A49CB3]">{item.detail}</p></div></div>)}</div></div>
          {status.mentor_approval_status === "pending" && <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Permintaan kelulusan sudah dikirim. Tunggu Mentor memeriksa dan memberikan persetujuan akhir.</div>}
          {status.mentor_approval_status === "revision_requested" && <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800"><strong>Catatan Mentor:</strong> {status.mentor_feedback || "Mentor meminta perbaikan sebelum menyetujui kelulusan."}</div>}
          {status.mentor_approval_status === "approved" && status.eligible_for_mentor_review && !status.template_ready && <div className="rounded-xl bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-800"><strong>Kelulusan sudah disetujui.</strong> Admin sedang menyiapkan desain sertifikat untuk kelas ini. Formulir rating dan ulasan akan terbuka setelah template tersedia.</div>}
          {status.can_request_approval && <button type="button" onClick={() => void requestMentorApproval()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)] disabled:opacity-50"><Send size={15}/>{busy ? "Mengirim..." : status.mentor_approval_status === "revision_requested" ? "Ajukan ulang persetujuan Mentor" : "Ajukan persetujuan kelulusan"}</button>}
          {status.can_submit_review && <div className="rounded-2xl bg-violet-50/70 p-4 sm:p-5"><div className="flex items-center gap-2"><MessageSquareText size={17} className="text-violet-700"/><h3 className="text-sm font-extrabold text-[#302647]">Satu langkah lagi: rating dan ulasan</h3></div><p className="mt-2 text-xs leading-5 text-[#817991]">Kelulusanmu sudah disetujui Mentor. Berikan penilaian jujur tentang kelas ini untuk membuka sertifikat. Rating rendah tidak akan menghalangi sertifikat.</p><div className="mt-4 flex items-center gap-2" aria-label="Pilih rating"><span className="mr-1 text-[10px] font-bold text-[#655A7B]">Rating</span>{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} bintang`} className="rounded-lg p-1 transition hover:bg-white"><Star size={25} className={value <= rating ? "fill-amber-400 text-amber-400" : "text-[#C8BED8]"}/></button>)}</div><label className="mt-3 block text-xs font-bold text-[#51476B]">Ulasan kelas<textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={4} maxLength={3000} className="mt-2 w-full rounded-xl border border-[#E7DFF4] bg-white px-3 py-3 text-xs leading-5 text-[#28213D] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" placeholder="Ceritakan pengalaman belajar, hal yang bermanfaat, atau saran perbaikan..."/></label><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] text-[#9A91AA]">Minimal 10 karakter · {reviewText.trim().length}/3000</p><button type="button" onClick={() => void submitReview()} disabled={busy || rating === 0 || reviewText.trim().length < 10} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)] disabled:cursor-not-allowed disabled:opacity-40">{busy ? <RefreshCw size={14} className="animate-spin"/> : <Award size={15}/>} Kirim & buka sertifikat</button></div></div>}
        </>}
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
        {notice && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</div>}
        {status && status.enabled && !status.can_download && !status.can_request_approval && !status.can_submit_review && status.mentor_approval_status === "not_requested" && <p className="text-[10px] leading-5 text-[#A49CB3]">Selesaikan persyaratan di atas terlebih dahulu. Setelah lengkap, tombol pengajuan persetujuan akan muncul otomatis.</p>}
      </div>
    </section>
  );
}
