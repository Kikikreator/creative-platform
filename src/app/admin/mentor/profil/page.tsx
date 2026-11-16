import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import MentorProfileReview, {
  type AdminMentorProfile,
  type AdminMentorAssignedCourse,
} from "./profile-review-manager";

type MentorProfileRow = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  education: string | null;
  experience: string | null;
  portfolio_url: string | null;
  photo_url: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  approval_status: string;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export default async function AdminMentorProfilePage() {
  await connection();
  const supabase = await createClient();

  // Ambil semua akun yang memiliki role Mentor, bukan hanya profil pending.
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "instructor");

  const mentorIds = Array.from(
    new Set((roleRows ?? []).map((row) => row.user_id).filter(Boolean))
  );

  let profiles: Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }> = [];
  let mentorProfiles: MentorProfileRow[] = [];
  let assignments: Array<{ mentor_user_id: string; course_id: string }> = [];
  const queryErrors: string[] = [];

  if (roleError) queryErrors.push(roleError.message);

  if (mentorIds.length) {
    const [profilesResult, mentorProfilesResult, assignmentsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", mentorIds),
        supabase
          .from("mentor_profiles")
          .select(
            "user_id, headline, bio, expertise, education, experience, portfolio_url, photo_url, cv_path, cv_file_name, approval_status, admin_note, submitted_at, reviewed_at"
          )
          .in("user_id", mentorIds),
        supabase
          .from("course_task_mentors")
          .select("mentor_user_id, course_id")
          .in("mentor_user_id", mentorIds),
      ]);

    profiles = profilesResult.data ?? [];
    mentorProfiles = (mentorProfilesResult.data ?? []) as MentorProfileRow[];
    assignments = assignmentsResult.data ?? [];

    if (profilesResult.error) queryErrors.push(profilesResult.error.message);
    if (mentorProfilesResult.error) queryErrors.push(mentorProfilesResult.error.message);
    if (assignmentsResult.error) queryErrors.push(assignmentsResult.error.message);
  }

  const courseIds = Array.from(
    new Set(assignments.map((row) => row.course_id).filter(Boolean))
  );

  const { data: courses, error: coursesError } = courseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, category")
        .in("id", courseIds)
        .order("title", { ascending: true })
    : { data: [], error: null };

  if (coursesError) queryErrors.push(coursesError.message);

  const profileMap = new Map(profiles.map((row) => [row.id, row]));
  const mentorProfileMap = new Map(mentorProfiles.map((row) => [row.user_id, row]));
  const courseMap = new Map((courses ?? []).map((row) => [row.id, row]));
  const assignedCourseMap = new Map<string, AdminMentorAssignedCourse[]>();

  for (const assignment of assignments) {
    const course = courseMap.get(assignment.course_id);
    if (!course) continue;

    const current = assignedCourseMap.get(assignment.mentor_user_id) ?? [];
    if (!current.some((item) => item.id === course.id)) {
      current.push({
        id: course.id,
        title: course.title,
        category: course.category ?? null,
      });
    }
    assignedCourseMap.set(assignment.mentor_user_id, current);
  }

  const items: AdminMentorProfile[] = mentorIds.map((userId) => {
    const account = profileMap.get(userId);
    const mentor = mentorProfileMap.get(userId);

    return {
      user_id: userId,
      full_name: account?.full_name?.trim() || "Mentor",
      avatar_url: account?.avatar_url ?? null,
      headline: mentor?.headline ?? null,
      bio: mentor?.bio ?? null,
      expertise: mentor?.expertise ?? [],
      education: mentor?.education ?? null,
      experience: mentor?.experience ?? null,
      portfolio_url: mentor?.portfolio_url ?? null,
      photo_url: mentor?.photo_url ?? null,
      cv_path: mentor?.cv_path ?? null,
      cv_file_name: mentor?.cv_file_name ?? null,
      approval_status: mentor?.approval_status ?? "not_started",
      admin_note: mentor?.admin_note ?? null,
      submitted_at: mentor?.submitted_at ?? null,
      reviewed_at: mentor?.reviewed_at ?? null,
      assigned_courses: (assignedCourseMap.get(userId) ?? []).sort((a, b) =>
        a.title.localeCompare(b.title)
      ),
    };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <MentorProfileReview
      items={items}
      initialError={queryErrors.length ? queryErrors.join(" · ") : null}
    />
  );
}
