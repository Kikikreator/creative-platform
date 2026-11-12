"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  X,
  XCircle,
} from "lucide-react";

export type MentorCertificateCandidate = {
  course_id: string;
  course_title: string;
  course_slug: string;
  user_id: string;
  student_name: string;
  approval_status: string;
  mentor_feedback: string | null;
  requested_at: string;
  total_lessons: number;
  completed_lessons: number;
  chapter_tasks_total: number;
  chapter_tasks_passed: number;
  final_task_title: string | null;
  final_task_passed: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function candidateKey(item: MentorCertificateCandidate) {
  return `${item.course_id}:${item.user_id}`;
}

function statusText(status: string) {
  return status === "pending" ? "Menunggu pemeriksaan akhir" : "Menunggu pengajuan ulang";
}

export default function MentorCertificateManager({
  initialItems,
  initialError,
}: {
  initialItems: MentorCertificateCandidate[];
  initialError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  const selectedItem = items.find((item) => candidateKey(item) === selectedKey) ?? null;

  const reload = useCallback(async () => {
    const { data, error: loadError } = await (supabase as any).rpc("get_mentor_certificate_candidates");
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const nextItems = (data ?? []) as MentorCertificateCandidate[];
    setItems(nextItems);
    setSelectedKey((current) =>
      current && nextItems.some((item) => candidateKey(item) === current) ? current : null
    );
  }, [supabase]);

  async function decide(item: MentorCertificateCandidate, decision: "approved" | "revision_requested") {
    const key = candidateKey(item);
    const note = (feedback[key] ?? "").trim();
    const lessonsDone = item.completed_lessons >= item.total_lessons;
    const chapterDone = item.chapter_tasks_passed >= item.chapter_tasks_total;
    const allDone = lessonsDone && chapterDone && item.final_task_passed;

    if (decision === "approved" && !allDone) {
      setError("Kelulusan belum dapat disetujui karena masih ada persyaratan yang belum terpenuhi.");
      return;
    }
    if (decision === "revision_requested" && !note) {
      setError("Isi catatan perbaikan sebelum mengirim permintaan revisi.");
      return;
    }

    setBusyId(key);
    setError("");
    setNotice("");
    const { error: actionError } = await (supabase as any).rpc("mentor_review_course_completion", {
      p_course_id: item.course_id,
      p_user_id: item.user_id,
      p_decision: decision,
      p_feedback: note || null,
    });
    if (actionError) {
      setError(actionError.message);
    } else {
      setNotice(
        decision === "approved"
          ? `Kelulusan ${item.student_name} berhasil disetujui. Peserta dapat melanjutkan ke rating dan ulasan.`
          : `Permintaan perbaikan dikirim kepada ${item.student_name}.`
      );
      setFeedback((current) => ({ ...current, [key]: "" }));
      setSelectedKey(null);
      await reload();
    }
    setBusyId(null);
  }

  return (
    <main className="mx-auto w-full max-w-[1450px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700">
            <Award size={13} /> Certificate approval
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#211A37] sm:text-3xl">Persetujuan Kelulusan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#89829B]">
            Buka detail peserta untuk memeriksa progres, memberi catatan, lalu menyetujui atau meminta perbaikan.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-violet-700 shadow-[0_8px_24px_rgba(47,30,82,.06)]">
          <ShieldCheck size={16} /> Mentor Workspace
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700"><CircleAlert size={14} className="mr-2 inline" />{error}</div>}
      {notice && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700"><CheckCircle2 size={14} className="mr-2 inline" />{notice}</div>}

      <section className="overflow-hidden rounded-[24px] border border-[#F0ECF6] bg-white shadow-[0_8px_26px_rgba(47,30,82,.055)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0ECF6] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-extrabold text-[#302647]">Pengajuan kelulusan peserta</h2>
            <p className="mt-1 text-[10px] text-[#938BA5]">{items.length} pengajuan perlu ditinjau</p>
          </div>
          <button type="button" onClick={() => void reload()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-100 px-3 text-[10px] font-bold text-violet-700 hover:bg-violet-50">
            <RefreshCw size={13} /> Muat ulang
          </button>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardCheck size={25} /></span>
            <h2 className="mt-4 text-base font-extrabold text-[#302647]">Belum ada permintaan kelulusan</h2>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-[#938BA5]">Permintaan akan muncul setelah peserta menyelesaikan materi, lulus semua tugas wajib, dan mengajukan persetujuan akhir.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0ECF6]">
            {items.map((item) => {
              const lessonsDone = item.completed_lessons >= item.total_lessons;
              const chapterDone = item.chapter_tasks_passed >= item.chapter_tasks_total;
              const allDone = lessonsDone && chapterDone && item.final_task_passed;
              return (
                <button
                  key={candidateKey(item)}
                  type="button"
                  onClick={() => { setSelectedKey(candidateKey(item)); setError(""); setNotice(""); }}
                  className="flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-violet-50/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><UserRoundCheck size={18} /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-extrabold text-[#2B2340]">{item.student_name}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${item.approval_status === "pending" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{statusText(item.approval_status)}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#817991]">{item.course_title}</p>
                      <p className="mt-1 text-[10px] text-[#AAA3B5]">Diajukan {formatDate(item.requested_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="rounded-lg bg-[#F8F6FC] px-2.5 py-1.5 text-[9px] font-semibold text-[#756B88]">Materi {item.completed_lessons}/{item.total_lessons}</span>
                    <span className="rounded-lg bg-[#F8F6FC] px-2.5 py-1.5 text-[9px] font-semibold text-[#756B88]">Tugas Bab {item.chapter_tasks_passed}/{item.chapter_tasks_total}</span>
                    <span className={`rounded-lg px-2.5 py-1.5 text-[9px] font-bold ${allDone ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{allDone ? "Syarat lengkap" : "Perlu diperiksa"}</span>
                    <span className="inline-flex h-8 items-center rounded-lg border border-violet-100 px-3 text-[10px] font-bold text-violet-700">Lihat detail</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedItem && (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setSelectedKey(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="certificate-approval-dialog-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#F0ECF6] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-violet-700">Pemeriksaan kelulusan</p>
                <h2 id="certificate-approval-dialog-title" className="mt-1 truncate text-base font-extrabold text-[#2B2340]">{selectedItem.student_name}</h2>
                <p className="mt-1 truncate text-xs text-[#817991]">{selectedItem.course_title} · Diajukan {formatDate(selectedItem.requested_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`hidden rounded-full px-3 py-1.5 text-[9px] font-bold sm:inline-flex ${selectedItem.approval_status === "pending" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{statusText(selectedItem.approval_status)}</span>
                <button type="button" onClick={() => setSelectedKey(null)} disabled={Boolean(busyId)} aria-label="Tutup detail pengajuan" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={16} /></button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {(() => {
                const lessonsDone = selectedItem.completed_lessons >= selectedItem.total_lessons;
                const chapterDone = selectedItem.chapter_tasks_passed >= selectedItem.chapter_tasks_total;
                const finalDone = selectedItem.final_task_passed;
                const allDone = lessonsDone && chapterDone && finalDone;
                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#F8F6FC] p-4">
                        <div className="flex items-center gap-2 text-[#756B88]"><BookOpenCheck size={14} /><p className="text-[10px] font-semibold">Materi selesai</p></div>
                        <p className="mt-2 text-xl font-extrabold text-[#2B2340]">{selectedItem.completed_lessons}/{selectedItem.total_lessons}</p>
                        <p className={`mt-1 text-[10px] font-bold ${lessonsDone ? "text-emerald-700" : "text-amber-700"}`}>{lessonsDone ? "Terpenuhi" : "Belum lengkap"}</p>
                      </div>
                      <div className="rounded-2xl bg-[#F8F6FC] p-4">
                        <div className="flex items-center gap-2 text-[#756B88]"><ClipboardCheck size={14} /><p className="text-[10px] font-semibold">Tugas Bab lulus</p></div>
                        <p className="mt-2 text-xl font-extrabold text-[#2B2340]">{selectedItem.chapter_tasks_passed}/{selectedItem.chapter_tasks_total}</p>
                        <p className={`mt-1 text-[10px] font-bold ${chapterDone ? "text-emerald-700" : "text-amber-700"}`}>{chapterDone ? "Terpenuhi" : "Belum lengkap"}</p>
                      </div>
                      <div className="rounded-2xl bg-[#F8F6FC] p-4">
                        <div className="flex items-center gap-2 text-[#756B88]"><Award size={14} /><p className="text-[10px] font-semibold">Tugas Akhir</p></div>
                        <p className="mt-2 line-clamp-2 text-sm font-extrabold text-[#2B2340]">{selectedItem.final_task_title || "Belum ditetapkan"}</p>
                        <p className={`mt-1 text-[10px] font-bold ${finalDone ? "text-emerald-700" : "text-amber-700"}`}>{finalDone ? "Lulus" : "Belum lulus"}</p>
                      </div>
                    </div>

                    {!allDone && (
                      <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                        <CircleAlert size={14} className="mr-2 inline" /> Syarat belum terpenuhi. Sistem akan memvalidasi ulang sebelum persetujuan dapat disimpan.
                      </div>
                    )}
                    {selectedItem.mentor_feedback && (
                      <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800">
                        <strong>Catatan sebelumnya:</strong> {selectedItem.mentor_feedback}
                      </div>
                    )}

                    <label className="block">
                      <span className="text-xs font-bold text-[#51476B]">Catatan Mentor <span className="font-normal text-[#938BA5]">(opsional saat menyetujui, wajib saat meminta perbaikan)</span></span>
                      <textarea
                        rows={4}
                        value={feedback[candidateKey(selectedItem)] ?? ""}
                        onChange={(event) => setFeedback((current) => ({ ...current, [candidateKey(selectedItem)]: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-[#EAE5F5] bg-white px-3 py-3 text-xs leading-5 text-[#28213D] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        placeholder="Tuliskan catatan kelulusan atau hal yang perlu diperbaiki..."
                      />
                    </label>

                    <div className="flex flex-col-reverse gap-2 border-t border-[#F0ECF6] pt-4 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => void decide(selectedItem, "revision_requested")} disabled={busyId === candidateKey(selectedItem)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                        {busyId === candidateKey(selectedItem) ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />} Minta perbaikan
                      </button>
                      <button type="button" onClick={() => void decide(selectedItem, "approved")} disabled={busyId === candidateKey(selectedItem) || !allDone} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)] disabled:cursor-not-allowed disabled:opacity-40">
                        {busyId === candidateKey(selectedItem) ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Setujui kelulusan
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
