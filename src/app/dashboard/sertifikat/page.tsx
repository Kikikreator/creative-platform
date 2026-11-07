import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateList, { type MemberCertificate } from "./certificate-list";

export default async function MemberCertificatesPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?redirect=${encodeURIComponent("/dashboard/sertifikat")}`);
  const { data, error } = await (supabase as any)
    .from("course_certificates")
    .select("id, certificate_number, full_name_snapshot, course_title_snapshot, mentor_name_snapshot, issued_at, revoked_at")
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });
  return <CertificateList certificates={(data ?? []) as MemberCertificate[]} initialError={error?.message ?? null}/>;
}
