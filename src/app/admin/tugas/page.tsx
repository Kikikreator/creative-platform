import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import TaskManager, { type TaskCourseOption } from "./task-manager";

export default async function AdminTugasPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const currentRoles = normalizeRoles(roleRows);

  if (roleError || !hasRole(currentRoles, "admin")) {
    redirect("/");
  }

  const coursesResult = await supabase
    .from("courses")
    .select("id, title, slug, status")
    .order("title", { ascending: true });

  return (
    <TaskManager
      courses={(coursesResult.data ?? []) as TaskCourseOption[]}
      userId={user.id}
      initialError={coursesResult.error?.message ?? null}
    />
  );
}
