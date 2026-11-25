import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";

const MODE_COOKIE = "kcc_mentor_mode";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Sesi login tidak ditemukan. Silakan login kembali." },
      { status: 401 },
    );
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    return NextResponse.json(
      { success: false, message: "Hak akses akun belum dapat diverifikasi." },
      { status: 500 },
    );
  }

  const roles = normalizeRoles(roleRows);
  if (hasRole(roles, "admin") || !hasRole(roles, "instructor")) {
    return NextResponse.json(
      { success: false, message: "Fitur pergantian mode hanya tersedia untuk Mentor." },
      { status: 403 },
    );
  }

  let body: { mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Permintaan pergantian mode tidak valid." },
      { status: 400 },
    );
  }

  if (body.mode !== "mentor" && body.mode !== "member") {
    return NextResponse.json(
      { success: false, message: "Mode yang dipilih tidak dikenal." },
      { status: 400 },
    );
  }

  if (body.mode === "member") {
    const { count, error: assignmentError } = await supabase
      .from("course_task_mentors")
      .select("course_id", { count: "exact", head: true })
      .eq("mentor_user_id", user.id);

    if (assignmentError) {
      return NextResponse.json(
        { success: false, message: "Penugasan kelas belum dapat diperiksa." },
        { status: 500 },
      );
    }

    if (!count) {
      return NextResponse.json(
        { success: false, message: "Kamu belum memiliki kelas yang ditugaskan untuk ditinjau." },
        { status: 409 },
      );
    }
  }

  const response = NextResponse.json({
    success: true,
    redirectTo: body.mode === "member" ? "/mentor/member" : "/mentor",
  });

  if (body.mode === "member") {
    response.cookies.set(MODE_COOKIE, "member", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  } else {
    response.cookies.set(MODE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}
