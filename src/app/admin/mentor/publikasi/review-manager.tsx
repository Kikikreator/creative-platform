"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Link2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  Video,
  Layers3,
  BookOpen,
  Music,
} from "lucide-react";

type JsonRecord = Record<string, unknown>;
export type ChapterSnapshot = {
  section: JsonRecord;
  lessons: Array<JsonRecord & { contents?: JsonRecord[] }>;
};

export type AdminChapterSubmission = {
  id: string;
  draft_id: string | null;
  mentor_user_id: string;
  course_id: string;
  section_id: string;
  title: string;
  action: "create" | "update" | "delete";
  status: string;
  payload: ChapterSnapshot;
  base_snapshot: ChapterSnapshot | null;
  mentor_note: string | null;
  admin_note: string | null;
  submitted_at: string;
  mentor_name: string;
  course_title: string;
  preview_urls: Record<string, string>;
};

function textValue(source: JsonRecord | null | undefined, key: string) {
  const value = source?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(source: JsonRecord | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}
function lessonKind(source: JsonRecord | null | undefined) {
  const provider = textValue(source, "video_provider").toLowerCase();
  if (["text", "link", "pdf", "info"].includes(provider)) return provider;
  return "video";
}

function lessonKindLabel(source: JsonRecord | null | undefined) {
  const kind = lessonKind(source);
  const labels: Record<string, string> = {
    video: "Video Pembelajaran",
    text: "Materi Teks",
    link: "Link Eksternal",
    pdf: "Dokumen PDF",
    info: "Informasi",
  };
  return labels[kind] ?? "Materi Pembelajaran";
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function actionLabel(action: AdminChapterSubmission["action"]) {
  if (action === "create") return "Bab baru";
  if (action === "update") return "Perubahan Bab";
  return "Penghapusan Bab";
}

function fileLabel(type: string) {
  if (type === "image") return "Buka gambar";
  if (type === "pdf") return "Buka PDF / dokumen";
  if (type === "audio") return "Putar / buka audio";
  return "Buka file";
}

function ResourceLink({ path, urls, label }: { path: string; urls: Record<string, string>; label?: string }) {
  const url = urls[path];
  if (!url) return <p className="break-all text-[9px] text-slate-400">File: {path} (tautan pratinjau tidak tersedia)</p>;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-700 hover:underline"><FileText size={12} />{label ?? "Buka file"}</a>;
}

function MiniContentPreview({ item, urls }: { item: JsonRecord; urls: Record<string, string> }) {
  const title = textValue(item, "title") || "Mini Materi";
  const type = textValue(item, "content_type");
  const body = textValue(item, "body");
  const mediaUrl = textValue(item, "media_url");
  const linkUrl = textValue(item, "link_url");
  const resourcePath = textValue(item, "resource_path");
  const resourceUrl = resourcePath ? urls[resourcePath] : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          {type === "tiktok" || type === "youtube" ? <Video size={15} /> : type === "image" ? <ImageIcon size={15} /> : type === "audio" ? <Music size={15} /> : type === "link" ? <Link2 size={15} /> : <FileText size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold text-slate-800">{title}</p>
          <p className="mt-0.5 text-[9px] capitalize text-slate-400">{type || "Konten"}</p>
        </div>
      </div>
      {body && <div className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-700">{body}</div>}
      {mediaUrl && <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-[10px] font-bold text-violet-700 hover:underline"><PlayCircle size={12} />Buka media / video</a>}
      {resourcePath && type === "image" && resourceUrl && <a href={resourceUrl} target="_blank" rel="noreferrer" className="mt-2 block"><img src={resourceUrl} alt={title} className="max-h-56 max-w-full rounded-lg border border-slate-100 object-contain" /></a>}
      {resourcePath && !(type === "image" && resourceUrl) && <div className="mt-2"><ResourceLink path={resourcePath} urls={urls} label={fileLabel(type)} /></div>}
      {linkUrl && <a href={linkUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-[10px] font-bold text-violet-700 hover:underline"><Link2 size={12} />{textValue(item, "link_label") || "Buka tautan"}</a>}
      {!body && !mediaUrl && !resourcePath && !linkUrl && <p className="mt-2 text-[9px] italic text-slate-400">Mini Materi ini tidak memiliki isi tambahan.</p>}
    </div>
  );
}

function ChapterPreview({
  snapshot,
  urls,
  label,
}: {
  snapshot: ChapterSnapshot | null;
  urls: Record<string, string>;
  label: string;
}) {
  const [studentMode, setStudentMode] = useState(false);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  if (!snapshot?.section) return <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-[10px] text-slate-400">Snapshot Bab tidak tersedia.</div>;
  const section = snapshot.section;
  const lessons = Array.isArray(snapshot.lessons) ? snapshot.lessons : [];
  const safeLessonIndex = Math.min(selectedLessonIndex, Math.max(0, lessons.length - 1));
  const activeLesson = lessons[safeLessonIndex] ?? lessons[0] ?? null;
  const title = textValue(section, "title") || "Bab";
  const description = textValue(section, "description");
  const miniCount = lessons.reduce((sum, lesson) => sum + (Array.isArray(lesson.contents) ? lesson.contents.length : 0), 0);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-slate-700"><Layers3 size={11} />{label}</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-bold text-violet-800">{lessons.length} Materi Inti · {miniCount} Mini Materi</span>
        </div>
        <button type="button" onClick={() => setStudentMode((current) => !current)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-bold text-emerald-800 hover:bg-emerald-100">{studentMode ? "Kembali ke Review Admin" : "Lihat sebagai Peserta"}</button>
      </div>
      <h5 className="mt-3 text-sm font-extrabold text-slate-900">{title}</h5>
      <p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{description || "Tidak ada deskripsi Bab."}</p>

      {lessons.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] text-slate-400">Bab belum memiliki Materi Inti.</p>
      ) : studentMode ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <div className="rounded-xl bg-[#260047] p-3 text-white"><p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-white/60">Mode Peserta</p><p className="mt-1 text-[10px] font-bold">Pilih materi untuk dibaca</p></div>
            {lessons.map((lesson, index) => (
              <button key={textValue(lesson, "id") || index} type="button" onClick={() => setSelectedLessonIndex(index)} className={`w-full rounded-xl border p-3 text-left ${safeLessonIndex === index ? "border-[#260047] bg-white" : "border-slate-200 bg-white/70 hover:bg-white"}`}>
                <span className="text-[9px] font-bold text-slate-400">Materi {index + 1}</span>
                <span className="mt-1 block text-[10px] font-extrabold text-slate-800">{textValue(lesson, "title") || `Materi ${index + 1}`}</span>
                <span className="mt-1 block text-[9px] text-slate-400">{Array.isArray(lesson.contents) ? lesson.contents.length : 0} Mini Materi</span>
              </button>
            ))}
          </aside>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {activeLesson && <>
              <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-emerald-700">{title} · Materi {safeLessonIndex + 1}</p>
              <h6 className="mt-2 text-base font-extrabold text-slate-900">{textValue(activeLesson, "title") || "Materi Inti"}</h6>
              <p className="mt-1 text-[9px] font-bold text-violet-700">{lessonKindLabel(activeLesson)}</p>
              {textValue(activeLesson, "content") && lessonKind(activeLesson) !== "info" && <p className="mt-2 whitespace-pre-wrap text-[10px] leading-6 text-slate-600">{textValue(activeLesson, "content")}</p>}
              {lessonKind(activeLesson) === "info" && <div className="mt-3 whitespace-pre-wrap rounded-xl border border-sky-100 bg-sky-50 p-3 text-[10px] leading-6 text-sky-950">{textValue(activeLesson, "content")}</div>}
              {lessonKind(activeLesson) === "video" && textValue(activeLesson, "video_url") && <a href={textValue(activeLesson, "video_url")} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-700 hover:underline"><PlayCircle size={12} />Buka video Materi Inti</a>}
              {lessonKind(activeLesson) === "link" && textValue(activeLesson, "video_url") && <a href={textValue(activeLesson, "video_url")} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-700 hover:underline"><Link2 size={12} />Buka tautan eksternal</a>}
              {lessonKind(activeLesson) === "pdf" && textValue(activeLesson, "resource_path") && <div className="mt-2"><ResourceLink path={textValue(activeLesson, "resource_path")} urls={urls} label="Buka dokumen PDF" /></div>}
              {lessonKind(activeLesson) === "video" && textValue(activeLesson, "resource_path") && <div className="mt-2"><ResourceLink path={textValue(activeLesson, "resource_path")} urls={urls} label="Buka file video Materi Inti" /></div>}
              <div className="mt-4 space-y-2">
                {(Array.isArray(activeLesson.contents) ? activeLesson.contents : []).map((content, contentIndex) => <MiniContentPreview key={textValue(content, "id") || contentIndex} item={content} urls={urls} />)}
                {(!Array.isArray(activeLesson.contents) || activeLesson.contents.length === 0) && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-[10px] text-slate-400">Belum ada Mini Materi.</p>}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setSelectedLessonIndex((current) => Math.max(0, current - 1))} disabled={safeLessonIndex <= 0} className="h-9 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600 disabled:opacity-40">Sebelumnya</button>
                <span className="text-[9px] text-slate-400">{safeLessonIndex + 1} dari {lessons.length}</span>
                <button type="button" onClick={() => setSelectedLessonIndex((current) => Math.min(lessons.length - 1, current + 1))} disabled={safeLessonIndex >= lessons.length - 1} className="h-9 rounded-lg bg-[#260047] px-3 text-[9px] font-bold text-white disabled:opacity-40">Selanjutnya</button>
              </div>
            </>}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {lessons.map((lesson, index) => {
            const lessonTitle = textValue(lesson, "title") || `Materi ${index + 1}`;
            const contentList = Array.isArray(lesson.contents) ? lesson.contents : [];
            const lessonVideo = textValue(lesson, "video_url");
            const lessonResource = textValue(lesson, "resource_path");
            return (
              <section key={textValue(lesson, "id") || index} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><BookOpen size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-slate-400">Materi Inti {index + 1}</p>
                    <h6 className="mt-0.5 text-[11px] font-extrabold text-slate-900">{lessonTitle}</h6>
                    <p className="mt-1 text-[9px] font-bold text-violet-700">{lessonKindLabel(lesson)}</p>
                    {textValue(lesson, "content") && <p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{textValue(lesson, "content")}</p>}
                    <p className="mt-1 text-[9px] text-slate-400">{lessonKind(lesson) === "video" && numberValue(lesson, "duration_minutes") > 0 ? `${numberValue(lesson, "duration_minutes")} menit` : lessonKindLabel(lesson)} · {contentList.length} Mini Materi</p>
                    {lessonKind(lesson) === "video" && lessonVideo && <a href={lessonVideo} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-[10px] font-bold text-violet-700 hover:underline"><PlayCircle size={12} />Buka video Materi Inti</a>}
                    {lessonKind(lesson) === "link" && lessonVideo && <a href={lessonVideo} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-[10px] font-bold text-violet-700 hover:underline"><Link2 size={12} />Buka tautan eksternal</a>}
                    {lessonResource && lessonKind(lesson) === "pdf" && <div className="mt-2"><ResourceLink path={lessonResource} urls={urls} label="Buka dokumen PDF" /></div>}
                    {lessonResource && lessonKind(lesson) === "video" && <div className="mt-2"><ResourceLink path={lessonResource} urls={urls} label="Buka file video Materi Inti" /></div>}
                  </div>
                </div>
                {contentList.length > 0 && <div className="mt-3 space-y-2 border-l-2 border-violet-100 pl-3">{contentList.map((content, contentIndex) => <MiniContentPreview key={textValue(content, "id") || contentIndex} item={content} urls={urls} />)}</div>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MentorPublicationReview({
  items,
  initialError,
}: {
  items: AdminChapterSubmission[];
  initialError: string | null;
}) {
  const [rows, setRows] = useState(items);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function review(item: AdminChapterSubmission, decision: "approved" | "revision_requested") {
    const note = notes[item.id]?.trim() ?? "";
    if (decision === "revision_requested" && !note) {
      setError("Tuliskan catatan perbaikan sebelum meminta revisi.");
      return;
    }
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("review_mentor_chapter_submission", {
        p_submission_id: item.id,
        p_decision: decision,
        p_note: note || null,
      });
      if (rpcError) throw rpcError;
      setRows((current) => current.filter((row) => row.id !== item.id));
      if (decision === "revision_requested") {
        setNotice(`Catatan revisi untuk Bab "${item.title}" berhasil dikirim. Materi resmi tidak berubah.`);
      } else if (item.action === "delete") {
        setNotice(`Penghapusan Bab "${item.title}" beserta seluruh isinya berhasil disetujui.`);
      } else {
        setNotice(`Seluruh Bab "${item.title}" berhasil diterapkan ke kurikulum resmi. Admin tetap dapat mengedit seluruh isinya melalui Manajemen Materi.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pengajuan Bab.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#24365B] p-5 text-white shadow-sm sm:p-7">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Quality control · Chapter review</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Review Pengajuan Bab Mentor</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Admin memeriksa satu Bab secara utuh, termasuk semua Materi Inti dan Mini Materi. Persetujuan menerapkan seluruh snapshot sekaligus; materi resmi tetap berada di bawah kendali Admin.</p>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} />{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200 bg-white p-4"><p className="text-[10px] text-slate-500">Bab menunggu review</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[20px] border border-slate-200 bg-white p-4"><p className="text-[10px] text-slate-500">Isi yang diperiksa</p><p className="mt-1 text-sm font-extrabold text-slate-900">Bab + seluruh materi</p></div>
        <div className="rounded-[20px] border border-slate-200 bg-white p-4"><p className="text-[10px] text-slate-500">Kendali materi utama</p><p className="mt-1 text-sm font-extrabold text-emerald-700">Tetap di Admin</p></div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><FileCheck2 size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Antrian pengajuan Bab</h3></div>
            <p className="mt-1 text-[10px] text-slate-500">Baca seluruh isi Bab sebelum menyetujui atau meminta revisi.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-bold text-amber-700"><Clock3 size={11} className="mr-1 inline" />{rows.length} menunggu</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={32} /><h3 className="mt-3 text-sm font-bold text-slate-800">Tidak ada pengajuan Bab tertunda</h3><p className="mt-1 text-xs text-slate-500">Pengajuan dari Mentor akan muncul di sini setelah satu Bab selesai disusun dan diajukan.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((item) => {
              const currentSnapshot = item.action === "delete" ? item.base_snapshot : item.payload;
              const lessonCount = currentSnapshot?.lessons?.length ?? 0;
              const miniCount = (currentSnapshot?.lessons ?? []).reduce((sum, lesson) => sum + (lesson.contents?.length ?? 0), 0);
              return (
                <article key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[8px] font-bold text-violet-700">Satu Bab</span>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${item.action === "delete" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{actionLabel(item.action)}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{item.course_title} · Diajukan oleh {item.mentor_name}</p>
                      <p className="mt-1 text-[9px] text-slate-400">{dateLabel(item.submitted_at)} · {lessonCount} Materi Inti · {miniCount} Mini Materi</p>
                    </div>
                  </div>

                  <ChapterPreview snapshot={currentSnapshot} urls={item.preview_urls} label={item.action === "delete" ? "Bab yang diminta untuk dihapus" : "Versi Bab yang diajukan"} />

                  {item.action === "update" && item.base_snapshot && (
                    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer text-[10px] font-bold text-slate-600">Lihat versi resmi saat ini sebelum perubahan</summary>
                      <ChapterPreview snapshot={item.base_snapshot} urls={item.preview_urls} label="Versi resmi sebelum perubahan" />
                    </details>
                  )}

                  {item.mentor_note && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Catatan Mentor</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{item.mentor_note}</p></div>}

                  <label className="mt-3 block text-[10px] font-bold text-slate-600">
                    Catatan Admin
                    <textarea rows={2} value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-500" placeholder="Wajib diisi jika meminta revisi; opsional jika menyetujui." />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void review(item, "approved")} disabled={busyId === item.id} className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-bold text-white disabled:opacity-50 ${item.action === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                      {busyId === item.id ? <RefreshCw size={13} className="animate-spin" /> : item.action === "delete" ? <Trash2 size={13} /> : <CheckCircle2 size={13} />}
                      {item.action === "delete" ? "Setujui Penghapusan Bab" : "Setujui & Terapkan Seluruh Bab"}
                    </button>
                    <button type="button" onClick={() => void review(item, "revision_requested")} disabled={busyId === item.id} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><RotateCcw size={13} /> Minta revisi</button>
                  </div>
                  {busyId === item.id && <p className="mt-2 inline-flex items-center gap-2 text-[10px] text-slate-400"><RefreshCw size={12} className="animate-spin" /> Memproses seluruh Bab...</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
