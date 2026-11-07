import { createClient } from "@/lib/supabase/server";
import MentorProfileManager, { type MentorProfileData } from "./profile-manager";

export default async function MentorProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: mentorProfile, error }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("mentor_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <MentorProfileManager
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile?.full_name ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      initialProfile={(mentorProfile ?? null) as MentorProfileData | null}
      initialError={error?.message ?? null}
    />
  );
}
