import { connection } from "next/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import MentorManager, { type MentorAccount } from "./mentor-manager";
import MentorInvitePanel from "./mentor-invite-panel";

export default async function AdminMentorPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: currentRoleRows, error: currentRoleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (currentRoleError) {
    throw new Error(
      `Gagal memeriksa hak akses administrator: ${currentRoleError.message}`
    );
  }

  const currentRoles = normalizeRoles(currentRoleRows);

  if (!hasRole(currentRoles, "admin")) {
    redirect("/");
  }

  const [
    profilesResult,
    rolesResult,
    assignmentsResult,
    coursesResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),

    supabase
      .from("user_roles")
      .select("user_id, role")
      .limit(5000),

    supabase
      .from("course_task_mentors")
      .select("mentor_user_id, course_id")
      .limit(5000),

    supabase
      .from("courses")
      .select("id, title, slug, status")
      .order("title", { ascending: true })
      .limit(1000),
  ]);

  const errors = [
    profilesResult.error?.message,
    rolesResult.error?.message,
    assignmentsResult.error?.message,
    coursesResult.error?.message,
  ].filter(Boolean);

  const roleMap = new Map<string, string[]>();

  for (const row of rolesResult.data ?? []) {
    const roles = roleMap.get(row.user_id) ?? [];
    if (!roles.includes(row.role)) roles.push(row.role);
    roleMap.set(row.user_id, roles);
  }

  const courseMap = new Map<string, string>(
    (coursesResult.data ?? []).map((course) => [
      course.id,
      course.title,
    ] as const)
  );

  const assignmentsMap = new Map<string, string[]>();

  for (const row of assignmentsResult.data ?? []) {
    const courseTitle = courseMap.get(row.course_id);
    if (!courseTitle) continue;

    const current = assignmentsMap.get(row.mentor_user_id) ?? [];
    if (!current.includes(courseTitle)) current.push(courseTitle);
    assignmentsMap.set(row.mentor_user_id, current);
  }

  const accounts: MentorAccount[] = (
    profilesResult.data ?? []
  ).map((profile) => ({
    ...profile,
    roles: roleMap.get(profile.id) ?? [],
    assignedCourses: assignmentsMap.get(profile.id) ?? [],
  }));

  return (
    <div className="space-y-5">
      <MentorInvitePanel />
      <MentorManager
        initialAccounts={accounts}
        initialError={errors.length ? errors.join(" | ") : null}
      />
    </div>
  );
}
