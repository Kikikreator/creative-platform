import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  decryptImpersonationPayload,
  encryptImpersonationPayload,
  IMPERSONATION_ALLOWED_EMAILS,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MAX_AGE_SECONDS,
  type ImpersonationPayload,
} from "@/lib/auth/impersonation";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function dashboardForRole(role: "instructor" | "member") {
  return role === "instructor" ? "/mentor" : "/dashboard";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json({ success: false, message: "Permintaan tidak diizinkan." }, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    targetUserId?: string;
  } | null;

  const targetUserId = String(body?.targetUserId ?? "").trim();

  if (!UUID_PATTERN.test(targetUserId)) {
    return json({ success: false, message: "Akun tujuan tidak valid." }, 400);
  }

  const cookieStore = await cookies();
  const encryptedPayload = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  let existingPayload: ImpersonationPayload | null = encryptedPayload
    ? decryptImpersonationPayload(encryptedPayload)
    : null;

  if (encryptedPayload && !existingPayload) {
    cookieStore.delete(IMPERSONATION_COOKIE_NAME);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return json({ success: false, message: "Silakan login terlebih dahulu." }, 401);
    }

    // Jika mode pengujian sudah aktif, hanya akun target yang sedang dibuka
    // yang boleh meminta perpindahan ke target lain.
    if (existingPayload && currentUser.id !== existingPayload.targetUserId) {
      if (currentUser.id === existingPayload.adminUserId) {
        // Cookie lama yang tertinggal setelah sesi Admin pulih.
        cookieStore.delete(IMPERSONATION_COOKIE_NAME);
        existingPayload = null;
      } else {
        return json({
          success: false,
          message: "Sesi akun pengujian tidak cocok. Kembali ke Administrator dan coba lagi.",
        }, 403);
      }
    }

    const service = createServiceRoleClient();

    let adminUserId = currentUser.id;
    let adminEmail = currentUser.email ?? "";
    let adminAccessToken = "";
    let adminRefreshToken = "";
    let expiresAt = Date.now() + IMPERSONATION_MAX_AGE_SECONDS * 1000;

    if (existingPayload) {
      // Pertahankan sesi Admin pertama saat berpindah Mentor <-> Peserta.
      adminUserId = existingPayload.adminUserId;
      adminEmail = existingPayload.adminEmail;
      adminAccessToken = existingPayload.adminAccessToken;
      adminRefreshToken = existingPayload.adminRefreshToken;
      expiresAt = existingPayload.expiresAt;

      const { data: activeTargetResult, error: activeTargetError } =
        await service.auth.admin.getUserById(currentUser.id);

      const activeTargetEmail =
        activeTargetResult?.user?.email?.toLowerCase() ?? "";

      if (
        activeTargetError ||
        !activeTargetEmail ||
        !IMPERSONATION_ALLOWED_EMAILS.has(activeTargetEmail) ||
        activeTargetEmail !== existingPayload.targetEmail.toLowerCase()
      ) {
        return json({
          success: false,
          message: "Akun yang sedang diuji tidak lagi termasuk daftar akun pengujian.",
        }, 403);
      }
    } else {
      // Simpan sesi Admin hanya saat pertama kali masuk mode pengujian.
      const {
        data: { session: adminSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !adminSession?.access_token ||
        !adminSession.refresh_token
      ) {
        return json({
          success: false,
          message: "Sesi Administrator tidak dapat disimpan.",
        }, 401);
      }

      adminAccessToken = adminSession.access_token;
      adminRefreshToken = adminSession.refresh_token;
    }

    // Pastikan akun Administrator asli masih aktif dan masih memiliki role admin.
    const { data: adminRoleRows, error: adminRoleError } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUserId);

    if (adminRoleError) {
      console.error("Impersonation admin-role check failed:", adminRoleError.message);
      return json({
        success: false,
        message: "Gagal memeriksa hak akses Administrator.",
      }, 500);
    }

    if (!normalizeRoles(adminRoleRows).includes("admin")) {
      return json({
        success: false,
        message: "Akun Administrator asli tidak lagi memiliki hak akses.",
      }, 403);
    }

    const { data: adminAccountResult, error: adminAccountError } =
      await service.auth.admin.getUserById(adminUserId);

    if (adminAccountError || !adminAccountResult?.user) {
      return json({
        success: false,
        message: "Akun Administrator asli tidak ditemukan.",
      }, 401);
    }

    // Ambil akun tujuan.
    const { data: targetResult, error: targetError } =
      await service.auth.admin.getUserById(targetUserId);

    const targetUser = targetResult?.user;

    if (targetError || !targetUser?.email) {
      return json({ success: false, message: "Akun pengujian tidak ditemukan." }, 404);
    }

    const targetEmail = targetUser.email.toLowerCase();

    if (!IMPERSONATION_ALLOWED_EMAILS.has(targetEmail)) {
      return json({
        success: false,
        message: "Akun ini tidak termasuk daftar akun pengujian yang diizinkan.",
      }, 403);
    }

    const { data: targetRoleRows, error: targetRoleError } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUser.id);

    if (targetRoleError) {
      console.error("Target role lookup failed:", targetRoleError.message);
      return json({
        success: false,
        message: "Gagal memeriksa role akun tujuan.",
        detail: targetRoleError.message,
      }, 500);
    }

    const targetRole = getPrimaryRole(normalizeRoles(targetRoleRows));

    if (targetRole !== "instructor" && targetRole !== "member") {
      return json({
        success: false,
        message: "Akun tujuan harus memiliki role Mentor atau Peserta.",
        detail: `Role ditemukan: ${targetRole ?? "tidak ada"}`,
      }, 403);
    }

    if (existingPayload && targetUser.id === currentUser.id) {
      return json({
        success: true,
        redirectTo: dashboardForRole(targetRole),
        targetName: existingPayload.targetName,
        targetRole,
      });
    }

    const { data: targetProfile, error: targetProfileError } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (targetProfileError) {
      console.warn("Target profile lookup warning:", targetProfileError.message);
    }

    const targetName =
      targetProfile?.full_name?.trim() ||
      (typeof targetUser.user_metadata?.full_name === "string"
        ? targetUser.user_metadata.full_name.trim()
        : "") ||
      targetEmail;

    // Buat magic-link internal. Email tidak dikirim; token langsung ditukar
    // menjadi sesi asli akun tujuan pada request server ini.
    const { data: linkData, error: linkError } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
      });

    const tokenHash = linkData?.properties?.hashed_token;

    if (linkError || !tokenHash) {
      console.error("Impersonation magic-link generation failed:", linkError?.message);
      return json({
        success: false,
        message: "Supabase gagal menyiapkan sesi akun pengujian.",
      }, 500);
    }

    const targetSupabase = await createClient();
    const { data: verified, error: verifyError } =
      await targetSupabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });

    if (verifyError || verified.user?.id !== targetUser.id) {
      console.error("Impersonation session exchange failed:", verifyError?.message);
      // Jangan hapus cookie lama jika perpindahan antar-target gagal.
      return json({
        success: false,
        message: "Gagal membuka sesi akun pengujian. Sesi sebelumnya tetap digunakan.",
      }, 500);
    }

    const nextPayload: ImpersonationPayload = {
      version: 1,
      adminUserId,
      adminEmail,
      adminAccessToken,
      adminRefreshToken,
      targetUserId: targetUser.id,
      targetName,
      targetEmail,
      targetRole,
      expiresAt,
    };

    // Cookie baru dipasang setelah sesi target berhasil dibuat.
    cookieStore.set(
      IMPERSONATION_COOKIE_NAME,
      encryptImpersonationPayload(nextPayload),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(
          60,
          Math.floor((expiresAt - Date.now()) / 1000),
        ),
      },
    );

    return json({
      success: true,
      redirectTo: dashboardForRole(targetRole),
      targetName,
      targetRole,
    });
  } catch (error) {
    console.error("Impersonation start endpoint failed:", error);
    return json({
      success: false,
      message: "Terjadi kesalahan saat memulai mode pengujian.",
    }, 500);
  }
}
