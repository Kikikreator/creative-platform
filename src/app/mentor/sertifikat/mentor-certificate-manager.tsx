"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Award, BookOpenCheck, CheckCircle2, CircleAlert, ClipboardCheck, RefreshCw, ShieldCheck, UserRoundCheck, XCircle } from "lucide-react";

export type MentorCertificateCandidate = {
  course_id: string; course_title: string; course_slug: string; user_id: string; student_name: string;
  approval_status: string; mentor_feedback: string | null; requested_at: string;
  total_lessons: number; completed_lessons: number; chapter_tasks_total: number; chapter_tasks_passed: number;
  final_task_title: string | null; final_task_passed: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MentorCertificateManager({ initialItems, initialError }: { initialItems: MentorCertificateCandidate[]; initialError: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const { data, error: loadError } = await (supabase as any).rpc("get_mentor_certificate_candidates");
    if (loadError) { setError(loadError.message); return; }
    setItems((data ?? []) as MentorCertificateCandidate[]);
  }, [supabase]);

  async function decide(item: MentorCertificateCandidate, decision: "approved" | "revision_requested") {
    const note = (feedback[item.user_id] ?? "").trim();
    if (decision === "revision_requested" && !note) {
      setError("Isi catatan perbaikan sebelum mengirim permintaan revisi."); return;
    }
    setBusyId(item.user_id); setError(""); setNotice("");
    const { error: actionError } = await (supabase as any).rpc("mentor_review_course_completion", {
      p_course_id: item.course_id,
      p_user_id: item.user_id,
      p_decision: decision,
      p_feedback: note || null,
    });
    if (actionError) setError(actionError.message);
    else {
      setNotice(decision === "approved" ? `Kelulusan ${item.student_name} berhasil disetujui.` : `Permintaan perbaikan dikirim kepada ${item.student_name}.`);
      setFeedback((current) => ({ ...current, [item.user_id]: "" }));
      await reload();
    }
    setBusyId(null);
  }

  return (
    <main className="mx-auto w-full max-w-[1450px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700"><Award size={13}/> Certificate approval</div><h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#211A37] sm:text-3xl">Persetujuan Kelulusan</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#89829B]">Periksa progres peserta dan berikan persetujuan akhir sebelum formulir rating dan ulasan dibuka.</p></div><div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-violet-700 shadow-[0_8px_24px_rgba(47,30,82,.06)]"><ShieldCheck size={16}/> Mentor Workspace</div></section>
      <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Menunggu persetujuan</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{items.filter((item) => item.approval_status === "pending").length}</p></div><div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Menunggu perbaikan peserta</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{items.filter((item) => item.approval_status === "revision_requested").length}</p></div><div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Total antrean</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{items.length}</p></div></section>
      {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700"><CircleAlert size={14} className="mr-2 inline"/>{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700"><CheckCircle2 size={14} className="mr-2 inline"/>{notice}</div>}
      <section className="space-y-4">
        {items.length === 0 ? <div className="rounded-[26px] bg-white px-6 py-14 text-center shadow-[0_8px_26px_rgba(47,30,82,.055)]"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardCheck size={25}/></span><h2 className="mt-4 text-base font-extrabold text-[#302647]">Belum ada permintaan kelulusan</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-[#938BA5]">Permintaan akan muncul setelah peserta menyelesaikan materi, lulus semua tugas wajib, dan mengajukan persetujuan akhir.</p><button type="button" onClick={() => void reload()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-50 px-4 text-xs font-bold text-violet-700"><RefreshCw size={14}/> Muat ulang</button></div> : items.map((item) => {
          const lessonsDone = item.completed_lessons >= item.total_lessons;
          const chapterDone = item.chapter_tasks_passed >= item.chapter_tasks_total;
          const finalDone = item.final_task_passed;
          const allDone = lessonsDone && chapterDone && finalDone;
          return <article key={`${item.course_id}-${item.user_id}`} className="rounded-[26px] bg-white p-5 shadow-[0_10px_30px_rgba(47,30,82,.06)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><UserRoundCheck size={20}/></span><div className="min-w-0"><h2 className="text-sm font-extrabold text-[#2B2340]">{item.student_name}</h2><p className="mt-1 text-xs text-[#817991]">{item.course_title}</p><p className="mt-1 text-[10px] text-[#AAA3B5]">Diajukan {formatDate(item.requested_at)}</p></div></div><span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold ${item.approval_status === "pending" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{item.approval_status === "pending" ? "Menunggu pemeriksaan akhir" : "Menunggu pengajuan ulang"}</span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#F8F6FC] p-4"><p className="text-[10px] text-[#938BA5]">Materi selesai</p><p className="mt-1 text-lg font-extrabold text-[#2B2340]">{item.completed_lessons}/{item.total_lessons}</p><p className={`mt-1 text-[10px] font-bold ${lessonsDone ? "text-emerald-700" : "text-amber-700"}`}>{lessonsDone ? "Terpenuhi" : "Belum lengkap"}</p></div><div className="rounded-2xl bg-[#F8F6FC] p-4"><p className="text-[10px] text-[#938BA5]">Tugas Bab lulus</p><p className="mt-1 text-lg font-extrabold text-[#2B2340]">{item.chapter_tasks_passed}/{item.chapter_tasks_total}</p><p className={`mt-1 text-[10px] font-bold ${chapterDone ? "text-emerald-700" : "text-amber-700"}`}>{chapterDone ? "Terpenuhi" : "Belum lengkap"}</p></div><div className="rounded-2xl bg-[#F8F6FC] p-4"><p className="text-[10px] text-[#938BA5]">Tugas Akhir</p><p className="mt-1 line-clamp-1 text-sm font-extrabold text-[#2B2340]">{item.final_task_title || "Belum dipilih Admin"}</p><p className={`mt-1 text-[10px] font-bold ${finalDone ? "text-emerald-700" : "text-amber-700"}`}>{finalDone ? "Lulus" : "Belum lulus"}</p></div></div>
            {!allDone && <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800"><CircleAlert size={14} className="mr-2 inline"/>Syarat belum terpenuhi. Persetujuan akhir akan divalidasi kembali oleh sistem.</div>}
            {item.mentor_feedback && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800"><strong>Catatan sebelumnya:</strong> {item.mentor_feedback}</div>}
            <div className="mt-5 border-t border-[#F0ECF6] pt-4"><label className="block text-xs font-bold text-[#51476B]">Catatan Mentor (opsional saat menyetujui, wajib saat meminta perbaikan)<textarea rows={2} value={feedback[item.user_id] ?? ""} onChange={(event) => setFeedback((current) => ({ ...current, [item.user_id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#EAE5F5] bg-white px-3 py-3 text-xs leading-5 text-[#28213D] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" placeholder="Berikan catatan kelulusan atau hal yang perlu diperbaiki..."/></label><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => void decide(item, "revision_requested")} disabled={busyId === item.user_id} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"><XCircle size={14}/> Minta perbaikan</button><button type="button" onClick={() => void decide(item, "approved")} disabled={busyId === item.user_id || !allDone} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)] disabled:cursor-not-allowed disabled:opacity-40">{busyId === item.user_id ? <RefreshCw size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Setujui kelulusan</button></div></div>
          </article>;
        })}
      </section>
    </main>
  );
}
