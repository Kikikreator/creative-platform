import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";
import AlumniRequestForm, { type AlumniCourseOption } from "./alumni-request-form";

export const metadata: Metadata = {
  title: "Akses Alumni | Kiki Creator Class",
  description:
    "Ajukan aktivasi akses kelas bagi peserta lama Kiki Creator Class.",
};

export default async function AlumniAccessPage() {
  await connection();
  const supabase = await createClient();

  const [coursesResult, userResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug")
      .eq("status", "published")
      .order("title", { ascending: true })
      .limit(200),
    supabase.auth.getUser(),
  ]);

  const user = userResult.data.user;
  let initialName = "";
  let canClaim = false;
  let roleCheckError = false;
  let accountRole: string | null = null;

  if (user) {
    const [profileResult, rolesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
    ]);

    initialName = profileResult.data?.full_name?.trim() ?? "";
    roleCheckError = Boolean(rolesResult.error);
    accountRole = rolesResult.error
      ? null
      : getPrimaryRole(normalizeRoles(rolesResult.data));
    canClaim = !rolesResult.error && accountRole === "member";
  }

  const courses = (coursesResult.data ?? []) as AlumniCourseOption[];

  return (
    <main className="min-h-screen bg-[#F8F7FA] px-4 py-8 text-[#21182A] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <AlumniRequestForm
          courses={courses}
          courseLoadError={coursesResult.error?.message ?? null}
          initialName={initialName}
          initialEmail={user?.email ?? ""}
          isSignedIn={Boolean(user)}
          canClaim={canClaim}
          roleCheckError={roleCheckError}
          accountRole={accountRole}
          adminWhatsapp={process.env.NEXT_PUBLIC_ALUMNI_ADMIN_WHATSAPP ?? ""}
        />
      </div>
    </main>
  );
}
