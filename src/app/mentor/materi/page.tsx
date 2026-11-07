import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import MentorContentManager, { type MentorCourseOption } from "./mentor-content-manager";

type PageProps = {
  searchParams?: Promise<{ course?: string | string[] }>;
};

export default async function MentorMaterialsPage({ searchParams }: PageProps) {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const params = (await searchParams) ?? {};
  const { data: assignments, error: assignmentError } = await supabase
    .from("course_task_mentors")
    .select("course_id")
    .eq("mentor_user_id", user.id);

  const courseIds = Array.from(new Set((assignments ?? []).map((row) => row.course_id)));
  const { data: courses, error: coursesError } = courseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, slug, status, cover_image_url")
        .in("id", courseIds)
        .order("title", { ascending: true })
    : { data: [], error: null };

  const requested = Array.isArray(params.course) ? params.course[0] : params.course;
  const initialCourseId =
    requested && (courses ?? []).some((course) => course.id === requested)
      ? requested
      : courses?.[0]?.id ?? "";

  return (
    <MentorContentManager
      courses={(courses ?? []) as MentorCourseOption[]}
      initialCourseId={initialCourseId}
      initialError={assignmentError?.message ?? coursesError?.message ?? null}
    />
  );
}
