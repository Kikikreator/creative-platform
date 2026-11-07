import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import PenggunaManager, {
  type MemberRow,
  type EnrollmentRow,
  type CourseOption,
} from "../pengguna/pengguna-manager";

export default async function AdminMemberAccessPage() {
  await connection();
  const supabase = await createClient();

  const [profilesResult, rolesResult, enrollmentsResult, coursesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, whatsapp_number, address, acquisition_source, registration_reason, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id, role").limit(500),
      supabase
        .from("enrollments")
        .select("id, user_id, course_id, status, source, granted_at, revoked_at, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("courses")
        .select("id, title, slug, status, price")
        .order("title", { ascending: true })
        .limit(500),
    ]);

  const roleMap = new Map<string, string[]>();
  for (const row of rolesResult.data ?? []) {
    const roles = roleMap.get(row.user_id) ?? [];
    if (!roles.includes(row.role)) roles.push(row.role);
    roleMap.set(row.user_id, roles);
  }

  const members: MemberRow[] = (profilesResult.data ?? []).map((profile) => {
    const roles = roleMap.get(profile.id) ?? ["member"];
    const role = roles.includes("admin")
      ? "admin"
      : roles.includes("instructor")
        ? "instructor"
        : "member";
    return { ...profile, role, roles };
  });

  const errors = [
    profilesResult.error?.message,
    rolesResult.error?.message,
    enrollmentsResult.error?.message,
    coursesResult.error?.message,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="app-page-heading">
        <div>
          <p className="app-eyebrow">Member access control</p>
          <h2 className="app-page-title">Hak Akses Member</h2>
          <p className="app-page-description">
            Berikan, pantau, atau cabut akses kelas peserta. Pengelolaan menggunakan data member dan enrollment yang sama dengan halaman Pengguna & Akses.
          </p>
        </div>
      </div>
      <PenggunaManager
        initialMembers={members}
        initialEnrollments={(enrollmentsResult.data ?? []) as EnrollmentRow[]}
        courses={(coursesResult.data ?? []) as CourseOption[]}
        initialError={errors.length ? errors.join(" | ") : null}
      />
    </div>
  );
}
