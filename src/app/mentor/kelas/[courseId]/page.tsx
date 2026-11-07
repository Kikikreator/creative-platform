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

  return <MentorCourseSettings course={course as MentorCourseSettingsData} />;
}
