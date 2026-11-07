
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/admin-shell";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

type AdminLayoutProps = {
  children: ReactNode;
};

type AdminContentProps = {
  children: ReactNode;
};

function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4">
      <div className="flex w-full max-w-sm items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-violet-100" />

        <div className="flex-1">
          <div className="h-3 w-36 animate-pulse rounded-full bg-violet-100" />
          <div className="mt-2 h-2.5 w-24 animate-pulse rounded-full bg-violet-50" />
        </div>

        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-100 border-t-violet-700" />
      </div>
    </div>
  );
}

async function AdminContent({ children }: AdminContentProps) {
  // Tunggu request pengguna sebelum membaca data dinamis.
  await connection();

  const supabase = await createClient();

  // Periksa autentikasi.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Periksa role dan profil administrator.
  const [
    { data: roleRows, error: roleError },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (roleError) {
    throw new Error(`Gagal memeriksa hak akses Admin: ${roleError.message}`);
  }

  const roles = normalizeRoles(roleRows);
  const primaryRole = getPrimaryRole(roles);

  if (primaryRole !== "admin") {
    if (primaryRole === "instructor") redirect("/mentor");
    if (primaryRole === "member") redirect("/dashboard");
    redirect("/login?reason=role-unassigned");
  }

  const displayName =
    profileData?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Administrator";

  return (
    <AdminShell
      user={{
        name: displayName,
        email: user.email ?? "",
      }}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminContent>{children}</AdminContent>
    </Suspense>
  );
}
