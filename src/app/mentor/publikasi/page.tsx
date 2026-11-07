import { createClient } from "@/lib/supabase/server";
import MentorPublicationList, { type MentorPublicationItem } from "./publication-list";

export default async function MentorPublicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("mentor_chapter_submissions")
    .select("id, course_id, section_id, title, action, status, mentor_note, admin_note, submitted_at, reviewed_at")
    .eq("mentor_user_id", user.id)
    .order("submitted_at", { ascending: false });

  const courseIds = Array.from(new Set((data ?? []).map((item) => item.course_id)));
  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [] };
  const courseMap = new Map((courses ?? []).map((course) => [course.id, course.title]));

  const items: MentorPublicationItem[] = (data ?? []).map((item) => ({
    ...item,
    course_title: courseMap.get(item.course_id) ?? "Kelas",
  })) as MentorPublicationItem[];

  return <MentorPublicationList items={items} initialError={error?.message ?? null} />;
}
