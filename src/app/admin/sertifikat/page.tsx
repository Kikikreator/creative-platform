import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import CertificateSettingsManager, {
  type CertificateCourse,
  type CertificateTask,
  type CertificateSetting,
} from "./certificate-settings-manager";

export default async function AdminCertificateSettingsPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !hasRole(normalizeRoles(roleRows), "admin")) redirect("/admin");

  const db = supabase as any;
  const [courseResult, taskResult, settingResult, certificateResult] = await Promise.all([
    db.from("courses").select("id, title, slug, status").order("title", { ascending: true }),
    db.from("course_tasks").select("id, course_id, title, status, is_required, max_score").order("created_at", { ascending: false }),
    db.from("course_certificate_settings").select("course_id, enabled, passing_score, final_task_id, issuer_name, issuer_title, signature_name, updated_at, template_path, template_mime_type, template_width, template_height, name_box_x, name_box_y, name_box_width, name_box_height, name_font_min_size, name_font_max_size, name_font_color, name_font_bold, name_font_family, name_text_align"),
    db.from("course_certificates").select("id, course_id, issued_at, revoked_at"),
  ]);

  const errors = [courseResult.error?.message, taskResult.error?.message, settingResult.error?.message, certificateResult.error?.message].filter(Boolean);
  return (
    <CertificateSettingsManager
      courses={(courseResult.data ?? []) as CertificateCourse[]}
      tasks={(taskResult.data ?? []) as CertificateTask[]}
      settings={(settingResult.data ?? []) as CertificateSetting[]}
      issuedCertificates={(certificateResult.data ?? []) as Array<{ id: string; course_id: string; issued_at: string; revoked_at: string | null }>}
      initialError={errors.length ? errors.join(" · ") : null}
    />
  );
}
