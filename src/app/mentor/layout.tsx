import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import MentorShell from "@/components/mentor/mentor-shell";

function MentorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4">
      <div className="flex w-full max-w-sm items-center gap-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-violet-100" />
        <div className="flex-1">
          <div className="h-3 w-36 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-2 h-2.5 w-24 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-100 border-t-violet-700" />
      </div>
    </div>
  );
}

async function MentorContent({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/mentor")}`);
  }

  const [{ data: roleRows, error: roleError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (roleError) {
    throw new Error(`Gagal memeriksa hak akses Mentor: ${roleError.message}`);
  }

  if (profileError) {
    throw new Error(`Gagal memuat profil Mentor: ${profileError.message}`);
  }

  const roles = normalizeRoles(roleRows);
  if (hasRole(roles, "admin")) {
    redirect("/admin");
  }

  if (!hasRole(roles, "instructor")) {
    if (hasRole(roles, "member")) redirect("/dashboard");
    redirect("/login?reason=role-unassigned");
  }

  const name =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Mentor";

  return (
    <MentorShell
      user={{
        id: user.id,
        name,
        email: user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      {children}
    </MentorShell>
  );
}

export default function MentorLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<MentorLoading />}>
      <MentorContent>{children}</MentorContent>
    </Suspense>
  );
}
