import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  decryptImpersonationPayload,
  IMPERSONATION_COOKIE_NAME,
} from "@/lib/auth/impersonation";
import { normalizeRoles } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json({ success: false, message: "Permintaan tidak diizinkan." }, 403);
  }

  const cookieStore = await cookies();
  const encryptedPayload = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;

  if (!encryptedPayload) {
    return json({ success: false, message: "Tidak ada sesi Administrator yang tersimpan." }, 404);
  }

  const payload = decryptImpersonationPayload(encryptedPayload);
  if (!payload) {
    cookieStore.delete(IMPERSONATION_COOKIE_NAME);
    return json({ success: false, message: "Sesi pengujian sudah kedaluwarsa atau tidak valid. Silakan login kembali." }, 401);
  }

  try {
    const supabase = await createClient();

    // Restore the original, encrypted administrator session. This also works
    // if the target account was logged out while the test mode was active.
    const { error: restoreError } = await supabase.auth.setSession({
      access_token: payload.adminAccessToken,
      refresh_token: payload.adminRefreshToken,
    });

    if (restoreError) {
      console.error("Administrator session restore failed:", restoreError.message);
      return json({ success: false, message: "Sesi Administrator tidak dapat dipulihkan. Silakan login kembali." }, 401);
    }

    const {
      data: { user: restoredUser },
      error: restoredUserError,
    } = await supabase.auth.getUser();

    if (restoredUserError || !restoredUser || restoredUser.id !== payload.adminUserId) {
      return json({ success: false, message: "Identitas Administrator tidak cocok. Silakan login kembali." }, 401);
    }

    const service = createServiceRoleClient();
    const { data: roleRows, error: roleError } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", restoredUser.id);

    if (roleError) {
      console.error("Restored administrator role check failed:", roleError.message);
      return json({ success: false, message: "Sesi pulih, tetapi role Administrator gagal diverifikasi." }, 500);
    }

    cookieStore.delete(IMPERSONATION_COOKIE_NAME);

    const isStillAdmin = normalizeRoles(roleRows).includes("admin");

    return json({
      success: true,
      redirectTo: isStillAdmin ? "/admin" : "/login?reason=role-unassigned",
      message: isStillAdmin
        ? "Berhasil kembali ke akun Administrator."
        : "Sesi berhasil dipulihkan, tetapi akun ini tidak lagi memiliki role Administrator.",
    });
  } catch (error) {
    console.error("Impersonation stop endpoint failed:", error);
    return json({ success: false, message: "Terjadi kesalahan saat memulihkan sesi Administrator." }, 500);
  }
}
