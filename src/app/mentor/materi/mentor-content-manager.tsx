"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  File,
  FileText,
  Eye,
  Image as ImageIcon,
  Layers3,
  Link2,
  ListPlus,
  Music,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Type,
  Undo2,
  Video,
  X,
} from "lucide-react";

export type MentorCourseOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  cover_image_url: string | null;
};

type Section = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
};

type Lesson = {
  id: string;
  section_id: string;
  title: string;
  content: string | null;
  video_provider: string | null;
  video_url: string | null;
  resource_path: string | null;
  duration_minutes: number | null;
  is_preview: boolean | null;
  status: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type ContentType = "text" | "tiktok" | "youtube" | "image" | "pdf" | "audio" | "link" | "callout";

type MiniContent = {
  id: string;
  lesson_id: string;
  title: string;
  content_type: ContentType;
  body: string | null;
  media_url: string | null;
  resource_path: string | null;
  link_url: string | null;
  link_label: string | null;
  settings: Record<string, unknown> | null;
  position: number;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type ChapterLesson = Lesson & { contents: MiniContent[] };
type ChapterPayload = { section: Section; lessons: ChapterLesson[] };

type ChapterDraft = {
  id: string;
  section_id: string;
  payload: ChapterPayload;
  base_snapshot: ChapterPayload | null;
  is_deleted: boolean;
  status: "draft" | "pending" | "revision_requested" | "approved";
  admin_note: string | null;
  submitted_at: string | null;
  updated_at: string;
};

type ChapterSubmission = {
  id: string;
  section_id: string;
  title: string;
  action: "create" | "update" | "delete";
  status: "pending" | "approved" | "revision_requested";
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

function createEntityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const contentTypes: { value: ContentType; label: string }[] = [
  { value: "text", label: "Teks" },
  { value: "tiktok", label: "Video TikTok" },
  { value: "youtube", label: "Video YouTube" },
  { value: "image", label: "Gambar" },
  { value: "pdf", label: "PDF / Dokumen" },
  { value: "audio", label: "Audio" },
  { value: "link", label: "Tautan" },
  { value: "callout", label: "Catatan penting" },
];

const inputClass =
  "mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-800 outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "block text-sm font-medium leading-5 text-slate-700";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Coba kembali.";
}

function contentIcon(type: ContentType) {
  const Icon = {
    text: Type,
    tiktok: Video,
    youtube: PlayCircle,
    image: ImageIcon,
    pdf: File,
    audio: Music,
    link: Link2,
    callout: FileText,
  }[type];
  return <Icon size={15} />;
}

function getPreviewEmbedUrl(value: string | null, provider: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (provider === "youtube") {
      const id = url.hostname.includes("youtu.be")
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (provider === "vimeo") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function getTikTokPreviewUrl(value: string | null) {
  if (!value) return null;
  const id = value.match(/\/video\/(\d+)/)?.[1];
  return id ? `https://www.tiktok.com/embed/v2/${id}` : null;
}

function sortByPosition<T extends { position: number; created_at?: string; id: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.position - b.position ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    a.id.localeCompare(b.id),
  );
}

export default function MentorContentManager({
  courses,
  initialCourseId,
  initialError,
}: {
  courses: MentorCourseOption[];
  initialCourseId: string;
  initialError: string | null;
}) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);
  const [courseId, setCourseId] = useState(initialCourseId);
  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [contents, setContents] = useState<MiniContent[]>([]);
  const [drafts, setDrafts] = useState<ChapterDraft[]>([]);
  const [submissions, setSubmissions] = useState<ChapterSubmission[]>([]);
  const [officialSnapshots, setOfficialSnapshots] = useState<Record<string, ChapterPayload>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const [previewPayload, setPreviewPayload] = useState<ChapterPayload | null>(null);
  const [previewLessonId, setPreviewLessonId] = useState("");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);

  const [sectionEditor, setSectionEditor] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");

  const [lessonEditor, setLessonEditor] = useState(false);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [videoProvider, setVideoProvider] = useState("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("0");
  const [isPreview, setIsPreview] = useState(false);

  const [activeLessonId, setActiveLessonId] = useState("");
  const [contentEditor, setContentEditor] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [contentBody, setContentBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectedCourse = courses.find((course) => course.id === courseId) ?? null;
  const draftMap = useMemo(() => new Map(drafts.map((draft) => [draft.section_id, draft])), [drafts]);
  const activeContents = sortByPosition(contents.filter((item) => item.lesson_id === activeLessonId));

  const makePayload = useCallback((
    section: Section,
    lessonRows: Lesson[] = lessons,
    contentRows: MiniContent[] = contents,
  ): ChapterPayload => ({
    section,
    lessons: sortByPosition(lessonRows.filter((lesson) => lesson.section_id === section.id)).map((lesson) => ({
      ...lesson,
      contents: sortByPosition(contentRows.filter((item) => item.lesson_id === lesson.id)),
    })),
  }), [contents, lessons]);

  const loadData = useCallback(async () => {
    if (!courseId) {
      setSections([]);
      setLessons([]);
      setContents([]);
      setDrafts([]);
      setSubmissions([]);
      setOfficialSnapshots({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userResult.user?.id;
      if (!userId) throw new Error("Sesi Mentor tidak ditemukan. Silakan login kembali.");

      const { data: sectionRows, error: sectionError } = await supabase
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .order("position", { ascending: true });
      if (sectionError) throw sectionError;
      const baseSections = (sectionRows ?? []) as Section[];
      const sectionIds = baseSections.map((item) => item.id);

      let baseLessons: Lesson[] = [];
      let baseContents: MiniContent[] = [];
      if (sectionIds.length) {
        const { data: lessonRows, error: lessonError } = await supabase
          .from("lessons")
          .select("*")
          .in("section_id", sectionIds)
          .order("position", { ascending: true });
        if (lessonError) throw lessonError;
        baseLessons = (lessonRows ?? []) as Lesson[];
        const lessonIds = baseLessons.map((item) => item.id);
        if (lessonIds.length) {
          const { data: contentRows, error: contentError } = await supabase
            .from("lesson_contents")
            .select("*")
            .in("lesson_id", lessonIds)
            .order("position", { ascending: true });
          if (contentError) throw contentError;
          baseContents = (contentRows ?? []) as MiniContent[];
        }
      }

      const officialMap: Record<string, ChapterPayload> = {};
      for (const section of baseSections) {
        officialMap[section.id] = {
          section,
          lessons: sortByPosition(baseLessons.filter((lesson) => lesson.section_id === section.id)).map((lesson) => ({
            ...lesson,
            contents: sortByPosition(baseContents.filter((item) => item.lesson_id === lesson.id)),
          })),
        };
      }
      // Use a server-generated JSON snapshot as the exact concurrency baseline.
      // This prevents timestamp/serialization differences from causing false conflicts.
      const { data: snapshotRows, error: snapshotError } = await supabase.rpc("get_mentor_course_chapter_snapshots", {
        p_course_id: courseId,
      });
      if (snapshotError) throw snapshotError;
      for (const snapshot of (snapshotRows ?? []) as ChapterPayload[]) {
        if (snapshot?.section?.id) officialMap[snapshot.section.id] = snapshot;
      }

      const [{ data: draftRows, error: draftError }, { data: submissionRows, error: submissionError }] = await Promise.all([
        supabase
          .from("mentor_chapter_drafts")
          .select("id, section_id, payload, base_snapshot, is_deleted, status, admin_note, submitted_at, updated_at")
          .eq("mentor_user_id", userId)
          .eq("course_id", courseId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("mentor_chapter_submissions")
          .select("id, section_id, title, action, status, admin_note, submitted_at, reviewed_at")
          .eq("mentor_user_id", userId)
          .eq("course_id", courseId)
          .order("submitted_at", { ascending: false })
          .limit(12),
      ]);
      if (draftError) throw draftError;
      if (submissionError) throw submissionError;
      const nextDrafts = (draftRows ?? []) as ChapterDraft[];
      const nextSubmissions = (submissionRows ?? []) as ChapterSubmission[];

      const sectionMap = new Map<string, Section>(baseSections.map((item) => [item.id, item]));
      const lessonMap = new Map<string, Lesson>(baseLessons.map((item) => [item.id, item]));
      const contentMap = new Map<string, MiniContent>(baseContents.map((item) => [item.id, item]));

      for (const draft of nextDrafts) {
        const payload = draft.payload;
        if (!payload?.section || !Array.isArray(payload.lessons)) continue;
        sectionMap.set(draft.section_id, payload.section);
        for (const [id, lesson] of lessonMap) {
          if (lesson.section_id === draft.section_id) {
            lessonMap.delete(id);
            for (const [contentId, content] of contentMap) {
              if (content.lesson_id === id) contentMap.delete(contentId);
            }
          }
        }
        for (const chapterLesson of payload.lessons) {
          const { contents: nestedContents = [], ...lesson } = chapterLesson;
          lessonMap.set(lesson.id, lesson);
          for (const content of nestedContents) contentMap.set(content.id, content);
        }
      }

      setOfficialSnapshots(officialMap);
      setDrafts(nextDrafts);
      setSubmissions(nextSubmissions);
      setSections(sortByPosition(Array.from(sectionMap.values())));
      setLessons(sortByPosition(Array.from(lessonMap.values())));
      setContents(sortByPosition(Array.from(contentMap.values())));
    } catch (err) {
      setError(errorMessage(err));
      setSections([]);
      setLessons([]);
      setContents([]);
      setDrafts([]);
      setSubmissions([]);
      setOfficialSnapshots({});
    } finally {
      setLoading(false);
    }
  }, [courseId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function persistDraft(
    section: Section,
    lessonRows: Lesson[] = lessons,
    contentRows: MiniContent[] = contents,
    isDeleted = false,
  ) {
    const payload = makePayload(section, lessonRows, contentRows);
    const baseSnapshot = officialSnapshots[section.id] ?? null;
    const { error: saveError } = await supabase.rpc("save_mentor_chapter_draft", {
      p_course_id: courseId,
      p_section_id: section.id,
      p_payload: payload,
      p_base_snapshot: baseSnapshot,
      p_is_deleted: isDeleted,
    });
    if (saveError) throw saveError;
  }

  async function openParticipantPreview(section: Section) {
    const draft = draftMap.get(section.id);
    const payload = draft?.payload ?? makePayload(section);
    setPreviewPayload(payload);
    setPreviewLessonId(payload.lessons[0]?.id ?? "");
    setPreviewUrls({});
    const paths = Array.from(new Set(payload.lessons.flatMap((lesson) => lesson.contents
      .map((content) => content.resource_path)
      .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path!)))));
    if (paths.length === 0) return;
    setPreviewLoading(true);
    try {
      const signed = await Promise.all(paths.map(async (path) => {
        const { data, error: signedError } = await supabase.storage
          .from("learning-resources")
          .createSignedUrl(path, 60 * 60);
        return signedError || !data?.signedUrl ? null : [path, data.signedUrl] as const;
      }));
      setPreviewUrls(Object.fromEntries(signed.filter((item): item is readonly [string, string] => Boolean(item))));
    } finally {
      setPreviewLoading(false);
    }
  }

  function openSection(section?: Section) {
    setEditingSection(section?.id ?? null);
    setSectionTitle(section?.title ?? "");
    setSectionDescription(section?.description ?? "");
    setSectionEditor(true);
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sectionTitle.trim() || !courseId) return;
    const oldSection = sections.find((item) => item.id === editingSection);
    const lockedDraft = editingSection ? draftMap.get(editingSection) : null;
    if (lockedDraft?.status === "pending" || lockedDraft?.is_deleted) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const section: Section = {
        id: editingSection ?? createEntityId(),
        course_id: courseId,
        title: sectionTitle.trim(),
        description: sectionDescription.trim() || null,
        position: oldSection?.position ?? Math.max(-1, ...sections.map((item) => item.position)) + 1,
        created_at: oldSection?.created_at ?? new Date().toISOString(),
      };
      const nextSections = oldSection
        ? sections.map((item) => item.id === section.id ? section : item)
        : [...sections, section];
      await persistDraft(section);
      setSections(sortByPosition(nextSections));
      setSectionEditor(false);
      setNotice("Draft Bab berhasil disimpan. Tambahkan seluruh materi terlebih dahulu, lalu ajukan Bab saat sudah siap.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(section: Section) {
    const draft = draftMap.get(section.id);
    if (draft?.status === "pending") return;
    const confirmed = await confirmDialog({
      title: draft?.base_snapshot ? "Ajukan penghapusan Bab?" : "Hapus draft Bab?",
      message: draft?.base_snapshot
        ? `Tandai Bab \"${section.title}\" untuk diajukan sebagai penghapusan? Bab resmi baru dihapus jika Admin menyetujui.`
        : `Hapus draft Bab \"${section.title}\" beserta seluruh materi yang sedang disusun?`,
      confirmLabel: draft?.base_snapshot ? "Ajukan penghapusan" : "Ya, hapus draft",
      variant: "danger",
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      if (draft?.base_snapshot || officialSnapshots[section.id]) {
        await persistDraft(section, lessons, contents, true);
        setNotice("Bab ditandai untuk dihapus. Ajukan Bab agar Admin dapat memeriksa dan menyetujui penghapusannya.");
      } else {
        const { error: discardError } = await supabase.rpc("discard_mentor_chapter_draft", {
          p_course_id: courseId,
          p_section_id: section.id,
        });
        if (discardError) throw discardError;
        setNotice("Draft Bab berhasil dihapus.");
      }
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function undoDeleteSection(section: Section) {
    setSaving(true);
    setError("");
    try {
      await persistDraft(section, lessons, contents, false);
      setNotice("Penandaan penghapusan Bab dibatalkan.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openLesson(sectionId: string, lesson?: Lesson) {
    setActiveSectionId(sectionId);
    setEditingLesson(lesson?.id ?? null);
    setLessonTitle(lesson?.title ?? "");
    setLessonDescription(lesson?.content ?? "");
    setVideoProvider(lesson?.video_provider ?? "youtube");
    setVideoUrl(lesson?.video_url ?? "");
    setDuration(String(lesson?.duration_minutes ?? 0));
    setIsPreview(Boolean(lesson?.is_preview));
    setLessonEditor(true);
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lessonTitle.trim() || !activeSectionId) return;
    const section = sections.find((item) => item.id === activeSectionId);
    const draft = draftMap.get(activeSectionId);
    if (!section || draft?.status === "pending" || draft?.is_deleted) return;
    const minutes = Number(duration);
    if (!Number.isSafeInteger(minutes) || minutes < 0) {
      setError("Durasi materi harus berupa angka bulat 0 atau lebih.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const old = lessons.find((item) => item.id === editingLesson);
      const sectionLessons = lessons.filter((item) => item.section_id === activeSectionId);
      const lesson: Lesson = {
        id: editingLesson ?? createEntityId(),
        section_id: activeSectionId,
        title: lessonTitle.trim(),
        content: lessonDescription.trim() || null,
        video_provider: videoProvider,
        video_url: videoUrl.trim() || null,
        resource_path: old?.resource_path ?? null,
        duration_minutes: minutes,
        is_preview: isPreview,
        status: old?.status ?? "draft",
        position: old?.position ?? Math.max(-1, ...sectionLessons.map((item) => item.position)) + 1,
        created_at: old?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextLessons = old
        ? lessons.map((item) => item.id === lesson.id ? lesson : item)
        : [...lessons, lesson];
      await persistDraft(section, nextLessons, contents);
      setLessons(sortByPosition(nextLessons));
      setLessonEditor(false);
      setNotice("Materi Inti tersimpan di draft Bab. Kamu bisa lanjut menambah Materi Inti dan Mini Materi lainnya.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(lesson: Lesson) {
    const section = sections.find((item) => item.id === lesson.section_id);
    const draft = draftMap.get(lesson.section_id);
    if (!section || draft?.status === "pending" || draft?.is_deleted) return;
    const confirmed = await confirmDialog({
      title: "Hapus Materi Inti?",
      message: `Hapus Materi Inti \"${lesson.title}\" dari draft Bab? Perubahan baru masuk kurikulum resmi setelah Bab disetujui Admin.`,
      confirmLabel: "Ya, hapus materi",
      variant: "danger",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const nextLessons = lessons.filter((item) => item.id !== lesson.id);
      const nextContents = contents.filter((item) => item.lesson_id !== lesson.id);
      await persistDraft(section, nextLessons, nextContents);
      setLessons(nextLessons);
      setContents(nextContents);
      if (activeLessonId === lesson.id) setActiveLessonId("");
      setNotice("Materi Inti dihapus dari draft Bab.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openContent(lessonId: string, item?: MiniContent) {
    setActiveLessonId(lessonId);
    setEditingContent(item?.id ?? null);
    setContentTitle(item?.title ?? "");
    setContentType(item?.content_type ?? "text");
    setContentBody(item?.body ?? "");
    setMediaUrl(item?.media_url ?? "");
    setLinkUrl(item?.link_url ?? "");
    setLinkLabel(item?.link_label ?? "");
    setSelectedFile(null);
    setContentEditor(true);
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLessonId || !contentTitle.trim()) return;
    const lesson = lessons.find((item) => item.id === activeLessonId);
    const section = lesson ? sections.find((item) => item.id === lesson.section_id) : null;
    const draft = section ? draftMap.get(section.id) : null;
    if (!lesson || !section || draft?.status === "pending" || draft?.is_deleted) return;
    if (["text", "callout"].includes(contentType) && !contentBody.trim()) {
      setError("Isi mini materi wajib diisi.");
      return;
    }
    if (["tiktok", "youtube"].includes(contentType) && !mediaUrl.trim()) {
      setError("URL video wajib diisi.");
      return;
    }
    if (contentType === "link" && !linkUrl.trim()) {
      setError("URL tautan wajib diisi.");
      return;
    }
    if (["image", "pdf", "audio"].includes(contentType) && !selectedFile && !mediaUrl.trim() && !contents.find((item) => item.id === editingContent)?.resource_path) {
      setError("Pilih file atau masukkan URL file.");
      return;
    }
    if (selectedFile && selectedFile.size > 20 * 1024 * 1024) {
      setError("Ukuran file maksimal 20 MB.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const old = contents.find((item) => item.id === editingContent);
      let resourcePath = ["image", "pdf", "audio"].includes(contentType) && !mediaUrl.trim()
        ? old?.resource_path ?? null
        : null;
      if (selectedFile) {
        const allowed: Record<string, string[]> = {
          image: ["jpg", "jpeg", "png", "webp"],
          pdf: ["pdf"],
          audio: ["mp3", "wav", "ogg"],
        };
        const extension = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
        if (!allowed[contentType]?.includes(extension)) throw new Error("Format file tidak sesuai dengan jenis mini materi.");
        const safeName = selectedFile.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
        const fileId = createEntityId();
        const path = `courses/${courseId}/lessons/${activeLessonId}/${fileId}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("learning-resources").upload(path, selectedFile, {
          cacheControl: "3600",
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        resourcePath = path;
      }

      const position = old?.position ?? Math.max(-1, ...activeContents.map((item) => item.position)) + 1;
      const item: MiniContent = {
        id: editingContent ?? createEntityId(),
        lesson_id: activeLessonId,
        title: contentTitle.trim(),
        content_type: contentType,
        body: contentBody.trim() || null,
        media_url: selectedFile ? null : mediaUrl.trim() || null,
        resource_path: resourcePath,
        link_url: linkUrl.trim() || null,
        link_label: linkLabel.trim() || null,
        settings: {
          ...(old?.settings ?? {}),
          ...(selectedFile ? {
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            mime_type: selectedFile.type || null,
          } : {}),
        },
        position,
        status: old?.status ?? "draft",
        created_at: old?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextContents = old
        ? contents.map((current) => current.id === item.id ? item : current)
        : [...contents, item];
      await persistDraft(section, lessons, nextContents);
      setContents(sortByPosition(nextContents));
      setContentEditor(false);
      setSelectedFile(null);
      setNotice("Mini Materi tersimpan di draft Bab. Konten resmi peserta belum berubah.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteContent(item: MiniContent) {
    const lesson = lessons.find((row) => row.id === item.lesson_id);
    const section = lesson ? sections.find((row) => row.id === lesson.section_id) : null;
    const draft = section ? draftMap.get(section.id) : null;
    if (!section || draft?.status === "pending" || draft?.is_deleted) return;
    const confirmed = await confirmDialog({
      title: "Hapus Mini Materi?",
      message: `Hapus Mini Materi \"${item.title}\" dari draft Bab?`,
      confirmLabel: "Ya, hapus Mini Materi",
      variant: "danger",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const nextContents = contents.filter((current) => current.id !== item.id);
      await persistDraft(section, lessons, nextContents);
      setContents(nextContents);
      setNotice("Mini Materi dihapus dari draft Bab.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function moveSection(section: Section, direction: -1 | 1) {
    const ordered = sortByPosition(sections);
    const index = ordered.findIndex((item) => item.id === section.id);
    const other = ordered[index + direction];
    if (!other) return;
    const firstDraft = draftMap.get(section.id);
    const secondDraft = draftMap.get(other.id);
    if (firstDraft?.status === "pending" || secondDraft?.status === "pending" || firstDraft?.is_deleted || secondDraft?.is_deleted) {
      setError("Selesaikan pengajuan atau batalkan penandaan penghapusan sebelum mengubah urutan Bab.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const nextFirst = { ...section, position: other.position };
      const nextSecond = { ...other, position: section.position };
      await persistDraft(nextFirst);
      await persistDraft(nextSecond);
      setNotice("Urutan Bab tersimpan sebagai draft. Ajukan masing-masing Bab agar perubahan urutan diterapkan.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function submitChapter(section: Section) {
    const draft = draftMap.get(section.id);
    if (!draft) {
      setError("Simpan perubahan Bab terlebih dahulu sebelum mengajukan.");
      return;
    }
    if (draft.status === "pending") return;
    if (!draft.is_deleted && draft.payload.lessons.length < 1) {
      setError("Tambahkan minimal satu Materi Inti sebelum mengajukan Bab.");
      return;
    }
    const confirmText = draft.is_deleted
      ? `Ajukan penghapusan Bab \"${section.title}\" kepada Admin?`
      : `Ajukan seluruh Bab \"${section.title}\" beserta ${draft.payload.lessons.length} Materi Inti dan seluruh Mini Materinya kepada Admin?`;
    const confirmed = await confirmDialog({
      title: draft.is_deleted ? "Ajukan penghapusan Bab?" : "Ajukan Bab ke Admin?",
      message: confirmText,
      confirmLabel: draft.is_deleted ? "Ajukan penghapusan" : "Ajukan Bab",
      variant: "primary",
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: submitError } = await supabase.rpc("submit_mentor_chapter_draft", {
        p_course_id: courseId,
        p_section_id: section.id,
        p_mentor_note: null,
      });
      if (submitError) throw submitError;
      setNotice(`Bab \"${section.title}\" berhasil diajukan secara utuh. Semua isinya sekarang menunggu pemeriksaan Admin.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    sections: sections.length,
    lessons: lessons.length,
    mini: contents.length,
    published: lessons.filter((item) => item.status === "published").length,
  };

  const activeHistory = submissions.filter((item) => item.status === "pending" || item.status === "revision_requested").slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-[0_14px_34px_rgba(76,29,149,0.12)] sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Curriculum studio</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Bangun Bab secara lengkap</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">
              Buat Bab, susun semua Materi Inti, dan lengkapi Mini Materi terlebih dahulu. Draft tersimpan tanpa menunggu Admin. Ajukan satu Bab sekaligus saat sudah siap diperiksa.
            </p>
          </div>
          <Link href="/mentor/publikasi" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[10px] font-bold text-white hover:bg-white/20">
            <ClipboardCheck size={14} /> Status pengajuan
          </Link>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{notice}</div>}

      {activeHistory.length > 0 && (
        <section className="rounded-[20px] border border-violet-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">Status pengajuan Bab</h3>
              <p className="mt-1 text-[10px] text-slate-500">Pengajuan dilakukan per Bab, bukan per Materi Inti atau Mini Materi.</p>
            </div>
            <Link href="/mentor/publikasi" className="shrink-0 text-[10px] font-bold text-violet-700 hover:underline">Lihat semua</Link>
          </div>
          <div className="mt-3 space-y-2">
            {activeHistory.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold text-slate-800">{item.title}</p>
                  <p className="text-[9px] text-slate-500">Satu Bab · Diajukan {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.submitted_at))}</p>
                  {item.admin_note && item.status === "revision_requested" && <p className="mt-1 text-[9px] text-rose-700">Catatan Admin: {item.admin_note}</p>}
                </div>
                <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${item.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>{item.status === "pending" ? "Menunggu Admin" : "Perlu revisi"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[#EEEAF7] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="mentor-course" className={labelClass}>Pilih kelas yang ditugaskan</label>
            <select id="mentor-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className={inputClass}>
              {courses.length === 0 && <option value="">Belum ada kelas ditugaskan</option>}
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadData()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Perbarui</button>
            <button type="button" onClick={() => openSection()} disabled={!courseId || saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white hover:bg-violet-800 disabled:opacity-50"><Plus size={14} /> Tambah Bab</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total Bab", stats.sections],
            ["Materi Inti", stats.lessons],
            ["Mini Materi", stats.mini],
            ["Materi Terbit", stats.published],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[9px] font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {!courseId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpen className="mx-auto text-slate-300" size={32} />
          <h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada kelas yang ditugaskan</h3>
          <p className="mt-1 text-xs text-slate-500">Minta Admin menetapkan kelas melalui Manajemen Mentor.</p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-[#EEEAF7] bg-white p-10 text-center text-xs text-slate-500"><RefreshCw className="mx-auto mb-2 animate-spin text-violet-700" size={20} />Memuat struktur kurikulum...</div>
      ) : (
        <div className="space-y-4">
          {sections.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Layers3 className="mx-auto text-slate-300" size={32} />
              <h3 className="mt-3 text-sm font-bold text-slate-800">Kurikulum belum memiliki Bab</h3>
              <p className="mt-1 text-xs text-slate-500">Mulai dengan membuat Bab pertama untuk kelas {selectedCourse?.title ?? ""}.</p>
              <button type="button" onClick={() => openSection()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white"><Plus size={14} /> Buat Bab pertama</button>
            </div>
          )}

          {sortByPosition(sections).map((section, sectionIndex) => {
            const sectionLessons = sortByPosition(lessons.filter((lesson) => lesson.section_id === section.id));
            const draft = draftMap.get(section.id);
            const locked = draft?.status === "pending";
            const markedDelete = Boolean(draft?.is_deleted);
            const statusLabel = locked ? "Menunggu Admin" : draft?.status === "revision_requested" ? "Perlu revisi" : draft?.status === "approved" ? "Disetujui" : draft ? "Draft tersimpan" : "Materi resmi";
            const statusClass = locked ? "bg-amber-50 text-amber-700" : draft?.status === "revision_requested" ? "bg-rose-50 text-rose-700" : draft?.status === "approved" ? "bg-emerald-50 text-emerald-700" : draft ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700";
            return (
              <section key={section.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${markedDelete ? "border-rose-200" : "border-[#EEEAF7]"}`}>
                <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <Layers3 size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-700">Bab {sectionIndex + 1}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[9px] font-medium ${statusClass}`}>{statusLabel}</span>
                          {markedDelete && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-medium text-rose-700">Ditandai untuk dihapus</span>}
                        </div>
                        <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900">{section.title}</h3>
                        {section.description && <p className="mt-1.5 max-w-[78ch] text-xs leading-6 text-slate-500">{section.description}</p>}
                        <p className="mt-1.5 text-[9px] font-medium text-slate-400">{sectionLessons.length} Materi Inti · {contents.filter((item) => sectionLessons.some((lesson) => lesson.id === item.lesson_id)).length} Mini Materi</p>
                        {draft?.admin_note && draft.status === "revision_requested" && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">Catatan Admin: {draft.admin_note}</p>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:max-w-[290px]">
                      <button type="button" title="Pindah Bab ke atas" aria-label="Pindah Bab ke atas" onClick={() => void moveSection(section, -1)} disabled={sectionIndex === 0 || saving || locked || markedDelete} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-30 sm:h-9 sm:w-9"><ArrowUp size={15} /></button>
                      <button type="button" title="Pindah Bab ke bawah" aria-label="Pindah Bab ke bawah" onClick={() => void moveSection(section, 1)} disabled={sectionIndex === sections.length - 1 || saving || locked || markedDelete} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-30 sm:h-9 sm:w-9"><ArrowDown size={15} /></button>
                      <button type="button" onClick={() => void openParticipantPreview(section)} disabled={markedDelete || previewLoading} aria-label="Preview peserta" title="Preview peserta" className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-40 sm:h-9 sm:w-9"><Eye size={16} /></button>
                      <button type="button" onClick={() => openSection(section)} disabled={locked || markedDelete || saving} aria-label="Edit Bab" title="Edit Bab" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:h-9 sm:w-9"><Pencil size={15} /></button>
                      {markedDelete ? (
                        <button type="button" onClick={() => void undoDeleteSection(section)} disabled={saving || locked} aria-label="Batalkan penghapusan Bab" title="Batalkan penghapusan Bab" className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40 sm:h-9 sm:w-9"><Undo2 size={15} /></button>
                      ) : (
                        <button type="button" onClick={() => void deleteSection(section)} disabled={saving || locked} aria-label="Hapus Bab" title="Hapus Bab" className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 sm:h-9 sm:w-9"><Trash2 size={15} /></button>
                      )}
                      <button type="button" onClick={() => openLesson(section.id)} disabled={locked || markedDelete || saving} aria-label="Tambah Materi Inti" title="Tambah Materi Inti" className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#260047] text-white shadow-sm transition hover:bg-[#09483F] disabled:opacity-40 sm:h-9 sm:w-9"><Plus size={17} /></button>
                    </div>
                  </div>
                </div>

                {draft && !locked && draft.status !== "approved" && (
                  <div className="flex justify-end border-b border-slate-100 bg-[#FCFBFE] px-4 py-3 sm:px-5">
                    <button
                      type="button"
                      onClick={() => void submitChapter(section)}
                      disabled={saving}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      <Send size={14} />
                      {saving
                        ? "Memproses..."
                        : markedDelete
                          ? "Ajukan Penghapusan ke Admin"
                          : "Ajukan Bab ke Admin"}
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {sectionLessons.length === 0 ? (
                    <div className="p-5 text-center text-[10px] text-slate-400">Belum ada Materi Inti pada Bab ini. Tambahkan materi sebelum mengajukan Bab.</div>
                  ) : sectionLessons.map((lesson, lessonIndex) => {
                    const lessonContents = sortByPosition(contents.filter((item) => item.lesson_id === lesson.id));
                    return (
                      <div key={lesson.id} className="p-4 sm:p-5">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BookOpen size={16} /></div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400">Materi {lessonIndex + 1}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${lesson.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>{lesson.status === "published" ? "Terbit saat ini" : "Draft Mentor"}</span>
                              </div>
                              <h4 className="mt-1 text-xs font-extrabold text-slate-900">{lesson.title}</h4>
                              {lesson.content && <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{lesson.content}</p>}
                              <p className="mt-1 text-[9px] text-slate-400">{lesson.duration_minutes ? `${lesson.duration_minutes} menit` : "Durasi fleksibel"} · {lessonContents.length} Mini Materi</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <button type="button" onClick={() => openLesson(section.id, lesson)} disabled={locked || markedDelete || saving} aria-label={`Edit materi ${lesson.title}`} title="Edit Materi Inti" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:h-9 sm:w-9"><Pencil size={15} /></button>
                            <button type="button" onClick={() => setActiveLessonId(activeLessonId === lesson.id ? "" : lesson.id)} aria-label={`Kelola Mini Materi untuk ${lesson.title}`} title={`Kelola Mini Materi (${lessonContents.length})`} aria-expanded={activeLessonId === lesson.id} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition sm:h-9 sm:w-9 ${activeLessonId === lesson.id ? "border-violet-200 bg-violet-100 text-violet-800" : "border-violet-100 bg-violet-50 text-violet-800 hover:bg-violet-100"}`}><ListPlus size={16} /></button>
                            <button type="button" onClick={() => void deleteLesson(lesson)} disabled={saving || locked || markedDelete} aria-label={`Hapus materi ${lesson.title}`} title="Hapus Materi Inti" className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 sm:h-9 sm:w-9"><Trash2 size={15} /></button>
                          </div>
                        </div>

                        {activeLessonId === lesson.id && (
                          <div className="mt-4 rounded-2xl border border-violet-100 bg-[#FBFAFF] p-3 sm:p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-violet-700">Mini Materi</p>
                                <p className="mt-1 text-[10px] text-slate-500">Konten pendukung untuk {lesson.title}.</p>
                              </div>
                              <button type="button" onClick={() => openContent(lesson.id)} disabled={locked || markedDelete || saving} aria-label="Tambah Mini Materi" title="Tambah Mini Materi" className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-700 text-white transition hover:bg-violet-800 disabled:opacity-40"><Plus size={16} /></button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {lessonContents.length === 0 ? <p className="rounded-xl border border-dashed border-violet-200 p-4 text-center text-[10px] text-slate-400">Belum ada Mini Materi.</p> : lessonContents.map((item) => (
                                <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-violet-700">{contentIcon(item.content_type)}</span>
                                    <div className="min-w-0">
                                      <p className="truncate text-[10px] font-bold text-slate-800">{item.title}</p>
                                      <p className="mt-0.5 text-[9px] text-slate-400">{contentTypes.find((type) => type.value === item.content_type)?.label ?? item.content_type}</p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <button type="button" onClick={() => openContent(lesson.id, item)} disabled={saving || locked || markedDelete} aria-label={`Edit mini materi ${item.title}`} title="Edit Mini Materi" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"><Pencil size={14} /></button>
                                    <button type="button" onClick={() => void deleteContent(item)} disabled={saving || locked || markedDelete} aria-label={`Hapus mini materi ${item.title}`} title="Hapus Mini Materi" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[9px] leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>{locked ? "Bab sedang diperiksa Admin. Draft dikunci sementara agar isi yang diperiksa tidak berubah." : markedDelete ? "Bab ditandai untuk penghapusan. Ajukan agar Admin dapat memeriksanya." : "Perubahan tersimpan sebagai draft. Materi resmi peserta tidak berubah sebelum Bab disetujui."}</span>
                  {draft?.updated_at && <span>Terakhir disimpan: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.updated_at))}</span>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {previewPayload && (() => {
        const activeLesson = previewPayload.lessons.find((lesson) => lesson.id === previewLessonId) ?? previewPayload.lessons[0] ?? null;
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5">
            <section className="my-2 flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#F7F6FC] shadow-2xl sm:my-5 sm:max-h-[92vh]">
              <header className="flex items-start justify-between gap-3 bg-[#260047] px-4 py-4 text-white sm:px-6">
                <div className="min-w-0"><p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-white/60">Student preview · Read only</p><h3 className="mt-1 truncate text-base font-extrabold sm:text-lg">{previewPayload.section.title}</h3><p className="mt-1 text-[10px] text-white/70">Tampilan simulasi ruang belajar peserta. Progres dan status selesai tidak akan disimpan.</p></div>
                <button type="button" onClick={() => setPreviewPayload(null)} aria-label="Tutup pratinjau" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"><X size={16} /></button>
              </header>
              <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
                  <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#09483F]">Daftar Materi</p>
                  <div className="mt-3 space-y-2">
                    {previewPayload.lessons.map((lesson, index) => (
                      <button key={lesson.id} type="button" onClick={() => setPreviewLessonId(lesson.id)} className={`w-full rounded-xl border p-3 text-left transition ${activeLesson?.id === lesson.id ? "border-[#260047] bg-[#F7F3FA]" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                        <span className="text-[9px] font-bold text-slate-400">Materi {index + 1}</span><span className="mt-1 block text-[11px] font-bold text-slate-800">{lesson.title}</span><span className="mt-1 block text-[9px] text-slate-400">{lesson.contents.length} Mini Materi</span>
                      </button>
                    ))}
                    {previewPayload.lessons.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-400">Belum ada Materi Inti pada Bab ini.</p>}
                  </div>
                </aside>
                <main className="min-w-0 p-4 sm:p-6">
                  {previewLoading && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-[10px] text-amber-800">Menyiapkan tautan file untuk pratinjau...</div>}
                  {!activeLesson ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">Pilih materi untuk melihat tampilannya.</div> : (
                    <article className="mx-auto max-w-3xl space-y-4">
                      <div className="rounded-[20px] bg-white p-4 shadow-sm sm:p-6"><p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#09483F]">{previewPayload.section.title}</p><h4 className="mt-2 text-xl font-extrabold leading-tight text-slate-900">{activeLesson.title}</h4>{activeLesson.content && <p className="mt-3 whitespace-pre-wrap text-xs leading-7 text-slate-600">{activeLesson.content}</p>}{activeLesson.duration_minutes ? <p className="mt-3 text-[9px] text-slate-400">Durasi {activeLesson.duration_minutes} menit</p> : null}</div>
                      {activeLesson.video_url && (
                        <div className="overflow-hidden rounded-[20px] bg-black shadow-sm">
                          {getPreviewEmbedUrl(activeLesson.video_url, activeLesson.video_provider ?? "youtube") ? <iframe src={getPreviewEmbedUrl(activeLesson.video_url, activeLesson.video_provider ?? "youtube") ?? undefined} title={activeLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="aspect-video w-full" /> : <a href={activeLesson.video_url} target="_blank" rel="noreferrer" className="block p-5 text-center text-xs font-bold text-white">Buka video / media pembelajaran</a>}
                        </div>
                      )}
                      <div className="space-y-3">
                        {activeLesson.contents.map((content, index) => {
                          const fileUrl = content.resource_path ? (previewUrls[content.resource_path] ?? (/^https?:\/\//i.test(content.resource_path) ? content.resource_path : null)) : content.media_url;
                          const youtubeEmbed = content.content_type === "youtube" ? getPreviewEmbedUrl(content.media_url, "youtube") : null;
                          const tiktokEmbed = content.content_type === "tiktok" ? getTikTokPreviewUrl(content.media_url) : null;
                          return (
                            <section key={content.id} className="overflow-hidden rounded-[18px] border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                              <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#09483F]">Mini Materi {index + 1}</p><h5 className="mt-1 text-sm font-extrabold text-slate-900">{content.title}</h5>
                              {content.content_type === "text" && <p className="mt-3 whitespace-pre-wrap text-xs leading-7 text-slate-600">{content.body}</p>}
                              {content.content_type === "callout" && <div className="mt-3 rounded-xl border-l-4 border-[#09483F] bg-emerald-50 p-4 text-xs leading-6 text-emerald-950">{content.body}</div>}
                              {youtubeEmbed && <iframe src={youtubeEmbed} title={content.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="mt-3 aspect-video w-full rounded-xl" />}
                              {tiktokEmbed && <iframe src={tiktokEmbed} title={content.title} allow="encrypted-media; fullscreen; picture-in-picture" className="mx-auto mt-3 aspect-[9/16] w-full max-w-[300px] rounded-xl" />}
                              {content.content_type === "image" && (fileUrl ? <img src={fileUrl} alt={content.title} className="mt-3 max-h-[520px] w-full rounded-xl object-contain" /> : <p className="mt-3 text-[10px] text-amber-700">File gambar belum dapat dimuat untuk pratinjau.</p>)}
                              {content.content_type === "pdf" && (fileUrl ? <iframe src={fileUrl} title={content.title} className="mt-3 h-[480px] w-full rounded-xl border border-slate-100" /> : <p className="mt-3 text-[10px] text-amber-700">File PDF belum dapat dimuat untuk pratinjau.</p>)}
                              {content.content_type === "audio" && (fileUrl ? <audio controls src={fileUrl} className="mt-3 w-full" /> : <p className="mt-3 text-[10px] text-amber-700">File audio belum dapat dimuat untuk pratinjau.</p>)}
                              {content.content_type === "link" && content.link_url && <a href={content.link_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-[#260047] underline">{content.link_label || "Buka tautan"}</a>}
                              {(content.content_type === "youtube" && !youtubeEmbed || content.content_type === "tiktok" && !tiktokEmbed) && content.media_url && <a href={content.media_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-[#260047] underline">Buka video di tab baru</a>}
                            </section>
                          );
                        })}
                        {activeLesson.contents.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">Belum ada Mini Materi untuk materi ini.</div>}
                      </div>
                    </article>
                  )}
                </main>
              </div>
            </section>
          </div>
        );
      })()}

      {sectionEditor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveSection} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Chapter draft</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{editingSection ? "Edit Bab" : "Tambah Bab"}</h3></div>
              <button type="button" onClick={() => setSectionEditor(false)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><X size={15} /></button>
            </div>
            <label className={`${labelClass} mt-5`}>Nama Bab *<input required maxLength={160} value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} className={inputClass} placeholder="Contoh: Dasar-Dasar Desain" /></label>
            <label className={`${labelClass} mt-4`}>Deskripsi Bab<textarea rows={3} maxLength={1000} value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} className="mt-1.5 min-h-[112px] w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal leading-6 outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500" placeholder="Gambaran singkat isi Bab." /></label>
            <p className="mt-4 rounded-xl bg-violet-50 p-3 text-xs font-normal leading-5 text-violet-800">Bab disimpan sebagai draft. Kamu tetap bisa menambahkan dan mengedit seluruh Materi Inti serta Mini Materi sebelum mengajukannya ke Admin.</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSectionEditor(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Batal</button><button disabled={saving} className="h-11 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Draft Bab"}</button></div>
          </form>
        </div>
      )}

      {lessonEditor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveLesson} className="my-5 w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Chapter draft</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{editingLesson ? "Edit Materi Inti" : "Tambah Materi Inti"}</h3></div>
              <button type="button" onClick={() => setLessonEditor(false)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><X size={15} /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className={labelClass}>Judul Materi *<input required maxLength={180} value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Ringkasan / Deskripsi<textarea rows={3} value={lessonDescription} onChange={(event) => setLessonDescription(event.target.value)} className="mt-1.5 min-h-[112px] w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal leading-6 outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Penyedia video<select value={videoProvider} onChange={(event) => setVideoProvider(event.target.value)} className={inputClass}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="external">Eksternal</option></select></label>
                <label className={labelClass}>Durasi (menit)<input type="number" min="0" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass} /></label>
              </div>
              <label className={labelClass}>URL video / media<input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={inputClass} placeholder="https://" /></label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} className="rounded border-slate-300 text-violet-700 focus:ring-violet-600" /> Jadikan materi pratinjau</label>
              <p className="rounded-xl bg-violet-50 p-3 text-xs font-normal leading-5 text-violet-800">Materi Inti menjadi bagian dari draft Bab. Simpan beberapa materi sekaligus, lalu ajukan Bab ketika seluruh isinya siap.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setLessonEditor(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Batal</button><button disabled={saving} className="h-11 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Materi"}</button></div>
          </form>
        </div>
      )}

      {contentEditor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveContent} className="my-5 w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Chapter draft</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{editingContent ? "Edit Mini Materi" : "Tambah Mini Materi"}</h3></div>
              <button type="button" onClick={() => setContentEditor(false)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><X size={15} /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className={labelClass}>Judul Mini Materi *<input required maxLength={180} value={contentTitle} onChange={(event) => setContentTitle(event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Jenis Konten<select value={contentType} onChange={(event) => { setContentType(event.target.value as ContentType); setSelectedFile(null); }} className={inputClass}>{contentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              {["text", "callout"].includes(contentType) && <label className={labelClass}>Isi konten *<textarea rows={5} value={contentBody} onChange={(event) => setContentBody(event.target.value)} className="mt-1.5 min-h-[132px] w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal leading-6 outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500" /></label>}
              {["tiktok", "youtube"].includes(contentType) && <label className={labelClass}>URL video *<input required type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} className={inputClass} placeholder="https://" /></label>}
              {["image", "pdf", "audio"].includes(contentType) && (
                <div className="space-y-2">
                  <label className={labelClass}>Upload file (maks. 20 MB)<input type="file" accept={contentType === "image" ? ".jpg,.jpeg,.png,.webp" : contentType === "pdf" ? ".pdf" : ".mp3,.wav,.ogg"} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-800" /></label>
                  <label className={labelClass}>Atau URL file<input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} className={inputClass} placeholder="https://" /></label>
                </div>
              )}
              {contentType === "link" && <><label className={labelClass}>URL tautan *<input required type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className={inputClass} placeholder="https://" /></label><label className={labelClass}>Label tautan<input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} className={inputClass} placeholder="Buka referensi" /></label></>}
              <p className="rounded-xl bg-violet-50 p-3 text-xs font-normal leading-5 text-violet-800">Mini Materi tersimpan di draft Bab dan akan diperiksa Admin bersama seluruh isi Bab.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setContentEditor(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Batal</button><button disabled={saving} className="h-11 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Mini Materi"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
