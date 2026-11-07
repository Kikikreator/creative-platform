"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";

export type MentorTaskCourse = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type Section = { id: string; course_id: string; title: string; position: number | null };
type Lesson = { id: string; section_id: string; title: string; position: number | null; status: string };
type Placement = "section_start" | "before_lesson" | "after_lesson" | "section_end";
type SubmissionType = "text" | "file" | "link" | "text_and_file";

type Task = {
  id: string;
  course_id: string;
  section_id: string;
  anchor_lesson_id: string | null;
  placement: Placement;
  position: number;
  title: string;
  description: string | null;
  instructions: string;
  submission_type: SubmissionType;
  reference_url: string | null;
  due_at: string | null;
  max_score: number;
  is_required: boolean;
  allow_late_submission: boolean;
  status: "draft" | "published";
  created_at: string;
};

type FormState = {
  title: string;
  description: string;
  instructions: string;
  section_id: string;
  placement: Placement;
  anchor_lesson_id: string;
  submission_type: SubmissionType;
  reference_url: string;
  due_at: string;
  max_score: string;
  is_required: boolean;
  allow_late_submission: boolean;
  status: "draft" | "published";
};

const emptyForm: FormState = {
  title: "",
  description: "",
  instructions: "",
  section_id: "",
  placement: "section_end",
  anchor_lesson_id: "",
  submission_type: "file",
  reference_url: "",
  due_at: "",
  max_score: "100",
  is_required: true,
  allow_late_submission: false,
  status: "draft",
};

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "block text-[11px] font-bold text-slate-700";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function formatDate(value: string | null) {
  if (!value) return "Tanpa tenggat";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanpa tenggat";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba kembali.";
}

export default function MentorTaskManager({
  courses,
  userId,
  initialCourseId,
  initialError,
}: {
  courses: MentorTaskCourse[];
  userId: string;
  initialCourseId: string;
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);
  const [courseId, setCourseId] = useState(initialCourseId);
  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const selectedCourse = courses.find((item) => item.id === courseId) ?? null;
  const sectionLessons = useMemo(
    () => lessons.filter((lesson) => lesson.section_id === form.section_id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [lessons, form.section_id]
  );

  const loadData = useCallback(async () => {
    if (!courseId) {
      setSections([]);
      setLessons([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [sectionResult, taskResult] = await Promise.all([
        supabase.from("course_sections").select("id, course_id, title, position").eq("course_id", courseId).order("position"),
        supabase.from("course_tasks").select("*").eq("course_id", courseId).order("created_at", { ascending: false }),
      ]);
      if (sectionResult.error) throw sectionResult.error;
      if (taskResult.error) throw taskResult.error;
      const nextSections = (sectionResult.data ?? []) as Section[];
      setSections(nextSections);
      setTasks((taskResult.data ?? []) as Task[]);
      if (nextSections.length) {
        const { data, error: lessonError } = await supabase
          .from("lessons")
          .select("id, section_id, title, position, status")
          .in("section_id", nextSections.map((item) => item.id))
          .order("position");
        if (lessonError) throw lessonError;
        setLessons((data ?? []) as Lesson[]);
      } else {
        setLessons([]);
      }
    } catch (err) {
      setError(messageOf(err));
      setSections([]);
      setLessons([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  function openCreate(sectionId?: string) {
    setEditingId(null);
    setForm({ ...emptyForm, section_id: sectionId ?? sections[0]?.id ?? "" });
    setFormOpen(true);
    setError("");
    setNotice("");
  }
  function openEdit(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      instructions: task.instructions,
      section_id: task.section_id,
      placement: task.placement,
      anchor_lesson_id: task.anchor_lesson_id ?? "",
      submission_type: task.submission_type,
      reference_url: task.reference_url ?? "",
      due_at: toLocalInput(task.due_at),
      max_score: String(task.max_score ?? 100),
      is_required: task.is_required,
      allow_late_submission: task.allow_late_submission,
      status: task.status,
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId) return;
    const title = form.title.trim();
    const instructions = form.instructions.trim();
    const maxScore = Number(form.max_score);
    const needsAnchor = form.placement === "before_lesson" || form.placement === "after_lesson";
    if (!title || !instructions) {
      setError("Judul dan instruksi tugas wajib diisi.");
      return;
    }
    if (!form.section_id) {
      setError("Pilih Bab tempat tugas ditampilkan.");
      return;
    }
    if (needsAnchor && !form.anchor_lesson_id) {
      setError("Pilih materi inti sebagai titik penempatan tugas.");
      return;
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setError("Nilai maksimal harus lebih besar dari 0.");
      return;
    }
    if (form.reference_url.trim()) {
      try {
        const url = new URL(form.reference_url.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setError("URL referensi harus menggunakan http atau https.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");
    const old = tasks.find((task) => task.id === editingId);
    const payload = {
      course_id: courseId,
      section_id: form.section_id,
      anchor_lesson_id: needsAnchor ? form.anchor_lesson_id : null,
      placement: form.placement,
      position: old?.position ?? tasks.length,
      title,
      description: form.description.trim() || null,
      instructions,
      submission_type: form.submission_type,
      reference_url: form.reference_url.trim() || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      max_score: maxScore,
      is_required: form.is_required,
      allow_late_submission: form.allow_late_submission,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
    try {
      const result = editingId
        ? await supabase.from("course_tasks").update(payload).eq("id", editingId).eq("course_id", courseId)
        : await supabase.from("course_tasks").insert({ ...payload, created_by: userId });
      if (result.error) throw result.error;
      setFormOpen(false);
      setNotice(editingId ? "Tugas berhasil diperbarui." : "Tugas berhasil dibuat.");
      await loadData();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task: Task) {
    const confirmed = await confirmDialog({
      title: "Hapus Tugas?",
      message: `Hapus tugas "${task.title}"? Pengumpulan yang terkait mengikuti aturan database.`,
      confirmLabel: "Ya, hapus tugas",
      variant: "danger",
    });
    if (!confirmed) return;
    setDeletingId(task.id);
    setError("");
    setNotice("");
    try {
      const { error: dbError } = await supabase.from("course_tasks").delete().eq("id", task.id).eq("course_id", courseId);
      if (dbError) throw dbError;
      setNotice("Tugas berhasil dihapus.");
      await loadData();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setDeletingId(null);
    }
  }

  const published = tasks.filter((task) => task.status === "published").length;
  const draft = tasks.length - published;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Assignment studio</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Rancang tugas kelas</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Buat tugas praktik, tentukan posisi di dalam Bab, atur bentuk pengumpulan, tenggat, dan nilai maksimal. Mentor hanya dapat mengelola kelas yang ditugaskan Admin.</p>
          </div>
          <Link href="/mentor/tugas" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[10px] font-bold text-white hover:bg-white/20">Pemeriksaan tugas <ArrowRight size={14} /></Link>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{notice}</div>}

      <section className="rounded-[22px] border border-[#EEEAF7] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className={labelClass}>Pilih kelas</label>
            <select value={courseId} onChange={(event) => { setCourseId(event.target.value); setFormOpen(false); }} className={inputClass}>
              {courses.length === 0 && <option value="">Belum ada kelas ditugaskan</option>}
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Perbarui</button>
            <button type="button" onClick={() => openCreate()} disabled={!courseId || sections.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white disabled:opacity-40"><Plus size={14} /> Buat tugas</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] text-slate-500">Total tugas</p><p className="mt-1 text-xl font-extrabold text-slate-900">{tasks.length}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] text-emerald-700">Dipublikasikan</p><p className="mt-1 text-xl font-extrabold text-emerald-800">{published}</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] text-amber-700">Draft</p><p className="mt-1 text-xl font-extrabold text-amber-800">{draft}</p></div>
        </div>
      </section>

      {formOpen && (
        <section className="rounded-[22px] border border-violet-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Task editor</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{editingId ? "Edit tugas" : "Buat tugas baru"}</h3></div>
            <button type="button" onClick={() => setFormOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><X size={15} /></button>
          </div>
          <form onSubmit={saveTask} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Judul tugas *<input required maxLength={180} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} className={inputClass} placeholder="Contoh: Praktik Membuat Poster" /></label>
              <label className={labelClass}>Bab *<select required value={form.section_id} onChange={(event) => setForm((old) => ({ ...old, section_id: event.target.value, anchor_lesson_id: "" }))} className={inputClass}><option value="">Pilih Bab</option>{sections.map((section, index) => <option key={section.id} value={section.id}>Bab {index + 1} · {section.title}</option>)}</select></label>
            </div>
            <label className={labelClass}>Deskripsi singkat<textarea rows={2} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs outline-none focus:border-violet-500" /></label>
            <label className={labelClass}>Instruksi pengerjaan *<textarea required rows={4} value={form.instructions} onChange={(event) => setForm((old) => ({ ...old, instructions: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-6 outline-none focus:border-violet-500" /></label>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-violet-900"><CalendarClock size={15} /> Penempatan dalam kurikulum</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Posisi tugas<select value={form.placement} onChange={(event) => setForm((old) => ({ ...old, placement: event.target.value as Placement, anchor_lesson_id: "" }))} className={inputClass}><option value="section_start">Awal Bab</option><option value="before_lesson">Sebelum materi</option><option value="after_lesson">Sesudah materi</option><option value="section_end">Akhir Bab</option></select></label>
                {(form.placement === "before_lesson" || form.placement === "after_lesson") && <label className={labelClass}>Materi inti<select required value={form.anchor_lesson_id} onChange={(event) => setForm((old) => ({ ...old, anchor_lesson_id: event.target.value }))} className={inputClass}><option value="">Pilih materi</option>{sectionLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className={labelClass}>Bentuk pengumpulan<select value={form.submission_type} onChange={(event) => setForm((old) => ({ ...old, submission_type: event.target.value as SubmissionType }))} className={inputClass}><option value="text">Jawaban teks</option><option value="file">Upload file</option><option value="link">Tautan</option><option value="text_and_file">Teks dan file</option></select></label>
              <label className={labelClass}>Nilai maksimal<input type="number" min="1" step="1" value={form.max_score} onChange={(event) => setForm((old) => ({ ...old, max_score: event.target.value }))} className={inputClass} /></label>
              <label className={labelClass}>Batas pengumpulan<input type="datetime-local" value={form.due_at} onChange={(event) => setForm((old) => ({ ...old, due_at: event.target.value }))} className={inputClass} /></label>
              <label className={labelClass}>Status<select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value as FormState["status"] }))} className={inputClass}><option value="draft">Draft</option><option value="published">Publikasikan</option></select></label>
            </div>
            <label className={labelClass}>URL referensi (opsional)<input type="url" value={form.reference_url} onChange={(event) => setForm((old) => ({ ...old, reference_url: event.target.value }))} className={inputClass} placeholder="https://" /></label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={form.is_required} onChange={(event) => setForm((old) => ({ ...old, is_required: event.target.checked }))} /> Wajib dikerjakan</label>
              <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={form.allow_late_submission} onChange={(event) => setForm((old) => ({ ...old, allow_late_submission: event.target.checked }))} /> Izinkan terlambat</label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setFormOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-[10px] font-bold text-slate-600">Batal</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-5 text-[10px] font-bold text-white disabled:opacity-50"><Save size={13} /> {saving ? "Menyimpan..." : "Simpan tugas"}</button></div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="rounded-[22px] border border-[#EEEAF7] bg-white p-10 text-center text-xs text-slate-500"><RefreshCw className="mx-auto mb-2 animate-spin text-violet-700" size={20} />Memuat tugas...</div>
      ) : !courseId ? (
        <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-10 text-center"><ClipboardList className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-xs text-slate-500">Belum ada kelas yang ditugaskan Admin.</p></div>
      ) : tasks.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-10 text-center"><FileText className="mx-auto text-slate-300" size={30} /><h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada tugas pada kelas ini</h3><p className="mt-1 text-xs text-slate-500">Buat tugas pertama untuk mulai memberi aktivitas kepada peserta.</p><button type="button" onClick={() => openCreate()} disabled={sections.length === 0} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white disabled:opacity-40"><Plus size={14} /> Buat tugas</button></div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-extrabold text-slate-900">Daftar tugas · {selectedCourse?.title}</h3><p className="mt-1 text-[10px] text-slate-500">Kelola tugas yang berada pada kelas yang ditugaskan kepadamu.</p></div>
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <article key={task.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ClipboardList size={18} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-extrabold text-slate-900">{task.title}</h4><span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${task.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{task.status === "published" ? "Dipublikasikan" : "Draft"}</span></div>
                    <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{task.description || task.instructions}</p>
                    <p className="mt-1 text-[9px] text-slate-400">Maks. {task.max_score} poin · {formatDate(task.due_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEdit(task)} className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Edit</button>
                  <button type="button" onClick={() => void deleteTask(task)} disabled={deletingId === task.id} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
