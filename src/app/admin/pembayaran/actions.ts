
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";

type ReviewPaymentInput = {
  paymentId: string;
  decision: "approve" | "reject";
  reason?: string;
};

type ReviewPaymentResult = {
  success: boolean;
  message: string;
};

type AdminReviewRpcRow = {
  result_payment_id: string;
  result_order_id: string;
  result_status: string;
};

export async function reviewPayment(
  input: ReviewPaymentInput
): Promise<ReviewPaymentResult> {
  const paymentId = input.paymentId?.trim();
  const decision = input.decision;
  const reason = input.reason?.trim() ?? "";

  if (!paymentId) {
    return {
      success: false,
      message: "ID pembayaran tidak valid.",
    };
  }

  if (
    decision !== "approve" &&
    decision !== "reject"
  ) {
    return {
      success: false,
      message: "Keputusan pembayaran tidak valid.",
    };
  }

  if (decision === "reject" && !reason) {
    return {
      success: false,
      message: "Alasan penolakan wajib diisi.",
    };
  }

  const supabase = await createClient();

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: "Sesi berakhir. Silakan login kembali.",
    };
  }

  // ==========================================
  // ADMIN AUTHORIZATION
  // ==========================================

  const { data: roleRows, error: roleError } =
    await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

  const roles = normalizeRoles(roleRows);

  if (roleError || !hasRole(roles, "admin")) {
    return {
      success: false,
      message:
        "Kamu tidak memiliki izin melakukan tindakan ini.",
    };
  }

  // ==========================================
  // REVIEW PAYMENT VIA DATABASE RPC
  // ==========================================

  const rpcDecision: "approved" | "rejected" =
    decision === "approve" ? "approved" : "rejected";

  const rpcArgs = {
    p_payment_id: paymentId,
    p_decision: rpcDecision,
    ...(decision === "reject"
      ? { p_rejection_reason: reason }
      : {}),
  };

  const { data, error: reviewError } =
    await supabase.rpc(
      "admin_review_course_payment",
      rpcArgs
    );

  if (reviewError) {
    return {
      success: false,
      message: reviewError.message,
    };
  }

  // ==========================================
  // VALIDATE RPC RESULT
  // ==========================================

  const result = (
    Array.isArray(data) ? data[0] : data
  ) as AdminReviewRpcRow | null;

  if (!result) {
    return {
      success: false,
      message:
        "Database tidak mengembalikan hasil verifikasi. Periksa status pembayaran sebelum mencoba kembali.",
    };
  }

  if (
    result.result_payment_id?.toLowerCase() !==
      paymentId.toLowerCase() ||
    result.result_status !== rpcDecision
  ) {
    return {
      success: false,
      message:
        "Hasil verifikasi tidak sesuai dengan keputusan admin. Silakan periksa status pembayaran.",
    };
  }

  // ==========================================
  // REVALIDATE APPLICATION PAGES
  // ==========================================

  revalidatePath("/admin/pembayaran");
  revalidatePath("/admin/transaksi");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/kelas");

  // ==========================================
  // SUCCESS RESPONSE
  // ==========================================

  return {
    success: true,
    message:
      decision === "approve"
        ? "Pembayaran berhasil disetujui dan akses kelas telah diaktifkan."
        : "Pembayaran berhasil ditolak.",
  };
}
