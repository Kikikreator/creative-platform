import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import MentorPublicationReview, { type AdminChapterSubmission } from "./review-manager";

type SnapshotLesson = {
  resource_path?: string | null;
  contents?: Array<{ resource_path?: string | null }>;
};

export default async function AdminMentorPublicationPage() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentor_chapter_submissions")
    .select("id, draft_id, mentor_user_id, course_id, section_id, title, action, status, payload, base_snapshot, mentor_note, admin_note, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(100);

  const mentorIds = Array.from(new Set((data ?? []).map((item) => item.mentor_user_id)));
  const courseIds = Array.from(new Set((data ?? []).map((item) => item.course_id)));
  const [{ data: profiles }, { data: courses }] = await Promise.all([
    mentorIds.length ? supabase.from("profiles").select("id, full_name").in("id", mentorIds) : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
  ]);
  const mentorMap = new Map((profiles ?? []).map((item) => [item.id, item.full_name]));
  const courseMap = new Map((courses ?? []).map((item) => [item.id, item.title]));

  const items: AdminChapterSubmission[] = await Promise.all((data ?? []).map(async (item) => {
    const payload = item.payload as { lessons?: SnapshotLesson[] } | null;
    const baseSnapshot = item.base_snapshot as { lessons?: SnapshotLesson[] } | null;
    const paths = new Set<string>();
    for (const lesson of [...(payload?.lessons ?? []), ...(baseSnapshot?.lessons ?? [])]) {
      if (lesson.resource_path) paths.add(lesson.resource_path);
      for (const content of lesson.contents ?? []) {
        if (content.resource_path) paths.add(content.resource_path);
      }
    }

    const signedPairs = await Promise.all(Array.from(paths).map(async (path) => {
      const { data: signed } = await supabase.storage.from("learning-resources").createSignedUrl(path, 900);
      return [path, signed?.signedUrl ?? ""] as const;
    }));
    const previewUrls = Object.fromEntries(signedPairs.filter(([, url]) => Boolean(url)));

    return {
      ...item,
      payload: item.payload as AdminChapterSubmission["payload"],
      base_snapshot: item.base_snapshot as AdminChapterSubmission["base_snapshot"],
      mentor_name: mentorMap.get(item.mentor_user_id) || "Mentor",
      course_title: courseMap.get(item.course_id) || "Kelas",
      preview_urls: previewUrls,
    } as AdminChapterSubmission;
  }));

  return <MentorPublicationReview items={items} initialError={error?.message ?? null} />;
}
