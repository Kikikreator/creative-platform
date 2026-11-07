"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";

export type PromoCodeInput = {
  id?: string | null;
  code: string;
  description: string;
  appliesToAll: boolean;
  courseId: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchase: number;
  maxDiscount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
};

export type PromoActionResult = {
  success: boolean;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

async function callAdminPromoRpc(
  functionName: string,
  args: Record<string, unknown>
): Promise<PromoActionResult> {
  const supabase = await createClient();

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

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = normalizeRoles(roleRows);

  if (roleError || !hasRole(roles, "admin")) {
    return {
      success: false,
      message: "Kamu tidak memiliki izin mengelola promo.",
    };
  }

  // RPC baru ditambahkan melalui migration. Cast ini menjaga kompatibilitas
  // dengan tipe Database lama yang belum mengenali nama RPC tersebut.
  // Pertahankan konteks Supabase client saat memanggil RPC.
  // Tanpa bind, `this.rest` di dalam supabase.rpc menjadi undefined.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, unknown>
  ) => Promise<RpcResponse>;

  const { error } = await rpc(functionName, args);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/admin/promo");
  revalidatePath("/checkout");

  return {
    success: true,
    message: "Perubahan promo berhasil disimpan.",
  };
}

function validateInput(input: PromoCodeInput): string | null {
  const code = input.code.trim().toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) {
    return "Kode promo harus 2–40 karakter, hanya huruf, angka, tanda hubung, atau garis bawah.";
  }

  if (
    input.discountType !== "percentage" &&
    input.discountType !== "fixed"
  ) {
    return "Jenis diskon tidak valid.";
  }

  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    return "Nilai diskon harus lebih besar dari nol.";
  }

  if (
    input.discountType === "percentage" &&
    input.discountValue >= 100
  ) {
    return "Diskon persentase harus kurang dari 100%.";
  }

  if (typeof input.appliesToAll !== "boolean") {
    return "Pilihan cakupan promo tidak valid.";
  }

  if (!input.appliesToAll && !input.courseId) {
    return "Pilih kelas yang akan menerima promo ini.";
  }

  if (input.appliesToAll && input.courseId) {
    return "Pilihan Semua Kelas tidak boleh memiliki kelas tertentu.";
  }

  if (!Number.isFinite(input.minPurchase) || input.minPurchase < 0) {
    return "Minimum pembelian tidak valid.";
  }

  if (
    input.maxDiscount !== null &&
    (!Number.isFinite(input.maxDiscount) || input.maxDiscount <= 0)
  ) {
    return "Maksimum potongan harus lebih besar dari nol.";
  }

  if (
    input.maxUses !== null &&
    (!Number.isInteger(input.maxUses) || input.maxUses <= 0)
  ) {
    return "Kuota total harus berupa bilangan bulat lebih besar dari nol.";
  }

  if (
    input.maxUsesPerUser !== null &&
    (!Number.isInteger(input.maxUsesPerUser) || input.maxUsesPerUser <= 0)
  ) {
    return "Batas penggunaan per member harus berupa bilangan bulat lebih besar dari nol.";
  }

  const startsAt = new Date(input.startsAt);

  if (!input.startsAt || Number.isNaN(startsAt.getTime())) {
    return "Tanggal mulai promo wajib diisi.";
  }

  if (input.expiresAt) {
    const expiresAt = new Date(input.expiresAt);

    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= startsAt.getTime()
    ) {
      return "Tanggal berakhir harus setelah tanggal mulai.";
    }
  }

  return null;
}

export async function savePromoCode(
  input: PromoCodeInput
): Promise<PromoActionResult> {
  const validationError = validateInput(input);

  if (validationError) {
    return { success: false, message: validationError };
  }

  const commonArgs = {
    p_code: input.code.trim().toUpperCase(),
    p_description: input.description.trim() || null,
    p_discount_type: input.discountType,
    p_discount_value: input.discountValue,
    p_min_purchase: Math.floor(input.minPurchase),
    p_max_discount:
      input.maxDiscount === null
        ? null
        : Math.floor(input.maxDiscount),
    p_max_uses: input.maxUses,
    p_max_uses_per_user: input.maxUsesPerUser,
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_expires_at: input.expiresAt
      ? new Date(input.expiresAt).toISOString()
      : null,
    p_is_active: input.isActive,
    p_applies_to_all: input.appliesToAll,
    p_course_id: input.appliesToAll ? null : input.courseId,
  };

  if (input.id) {
    return callAdminPromoRpc("admin_update_promo_code", {
      p_promo_code_id: input.id,
      ...commonArgs,
    });
  }

  return callAdminPromoRpc("admin_create_promo_code", commonArgs);
}

export async function setPromoCodeStatus(
  promoCodeId: string,
  isActive: boolean
): Promise<PromoActionResult> {
  if (!promoCodeId) {
    return { success: false, message: "ID promo tidak valid." };
  }

  return callAdminPromoRpc("admin_set_promo_status", {
    p_promo_code_id: promoCodeId,
    p_is_active: isActive,
  });
}

export async function deletePromoCode(
  promoCodeId: string
): Promise<PromoActionResult> {
  if (!promoCodeId) {
    return { success: false, message: "ID promo tidak valid." };
  }

  return callAdminPromoRpc("admin_delete_promo_code", {
    p_promo_code_id: promoCodeId,
  });
}
