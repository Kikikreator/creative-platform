import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AlumniAccessManager, {
  type AlumniAccessRequestRow,
  type AlumniAdminCourseOption,
} from "./alumni-access-manager";

export default async function AdminAlumniAccessPage() {
  await connection();
  const supabase = await createClient();

  const [requestsResult, coursesResult] = await Promise.all([
    supabase
      .from("alumni_access_requests")
      .select(
        "id, full_name, email, whatsapp_number, course_id, previous_platform, proof_note, evidence_path, status, admin_note, reviewed_by, reviewed_at, expires_at, claimed_by, claimed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("courses")
      .select("id, title, slug, status")
      .order("title", { ascending: true })
      .limit(500),
  ]);

  const errors = [
    requestsResult.error?.message,
    coursesResult.error?.message,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="app-page-heading">
        
      </div>

      <AlumniAccessManager
        initialRequests={(requestsResult.data ?? []) as AlumniAccessRequestRow[]}
        courses={(coursesResult.data ?? []) as AlumniAdminCourseOption[]}
        initialError={errors.length ? errors.join(" | ") : null}
      />
    </div>
  );
}
