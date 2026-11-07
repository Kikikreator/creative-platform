import { createClient } from "@/lib/supabase/server";

import PembayaranManager, {
  type PaymentRow,
  type OrderRow,
  type OrderItemRow,
  type PaymentMethodRow,
  type ProfileRow,
} from "./pembayaran-manager";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export default async function AdminPembayaranPage() {
  const supabase = await createClient();

  const [
    paymentsResult,
    ordersResult,
    itemsResult,
    methodsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, order_id, payment_method_id, amount, proof_path, status, rejection_reason, reviewed_by, reviewed_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000),

    supabase
      .from("orders")
      .select(
        "id, user_id, invoice_number, status, subtotal, discount, total, currency, created_at, updated_at"
      )
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

  // ERROR DATA
  const errors = [
    paymentsResult.error?.message,
    ordersResult.error?.message,
    itemsResult.error?.message,
    methodsResult.error?.message,
    profilesResult.error?.message,
  ].filter(
    (message): message is string => Boolean(message)
  );

  const rawPayments = (paymentsResult.data ?? []) as PaymentRow[];

  // SIGNED URL UNTUK PRIVATE STORAGE
  const paymentsWithProofUrls = await Promise.all(
    rawPayments.map(async (payment) => {
      if (
        !payment.proof_path ||
        isHttpUrl(payment.proof_path)
      ) {
        return payment;
      }

      const {
        data: signedData,
        error: signedError,
      } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(
          payment.proof_path,
          10 * 60
        );

      if (signedError || !signedData?.signedUrl) {
        return payment;
      }

      // proof_path di sini hanya nilai presentasi untuk komponen client.
      // Nilai di database tetap tidak berubah.

      return {
        ...payment,
        proof_path: signedData.signedUrl,
      };
    })
  );

  return (
    <PembayaranManager
      initialPayments={paymentsWithProofUrls}

      initialOrders={
        (ordersResult.data ?? []) as OrderRow[]
      }

      initialOrderItems={
        (itemsResult.data ?? []) as OrderItemRow[]
      }

      initialPaymentMethods={
        (methodsResult.data ?? []) as PaymentMethodRow[]
      }

      initialProfiles={
        (profilesResult.data ?? []) as ProfileRow[]
      }

      initialError={errors.join(" | ") || null}
    />
  );
}