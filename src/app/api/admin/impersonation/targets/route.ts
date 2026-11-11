import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  decryptImpersonationPayload,
  IMPERSONATION_ALLOWED_EMAILS,
  IMPERSONATION_COOKIE_NAME,
} from "@/lib/auth/impersonation";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

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

const FALLBACK_TARGET_NAMES: Record<string, string> = {
  "kawah.rds@gmail.com": "Rania Shakila Anara",
  "kikicreator1@gmail.com": "kikicreator",
};

export async function GET() {
  const cookieStore = await cookies();
  const encryptedPayload = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  let payload = encryptedPayload
    ? decryptImpersonationPayload(encryptedPayload)
    : null;

  if (encryptedPayload && !payload) {
    cookieStore.delete(IMPERSONATION_COOKIE_NAME);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ success: false, message: "Sesi akun tidak ditemukan." }, 401);
    }

    // Cookie hanya dianggap aktif jika sesi Supabase saat ini benar-benar
    // merupakan akun target yang tersimpan di dalam cookie terenkripsi.
    let isImpersonating = false;
    let adminUserId = user.id;

    if (payload) {
      if (user.id === payload.targetUserId) {
        const { data: activeTargetResult, error: activeTargetError } =
          await createServiceRoleClient().auth.admin.getUserById(user.id);

        const activeTargetEmail =
          activeTargetResult?.user?.email?.toLowerCase() ?? "";

        if (
          activeTargetError ||
          !activeTargetEmail ||
          !IMPERSONATION_ALLOWED_EMAILS.has(activeTargetEmail) ||
          activeTargetEmail !== payload.targetEmail.toLowerCase()
        ) {
          return json({
            success: false,
            message: "Akun pengujian yang sedang aktif tidak valid.",
          }, 403);
        }

        isImpersonating = true;
        adminUserId = payload.adminUserId;
      } else if (user.id === payload.adminUserId) {
        // Sesi Admin sudah pulih; bersihkan cookie lama yang mungkin tertinggal.
        cookieStore.delete(IMPERSONATION_COOKIE_NAME);
        payload = null;
      } else {
        return json({
          success: false,
          message: "Sesi akun pengujian tidak cocok.",
        }, 403);
      }
    }

    const service = createServiceRoleClient();

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
        message: "Fitur ini hanya tersedia untuk Administrator dan akun pengujian yang diizinkan.",
      }, 403);
    }

    const authUsers = [];

    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        console.error("Impersonation target lookup failed:", error.message);
        return json({ success: false, message: "Gagal memuat akun pengujian." }, 500);
      }

      authUsers.push(...data.users);
      if (data.users.length < 1000) break;
    }

    const allowedUsers = authUsers.filter((item) =>
      item.email
        ? IMPERSONATION_ALLOWED_EMAILS.has(item.email.toLowerCase())
        : false,
    );

    if (allowedUsers.length === 0) {
      return json({
        success: true,
        targets: [],
        isImpersonating,
        currentTargetUserId: isImpersonating ? user.id : null,
        message: "Akun pengujian yang diizinkan belum ditemukan.",
      });
    }

    const userIds = allowedUsers.map((item) => item.id);

    const { data: roleRows, error: rolesError } = await service
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    if (rolesError) {
      console.error("Impersonation target role lookup failed:", rolesError.message);
      return json({
        success: false,
        message: "Gagal membaca role akun pengujian.",
        detail: rolesError.message,
      }, 500);
    }

    const { data: profileRows, error: profilesError } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      console.warn(
        "Impersonation profile lookup skipped; using fallback names:",
        profilesError.message,
      );
    }

    const targets = allowedUsers.flatMap((targetUser) => {
      const targetEmail = (targetUser.email ?? "").toLowerCase();
      const targetRoles = normalizeRoles(
        (roleRows ?? [])
          .filter((row) => row.user_id === targetUser.id)
          .map((row) => ({ role: row.role })),
      );
      const primaryRole = getPrimaryRole(targetRoles);

      if (primaryRole !== "instructor" && primaryRole !== "member") {
        return [];
      }

      const profile = (profileRows ?? []).find(
        (row) => row.id === targetUser.id,
      );
      const metadataName =
        typeof targetUser.user_metadata?.full_name === "string"
          ? targetUser.user_metadata.full_name.trim()
          : "";

      return [{
        userId: targetUser.id,
        name:
          profile?.full_name?.trim() ||
          metadataName ||
          FALLBACK_TARGET_NAMES[targetEmail] ||
          targetUser.email ||
          "Pengguna",
        email: targetUser.email ?? "",
        role: primaryRole,
      }];
    });

    targets.sort((a, b) => {
      if (a.role !== b.role) return a.role === "instructor" ? -1 : 1;
      return a.name.localeCompare(b.name, "id");
    });

    return json({
      success: true,
      targets,
      isImpersonating,
      currentUserId: user.id,
      currentTargetUserId: isImpersonating ? user.id : null,
    });
  } catch (error) {
    console.error("Impersonation targets endpoint failed:", error);
    return json({
      success: false,
      message: "Terjadi kesalahan saat memuat akun pengujian.",
    }, 500);
  }
}
