"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";

export type TaskCourseOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

export type TaskProfileOption = {
  id: string;
  full_name: string | null;
  roles: string[];
};

type SectionRow = {
  id: string;
  course_id: string;
  title: string;
  position: number | null;
};

type LessonRow = {
  id: string;
  section_id: string;
  title: string;
  position: number | null;
  status: string;
};

type CourseTask = {
  id: string;
  course_id: string;
  section_id: string;
  anchor_lesson_id: string | null;
  placement: "section_start" | "before_lesson" | "after_lesson" | "section_end";
  position: number;
  title: string;
  description: string | null;
  instructions: string;
  submission_type: "text" | "file" | "link" | "text_and_file";
  reference_url: string | null;
  due_at: string | null;
  max_score: number;
  is_required: boolean;
  allow_late_submission: boolean;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

type TaskFormState = {
  title: string;
  description: string;
  instructions: string;
  section_id: string;
  placement: CourseTask["placement"];
  anchor_lesson_id: string;
  position: string;
  submission_type: CourseTask["submission_type"];
  reference_url: string;
  due_at: string;
  max_score: string;
  is_required: boolean;
  allow_late_submission: boolean;
  status: CourseTask["status"];
};

const emptyForm: TaskFormState = {
  title: "",
  description: "",
  instructions: "",
  section_id: "",
  placement: "section_end",
  anchor_lesson_id: "",
  position: "0",
  submission_type: "file",
  reference_url: "",
  due_at: "",
  max_score: "100",
  is_required: true,
  allow_late_submission: false,
  status: "draft",
};

function formatDate(value: string | null) {
  if (!value) return "Tanpa tenggat";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanpa tenggat";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function placementLabel(placement: CourseTask["placement"]) {
  const labels: Record<CourseTask["placement"], string> = {
    section_start: "Di awal Bab",
    before_lesson: "Sebelum materi",
    after_lesson: "Sesudah materi",
    section_end: "Di akhir Bab",
  };
  return labels[placement];
}

function submissionLabel(type: CourseTask["submission_type"]) {
  const labels: Record<CourseTask["submission_type"], string> = {
    text: "Jawaban teks",
    file: "Upload file karya",
    link: "Tautan karya",
    text_and_file: "Teks dan file karya",
  };
  return labels[type];
}

function inputClass() {
  return "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
}

function labelClass() {
  return "block text-xs font-semibold text-slate-700";
}

export default function TaskManager({
  courses,
  profiles,
  userId,
  initialError,
}: {
  courses: TaskCourseOption[];
  profiles: TaskProfileOption[];
  userId: string;
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [tasks, setTasks] = useState<CourseTask[]>([]);
  const [assignedMentorIds, setAssignedMentorIds] = useState<string[]>([]);
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMentors, setSavingMentors] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedSectionLessons = useMemo(
    () => lessons
      .filter((lesson) => lesson.section_id === form.section_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [lessons, form.section_id]
  );

  const loadData = useCallback(async () => {
    if (!selectedCourseId) {
      setSections([]);
      setLessons([]);
      setTasks([]);
      setAssignedMentorIds([]);
      setSelectedMentorIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [sectionResult, taskResult, mentorResult] = await Promise.all([
        supabase
          .from("course_sections")
          .select("id, course_id, title, position")
          .eq("course_id", selectedCourseId)
          .order("position", { ascending: true }),
        supabase
          .from("course_tasks")
          .select("*")
          .eq("course_id", selectedCourseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("course_task_mentors")
          .select("mentor_user_id")
          .eq("course_id", selectedCourseId),
      ]);

      if (sectionResult.error) throw sectionResult.error;
      if (taskResult.error) throw taskResult.error;
      if (mentorResult.error) throw mentorResult.error;

      const loadedSections = (sectionResult.data ?? []) as SectionRow[];
      setSections(loadedSections);
      setTasks((taskResult.data ?? []) as CourseTask[]);

      const mentorIds = (mentorResult.data ?? []).map((row) => row.mentor_user_id as string);
      setAssignedMentorIds(mentorIds);
      setSelectedMentorIds(mentorIds);

      if (loadedSections.length > 0) {
        const sectionIds = loadedSections.map((section) => section.id);
        const lessonResult = await supabase
          .from("lessons")
          .select("id, section_id, title, position, status")
          .in("section_id", sectionIds)
          .order("position", { ascending: true });
        if (lessonResult.error) throw lessonResult.error;
        setLessons((lessonResult.data ?? []) as LessonRow[]);
      } else {
        setLessons([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data tugas.");
      setSections([]);
      setLessons([]);
      setTasks([]);
      setAssignedMentorIds([]);
      setSelectedMentorIds([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateForm(sectionId?: string) {
    setEditingTaskId(null);
    setForm({
      ...emptyForm,
      section_id: sectionId ?? sections[0]?.id ?? "",
    });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function openEditForm(task: CourseTask) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      instructions: task.instructions,
      section_id: task.section_id,
      placement: task.placement,
      anchor_lesson_id: task.anchor_lesson_id ?? "",
      position: String(task.position ?? 0),
      submission_type: task.submission_type,
      reference_url: task.reference_url ?? "",
      due_at: toDateTimeLocal(task.due_at),
      max_score: String(task.max_score ?? 100),
      is_required: task.is_required,
      allow_late_submission: task.allow_late_submission,
      status: task.status,
    });
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingTaskId(null);
    setForm(emptyForm);
  }

  async function handleSaveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId) {
      setError("Pilih kelas terlebih dahulu.");
      return;
    }

    const title = form.title.trim();
    const instructions = form.instructions.trim();
    const maxScore = Number(form.max_score);
    const position = Number(form.position);
    const needsAnchor = form.placement === "before_lesson" || form.placement === "after_lesson";

    if (!title || !instructions) {
      setError("Judul dan instruksi tugas wajib diisi.");
      return;
    }
    if (!form.section_id) {
      setError("Pilih Bab tempat tugas akan ditampilkan.");
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
    if (!Number.isSafeInteger(position) || position < 0) {
      setError("Urutan tugas harus berupa angka bulat 0 atau lebih.");
      return;
    }
    if (form.reference_url.trim()) {
      try {
        const parsed = new URL(form.reference_url.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        setError("Tautan referensi harus menggunakan URL http atau https yang valid.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      course_id: selectedCourseId,
      section_id: form.section_id,
      anchor_lesson_id: needsAnchor ? form.anchor_lesson_id : null,
      placement: form.placement,
      position,
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
      if (editingTaskId) {
        const { error: updateError } = await supabase
          .from("course_tasks")
          .update(payload)
          .eq("id", editingTaskId)
          .eq("course_id", selectedCourseId);
        if (updateError) throw updateError;
        setSuccess("Tugas berhasil diperbarui.");
      } else {
        const { error: insertError } = await supabase
          .from("course_tasks")
          .insert({ ...payload, created_by: userId });
        if (insertError) throw insertError;
        setSuccess("Tugas berhasil dibuat.");
      }

      setFormOpen(false);
      setEditingTaskId(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tugas.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(task: CourseTask) {
    const confirmed = await confirmDialog({
      title: "Hapus Tugas?",
      message: `Hapus tugas "${task.title}" beserta data pengumpulannya?`,
      confirmLabel: "Ya, hapus tugas",
      variant: "danger",
    });
    if (!confirmed) return;

    setDeletingId(task.id);
    setError("");
    setSuccess("");
    try {
      const { error: deleteError } = await supabase
        .from("course_tasks")
        .delete()
        .eq("id", task.id)
        .eq("course_id", selectedCourseId);
      if (deleteError) throw deleteError;
      setSuccess("Tugas berhasil dihapus.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus tugas.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleMentor(mentorId: string) {
    setSelectedMentorIds((current) => current.includes(mentorId)
      ? current.filter((id) => id !== mentorId)
      : [...current, mentorId]
    );
  }

  async function saveMentors() {
    if (!selectedCourseId) return;
    setSavingMentors(true);
    setError("");
    setSuccess("");
    try {
      const toAdd = selectedMentorIds.filter((id) => !assignedMentorIds.includes(id));
      const toRemove = assignedMentorIds.filter((id) => !selectedMentorIds.includes(id));

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("course_task_mentors")
          .delete()
          .eq("course_id", selectedCourseId)
          .in("mentor_user_id", toRemove);
        if (removeError) throw removeError;
      }

      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("course_task_mentors")
          .upsert(
            toAdd.map((mentor_user_id) => ({
              course_id: selectedCourseId,
              mentor_user_id,
              assigned_by: userId,
            })),
            { onConflict: "course_id,mentor_user_id" }
          );
        if (addError) throw addError;
      }

      setAssignedMentorIds(selectedMentorIds);
      setSuccess("Penugasan mentor untuk kelas ini berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan mentor kelas.");
      await loadData();
    } finally {
      setSavingMentors(false);
    }
  }

  const publishedCount = tasks.filter((task) => task.status === "published").length;
  const draftCount = tasks.length - publishedCount;
  // Hanya akun dengan role instructor yang dapat ditugaskan sebagai Mentor.
  const availableMentors = profiles.filter(
    (profile) =>
      profile.id !== userId &&
      (
        profile.roles.includes("instructor") ||
        assignedMentorIds.includes(profile.id)
      )
  );

  return (
    <div className="app-page space-y-6">
      <div className="space-y-6">
        <section className="app-page-heading">
          <div>
            <p className="app-eyebrow">Learning management</p>
            
            <p className="app-page-description">Buat tugas praktik, tentukan posisinya di dalam Bab dan materi, lalu tugaskan mentor untuk memeriksa karya peserta.</p>
          </div>
        </section>

        {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <label className="text-xs font-bold text-slate-700" htmlFor="task-course">Pilih kelas</label>
              <select id="task-course" value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); setFormOpen(false); }} className={inputClass()}>
                {courses.length === 0 && <option value="">Belum ada kelas</option>}
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/materi" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800">
                <Layers3 size={15} /> Atur Bab & Materi
              </Link>
              <button type="button" onClick={() => openCreateForm()} disabled={!selectedCourseId || sections.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={16} /> Buat Tugas
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total tugas</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{tasks.length}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Dipublikasikan</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{publishedCount}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Draft</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{draftCount}</p>
            </div>
          </div>
        </section>

        {formOpen && (
          <section className="mt-5 rounded-3xl border border-violet-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Pengaturan tugas</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{editingTaskId ? "Edit tugas" : "Buat tugas baru"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Tentukan instruksi, bentuk pengumpulan, dan posisi tugas di dalam kurikulum.</p>
              </div>
              <button type="button" onClick={closeForm} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Tutup form"><X size={17} /></button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className={labelClass()}>Judul tugas *
                  <input required maxLength={180} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={inputClass()} placeholder="Contoh: Praktik Membuat Poster" />
                </label>
                <label className={labelClass()}>Bab tempat tugas *
                  <select required value={form.section_id} onChange={(event) => setForm((current) => ({ ...current, section_id: event.target.value, anchor_lesson_id: "" }))} className={inputClass()}>
                    <option value="">Pilih Bab</option>
                    {sections.map((section, index) => <option key={section.id} value={section.id}>Bab {index + 1} · {section.title}</option>)}
                  </select>
                </label>
              </div>

              <label className={labelClass()}>Deskripsi singkat
                <textarea rows={2} maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Gambaran singkat tugas untuk peserta." />
              </label>

              <label className={labelClass()}>Instruksi pengerjaan *
                <textarea required rows={5} value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Jelaskan apa yang harus dibuat peserta, ketentuan karya, dan cara pengumpulannya." />
              </label>

              <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-violet-900"><BookOpen size={17} /> Posisi tugas dalam pembelajaran</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">Tugas akan muncul di ruang belajar peserta sesuai posisi yang dipilih.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass()}>Tampilkan tugas
                    <select value={form.placement} onChange={(event) => setForm((current) => ({ ...current, placement: event.target.value as TaskFormState["placement"], anchor_lesson_id: "" }))} className={inputClass()}>
                      <option value="section_start">Di awal Bab</option>
                      <option value="before_lesson">Sebelum materi tertentu</option>
                      <option value="after_lesson">Sesudah materi tertentu</option>
                      <option value="section_end">Di akhir Bab</option>
                    </select>
                  </label>
                  {(form.placement === "before_lesson" || form.placement === "after_lesson") && (
                    <label className={labelClass()}>Pilih materi inti *
                      <select required value={form.anchor_lesson_id} onChange={(event) => setForm((current) => ({ ...current, anchor_lesson_id: event.target.value }))} className={inputClass()}>
                        <option value="">Pilih materi</option>
                        {selectedSectionLessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>Materi {index + 1} · {lesson.title}{lesson.status !== "published" ? " (Draft)" : ""}</option>)}
                      </select>
                    </label>
                  )}
                  <label className={labelClass()}>Urutan pada posisi yang sama
                    <input type="number" min="0" step="1" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))} className={inputClass()} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass()}>Bentuk pengumpulan
                  <select value={form.submission_type} onChange={(event) => setForm((current) => ({ ...current, submission_type: event.target.value as TaskFormState["submission_type"] }))} className={inputClass()}>
                    <option value="text">Jawaban teks</option>
                    <option value="file">Upload file karya</option>
                    <option value="link">Tautan karya</option>
                    <option value="text_and_file">Teks dan file karya</option>
                  </select>
                </label>
                <label className={labelClass()}>Nilai maksimal
                  <input type="number" min="1" step="0.01" value={form.max_score} onChange={(event) => setForm((current) => ({ ...current, max_score: event.target.value }))} className={inputClass()} />
                </label>
                <label className={labelClass()}>Tenggat pengumpulan
                  <input type="datetime-local" value={form.due_at} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} className={inputClass()} />
                </label>
                <label className={labelClass()}>Status tugas
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskFormState["status"] }))} className={inputClass()}>
                    <option value="draft">Draft · Belum terlihat peserta</option>
                    <option value="published">Publikasikan · Terlihat peserta</option>
                  </select>
                </label>
              </div>

              <label className={labelClass()}>Tautan referensi (opsional)
                <input type="url" value={form.reference_url} onChange={(event) => setForm((current) => ({ ...current, reference_url: event.target.value }))} className={inputClass()} placeholder="https://..." />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={form.is_required} onChange={(event) => setForm((current) => ({ ...current, is_required: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-violet-700" />
                  <span><span className="block text-xs font-bold text-slate-800">Tugas wajib</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">Peserta diharapkan mengumpulkan tugas ini.</span></span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={form.allow_late_submission} onChange={(event) => setForm((current) => ({ ...current, allow_late_submission: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-violet-700" />
                  <span><span className="block text-xs font-bold text-slate-800">Izinkan terlambat</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">Peserta tetap dapat mengumpulkan setelah tenggat.</span></span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={saving} className="h-11 rounded-xl border border-slate-200 px-5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60">
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Menyimpan..." : editingTaskId ? "Simpan Perubahan" : "Simpan Tugas"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Daftar tugas</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedCourse?.title ?? "Pilih kelas"}</h2>
              </div>
              <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Muat ulang</button>
            </div>

            {loading ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center text-slate-500"><RefreshCw size={25} className="animate-spin text-violet-600" /><p className="mt-3 text-sm font-semibold">Memuat daftar tugas...</p></div>
            ) : courses.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center"><BookOpen className="mx-auto text-slate-400" size={30} /><p className="mt-3 text-sm font-bold text-slate-800">Belum ada kelas</p><p className="mt-1 text-xs text-slate-500">Buat kelas terlebih dahulu sebelum membuat tugas.</p></div>
            ) : sections.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center"><Layers3 className="mx-auto text-slate-400" size={30} /><p className="mt-3 text-sm font-bold text-slate-800">Bab belum tersedia</p><p className="mt-1 text-xs text-slate-500">Tambahkan Bab dan materi melalui Manajemen Materi terlebih dahulu.</p><Link href="/admin/materi" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white"><Plus size={14} /> Buka Manajemen Materi</Link></div>
            ) : tasks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center"><ClipboardList className="mx-auto text-violet-600" size={32} /><p className="mt-3 text-sm font-bold text-slate-800">Belum ada tugas di kelas ini</p><p className="mt-1 text-xs leading-5 text-slate-500">Buat tugas pertama dan tentukan letaknya di dalam kurikulum.</p><button type="button" onClick={() => openCreateForm()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white"><Plus size={14} /> Buat Tugas</button></div>
            ) : (
              <div className="mt-5 space-y-5">
                {sections.map((section, sectionIndex) => {
                  const sectionTasks = tasks
                    .filter((task) => task.section_id === section.id)
                    .sort((a, b) => {
                      const order: Record<CourseTask["placement"], number> = { section_start: 0, before_lesson: 1, after_lesson: 2, section_end: 3 };
                      return order[a.placement] - order[b.placement] || a.position - b.position;
                    });
                  if (sectionTasks.length === 0) return null;
                  return (
                    <div key={section.id}>
                      <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Bab {sectionIndex + 1}</p><h3 className="mt-0.5 text-sm font-bold text-slate-800">{section.title}</h3></div><button type="button" onClick={() => openCreateForm(section.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 px-2.5 text-[10px] font-bold text-violet-800 hover:bg-violet-50"><Plus size={12} /> Tambah tugas</button></div>
                      <div className="space-y-2">
                        {sectionTasks.map((task) => {
                          const anchor = lessons.find((lesson) => lesson.id === task.anchor_lesson_id);
                          return (
                            <article key={task.id} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FileText size={19} /></div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-slate-900">{task.title}</h4><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{task.status === "published" ? "Dipublikasikan" : "Draft"}</span></div>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">{task.description || task.instructions}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{placementLabel(task.placement)}{anchor ? ` · ${anchor.title}` : ""}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{submissionLabel(task.submission_type)}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Maks. {task.max_score}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"><CalendarClock size={11} className="mr-1 inline" />{formatDate(task.due_at)}</span></div>
                                </div>
                                <div className="flex shrink-0 gap-2 sm:flex-col"><button type="button" onClick={() => openEditForm(task)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800">Edit</button><button type="button" onClick={() => void handleDeleteTask(task)} disabled={deletingId === task.id} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-100 px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">{deletingId === task.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />} Hapus</button></div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {tasks.some((task) => !sections.some((section) => section.id === task.section_id)) && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Ada tugas yang terhubung ke Bab yang sudah tidak tersedia. Periksa kembali struktur kurikulum kelas.</p>}
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><UserRoundCheck size={18} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Mentor kelas</p><h2 className="text-sm font-bold text-slate-900">Penugasan mentor</h2></div></div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Pilih akun yang bertanggung jawab memeriksa karya dan memberikan masukan pada kelas ini. Akses mentor dibatasi ke kelas yang ditugaskan.</p>
            {!selectedCourseId ? <p className="mt-4 text-xs text-slate-500">Pilih kelas terlebih dahulu.</p> : availableMentors.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Belum ada akun lain yang dapat ditugaskan.</p> : (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {availableMentors.map((profile) => (
                  <label key={profile.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-violet-200 hover:bg-violet-50/40">
                    <input type="checkbox" checked={selectedMentorIds.includes(profile.id)} onChange={() => toggleMentor(profile.id)} className="h-4 w-4 accent-violet-700" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{profile.full_name?.trim() || "Pengguna tanpa nama"}</span><span className="mt-0.5 block truncate text-[9px] text-slate-400">{profile.id}</span></span>
                    {selectedMentorIds.includes(profile.id) && <CheckCircle2 size={15} className="shrink-0 text-violet-700" />}
                  </label>
                ))}
              </div>
            )}
            <button type="button" onClick={() => void saveMentors()} disabled={!selectedCourseId || savingMentors || loading} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white transition hover:bg-violet-800 disabled:opacity-50">{savingMentors ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Simpan Penugasan Mentor</button>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500"><ShieldCheck size={13} className="mr-1 inline text-violet-700" />Mentor hanya dapat membaca dan menilai tugas dari kelas yang ditugaskan kepadanya. Pengaturan role global tetap mengikuti Fase 4.</div>
          </aside>
        </section>
      </div>
    </div>
  );
}
