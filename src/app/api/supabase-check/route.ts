import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { success: false, message: "Login administrator diperlukan." },
        401,
      );
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      return jsonResponse(
        { success: false, message: "Hak akses akun belum dapat diverifikasi." },
        503,
      );
    }

    if (getPrimaryRole(normalizeRoles(roleRows)) !== "admin") {
      return jsonResponse(
        { success: false, message: "Kamu tidak memiliki akses ke pemeriksaan sistem." },
        403,
      );
    }

    const { data, error } = await supabase
      .from("courses")
      .select("id")
      .limit(1);

    if (error) {
      // Jangan bocorkan detail internal database kepada pemanggil endpoint.
      return jsonResponse(
        {
          success: false,
          message: "Pemeriksaan koneksi database gagal. Periksa log server untuk detailnya.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Supabase berhasil terhubung!",
      coursesFound: data?.length ?? 0,
    });
  } catch {
    return jsonResponse(
      {
        success: false,
        message: "Terjadi kesalahan saat memeriksa koneksi sistem.",
      },
      500,
    );
  }
}
