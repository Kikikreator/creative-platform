import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MentorCourseSettings, { type MentorCourseSettingsData } from "./course-settings";

export default async function MentorCourseSettingsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("course_task_mentors")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("mentor_user_id", user.id)
    .maybeSingle();

  if (assignmentError || !assignment) notFound();

  const { data: course, error } = await supabase
    .from("courses")
    .select("id, title, slug, short_description, description, cover_image_url, category, target_audience, benefits, status, price")
    .eq("id", courseId)
    .maybeSingle();

  if (error || !course) notFound();

  const [participantsResult, agreementResult] = await Promise.all([
    supabase.rpc("get_mentor_course_participants", { p_course_id: courseId }),
    supabase
      .from("course_mentor_revenue_agreements")
      .select("id, is_active, mentor_share_percent, platform_percent")
      .eq("course_id", courseId)
      .eq("mentor_user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <MentorCourseSettings
      course={course as MentorCourseSettingsData}
      participants={(participantsResult.data ?? []) as Array<{ user_id: string; full_name: string; enrolled_at: string }>}
      hasRevenueAgreement={Boolean(agreementResult.data?.is_active)}
      participantError={participantsResult.error?.message ?? null}
    />
  );
}
