import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

import PenggunaManager, {
  type MemberRow,
  type EnrollmentRow,
  type CourseOption,
} from "./pengguna-manager";

// ============================================
// LOADING STATE
// ============================================

function PenggunaLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-[22px] bg-white shadow-sm"
          />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-[22px] bg-white shadow-sm" />
    </div>
  );
}

// ============================================
// HALAMAN UTAMA
// ============================================

export default function AdminPenggunaPage() {
  return (
    <Suspense fallback={<PenggunaLoading />}>
      <AdminPenggunaContent />
    </Suspense>
  );
}

// ============================================
// PENGAMBILAN DATA SERVER
// ============================================

async function AdminPenggunaContent() {
  await connection();

  const supabase = await createClient();

  // ==========================================
  // 1. AMBIL DATA DATABASE
  // ==========================================

  const [
    profilesResult,
    rolesResult,
    enrollmentsResult,
    coursesResult,
  ] = await Promise.all([
    // Data profil member.
    supabase
      .from("profiles")
      .select(
        "id, full_name, phone, whatsapp_number, address, acquisition_source, registration_reason, avatar_url, created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(500),

    // Data role pengguna.
    supabase
      .from("user_roles")
      .select("user_id, role")
      .limit(500),

    // Data kepemilikan akses kelas.
    supabase
      .from("enrollments")
      .select(
        "id, user_id, course_id, status, source, granted_at, revoked_at, created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(2000),

    // Data pilihan kelas.
    supabase
      .from("courses")
      .select(
        "id, title, slug, status, price"
      )
      .order("title", {
        ascending: true,
      })
      .limit(500),
  ]);

  // ==========================================
  // 2. GABUNGKAN DATA ROLE DAN MEMBER
  // ==========================================

  const roleMap = new Map<string, string[]>();

  for (const item of rolesResult.data ?? []) {
    const current = roleMap.get(item.user_id) ?? [];
    if (!current.includes(item.role)) current.push(item.role);
    roleMap.set(item.user_id, current);
  }

  const members: MemberRow[] = (profilesResult.data ?? []).map((profile) => {
    const roles = roleMap.get(profile.id) ?? ["member"];
    const primaryRole = roles.includes("admin")
      ? "admin"
      : roles.includes("instructor")
        ? "instructor"
        : "member";

    return {
      ...profile,
      role: primaryRole,
      roles,
    };
  });

  // ==========================================
  // 3. PENANGANAN ERROR DATABASE
  // ==========================================

  const errors = [
    profilesResult.error?.message,
    rolesResult.error?.message,
    enrollmentsResult.error?.message,
    coursesResult.error?.message,
  ].filter(
    (message): message is string => Boolean(message)
  );

  const initialError = errors.length
    ? errors.join(" | ")
    : null;

  // ==========================================
  // 4. TAMPILKAN PENGELOLAAN PENGGUNA
  // ==========================================

  return (
    <PenggunaManager
      initialMembers={members}
      initialEnrollments={
        (enrollmentsResult.data ?? []) as EnrollmentRow[]
      }
      courses={
        (coursesResult.data ?? []) as CourseOption[]
      }
      initialError={initialError}
    />
  );
}