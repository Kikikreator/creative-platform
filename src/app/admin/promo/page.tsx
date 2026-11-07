import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import PromoManager, {
  type PromoCodeRow,
  type PromoCourseOption,
  type PromoRedemptionRow,
} from "./promo-manager";

type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

export default async function AdminPromoPage() {
  await connection();

  const supabase = await createClient();

  // Data promo dibaca melalui RPC SECURITY DEFINER.
  // Tabel promo tidak dibuka untuk SELECT langsung dari browser.
  // Supabase RPC menggunakan konteks instance client (`this.rest`).
  // Bind wajib dipertahankan agar pemanggilan RPC tidak kehilangan `this`.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, unknown>
  ) => Promise<RpcResponse>;

  const [promoResult, redemptionResult, coursesResult] = await Promise.all([
    rpc("admin_list_promo_codes", {}),
    rpc("admin_list_promo_redemptions", { p_limit: 200 }),
    supabase
      .from("courses")
      .select("id, title, status")
      .order("title", { ascending: true }),
  ]);

  const errors = [
    promoResult.error?.message,
    redemptionResult.error?.message,
    coursesResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <PromoManager
      initialPromos={
        Array.isArray(promoResult.data)
          ? (promoResult.data as PromoCodeRow[])
          : []
      }
      initialRedemptions={
        Array.isArray(redemptionResult.data)
          ? (redemptionResult.data as PromoRedemptionRow[])
          : []
      }
      initialCourses={
        Array.isArray(coursesResult.data)
          ? (coursesResult.data as PromoCourseOption[])
          : []
      }
      initialError={errors.join(" | ") || null}
    />
  );
}
