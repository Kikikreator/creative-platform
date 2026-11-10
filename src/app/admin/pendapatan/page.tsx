import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import RevenueDashboard, {
  type RevenueOrder,
  type RevenueProfile,
  type RevenueEarning,
  type RevenueWithdrawal,
  type RevenueCourse,
} from "@/components/admin/revenue-dashboard";

export default async function AdminRevenuePage() {
  await connection();
  const supabase = await createClient();

  const [ordersResult, profilesResult, earningsResult, withdrawalsResult, coursesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, invoice_number, status, total, currency, created_at")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("profiles")
      .select("id, full_name")
      .limit(5000),
    supabase
      .from("mentor_course_earnings")
      .select("id, order_id, order_item_id, course_id, mentor_user_id, member_user_id, currency, basis_amount, mentor_amount, platform_amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("mentor_withdrawal_requests")
      .select("id, mentor_user_id, full_name_snapshot, bank_name, account_number, amount, currency, status, admin_note, requested_at, reviewed_at, paid_at")
      .order("requested_at", { ascending: false })
      .limit(2000),
    supabase
      .from("courses")
      .select("id, title")
      .limit(2000),
  ]);

  const errors = [
    ordersResult.error?.message,
    profilesResult.error?.message,
    earningsResult.error?.message,
    withdrawalsResult.error?.message,
    coursesResult.error?.message,
  ].filter(Boolean).join(" · ") || null;

  return (
    <RevenueDashboard
      orders={(ordersResult.data ?? []) as RevenueOrder[]}
      profiles={(profilesResult.data ?? []) as RevenueProfile[]}
      earnings={(earningsResult.data ?? []) as RevenueEarning[]}
      withdrawals={(withdrawalsResult.data ?? []) as RevenueWithdrawal[]}
      courses={(coursesResult.data ?? []) as RevenueCourse[]}
      error={errors}
    />
  );
}
