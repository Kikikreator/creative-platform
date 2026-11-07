import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import RevenueDashboard, {
  type RevenueOrder,
  type RevenueProfile,
} from "@/components/admin/revenue-dashboard";

export default async function AdminRevenuePage() {
  await connection();
  const supabase = await createClient();

  const [ordersResult, profilesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, invoice_number, status, total, currency, created_at")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("profiles")
      .select("id, full_name")
      .limit(2000),
  ]);

  const errors = [ordersResult.error?.message, profilesResult.error?.message]
    .filter(Boolean)
    .join(" · ") || null;

  return (
    <RevenueDashboard
      orders={(ordersResult.data ?? []) as RevenueOrder[]}
      profiles={(profilesResult.data ?? []) as RevenueProfile[]}
      error={errors}
    />
  );
}
