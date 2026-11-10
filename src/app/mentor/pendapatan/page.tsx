import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import MentorEarningsDashboard, {
  type MentorEarningRow,
  type MentorAgreementRow,
  type MentorWithdrawalRow,
  type MentorCourseLabel,
} from "./mentor-earnings-dashboard";

export default async function MentorEarningsPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [
    earningsResult,
    agreementsResult,
    withdrawalsResult,
    profileResult,
    mentorProfileResult,
  ] = await Promise.all([
    supabase
      .from("mentor_course_earnings")
      .select("id, order_id, order_item_id, course_id, mentor_user_id, member_user_id, currency, basis_amount, mentor_amount, platform_amount, status, created_at")
      .eq("mentor_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("course_mentor_revenue_agreements")
      .select("id, course_id, mentor_user_id, mentor_share_percent, platform_percent, is_active, agreed_at")
      .eq("mentor_user_id", user.id)
      .order("agreed_at", { ascending: false }),
    supabase
      .from("mentor_withdrawal_requests")
      .select("id, mentor_user_id, full_name_snapshot, bank_name, account_number, amount, currency, status, admin_note, requested_at, reviewed_at, paid_at")
      .eq("mentor_user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("mentor_profiles")
      .select("headline, expertise")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const courseIds = Array.from(new Set([
    ...(earningsResult.data ?? []).map((row) => row.course_id),
    ...(agreementsResult.data ?? []).map((row) => row.course_id),
  ]));
  const memberIds = Array.from(new Set([user.id, ...(earningsResult.data ?? []).map((row) => row.member_user_id)]));
  const [coursesResult, memberProfilesResult] = await Promise.all([
    courseIds.length
      ? supabase.from("courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const memberNameMap = new Map<string, string | null>((memberProfilesResult.data ?? []).map((profile) => [profile.id, profile.full_name] as const));

  const errors = [
    earningsResult.error?.message,
    agreementsResult.error?.message,
    withdrawalsResult.error?.message,
    profileResult.error?.message,
    mentorProfileResult.error?.message,
    coursesResult.error?.message,
    memberProfilesResult.error?.message,
  ].filter(Boolean);

  return (
    <MentorEarningsDashboard
      mentorName={profileResult.data?.full_name ?? ""}
      mentorHeadline={mentorProfileResult.data?.headline ?? null}
      mentorExpertise={mentorProfileResult.data?.expertise ?? []}
      earnings={(earningsResult.data ?? []).map((row) => ({
        ...row,
        participant_name: memberNameMap.get(row.member_user_id) ?? "Peserta",
      })) as MentorEarningRow[]}
      agreements={(agreementsResult.data ?? []) as MentorAgreementRow[]}
      withdrawals={(withdrawalsResult.data ?? []) as MentorWithdrawalRow[]}
      courses={(coursesResult.data ?? []) as MentorCourseLabel[]}
      initialError={errors.join(" · ") || null}
    />
  );
}
