
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import TransaksiManager, {
  type OrderRow,
  type PaymentRow,
  type OrderItemRow,
  type PaymentMethodRow,
  type ProfileRow,
} from "./transaksi-manager";

export default async function AdminTransaksiPage() {
  await connection();

  const supabase = await createClient();

  const [
    ordersResult,
    paymentsResult,
    itemsResult,
    methodsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, user_id, invoice_number, status, subtotal, discount, total, currency, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000),

    supabase
      .from("payments")
      .select(
        "id, order_id, payment_method_id, amount, proof_path, status, rejection_reason, reviewed_by, reviewed_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000),

    supabase
      .from("order_items")
      .select(
        "id, order_id, course_id, course_title_snapshot, unit_price, quantity, line_total"
      )
      .limit(2000),

    supabase
      .from("payment_methods")
      .select(
        "id, name, bank_name, account_name, account_number, qr_image_path, instructions, is_active, position, created_at"
      )
      .order("position", { ascending: true })
      .limit(200),

    supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, created_at")
      .limit(2000),
  ]);

  const errors = [
    ordersResult.error?.message,
    paymentsResult.error?.message,
    itemsResult.error?.message,
    methodsResult.error?.message,
    profilesResult.error?.message,
  ].filter((message): message is string => Boolean(message));

  return (
    <TransaksiManager
      initialOrders={(ordersResult.data ?? []) as OrderRow[]}
      initialPayments={(paymentsResult.data ?? []) as PaymentRow[]}
      initialOrderItems={(itemsResult.data ?? []) as OrderItemRow[]}
      initialPaymentMethods={
        (methodsResult.data ?? []) as PaymentMethodRow[]
      }
      initialProfiles={(profilesResult.data ?? []) as ProfileRow[]}
      initialError={errors.join(" | ") || null}
    />
  );
}
