"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

export type MentorWorkspaceCourse = { id: string; title: string };
export type WorkspaceEntry = {
  id: string;
  mentor_user_id: string;
  course_id: string | null;
  entry_type: "note" | "event";
  title: string;
  body: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "block text-[11px] font-bold text-slate-700";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function dateLabel(value: string | null) {
  if (!value) return "Tanpa jadwal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jadwal tidak valid";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

export default function MentorWorkspaceManager({
  userId,
  courses,
  initialEntries,
  initialError,
}: {
  userId: string;
  courses: MentorWorkspaceCourse[];
  initialEntries: WorkspaceEntry[];
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"note" | "event">("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  function openEditor(entry?: WorkspaceEntry) {
    setEditingId(entry?.id ?? null);
    setEntryType(entry?.entry_type ?? "note");
    setTitle(entry?.title ?? "");
    setBody(entry?.body ?? "");
    setCourseId(entry?.course_id ?? "");
    setStartsAt(toLocalInput(entry?.starts_at ?? null));
    setEndsAt(toLocalInput(entry?.ends_at ?? null));
    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Judul wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      mentor_user_id: userId,
      course_id: courseId || null,
      entry_type: entryType,
      title: title.trim(),
      body: body.trim() || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    try {
      const result = editingId
        ? await supabase.from("mentor_workspace_entries").update(payload).eq("id", editingId).eq("mentor_user_id", userId).select().single()
        : await supabase.from("mentor_workspace_entries").insert({ ...payload, is_completed: false }).select().single();
      if (result.error) throw result.error;
      const saved = result.data as WorkspaceEntry;
      setEntries((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [...current, saved]);
      setEditorOpen(false);
      setNotice(editingId ? "Catatan berhasil diperbarui." : "Agenda berhasil ditambahkan.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(entry: WorkspaceEntry) {
    setError("");
    const { error: dbError } = await supabase
      .from("mentor_workspace_entries")
      .update({ is_completed: !entry.is_completed, updated_at: new Date().toISOString() })
      .eq("id", entry.id)
      .eq("mentor_user_id", userId);
    if (dbError) {
      setError(errorText(dbError));
      return;
    }
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, is_completed: !entry.is_completed } : item));
  }

  async function deleteEntry(entry: WorkspaceEntry) {
    const confirmed = await confirmDialog({
      title: "Hapus catatan?",
      message: `Hapus "${entry.title}" dari Ruang Pengajar?`,
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    const { error: dbError } = await supabase.from("mentor_workspace_entries").delete().eq("id", entry.id).eq("mentor_user_id", userId);
    if (dbError) {
      setError(errorText(dbError));
      return;
    }
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setNotice("Item berhasil dihapus.");
  }

  const sortedEntries = [...entries].sort((a, b) => {
    if (!a.starts_at) return 1;
    if (!b.starts_at) return -1;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });
  const upcoming = sortedEntries.filter((item) => !item.is_completed && item.starts_at && new Date(item.starts_at).getTime() >= Date.now());
  const notes = entries.filter((item) => item.entry_type === "note");

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-[22px] bg-white/90 p-5 shadow-[0_8px_22px_rgba(38,27,72,.055)] sm:flex-row sm:items-center sm:p-6">
        <div className="max-w-2xl">
          <p className="app-eyebrow">Personal workspace</p>
          <p className="mt-2 text-sm leading-6 text-[#77738b]">Simpan rencana mengajar, pengingat, catatan evaluasi, dan agenda pribadi. Catatan ini hanya dapat dilihat oleh akun Mentor pemiliknya dan Admin yang berwenang.</p>
        </div>
        <button type="button" onClick={() => openEditor()} className="app-primary-button shrink-0"><Plus size={15} /> Tambah agenda</button>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} />{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="app-stat-card"><p className="text-[10px] text-slate-500">Agenda mendatang</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{upcoming.length}</p></div>
        <div className="app-stat-card"><p className="text-[10px] text-slate-500">Catatan pribadi</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{notes.length}</p></div>
        <div className="app-stat-card"><p className="text-[10px] text-slate-500">Total item</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{entries.length}</p></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-surface overflow-hidden">
          <div className="border-b border-[#f2eff8] px-5 py-4"><div className="flex items-center gap-2"><CalendarDays size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Agenda mengajar</h3></div><p className="mt-1 text-[10px] text-slate-500">Jadwal dan pengingat yang kamu buat sendiri.</p></div>
          <div className="divide-y divide-slate-100">
            {sortedEntries.filter((item) => item.entry_type === "event").length === 0 ? <div className="p-8 text-center text-xs text-slate-400">Belum ada agenda. Tambahkan jadwal mengajar atau pengingat.</div> : sortedEntries.filter((item) => item.entry_type === "event").map((entry) => (
              <article key={entry.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <button type="button" onClick={() => void toggleComplete(entry)} aria-label={entry.is_completed ? "Tandai belum selesai" : "Tandai selesai"} className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${entry.is_completed ? "bg-emerald-100 text-emerald-700" : "bg-violet-50 text-violet-700"}`}><CheckCircle2 size={16} /></button>
                  <div className="min-w-0"><p className={`text-xs font-extrabold ${entry.is_completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{entry.title}</p><p className="mt-1 text-[10px] text-slate-500">{dateLabel(entry.starts_at)}{entry.ends_at ? ` – ${dateLabel(entry.ends_at)}` : ""}</p>{entry.body && <p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-500">{entry.body}</p>}<p className="mt-1 text-[9px] text-violet-700">{courses.find((course) => course.id === entry.course_id)?.title ?? "Agenda umum"}</p></div>
                </div>
                <div className="flex shrink-0 gap-1.5"><button type="button" onClick={() => openEditor(entry)} className="h-8 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600">Edit</button><button type="button" onClick={() => void deleteEntry(entry)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-600"><Trash2 size={13} /></button></div>
              </article>
            ))}
          </div>
        </div>

        <div className="app-surface overflow-hidden">
          <div className="border-b border-[#f2eff8] px-5 py-4"><div className="flex items-center gap-2"><FileText size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Catatan pribadi</h3></div><p className="mt-1 text-[10px] text-slate-500">Ide materi, evaluasi, dan catatan internal.</p></div>
          <div className="space-y-2 p-4">
            {notes.length === 0 ? <div className="p-7 text-center text-xs text-slate-400">Belum ada catatan pribadi.</div> : notes.map((entry) => (
              <article key={entry.id} className="rounded-xl bg-[#faf9fe] p-3">
                <div className="flex items-start justify-between gap-2"><h4 className="text-[11px] font-extrabold text-slate-800">{entry.title}</h4><div className="flex gap-1"><button type="button" onClick={() => openEditor(entry)} className="rounded-md px-2 py-1 text-[9px] font-bold text-violet-700 hover:bg-violet-50">Edit</button><button type="button" onClick={() => void deleteEntry(entry)} className="rounded-md p-1 text-rose-600 hover:bg-rose-50"><Trash2 size={12} /></button></div></div>
                <p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-500">{entry.body || "Belum ada isi catatan."}</p>
                <p className="mt-2 text-[9px] text-slate-400">{courses.find((course) => course.id === entry.course_id)?.title ?? "Catatan umum"}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {editorOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveEntry} className="my-4 w-full max-w-lg rounded-[24px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Personal workspace</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{editingId ? "Edit item" : "Tambah item baru"}</h3></div><button type="button" onClick={() => setEditorOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><X size={15} /></button></div>
            <div className="mt-5 space-y-4">
              <label className={labelClass}>Jenis item<select value={entryType} onChange={(event) => setEntryType(event.target.value as "note" | "event")} className={inputClass}><option value="note">Catatan pribadi</option><option value="event">Agenda / pengingat</option></select></label>
              <label className={labelClass}>Judul *<input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Contoh: Evaluasi materi Bab 1" /></label>
              <label className={labelClass}>Terkait kelas (opsional)<select value={courseId} onChange={(event) => setCourseId(event.target.value)} className={inputClass}><option value="">Umum / tidak terkait kelas</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
              {entryType === "event" && <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Mulai<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputClass} /></label><label className={labelClass}>Selesai<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={inputClass} /></label></div>}
              <label className={labelClass}>Catatan / detail<textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-6 outline-none focus:border-violet-500" placeholder="Tuliskan detail, poin penting, atau pengingat..." /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditorOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-[10px] font-bold text-slate-600">Batal</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-5 text-[10px] font-bold text-white disabled:opacity-50"><Save size={13} /> {saving ? "Menyimpan..." : "Simpan"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
