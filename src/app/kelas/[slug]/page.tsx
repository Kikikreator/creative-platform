import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  Layers3,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserRound,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CourseCaseStudies, CourseUsedApps, type CaseStudySlide, type UsedAppItem } from "./case-study-carousel";
import { getPrimaryRole, normalizeRoles, type AppRole } from "@/lib/auth/roles";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type PublicLesson = {
  id: string;
  title: string;
  duration_minutes: number | null;
  updated_at: string | null;
  is_preview: boolean;
  mini_material_count: number;
  position: number;
};

type PublicSection = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: PublicLesson[];
};

type PublicMentor = {
  user_id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  photo_url: string | null;
  portfolio_url: string | null;
};

type PublicReview = {
  id: string;
  rating: number;
  review_text: string;
  submitted_at: string | null;
  display_name: string;
  source?: "manual" | "participant";
  show_date?: boolean;
};

type PublicPromotionMentor = {
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  photo_url: string | null;
  original_price: number | string | null;
  case_study_images: CaseStudySlide[] | null;
  used_apps: UsedAppItem[] | null;
};

type PublicReviewSummary = {
  total_reviews: number;
  average_rating: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  reviews: PublicReview[];
};

const emptyReviewSummary: PublicReviewSummary = {
  total_reviews: 0,
  average_rating: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  reviews: [],
};

function formatPrice(value: number | string) {
  const price = Number(value) || 0;

  if (price === 0) return "Gratis";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "Belum ditentukan";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} menit`;
  if (minutes === 0) return `${hours} jam`;
  return `${hours} jam ${minutes} menit`;
}

function StarRating({
  rating,
  size = 15,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating.toFixed(1)} dari 5 bintang`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={size}
          className={
            rating >= value
              ? "fill-amber-400 text-amber-400"
              : "text-[#DDD6E2]"
          }
        />
      ))}
    </div>
  );
}

export default async function DetailKelasPage({ params }: PageProps) {
  await connection();

  const { slug } = await params;
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      description,
      short_description,
      cover_image_url,
      category,
      target_audience,
      benefits,
      mentor_name,
      mentor_bio,
      price,
      status,
      access_type
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error("Gagal memuat detail kelas.");
  }

  if (!course) {
    notFound();
  }

  const [
    userResult,
    mentorResult,
    promotionMentorResult,
    curriculumResult,
    reviewResult,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_public_course_mentor_profiles", {
      p_course_id: course.id,
    }),
    supabase.rpc("get_public_course_promotion_mentor", {
      p_course_id: course.id,
    }),
    supabase.rpc("get_public_course_curriculum", {
      p_course_id: course.id,
    }),
    supabase.rpc("get_public_course_review_summary", {
      p_course_id: course.id,
    }),
  ]);

  const user = userResult.data.user;
  let userRole: AppRole | null = null;

  if (user) {
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    // Fail closed: akun yang role-nya tidak dapat diverifikasi tidak mendapat CTA Peserta.
    if (!roleError) {
      userRole = getPrimaryRole(normalizeRoles(roleRows));
    }
  }

  const registrationHref = `/register?course=${encodeURIComponent(course.id)}`;
  const checkoutHref = `/checkout?course=${encodeURIComponent(course.id)}`;
  const courseActionHref = !user
    ? registrationHref
    : userRole === "admin"
      ? "/admin"
      : userRole === "instructor"
        ? "/mentor"
        : userRole === "member"
          ? checkoutHref
          : "/login?reason=role-check-failed";

  const courseActionLabel = !user
    ? "Daftar Kelas"
    : userRole === "admin"
      ? "Kembali ke Workspace Admin"
      : userRole === "instructor"
        ? "Kembali ke Workspace Mentor"
        : userRole === "member"
          ? "Lanjut ke Checkout"
          : "Periksa Akses Akun";

  const courseActionHint = !user
    ? "Masuk atau buat akun Peserta untuk melanjutkan pendaftaran kelas."
    : userRole === "member"
      ? "Kamu sudah masuk sebagai Peserta. Lanjutkan ke checkout untuk membuat pesanan kelas ini."
      : userRole === "admin" || userRole === "instructor"
        ? "Kamu sedang menggunakan akun pengelola. Pembelian kelas hanya tersedia melalui akun Peserta."
        : "Hak akses akun belum dapat diverifikasi. Silakan periksa kembali akunmu.";

  const benefits = Array.isArray(course.benefits)
    ? course.benefits.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const mentors = (mentorResult.data ?? []) as PublicMentor[];
  const promotionMentor = promotionMentorResult.data
    ? (promotionMentorResult.data as unknown as PublicPromotionMentor)
    : null;
  const caseStudyImages = Array.isArray(promotionMentor?.case_study_images)
    ? promotionMentor.case_study_images.filter(
        (image): image is CaseStudySlide =>
          Boolean(image && typeof image.url === "string" && image.url.trim()),
      )
    : [];
  const usedApps = Array.isArray(promotionMentor?.used_apps)
    ? promotionMentor.used_apps.filter(
        (app): app is UsedAppItem =>
          Boolean(
            app &&
              typeof app.name === "string" &&
              app.name.trim() &&
              typeof app.url === "string" &&
              app.url.trim(),
          ),
      )
    : [];
  const hasToolsAndCaseStudies = usedApps.length > 0 || caseStudyImages.length > 0;
  const originalPrice = Number(promotionMentor?.original_price ?? 0);
  const currentCoursePrice = Number(course.price ?? 0);
  const hasStrikethroughPrice =
    originalPrice > 0 && originalPrice > currentCoursePrice;
  const hasPromotionMentor = Boolean(
    promotionMentor &&
      (promotionMentor.display_name ||
        promotionMentor.headline ||
        promotionMentor.bio ||
        promotionMentor.photo_url ||
        promotionMentor.expertise?.length),
  );
  const curriculum = Array.isArray(curriculumResult.data)
    ? (curriculumResult.data as unknown as PublicSection[])
    : [];

  const reviewSummary = reviewResult.data
    ? (reviewResult.data as unknown as PublicReviewSummary)
    : emptyReviewSummary;

  const totalReviews = Number(reviewSummary.total_reviews ?? 0);
  const averageRating = Number(reviewSummary.average_rating ?? 0);
  const ratingDistribution = reviewSummary.distribution ?? emptyReviewSummary.distribution;
  const reviews = Array.isArray(reviewSummary.reviews)
    ? reviewSummary.reviews
    : [];

  const allPublishedLessons = curriculum.flatMap((section) => section.lessons ?? []);
  const totalLessons = allPublishedLessons.length;
  const totalMiniMaterials = allPublishedLessons.reduce(
    (total, lesson) => total + (Number(lesson.mini_material_count) || 0),
    0,
  );
  const totalMaterials = totalLessons + totalMiniMaterials;
  const totalDurationMinutes = allPublishedLessons.reduce(
    (total, lesson) => total + (Number(lesson.duration_minutes) || 0),
    0,
  );
  const lastUpdatedAt = allPublishedLessons
    .map((lesson) => lesson.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const accessLabel =
    course.access_type === "permanent"
      ? "Akses permanen"
      : "Akses sesuai ketentuan kelas";

  return (
    <main className="min-h-screen bg-[#F8F7FA] text-[#21182A]">
      <header className="sticky top-0 z-40 border-b border-[#EEEAF2] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#260047] text-white shadow-sm">
              <GraduationCap size={22} />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-[#260047]">
                Kiki Creator Class
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#948B9B]">
                Creative Learning Platform
              </p>
            </div>
          </Link>

          <Link
            href="/kelas"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-[#716879] transition hover:bg-[#F5F2F7] hover:text-[#260047] sm:text-sm"
          >
            <ArrowLeft size={16} />
            <span>Semua Kelas</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pt-9">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] text-[#968D9D]">
          <Link href="/kelas" className="transition hover:text-[#260047]">
            Katalog Kelas
          </Link>
          <span>/</span>
          <span className="max-w-[240px] truncate font-semibold text-[#62576D]">
            {course.title}
          </span>
        </div>

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0EBF3] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#260047]">
              <Sparkles size={12} />
              Program Pembelajaran
            </span>
            {course.category && (
              <span className="rounded-lg border border-[#EAE5ED] bg-white px-3 py-2 text-[9px] font-bold text-[#746D7B]">
                {course.category}
              </span>
            )}
          </div>

          <h1 className="mt-4 max-w-4xl text-[27px] font-extrabold leading-tight tracking-[-0.04em] text-[#21182A] sm:text-[38px]">
            {course.title}
          </h1>
        </section>

        {/* Cover kelas dikelola dari Manajemen Kelas Admin. */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#EAE5ED] bg-white p-2 shadow-[0_10px_28px_rgba(38,0,71,.055)]">
          <div className="relative aspect-[16/8.5] overflow-hidden rounded-xl bg-[#F0EBF3]">
            {course.cover_image_url ? (
              <img
                src={course.cover_image_url}
                alt={`Cover kelas ${course.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[#260047]">
                <BookOpen size={48} strokeWidth={1.3} />
                <span className="text-xs font-semibold">
                  Cover kelas belum tersedia
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Deskripsi kelas dan harga. */}
        <section className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
          <div className="rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.035)] sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EDF4] text-[#260047]">
                <BookOpen size={19} />
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#74627E]">
                  COURSE OVERVIEW
                </p>
                <h2 className="mt-0.5 text-base font-extrabold text-[#21182A]">
                  Kelas apa ini?
                </h2>
              </div>
            </div>

            {course.short_description && (
              <p className="mt-5 max-w-[72ch] text-sm font-medium leading-7 text-[#51465D]">
                {course.short_description}
              </p>
            )}

            {(course.description || !course.short_description) && (
              <div className="mt-3 border-t border-[#F0ECF2] pt-4">
                <p className="max-w-[72ch] whitespace-pre-line text-sm leading-7 text-[#746D7B]">
                  {course.description || "Informasi detail kelas belum tersedia."}
                </p>
              </div>
            )}

            {benefits.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-extrabold text-[#30243A]">
                  Yang akan kamu pelajari dan dapatkan
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {benefits.map((benefit, index) => (
                    <div
                      key={`${index}-${benefit}`}
                      className="flex items-start gap-2.5 rounded-xl bg-[#F8F6F9] px-3 py-3"
                    >
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-[#09483F]"
                      />
                      <p className="text-[10px] leading-5 text-[#62596A]">
                        {benefit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {course.target_audience && (
              <div className="mt-5 rounded-xl border border-[#EAE5ED] bg-white p-4">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-[#09483F]" />
                  <h3 className="text-[11px] font-extrabold text-[#30243A]">
                    Cocok untuk siapa?
                  </h3>
                </div>
                <p className="mt-2 text-[11px] leading-6 text-[#746D7B]">
                  {course.target_audience}
                </p>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-[88px]">
            <div className="overflow-hidden rounded-2xl border border-[#EAE5ED] bg-white shadow-[0_10px_28px_rgba(38,0,71,.07)]">
              <div className="bg-[#260047] px-5 py-6 text-white sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold text-white/75">
                    Harga Kelas
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <BookOpen size={17} />
                  </span>
                </div>
                {hasStrikethroughPrice && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-white/60 line-through decoration-white/70">
                      {formatPrice(originalPrice)}
                    </span>
                    <span className="rounded-md bg-white/15 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wide text-white">
                      Harga Promo
                    </span>
                  </div>
                )}
                <p className={`${hasStrikethroughPrice ? "mt-1" : "mt-4"} break-words text-[clamp(1.6rem,3vw,2rem)] font-extrabold leading-tight tracking-tight tabular-nums`}>
                  {formatPrice(course.price)}
                </p>
                <p className="mt-2 text-[10px] leading-5 text-white/70">
                  Satu kali pembayaran untuk mulai belajar di kelas ini.
                </p>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="text-[#8C8293]">Semua Materi</span>
                    <strong className="text-right text-[#30243A]">{totalMaterials} Materi</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="text-[#8C8293]">Durasi Keseluruhan</span>
                    <strong className="text-right text-[#30243A]">{formatDuration(totalDurationMinutes)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="text-[#8C8293]">Terakhir Update</span>
                    <strong className="text-right text-[#30243A]">{lastUpdatedAt ? formatDate(lastUpdatedAt) : "Belum diperbarui"}</strong>
                  </div>
                </div>

                <div className="border-t border-[#F0ECF2] pt-4">
                  <Link
                    href={courseActionHref}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 py-3 text-xs font-extrabold text-white shadow-[0_5px_14px_rgba(38,0,71,.15)] transition hover:bg-[#09483F]"
                  >
                    {courseActionLabel}
                    <ArrowRight size={16} />
                  </Link>
                  <p className="mt-3 text-center text-[9px] leading-5 text-[#948B9B]">
                    {courseActionHint}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#EAE5ED] bg-white px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]">
                <ShieldCheck size={17} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-[#30243A]">
                  {accessLabel}
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-[#948B9B]">
                  Materi kelas tersimpan di akun Peserta.
                </p>
              </div>
            </div>
          </aside>
        </section>

        {/* Kurikulum selalu mengambil Bab dan Materi Inti yang sudah diterbitkan. */}
        <section className="mt-8 rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.035)] sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#74627E]">
                COURSE CURRICULUM
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#21182A]">
                Materi yang Akan Dipelajari
              </h2>
              <p className="mt-1.5 max-w-2xl text-[10px] leading-5 text-[#948B9B]">
                Lihat susunan Bab dan Materi Inti sebelum bergabung. Materi lengkap akan terbuka setelah kamu memiliki akses kelas.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#F2EEF5] px-3 py-2 text-[9px] font-extrabold text-[#260047]">
              <Layers3 size={13} />
              {curriculum.length} Bab · {totalLessons} Materi
            </span>
          </div>

          {curriculumResult.error ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-800">
              Kurikulum belum dapat dimuat. Pastikan migration data landing page sudah diterapkan di Supabase.
            </div>
          ) : curriculum.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#DED6E3] bg-[#FCFBFD] px-5 py-9 text-center">
              <BookOpen size={28} className="mx-auto text-[#B8AEBF]" />
              <p className="mt-3 text-xs font-bold text-[#51465D]">
                Kurikulum sedang disiapkan
              </p>
              <p className="mt-1 text-[10px] leading-5 text-[#948B9B]">
                Materi akan muncul otomatis di sini setelah Bab dan Materi Inti dipublikasikan Admin.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {curriculum.map((section, sectionIndex) => (
                <details
                  key={section.id}
                  open={sectionIndex === 0}
                  className="group overflow-hidden rounded-2xl border border-[#EAE5ED] bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[#FBFAFC] px-4 py-4 transition hover:bg-[#F7F4F8] [&::-webkit-details-marker]:hidden sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0EBF3] text-[#260047]">
                        <Layers3 size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#84758D]">
                          Bab {sectionIndex + 1}
                        </p>
                        <h3 className="mt-0.5 truncate text-[12px] font-extrabold text-[#30243A]">
                          {section.title}
                        </h3>
                        {section.description && (
                          <p className="mt-1 line-clamp-1 text-[9px] text-[#948B9B]">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#746D7B]">
                        {section.lessons.length} Materi
                      </span>
                      <ChevronDown
                        size={16}
                        className="text-[#746D7B] transition group-open:rotate-180"
                      />
                    </div>
                  </summary>

                  <div className="divide-y divide-[#F0ECF2] border-t border-[#F0ECF2]">
                    {section.lessons.map((lesson, lessonIndex) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              lesson.is_preview
                                ? "bg-[#EDF4F2] text-[#09483F]"
                                : "bg-[#F3F0F4] text-[#817789]"
                            }`}
                          >
                            {lesson.is_preview ? (
                              <PlayCircle size={16} />
                            ) : (
                              <LockKeyhole size={15} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-[#9A909F]">
                              Materi {lessonIndex + 1}
                            </p>
                            <h4 className="mt-0.5 text-[10px] font-bold leading-5 text-[#51465D]">
                              {lesson.title}
                            </h4>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-[#A49BAA]">
                              {lesson.duration_minutes ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 size={10} />
                                  {lesson.duration_minutes} menit
                                </span>
                              ) : (
                                <span>Durasi fleksibel</span>
                              )}
                              {lesson.mini_material_count > 0 && (
                                <span>
                                  {lesson.mini_material_count} Mini Materi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[8px] font-extrabold ${
                            lesson.is_preview
                              ? "bg-[#EDF4F2] text-[#09483F]"
                              : "bg-[#F3F0F4] text-[#746D7B]"
                          }`}
                        >
                          {lesson.is_preview ? "Preview" : "Terkunci"}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}

          <p className="mt-4 text-[9px] leading-5 text-[#A49BAA]">
            Daftar ini diperbarui otomatis dari materi resmi yang sudah dipublikasikan. Draft Mentor dan pengajuan yang menunggu persetujuan Admin tidak ditampilkan.
          </p>
        </section>

        {/* Informasi sertifikat ditempatkan setelah kurikulum sebagai hasil akhir pembelajaran. */}
        <section
          aria-labelledby="course-certificate-title"
          className="mt-5 rounded-2xl border border-[#EAE5ED] bg-white p-4 shadow-[0_2px_10px_rgba(38,0,71,.025)] sm:p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]">
              <Award size={23} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#09483F]">
                Sertifikat kelulusan
              </p>
              <h2 id="course-certificate-title" className="mt-1 text-base font-semibold leading-snug text-[#21182A] sm:text-lg">
                Selesaikan kelas dan dapatkan sertifikat
              </h2>
              
            </div>
          </div>
        </section>

        {/* Profil Mentor mengambil data dari penugasan dan profil yang telah disetujui. */}
        <section className={`mt-8 grid items-stretch gap-5 ${
          hasToolsAndCaseStudies
            ? "lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.9fr)]"
            : "grid-cols-1"
        }`}>
          <article className="min-w-0 rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.035)] sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]">
                <GraduationCap size={19} />
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#74627E]">
                  INSTRUCTOR
                </p>
                <h2 className="mt-0.5 text-base font-extrabold text-[#21182A]">
                  Kenali Mentor Kelas
                </h2>
              </div>
            </div>

            {hasPromotionMentor && promotionMentor ? (
              <article className="mt-5 overflow-hidden rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5">
                <div className="grid items-center gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-2xl bg-[#F0EBF3]">
                    {promotionMentor.photo_url ? (
                      <img
                        src={promotionMentor.photo_url}
                        alt={`Foto ${promotionMentor.display_name || "mentor kelas"}`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-[#260047]">
                        <UserRound size={42} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-[#30243A]">
                      {promotionMentor.display_name || "Mentor Kiki Creator Class"}
                    </h3>
                    {promotionMentor.headline && (
                      <p className="mt-1 text-[11px] font-semibold text-[#84798C]">
                        {promotionMentor.headline}
                      </p>
                    )}
                    {promotionMentor.bio && (
                      <p className="mt-3 whitespace-pre-line text-[11px] leading-6 text-[#746D7B]">
                        {promotionMentor.bio}
                      </p>
                    )}
                    {promotionMentor.expertise?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {promotionMentor.expertise.map((skill) => (
                          <span key={skill} className="rounded-lg bg-[#F0EBF3] px-2.5 py-1.5 text-[9px] font-bold text-[#51405D]">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : mentors.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {mentors.map((mentor) => (
                  <article
                    key={mentor.user_id}
                    className="rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-3">
                      {mentor.photo_url ? (
                        <img
                          src={mentor.photo_url}
                          alt={`Foto ${mentor.full_name}`}
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F0EBF3] text-[#260047]">
                          <UserRound size={28} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-extrabold text-[#30243A]">
                          {mentor.full_name}
                        </h3>
                        <p className="mt-1 text-[10px] leading-5 text-[#84798C]">
                          {mentor.headline || "Mentor Kiki Creator Class"}
                        </p>
                      </div>
                    </div>

                    {mentor.bio && (
                      <p className="mt-4 whitespace-pre-line text-[10px] leading-6 text-[#746D7B]">
                        {mentor.bio}
                      </p>
                    )}

                    {mentor.expertise?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {mentor.expertise.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg bg-[#F0EBF3] px-2.5 py-1.5 text-[8px] font-bold text-[#51405D]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {mentor.portfolio_url && (
                      <a
                        href={mentor.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-[9px] font-extrabold text-[#09483F] hover:underline"
                      >
                        Lihat portofolio
                        <ArrowRight size={12} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : course.mentor_name ? (
              <div className="mt-5 flex items-start gap-4 rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F0EBF3] text-[#260047]">
                  <UserRound size={25} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#30243A]">
                    {course.mentor_name}
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold text-[#84798C]">
                    Mentor Kiki Creator Class
                  </p>
                  {course.mentor_bio && (
                    <p className="mt-3 whitespace-pre-line text-[10px] leading-6 text-[#746D7B]">
                      {course.mentor_bio}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-[#DED6E3] bg-[#FCFBFD] p-6 text-center">
                <Users size={25} className="mx-auto text-[#B8AEBF]" />
                <p className="mt-2 text-xs font-bold text-[#51465D]">
                  Informasi mentor sedang disiapkan
                </p>
                <p className="mt-1 text-[9px] leading-5 text-[#948B9B]">
                  Profil mentor akan tampil setelah mentor disetujui dan ditugaskan ke kelas ini.
                </p>
              </div>
            )}
          </article>
          {hasToolsAndCaseStudies && <CourseUsedApps apps={usedApps} />}
        </section>

        {hasToolsAndCaseStudies && (
          <CourseCaseStudies images={caseStudyImages} courseTitle={course.title} />
        )}

        {/* Rating dan ulasan dari peserta yang telah menyelesaikan kelas. */}
        <section className="mt-8 rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_8px_24px_rgba(38,0,71,.035)] sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7E8] text-[#D58A12]">
              <Star size={19} />
            </div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#8A6B3F]">
                COURSE RATINGS & REVIEWS
              </p>
              <h2 className="mt-0.5 text-base font-extrabold text-[#21182A]">
                Rating dan Ulasan Kelas
              </h2>
            </div>
          </div>

          {reviewResult.error ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-800">
              Rating dan ulasan belum dapat dimuat. Pastikan migration data landing page sudah diterapkan di Supabase.
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-5 rounded-2xl bg-[#FCFBFD] p-4 sm:p-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="flex flex-col items-center justify-center border-b border-[#EAE5ED] pb-4 text-center md:border-b-0 md:border-r md:pb-0 md:pr-5">
                  <p className="text-4xl font-extrabold tracking-tight text-[#21182A] tabular-nums">
                    {averageRating.toFixed(1)}
                  </p>
                  <div className="mt-2">
                    <StarRating rating={averageRating} size={17} />
                  </div>
                  <p className="mt-2 text-[9px] font-semibold text-[#948B9B]">
                    {totalReviews} Rating
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-2.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = Number(
                      ratingDistribution[String(star) as keyof typeof ratingDistribution] ?? 0,
                    );
                    const percentage =
                      totalReviews > 0 ? (count / totalReviews) * 100 : 0;

                    return (
                      <div
                        key={star}
                        className="grid grid-cols-[38px_minmax(0,1fr)_54px] items-center gap-2"
                      >
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#746D7B]">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          {star}
                        </span>
                        <div className="h-2 overflow-hidden rounded-full bg-[#EAE5ED]">
                          <div
                            className="h-full rounded-full bg-[#E5A02A]"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-right text-[9px] text-[#948B9B]">
                          {count} Rating
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className="mt-5 divide-y divide-[#F0ECF2]">
                  {reviews.map((review) => (
                    <article key={review.id} className="py-5 first:pt-1 last:pb-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 items-center gap-2.5 sm:w-48 sm:shrink-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0EBF3] text-[10px] font-extrabold text-[#260047]">
                            {review.source === "manual"
                              ? (review.display_name || "Ulasan").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
                              : "PT"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-extrabold text-[#51465D]">
                              {review.display_name || "Peserta Terverifikasi"}
                            </p>
                            {review.show_date !== false && review.source !== "manual" && review.submitted_at && (
                              <p className="mt-0.5 text-[8px] text-[#A49BAA]">
                                {formatDate(review.submitted_at)}
                              </p>
                            )}
                            <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[8px] font-bold ${review.source === "manual" ? "bg-[#F0EBF3] text-[#5C3A70]" : "bg-emerald-50 text-emerald-700"}`}>
                              {review.source === "manual" ? "Ulasan Kelas Sebelumnya" : "Peserta Terverifikasi"}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <StarRating rating={Number(review.rating)} size={13} />
                          <p className="mt-2 whitespace-pre-line text-[11px] leading-6 text-[#746D7B]">
                            {review.review_text}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#DED6E3] bg-[#FCFBFD] px-5 py-8 text-center">
                  <Star size={25} className="mx-auto text-[#D5C9DA]" />
                  <p className="mt-2 text-xs font-bold text-[#51465D]">
                    Belum ada ulasan untuk kelas ini
                  </p>
                  <p className="mt-1 text-[9px] leading-5 text-[#948B9B]">
                    Rating peserta dan ulasan kelas sebelumnya akan ditampilkan di sini.
                  </p>
                </div>
              )}
            </>
          )}
        </section>


        <section className="mt-7 overflow-hidden rounded-2xl bg-[#260047] px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-extrabold">
                Siap Memulai Pembelajaran?
              </p>
              <p className="mt-1.5 max-w-xl text-xs leading-6 text-white/75">
                {userRole === "admin" || userRole === "instructor"
                  ? "Lihat informasi kelas sebagai referensi. Pengelolaan tetap dilakukan melalui workspace sesuai peran akun."
                  : "Bergabunglah dan mulai perjalanan belajarmu bersama Kiki Creator Class."}
              </p>
            </div>
            <Link
              href={courseActionHref}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#260047] transition hover:bg-[#EDF4F2] hover:text-[#09483F] sm:w-auto"
            >
              {courseActionLabel}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#EEEAF2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-extrabold text-[#260047]"
          >
            <GraduationCap size={19} />
            Kiki Creator Class
          </Link>
          <p className="text-[9px] text-[#A49BAA]">
            © 2026 Kiki Creator Class. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
