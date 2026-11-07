import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MentorCertificateManager, { type MentorCertificateCandidate } from "./mentor-certificate-manager";

export default async function MentorCertificateApprovalsPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?redirect=${encodeURIComponent("/mentor/sertifikat")}`);

  const { data, error } = await (supabase as any).rpc("get_mentor_certificate_candidates");
  return (
    <MentorCertificateManager
      initialItems={(data ?? []) as MentorCertificateCandidate[]}
      initialError={error?.message ?? null}
    />
  );
}
