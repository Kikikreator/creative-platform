"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CourseCertificatePanel from "@/components/certificates/course-certificate-panel";
import LogoutButton from "@/components/auth/logout-button";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Layers3,
  Link2,
  ListTree,
  Paperclip,
  RefreshCw,
  Send,
  Play,
  Video,
  Sparkles,
  X,
} from "lucide-react";
// =====================================================
// TYPES
// =====================================================
export type LearningCourse = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  mentor_name: string | null;
  benefits: unknown;
  target_audience: unknown;
  status?: string | null;
};
export type LearningSection = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number | null;
  created_at: string;
};
export type LearningLesson = {
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
  position: number | null;
  created_at: string;
  updated_at: string;
};
export type LearningContentType =
  | "text"
  | "tiktok"
  | "youtube"
  | "image"
  | "pdf"
  | "audio"
  | "link"
  | "callout";
export type LearningContent = {
  id: string;
  lesson_id: string;
  title: string;
  content_type: LearningContentType;
  body: string | null;
  media_url: string | null;
  resource_path: string | null;
  link_url: string | null;
  link_label: string | null;
  settings: Record<string, unknown> | null;
  position: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LearningTaskPlacement =
  | "section_start"
  | "before_lesson"
  | "after_lesson"
  | "section_end";

export type LearningTaskSubmissionType =
  | "text"
  | "file"
  | "link"
  | "text_and_file";

export type LearningTask = {
  id: string;
  course_id: string;
  section_id: string;
  anchor_lesson_id: string | null;
  placement: LearningTaskPlacement;
  position: number;
  title: string;
  description: string | null;
  instructions: string;
  submission_type: LearningTaskSubmissionType;
  reference_url: string | null;
  due_at: string | null;
  max_score: number | string;
  is_required: boolean;
  allow_late_submission: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LearningTaskSubmission = {
  id: string;
  task_id: string;
  user_id: string;
  answer_text: string | null;
  answer_url: string | null;
  file_path: string | null;
  attempt_count: number;
  status: "submitted" | "revision_requested" | "reviewed";
  score: number | string | null;
  mentor_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

type LearningRoomProps = {
  course: LearningCourse | null;
  sections: LearningSection[];
  lessons: LearningLesson[];
  contents: LearningContent[];
  tasks: LearningTask[];
  submissions: LearningTaskSubmission[];
  userId: string;
  profileName: string;
  grantedAt: string | null;
  loadError: string | null;
  taskLoadError: string | null;
  submissionLoadError: string | null;
  completedLessonIds?: string[];
};
// =====================================================
// HELPERS
// =====================================================
function formatShortDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
function formatDuration(value: number | null) {
  if (!value || value <= 0) {
    return "Durasi fleksibel";
  }
  return `${value} menit`;
}
function getSafeUrl(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.startsWith("/")) {
    return clean;
  }
  try {
    const url = new URL(clean);
    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
function getYouTubeEmbedUrl(rawUrl: string | null, controls = true) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (
      !url.hostname.includes("youtube.com") &&
      !url.hostname.includes("youtu.be")
    ) {
      return null;
    }
    let videoId = "";
    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else {
      videoId =
        url.searchParams.get("v") ??
        url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ??
        "";
    }
    if (!videoId) return null;

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set("controls", controls ? "1" : "0");
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("playsinline", "1");
    return embedUrl.toString();
  } catch {
    return null;
  }
}
function getVimeoEmbedUrl(rawUrl: string | null) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes("vimeo.com")) {
      return null;
    }
    const videoId = url.pathname
      .split("/")
      .filter(Boolean)
      .pop();
    if (!videoId || !/^\d+$/.test(videoId)) {
      return null;
    }
    return `https://player.vimeo.com/video/${videoId}`;
  } catch {
    return null;
  }
}
function getTikTokEmbedUrl(rawUrl: string | null) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "tiktok.com" && !hostname.endsWith(".tiktok.com")) {
      return null;
    }
    const videoId =
      url.pathname.match(/\/video\/(\d+)/i)?.[1] ??
      url.pathname.match(/\/player\/v1\/(\d+)/i)?.[1] ??
      url.pathname.match(/\/embed\/v2\/(\d+)/i)?.[1] ??
      url.pathname.match(/\/share\/video\/(\d+)/i)?.[1] ??
      null;
    if (!videoId) return null;
    return `https://www.tiktok.com/player/v1/${videoId}?music_info=1&description=1`;
  } catch {
    return null;
  }
}
function isDirectVideoFile(url: string) {
  return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url);
}
function getOrderedLessons(
  sections: LearningSection[],
  lessons: LearningLesson[]
) {
  const publishedLessons = lessons.filter(
    (lesson) => lesson.status === "published"
  );
  const orderedSections = [...sections].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  return orderedSections.flatMap((section) =>
    publishedLessons
      .filter((lesson) => lesson.section_id === section.id)
      .sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      )
  );
}

type CurriculumEntry =
  | { type: "lesson"; lesson: LearningLesson }
  | { type: "task"; task: LearningTask };

function sortTasks(tasks: LearningTask[]) {
  return [...tasks].sort(
    (a, b) =>
      (a.position ?? 0) - (b.position ?? 0) ||
      a.created_at.localeCompare(b.created_at)
  );
}

function getSectionTimeline(
  sectionId: string,
  lessons: LearningLesson[],
  tasks: LearningTask[]
): CurriculumEntry[] {
  const sectionLessons = lessons.filter(
    (lesson) => lesson.section_id === sectionId
  );
  const sectionTasks = sortTasks(
    tasks.filter((task) => task.section_id === sectionId)
  );
  const usedTaskIds = new Set<string>();
  const timeline: CurriculumEntry[] = [];

  const addTasks = (items: LearningTask[]) => {
    for (const task of items) {
      usedTaskIds.add(task.id);
      timeline.push({ type: "task", task });
    }
  };

  addTasks(
    sectionTasks.filter((task) => task.placement === "section_start")
  );

  for (const lesson of sectionLessons) {
    addTasks(
      sectionTasks.filter(
        (task) =>
          task.placement === "before_lesson" &&
          task.anchor_lesson_id === lesson.id
      )
    );

    timeline.push({ type: "lesson", lesson });

    addTasks(
      sectionTasks.filter(
        (task) =>
          task.placement === "after_lesson" &&
          task.anchor_lesson_id === lesson.id
      )
    );
  }

  addTasks(
    sectionTasks.filter((task) => task.placement === "section_end")
  );

  // Jangan sampai tugas hilang jika materi jangkar tidak ikut dipublikasikan.
  addTasks(sectionTasks.filter((task) => !usedTaskIds.has(task.id)));

  return timeline;
}

function formatTaskDateTime(value: string | null) {
  if (!value) return "Tidak ada batas waktu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jadwal tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSubmissionTypeLabel(type: LearningTaskSubmissionType) {
  const labels: Record<LearningTaskSubmissionType, string> = {
    text: "Jawaban teks",
    file: "Unggah file",
    link: "Tautan",
    text_and_file: "Teks dan file",
  };
  return labels[type];
}

function getSubmissionStatusLabel(
  submission: LearningTaskSubmission | undefined
) {
  if (!submission) return "Belum dikerjakan";
  if (submission.status === "submitted") return "Menunggu pemeriksaan";
  if (submission.status === "revision_requested") return "Perlu revisi";
  return "Sudah dinilai";
}

function getSubmissionStatusClass(
  submission: LearningTaskSubmission | undefined
) {
  if (!submission) return "bg-slate-100 text-slate-600";
  if (submission.status === "submitted") return "bg-amber-100 text-amber-800";
  if (submission.status === "revision_requested") return "bg-rose-100 text-rose-700";
  return "bg-emerald-100 text-emerald-700";
}
function getContentSetting<T extends string>(
  settings: Record<string, unknown> | null,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = settings?.[key];
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}
function getContentBooleanSetting(
  settings: Record<string, unknown> | null,
  key: string,
  fallback: boolean
) {
  const value = settings?.[key];
  return typeof value === "boolean" ? value : fallback;
}
function getContentLabel(type: string) {
  const labels: Record<string, string> = {
    text: "Materi Teks",
    tiktok: "Video Pendek TikTok",
    youtube: "Video YouTube",
    image: "Gambar",
    pdf: "Dokumen PDF",
    audio: "Audio",
    link: "Tautan",
    callout: "Catatan Penting",
  };
  return labels[type] ?? "Materi Pembelajaran";
}
// =====================================================
// MAIN VIDEO PLAYER
// =====================================================
type LessonMedia = {
  type: "embed" | "video" | "link" | "empty";
  url: string | null;
  provider: string;
};
function getLessonMedia(
  lesson: LearningLesson
): LessonMedia {
  const rawUrl =
    lesson.video_url || lesson.resource_path;
  const safeUrl = getSafeUrl(rawUrl);
  if (!safeUrl) {
    return {
      type: "empty",
      url: null,
      provider: "",
    };
  }
  const youtubeUrl = getYouTubeEmbedUrl(safeUrl);
  if (youtubeUrl) {
    return {
      type: "embed",
      url: youtubeUrl,
      provider: "YouTube",
    };
  }
  const vimeoUrl = getVimeoEmbedUrl(safeUrl);
  if (vimeoUrl) {
    return {
      type: "embed",
      url: vimeoUrl,
      provider: "Vimeo",
    };
  }
  if (isDirectVideoFile(safeUrl)) {
    return {
      type: "video",
      url: safeUrl,
      provider: "Video",
    };
  }
  return {
    type: "link",
    url: safeUrl,
    provider: lesson.video_provider || "Eksternal",
  };
}
function MainVideoPlayer({
  lesson,
}: {
  lesson: LearningLesson;
}) {
  const media = getLessonMedia(lesson);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#07111F]">
      {media.type === "embed" && media.url ? (
        <div className="aspect-video w-full">
          <iframe
            key={lesson.id}
            src={media.url}
            title={lesson.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : media.type === "video" && media.url ? (
        <video
          key={lesson.id}
          src={media.url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        >
          Browser kamu tidak mendukung pemutaran video.
        </video>
      ) : media.type === "link" && media.url ? (
        <div className="flex aspect-video flex-col items-center justify-center px-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <Play size={30} />
          </div>
          <h3 className="mt-5 text-lg font-bold">
            Materi tersedia melalui tautan eksternal
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
            Buka materi melalui penyedia konten untuk
            melanjutkan pembelajaran.
          </p>
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-800 transition hover:bg-violet-50"
          >
            Buka Materi
            <ExternalLink size={16} />
          </a>
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center px-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <BookOpen size={30} />
          </div>
          <h3 className="mt-5 text-lg font-bold">
            Video belum tersedia
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
            Kamu tetap bisa mempelajari materi melalui
            penjelasan dan mini materi di bawah ini.
          </p>
        </div>
      )}
    </div>
  );
}
// =====================================================
// MINI CONTENT RENDERER
// =====================================================
function ContentTypeIcon({
  type,
}: {
  type: string;
}) {
  const className = "h-5 w-5";
  switch (type) {
    case "tiktok":
      return <Play className={className} />;
    case "youtube":
  return <Play className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "pdf":
      return <FileText className={className} />;
    case "audio":
      return <Headphones className={className} />;
    case "link":
      return <Link2 className={className} />;
    case "callout":
      return <Sparkles className={className} />;
    default:
      return <BookOpen className={className} />;
  }
}
function MediaFallback({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
      <FileText className="mx-auto h-7 w-7 text-slate-400" />
      <p className="mt-3 text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}
function TikTokMiniPlayer({
  mediaUrl,
  title,
}: {
  mediaUrl: string;
  title: string;
}) {
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);
  const embedUrl = getTikTokEmbedUrl(mediaUrl);
  if (!embedUrl) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
          <Play size={22} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Video TikTok siap dibuka
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-slate-500">
          Tautan ini belum dapat dikenali sebagai URL video untuk pemutar tertanam.
          Kamu tetap bisa membukanya langsung melalui TikTok.
        </p>
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
        >
          Buka TikTok
          <ExternalLink size={15} />
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
      {!isPlayerLoaded ? (
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <Play size={25} fill="currentColor" />
          </div>
          <p className="mt-5 text-sm font-bold text-slate-900">
            Video TikTok siap diputar
          </p>
          <p className="mt-2 max-w-[240px] text-xs leading-6 text-slate-500">
            Tekan tombol di bawah untuk memuat pemutar video. Video tidak
            dimuat sebelum kamu memilihnya.
          </p>
          <button
            type="button"
            onClick={() => setIsPlayerLoaded(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            <Play size={15} fill="currentColor" />
            Tampilkan Video
          </button>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl bg-black shadow-sm">
          <div className="aspect-[9/16] w-full">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
        >
          Buka di TikTok
          <ExternalLink size={14} />
        </a>
        {isPlayerLoaded && (
          <button
            type="button"
            onClick={() => setIsPlayerLoaded(false)}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700"
          >
            Tutup pemutar
          </button>
        )}
      </div>
      <p className="mx-auto mt-3 max-w-md text-center text-[11px] leading-5 text-slate-500">
        Jika pemutar TikTok sedang tidak tersedia atau menampilkan pesan
        overload, gunakan tombol Buka di TikTok. Ketersediaan embed juga
        mengikuti batas penggunaan dari TikTok.
      </p>
    </div>
  );
}
function MiniContentBody({
  item,
  signedResourceUrl,
  resourceLoading,
  resourceError,
}: {
  item: LearningContent;
  signedResourceUrl: string | null;
  resourceLoading: boolean;
  resourceError: string;
}): ReactNode {
  const mediaUrl =
    getSafeUrl(item.media_url) ??
    getSafeUrl(signedResourceUrl) ??
    getSafeUrl(item.resource_path);

  if (
    resourceLoading &&
    !getSafeUrl(item.media_url) &&
    !getSafeUrl(item.resource_path)
  ) {
    return <MediaFallback message="Menyiapkan file pembelajaran..." />;
  }

  if (
    resourceError &&
    !mediaUrl &&
    ["image", "pdf", "audio"].includes(item.content_type)
  ) {
    return <MediaFallback message={resourceError} />;
  }
  const linkUrl = getSafeUrl(item.link_url);
  const body = item.body?.trim() ?? "";
  switch (item.content_type) {
    case "text": {
      const textAlign = getContentSetting(item.settings, "text_align", ["left", "center"] as const, "left");
      const textSize = getContentSetting(item.settings, "text_size", ["normal", "large"] as const, "normal");
      return body ? (
        <div className={`whitespace-pre-wrap break-words leading-8 text-slate-700 ${
          textAlign === "center" ? "text-center" : "text-left"
        } ${textSize === "large" ? "text-base sm:text-lg" : "text-sm sm:text-[15px]"}`}>
          {body}
        </div>
      ) : (
        <MediaFallback message="Penjelasan belum tersedia." />
      );
    }
    case "callout": {
      const variant = getContentSetting(item.settings, "callout_variant", ["info", "success", "warning"] as const, "info");
      const styles = {
        info: { wrapper: "border-violet-100 bg-violet-50", icon: "text-violet-700", title: "text-violet-900", body: "text-violet-800", label: "Catatan Penting" },
        success: { wrapper: "border-emerald-100 bg-emerald-50", icon: "text-emerald-700", title: "text-emerald-900", body: "text-emerald-800", label: "Tips" },
        warning: { wrapper: "border-amber-200 bg-amber-50", icon: "text-amber-700", title: "text-amber-900", body: "text-amber-800", label: "Perhatian" },
      };
      const style = styles[variant];
      return (
        <div className={`flex gap-3 rounded-2xl border p-4 sm:p-5 ${style.wrapper}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ${style.icon}`}>
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${style.title}`}>{style.label}</p>
            <p className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${style.body}`}>
              {body || "Tidak ada catatan tambahan."}
            </p>
          </div>
        </div>
      );
    }
    case "tiktok":
      return mediaUrl ? (
        <TikTokMiniPlayer mediaUrl={mediaUrl} title={item.title} />
      ) : (
        <MediaFallback message="Video TikTok belum tersedia." />
      );
    case "youtube": {
      const ratio = getContentSetting(item.settings, "youtube_ratio", ["16:9", "9:16"] as const, "16:9");
      const controls = getContentBooleanSetting(item.settings, "youtube_controls", true);
      const embedUrl = getYouTubeEmbedUrl(mediaUrl, controls);
      return embedUrl ? (
        <div className={`mx-auto overflow-hidden rounded-2xl bg-black ${ratio === "9:16" ? "w-full max-w-[420px]" : "w-full"}`}>
          <div className={ratio === "9:16" ? "aspect-[9/16]" : "aspect-video"}>
            <iframe
              src={embedUrl}
              title={item.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      ) : mediaUrl ? (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800"
        >
          Buka Video YouTube
          <ExternalLink size={15} />
        </a>
      ) : (
        <MediaFallback message="Video YouTube belum tersedia." />
      );
    }
    case "image": {
      const fit = getContentSetting(item.settings, "image_fit", ["contain", "cover"] as const, "contain");
      const height = getContentSetting(item.settings, "image_height", ["compact", "medium", "large"] as const, "medium");
      const maxHeight = height === "compact" ? "360px" : height === "large" ? "760px" : "560px";
      return mediaUrl ? (
        <div className="overflow-hidden rounded-2xl bg-slate-50 p-3 sm:p-5">
          <img
            src={mediaUrl}
            alt={item.title}
            loading="lazy"
            style={{ height: maxHeight, maxHeight }}
            className={`mx-auto w-full rounded-xl ${fit === "cover" ? "object-cover" : "object-contain"}`}
          />
        </div>
      ) : (
        <MediaFallback message="Gambar belum tersedia." />
      );
    }
    case "pdf": {
      const display = getContentSetting(item.settings, "pdf_display", ["preview", "button"] as const, "preview");
      const height = getContentSetting(item.settings, "pdf_height", ["compact", "medium", "large"] as const, "medium");
      const previewHeight = height === "compact" ? "h-[360px]" : height === "large" ? "h-[720px]" : "h-[520px]";
      return mediaUrl ? (
        <div className="space-y-3">
          {display === "preview" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <iframe
                src={mediaUrl}
                title={item.title}
                className={`${previewHeight} w-full`}
                loading="lazy"
              />
            </div>
          )}
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FileText size={17} />
            Buka / Unduh PDF
            <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        <MediaFallback message="Dokumen PDF belum tersedia." />
      );
    }
    case "audio":
      return mediaUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Headphones size={21} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Audio Pembelajaran
              </p>
              <p className="text-xs text-slate-500">
                Dengarkan materi berikut.
              </p>
            </div>
          </div>
          <audio
            controls
            preload="metadata"
            src={mediaUrl}
            className="w-full"
          >
            Browser kamu tidak mendukung audio.
          </audio>
        </div>
      ) : (
        <MediaFallback message="Audio belum tersedia." />
      );
    case "link":
      return linkUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Link2 size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">
                Tautan Pembelajaran
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {linkUrl}
              </p>
            </div>
          </div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            {item.link_label || "Buka Tautan"}
            <ExternalLink size={16} />
          </a>
        </div>
      ) : (
        <MediaFallback message="Tautan belum tersedia." />
      );
    default:
      return body ? (
        <div className="whitespace-pre-wrap text-sm leading-8 text-slate-700">
          {body}
        </div>
      ) : (
        <MediaFallback message="Konten belum tersedia." />
      );
  }
}
// =====================================================
// MINI CONTENT CARD
// =====================================================
function MiniContentCard({
  item,
  index,
  supabase,
}: {
  item: LearningContent;
  index: number;
  supabase: ReturnType<typeof createClient>;
}) {
  const [signedResourceUrl, setSignedResourceUrl] = useState<string | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const resourcePath = item.resource_path?.trim() ?? "";

    setSignedResourceUrl(null);
    setResourceError("");

    if (
      !resourcePath ||
      getSafeUrl(resourcePath) ||
      !["image", "pdf", "audio"].includes(item.content_type)
    ) {
      setResourceLoading(false);
      return;
    }

    async function loadSignedResource() {
      setResourceLoading(true);

      const { data, error } = await supabase.storage
        .from("learning-resources")
        .createSignedUrl(resourcePath, 60 * 60 * 24);

      if (cancelled) return;

      if (error || !data?.signedUrl) {
        setResourceError("File tidak dapat diakses. Periksa hak akses kelas atau unggah ulang file.");
        setResourceLoading(false);
        return;
      }

      setSignedResourceUrl(data.signedUrl);
      setResourceLoading(false);
    }

    void loadSignedResource();

    return () => {
      cancelled = true;
    };
  }, [item.content_type, item.resource_path, supabase]);

  return (
    <article className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(20,27,52,.06)] ring-1 ring-slate-200/70">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <ContentTypeIcon type={item.content_type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
              Segmen {index + 1}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
              {getContentLabel(item.content_type)}
            </span>
          </div>
          <h4 className="mt-1 break-words text-sm font-bold text-slate-900 sm:text-base">
            {item.title}
          </h4>
        </div>
        <span
          aria-label="Segmen sedang dibuka"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0edf8] text-[#55427d]"
        >
          <Play size={13} fill="currentColor" />
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <MiniContentBody
          item={item}
          signedResourceUrl={signedResourceUrl}
          resourceLoading={resourceLoading}
          resourceError={resourceError}
        />
      </div>
    </article>
  );
}

function MiniContentPlaylist({
  items,
  activeId,
  onSelect,
  completedIds = [],
  mobile = false,
}: {
  items: LearningContent[];
  activeId: string;
  onSelect: (item: LearningContent) => void;
  completedIds?: string[];
  mobile?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_12px_32px_rgba(23,28,54,.07)] ring-1 ring-slate-200/70">
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#65528d]">
          Playlist pembelajaran
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-[#1d2340]">Daftar mini materi</h4>
          <span className="rounded-full bg-[#f1eff8] px-2.5 py-1 text-[10px] font-bold text-[#51436f]">
            {items.length} segmen
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Pilih bagian yang ingin kamu pelajari.
        </p>
        <p className="mt-1 text-[10px] font-semibold text-[#09483F]">
          {completedIds.filter((id) => items.some((item) => item.id === id)).length} dari {items.length} segmen selesai
        </p>
      </div>

      <div className={`${mobile ? "max-h-[calc(84dvh-190px)]" : "max-h-[560px]"} space-y-1.5 overflow-y-auto p-2.5`}>
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const isCompleted = completedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              aria-current={isActive ? "step" : undefined}
              className={`group flex w-full min-w-0 items-start gap-3 rounded-2xl p-3 text-left transition ${
                isActive
                  ? "bg-gradient-to-r from-[#30204f] to-[#263a60] text-white shadow-[0_8px_18px_rgba(38,43,83,.16)]"
                  : "bg-white text-[#28304a] hover:bg-[#f6f5fa]"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isActive ? "bg-white/15 text-white" : "bg-[#f0edf8] text-[#5e4a86]"
              }`}>
                <span className={`text-[10px] font-extrabold ${isActive ? "text-white" : "text-[#5e4a86]"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block break-words text-xs font-bold leading-5 ${
                  isActive ? "text-white" : "text-[#242b45]"
                }`}>
                  {item.title}
                </span>
                <span className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                  isActive ? "text-white/70" : "text-slate-500"
                }`}>
                  <ContentTypeIcon type={item.content_type} />
                  {getContentLabel(item.content_type)}
                </span>
                {isActive && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold text-white">
                    <Play size={10} fill="currentColor" />
                    Sedang dibuka
                  </span>
                )}
              </span>
              {isCompleted ? (
                <span title="Mini materi selesai" className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-[#09483F] text-white" : "bg-[#EDF4F2] text-[#09483F]"}`}>
                  <CheckCircle2 size={15} strokeWidth={2.5} />
                </span>
              ) : (
                <ChevronRight size={15} className={`mt-1 shrink-0 ${isActive ? "text-white/70" : "text-slate-300 group-hover:text-[#260047]"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// TASK SUBMISSION CARD
// =====================================================
const TASK_SUBMISSION_BUCKET = "course-submissions";

const submissionSelectFields =
  "id, task_id, user_id, answer_text, answer_url, file_path, attempt_count, status, score, mentor_feedback, reviewed_by, reviewed_at, submitted_at, created_at, updated_at";

function TaskSubmissionCard({
  task,
  submission,
  userId,
  supabase,
  onSaved,
  onBackToLesson,
  submissionLoadError,
}: {
  task: LearningTask;
  submission?: LearningTaskSubmission;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  onSaved: (submission: LearningTaskSubmission) => void;
  onBackToLesson?: () => void;
  submissionLoadError: string | null;
}) {
  const [answerText, setAnswerText] = useState(submission?.answer_text ?? "");
  const [answerUrl, setAnswerUrl] = useState(submission?.answer_url ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [signedFileUrl, setSignedFileUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileUrlError, setFileUrlError] = useState("");

  const needsText =
    task.submission_type === "text" ||
    task.submission_type === "text_and_file";
  const needsFile =
    task.submission_type === "file" ||
    task.submission_type === "text_and_file";
  const needsLink = task.submission_type === "link";
  const canRevise = submission?.status === "revision_requested";
  const canSubmit =
    (!submission || canRevise) && !submissionLoadError;
  const isPastDue =
    !!task.due_at && new Date(task.due_at).getTime() < Date.now();
  const submissionClosed = isPastDue && !task.allow_late_submission;
  const canSend = canSubmit && !submissionClosed && !saving;

  useEffect(() => {
    setAnswerText(submission?.answer_text ?? "");
    setAnswerUrl(submission?.answer_url ?? "");
    setSelectedFile(null);
    setErrorMessage("");
  }, [task.id, submission?.id, submission?.updated_at]);

  useEffect(() => {
    let cancelled = false;
    const filePath = submission?.file_path?.trim() ?? "";

    setSignedFileUrl(null);
    setFileUrlError("");

    if (!filePath) {
      setFileLoading(false);
      return;
    }

    async function loadSignedFile() {
      setFileLoading(true);
      const { data, error } = await supabase.storage
        .from(TASK_SUBMISSION_BUCKET)
        .createSignedUrl(filePath, 60 * 60);

      if (cancelled) return;

      if (error || !data?.signedUrl) {
        setFileUrlError(
          "File belum dapat dibuka. Periksa bucket dan kebijakan akses penyimpanan."
        );
        setFileLoading(false);
        return;
      }

      setSignedFileUrl(data.signedUrl);
      setFileLoading(false);
    }

    void loadSignedFile();

    return () => {
      cancelled = true;
    };
  }, [submission?.file_path, supabase]);

  async function handleSubmit() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!userId) {
      setErrorMessage("Sesi peserta tidak ditemukan. Silakan login ulang.");
      return;
    }

    if (submissionClosed) {
      setErrorMessage("Batas pengumpulan tugas sudah lewat.");
      return;
    }

    if (needsText && !answerText.trim()) {
      setErrorMessage("Jawaban teks wajib diisi.");
      return;
    }

    if (needsLink) {
      const safeLink = getSafeUrl(answerUrl);
      if (!safeLink || safeLink.startsWith("/")) {
        setErrorMessage("Masukkan tautan lengkap yang diawali http:// atau https://.");
        return;
      }
    }

    if (needsFile && !selectedFile && !submission?.file_path) {
      setErrorMessage("Pilih file yang akan dikumpulkan.");
      return;
    }

    setSaving(true);

    try {
      let filePath = needsFile ? submission?.file_path ?? null : null;

      if (needsFile && selectedFile) {
        const safeFileName = selectedFile.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-100);
        filePath = `${task.id}/${userId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(TASK_SUBMISSION_BUCKET)
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedFile.type || "application/octet-stream",
          });

        if (uploadError) {
          throw new Error(
            `File gagal diunggah: ${uploadError.message}. Pastikan bucket ${TASK_SUBMISSION_BUCKET} dan storage policy sudah dibuat.`
          );
        }
      }

      const now = new Date().toISOString();
      const payload = {
        answer_text: needsText ? answerText.trim() : null,
        answer_url: needsLink ? answerUrl.trim() : null,
        file_path: filePath,
        status: "submitted" as const,
        submitted_at: now,
        updated_at: now,
      };

      let savedSubmission: LearningTaskSubmission;

      if (submission && canRevise) {
        const { data, error } = await (supabase as any)
          .from("course_task_submissions")
          .update({
            ...payload,
            attempt_count: submission.attempt_count + 1,
          })
          .eq("id", submission.id)
          .eq("user_id", userId)
          .select(submissionSelectFields)
          .single();

        if (error) throw error;
        savedSubmission = data as LearningTaskSubmission;
      } else {
        const { data, error } = await (supabase as any)
          .from("course_task_submissions")
          .insert({
            task_id: task.id,
            user_id: userId,
            ...payload,
            attempt_count: 1,
          })
          .select(submissionSelectFields)
          .single();

        if (error) throw error;
        savedSubmission = data as LearningTaskSubmission;
      }

      onSaved(savedSubmission);
      setSelectedFile(null);
      setSuccessMessage(
        canRevise
          ? "Revisi tugas berhasil dikirim."
          : "Tugas berhasil dikumpulkan."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengirim tugas."
      );
    } finally {
      setSaving(false);
    }
  }

  const statusLabel = submissionLoadError && !submission
    ? "Status belum tersedia"
    : getSubmissionStatusLabel(submission);
  const scoreValue =
    submission?.score === null || submission?.score === undefined
      ? null
      : Number(submission.score);
  const maxScore = Number(task.max_score);
  const referenceUrl = getSafeUrl(task.reference_url);

  return (
    <section className="scroll-mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-violet-50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
            <ClipboardList size={13} />
            Tugas Kelas
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${getSubmissionStatusClass(
              submission
            )}`}
          >
            {statusLabel}
          </span>
          {task.is_required && (
            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700">
              Wajib
            </span>
          )}
        </div>

        <h2 className="mt-4 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {task.title}
        </h2>

        {task.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {task.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            <FileText size={14} className="text-violet-700" />
            {getSubmissionTypeLabel(task.submission_type)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            <ClipboardCheck size={14} className="text-violet-700" />
            Nilai maksimal {Number.isFinite(maxScore) ? maxScore : task.max_score}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Clock3 size={14} className="text-amber-700" />
            {formatTaskDateTime(task.due_at)}
          </span>
        </div>

        {referenceUrl && (
          <a
            href={referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:text-violet-950"
          >
            Buka referensi tugas
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
            Instruksi Pengerjaan
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {task.instructions}
          </p>
        </div>

        {submissionLoadError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
            Status pengumpulan belum dapat dibaca. Muat ulang halaman sebelum mengirim tugas agar tidak terjadi pengumpulan ganda.
          </p>
        )}

        {submission && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Riwayat Pengumpulan
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Percobaan ke-{submission.attempt_count} ·{" "}
                  {formatTaskDateTime(submission.submitted_at)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${getSubmissionStatusClass(
                  submission
                )}`}
              >
                {statusLabel}
              </span>
            </div>

            {submission.answer_text && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Jawaban teks
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {submission.answer_text}
                </p>
              </div>
            )}

            {submission.answer_url && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tautan jawaban
                </p>
                <a
                  href={getSafeUrl(submission.answer_url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-violet-800 underline underline-offset-4"
                >
                  {submission.answer_url}
                  <ExternalLink size={13} className="shrink-0" />
                </a>
              </div>
            )}

            {submission.file_path && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  File yang dikumpulkan
                </p>
                {fileLoading ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Menyiapkan tautan file...
                  </p>
                ) : signedFileUrl ? (
                  <a
                    href={signedFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-violet-800 underline underline-offset-4"
                  >
                    <Paperclip size={15} />
                    Buka file pengumpulan
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-rose-600">
                    {fileUrlError || "Tautan file belum tersedia."}
                  </p>
                )}
              </div>
            )}

            {submission.status === "reviewed" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-emerald-900">
                    Hasil Penilaian Mentor
                  </p>
                  {scoreValue !== null && (
                    <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-800">
                      {scoreValue} / {maxScore}
                    </span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-900">
                  {submission.mentor_feedback ||
                    "Mentor belum menambahkan catatan."}
                </p>
              </div>
            )}

            {submission.status === "revision_requested" && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-bold text-rose-900">
                  Mentor meminta revisi
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-rose-800">
                  {submission.mentor_feedback ||
                    "Silakan perbaiki jawaban sesuai arahan mentor."}
                </p>
              </div>
            )}

            {submission.status === "submitted" && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                Pengumpulan sudah diterima dan sedang menunggu pemeriksaan mentor.
              </p>
            )}
          </div>
        )}

        {canSubmit ? (
          <div className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 sm:p-5">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {canRevise ? "Kirim Revisi Tugas" : "Kumpulkan Tugas"}
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {canRevise
                  ? "Perbaiki jawaban berdasarkan catatan mentor, lalu kirim kembali."
                  : "Pastikan jawaban sudah benar sebelum dikirim."}
              </p>
            </div>

            {needsText && (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-700">
                  Jawaban teks
                </span>
                <textarea
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  rows={6}
                  placeholder="Tulis jawaban tugas di sini..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            )}

            {needsLink && (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-700">
                  Tautan hasil pekerjaan
                </span>
                <input
                  type="url"
                  value={answerUrl}
                  onChange={(event) => setAnswerUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            )}

            {needsFile && (
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  File hasil pekerjaan
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-violet-300 bg-white px-4 py-6 text-center transition hover:border-violet-500 hover:bg-violet-50">
                  <Paperclip size={22} className="text-violet-700" />
                  <span className="mt-2 text-sm font-semibold text-slate-800">
                    {selectedFile?.name ||
                      (submission?.file_path
                        ? "Gunakan file sebelumnya atau pilih file pengganti"
                        : "Pilih file dari perangkat")}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    Klik untuk memilih file yang akan diunggah
                  </span>
                  <input
                    key={`${task.id}-${submission?.updated_at ?? "new"}`}
                    type="file"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
            )}

            {submissionClosed && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-700">
                Batas waktu sudah lewat dan tugas ini tidak menerima pengumpulan terlambat.
              </p>
            )}

            {errorMessage && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-700">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-700">
                {successMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {canRevise ? "Kirim Revisi" : "Kumpulkan Tugas"}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
            {submissionLoadError
              ? "Formulir sementara dinonaktifkan karena status pengumpulan belum berhasil dimuat."
              : submission?.status === "reviewed"
                ? "Tugas ini sudah dinilai dan tidak dapat diubah."
                : "Jawaban sudah dikirim. Formulir akan terbuka kembali jika mentor meminta revisi."}
          </div>
        )}

        {onBackToLesson && (
          <button
            type="button"
            onClick={onBackToLesson}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
          >
            <ArrowLeft size={15} />
            Kembali ke materi
          </button>
        )}
      </div>
    </section>
  );
}

// =====================================================
// CURRICULUM SIDEBAR
// =====================================================
type CurriculumPanelProps = {
  sections: LearningSection[];
  lessons: LearningLesson[];
  contents: LearningContent[];
  tasks: LearningTask[];
  submissions: LearningTaskSubmission[];
  submissionLoadError: string | null;
  activeLessonId: string;
  activeTaskId: string;
  completedLessonIds: string[];
  expandedSectionIds: string[];
  onToggleSection: (id: string) => void;
  onSelectLesson: (lesson: LearningLesson) => void;
  onSelectTask: (task: LearningTask) => void;
  showHeading?: boolean;
};

function CurriculumPanel({
  sections,
  lessons,
  contents,
  tasks,
  submissions,
  submissionLoadError,
  activeLessonId,
  activeTaskId,
  completedLessonIds,
  expandedSectionIds,
  onToggleSection,
  onSelectLesson,
  onSelectTask,
  showHeading = true,
}: CurriculumPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {showHeading && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
              Learning Curriculum
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Daftar Bab, Materi & Tugas
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Pilih materi atau tugas yang ingin kamu buka.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-violet-50 px-3 py-2 text-center">
            <p className="text-sm font-bold text-violet-800">
              {lessons.length + tasks.length}
            </p>
            <p className="text-[9px] text-violet-700">
              Item
            </p>
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Kurikulum belum tersedia
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Admin belum menambahkan bab pembelajaran.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, sectionIndex) => {
            const sectionLessons = lessons.filter(
              (lesson) => lesson.section_id === section.id
            );
            const sectionTasks = tasks.filter(
              (task) => task.section_id === section.id
            );
            const timeline = getSectionTimeline(
              section.id,
              lessons,
              tasks
            );
            const isExpanded = expandedSectionIds.includes(section.id);
            const hasActiveLesson = sectionLessons.some(
              (lesson) => lesson.id === activeLessonId
            );
            const hasActiveTask = sectionTasks.some(
              (task) => task.id === activeTaskId
            );
            const hasActiveItem = hasActiveLesson || hasActiveTask;

            return (
              <div
                key={section.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  hasActiveItem
                    ? "border-violet-200 bg-violet-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleSection(section.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      hasActiveItem
                        ? "bg-violet-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {sectionIndex + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-slate-800">
                      {section.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {sectionLessons.length} materi · {sectionTasks.length} tugas
                    </p>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-slate-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="space-y-2 border-t border-slate-100 p-2">
                    {timeline.length === 0 ? (
                      <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                        Belum ada materi atau tugas yang dipublikasikan.
                      </div>
                    ) : (
                      timeline.map((entry) => {
                        if (entry.type === "task") {
                          const task = entry.task;
                          const submission = submissions.find(
                            (item) => item.task_id === task.id
                          );
                          const isActive = task.id === activeTaskId;

                          return (
                            <button
                              key={`task-${task.id}`}
                              type="button"
                              onClick={() => onSelectTask(task)}
                              aria-current={isActive ? "step" : undefined}
                              className={`w-full rounded-xl border p-3 text-left transition ${
                                isActive
                                  ? "border-violet-200 bg-violet-50 shadow-sm"
                                  : "border-transparent bg-white hover:border-violet-100 hover:bg-violet-50/50"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                    isActive
                                      ? "bg-violet-700 text-white"
                                      : "bg-violet-50 text-violet-700"
                                  }`}
                                >
                                  <ClipboardList size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`break-words text-xs font-bold leading-5 ${
                                      isActive
                                        ? "text-violet-900"
                                        : "text-slate-800"
                                    }`}
                                  >
                                    {task.title}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                                        submissionLoadError
                                          ? "bg-amber-100 text-amber-800"
                                          : getSubmissionStatusClass(submission)
                                      }`}
                                    >
                                      {submissionLoadError
                                        ? "Status tidak tersedia"
                                        : getSubmissionStatusLabel(submission)}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                      {getSubmissionTypeLabel(task.submission_type)}
                                    </span>
                                  </div>
                                  {isActive && (
                                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-700 px-2.5 py-1 text-[9px] font-bold text-white">
                                      <ClipboardCheck size={10} />
                                      Tugas aktif
                                    </span>
                                  )}
                                </div>
                                <ChevronRight size={15} className="mt-1 shrink-0 text-slate-300" />
                              </div>
                            </button>
                          );
                        }

                        const lesson = entry.lesson;
                        const isActive = lesson.id === activeLessonId;
                        const isCompleted = completedLessonIds.includes(lesson.id);
                        const miniCount = contents.filter(
                          (item) =>
                            item.lesson_id === lesson.id &&
                            item.status === "published"
                        ).length;
                        return (
                          <button
                            key={`lesson-${lesson.id}`}
                            type="button"
                            onClick={() => onSelectLesson(lesson)}
                            aria-current={isActive ? "step" : undefined}
                            className={`group w-full rounded-xl border p-3 text-left transition ${
                              isActive
                                ? "border-violet-200 bg-white shadow-sm"
                                : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                aria-label="Materi video"
                                title="Materi video"
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition ${
                                  isActive
                                    ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-blue-200"
                                    : "border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 group-hover:border-blue-200"
                                }`}
                              >
                                <Video size={17} strokeWidth={2.4} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start gap-1.5">
                                  <p
                                    className={`break-words text-xs font-bold leading-5 ${
                                      isActive
                                        ? "text-violet-900"
                                        : "text-slate-800"
                                    }`}
                                  >
                                    {lesson.title}
                                  </p>
                                  {lesson.is_preview && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                      Preview
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                                  <span>
                                    {formatDuration(lesson.duration_minutes)}
                                  </span>
                                  <span>•</span>
                                  <span>{miniCount} segmen</span>
                                </div>
                                {isActive && (
                                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-700 px-2.5 py-1 text-[9px] font-bold text-white">
                                    <Play size={9} />
                                    Sedang dipelajari
                                  </div>
                                )}
                              </div>
                              {isCompleted ? (
                                <span title="Materi selesai" className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDF4F2] text-[#09483F]">
                                  <CheckCircle2 size={15} strokeWidth={2.5} />
                                </span>
                              ) : (
                                <ChevronRight size={15} className="mt-1 shrink-0 text-slate-300" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// =====================================================
// MAIN LEARNING ROOM
// =====================================================
export default function LearningRoom({
  course,
  sections,
  lessons,
  contents,
  tasks,
  submissions,
  userId,
  profileName,
  grantedAt,
  loadError,
  taskLoadError,
  submissionLoadError,
  completedLessonIds: initialCompletedLessonIds = [],
}: LearningRoomProps) {
  const supabase = useMemo(() => createClient(), []);

  function recordLearningActivity(
    eventType: "lesson_open" | "task_open" | "lesson_complete",
    metadata: Record<string, string>
  ) {
    void (supabase as any)
      .from("platform_activity_logs")
      .insert({
        user_id: userId,
        event_type: eventType,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        metadata,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("Aktivitas belajar belum tercatat:", error.message);
      });
  }

  const orderedSections = useMemo(
    () =>
      [...(sections ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      ),
    [sections]
  );

  const orderedLessons = useMemo(
    () => getOrderedLessons(orderedSections, lessons ?? []),
    [orderedSections, lessons]
  );

  const publishedContents = useMemo(
    () =>
      [...(contents ?? [])]
        .filter((item) => item.status === "published")
        .sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        ),
    [contents]
  );

  const publishedTasks = useMemo(
    () =>
      sortTasks(
        [...(tasks ?? [])].filter(
          (task) => task.status === "published"
        )
      ),
    [tasks]
  );

  const [taskSubmissions, setTaskSubmissions] =
    useState<LearningTaskSubmission[]>(submissions ?? []);

  useEffect(() => {
    setTaskSubmissions(submissions ?? []);
  }, [submissions]);

  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(initialCompletedLessonIds);
  const [completedMiniContentIds, setCompletedMiniContentIds] = useState<string[]>([]);
  const miniProgressStorageKey = course ? `kcc-mini-progress:${userId}:${course.id}` : "";
  const [markingLesson, setMarkingLesson] = useState(false);
  const [lessonProgressError, setLessonProgressError] = useState("");
  const [certificateRefreshKey, setCertificateRefreshKey] = useState(0);

  useEffect(() => {
    setCompletedLessonIds(initialCompletedLessonIds);
  }, [initialCompletedLessonIds]);

  useEffect(() => {
    if (!miniProgressStorageKey) return;
    try {
      const stored = window.localStorage.getItem(miniProgressStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setCompletedMiniContentIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedMiniContentIds([]);
    }
  }, [miniProgressStorageKey]);

  const [activeLessonId, setActiveLessonId] = useState(
    () => orderedLessons[0]?.id ?? ""
  );
  const [activeTaskId, setActiveTaskId] = useState("");
  const [activeMiniContentId, setActiveMiniContentId] = useState("");
  const [mobileMiniPlaylistOpen, setMobileMiniPlaylistOpen] = useState(false);
  const [expandedSectionIds, setExpandedSectionIds] =
    useState<string[]>(() => {
      const firstSection = orderedLessons[0]?.section_id;
      return firstSection ? [firstSection] : [];
    });
  const [mobileCurriculumOpen, setMobileCurriculumOpen] =
    useState(false);
  const lessonHeadingRef = useRef<HTMLDivElement>(null);

  // Pastikan materi aktif selalu valid.
  useEffect(() => {
    if (orderedLessons.length === 0) {
      setActiveLessonId("");
      return;
    }

    const stillExists = orderedLessons.some(
      (lesson) => lesson.id === activeLessonId
    );

    if (!stillExists) {
      setActiveLessonId(orderedLessons[0].id);
    }
  }, [orderedLessons, activeLessonId]);

  // Pastikan tugas aktif masih termasuk tugas yang dipublikasikan.
  useEffect(() => {
    if (
      activeTaskId &&
      !publishedTasks.some((task) => task.id === activeTaskId)
    ) {
      setActiveTaskId("");
    }
  }, [publishedTasks, activeTaskId]);

  const selectedLesson =
    orderedLessons.find(
      (lesson) => lesson.id === activeLessonId
    ) ?? orderedLessons[0] ?? null;

  const activeTask =
    publishedTasks.find((task) => task.id === activeTaskId) ?? null;

  const activeLesson = activeTask ? null : selectedLesson;

  const activeSectionId =
    activeTask?.section_id ?? activeLesson?.section_id ?? "";

  const activeSection =
    orderedSections.find(
      (section) => section.id === activeSectionId
    ) ?? null;

  const activeSectionIndex = activeSection
    ? orderedSections.findIndex(
        (section) => section.id === activeSection.id
      )
    : -1;

  const activeLessonIndex = selectedLesson
    ? orderedLessons.findIndex(
        (lesson) => lesson.id === selectedLesson.id
      )
    : -1;

  const activeContents = useMemo(
    () =>
      activeLesson
        ? publishedContents.filter(
            (item) => item.lesson_id === activeLesson.id
          )
        : [],
    [activeLesson?.id, publishedContents]
  );

  // Mini materi hanya memilih dan memuat satu segmen pada satu waktu.
  // Ini mencegah semua embed video TikTok/YouTube dimuat sekaligus.
  useEffect(() => {
    setMobileMiniPlaylistOpen(false);
    setActiveMiniContentId((current) =>
      activeContents.some((item) => item.id === current)
        ? current
        : activeContents[0]?.id ?? ""
    );
  }, [activeLesson?.id, activeContents]);

  const activeMiniContentIndex = Math.max(
    0,
    activeContents.findIndex((item) => item.id === activeMiniContentId)
  );
  const activeMiniContent =
    activeContents[activeMiniContentIndex] ?? activeContents[0] ?? null;
  const previousMiniContent =
    activeMiniContentIndex > 0
      ? activeContents[activeMiniContentIndex - 1]
      : null;
  const nextMiniContent =
    activeMiniContentIndex >= 0 &&
    activeMiniContentIndex < activeContents.length - 1
      ? activeContents[activeMiniContentIndex + 1]
      : null;

  const positionPercent =
    orderedLessons.length > 0 && activeLessonIndex >= 0
      ? ((activeLessonIndex + 1) / orderedLessons.length) * 100
      : 0;

  const previousLesson =
    activeLessonIndex > 0
      ? orderedLessons[activeLessonIndex - 1]
      : null;

  const nextLesson =
    activeLessonIndex >= 0 &&
    activeLessonIndex < orderedLessons.length - 1
      ? orderedLessons[activeLessonIndex + 1]
      : null;

  // Buka otomatis bab tempat materi atau tugas aktif berada.
  useEffect(() => {
    if (!activeSectionId) return;

    setExpandedSectionIds((current) =>
      current.includes(activeSectionId)
        ? current
        : [...current, activeSectionId]
    );
  }, [activeSectionId]);

  // Pilih materi dan gulir kembali ke judul materi.
  function handleSelectLesson(lesson: LearningLesson) {
    const changed =
      lesson.id !== activeLessonId || Boolean(activeTaskId);

    setActiveTaskId("");
    setActiveLessonId(lesson.id);
    setMobileCurriculumOpen(false);
    setMobileMiniPlaylistOpen(false);
    recordLearningActivity("lesson_open", {
      course_id: course?.id ?? "",
      lesson_id: lesson.id,
    });

    setExpandedSectionIds((current) =>
      current.includes(lesson.section_id)
        ? current
        : [...current, lesson.section_id]
    );

    if (changed) {
      window.requestAnimationFrame(() => {
        lessonHeadingRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  function handleSelectMiniContent(item: LearningContent) {
    setActiveMiniContentId(item.id);
    setMobileMiniPlaylistOpen(false);
  }

  function handleStepMiniContent(direction: "previous" | "next") {
    const target =
      direction === "previous" ? previousMiniContent : nextMiniContent;
    if (target) handleSelectMiniContent(target);
  }

  function handleMarkMiniContentComplete() {
    if (!activeMiniContent || !miniProgressStorageKey || completedMiniContentIds.includes(activeMiniContent.id)) return;
    const next = [...completedMiniContentIds, activeMiniContent.id];
    setCompletedMiniContentIds(next);
    try {
      window.localStorage.setItem(miniProgressStorageKey, JSON.stringify(next));
    } catch {
      // The visible check remains for the current session if browser storage is unavailable.
    }
  }

  async function handleMarkLessonComplete() {
    if (!course || !activeLesson || completedLessonIds.includes(activeLesson.id)) return;
    const unfinishedMiniContents = activeContents.filter((item) => !completedMiniContentIds.includes(item.id));
    if (unfinishedMiniContents.length > 0) {
      setLessonProgressError(`Selesaikan ${unfinishedMiniContents.length} mini materi yang tersisa terlebih dahulu.`);
      return;
    }
    setMarkingLesson(true);
    setLessonProgressError("");
    const { error } = await (supabase as any).rpc("mark_course_lesson_complete", {
      p_course_id: course?.id ?? "",
      p_lesson_id: activeLesson.id,
    });
    if (error) {
      setLessonProgressError(error.message);
    } else {
      setCompletedLessonIds((current) => current.includes(activeLesson.id) ? current : [...current, activeLesson.id]);
      setCertificateRefreshKey((current) => current + 1);
      recordLearningActivity("lesson_complete", {
        course_id: course?.id ?? "",
        lesson_id: activeLesson.id,
      });
    }
    setMarkingLesson(false);
  }

  // Pilih tugas dari daftar kurikulum.
  function handleSelectTask(task: LearningTask) {
    const changed = task.id !== activeTaskId;

    setActiveTaskId(task.id);
    setMobileCurriculumOpen(false);
    setMobileMiniPlaylistOpen(false);
    recordLearningActivity("task_open", {
      course_id: course?.id ?? "",
      task_id: task.id,
    });

    setExpandedSectionIds((current) =>
      current.includes(task.section_id)
        ? current
        : [...current, task.section_id]
    );

    if (changed) {
      window.requestAnimationFrame(() => {
        lessonHeadingRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  // Perbarui status tugas di UI tanpa perlu memuat ulang halaman.
  function handleTaskSubmissionSaved(
    savedSubmission: LearningTaskSubmission
  ) {
    setTaskSubmissions((current) => {
      const exists = current.some(
        (item) => item.task_id === savedSubmission.task_id
      );

      if (!exists) return [...current, savedSubmission];

      return current.map((item) =>
        item.task_id === savedSubmission.task_id
          ? savedSubmission
          : item
      );
    });
  }

  function handleToggleSection(id: string) {
    setExpandedSectionIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }
  // ===================================================
  // EMPTY COURSE
  // ===================================================
  if (!course) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <BookOpen size={30} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-rose-600">
            Ruang Belajar
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Kelas tidak ditemukan
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Maaf, data kelas belum dapat dimuat.
            Silakan kembali ke dashboard.
          </p>
          {loadError && (
            <div className="mt-5 rounded-xl bg-rose-50 p-3 text-left text-xs text-rose-700">
              {loadError}
            </div>
          )}
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800"
          >
            <ArrowLeft size={16} />
            Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }
  // ===================================================
  // RENDER
  // ===================================================
  return (
    <main className="min-h-screen bg-[#F7F6FC] text-[#1B1730]">
      <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        {/* =============================================
            COMPACT HEADER
        ============================================= */}
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/dashboard"
                aria-label="Kembali ke dashboard"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
              >
                <ArrowLeft size={19} />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-700">
                    Kiki Creator Class / Ruang Belajar
                  </p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                    Akses Aktif
                  </span>
                </div>
                <h1 className="mt-1 truncate text-base font-bold text-slate-900 sm:text-lg">
                  {course.title}
                </h1>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  Hai {profileName}, selamat belajar bersama{" "}
                  {course.mentor_name || "Kiki Creator Class"}.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] lg:pl-0">
              <Link
                href="/dashboard#pembelian"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
              >
                Pembelian
              </Link>
              <Link
                href="/kelas"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-700 px-3 text-xs font-semibold text-white transition hover:bg-violet-800"
              >
                Jelajahi Kelas
                <ArrowRight size={14} />
              </Link>
              <LogoutButton compact />
            </div>
          </div>
          {/* Posisi materi, bukan status penyelesaian */}
          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
            <span className="shrink-0 text-[10px] font-semibold text-slate-500">
              Posisi belajar
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${positionPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-violet-800">
              {activeLessonIndex >= 0
                ? activeLessonIndex + 1
                : 0}{" "}
              / {orderedLessons.length} materi
            </span>
          </div>
        </header>
        {/* =============================================
            LOAD ERROR
        ============================================= */}
        {loadError && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Sparkles size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">
                Sebagian data belum berhasil dimuat
              </p>
              <p className="mt-1 break-words text-xs leading-6">
                {loadError}
              </p>
            </div>
          </div>
        )}
        {taskLoadError && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <ClipboardList size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">
                Data tugas belum berhasil dimuat
              </p>
              <p className="mt-1 break-words text-xs leading-6">
                {taskLoadError}
              </p>
            </div>
          </div>
        )}
        {/* =============================================
            MOBILE CURRICULUM BUTTON
        ============================================= */}
        <div className="mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileCurriculumOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-200"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <ListTree size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-700">
                  Learning Curriculum
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  Daftar Bab, Materi & Tugas
                </p>
                <p className="mt-1 truncate text-[10px] text-slate-500">
                  {activeSection?.title || "Pilih materi"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
              {orderedLessons.length} materi · {publishedTasks.length} tugas
              <ChevronDown size={15} />
            </div>
          </button>
        </div>
        {/* =============================================
            MAIN TWO COLUMN LAYOUT
        ============================================= */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
          {/* ===========================================
              LEFT: LEARNING CONTENT
          =========================================== */}
          <div className="min-w-0 space-y-5">
            {/* ACTIVE LESSON OR TASK */}
            {activeTask ? (
              <div
                ref={lessonHeadingRef}
                id="active-task"
                className="scroll-mt-5"
              >
                <TaskSubmissionCard
                  key={activeTask.id}
                  task={activeTask}
                  submission={taskSubmissions.find(
                    (item) => item.task_id === activeTask.id
                  )}
                  userId={userId}
                  supabase={supabase}
                  onSaved={handleTaskSubmissionSaved}
                  submissionLoadError={submissionLoadError}
                  onBackToLesson={
                    selectedLesson
                      ? () => handleSelectLesson(selectedLesson)
                      : undefined
                  }
                />
              </div>
            ) : (
            <section
              ref={lessonHeadingRef}
              id="active-lesson"
              className="scroll-mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              {activeLesson ? (
                <>
                  <div className="p-4 sm:p-6">
                    {/* LESSON HEADING */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-violet-800">
                          <BookOpen size={12} />
                          Materi Aktif
                        </span>
                        {activeLesson.is_preview && (
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-bold text-amber-700">
                            Preview
                          </span>
                        )}
                      </div>
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
                        Materi {activeLessonIndex + 1} dari{" "}
                        {orderedLessons.length}
                      </span>
                    </div>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                      Bab {activeSectionIndex + 1}
                      {activeSection
                        ? ` · ${activeSection.title}`
                        : ""}
                    </p>
                    <h2 className="mt-2 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl lg:text-[28px]">
                      {activeLesson.title}
                    </h2>
                    {activeLesson.content && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {activeLesson.content}
                      </p>
                    )}
                    {/* VIDEO PLAYER */}
                    <div className="mt-5">
                      <MainVideoPlayer lesson={activeLesson} />
                    </div>
                    {/* LESSON INFORMATION */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <Clock3
                          size={14}
                          className="text-violet-700"
                        />
                        {formatDuration(
                          activeLesson.duration_minutes
                        )}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <Layers3
                          size={14}
                          className="text-violet-700"
                        />
                        {activeContents.length} mini materi
                      </div>
                      {activeLesson.is_preview && (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                          Preview kelas
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                    <BookOpen size={30} />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-slate-900">
                    Materi belum tersedia
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                    Admin belum mempublikasikan materi
                    pembelajaran untuk kelas ini.
                  </p>
                </div>
              )}
            </section>
            )}
            {/* =========================================
                MINI MATERIAL PLAYER + PLAYLIST
            ========================================= */}
            {activeLesson && (
              <section className="space-y-4" aria-labelledby="mini-material-heading">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#67518f]">
                      Learning library
                    </p>
                    <h3
                      id="mini-material-heading"
                      className="mt-1 text-lg font-extrabold tracking-tight text-[#1c2340] sm:text-xl"
                    >
                      Mini Materi
                    </h3>
                    <p className="mt-1 max-w-xl text-xs leading-6 text-slate-500">
                      Pelajari setiap segmen satu per satu. Pilih segmen lain melalui playlist tanpa perlu menggulir semua video.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[#51436f] shadow-sm ring-1 ring-slate-200/70">
                      <Layers3 size={14} className="text-[#67518f]" />
                      {activeContents.length} segmen
                    </span>
                    {activeContents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobileMiniPlaylistOpen(true)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#342254] to-[#263b61] px-3.5 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(38,43,83,.16)] transition hover:brightness-110 xl:hidden"
                        aria-haspopup="dialog"
                      >
                        <ListTree size={15} />
                        Daftar mini materi
                      </button>
                    )}
                  </div>
                </div>

                {activeContents.length > 0 && activeMiniContent ? (
                  <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
                    <div className="min-w-0 space-y-3">
                      <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#342254] via-[#302957] to-[#203653] p-4 text-white shadow-[0_12px_28px_rgba(33,39,75,.16)] sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-[.18em] text-violet-100/80">
                            Segmen {activeMiniContentIndex + 1} dari {activeContents.length}
                          </span>
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-white/85">
                            {getContentLabel(activeMiniContent.content_type)}
                          </span>
                        </div>
                        <h4 className="mt-2 break-words text-base font-extrabold leading-snug sm:text-lg">
                          {activeMiniContent.title}
                        </h4>
                        <p className="mt-1 text-[11px] leading-5 text-white/65">
                          {activeLesson.title}
                        </p>
                      </div>

                      <MiniContentCard
                        key={activeMiniContent.id}
                        item={activeMiniContent}
                        index={activeMiniContentIndex}
                        supabase={supabase}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE5ED] bg-white p-3 shadow-[0_8px_22px_rgba(23,28,54,.035)]">
                        <div className="flex min-w-0 items-center gap-2 text-[11px]">
                          {completedMiniContentIds.includes(activeMiniContent.id) ? <CheckCircle2 size={16} className="shrink-0 text-[#09483F]" /> : <Circle size={16} className="shrink-0 text-slate-300" />}
                          <span className="font-semibold text-slate-600">{completedMiniContentIds.includes(activeMiniContent.id) ? "Mini materi selesai" : "Tandai segmen ini selesai setelah dipelajari"}</span>
                        </div>
                        <button type="button" onClick={handleMarkMiniContentComplete} disabled={completedMiniContentIds.includes(activeMiniContent.id)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#260047] px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:bg-[#EDF4F2] disabled:text-[#09483F]">
                          <CheckCircle2 size={14} />
                          {completedMiniContentIds.includes(activeMiniContent.id) ? "Selesai" : "Tandai selesai"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-[0_8px_22px_rgba(23,28,54,.045)] ring-1 ring-slate-200/70">
                        <button
                          type="button"
                          onClick={() => handleStepMiniContent("previous")}
                          disabled={!previousMiniContent}
                          className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-3 text-xs font-bold text-[#51436f] transition hover:bg-[#f4f1fa] disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
                        >
                          <ArrowLeft size={15} />
                          <span className="truncate">Sebelumnya</span>
                        </button>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                          {activeMiniContentIndex + 1}/{activeContents.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepMiniContent("next")}
                          disabled={!nextMiniContent}
                          className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#342254] to-[#263b61] px-3 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
                        >
                          <span className="truncate">Selanjutnya</span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>

                    <aside className="hidden min-w-0 xl:block">
                      <div className="xl:sticky xl:top-5">
                        <MiniContentPlaylist
                          items={activeContents}
                          activeId={activeMiniContent.id}
                          onSelect={handleSelectMiniContent}
                          completedIds={completedMiniContentIds}
                        />
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="rounded-[22px] bg-white p-8 text-center shadow-[0_8px_22px_rgba(23,28,54,.045)] ring-1 ring-slate-200/70">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1eef8] text-[#5c4b80]">
                      <Layers3 size={25} />
                    </div>
                    <h4 className="mt-4 text-sm font-bold text-[#252b45]">
                      Belum ada mini materi
                    </h4>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-slate-500">
                      Mini materi untuk pembelajaran ini belum ditambahkan atau belum dipublikasikan.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* MOBILE MINI MATERIAL PLAYLIST */}
            {mobileMiniPlaylistOpen && activeContents.length > 0 && (
              <div className="fixed inset-0 z-[110] xl:hidden">
                <button
                  type="button"
                  aria-label="Tutup daftar mini materi"
                  onClick={() => setMobileMiniPlaylistOpen(false)}
                  className="absolute inset-0 bg-[#11172b]/55 backdrop-blur-[3px]"
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Daftar mini materi"
                  className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[28px] bg-[#f7f6fb] p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-18px_55px_rgba(12,18,38,.22)] sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-[28px] sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#67518f]">
                        Playlist pembelajaran
                      </p>
                      <h3 className="mt-1 truncate text-base font-extrabold text-[#1c2340]">
                        Daftar mini materi
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {activeContents.length} segmen · {activeLesson?.title ?? "Materi"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMiniPlaylistOpen(false)}
                      aria-label="Tutup"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <MiniContentPlaylist
                    items={activeContents}
                    activeId={activeMiniContent?.id ?? ""}
                    onSelect={handleSelectMiniContent}
                    completedIds={completedMiniContentIds}
                    mobile
                  />
                </div>
              </div>
            )}
            {activeLesson && (
              <>
                <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(47,30,82,.045)] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${completedLessonIds.includes(activeLesson.id) ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
                        <CheckCircle2 size={19} />
                      </span>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800">Status materi</p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500">
                          {completedLessonIds.includes(activeLesson.id)
                            ? "Materi ini sudah kamu tandai selesai."
                            : activeContents.some((item) => !completedMiniContentIds.includes(item.id))
                              ? `Selesaikan semua mini materi terlebih dahulu (${completedMiniContentIds.filter((id) => activeContents.some((item) => item.id === id)).length}/${activeContents.length}).`
                              : "Video dan seluruh mini materi sudah dipelajari. Kamu dapat menandai materi ini selesai."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleMarkLessonComplete()}
                      disabled={markingLesson || completedLessonIds.includes(activeLesson.id) || activeContents.some((item) => !completedMiniContentIds.includes(item.id))}
                      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition disabled:cursor-not-allowed ${completedLessonIds.includes(activeLesson.id) ? "bg-emerald-50 text-emerald-700" : "bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white shadow-[0_7px_18px_rgba(109,40,217,.16)] hover:brightness-105 disabled:opacity-50"}`}
                    >
                      {markingLesson ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {completedLessonIds.includes(activeLesson.id) ? "Materi selesai" : markingLesson ? "Menyimpan..." : activeContents.some((item) => !completedMiniContentIds.includes(item.id)) ? "Selesaikan mini materi dulu" : "Tandai materi selesai"}
                    </button>
                  </div>
                  {lessonProgressError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{lessonProgressError}</p>}
                </section>
                {/* =========================================
                    PREVIOUS / NEXT LESSON
                ========================================= */}
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex items-center justify-between gap-3">
                {previousLesson ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectLesson(previousLesson)
                    }
                    className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 sm:px-4"
                  >
                    <ArrowLeft size={16} />
                    <span className="truncate">
                      Materi Sebelumnya
                    </span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-3 text-xs text-slate-300 sm:px-4">
                    <ArrowLeft size={16} />
                    Materi Sebelumnya
                  </span>
                )}
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                  {activeLessonIndex >= 0
                    ? activeLessonIndex + 1
                    : 0}{" "}
                  / {orderedLessons.length}
                </span>
                {nextLesson ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectLesson(nextLesson)
                    }
                    className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-violet-700 px-3 py-3 text-xs font-semibold text-white transition hover:bg-violet-800 sm:px-4"
                  >
                    <span className="truncate">
                      Materi Berikutnya
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-3 text-xs font-semibold text-violet-300 sm:px-4">
                    Materi Berikutnya
                    <ArrowRight size={16} />
                  </span>
                )}
              </div>
                </section>
              </>
            )}
            <CourseCertificatePanel courseId={course.id} refreshKey={certificateRefreshKey} />
            {/* SMALL COURSE FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4 text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <GraduationCap size={15} />
                Kiki Creator Class
              </div>
              <span>
                Mentor: {course.mentor_name || "Kiki Creator Class"}
              </span>
              <span>
                Akses sejak {formatShortDate(grantedAt)}
              </span>
            </div>
          </div>
          {/* ===========================================
              RIGHT: STICKY CURRICULUM
          =========================================== */}
          <aside className="hidden min-w-0 lg:sticky lg:top-5 lg:block">
            <div className="max-h-[calc(100vh-2.5rem)] overflow-y-auto rounded-3xl">
              <CurriculumPanel
                sections={orderedSections}
                lessons={orderedLessons}
                contents={publishedContents}
                tasks={publishedTasks}
                submissions={taskSubmissions}
                submissionLoadError={submissionLoadError}
                activeLessonId={activeLesson?.id ?? ""}
                activeTaskId={activeTask?.id ?? ""}
                completedLessonIds={completedLessonIds}
                expandedSectionIds={expandedSectionIds}
                onToggleSection={handleToggleSection}
                onSelectLesson={handleSelectLesson}
                onSelectTask={handleSelectTask}
              />
            </div>
          </aside>
        </div>
        {/* =============================================
            MOBILE CURRICULUM DRAWER
        ============================================= */}
        {mobileCurriculumOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            {/* BACKDROP */}
            <button
              type="button"
              aria-label="Tutup kurikulum"
              onClick={() =>
                setMobileCurriculumOpen(false)
              }
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            />
            {/* DRAWER */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Daftar kurikulum kelas"
              className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[28px] border border-slate-200 bg-[#F7F6FC] p-4 shadow-2xl sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[430px] sm:rounded-none sm:rounded-l-[28px] sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
                    Learning Curriculum
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Daftar Bab, Materi & Tugas
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMobileCurriculumOpen(false)
                  }
                  aria-label="Tutup"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="max-h-[calc(88dvh-90px)] overflow-y-auto pb-5 sm:max-h-[calc(100vh-100px)]">
                <CurriculumPanel
                  sections={orderedSections}
                  lessons={orderedLessons}
                  contents={publishedContents}
                  tasks={publishedTasks}
                  submissions={taskSubmissions}
                  submissionLoadError={submissionLoadError}
                  activeLessonId={activeLesson?.id ?? ""}
                  activeTaskId={activeTask?.id ?? ""}
                  completedLessonIds={completedLessonIds}
                  expandedSectionIds={expandedSectionIds}
                  onToggleSection={handleToggleSection}
                  onSelectLesson={handleSelectLesson}
                  onSelectTask={handleSelectTask}
                  showHeading={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
