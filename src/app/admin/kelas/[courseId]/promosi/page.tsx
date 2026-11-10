import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import CoursePromotionManager, {
  type CourseSummary,
  type FallbackMentor,
  type ManualReview,
  type PromotionSettings,
} from "../../course-promotion-manager";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function AdminCoursePromotionPage({ params }: PageProps) {
  await connection();
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError || !hasRole(normalizeRoles(roleRows), "admin")) {
    redirect("/");
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, slug, status, mentor_name, mentor_bio, price")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError || !course) notFound();

  const [settingsResult, reviewsResult, mentorResult] = await Promise.all([
    supabase
      .from("course_promotion_settings")
      .select(
        "course_id, mentor_display_name, mentor_headline, mentor_bio, mentor_expertise, mentor_photo_url, original_price, case_study_images, used_apps, created_by, updated_by, created_at, updated_at",
      )
      .eq("course_id", courseId)
      .maybeSingle(),
    supabase
      .from("course_manual_reviews")
      .select(
        "id, course_id, reviewer_name, rating, review_text, is_published, created_by, updated_by, created_at, updated_at",
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),
    supabase.rpc("admin_get_course_mentor_presentation_seed", {
      p_course_id: courseId,
    }),
  ]);

  const fallbackMentor = mentorResult.data
    ? (mentorResult.data as unknown as FallbackMentor)
    : null;

  const initialError =
    settingsResult.error?.message ?? reviewsResult.error?.message ?? null;

  return (
    <CoursePromotionManager
      course={course as CourseSummary}
      userId={user.id}
      initialSettings={(settingsResult.data ?? null) as PromotionSettings | null}
      initialReviews={(reviewsResult.data ?? []) as ManualReview[]}
      fallbackMentor={fallbackMentor}
      initialError={initialError}
    />
  );
}
