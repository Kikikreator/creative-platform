import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import MentorProfileReview, { type AdminMentorProfile } from "./profile-review-manager";

export default async function AdminMentorProfilePage() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentor_profiles")
    .select("user_id, headline, bio, expertise, education, experience, portfolio_url, photo_url, cv_path, cv_file_name, approval_status, admin_note, submitted_at")
    .eq("approval_status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(200);

  const ids = (data ?? []).map((item) => item.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((item) => [item.id, item.full_name]));
  const items: AdminMentorProfile[] = (data ?? []).map((item) => ({
    ...item,
    full_name: names.get(item.user_id) ?? "Mentor",
  })) as AdminMentorProfile[];

  return <MentorProfileReview items={items} initialError={error?.message ?? null} />;
}
