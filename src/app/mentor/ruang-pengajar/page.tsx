import { createClient } from "@/lib/supabase/server";
import MentorWorkspaceManager, { type MentorWorkspaceCourse, type WorkspaceEntry } from "./workspace-manager";

export default async function MentorWorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignments } = await supabase
    .from("course_task_mentors")
    .select("course_id")
    .eq("mentor_user_id", user.id);
  const ids = Array.from(new Set((assignments ?? []).map((row) => row.course_id)));
  const { data: courses } = ids.length
    ? await supabase.from("courses").select("id, title").in("id", ids).order("title")
    : { data: [] };
  const { data: entries, error } = await supabase
    .from("mentor_workspace_entries")
    .select("id, mentor_user_id, course_id, entry_type, title, body, starts_at, ends_at, is_completed, created_at, updated_at")
    .eq("mentor_user_id", user.id)
    .order("starts_at", { ascending: true, nullsFirst: false });

  return (
    <MentorWorkspaceManager
      userId={user.id}
      courses={(courses ?? []) as MentorWorkspaceCourse[]}
      initialEntries={(entries ?? []) as WorkspaceEntry[]}
      initialError={error?.message ?? null}
    />
  );
}
