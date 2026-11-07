
"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Archive,
  BookOpen,
  CheckCircle2,
  Clock3,
  Eye,
  GraduationCap,
  Image as ImageIcon,
  ImagePlus,
  UploadCloud,
  Layers3,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  CircleDollarSign,
  FileText,
  Link2,
  Type,
  LayoutGrid,
  Tag,
  AlignLeft,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

type CourseStatus = "draft" | "published" | "archived";

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  category: string | null;
  target_audience: string | null;
  benefits: string[];
  mentor_name: string | null;
  mentor_bio: string | null;
  price: number | string;
  status: CourseStatus;
  access_type: "permanent";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  title: string;
  slug: string;
  short_description: string;
  description: string;
  cover_image_url: string;
  category: string;
  target_audience: string;
  benefits: string;
  mentor_name: string;
  mentor_bio: string;
  price: string;
  status: CourseStatus;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  short_description: "",
  description: "",
  cover_image_url: "",
  category: "",
  target_audience: "",
  benefits: "",
  mentor_name: "",
  mentor_bio: "",
  price: "0",
  status: "draft",
};

const selectFields =
  "id, title, slug, description, short_description, cover_image_url, category, target_audience, benefits, mentor_name, mentor_bio, price, status, access_type, created_by, created_at, updated_at";

const COURSE_COVER_BUCKET = "course-covers";
const MAX_COVER_SIZE = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ==========================================
// HELPERS
// ==========================================

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPrice(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getStatusLabel(status: CourseStatus) {
  const labels: Record<CourseStatus, string> = {
    draft: "Draft",
    published: "Dipublikasikan",
    archived: "Diarsipkan",
  };

  return labels[status];
}

function getStatusStyle(status: CourseStatus) {
  const styles: Record<CourseStatus, string> = {
    draft: "bg-amber-100 text-amber-800 border-amber-200",
    published: "bg-violet-50 text-violet-800 border-violet-100",
    archived: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return styles[status];
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function KelasManager({
  initialCourses,
  userId,
  initialError,
}: {
  initialCourses: Course[];
  userId: string;
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugManual, setSlugManual] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!coverPreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  // ========================================
  // STATISTICS
  // ========================================

  const stats = useMemo(
    () => ({
      total: courses.length,
      published: courses.filter(
        (course) => course.status === "published"
      ).length,
      draft: courses.filter(
        (course) => course.status === "draft"
      ).length,
      archived: courses.filter(
        (course) => course.status === "archived"
      ).length,
    }),
    [courses]
  );

  // ========================================
  // FILTER
  // ========================================

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        course.title.toLowerCase().includes(keyword) ||
        course.slug.toLowerCase().includes(keyword) ||
        (course.category ?? "").toLowerCase().includes(keyword) ||
        (course.mentor_name ?? "").toLowerCase().includes(keyword);

      const matchesStatus =
        filter === "all" || course.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [courses, search, filter]);

  // ========================================
  // FORM HELPERS
  // ========================================

  function updateForm<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(false);
    setSlugManual(false);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEdit(course: Course) {
    setEditingId(course.id);

    setForm({
      title: course.title,
      slug: course.slug,
      short_description: course.short_description ?? "",
      description: course.description ?? "",
      cover_image_url: course.cover_image_url ?? "",
      category: course.category ?? "",
      target_audience: course.target_audience ?? "",
      benefits: (course.benefits ?? []).join("\n"),
      mentor_name: course.mentor_name ?? "",
      mentor_bio: course.mentor_bio ?? "",
      price: String(course.price),
      status: course.status,
    });

    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(false);
    setSlugManual(true);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(false);
    setError("");
  }

  function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setError("Format gambar harus JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > MAX_COVER_SIZE) {
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
    setForm((previous) => ({ ...previous, cover_image_url: "" }));
    setError("");
  }

  function clearCoverImage() {
    setCoverFile(null);
    setCoverPreview(null);
    setForm((previous) => ({ ...previous, cover_image_url: "" }));
    setRemoveCover(true);
  }

  function handleCoverUrlChange(value: string) {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(false);
    updateForm("cover_image_url", value);
  }

  // ========================================
  // SAVE COURSE
  // ========================================

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const title = form.title.trim();
    const slug = makeSlug(form.slug || title);
    const price = Number(form.price);

    if (!title) {
      setError("Nama kelas wajib diisi.");
      return;
    }

    if (!slug) {
      setError("Slug kelas tidak valid.");
      return;
    }

    if (!Number.isSafeInteger(price) || price < 0) {
      setError("Harga kelas harus berupa angka rupiah yang valid.");
      return;
    }

    setSaving(true);
    let uploadedCoverPath: string | null = null;

    try {
      let coverImageUrl = removeCover
        ? null
        : form.cover_image_url.trim() || null;

      if (coverFile) {
        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };

        const extension = extensionByType[coverFile.type];
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const filePath = `courses/${userId}/${uniqueName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(COURSE_COVER_BUCKET)
          .upload(filePath, coverFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: coverFile.type,
          });

        if (uploadError) {
          throw new Error(`Gagal mengunggah foto kelas: ${uploadError.message}`);
        }

        uploadedCoverPath = filePath;

        const { data: publicUrlData } = supabase.storage
          .from(COURSE_COVER_BUCKET)
          .getPublicUrl(filePath);

        coverImageUrl = publicUrlData.publicUrl;
      }

      const payload = {
        title,
        slug,
        short_description: form.short_description.trim() || null,
        description: form.description.trim() || null,
        cover_image_url: coverImageUrl,
        category: form.category.trim() || null,
        target_audience: form.target_audience.trim() || null,
        benefits: form.benefits
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        mentor_name: form.mentor_name.trim() || null,
        mentor_bio: form.mentor_bio.trim() || null,
        price,
        status: form.status,
        access_type: "permanent" as const,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error: dbError } = await supabase
          .from("courses")
          .update(payload)
          .eq("id", editingId)
          .select(selectFields)
          .single();

        if (dbError) throw dbError;

        setCourses((previous) =>
          previous.map((course) =>
            course.id === editingId ? (data as Course) : course
          )
        );

        setSuccess("Kelas berhasil diperbarui.");
      } else {
        const { data, error: dbError } = await supabase
          .from("courses")
          .insert({
            ...payload,
            created_by: userId,
          })
          .select(selectFields)
          .single();

        if (dbError) throw dbError;

        setCourses((previous) => [data as Course, ...previous]);
        setSuccess("Kelas baru berhasil ditambahkan.");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setCoverFile(null);
      setCoverPreview(null);
      setRemoveCover(false);
    } catch (err) {
      if (uploadedCoverPath) {
        const { error: cleanupError } = await supabase.storage
          .from(COURSE_COVER_BUCKET)
          .remove([uploadedCoverPath]);

        if (cleanupError) {
          console.error("Gagal membersihkan cover yang belum tersimpan:", cleanupError);
        }
      }

      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan kelas.";

      const duplicate =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "23505";

      if (
        duplicate ||
        message.includes("courses_slug_key") ||
        message.includes("duplicate key")
      ) {
        setError("Slug sudah digunakan. Silakan gunakan slug lain.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DELETE COURSE
  // ========================================

  async function handleDelete(course: Course) {
    const confirmed = await confirmDialog({
      title: "Hapus Kelas?",
      message: `Hapus kelas "${course.title}"?\n\nBab dan materi yang terhubung mungkin ikut terhapus sesuai konfigurasi database. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Ya, hapus kelas",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(course.id);
    setError("");
    setSuccess("");

    try {
      const { error: dbError } = await supabase
        .from("courses")
        .delete()
        .eq("id", course.id);

      if (dbError) throw dbError;

      setCourses((previous) =>
        previous.filter((item) => item.id !== course.id)
      );

      setSuccess("Kelas berhasil dihapus.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus kelas."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ========================================
  // STATISTIC CARDS
  // ========================================

  const statItems = [
    {
      title: "Total Kelas",
      value: stats.total,
      description: "Seluruh kelas",
      icon: BookOpen,
      gradient: "from-[#6D28D9] to-[#8B5CF6]",
      iconStyle: "bg-violet-100 text-violet-700",
      accent: "bg-violet-500",
    },
    {
      title: "Dipublikasikan",
      value: stats.published,
      description: "Kelas aktif",
      icon: Eye,
      gradient: "from-[#8B5CF6] to-[#A78BFA]",
      iconStyle: "bg-violet-50 text-violet-700",
      accent: "bg-violet-600",
    },
    {
      title: "Draft",
      value: stats.draft,
      description: "Belum diterbitkan",
      icon: Clock3,
      gradient: "from-amber-500 to-orange-400",
      iconStyle: "bg-amber-100 text-amber-700",
      accent: "bg-amber-500",
    },
    {
      title: "Diarsipkan",
      value: stats.archived,
      description: "Kelas tersimpan",
      icon: Archive,
      gradient: "from-slate-500 to-slate-400",
      iconStyle: "bg-slate-100 text-slate-600",
      accent: "bg-slate-500",
    },
  ];

  const previewCoverUrl = coverPreview ?? (removeCover ? "" : form.cover_image_url);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="app-page space-y-6">
      <section className="app-page-heading">
        <div>
          <p className="app-eyebrow">Learning management</p>
          
          <p className="app-page-description">Kelola program pembelajaran, atur informasi kelas, dan publikasikan kelas untuk seluruh member Kiki Creator Class.</p>
        </div>
        <button onClick={openCreate} className="app-primary-button">
          <Plus size={17} /> Tambah kelas baru
        </button>
      </section>


      <div className="space-y-6">

        {/* Statistics */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {statItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="app-stat-card group relative overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >

                <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${item.gradient}`} />

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-xs font-bold text-slate-500 sm:text-sm">
                      {item.title}
                    </p>

                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                      {item.value}
                    </p>

                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      {item.description}
                    </p>

                  </div>

                  <div className={`rounded-2xl p-3 transition duration-300 group-hover:scale-110 ${item.iconStyle}`}>
                    <Icon size={23} />
                  </div>

                </div>

              </div>
            );
          })}

        </section>

        {/* Notifications */}

        {error && !modalOpen && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <X size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800 shadow-sm">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* =====================================
            COURSE MANAGEMENT
        ===================================== */}

        <section className="app-surface mt-1 overflow-hidden">

          {/* Section header */}

          <div className="border-b border-[#f2eff8] bg-white p-5 sm:p-7">

            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

              <div>

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 shadow-sm">
                    <Layers3 size={22} />
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
                      Daftar Kelas
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Kelola semua kelas dalam platform.
                    </p>
                  </div>

                </div>

              </div>

              {/* Search and filter */}

              <div className="flex flex-col gap-3 sm:flex-row">

                <div className="group relative">

                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-600"
                  />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama kelas..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 sm:w-64"
                  />

                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                >
                  <option value="all">Semua Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Dipublikasikan</option>
                  <option value="archived">Diarsipkan</option>
                </select>

              </div>

            </div>

          </div>

          {/* Course list */}

          <div className="p-5 sm:p-7">

            {filteredCourses.length === 0 ? (

              <div className="relative flex min-h-[350px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-50 px-5 py-12 text-center">

                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-100/60 blur-3xl" />

                <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-violet-100/60 blur-3xl" />

                <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-violet-100 text-violet-700 shadow-lg shadow-violet-900/5">
                  <BookOpen size={36} />
                </div>

                <h4 className="relative mt-6 text-xl font-extrabold text-slate-800">
                  {courses.length === 0
                    ? "Belum ada kelas"
                    : "Kelas tidak ditemukan"}
                </h4>

                <p className="relative mt-2 max-w-sm text-sm leading-7 text-slate-500">
                  {courses.length === 0
                    ? "Mulai bangun platform pembelajaran dengan menambahkan kelas pertamamu."
                    : "Coba gunakan kata kunci atau status kelas yang berbeda."}
                </p>

                {courses.length === 0 && (
                  <button
                    onClick={openCreate}
                    className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#5B21B6] via-[#6D28D9] to-[#8B5CF6] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-violet-700/25 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <Plus size={19} />
                    Tambah Kelas Pertama
                  </button>
                )}

              </div>

            ) : (

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                {filteredCourses.map((course) => (

                  <article
                    key={course.id}
                    className="group overflow-hidden rounded-[22px] border border-slate-100 bg-white transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_20px_45px_rgba(109,40,217,0.12)]"
                  >

                    {/* Cover */}

                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-100 via-violet-50 to-violet-100">

                      {course.cover_image_url ? (

                        <img
                          src={course.cover_image_url}
                          alt={course.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                        />

                      ) : (

                        <div className="flex h-full items-center justify-center">

                          <div className="flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/70 bg-white/70 text-violet-700 shadow-xl backdrop-blur-md">
                            <ImageIcon size={35} />
                          </div>

                        </div>

                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/10" />

                      <div className="absolute left-4 top-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-lg backdrop-blur-md ${getStatusStyle(course.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {getStatusLabel(course.status)}
                        </span>
                      </div>

                      <div className="absolute right-4 top-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                          <ShieldCheck size={12} />
                          Permanen
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                          Creative Learning
                        </p>
                        <h4 className="mt-1 line-clamp-1 text-xl font-extrabold text-white drop-shadow-md">
                          {course.title}
                        </h4>
                      </div>

                    </div>

                    {/* Card content */}

                    <div className="p-5">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h4 className="text-base font-extrabold leading-6 text-slate-900 transition group-hover:text-violet-800">
                            {course.title}
                          </h4>

                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400">
                            <Link2 size={12} />
                            /{course.slug}
                          </p>

                          {course.category && (
                            <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-800">
                              {course.category}
                            </span>
                          )}

                        </div>

                      </div>

                      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-6 text-slate-500">
                        {course.short_description ||
                          course.description ||
                          "Belum ada deskripsi kelas."}
                      </p>

                      {/* Price */}

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">

                        <div className="min-w-0">

                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <CircleDollarSign size={12} />
                            Harga Kelas
                          </p>

                          <p className="mt-1 text-lg font-extrabold text-violet-800">
                            {formatPrice(course.price)}
                          </p>

                        </div>

                        {/* Actions */}

                        <div className="flex shrink-0 gap-2">

                          <button
                            onClick={() => openEdit(course)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-800 transition hover:border-violet-300 hover:bg-violet-100"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(course)}
                            disabled={deletingId === course.id}
                            className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600 transition hover:border-red-200 hover:bg-red-100 disabled:opacity-50"
                            title="Hapus kelas"
                          >
                            {deletingId === course.id ? (
                              <RefreshCw size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>

                        </div>

                      </div>

                    </div>

                  </article>

                ))}

              </div>

            )}

            {/* Footer list */}

            <div className="mt-7 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center">

              <p>
                Menampilkan{" "}
                <span className="font-extrabold text-slate-700">
                  {filteredCourses.length}
                </span>{" "}
                dari{" "}
                <span className="font-extrabold text-slate-700">
                  {courses.length}
                </span>{" "}
                kelas.
              </p>

              <p className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-violet-600" />
                Data tersimpan di Supabase
              </p>

            </div>

          </div>

        </section>

        {/* Footer */}

        <footer className="mt-10 flex flex-col items-center justify-center gap-2 text-center">

          <div className="flex items-center gap-2 text-sm font-extrabold text-violet-800">
            <GraduationCap size={19} />
            Kiki Creator Class
          </div>

          <p className="text-xs text-slate-400">
            © 2026 Kiki Creator Class. All rights reserved.
          </p>

        </footer>

      </div>

      {/* =====================================
          PREMIUM MODAL CREATE / EDIT
      ===================================== */}

      {modalOpen && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-modal-title"
            className="relative flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-full max-w-[920px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.18)] sm:h-[88dvh] sm:max-h-[calc(100dvh-40px)] sm:rounded-[28px]"
          >

            {/* Modal header */}

            <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#5B21B6] via-[#6D28D9] to-[#8B5CF6] px-5 py-5 text-white sm:px-7 sm:py-6">

              <div className="pointer-events-none absolute -right-10 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />

              <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-violet-200/20 blur-3xl" />

              <div className="relative flex items-center justify-between gap-4">

                <div>

                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-50">
                    <Sparkles size={13} />
                    Course Management
                  </div>

                  <h3
                    id="course-modal-title"
                    className="text-xl font-extrabold tracking-tight sm:text-2xl"
                  >
                    {editingId
                      ? "Edit Informasi Kelas"
                      : "Tambah Kelas Baru"}
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-violet-100 sm:text-sm">
                    Buat pengalaman belajar yang menarik untuk member.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="shrink-0 rounded-2xl bg-white/10 p-3 text-white transition hover:rotate-90 hover:bg-white/20 disabled:opacity-50"
                  aria-label="Tutup modal"
                >
                  <X size={21} />
                </button>

              </div>

            </div>

            {/* Modal form */}

            <form
              onSubmit={handleSave}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >

              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_270px]">

                {/* LEFT: FORM FIELDS */}

                <div className="space-y-6 p-5 sm:p-7">

                  {error && (

                    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                      <X size={18} className="mt-0.5 shrink-0" />

                      <p>{error}</p>

                    </div>

                  )}

                  {/* SECTION: BASIC INFORMATION */}

                  <div>

                    <div className="mb-5 flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <FileText size={20} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Informasi Dasar
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Identitas dan informasi kelas.
                        </p>
                      </div>

                    </div>

                    <div className="space-y-4">

                      {/* Nama kelas */}

                      <div>

                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Nama Kelas <span className="text-red-500">*</span>
                        </label>

                        <div className="group relative">

                          <Type
                            size={17}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-600"
                          />

                          <input
                            required
                            maxLength={150}
                            value={form.title}
                            onChange={(e) => {
                              const title = e.target.value;

                              setForm((previous) => ({
                                ...previous,
                                title,
                                slug: slugManual
                                  ? previous.slug
                                  : makeSlug(title),
                              }));
                            }}
                            placeholder="Contoh: Kelas Microsoft Excel"
                            className="w-full rounded-2xl bg-[#F8F7FC] py-4 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                          />

                        </div>

                      </div>

                      {/* Slug */}

                      <div>

                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Slug URL <span className="text-red-500">*</span>
                        </label>

                        <div className="group flex overflow-hidden rounded-2xl bg-[#F8F7FC] transition hover:bg-[#F6F2FC] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#8B5CF6]/20">

                          <span className="flex items-center bg-[#F3EEFF] px-4 text-sm font-bold text-violet-700">
                            /
                          </span>

                          <input
                            required
                            maxLength={180}
                            value={form.slug}
                            onChange={(e) => {
                              setSlugManual(true);
                              updateForm("slug", makeSlug(e.target.value));
                            }}
                            placeholder="kelas-microsoft-excel"
                            className="w-full bg-transparent px-4 py-4 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                          />

                        </div>

                        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                          <Link2 size={12} />
                          URL kelas dibuat berdasarkan slug ini.
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* SECTION: DESCRIPTION */}

                  <div className="pt-2">

                    <div className="mb-5 flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <AlignLeft size={20} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Deskripsi Pembelajaran
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Jelaskan isi dan manfaat kelas.
                        </p>
                      </div>

                    </div>

                    {/* Ringkasan */}

                    <div>

                      <label className="mb-2 block text-xs font-bold text-slate-700">
                        Ringkasan Kelas
                      </label>

                      <textarea
                        rows={3}
                        maxLength={500}
                        value={form.short_description}
                        onChange={(e) =>
                          updateForm("short_description", e.target.value)
                        }
                        placeholder="Tuliskan ringkasan singkat kelas..."
                        className="w-full resize-none rounded-2xl bg-[#F8F7FC] px-4 py-4 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                      />

                      <p className="mt-1 text-right text-[10px] font-medium text-slate-400">
                        {form.short_description.length}/500 karakter
                      </p>

                    </div>

                    {/* Deskripsi lengkap */}

                    <div className="mt-4">

                      <label className="mb-2 block text-xs font-bold text-slate-700">
                        Deskripsi Lengkap
                      </label>

                      <textarea
                        rows={5}
                        value={form.description}
                        onChange={(e) =>
                          updateForm("description", e.target.value)
                        }
                        placeholder="Jelaskan materi, manfaat, dan tujuan pembelajaran..."
                        className="w-full resize-y rounded-2xl bg-[#F8F7FC] px-4 py-4 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                      />

                    </div>

                  </div>

                  {/* SECTION: COURSE DETAILS AND MENTOR */}

                  <div className="space-y-5 border-t border-slate-100 pt-6">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <GraduationCap size={20} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Detail Program & Mentor
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Informasi tambahan yang tampil pada halaman detail kelas.
                        </p>
                      </div>

                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">

                      <div>
                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Kategori Kelas
                        </label>
                        <div className="group relative">
                          <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600" />
                          <input
                            maxLength={80}
                            value={form.category}
                            onChange={(e) => updateForm("category", e.target.value)}
                            placeholder="Contoh: Desain Grafis"
                            className="w-full rounded-2xl bg-[#F8F7FC] py-3.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Target Peserta
                        </label>
                        <input
                          maxLength={180}
                          value={form.target_audience}
                          onChange={(e) => updateForm("target_audience", e.target.value)}
                          placeholder="Contoh: Pemula hingga menengah"
                          className="w-full rounded-2xl bg-[#F8F7FC] px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                        />
                      </div>

                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-700">
                        Manfaat yang Didapat Peserta
                      </label>
                      <textarea
                        rows={4}
                        value={form.benefits}
                        onChange={(e) => updateForm("benefits", e.target.value)}
                        placeholder={"Tuliskan satu manfaat pada setiap baris.\nContoh: Video pembelajaran Full HD\nFile latihan dan bahan praktik\nAkses materi secara permanen"}
                        className="w-full resize-y rounded-2xl bg-[#F8F7FC] px-4 py-3.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                      />
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        Setiap baris akan disimpan sebagai satu poin manfaat.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                      <div className="mb-4">
                        <h5 className="text-xs font-extrabold text-slate-800">
                          Profil Mentor / Pengajar
                        </h5>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Opsional. Informasi ini dapat ditampilkan di halaman detail kelas.
                        </p>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Nama Mentor
                        </label>
                        <input
                          maxLength={120}
                          value={form.mentor_name}
                          onChange={(e) => updateForm("mentor_name", e.target.value)}
                          placeholder="Nama pengajar atau mentor"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Profil Singkat Mentor
                        </label>
                        <textarea
                          rows={3}
                          value={form.mentor_bio}
                          onChange={(e) => updateForm("mentor_bio", e.target.value)}
                          placeholder="Ceritakan pengalaman atau keahlian mentor secara singkat..."
                          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                        />
                      </div>
                    </div>

                  </div>

                  {/* SECTION: VISUAL */}

                  <div className="pt-2">

                    <div className="mb-5 flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <ImageIcon size={20} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Tampilan Kelas
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Tambahkan gambar cover kelas.
                        </p>
                      </div>

                    </div>

                    <div className="rounded-2xl bg-[#F8F7FC] p-3.5 shadow-[0_4px_16px_rgba(109,40,217,0.045)] sm:p-4">

                      {previewCoverUrl ? (

                        <div className="relative overflow-hidden rounded-xl bg-white shadow-sm">

                          <img
                            src={previewCoverUrl}
                            alt="Preview cover kelas"
                            className="h-40 w-full object-cover sm:h-48"
                          />

                          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-3 pt-8">

                            <span className="text-[10px] font-semibold text-white">
                              Preview foto kelas
                            </span>

                            <div className="flex items-center gap-2">

                              <label
                                htmlFor="course-cover-upload"
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold text-violet-800 shadow-sm transition hover:bg-white"
                              >
                                <ImagePlus size={13} />
                                Ganti Foto
                              </label>

                              <button
                                type="button"
                                onClick={clearCoverImage}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/95 px-3 py-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-red-600"
                              >
                                <Trash2 size={13} />
                                Hapus
                              </button>

                            </div>

                          </div>

                        </div>

                      ) : (

                        <label
                          htmlFor="course-cover-upload"
                          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl bg-white px-4 py-7 text-center shadow-sm transition hover:bg-violet-50/70 sm:min-h-48"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <UploadCloud size={24} />
                          </span>

                          <span className="mt-3 text-xs font-extrabold text-slate-800">
                            Pilih foto dari perangkat
                          </span>

                          <span className="mt-1 text-[10px] text-slate-400">
                            Klik untuk memilih gambar cover kelas
                          </span>

                          <span className="mt-3 rounded-full bg-violet-50 px-3 py-1.5 text-[9px] font-bold text-violet-700">
                            JPG · PNG · WebP · Maks. 5 MB
                          </span>
                        </label>

                      )}

                      {/* Keep the native picker out of the scroll flow.
                          A visually-hidden focused input can force the modal
                          to jump to the upload field after file selection. */}
                      <input
                        id="course-cover-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleCoverFileChange}
                        className="hidden"
                      />

                      {coverFile && (
                        <p className="mt-2 truncate text-[10px] font-medium text-violet-700">
                          File dipilih: {coverFile.name}
                        </p>
                      )}

                    </div>

                    <div className="mt-3">

                      <label className="mb-2 block text-[11px] font-bold text-slate-600">
                        Atau gunakan URL gambar (opsional)
                      </label>

                      <div className="group relative">

                        <ImageIcon
                          size={17}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-600"
                        />

                        <input
                          type="url"
                          value={form.cover_image_url}
                          onChange={(e) => handleCoverUrlChange(e.target.value)}
                          placeholder="https://example.com/cover.jpg"
                          className="w-full rounded-2xl bg-[#F8F7FC] py-3.5 pl-11 pr-4 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20 sm:text-sm"
                        />

                      </div>

                      <p className="mt-2 text-[10px] leading-5 text-slate-400">
                        Upload foto langsung atau masukkan URL gambar yang sudah tersedia.
                      </p>

                    </div>

                  </div>

                  {/* SECTION: PRICE AND STATUS */}

                  <div className="pt-2">

                    <div className="mb-5 flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <Tag size={20} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Harga dan Status
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Atur harga dan publikasi kelas.
                        </p>
                      </div>

                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">

                      {/* Price */}

                      <div>

                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Harga Kelas (Rupiah) *
                        </label>

                        <div className="flex overflow-hidden rounded-2xl bg-[#F8F7FC] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#8B5CF6]/20">

                          <span className="flex items-center bg-[#F3EEFF] px-4 text-xs font-extrabold text-violet-700">
                            Rp
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={form.price}
                            onChange={(e) =>
                              updateForm("price", e.target.value)
                            }
                            className="w-full min-w-0 bg-transparent px-3 py-4 text-sm font-bold text-slate-800 outline-none"
                          />

                        </div>

                      </div>

                      {/* Status */}

                      <div>

                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          Status Kelas
                        </label>

                        <select
                          value={form.status}
                          onChange={(e) =>
                            updateForm(
                              "status",
                              e.target.value as CourseStatus
                            )
                          }
                          className="w-full cursor-pointer rounded-2xl bg-[#F8F7FC] px-4 py-4 text-sm font-semibold text-slate-700 outline-none transition hover:bg-[#F6F2FC] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Dipublikasikan</option>
                          <option value="archived">Diarsipkan</option>
                        </select>

                      </div>

                    </div>

                  </div>

                  {/* ACCESS INFORMATION */}

                  <div className="relative overflow-hidden rounded-2xl bg-[#F8F6FD] p-5 shadow-[0_6px_20px_rgba(109,40,217,0.05)]">

                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />

                    <div className="relative flex items-start gap-3">

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-md shadow-violet-900/5">
                        <ShieldCheck size={22} />
                      </div>

                      <div>

                        <p className="text-sm font-extrabold text-violet-900">
                          Jenis Akses: Permanen
                        </p>

                        <p className="mt-1 text-xs leading-6 text-violet-700">
                          Member yang memperoleh akses kelas dapat
                          mengikuti konfigurasi akses permanen
                          sesuai pengaturan database.
                        </p>

                      </div>

                    </div>

                  </div>

                </div>

                {/* RIGHT: LIVE PREVIEW */}

                <aside className="bg-[#FAF9FF] p-5 sm:p-6 lg:p-5">

                  <div className="sticky top-0">

                    <div className="mb-5 flex items-center gap-2">

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Eye size={18} />
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Live Preview
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Tampilan kartu kelas.
                        </p>
                      </div>

                    </div>

                    {/* Preview card */}

                    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(109,40,217,0.09)]">

                      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#5B21B6] via-[#6D28D9] to-[#8B5CF6]">

                        {previewCoverUrl ? (

                          <img
                            src={previewCoverUrl}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />

                        ) : (

                          <div className="flex h-full items-center justify-center">
                            <BookOpen
                              size={48}
                              className="text-white/70"
                            />
                          </div>

                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-violet-800">
                          {getStatusLabel(form.status)}
                        </span>

                      </div>

                      <div className="p-4">

                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">
                          <GraduationCap size={13} />
                          Creative Learning
                        </div>

                        {form.category && (
                          <span className="mt-3 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-800">
                            {form.category}
                          </span>
                        )}

                        <h5 className="mt-3 line-clamp-2 text-base font-extrabold leading-6 text-slate-900">
                          {form.title || "Nama kelas kamu"}
                        </h5>

                        <p className="mt-2 line-clamp-3 min-h-[60px] text-xs leading-5 text-slate-500">
                          {form.short_description ||
                            "Ringkasan kelas akan ditampilkan di sini."}
                        </p>

                        {form.mentor_name && (
                          <p className="mt-3 text-[11px] font-semibold text-slate-500">
                            Mentor: <span className="text-slate-800">{form.mentor_name}</span>
                          </p>
                        )}

                        <div className="mt-4 border-t border-slate-100 pt-4">

                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Harga Kelas
                          </p>

                          <p className="mt-1 text-xl font-extrabold text-violet-700">
                            {formatPrice(form.price || "0")}
                          </p>

                        </div>

                      </div>

                    </div>

                    {/* Preview information */}

                    <div className="mt-5 space-y-3">

                      <div className="flex items-center gap-3 rounded-xl bg-white/90 p-3 shadow-[0_4px_14px_rgba(109,40,217,0.05)]">

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                          <ShieldCheck size={17} />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Akses Permanen
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Akses sesuai konfigurasi database.
                          </p>
                        </div>

                      </div>

                      <div className="flex items-center gap-3 rounded-xl bg-white/90 p-3 shadow-[0_4px_14px_rgba(109,40,217,0.05)]">

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                          <LayoutGrid size={17} />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Sistem Kelas Dinamis
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Materi dapat dikelola setelah kelas dibuat.
                          </p>
                        </div>

                      </div>

                    </div>

                    <div className="mt-5 rounded-xl bg-[#6D28D9] p-4 text-white shadow-[0_8px_20px_rgba(109,40,217,0.12)]">

                      <div className="flex items-center gap-2">
                        <Sparkles size={16} />
                        <p className="text-xs font-bold">
                          Kiki Creator Class
                        </p>
                      </div>

                      <p className="mt-2 text-[10px] leading-5 text-violet-50">
                        Bangun pengalaman belajar yang lebih menarik
                        dan profesional.
                      </p>

                    </div>

                  </div>

                </aside>

              </div>

              {/* STICKY FOOTER */}

              <div className="flex shrink-0 flex-col-reverse gap-3 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between sm:px-7">

                <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                  * Pastikan informasi kelas sudah benar.
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21B6] via-[#6D28D9] to-[#8B5CF6] px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-700/25 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {saving ? (
                      <RefreshCw size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}

                    {saving
                      ? "Menyimpan..."
                      : editingId
                        ? "Simpan Perubahan"
                        : "Tambah Kelas"}

                  </button>

                </div>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}
