"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FileUp,
  Loader2,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export type MentorReviewItem = {
  id: string;
  task_id: string;
  user_id: string;
  answer_text: string | null;
  answer_url: string | null;
  file_path: string | null;
  attempt_count: number;
  status: "submitted" | "revision_requested" | "reviewed";
  score: number | null;
  mentor_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  task_title: string;
  task_description: string | null;
  task_instructions: string;
  submission_type: string;
  reference_url: string | null;
  due_at: string | null;
  max_score: number;
  course_id: string;
  course_title: string;
  course_slug: string;
  student_name: string;
  student_avatar_url: string | null;
  certificate_enabled?: boolean;
  passing_score?: number | null;
  is_final_task?: boolean;
};

type ReviewFilter = "all" | "submitted" | "revision_requested" | "reviewed";
type ReviewDecision = "reviewed" | "revision_requested";

const filterOptions: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "submitted", label: "Menunggu diperiksa" },
  { value: "revision_requested", label: "Menunggu revisi" },
  { value: "reviewed", label: "Selesai dinilai" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: MentorReviewItem["status"]) {
  if (status === "reviewed") return "Selesai dinilai";
  if (status === "revision_requested") return "Menunggu revisi peserta";
  return "Menunggu pemeriksaan";
}

function statusClass(status: MentorReviewItem["status"]) {
  if (status === "reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "revision_requested") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function fileName(path: string) {
  const lastPart = path.split("/").pop() || "File pengumpulan";
  return lastPart.replace(/^\d+-/, "");
}

function formatErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts: string[] = [];

    if (typeof value.message === "string" && value.message.trim()) {
      parts.push(value.message.trim());
    }

    if (typeof value.details === "string" && value.details.trim()) {
      parts.push(`Detail: ${value.details.trim()}`);
    }

    if (typeof value.hint === "string" && value.hint.trim()) {
      parts.push(`Petunjuk: ${value.hint.trim()}`);
    }

    if (typeof value.code === "string" && value.code.trim()) {
      parts.push(`Kode: ${value.code.trim()}`);
    }

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Terjadi kesalahan yang tidak dapat dibaca.";
    }
  }

  return "Terjadi kesalahan yang tidak diketahui.";
}

export default function MentorTaskReview({
  mentorName,
  items: initialItems,
  hasAssignments,
  initialError,
  workspaceLabel = "Mentor",
  reviewRpcName = "review_course_task_submission",
  accessDescription = "Akses hanya untuk kelas yang ditugaskan Admin",
}: {
  mentorName: string;
  items: MentorReviewItem[];
  hasAssignments: boolean;
  initialError: string | null;
  workspaceLabel?: string;
  reviewRpcName?: string;
  accessDescription?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? "");
  const [detailOpen, setDetailOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [search, setSearch] = useState("");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [signedFileUrl, setSignedFileUrl] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState("");
  const [editingReviewedId, setEditingReviewedId] = useState<string | null>(null);

  // Portal mencegah dialog terpotong atau tertutup stacking context layout.
  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!detailOpen || !portalReady) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !openingFile) {
        setDetailOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailOpen, portalReady, saving, openingFile]);

  useEffect(() => {
    setItems(initialItems);
    setSelectedId((current) =>
      initialItems.some((item) => item.id === current)
        ? current
        : initialItems[0]?.id ?? ""
    );
  }, [initialItems]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "all" || item.status === filter;
      const matchesSearch =
        !query ||
        item.student_name.toLowerCase().includes(query) ||
        item.task_title.toLowerCase().includes(query) ||
        item.course_title.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  const pendingCount = items.filter((item) => item.status === "submitted").length;
  const revisionCount = items.filter((item) => item.status === "revision_requested").length;
  const reviewedCount = items.filter((item) => item.status === "reviewed").length;

  useEffect(() => {
    if (!selectedItem) {
      setScore("");
      setFeedback("");
      setSignedFileUrl("");
      return;
    }

    setScore(selectedItem.score === null ? "" : String(selectedItem.score));
    setFeedback(selectedItem.mentor_feedback ?? "");
    setSignedFileUrl("");
    setEditingReviewedId(null);
    setError("");
    setSuccess("");
  }, [selectedId, selectedItem?.id]);

  async function prepareFileLink() {
    if (!selectedItem?.file_path) return;
    setOpeningFile(true);
    setError("");
    setSignedFileUrl("");

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("course-submissions")
        .createSignedUrl(selectedItem.file_path, 15 * 60);

      if (signedUrlError || !data?.signedUrl) {
        throw signedUrlError ?? new Error("Tautan file tidak berhasil dibuat.");
      }

      setSignedFileUrl(data.signedUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "File belum dapat dibuka. Periksa kebijakan Storage."
      );
    } finally {
      setOpeningFile(false);
    }
  }

  async function submitReview(decision: ReviewDecision) {
    if (!selectedItem) return;

    const normalizedFeedback = feedback.trim();
    const normalizedScore = score.trim() === "" ? null : Number(score);

    if (decision === "reviewed") {
      if (normalizedScore === null || !Number.isFinite(normalizedScore)) {
        setError("Masukkan nilai akhir sebelum menyimpan penilaian.");
        return;
      }
      if (normalizedScore < 0 || normalizedScore > selectedItem.max_score) {
        setError(`Nilai harus antara 0 sampai ${selectedItem.max_score}.`);
        return;
      }
    }

    if (decision === "revision_requested" && !normalizedFeedback) {
      setError("Masukkan catatan perbaikan sebelum meminta revisi.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: rpcError } = await (supabase as any).rpc(
        reviewRpcName,
        {
          p_submission_id: selectedItem.id,
          p_score: normalizedScore,
          p_feedback: normalizedFeedback || null,
          p_status: decision,
        }
      );

      if (rpcError) throw rpcError;

      const reviewedAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                score: normalizedScore,
                mentor_feedback: normalizedFeedback || null,
                status: decision,
                reviewed_at: reviewedAt,
              }
            : item
        )
      );

      setEditingReviewedId(null);
      setSuccess(
        decision === "reviewed"
          ? "Penilaian berhasil disimpan dan dapat dilihat peserta."
          : "Permintaan revisi berhasil dikirim kepada peserta."
      );
      router.refresh();
    } catch (err) {
      console.error("Gagal menyimpan pemeriksaan tugas:", err);
      setError(
        `Gagal menyimpan pemeriksaan tugas: ${formatErrorMessage(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  function selectItem(item: MentorReviewItem) {
    setSelectedId(item.id);
    setDetailOpen(true);
    setError("");
    setSuccess("");
  }

  useEffect(() => {
    if (!detailOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setDetailOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen, saving]);

  const selectedAnswerUrl = safeExternalUrl(selectedItem?.answer_url ?? null);
  const selectedReferenceUrl = safeExternalUrl(selectedItem?.reference_url ?? null);

  return (
    <div className="app-page space-y-6">
      <div className="space-y-6">
        <section className="app-page-heading">
          <div>
            <p className="app-eyebrow">Student submissions</p>
            
            <p className="app-page-description">{workspaceLabel === "Admin" ? "Periksa pengumpulan peserta dari seluruh kelas, berikan nilai, atau kirim catatan revisi." : "Periksa karya peserta dari kelas yang ditugaskan, berikan nilai, atau kirim catatan revisi secara langsung."}</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_22px_rgba(38,27,72,.055)]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-violet-600">Masuk sebagai {workspaceLabel}</p>
            <p className="mt-1 text-xs font-extrabold text-slate-800">{mentorName}</p>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {!hasAssignments ? (
          <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <BookOpen size={25} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              {workspaceLabel === "Admin" ? "Belum ada kelas atau tugas untuk diperiksa" : "Belum ada kelas yang ditugaskan"}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {workspaceLabel === "Admin"
                ? "Buat dan publikasikan tugas terlebih dahulu. Pengumpulan peserta akan muncul di halaman ini."
                : "Akun ini belum terhubung dengan kelas sebagai mentor. Minta Admin menetapkan akun ini melalui menu Manajemen Tugas pada kelas terkait."}
            </p>
          </section>
        ) : (
          <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Kotak masuk</p>
                  <h2 className="mt-1 text-base font-extrabold text-slate-900">Pengumpulan tugas peserta</h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {pendingCount} menunggu pemeriksaan · {revisionCount} menunggu revisi · {reviewedCount} selesai dinilai
                  </p>
                </div>
                <span className="w-fit rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{filteredItems.length} pengumpulan</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-violet-400 focus-within:bg-white">
                  <Search size={15} className="text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari peserta, tugas, atau kelas..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={`rounded-full px-3 py-2 text-[10px] font-bold transition ${
                        filter === option.value
                          ? "bg-[#6D28D9] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <ClipboardCheck size={28} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {items.length === 0 ? "Belum ada karya yang masuk" : "Tidak ada hasil yang cocok"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {items.length === 0
                      ? "Pengumpulan peserta akan tampil di sini setelah mereka mengirim tugas."
                      : "Coba ubah filter atau kata pencarian."}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className="flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-violet-50/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={item.student_name} url={item.student_avatar_url} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-xs font-extrabold text-slate-900">{item.student_name}</p>
                          <span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                          {item.is_final_task && <span className="rounded-full bg-violet-100 px-2 py-1 text-[8px] font-extrabold text-violet-700">TUGAS AKHIR</span>}
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-700">{item.task_title}</p>
                        <p className="mt-1 truncate text-[10px] text-slate-500">{item.course_title} · {formatDate(item.submitted_at)} · Percobaan ke-{item.attempt_count}</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center justify-center gap-1.5 self-end rounded-xl border border-violet-200 bg-white px-3 py-2 text-[10px] font-bold text-violet-800 sm:self-auto">
                      Lihat detail <ArrowUpRight size={13} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {detailOpen && selectedItem && portalReady && createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              background: "rgba(15, 23, 42, 0.58)",
              backdropFilter: "blur(9px)",
              WebkitBackdropFilter: "blur(9px)",
              isolation: "isolate",
            }}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving && !openingFile) setDetailOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-review-dialog-title"
              className="flex w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
              style={{
                width: "min(920px, calc(100vw - 32px))",
                maxHeight: "calc(100dvh - 40px)",
                minHeight: 0,
                background: "#ffffff",
                borderRadius: "24px",
                boxShadow: "0 28px 90px rgba(2, 6, 23, 0.32)",
              }}
            >
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Detail pengumpulan</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 id="task-review-dialog-title" className="break-words text-base font-extrabold text-slate-900 sm:text-lg">{selectedItem.task_title}</h2>
                    {selectedItem.is_final_task && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-extrabold text-violet-700">TUGAS AKHIR</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{selectedItem.course_title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`hidden rounded-full border px-3 py-1.5 text-[10px] font-bold sm:inline-flex ${statusClass(selectedItem.status)}`}>{statusLabel(selectedItem.status)}</span>
                  <button type="button" onClick={() => setDetailOpen(false)} disabled={saving || openingFile} aria-label="Tutup detail pengumpulan" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={16} /></button>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <Avatar name={selectedItem.student_name} url={selectedItem.student_avatar_url} large />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Peserta</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{selectedItem.student_name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Dikirim {formatDate(selectedItem.submitted_at)} · Percobaan ke-{selectedItem.attempt_count}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Nilai maksimal</p>
                    <p className="text-base font-black text-violet-800">{selectedItem.max_score}</p>
                  </div>
                </div>

                {selectedItem.task_description && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deskripsi tugas</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedItem.task_description}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-violet-700" />
                    <h3 className="text-sm font-extrabold text-slate-900">Hasil karya peserta</h3>
                  </div>
                  {selectedItem.answer_text && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Jawaban teks</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selectedItem.answer_text}</p>
                    </div>
                  )}
                  {selectedItem.answer_url && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tautan karya</p>
                      {selectedAnswerUrl ? (
                        <a href={selectedAnswerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-violet-800 underline underline-offset-4">
                          Buka tautan karya <ExternalLink size={13} />
                        </a>
                      ) : (
                        <p className="mt-2 break-all text-xs text-rose-600">Tautan tidak valid atau tidak didukung.</p>
                      )}
                    </div>
                  )}
                  {selectedItem.file_path && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">File yang dikumpulkan</p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-700">{fileName(selectedItem.file_path)}</p>
                      {signedFileUrl ? (
                        <a href={signedFileUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-800">
                          <FileUp size={14} /> Buka file pengumpulan <ArrowUpRight size={13} />
                        </a>
                      ) : (
                        <button type="button" onClick={prepareFileLink} disabled={openingFile} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60">
                          {openingFile ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                          {openingFile ? "Menyiapkan file..." : "Buka file pengumpulan"}
                        </button>
                      )}
                    </div>
                  )}
                  {!selectedItem.answer_text && !selectedItem.answer_url && !selectedItem.file_path && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Data karya tidak ditemukan pada pengumpulan ini. Periksa kembali data tugas peserta.</p>
                  )}
                </div>

                {selectedReferenceUrl && (
                  <a href={selectedReferenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-violet-800 underline underline-offset-4">
                    Buka tautan referensi tugas <ExternalLink size={13} />
                  </a>
                )}

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquareText size={16} className="text-violet-700" />
                    <h3 className="text-sm font-extrabold text-slate-900">Pemeriksaan {workspaceLabel.toLowerCase()}</h3>
                  </div>
                  {selectedItem.status === "submitted" || editingReviewedId === selectedItem.id ? (
                    <>
                      <label className="mt-4 block">
                        <span className="text-xs font-bold text-slate-700">Nilai akhir <span className="font-medium text-slate-400">(0–{selectedItem.max_score})</span></span>
                        {selectedItem.certificate_enabled && selectedItem.passing_score !== null && selectedItem.passing_score !== undefined && (
                          <span className="mt-1 block text-[10px] font-medium text-violet-700">Standar kelulusan sertifikat kelas: {selectedItem.passing_score}% dari nilai maksimal.</span>
                        )}
                        <input type="number" min="0" max={selectedItem.max_score} step="0.01" value={score} onChange={(event) => setScore(event.target.value)} placeholder={`Masukkan nilai, maksimal ${selectedItem.max_score}`} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <label className="mt-4 block">
                        <span className="text-xs font-bold text-slate-700">Feedback dan catatan {workspaceLabel.toLowerCase()}</span>
                        <textarea rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Berikan apresiasi, koreksi, dan saran perbaikan yang jelas..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                      </label>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => submitReview("revision_requested")} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Minta Revisi
                        </button>
                        <button type="button" onClick={() => submitReview("reviewed")} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-60">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Simpan Penilaian
                        </button>
                      </div>
                      <p className="mt-3 text-[10px] leading-5 text-slate-400">Penilaian akan langsung tersimpan dan dapat dilihat peserta pada halaman tugasnya. Permintaan revisi akan membuka kembali formulir pengumpulan peserta.</p>
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-700">{selectedItem.status === "reviewed" ? "Penilaian tersimpan" : "Revisi sedang ditunggu"}</p>
                        {selectedItem.status === "reviewed" && selectedItem.score !== null && (
                          <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-black text-emerald-800">{selectedItem.score} / {selectedItem.max_score}</span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedItem.mentor_feedback || "Belum ada catatan pemeriksa."}</p>
                      {selectedItem.reviewed_at && <p className="mt-3 text-[10px] text-slate-400">Terakhir diperiksa: {formatDate(selectedItem.reviewed_at)}</p>}
                      {selectedItem.status === "reviewed" && selectedItem.certificate_enabled && selectedItem.passing_score !== null && selectedItem.passing_score !== undefined && selectedItem.score !== null && (
                        <p className={`mt-3 text-[10px] font-bold ${(Number(selectedItem.score) / selectedItem.max_score) * 100 >= selectedItem.passing_score ? "text-emerald-700" : "text-amber-700"}`}>
                          {(Number(selectedItem.score) / selectedItem.max_score) * 100 >= selectedItem.passing_score
                            ? `Memenuhi standar sertifikat (${((Number(selectedItem.score) / selectedItem.max_score) * 100).toFixed(1)}% ≥ ${selectedItem.passing_score}%).`
                            : `Belum memenuhi standar sertifikat (${((Number(selectedItem.score) / selectedItem.max_score) * 100).toFixed(1)}% < ${selectedItem.passing_score}%). Pemeriksa dapat mengubah penilaian atau meminta revisi.`}
                        </p>
                      )}
                      {selectedItem.status === "reviewed" && (
                        <button type="button" onClick={() => setEditingReviewedId(selectedItem.id)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-violet-50 px-3 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100">
                          <RefreshCw size={12} /> Ubah penilaian / minta revisi
                        </button>
                      )}
                      {selectedItem.status === "revision_requested" && (
                        <p className="mt-3 text-[10px] leading-5 text-amber-700">Formulir pemeriksaan akan aktif kembali setelah peserta mengirim revisi.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {error && <div className="shrink-0 border-t border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700 sm:px-6">{error}</div>}
              {success && <div className="shrink-0 border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 sm:px-6">{success}</div>}
            </section>
          </div>,
          document.body
        )}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} /> {accessDescription}
          </span>
          <span>Kiki Creator Class · {workspaceLabel} Workspace</span>
        </footer>
      </div>
    </div>
  );
}

function Avatar({
  name,
  url,
  large = false,
}: {
  name: string;
  url: string | null;
  large?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "P";

  const size = large ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Foto ${name}`}
      className={`${size} shrink-0 rounded-xl object-cover`}
    />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-violet-100 font-extrabold text-violet-800`}>
      {initials || <UserRound size={15} />}
    </div>
  );
}
