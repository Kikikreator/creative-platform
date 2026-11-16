import { createClient } from "@/lib/supabase/server";
import MentorProfileManager, { type MentorProfileData, type MentorAssignedCourse } from "./profile-manager";

export default async function MentorProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: account, error: accountError },
    { data: mentorProfile, error: mentorProfileError },
    { data: assignments, error: assignmentError },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("mentor_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("course_task_mentors").select("course_id").eq("mentor_user_id", user.id),
  ]);

  const courseIds = Array.from(new Set((assignments ?? []).map((row) => row.course_id).filter(Boolean)));
  const { data: courses, error: coursesError } = courseIds.length
    ? await supabase.from("courses").select("id, title, category").in("id", courseIds).order("title", { ascending: true })
    : { data: [], error: null };

  const assignedCourses: MentorAssignedCourse[] = (courses ?? []).map((course) => ({
    id: course.id,
    title: course.title,
    category: course.category ?? null,
  }));

  const initialError = [accountError?.message, mentorProfileError?.message, assignmentError?.message, coursesError?.message]
    .filter(Boolean).join(" ");

  return (
    <MentorProfileManager
      userId={user.id}
      email={user.email ?? ""}
      fullName={account?.full_name ?? ""}
      avatarUrl={account?.avatar_url ?? null}
      initialProfile={(mentorProfile ?? null) as MentorProfileData | null}
      assignedCourses={assignedCourses}
      initialError={initialError || null}
    />
  );
}
