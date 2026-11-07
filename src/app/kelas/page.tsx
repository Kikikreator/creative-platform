
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles, type AppRole } from "@/lib/auth/roles";
import KelasCatalog, { type Course } from "./kelas-catalog";

export default async function KelasPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: courses,
    error,
  } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      short_description,
      description,
      cover_image_url,
      category,
      target_audience,
      benefits,
      mentor_name,
      mentor_bio,
      price,
      status,
      access_type,
      created_at
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const { data: { user } } = await supabase.auth.getUser();
  let userRole: AppRole | null = null;

  if (user) {
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    // Jika role gagal diverifikasi, jangan menganggap akun sebagai Peserta.
    if (!roleError) {
      userRole = getPrimaryRole(normalizeRoles(roleRows));
    }
  }

  return (
    <KelasCatalog
      courses={(courses ?? []) as Course[]}
      loadError={error?.message ?? null}
      userRole={userRole}
      isAuthenticated={Boolean(user)}
    />
  );
}
