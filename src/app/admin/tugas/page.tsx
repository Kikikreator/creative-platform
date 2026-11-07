import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import TaskManager, {
  type TaskCourseOption,
  type TaskProfileOption,
} from "./task-manager";

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

  const [coursesResult, profilesResult, allRolesResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug, status")
      .order("title", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true })
      .limit(1000),
    supabase
      .from("user_roles")
      .select("user_id, role")
      .limit(5000),
  ]);

  const errors = [
    coursesResult.error?.message,
    profilesResult.error?.message,
    allRolesResult.error?.message,
  ].filter(Boolean);

  const roleMap = new Map<string, string[]>();
  for (const row of allRolesResult.data ?? []) {
    const current = roleMap.get(row.user_id) ?? [];
    if (!current.includes(row.role)) current.push(row.role);
    roleMap.set(row.user_id, current);
  }

  const profileOptions: TaskProfileOption[] = (
    profilesResult.data ?? []
  ).map((profile) => ({
    ...profile,
    roles: roleMap.get(profile.id) ?? [],
  }));

  return (
    <TaskManager
      courses={(coursesResult.data ?? []) as TaskCourseOption[]}
      profiles={profileOptions}
      userId={user.id}
      initialError={errors.length ? errors.join(" | ") : null}
    />
  );
}
