import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import KelasManager, { type Course } from "./kelas-manager";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";

function LoadingKelas() {
  return (
    <div className="rounded-[22px] bg-white p-6 shadow-[0_10px_30px_rgba(38,27,72,.055)]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-violet-100" />
        <div className="flex-1"><div className="h-3 w-36 animate-pulse rounded-full bg-violet-100" /><div className="mt-2 h-2.5 w-56 animate-pulse rounded-full bg-slate-100" /></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="h-24 animate-pulse rounded-2xl bg-[#faf9fe]"/><div className="h-24 animate-pulse rounded-2xl bg-[#faf9fe]"/><div className="h-24 animate-pulse rounded-2xl bg-[#faf9fe]"/></div>
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[#faf9fe]" />
    </div>
  );
}

export default function AdminKelasPage() {
  return (
    <Suspense fallback={<LoadingKelas />}>
      <AdminKelasContent />
    </Suspense>
  );
}

async function AdminKelasContent() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const {
    data: roleRows,
    error: roleError,
  } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = normalizeRoles(roleRows);

  if (roleError || !hasRole(roles, "admin")) {
    redirect("/");
  }

  const {
    data: courses,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select(
      "id, title, slug, description, short_description, cover_image_url, category, target_audience, benefits, mentor_name, mentor_bio, price, status, access_type, created_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  return (
    <KelasManager
      initialCourses={(courses ?? []) as Course[]}
      userId={user.id}
      initialError={coursesError?.message ?? null}
    />
  );
}
