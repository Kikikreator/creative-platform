
"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Plus,
  Layers3,
  PlayCircle,
  Pencil,
  Trash2,
  Search,
  X,
  Save,
  RefreshCw,
  Clock3,
  Eye,
  FileText,
  Video,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  ListPlus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  File,
  Music,
  Link2,
  Type,
  MessageSquare,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

export type CourseOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  cover_image_url: string | null;
  price: number | string;
};

type Section = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
};

type LessonContentKind = "video" | "text" | "link" | "pdf" | "info";

type Lesson = {
  id: string;
  section_id: string;
  title: string;
  content: string | null;
  video_provider: string;
  video_url: string | null;
  resource_path: string | null;
  duration_minutes: number | null;
  is_preview: boolean;
  status: "draft" | "published";
  position: number;
  created_at: string;
  updated_at: string;
};

type LessonContentType =
  | "text"
  | "tiktok"
  | "youtube"
  | "image"
  | "pdf"
  | "audio"
  | "link"
  | "callout";

type LessonContent = {
  id: string;
  lesson_id: string;
  title: string;
  content_type: LessonContentType;
  body: string | null;
  media_url: string | null;
  resource_path: string | null;
  link_url: string | null;
  link_label: string | null;
  settings: Record<string, unknown> | null;
  position: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

type ContentDisplaySettings = {
  text_align: "left" | "center";
  text_size: "normal" | "large";
  youtube_ratio: "16:9" | "9:16";
  youtube_controls: boolean;
  image_fit: "contain" | "cover";
  image_height: "compact" | "medium" | "large";
  pdf_display: "preview" | "button";
  pdf_height: "compact" | "medium" | "large";
  callout_variant: "info" | "success" | "warning";
};

type ContentForm = {
  title: string;
  content_type: LessonContentType;
  body: string;
  media_url: string;
  resource_path: string;
  link_url: string;
  link_label: string;
  settings: ContentDisplaySettings;
  status: "draft" | "published";
};

type SectionForm = {
  title: string;
  description: string;
};

type LessonForm = {
  title: string;
  content: string;
  content_type: LessonContentKind;
  video_provider: string;
  video_url: string;
  duration_minutes: string;
  is_preview: boolean;
  status: "draft" | "published";
};

// ==========================================
// CONFIGURATION
// ==========================================

const sectionFields =
  "id, course_id, title, description, position, created_at";

const lessonFields =
  "id, section_id, title, content, video_provider, video_url, resource_path, duration_minutes, is_preview, status, position, created_at, updated_at";

const lessonContentFields =
  "id, lesson_id, title, content_type, body, media_url, resource_path, link_url, link_label, settings, position, status, created_at, updated_at";

/**
 * TikTok's embeddable player needs the numeric video ID.
 * Canonical links such as /@creator/video/123... are supported.
 * Short share links are accepted as links, but cannot be previewed
 * until they are replaced with the canonical video URL.
 */
function getTikTokVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    if (
      ![
        "tiktok.com",
        "m.tiktok.com",
        "vm.tiktok.com",
        "vt.tiktok.com",
      ].includes(hostname)
    ) {
      return null;
    }

    const patterns = [
      /\/video\/(\d+)/,
      /\/embed\/v2\/(\d+)/,
      /^\/v\/(\d+)\.html$/,
    ];

    for (const pattern of patterns) {
      const match = url.pathname.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

function isTikTokUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    return (
      ["https:", "http:"].includes(url.protocol) &&
      [
        "tiktok.com",
        "m.tiktok.com",
        "vm.tiktok.com",
        "vt.tiktok.com",
      ].includes(hostname)
    );
  } catch {
    return false;
  }
}

const emptySection: SectionForm = {
  title: "",
  description: "",
};

const emptyLesson: LessonForm = {
  title: "",
  content: "",
  content_type: "video",
  video_provider: "youtube",
  video_url: "",
  duration_minutes: "0",
  is_preview: false,
  status: "draft",
};

const defaultContentDisplaySettings: ContentDisplaySettings = {
  text_align: "left",
  text_size: "normal",
  youtube_ratio: "16:9",
  youtube_controls: true,
  image_fit: "contain",
  image_height: "medium",
  pdf_display: "preview",
  pdf_height: "medium",
  callout_variant: "info",
};

const emptyContent: ContentForm = {
  title: "",
  content_type: "text",
  body: "",
  media_url: "",
  resource_path: "",
  link_url: "",
  link_label: "",
  settings: { ...defaultContentDisplaySettings },
  status: "draft",
};

function getContentDisplaySettings(
  settings: Record<string, unknown> | null | undefined
): ContentDisplaySettings {
  const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
    typeof value === "string" && options.includes(value as T)
      ? (value as T)
      : fallback;

  return {
    text_align: pick(settings?.text_align, ["left", "center"], "left"),
    text_size: pick(settings?.text_size, ["normal", "large"], "normal"),
    youtube_ratio: pick(settings?.youtube_ratio, ["16:9", "9:16"], "16:9"),
    youtube_controls:
      typeof settings?.youtube_controls === "boolean"
        ? settings.youtube_controls
        : true,
    image_fit: pick(settings?.image_fit, ["contain", "cover"], "contain"),
    image_height: pick(
      settings?.image_height,
      ["compact", "medium", "large"],
      "medium"
    ),
    pdf_display: pick(settings?.pdf_display, ["preview", "button"], "preview"),
    pdf_height: pick(
      settings?.pdf_height,
      ["compact", "medium", "large"],
      "medium"
    ),
    callout_variant: pick(
      settings?.callout_variant,
      ["info", "success", "warning"],
      "info"
    ),
  };
}

// ==========================================
// HELPERS
// ==========================================

function statusLabel(status: string) {
  return status === "published" ? "Dipublikasikan" : "Draft";
}

function statusStyle(status: string) {
  return status === "published"
    ? "border-violet-100 bg-violet-50 text-violet-700"
    : "border-amber-100 bg-amber-50 text-amber-700";
}

function createEntityId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getLessonContentKind(provider: string | null | undefined): LessonContentKind {
  const value = (provider ?? "").toLowerCase();
  return (["text", "link", "pdf", "info"] as const).includes(value as never)
    ? (value as LessonContentKind)
    : "video";
}

function lessonContentKindLabel(kind: LessonContentKind) {
  const labels: Record<LessonContentKind, string> = {
    video: "Video Pembelajaran",
    text: "Materi Teks",
    link: "Link Eksternal",
    pdf: "Dokumen PDF",
    info: "Informasi",
  };
  return labels[kind];
}


function contentTypeLabel(type: LessonContentType) {
  const labels: Record<LessonContentType, string> = {
    text: "Teks",
    tiktok: "Video pendek",
    youtube: "YouTube",
    image: "Gambar",
    pdf: "PDF / Dokumen",
    audio: "Audio",
    link: "Tautan",
    callout: "Catatan penting",
  };

  return labels[type];
}

function contentTypeIcon(type: LessonContentType) {
  const icons = {
    text: Type,
    tiktok: Video,
    youtube: PlayCircle,
    image: ImageIcon,
    pdf: File,
    audio: Music,
    link: Link2,
    callout: MessageSquare,
  };

  return icons[type];
}

const LEARNING_RESOURCE_BUCKET = "learning-resources";
const MAX_CONTENT_FILE_SIZE = 20 * 1024 * 1024;

const CONTENT_FILE_RULES = {
  image: {
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    label: "JPG, PNG, atau WebP",
  },
  pdf: {
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    accept: ".pdf,application/pdf",
    label: "PDF",
  },
  audio: {
    extensions: ["mp3", "wav", "ogg"],
    mimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "application/ogg"],
    accept: ".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg",
    label: "MP3, WAV, atau OGG",
  },
} as const;

type UploadableContentType = keyof typeof CONTENT_FILE_RULES;

function isUploadableContentType(
  type: LessonContentType
): type is UploadableContentType {
  return type === "image" || type === "pdf" || type === "audio";
}

function validateContentFile(
  file: File,
  type: LessonContentType
): string | null {
  if (!isUploadableContentType(type)) return null;

  if (file.size > MAX_CONTENT_FILE_SIZE) {
    return "Ukuran file maksimal 20 MB.";
  }

  const rule = CONTENT_FILE_RULES[type];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!rule.extensions.includes(extension as never)) {
    return `Format file tidak sesuai. Gunakan ${rule.label}.`;
  }

  const normalizedMime = file.type.toLowerCase();
  if (
    normalizedMime &&
    normalizedMime !== "application/octet-stream" &&
    !rule.mimeTypes.includes(normalizedMime as never)
  ) {
    return `Tipe file tidak sesuai. Gunakan ${rule.label}.`;
  }

  return null;
}

function sanitizeStorageFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned || "materi";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isStorageObjectPath(value: string | null | undefined) {
  const clean = value?.trim() ?? "";
  if (!clean) return false;
  if (/^https?:\/\//i.test(clean)) return false;
  if (clean.startsWith("/")) return false;
  return true;
}

function getStoredFileName(item: LessonContent) {
  const settings = item.settings;
  const storedName = settings && typeof settings.file_name === "string"
    ? settings.file_name
    : "";

  if (storedName) return storedName;
  return item.resource_path?.split("/").filter(Boolean).pop() ?? "File tersimpan";
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function MateriManager({
  courses,
  initialCourseId,
  initialError,
}: {
  courses: CourseOption[];
  initialCourseId: string | null;
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);

  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    if (initialCourseId && courses.some((c) => c.id === initialCourseId)) {
      return initialCourseId;
    }

    return courses[0]?.id ?? "";
  });

  const loadRequestRef = useRef(0);

  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonContents, setLessonContents] = useState<LessonContent[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState("");

  const [sectionModal, setSectionModal] = useState(false);
  const [lessonModal, setLessonModal] = useState(false);
  const [contentModal, setContentModal] = useState(false);
  const [contentEditorOpen, setContentEditorOpen] = useState(false);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const [activeSectionId, setActiveSectionId] = useState("");
  const [activeLessonId, setActiveLessonId] = useState("");
  const [editingContentId, setEditingContentId] = useState<string | null>(null);

  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySection);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLesson);
  const [selectedLessonPdf, setSelectedLessonPdf] = useState<File | null>(null);
  const [existingLessonPdfName, setExistingLessonPdfName] = useState("");
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContent);

  const [contentSaving, setContentSaving] = useState(false);
  const [contentError, setContentError] = useState("");
  const [selectedContentFile, setSelectedContentFile] = useState<File | null>(null);
  const [existingContentFileName, setExistingContentFileName] = useState("");
  const [draggedContentId, setDraggedContentId] = useState<string | null>(null);
  const [reorderingContent, setReorderingContent] = useState(false);
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [reorderingLessons, setReorderingLessons] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // ========================================
  // SELECTED COURSE
  // ========================================

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  );

  // ========================================
  // LOAD SECTIONS AND LESSONS
  // ========================================

  const loadContent = useCallback(async () => {
    const requestId = ++loadRequestRef.current;

    if (!selectedCourseId) {
      setSections([]);
      setLessons([]);
      setLessonContents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from("course_sections")
        .select(sectionFields)
        .eq("course_id", selectedCourseId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (sectionError) throw sectionError;

      // Abaikan hasil request lama jika pengguna sudah memilih kelas lain.
      if (requestId !== loadRequestRef.current) return;

      const loadedSections = (sectionData ?? []) as Section[];

      setSections(loadedSections);

      if (loadedSections.length === 0) {
        setLessons([]);
        setLessonContents([]);
        return;
      }

      const sectionIds = loadedSections.map((section) => section.id);

      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select(lessonFields)
        .in("section_id", sectionIds)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (lessonError) throw lessonError;

      if (requestId !== loadRequestRef.current) return;

      const loadedLessons = (lessonData ?? []) as Lesson[];
      setLessons(loadedLessons);

      if (loadedLessons.length === 0) {
        setLessonContents([]);
        return;
      }

      const lessonIds = loadedLessons.map((lesson) => lesson.id);

      const { data: contentData, error: contentError } = await supabase
        .from("lesson_contents")
        .select(lessonContentFields)
        .in("lesson_id", lessonIds)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (contentError) throw contentError;

      if (requestId !== loadRequestRef.current) return;

      setLessonContents((contentData ?? []) as LessonContent[]);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat materi pembelajaran."
      );

      setSections([]);
      setLessons([]);
      setLessonContents([]);
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [selectedCourseId, supabase]);

  useEffect(() => {
    void loadContent();

    return () => {
      // Membatalkan hak request sebelumnya untuk memperbarui state.
      loadRequestRef.current += 1;
    };
  }, [loadContent]);

  // ========================================
  // STATISTICS
  // ========================================

  const stats = useMemo(() => ({
    sections: sections.length,
    lessons: lessons.length,
    published: lessons.filter((l) => l.status === "published").length,
    previews: lessons.filter((l) => l.is_preview).length,
    miniContents: lessonContents.length,
  }), [sections, lessons, lessonContents]);

  // ========================================
  // FILTER
  // ========================================

  const visibleSections = useMemo(() => {
    if (!search.trim()) return sections;

    const keyword = search.toLowerCase();

    return sections
      .map((section) => ({
        ...section,
        filteredLessons: lessons.filter(
          (lesson) =>
            lesson.section_id === section.id &&
            lesson.title.toLowerCase().includes(keyword)
        ),
      }))
      .filter(
        (section) =>
          section.title.toLowerCase().includes(keyword) ||
          section.filteredLessons.length > 0
      );
  }, [sections, lessons, search]);

  // ========================================
  // SECTION MODAL
  // ========================================

  function openCreateSection() {
    setEditingSectionId(null);
    setSectionForm(emptySection);
    setError("");
    setSectionModal(true);
  }

  function openEditSection(section: Section) {
    setEditingSectionId(section.id);

    setSectionForm({
      title: section.title,
      description: section.description ?? "",
    });

    setError("");
    setSectionModal(true);
  }

  function closeSectionModal() {
    if (saving) return;

    setSectionModal(false);
    setEditingSectionId(null);
    setSectionForm(emptySection);
  }

  // ========================================
  // SAVE SECTION
  // ========================================

  async function handleSaveSection(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedCourseId) {
      setError("Pilih kelas terlebih dahulu.");
      return;
    }

    const title = sectionForm.title.trim();

    if (!title) {
      setError("Nama bab wajib diisi.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const oldSection = sections.find(
        (section) => section.id === editingSectionId
      );

      const position = oldSection
        ? oldSection.position
        : Math.max(-1, ...sections.map((s) => s.position)) + 1;

      const payload = {
        title,
        description: sectionForm.description.trim() || null,
        position,
      };

      if (editingSectionId) {
        const { error: dbError } = await supabase
          .from("course_sections")
          .update(payload)
          .eq("id", editingSectionId);

        if (dbError) throw dbError;

        setSuccess("Bab berhasil diperbarui.");
      } else {
        const { error: dbError } = await supabase
          .from("course_sections")
          .insert({
            ...payload,
            course_id: selectedCourseId,
          });

        if (dbError) throw dbError;

        setSuccess("Bab baru berhasil ditambahkan.");
      }

      setSectionModal(false);
      setEditingSectionId(null);
      setSectionForm(emptySection);

      await loadContent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan bab."
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DELETE SECTION
  // ========================================

  async function handleDeleteSection(section: Section) {
    const confirmed = await confirmDialog({
      title: "Hapus Bab?",
      message: `Hapus bab "${section.title}"?\n\nTindakan ini tidak dapat dibatalkan. Materi di dalam bab dapat ikut terhapus sesuai aturan relasi database.`,
      confirmLabel: "Ya, hapus Bab",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(section.id);
    setError("");
    setSuccess("");

    try {
      const { error: dbError } = await supabase
        .from("course_sections")
        .delete()
        .eq("id", section.id);

      if (dbError) throw dbError;

      setSuccess("Bab berhasil dihapus.");
      await loadContent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus bab."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ========================================
  // LESSON MODAL
  // ========================================

  function openCreateLesson(sectionId: string) {
    setActiveSectionId(sectionId);
    setEditingLessonId(null);
    setLessonForm(emptyLesson);
    setSelectedLessonPdf(null);
    setExistingLessonPdfName("");
    setError("");
    setLessonModal(true);
  }

  function openEditLesson(lesson: Lesson) {
    setActiveSectionId(lesson.section_id);
    setEditingLessonId(lesson.id);

    const contentType = getLessonContentKind(lesson.video_provider);
    setLessonForm({
      title: lesson.title,
      content: lesson.content ?? "",
      content_type: contentType,
      video_provider: contentType === "video" ? (lesson.video_provider || "youtube") : "youtube",
      video_url: lesson.video_url ?? "",
      duration_minutes: String(lesson.duration_minutes ?? 0),
      is_preview: lesson.is_preview,
      status: lesson.status,
    });
    setSelectedLessonPdf(null);
    setExistingLessonPdfName(contentType === "pdf" ? (lesson.resource_path?.split("/").filter(Boolean).pop() ?? "File PDF tersimpan") : "");

    setError("");
    setLessonModal(true);
  }

  function closeLessonModal() {
    if (saving) return;

    setLessonModal(false);
    setEditingLessonId(null);
    setActiveSectionId("");
    setLessonForm(emptyLesson);
    setSelectedLessonPdf(null);
    setExistingLessonPdfName("");
  }

  // ========================================
  // SAVE LESSON
  // ========================================

  async function handleSaveLesson(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const title = lessonForm.title.trim();
    const content = lessonForm.content.trim();
    const contentType = lessonForm.content_type;
    const duration = Number(lessonForm.duration_minutes);
    const mediaUrl = lessonForm.video_url.trim();

    if (!title) {
      setError("Judul materi wajib diisi.");
      return;
    }
    if (["text", "info"].includes(contentType) && !content) {
      setError(contentType === "info" ? "Isi informasi wajib diisi." : "Isi materi teks wajib diisi.");
      return;
    }
    if (["video", "link"].includes(contentType) && !mediaUrl) {
      setError(contentType === "link" ? "URL tujuan wajib diisi." : "URL video wajib diisi.");
      return;
    }
    if (contentType === "video" && (!Number.isSafeInteger(duration) || duration < 0)) {
      setError("Durasi harus berupa angka bulat 0 atau lebih.");
      return;
    }
    const existingLesson = lessons.find((lesson) => lesson.id === editingLessonId);
    const existingLessonKind = getLessonContentKind(existingLesson?.video_provider);
    if (contentType === "pdf" && !selectedLessonPdf && !(existingLessonKind === "pdf" && existingLesson?.resource_path)) {
      setError("Pilih file PDF terlebih dahulu.");
      return;
    }
    if (selectedLessonPdf) {
      const extension = selectedLessonPdf.name.split(".").pop()?.toLowerCase();
      if (extension !== "pdf" || (selectedLessonPdf.type && !["application/pdf", "application/octet-stream"].includes(selectedLessonPdf.type))) {
        setError("File harus berformat PDF.");
        return;
      }
      if (selectedLessonPdf.size > 20 * 1024 * 1024) {
        setError("Ukuran PDF maksimal 20 MB.");
        return;
      }
    }
    if (!activeSectionId) {
      setError("Bab materi tidak ditemukan.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    let newlyUploadedPath: string | null = null;
    let databaseSaved = false;

    try {
      const oldLesson = lessons.find((lesson) => lesson.id === editingLessonId);
      const lessonId = editingLessonId ?? createEntityId();
      const sectionLessons = lessons.filter((lesson) => lesson.section_id === activeSectionId);
      const position = oldLesson
        ? oldLesson.position
        : Math.max(-1, ...sectionLessons.map((l) => l.position)) + 1;

      let nextResourcePath: string | null = null;
      const oldContentType = getLessonContentKind(oldLesson?.video_provider);
      if (contentType === "pdf") {
        nextResourcePath = oldContentType === "pdf" ? (oldLesson?.resource_path ?? null) : null;
        if (selectedLessonPdf) {
          const safeName = sanitizeStorageFileName(selectedLessonPdf.name);
          const uniqueId = createEntityId();
          newlyUploadedPath = `courses/${selectedCourseId}/lessons/${lessonId}/${uniqueId}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from(LEARNING_RESOURCE_BUCKET)
            .upload(newlyUploadedPath, selectedLessonPdf, {
              cacheControl: "3600",
              contentType: "application/pdf",
              upsert: false,
            });
          if (uploadError) throw new Error(`Gagal mengunggah PDF: ${uploadError.message}`);
          nextResourcePath = newlyUploadedPath;
        }
      } else if (contentType === "video" && oldContentType === "video") {
        // Pertahankan resource_path lama untuk materi video lama yang memakai file Storage.
        nextResourcePath = oldLesson?.resource_path ?? null;
      }

      const payload = {
        id: lessonId,
        section_id: activeSectionId,
        title,
        content: content || null,
        video_provider: contentType === "video" ? lessonForm.video_provider : contentType,
        video_url: ["video", "link"].includes(contentType) ? mediaUrl || null : null,
        resource_path: nextResourcePath,
        duration_minutes: contentType === "video" ? duration : 0,
        is_preview: lessonForm.is_preview,
        status: lessonForm.status,
        position,
        updated_at: new Date().toISOString(),
      };

      if (editingLessonId) {
        const { error: dbError } = await supabase
          .from("lessons")
          .update(payload)
          .eq("id", editingLessonId);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from("lessons")
          .insert(payload);
        if (dbError) throw dbError;
      }

      databaseSaved = true;

      let successMessage = editingLessonId
        ? "Materi berhasil diperbarui."
        : "Materi baru berhasil ditambahkan.";
      if (
        oldLesson?.resource_path &&
        oldLesson.resource_path !== nextResourcePath &&
        isStorageObjectPath(oldLesson.resource_path)
      ) {
        const { error: removeError } = await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .remove([oldLesson.resource_path]);
        if (removeError) successMessage += " File lama belum berhasil dibersihkan dari Storage.";
      }
      setSuccess(successMessage);
      setLessonModal(false);
      setEditingLessonId(null);
      setLessonForm(emptyLesson);
      setSelectedLessonPdf(null);
      setExistingLessonPdfName("");
      await loadContent();
    } catch (err) {
      if (newlyUploadedPath && !databaseSaved) {
        await supabase.storage.from(LEARNING_RESOURCE_BUCKET).remove([newlyUploadedPath]);
      }
      setError(err instanceof Error ? err.message : "Gagal menyimpan materi.");
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DELETE LESSON
  // ========================================

  async function handleDeleteLesson(lesson: Lesson) {
    const confirmed = await confirmDialog({
      title: "Hapus Materi Inti?",
      message: `Hapus materi "${lesson.title}"?`,
      confirmLabel: "Ya, hapus materi",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(lesson.id);
    setError("");
    setSuccess("");

    try {
      const { error: dbError } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lesson.id);

      if (dbError) throw dbError;

      if (lesson.resource_path && isStorageObjectPath(lesson.resource_path)) {
        const { error: storageError } = await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .remove([lesson.resource_path]);
        if (storageError) {
          setSuccess("Materi berhasil dihapus, tetapi file lama belum berhasil dibersihkan dari Storage.");
        } else {
          setSuccess("Materi berhasil dihapus.");
        }
      } else {
        setSuccess("Materi berhasil dihapus.");
      }
      await loadContent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus materi."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ========================================
  // MINI CONTENT MANAGER
  // ========================================

  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId);

  const activeLessonContents = lessonContents
    .filter((item) => item.lesson_id === activeLessonId)
    .sort((a, b) => a.position - b.position);

  function openContentManager(lesson: Lesson) {
    setActiveLessonId(lesson.id);
    setEditingContentId(null);
    setContentForm(emptyContent);
    setSelectedContentFile(null);
    setExistingContentFileName("");
    setContentError("");
    setContentEditorOpen(false);
    setContentModal(true);
  }

  function openCreateContent() {
    setEditingContentId(null);
    setContentForm(emptyContent);
    setSelectedContentFile(null);
    setExistingContentFileName("");
    setContentError("");
    setContentEditorOpen(true);
  }

  function openEditContent(item: LessonContent) {
    setEditingContentId(item.id);
    setContentForm({
      title: item.title,
      content_type: item.content_type,
      body: item.body ?? "",
      media_url: item.media_url ?? "",
      resource_path: item.resource_path ?? "",
      link_url: item.link_url ?? "",
      link_label: item.link_label ?? "",
      settings: getContentDisplaySettings(item.settings),
      status: item.status,
    });
    setSelectedContentFile(null);
    setExistingContentFileName(
      isUploadableContentType(item.content_type) && item.resource_path
        ? getStoredFileName(item)
        : ""
    );
    setContentError("");
    setContentEditorOpen(true);
  }

  function closeContentModal() {
    if (contentSaving || reorderingContent) return;

    setContentModal(false);
    setContentEditorOpen(false);
    setActiveLessonId("");
    setEditingContentId(null);
    setContentForm(emptyContent);
    setSelectedContentFile(null);
    setExistingContentFileName("");
    setContentError("");
    setDraggedContentId(null);
  }

  async function handleSaveContent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const title = contentForm.title.trim();
    const body = contentForm.body.trim();
    const mediaUrl = contentForm.media_url.trim();
    const resourcePath = contentForm.resource_path.trim();
    const linkUrl = contentForm.link_url.trim();

    if (!activeLessonId) {
      setContentError("Materi inti tidak ditemukan.");
      return;
    }

    if (!title) {
      setContentError("Judul mini materi wajib diisi.");
      return;
    }

    if (
      (contentForm.content_type === "text" ||
        contentForm.content_type === "callout") &&
      !body
    ) {
      setContentError("Isi mini materi wajib diisi.");
      return;
    }

    if (
      ["tiktok", "youtube"].includes(contentForm.content_type) &&
      !mediaUrl
    ) {
      setContentError("URL video wajib diisi.");
      return;
    }

    if (
      contentForm.content_type === "tiktok" &&
      !isTikTokUrl(mediaUrl)
    ) {
      setContentError(
        "Masukkan URL TikTok yang valid, misalnya https://www.tiktok.com/@akun/video/..."
      );
      return;
    }

    if (
      isUploadableContentType(contentForm.content_type) &&
      !selectedContentFile &&
      !mediaUrl &&
      !resourcePath
    ) {
      setContentError("Pilih file dari perangkat atau masukkan URL file eksternal.");
      return;
    }

    if (selectedContentFile) {
      const fileError = validateContentFile(
        selectedContentFile,
        contentForm.content_type
      );

      if (fileError) {
        setContentError(fileError);
        return;
      }
    }

    if (contentForm.content_type === "link" && !linkUrl) {
      setContentError("URL tautan wajib diisi.");
      return;
    }

    setContentSaving(true);
    setContentError("");
    setError("");
    setSuccess("");

    let newlyUploadedPath: string | null = null;
    let databaseSaved = false;

    try {
      const oldItem = lessonContents.find(
        (item) => item.id === editingContentId
      );

      const position = oldItem
        ? oldItem.position
        : Math.max(-1, ...activeLessonContents.map((item) => item.position)) + 1;

      let nextResourcePath = resourcePath || null;

      if (selectedContentFile) {
        const safeFileName = sanitizeStorageFileName(selectedContentFile.name);
        const uniqueId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        newlyUploadedPath =
          `courses/${selectedCourseId}/lessons/${activeLessonId}/` +
          `${uniqueId}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .upload(newlyUploadedPath, selectedContentFile, {
            cacheControl: "3600",
            contentType: selectedContentFile.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Gagal mengunggah file: ${uploadError.message}`);
        }

        nextResourcePath = newlyUploadedPath;
      }

      const oldSettings = oldItem?.settings ?? {};
      const {
        file_name: oldFileName,
        file_size: oldFileSize,
        mime_type: oldMimeType,
        ...oldDisplaySettings
      } = oldSettings;

      const nextSettings: Record<string, unknown> = {
        ...oldDisplaySettings,
        ...contentForm.settings,
        ...(nextResourcePath
          ? {
              ...(typeof oldFileName === "string" ? { file_name: oldFileName } : {}),
              ...(typeof oldFileSize === "number" ? { file_size: oldFileSize } : {}),
              ...(typeof oldMimeType === "string" ? { mime_type: oldMimeType } : {}),
              ...(selectedContentFile
                ? {
                    file_name: selectedContentFile.name,
                    file_size: selectedContentFile.size,
                    mime_type: selectedContentFile.type || null,
                  }
                : {}),
            }
          : {}),
      };

      const payload = {
        lesson_id: activeLessonId,
        title,
        content_type: contentForm.content_type,
        body: body || null,
        media_url: selectedContentFile ? null : mediaUrl || null,
        resource_path: nextResourcePath,
        link_url: linkUrl || null,
        link_label: contentForm.link_label.trim() || null,
        settings: nextSettings,
        position,
        status: contentForm.status,
        updated_at: new Date().toISOString(),
      };

      if (editingContentId) {
        const { error: dbError } = await supabase
          .from("lesson_contents")
          .update(payload)
          .eq("id", editingContentId);

        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from("lesson_contents")
          .insert(payload);

        if (dbError) throw dbError;
      }

      databaseSaved = true;

      let successMessage = editingContentId
        ? "Mini materi berhasil diperbarui."
        : "Mini materi berhasil ditambahkan.";

      if (
        oldItem?.resource_path &&
        oldItem.resource_path !== nextResourcePath &&
        isStorageObjectPath(oldItem.resource_path)
      ) {
        const { error: removeOldError } = await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .remove([oldItem.resource_path as string]);

        if (removeOldError) {
          successMessage += " File lama belum berhasil dibersihkan dari Storage.";
        }
      }

      setSuccess(successMessage);
      setEditingContentId(null);
      setContentForm(emptyContent);
      setSelectedContentFile(null);
      setExistingContentFileName("");
      setContentEditorOpen(false);

      await loadContent();
    } catch (err) {
      if (newlyUploadedPath && !databaseSaved) {
        await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .remove([newlyUploadedPath]);
      }

      setContentError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan mini materi."
      );
    } finally {
      setContentSaving(false);
    }
  }

  async function handleDeleteContent(item: LessonContent) {
    const confirmed = await confirmDialog({
      title: "Hapus Mini Materi?",
      message: `Hapus mini materi "${item.title}"?\n\nTindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Ya, hapus Mini Materi",
      variant: "danger",
    });

    if (!confirmed) return;

    setContentSaving(true);
    setContentError("");

    try {
      const { error: dbError } = await supabase
        .from("lesson_contents")
        .delete()
        .eq("id", item.id);

      if (dbError) throw dbError;

      let successMessage = "Mini materi berhasil dihapus.";

      if (isStorageObjectPath(item.resource_path)) {
        const { error: removeError } = await supabase.storage
          .from(LEARNING_RESOURCE_BUCKET)
          .remove([item.resource_path as string]);

        if (removeError) {
          successMessage += " File di Storage belum berhasil dihapus.";
        }
      }

      setSuccess(successMessage);
      await loadContent();
    } catch (err) {
      setContentError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus mini materi."
      );
    } finally {
      setContentSaving(false);
    }
  }

  async function reorderLessonsInSection(
    sectionId: string,
    sourceId: string,
    targetId: string
  ) {
    if (sourceId === targetId || reorderingLessons) return;

    const items = lessons
      .filter((lesson) => lesson.section_id === sectionId)
      .sort(
        (a, b) =>
          a.position - b.position ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    const fromIndex = items.findIndex((lesson) => lesson.id === sourceId);
    const toIndex = items.findIndex((lesson) => lesson.id === targetId);

    // Abaikan drop dari bab lain atau item yang sudah tidak tersedia.
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setReorderingLessons(true);
    setError("");
    setSuccess("");

    try {
      // Tahap sementara mencegah benturan jika database memakai unique
      // constraint pada kombinasi section_id dan position.
      const temporaryOffset =
        Math.max(0, ...items.map((lesson) => lesson.position)) +
        items.length +
        1;

      for (let index = 0; index < reordered.length; index += 1) {
        const lesson = reordered[index];

        const { error: dbError } = await supabase
          .from("lessons")
          .update({ position: temporaryOffset + index })
          .eq("id", lesson.id)
          .eq("section_id", sectionId);

        if (dbError) throw dbError;
      }

      // Setelah semua posisi lama dipindahkan, tetapkan urutan baru 0, 1, 2, ...
      for (let index = 0; index < reordered.length; index += 1) {
        const lesson = reordered[index];

        const { error: dbError } = await supabase
          .from("lessons")
          .update({
            position: index,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lesson.id)
          .eq("section_id", sectionId);

        if (dbError) throw dbError;
      }

      await loadContent();
      setSuccess("Urutan materi dalam bab berhasil diperbarui.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah urutan materi dalam bab."
      );
      await loadContent();
    } finally {
      setReorderingLessons(false);
      setDraggedLessonId(null);
    }
  }

  function moveLessonByOne(lesson: Lesson, direction: -1 | 1) {
    const items = lessons
      .filter((entry) => entry.section_id === lesson.section_id)
      .sort(
        (a, b) =>
          a.position - b.position ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    const currentIndex = items.findIndex((entry) => entry.id === lesson.id);
    const target = items[currentIndex + direction];

    if (!target) return;

    void reorderLessonsInSection(
      lesson.section_id,
      lesson.id,
      target.id
    );
  }

  async function reorderLessonContents(
    lessonId: string,
    sourceId: string,
    targetId: string
  ) {
    if (sourceId === targetId || reorderingContent) return;

    const items = lessonContents
      .filter((item) => item.lesson_id === lessonId)
      .sort((a, b) => a.position - b.position);

    const fromIndex = items.findIndex((item) => item.id === sourceId);
    const toIndex = items.findIndex((item) => item.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setReorderingContent(true);
    setContentError("");

    try {
      for (let index = 0; index < reordered.length; index += 1) {
        const item = reordered[index];

        const { error: dbError } = await supabase
          .from("lesson_contents")
          .update({
            position: index,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (dbError) throw dbError;
      }

      await loadContent();
      setSuccess("Urutan mini materi berhasil diperbarui.");
    } catch (err) {
      setContentError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah urutan mini materi."
      );
      await loadContent();
    } finally {
      setReorderingContent(false);
      setDraggedContentId(null);
    }
  }

  function moveContentByOne(item: LessonContent, direction: -1 | 1) {
    const items = activeLessonContents;
    const currentIndex = items.findIndex((entry) => entry.id === item.id);
    const target = items[currentIndex + direction];

    if (!target) return;

    void reorderLessonContents(item.lesson_id, item.id, target.id);
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="space-y-7 text-[#1B1730]">
      {/* PAGE HEADING */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        
      </section>

      {/* COURSE SELECTOR */}
      <section className="rounded-[22px] bg-white p-5 shadow-[0_4px_24px_rgba(15,45,40,0.045)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6D28D9]">
                Pilih Program
              </p>

              <h3 className="mt-1 text-[15px] font-semibold text-[#1B1730]">
                Kelas Pembelajaran
              </h3>

              <p className="mt-1 text-[11px] text-[#9D97B4]">
                Pilih kelas yang ingin dikelola materinya.
              </p>
            </div>

            <div className="relative w-full sm:max-w-md">

              <BookOpen
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-700"
              />

              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSections([]);
                  setLessons([]);
                  setLessonContents([]);
                  setSearch("");
                  setLoading(true);
                  setSuccess("");
                  setError("");
                }}
                disabled={courses.length === 0}
                className="h-11 w-full appearance-none rounded-xl border-0 bg-[#F7F6FC] py-0 text-[12px] font-medium text-[#6C6280] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                style={{ paddingLeft: "3.25rem", paddingRight: "3rem" }}
              >
                {courses.length === 0 ? (
                  <option value="">Belum ada kelas</option>
                ) : (
                  courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))
                )}
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

            </div>

          </div>

          {selectedCourse && (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#F7F5FB] pt-4">

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Kelas terpilih
                </p>

                <p className="mt-1 truncate text-[13px] font-semibold text-[#6D28D9]">
                  {selectedCourse.title}
                </p>
              </div>

              <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${
                selectedCourse.status === "published"
                  ? "bg-violet-50 text-violet-700"
                  : selectedCourse.status === "archived"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {selectedCourse.status === "published"
                  ? "Dipublikasikan"
                  : selectedCourse.status === "archived"
                    ? "Diarsipkan"
                    : "Draft"}
              </span>

            </div>
          )}

        </section>

        {/* NOTIFICATIONS */}

        {error && !sectionModal && !lessonModal && (
          <div className="rounded-xl bg-[#FFF0EF] p-4 text-[12px] font-medium text-[#B83D36]">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-[#F3EEFF] p-4 text-[12px] font-semibold text-[#6D28D9]">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {reorderingLessons && (
          <div className="flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-[12px] font-semibold text-violet-800">
            <RefreshCw size={15} className="animate-spin" />
            Menyimpan urutan materi dalam bab...
          </div>
        )}

        {/* STATISTICS */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          {[
            {
              title: "Total Bab",
              value: stats.sections,
              icon: Layers3,
              style: "bg-violet-50 text-violet-700",
            },
            {
              title: "Total Materi",
              value: stats.lessons,
              icon: BookOpen,
              style: "bg-emerald-50 text-emerald-700",
            },
            {
              title: "Dipublikasikan",
              value: stats.published,
              icon: Eye,
              style: "bg-green-50 text-green-700",
            },
            {
              title: "Materi Preview",
              value: stats.previews,
              icon: PlayCircle,
              style: "bg-amber-50 text-amber-700",
            },
            {
              title: "Mini Materi",
              value: stats.miniContents,
              icon: ListPlus,
              style: "bg-violet-50 text-cyan-700",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,45,40,0.045)]"
              >
                <div className="flex items-center justify-between gap-2">

                  <div>
                    <p className="text-[12px] font-medium text-[#817A97]">
                      {item.title}
                    </p>

                    <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-[#1B1730]">
                      {item.value}
                    </p>
                  </div>

                  <div className={`rounded-xl p-3 ${item.style}`}>
                    <Icon size={22} />
                  </div>

                </div>
              </div>
            );
          })}

        </section>

        {/* SECTION MANAGEMENT */}

        <section className="overflow-hidden rounded-[22px] bg-white shadow-[0_4px_24px_rgba(15,45,40,0.045)]">

          <div className="flex flex-col justify-between gap-4 border-b border-[#F7F5FB] p-5 sm:flex-row sm:items-center sm:p-6">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <Layers3 size={22} />
              </div>

              <div>
                <h3 className="text-[15px] font-semibold text-[#1B1730]">
                  Struktur Pembelajaran
                </h3>

                <p className="mt-1 text-[11px] text-[#9D97B4]">
                  Atur bab dan materi di setiap bab.
                </p>
              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <div className="relative">

                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari bab atau materi..."
                  className="h-11 w-full rounded-xl border-0 bg-[#F7F6FC] py-0 pl-10 pr-4 text-[12px] text-[#1B1730] outline-none transition placeholder:text-[#AAA5B8] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25 sm:w-64"
                />

              </div>

              <button
                onClick={openCreateSection}
                disabled={!selectedCourseId}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5B21B6] disabled:opacity-50"
              >
                <Plus size={18} />
                Tambah Bab
              </button>

            </div>

          </div>

          <div className="space-y-5 p-5 sm:p-7">

            {loading ? (

              <div className="flex min-h-64 flex-col items-center justify-center text-center">

                <RefreshCw size={30} className="animate-spin text-violet-600" />

                <p className="mt-4 text-sm font-semibold text-slate-600">
                  Memuat struktur pembelajaran...
                </p>

              </div>

            ) : courses.length === 0 ? (

              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">

                <FolderOpen size={40} className="text-violet-600" />

                <h4 className="mt-4 font-bold text-slate-800">
                  Belum Ada Kelas
                </h4>

                <p className="mt-2 text-sm text-slate-500">
                  Buat kelas terlebih dahulu sebelum menambahkan materi.
                </p>

                <Link
                  href="/admin/kelas"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white"
                >
                  <Plus size={17} />
                  Buat Kelas
                </Link>

              </div>

            ) : sections.length === 0 ? (

              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-[#FAF9FF] p-8 text-center">

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Layers3 size={30} />
                </div>

                <h4 className="mt-5 text-lg font-bold text-slate-800">
                  Belum Ada Bab Pembelajaran
                </h4>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Mulai susun kurikulum kelas ini dengan
                  menambahkan bab pertama.
                </p>

                <button
                  onClick={openCreateSection}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/20"
                >
                  <Plus size={18} />
                  Tambah Bab Pertama
                </button>

              </div>

            ) : visibleSections.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">

                <Search size={30} className="mx-auto text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  Materi tidak ditemukan.
                </p>

                <button
                  onClick={() => setSearch("")}
                  className="mt-3 text-xs font-bold text-violet-700 hover:underline"
                >
                  Hapus pencarian
                </button>

              </div>

            ) : (

              visibleSections.map((section) => {

                const sectionLessons = lessons.filter(
                  (lesson) => lesson.section_id === section.id
                );

                const displayedLessons = search.trim()
                  ? sectionLessons.filter(
                      (lesson) =>
                        lesson.title.toLowerCase().includes(search.toLowerCase())
                    )
                  : sectionLessons;

                return (

                  <article
                    key={section.id}
                    className="overflow-hidden rounded-[18px] border border-[#F6F2FC] bg-white transition hover:border-[#DED0FF]"
                  >

                    {/* SECTION HEADER */}

                    <div className="flex flex-col justify-between gap-4 bg-[#FAF9FF] p-5 sm:flex-row sm:items-start">

                      <div className="flex min-w-0 flex-1 items-start gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6D28D9] text-white shadow-md shadow-violet-700/15">
                          <Layers3 size={21} />
                        </div>

                        <div className="min-w-0">

                          <h4 className="break-words font-bold text-slate-900">
                            {section.title}
                          </h4>

                          <p className="mt-1 text-[11px] text-[#9D97B4]">
                            {section.description || "Belum ada deskripsi bab."}
                          </p>

                          <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-bold text-violet-700 shadow-sm">
                            {sectionLessons.length} Materi
                          </span>

                          {sectionLessons.length > 1 && (
                            <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                              <GripVertical size={12} />
                              {search.trim()
                                ? "Hapus pencarian untuk mengubah urutan"
                                : "Seret materi atau gunakan tombol panah untuk mengubah urutan"}
                            </p>
                          )}

                        </div>

                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">

                        <button
                          type="button"
                          onClick={() => openCreateLesson(section.id)}
                          aria-label="Tambah Materi"
                          title="Tambah Materi"
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#260047] text-white transition hover:bg-[#09483F] sm:h-9 sm:w-9"
                        >
                          <Plus size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditSection(section)}
                          aria-label="Edit Bab"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:h-9 sm:w-9"
                          title="Edit Bab"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSection(section)}
                          disabled={deletingId === section.id}
                          aria-label="Hapus Bab"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 sm:h-9 sm:w-9"
                          title="Hapus Bab"
                        >
                          {deletingId === section.id ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>

                      </div>

                    </div>

                    {/* LESSON LIST */}

                    <div className="space-y-3 p-4 sm:p-5">

                      {displayedLessons.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-slate-200 p-7 text-center">

                          <BookOpen size={27} className="mx-auto text-slate-300" />

                          <p className="mt-3 text-sm font-semibold text-slate-600">
                            {sectionLessons.length === 0
                              ? "Belum ada materi di bab ini."
                              : "Tidak ada materi yang cocok dengan pencarian."}
                          </p>

                          {sectionLessons.length === 0 && (
                            <button
                              onClick={() => openCreateLesson(section.id)}
                              className="mt-3 text-xs font-bold text-violet-700 hover:underline"
                            >
                              + Tambahkan materi sekarang
                            </button>
                          )}

                        </div>

                      ) : (

                        displayedLessons.map((lesson, index) => (

                          <div
                            key={lesson.id}
                            draggable={!search.trim() && !reorderingLessons}
                            onDragStart={(event) => {
                              if (search.trim()) {
                                event.preventDefault();
                                return;
                              }

                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", lesson.id);
                              setDraggedLessonId(lesson.id);
                            }}
                            onDragOver={(event) => {
                              if (search.trim() || reorderingLessons) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(event) => {
                              if (search.trim() || reorderingLessons) return;
                              event.preventDefault();

                              const sourceId =
                                event.dataTransfer.getData("text/plain") ||
                                draggedLessonId;

                              if (sourceId) {
                                void reorderLessonsInSection(
                                  section.id,
                                  sourceId,
                                  lesson.id
                                );
                              }

                              setDraggedLessonId(null);
                            }}
                            onDragEnd={() => setDraggedLessonId(null)}
                            className={`flex flex-col gap-3 rounded-xl border bg-slate-50/70 p-4 transition sm:flex-row sm:items-center ${
                              draggedLessonId === lesson.id
                                ? "border-violet-400 opacity-50"
                                : "border-slate-100 hover:border-violet-100 hover:bg-violet-50/30"
                            }`}
                          >

                            <div className="flex min-w-0 flex-1 items-center gap-3">

                              <div
                                className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-lg ${
                                  search.trim() || reorderingLessons
                                    ? "text-slate-300"
                                    : "cursor-grab bg-white text-slate-400 active:cursor-grabbing"
                                }`}
                                title={
                                  search.trim()
                                    ? "Hapus pencarian untuk mengubah urutan"
                                    : "Seret untuk mengubah urutan dalam bab ini"
                                }
                              >
                                <GripVertical size={17} />
                              </div>

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
                                {getLessonContentKind(lesson.video_provider) === "video" ? <Video size={19} />
                                  : getLessonContentKind(lesson.video_provider) === "link" ? <Link2 size={19} />
                                  : getLessonContentKind(lesson.video_provider) === "pdf" ? <FileText size={19} />
                                  : getLessonContentKind(lesson.video_provider) === "info" ? <MessageSquare size={19} />
                                  : <BookOpen size={19} />}
                              </div>

                              <div className="min-w-0">

                                <h5 className="break-words text-sm font-semibold text-slate-800">
                                  {lesson.title}
                                </h5>

                                <div className="mt-2 flex flex-wrap items-center gap-2">

                                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(lesson.status)}`}>
                                    {statusLabel(lesson.status)}
                                  </span>
                                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                                    {lessonContentKindLabel(getLessonContentKind(lesson.video_provider))}
                                  </span>

                                  {lesson.is_preview && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                      <Eye size={11} />
                                      Preview
                                    </span>
                                  )}

                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                    {getLessonContentKind(lesson.video_provider) === "video" ? <><Clock3 size={11} />{lesson.duration_minutes ?? 0} menit</> : lessonContentKindLabel(getLessonContentKind(lesson.video_provider))}
                                  </span>

                                  <span className="text-[10px] text-slate-400">
                                    Materi {index + 1} · {lessonContents.filter((item) => item.lesson_id === lesson.id).length} Mini Materi
                                  </span>

                                </div>

                              </div>

                            </div>

                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">

                              <button
                                type="button"
                                onClick={() => moveLessonByOne(lesson, -1)}
                                disabled={
                                  index === 0 ||
                                  Boolean(search.trim()) ||
                                  reorderingLessons
                                }
                                aria-label="Naikkan urutan materi"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9"
                                title="Naikkan urutan materi"
                              >
                                <ArrowUp size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => moveLessonByOne(lesson, 1)}
                                disabled={
                                  index === sectionLessons.length - 1 ||
                                  Boolean(search.trim()) ||
                                  reorderingLessons
                                }
                                aria-label="Turunkan urutan materi"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9"
                                title="Turunkan urutan materi"
                              >
                                <ArrowDown size={15} />
                              </button>

                              {lesson.video_url && (
                                <a
                                  href={lesson.video_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label="Buka video"
                                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-violet-700 sm:h-9 sm:w-9"
                                  title="Buka video"
                                >
                                  <ExternalLink size={15} />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => openContentManager(lesson)}
                                aria-label={`Kelola Mini Materi (${lessonContents.filter((item) => item.lesson_id === lesson.id).length})`}
                                title={`Kelola Mini Materi (${lessonContents.filter((item) => item.lesson_id === lesson.id).length})`}
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-100 bg-white text-violet-700 transition hover:bg-violet-50 sm:h-9 sm:w-9"
                              >
                                <ListPlus size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditLesson(lesson)}
                                aria-label="Edit Materi"
                                title="Edit Materi"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:h-9 sm:w-9"
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson)}
                                disabled={deletingId === lesson.id}
                                aria-label="Hapus Materi"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 sm:h-9 sm:w-9"
                                title="Hapus Materi"
                              >
                                {deletingId === lesson.id ? (
                                  <RefreshCw size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>

                            </div>

                          </div>

                        ))

                      )}

                    </div>

                  </article>

                );
              })

            )}

          </div>

          {/* FOOTER */}

          <div className="flex flex-col justify-between gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:px-7">

            <span>
              {stats.sections} bab · {stats.lessons} materi · {stats.miniContents} mini materi
            </span>

            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-violet-600" />
              Data tersimpan di Supabase
            </span>

          </div>

        </section>

        <footer className="pt-1 text-center text-[11px] text-[#AAA5B8]">
          © 2026 Kiki Creator Class. All rights reserved.
        </footer>

      {/* =====================================
          MODAL SECTION
      ===================================== */}

      {sectionModal && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6">

          <div className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">

            <div className="flex items-center justify-between bg-[#6D28D9] px-5 py-5 text-white sm:px-6">

              <div>
                <h3 className="text-lg font-bold">
                  {editingSectionId ? "Edit Bab" : "Tambah Bab Baru"}
                </h3>

                <p className="mt-1 text-xs text-violet-50">
                  Atur struktur bab pembelajaran.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSectionModal}
                disabled={saving}
                className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
              >
                <X size={19} />
              </button>

            </div>

            <form
              onSubmit={handleSaveSection}
              className="space-y-5 p-6"
            >

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Nama Bab *
                </label>

                <input
                  required
                  maxLength={180}
                  value={sectionForm.title}
                  onChange={(e) =>
                    setSectionForm({
                      ...sectionForm,
                      title: e.target.value,
                    })
                  }
                  placeholder="Contoh: Bab 1 - Pengenalan Dasar"
                  className="w-full rounded-xl border-0 bg-[#F7F6FC] px-4 py-3.5 text-[13px] text-[#1B1730] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Deskripsi Bab
                </label>

                <textarea
                  rows={4}
                  value={sectionForm.description}
                  onChange={(e) =>
                    setSectionForm({
                      ...sectionForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Jelaskan isi dan tujuan bab..."
                  className="w-full resize-y rounded-xl border-0 bg-[#F7F6FC] px-4 py-3.5 text-[13px] text-[#1B1730] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeSectionModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Menyimpan..." : "Simpan Bab"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================
          MODAL LESSON
      ===================================== */}

      {lessonModal && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6">

          <div className="my-auto w-full max-w-[560px] overflow-hidden rounded-3xl bg-white shadow-2xl">

            <div className="flex items-center justify-between bg-[#6D28D9] px-5 py-4 text-white sm:px-6">

              <div>
                <h3 className="text-lg font-bold">
                  {editingLessonId ? "Edit Materi" : "Tambah Materi Baru"}
                </h3>

                <p className="mt-1 text-xs text-violet-50">
                  Lengkapi informasi materi pembelajaran.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLessonModal}
                disabled={saving}
                className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
              >
                <X size={19} />
              </button>

            </div>

            <form
              onSubmit={handleSaveLesson}
              className="max-h-[calc(100dvh-8rem)] space-y-5 overflow-y-auto p-4 sm:p-6"
            >

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Title */}

              <div>
                <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                  Judul Materi *
                </label>

                <input
                  required
                  maxLength={180}
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      title: e.target.value,
                    })
                  }
                  placeholder="Contoh: Pengenalan Microsoft Excel"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              {/* Jenis materi */}
              <div>
                <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Jenis Materi *</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    { value: "video", label: "Video Pembelajaran", description: "YouTube, Vimeo, atau video langsung", icon: Video },
                    { value: "text", label: "Materi Teks", description: "Artikel atau penjelasan pembelajaran", icon: BookOpen },
                    { value: "link", label: "Link Eksternal", description: "WhatsApp, website, Google Drive", icon: Link2 },
                    { value: "pdf", label: "Upload PDF", description: "Modul, panduan, atau bahan bacaan", icon: FileText },
                    { value: "info", label: "Informasi", description: "Pengumuman atau catatan kelas", icon: MessageSquare },
                  ] as const).map((item) => {
                    const Icon = item.icon;
                    const active = lessonForm.content_type === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setLessonForm({ ...lessonForm, content_type: item.value })}
                        className={`flex min-h-[76px] items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600"}`}><Icon size={17} /></span>
                        <span className="min-w-0"><span className="block text-xs font-bold text-slate-800">{item.label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{item.description}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {lessonForm.content_type === "video" && (
                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="mb-4 flex items-center gap-2"><Video size={18} className="text-violet-700" /><h4 className="text-sm font-bold text-slate-800">Pengaturan Video</h4></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Penyedia Video
                      <select value={lessonForm.video_provider} onChange={(e) => setLessonForm({ ...lessonForm, video_provider: e.target.value })} className="mt-1.5 h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200">
                        <option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="external">Video Eksternal / MP4</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Durasi (Menit)
                      <input type="number" min="0" step="1" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: e.target.value })} className="mt-1.5 h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-slate-700">URL Video *
                    <input required type="url" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." className="mt-1.5 h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                  </label>
                  <label className="mt-4 block text-sm font-medium text-slate-700">Deskripsi video (opsional)
                    <textarea rows={3} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Tambahkan ringkasan singkat video..." className="mt-1.5 min-h-[90px] w-full rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm leading-6 text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                  </label>
                </div>
              )}

              {lessonForm.content_type === "text" && (
                <label className="block text-sm font-medium leading-5 text-slate-700">Isi Materi Teks *
                  <textarea required rows={7} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Tuliskan materi, penjelasan, langkah-langkah, atau panduan pembelajaran..." className="mt-1.5 min-h-[190px] w-full rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm leading-7 text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                </label>
              )}

              {lessonForm.content_type === "info" && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                  <label className="block text-sm font-medium leading-5 text-slate-700">Isi Informasi / Pengumuman *
                    <textarea required rows={5} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Tuliskan informasi penting yang perlu diketahui peserta..." className="mt-1.5 min-h-[140px] w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-[#1B1730] outline-none focus:ring-2 focus:ring-sky-200" />
                  </label>
                  <p className="mt-2 text-[11px] leading-5 text-sky-800">Informasi akan ditampilkan sebagai kartu pengumuman khusus di halaman belajar peserta.</p>
                </div>
              )}

              {lessonForm.content_type === "link" && (
                <div className="rounded-2xl border border-slate-100 p-4">
                  <label className="block text-sm font-medium leading-5 text-slate-700">URL Tujuan *
                    <input required type="url" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://chat.whatsapp.com/..." className="mt-1.5 h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                  </label>
                  <label className="mt-4 block text-sm font-medium leading-5 text-slate-700">Keterangan (opsional)
                    <textarea rows={3} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Jelaskan tujuan tautan ini kepada peserta..." className="mt-1.5 min-h-[90px] w-full rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm leading-6 text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                  </label>
                </div>
              )}

              {lessonForm.content_type === "pdf" && (
                <div className="rounded-2xl border border-slate-100 p-4">
                  <label className="block text-sm font-medium leading-5 text-slate-700">Upload Dokumen PDF *
                    <input type="file" accept=".pdf,application/pdf" onChange={(event) => setSelectedLessonPdf(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-800" />
                  </label>
                  <p className="mt-2 text-[11px] text-slate-500">Format PDF, maksimal 20 MB.</p>
                  {(selectedLessonPdf?.name || existingLessonPdfName) && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{selectedLessonPdf?.name ?? `File tersimpan: ${existingLessonPdfName}`}</p>}
                  <label className="mt-4 block text-sm font-medium leading-5 text-slate-700">Keterangan dokumen (opsional)
                    <textarea rows={3} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Jelaskan isi atau tujuan dokumen..." className="mt-1.5 min-h-[90px] w-full rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm leading-6 text-[#1B1730] outline-none focus:ring-2 focus:ring-violet-200" />
                  </label>
                </div>
              )}

              {/* Status */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                    Status Materi
                  </label>

                  <select
                    value={lessonForm.status}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        status: e.target.value as "draft" | "published",
                      })
                    }
                    className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Dipublikasikan</option>
                  </select>
                </div>

                <div className="flex items-end">

                  <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3.5">

                    <input
                      type="checkbox"
                      checked={lessonForm.is_preview}
                      onChange={(e) =>
                        setLessonForm({
                          ...lessonForm,
                          is_preview: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-violet-700"
                    />

                    <span className="flex items-center gap-2 text-sm font-medium text-violet-800">
                      <Eye size={16} />
                      Materi Preview
                    </span>

                  </label>

                </div>

              </div>

              {/* Info */}

              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">

                <div className="flex gap-3">

                  <ShieldCheck size={20} className="shrink-0 text-violet-700" />

                  <div>
                    <p className="text-xs font-bold text-violet-900">
                      Pengaturan Akses Materi
                    </p>

                    <p className="mt-1 text-xs font-normal leading-5 text-violet-700">
                      Materi Draft tidak ditampilkan kepada member.
                      Materi Preview yang dipublikasikan dapat diakses
                      sebagai materi contoh sesuai kebijakan akses kelas.
                    </p>
                  </div>

                </div>

              </div>

              {/* Actions */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeLessonModal}
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white shadow-lg shadow-violet-700/20 disabled:opacity-60 sm:w-auto"
                >

                  {saving ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}

                  {saving
                    ? "Menyimpan..."
                    : editingLessonId
                      ? "Simpan Perubahan"
                      : "Tambah Materi"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================
          MODAL MINI MATERI
      ===================================== */}

      {contentModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6">
          <div className={`my-auto flex max-h-[calc(100dvh-24px)] w-full ${contentEditorOpen ? "max-w-[560px]" : "max-w-[800px]"} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-48px)]`}>
            <div className="flex items-center justify-between gap-4 bg-[#6D28D9] px-5 py-4 text-white sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">
                  <ListPlus size={15} />
                  Content Builder
                </div>
                <h3 className="mt-1 truncate text-lg font-bold sm:text-xl">
                  Mini Materi
                </h3>
                <p className="mt-1 truncate text-xs text-violet-50">
                  {activeLesson?.title ?? "Materi inti"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeContentModal}
                disabled={contentSaving || reorderingContent}
                className="shrink-0 rounded-xl bg-white/15 p-2 transition hover:bg-white/25 disabled:opacity-50"
                aria-label="Tutup mini materi"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {contentError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {contentError}
                </div>
              )}

              {!contentEditorOpen ? (
                <>
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#F2EEFA] bg-[#FAF9FF] p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-bold text-[#1B1730]">
                        Susunan mini materi
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#817A97]">
                        Tambahkan beberapa segmen yang saling terhubung dalam satu materi inti.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateContent}
                      aria-label="Tambah Mini Materi"
                      title="Tambah Mini Materi"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6D28D9] text-white transition hover:bg-[#5B21B6] sm:h-9 sm:w-9"
                    >
                      <Plus size={17} />
                    </button>
                  </div>

                  {activeLessonContents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-violet-200 bg-[#FAF9FF] px-6 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                        <Layers3 size={27} />
                      </div>
                      <h4 className="mt-4 text-sm font-bold text-slate-800">
                        Belum Ada Mini Materi
                      </h4>
                      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
                        Pecah materi inti menjadi beberapa segmen berupa teks, video pendek, gambar, dokumen, audio, atau tautan.
                      </p>
                      <button
                        type="button"
                        onClick={openCreateContent}
                        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white"
                      >
                        <Plus size={16} />
                        Buat Mini Materi Pertama
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700">
                          {activeLessonContents.length} segmen konten
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                          <GripVertical size={13} />
                          Seret untuk mengubah urutan
                        </p>
                      </div>

                      {activeLessonContents.map((item, index) => {
                        const ItemIcon = contentTypeIcon(item.content_type);

                        return (
                          <article
                            key={item.id}
                            draggable={!reorderingContent}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", item.id);
                              setDraggedContentId(item.id);
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const sourceId =
                                event.dataTransfer.getData("text/plain") ||
                                draggedContentId;

                              if (sourceId) {
                                void reorderLessonContents(
                                  activeLessonId,
                                  sourceId,
                                  item.id
                                );
                              }
                              setDraggedContentId(null);
                            }}
                            onDragEnd={() => setDraggedContentId(null)}
                            className={`rounded-2xl border bg-white p-4 transition ${
                              draggedContentId === item.id
                                ? "border-violet-400 opacity-50"
                                : "border-[#F5F1FC] hover:border-violet-200"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div
                                  className="mt-1 flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg bg-slate-50 text-slate-400 active:cursor-grabbing"
                                  title="Seret untuk mengubah urutan"
                                >
                                  <GripVertical size={17} />
                                </div>

                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                                  <ItemIcon size={19} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                                      Segmen {index + 1}
                                    </span>
                                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusStyle(item.status)}`}>
                                      {statusLabel(item.status)}
                                    </span>
                                  </div>

                                  <h4 className="mt-1 break-words text-sm font-bold text-slate-800">
                                    {item.title}
                                  </h4>

                                  <p className="mt-1 text-[10px] text-slate-400">
                                    {contentTypeLabel(item.content_type)}
                                  </p>

                                  {item.body && (
                                    <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs leading-5 text-slate-500">
                                      {item.body}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                <button
                                  type="button"
                                  onClick={() => moveContentByOne(item, -1)}
                                  disabled={index === 0 || reorderingContent}
                                  aria-label="Naikkan urutan Mini Materi"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                                  title="Naikkan urutan"
                                >
                                  <ArrowUp size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => moveContentByOne(item, 1)}
                                  disabled={index === activeLessonContents.length - 1 || reorderingContent}
                                  aria-label="Turunkan urutan Mini Materi"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                                  title="Turunkan urutan"
                                >
                                  <ArrowDown size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditContent(item)}
                                  disabled={contentSaving || reorderingContent}
                                  aria-label={`Edit mini materi ${item.title}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-100 text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                                  title="Edit Mini Materi"
                                >
                                  <Pencil size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteContent(item)}
                                  disabled={contentSaving || reorderingContent}
                                  aria-label={`Hapus mini materi ${item.title}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                                  title="Hapus Mini Materi"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}

                      {reorderingContent && (
                        <div className="flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-xs font-semibold text-violet-700">
                          <RefreshCw size={15} className="animate-spin" />
                          Menyimpan urutan mini materi...
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSaveContent} className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-[#1B1730]">
                        {editingContentId ? "Edit Mini Materi" : "Tambah Mini Materi"}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Lengkapi konten segmen pembelajaran.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (contentSaving) return;
                        setContentEditorOpen(false);
                        setEditingContentId(null);
                        setContentForm(emptyContent);
                        setSelectedContentFile(null);
                        setExistingContentFileName("");
                        setContentError("");
                      }}
                      disabled={contentSaving}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      aria-label="Kembali ke daftar mini materi"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                      Judul Mini Materi *
                    </label>
                    <input
                      required
                      maxLength={180}
                      value={contentForm.title}
                      onChange={(event) =>
                        setContentForm({
                          ...contentForm,
                          title: event.target.value,
                        })
                      }
                      placeholder="Contoh: Mengenal Dasar-Dasar Desain"
                      className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                      Jenis Konten *
                    </label>
                    <select
                      value={contentForm.content_type}
                      onChange={(event) => {
                        setContentForm({
                          ...contentForm,
                          content_type: event.target.value as LessonContentType,
                          media_url: "",
                          resource_path: "",
                        });
                        setSelectedContentFile(null);
                        setExistingContentFileName("");
                        setContentError("");
                      }}
                      className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                    >
                      <option value="text">Teks / Penjelasan</option>
                      <option value="tiktok">Video Pendek / TikTok</option>
                      <option value="youtube">Video YouTube</option>
                      <option value="image">Gambar</option>
                      <option value="pdf">PDF / Dokumen</option>
                      <option value="audio">Audio</option>
                      <option value="link">Tautan Eksternal</option>
                      <option value="callout">Catatan Penting</option>
                    </select>
                  </div>

                  {(contentForm.content_type === "text" ||
                    contentForm.content_type === "callout" ||
                    contentForm.content_type === "tiktok" ||
                    contentForm.content_type === "youtube" ||
                    contentForm.content_type === "image" ||
                    contentForm.content_type === "pdf" ||
                    contentForm.content_type === "audio") && (
                    <div>
                      <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                        {contentForm.content_type === "text"
                          ? "Isi Teks *"
                          : contentForm.content_type === "callout"
                            ? "Isi Catatan *"
                            : "Deskripsi / Keterangan"}
                      </label>
                      <textarea
                        rows={contentForm.content_type === "text" ? 5 : 4}
                        value={contentForm.body}
                        onChange={(event) =>
                          setContentForm({
                            ...contentForm,
                            body: event.target.value,
                          })
                        }
                        placeholder={
                          contentForm.content_type === "callout"
                            ? "Tuliskan poin penting yang perlu diperhatikan peserta..."
                            : "Tuliskan penjelasan atau keterangan segmen ini..."
                        }
                        className="min-h-[132px] w-full resize-y rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm font-normal leading-6 text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                      />
                    </div>
                  )}

                  {["tiktok", "youtube"].includes(contentForm.content_type) && (
                    <div>
                      <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                        URL Video *
                      </label>
                      <input
                        type="url"
                        required
                        value={contentForm.media_url}
                        onChange={(event) =>
                          setContentForm({
                            ...contentForm,
                            media_url: event.target.value,
                          })
                        }
                        placeholder={
                          contentForm.content_type === "tiktok"
                            ? "https://www.tiktok.com/@akun/video/..."
                            : "https://www.youtube.com/watch?v=..."
                        }
                        className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                      />

                      {contentForm.content_type === "tiktok" && (
                        <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                          Gunakan tautan video TikTok lengkap. Jika tautan yang disalin berupa vt.tiktok.com atau vm.tiktok.com, buka videonya dahulu lalu salin URL lengkap dari address bar.
                        </p>
                      )}
                    </div>
                  )}

                  {isUploadableContentType(contentForm.content_type) && (
                    <div className="space-y-3 rounded-2xl border border-violet-100 bg-[#FAF9FF] p-4 sm:p-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                          Upload File Pembelajaran *
                        </label>
                        <input
                          type="file"
                          accept={CONTENT_FILE_RULES[contentForm.content_type].accept}
                          disabled={contentSaving}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            event.currentTarget.value = "";
                            if (!file) return;

                            const validationError = validateContentFile(
                              file,
                              contentForm.content_type
                            );

                            if (validationError) {
                              setSelectedContentFile(null);
                              setContentError(validationError);
                              return;
                            }

                            setSelectedContentFile(file);
                            setContentError("");
                          }}
                          className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm font-normal text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-violet-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-800"
                        />
                        <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                          Format: {CONTENT_FILE_RULES[contentForm.content_type].label}. Ukuran maksimal 20 MB.
                        </p>
                      </div>

                      {(selectedContentFile || existingContentFileName) && (
                        <div className="flex flex-col gap-2 rounded-xl border border-violet-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                              {contentForm.content_type === "image" ? (
                                <ImageIcon size={17} />
                              ) : contentForm.content_type === "pdf" ? (
                                <FileText size={17} />
                              ) : (
                                <Music size={17} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800">
                                {selectedContentFile?.name ?? existingContentFileName}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {selectedContentFile
                                  ? `${formatFileSize(selectedContentFile.size)} · Siap diunggah`
                                  : "File tersimpan di Supabase Storage"}
                              </p>
                            </div>
                          </div>
                          {selectedContentFile && (
                            <button
                              type="button"
                              onClick={() => setSelectedContentFile(null)}
                              disabled={contentSaving}
                              className="self-start rounded-lg px-3 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:self-auto"
                            >
                              Batalkan file
                            </button>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                          Atau gunakan URL file eksternal
                        </label>
                        <input
                          type="url"
                          value={contentForm.media_url}
                          onChange={(event) => {
                            const nextUrl = event.target.value;
                            setContentForm({
                              ...contentForm,
                              media_url: nextUrl,
                              resource_path: nextUrl.trim()
                                ? ""
                                : contentForm.resource_path,
                            });
                            if (nextUrl.trim()) {
                              setSelectedContentFile(null);
                              setExistingContentFileName("");
                            }
                          }}
                          placeholder="https://... (opsional)"
                          className="h-12 w-full rounded-xl border-0 bg-white px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:ring-2 focus:ring-[#8B5CF6]/25"
                        />
                        <p className="mt-1 text-[10px] leading-5 text-slate-400">
                          Jika file diunggah dari perangkat, URL eksternal tidak perlu diisi.
                        </p>
                      </div>
                    </div>
                  )}

                  {contentForm.content_type === "tiktok" &&
                    contentForm.media_url.trim() && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 shadow-sm">
                            <PlayCircle size={17} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Pratinjau Video TikTok
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Periksa video sebelum menyimpan mini materi.
                            </p>
                          </div>
                        </div>

                        {getTikTokVideoId(contentForm.media_url) ? (
                          <div className="mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-black shadow-sm">
                            <iframe
                              key={getTikTokVideoId(contentForm.media_url)}
                              src={`https://www.tiktok.com/player/v1/${getTikTokVideoId(contentForm.media_url)}?music_info=1&description=1`}
                              title="Pratinjau video TikTok"
                              className="h-full w-full border-0"
                              allow="encrypted-media; fullscreen; picture-in-picture"
                              allowFullScreen
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                            <p className="text-xs font-semibold text-amber-900">
                              Tautan TikTok dikenali, tetapi belum bisa dipratinjau.
                            </p>
                            <p className="mt-1 text-xs font-normal leading-5 text-amber-800">
                              Gunakan URL lengkap dengan format /@namaakun/video/ID agar video dapat ditampilkan langsung di ruang belajar.
                            </p>
                            <a
                              href={contentForm.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-900 underline underline-offset-2"
                            >
                              Buka tautan TikTok
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        <p className="mt-3 text-center text-xs font-normal leading-5 text-slate-400">
                          Pratinjau memerlukan koneksi internet dan izin embed dari TikTok.
                        </p>
                      </div>
                    )}

                  {contentForm.content_type === "link" && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                          URL Tautan *
                        </label>
                        <input
                          type="url"
                          required
                          value={contentForm.link_url}
                          onChange={(event) =>
                            setContentForm({
                              ...contentForm,
                              link_url: event.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                          Label Tombol
                        </label>
                        <input
                          value={contentForm.link_label}
                          onChange={(event) =>
                            setContentForm({
                              ...contentForm,
                              link_label: event.target.value,
                            })
                          }
                          placeholder="Contoh: Buka Referensi"
                          className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                          Keterangan Tautan
                        </label>
                        <textarea
                          rows={3}
                          value={contentForm.body}
                          onChange={(event) =>
                            setContentForm({
                              ...contentForm,
                              body: event.target.value,
                            })
                          }
                          placeholder="Jelaskan tujuan tautan ini..."
                          className="min-h-[96px] w-full resize-y rounded-xl border-0 bg-[#F7F6FC] px-4 py-3 text-sm font-normal leading-6 text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                        />
                      </div>
                    </>
                  )}

                  {(contentForm.content_type === "text" ||
                    contentForm.content_type === "youtube" ||
                    contentForm.content_type === "image" ||
                    contentForm.content_type === "pdf" ||
                    contentForm.content_type === "callout") && (
                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Pengaturan Tampilan</p>
                        <p className="mt-1 text-xs font-normal leading-5 text-slate-500">
                          Atur bagaimana mini materi ini ditampilkan kepada peserta. Pengaturan tidak mengubah file atau isi materi.
                        </p>
                      </div>

                      {contentForm.content_type === "text" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Perataan teks</label>
                            <select
                              value={contentForm.settings.text_align}
                              onChange={(event) => setContentForm({
                                ...contentForm,
                                settings: { ...contentForm.settings, text_align: event.target.value as ContentDisplaySettings["text_align"] },
                              })}
                              className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                            >
                              <option value="left">Rata kiri</option>
                              <option value="center">Rata tengah</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Ukuran teks</label>
                            <select
                              value={contentForm.settings.text_size}
                              onChange={(event) => setContentForm({
                                ...contentForm,
                                settings: { ...contentForm.settings, text_size: event.target.value as ContentDisplaySettings["text_size"] },
                              })}
                              className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                            >
                              <option value="normal">Normal</option>
                              <option value="large">Besar</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {contentForm.content_type === "youtube" && (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Rasio video</label>
                              <select
                                value={contentForm.settings.youtube_ratio}
                                onChange={(event) => setContentForm({
                                  ...contentForm,
                                  settings: { ...contentForm.settings, youtube_ratio: event.target.value as ContentDisplaySettings["youtube_ratio"] },
                                })}
                                className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                              >
                                <option value="16:9">Landscape (16:9)</option>
                                <option value="9:16">Vertikal / Shorts (9:16)</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <label className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={contentForm.settings.youtube_controls}
                                  onChange={(event) => setContentForm({
                                    ...contentForm,
                                    settings: { ...contentForm.settings, youtube_controls: event.target.checked },
                                  })}
                                  className="h-4 w-4 accent-violet-700"
                                />
                                Tampilkan kontrol pemutar
                              </label>
                            </div>
                          </div>
                          <p className="text-[10px] leading-5 text-slate-500">YouTube menggunakan rasio landscape secara default. Pilih vertikal untuk video Shorts.</p>
                        </div>
                      )}

                      {contentForm.content_type === "image" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Cara menampilkan gambar</label>
                            <select
                              value={contentForm.settings.image_fit}
                              onChange={(event) => setContentForm({
                                ...contentForm,
                                settings: { ...contentForm.settings, image_fit: event.target.value as ContentDisplaySettings["image_fit"] },
                              })}
                              className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                            >
                              <option value="contain">Utuh (tidak terpotong)</option>
                              <option value="cover">Penuhi area (dapat terpotong)</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Tinggi maksimal</label>
                            <select
                              value={contentForm.settings.image_height}
                              onChange={(event) => setContentForm({
                                ...contentForm,
                                settings: { ...contentForm.settings, image_height: event.target.value as ContentDisplaySettings["image_height"] },
                              })}
                              className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                            >
                              <option value="compact">Ringkas</option>
                              <option value="medium">Sedang</option>
                              <option value="large">Besar</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {contentForm.content_type === "pdf" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Tampilan PDF</label>
                            <select
                              value={contentForm.settings.pdf_display}
                              onChange={(event) => setContentForm({
                                ...contentForm,
                                settings: { ...contentForm.settings, pdf_display: event.target.value as ContentDisplaySettings["pdf_display"] },
                              })}
                              className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                            >
                              <option value="preview">Preview langsung + tombol buka/unduh</option>
                              <option value="button">Tombol buka/unduh saja</option>
                            </select>
                          </div>
                          {contentForm.settings.pdf_display === "preview" && (
                            <div>
                              <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Tinggi preview</label>
                              <select
                                value={contentForm.settings.pdf_height}
                                onChange={(event) => setContentForm({
                                  ...contentForm,
                                  settings: { ...contentForm.settings, pdf_height: event.target.value as ContentDisplaySettings["pdf_height"] },
                                })}
                                className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                              >
                                <option value="compact">Ringkas</option>
                                <option value="medium">Sedang</option>
                                <option value="large">Besar</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {contentForm.content_type === "callout" && (
                        <div>
                          <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">Gaya catatan</label>
                          <select
                            value={contentForm.settings.callout_variant}
                            onChange={(event) => setContentForm({
                              ...contentForm,
                              settings: { ...contentForm.settings, callout_variant: event.target.value as ContentDisplaySettings["callout_variant"] },
                            })}
                            className="h-12 w-full rounded-xl border-0 bg-white px-3.5 text-sm font-normal text-[#1B1730] outline-none focus:ring-2 focus:ring-[#8B5CF6]/25"
                          >
                            <option value="info">Informasi (ungu)</option>
                            <option value="success">Tips (hijau)</option>
                            <option value="warning">Peringatan (kuning)</option>
                          </select>
                        </div>
                      )}
                    </section>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium leading-5 text-slate-700">
                        Status Mini Materi
                      </label>
                      <select
                        value={contentForm.status}
                        onChange={(event) =>
                          setContentForm({
                            ...contentForm,
                            status: event.target.value as "draft" | "published",
                          })
                        }
                        className="h-12 w-full rounded-xl border-0 bg-[#F7F6FC] px-4 text-sm font-normal text-[#1B1730] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#9A929F] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/25"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Dipublikasikan</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <div className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">
                          Urutan Segmen
                        </p>
                        <p className="mt-1 text-xs text-violet-700">
                          {editingContentId
                            ? `Posisi ${activeLessonContents.findIndex((item) => item.id === editingContentId) + 1}`
                            : `Posisi ${activeLessonContents.length + 1} (terakhir)`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                    <div className="flex gap-3">
                      <ShieldCheck size={19} className="shrink-0 text-violet-700" />
                      <div>
                        <p className="text-xs font-bold text-violet-900">
                          Pengaturan Publikasi
                        </p>
                        <p className="mt-1 text-xs font-normal leading-5 text-violet-700">
                          Mini materi Draft hanya terlihat di admin. Mini materi yang dipublikasikan mengikuti hak akses materi inti dan kelas.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (contentSaving) return;
                        setContentEditorOpen(false);
                        setEditingContentId(null);
                        setContentForm(emptyContent);
                        setSelectedContentFile(null);
                        setExistingContentFileName("");
                        setContentError("");
                      }}
                      disabled={contentSaving}
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      disabled={contentSaving}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                      {contentSaving ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {contentSaving
                        ? selectedContentFile
                          ? "Mengunggah & menyimpan..."
                          : "Menyimpan..."
                        : editingContentId
                          ? "Simpan Perubahan"
                          : "Simpan Mini Materi"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {!contentEditorOpen && (
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                <p className="text-[10px] leading-5 text-slate-400">
                  Perubahan tersimpan langsung ke Supabase.
                </p>
                <button
                  type="button"
                  onClick={closeContentModal}
                  disabled={contentSaving || reorderingContent}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
