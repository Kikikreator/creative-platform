import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  destination: string,
) {
  const redirectResponse = NextResponse.redirect(
    new URL(destination, request.url),
  );

  // Preserve refreshed Supabase cookies when redirecting.
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  redirectResponse.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  redirectResponse.headers.set("Pragma", "no-cache");

  return redirectResponse;
}

function workspaceForRole(role: ReturnType<typeof getPrimaryRole>) {
  if (role === "admin") return "/admin";
  if (role === "instructor") return "/mentor";
  if (role === "member") return "/dashboard";
  return "/login?reason=role-unassigned";
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Konfigurasi Supabase belum ditemukan.");
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getClaims memvalidasi sesi tanpa mempercayai cookie mentah.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = /^\/admin(?:\/|$)/.test(pathname);
  const isMentorRoute = /^\/mentor(?:\/|$)/.test(pathname);
  const isDashboardRoute = /^\/dashboard(?:\/|$)/.test(pathname);
  const isCheckoutRoute = /^\/checkout(?:\/|$)/.test(pathname);
  const isLearningRoute = /^\/kelas\/[^/]+\/belajar(?:\/|$)/.test(pathname);

  const requiresAuthentication =
    isAdminRoute ||
    isMentorRoute ||
    isDashboardRoute ||
    isCheckoutRoute ||
    isLearningRoute;

  if (requiresAuthentication && (claimsError || !claimsData?.claims?.sub)) {
    const requestedPath = `${pathname}${request.nextUrl.search}`;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", requestedPath);
    return redirectWithCookies(request, supabaseResponse, loginUrl.pathname + loginUrl.search);
  }

  if (requiresAuthentication) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    supabaseResponse.headers.set("Pragma", "no-cache");

    const userId = String(claimsData?.claims?.sub ?? "");
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // Fail closed: jangan izinkan halaman privat jika role tidak dapat diverifikasi.
    if (roleError) {
      return redirectWithCookies(
        request,
        supabaseResponse,
        "/login?reason=role-check-failed",
      );
    }

    const roles = normalizeRoles(roleRows);

    if (roles.length === 0) {
      return redirectWithCookies(
        request,
        supabaseResponse,
        "/login?reason=role-unassigned",
      );
    }

    const primaryRole = getPrimaryRole(roles);
    const workspace = workspaceForRole(primaryRole);

    // Setiap role hanya boleh memasuki workspace miliknya sendiri.
    if (isAdminRoute && primaryRole !== "admin") {
      return redirectWithCookies(request, supabaseResponse, workspace);
    }

    const mentorMode = request.cookies.get("kcc_mentor_mode")?.value === "member"
      ? "member"
      : "mentor";

    if (isMentorRoute && primaryRole !== "instructor") {
      return redirectWithCookies(request, supabaseResponse, workspace);
    }

    // Saat Mode Member aktif, Mentor hanya boleh membuka halaman daftar kelas.
    // Semua workspace Mentor lainnya diarahkan kembali ke Mode Member.
    if (isMentorRoute && primaryRole === "instructor") {
      if (mentorMode === "member" && pathname !== "/mentor/member") {
        return redirectWithCookies(request, supabaseResponse, "/mentor/member");
      }
      if (mentorMode !== "member" && pathname === "/mentor/member") {
        return redirectWithCookies(request, supabaseResponse, "/mentor");
      }
    }

    if (isDashboardRoute && primaryRole !== "member") {
      return redirectWithCookies(request, supabaseResponse, workspace);
    }

    // Mentor hanya boleh membuka ruang belajar melalui Mode Member.
    // Pemeriksaan penugasan kelas tetap dilakukan lagi di page server.
    const mentorPreviewAllowed =
      primaryRole === "instructor" && mentorMode === "member";

    if (isCheckoutRoute && primaryRole !== "member") {
      return redirectWithCookies(request, supabaseResponse, workspace);
    }

    if (isLearningRoute && primaryRole !== "member" && !mentorPreviewAllowed) {
      return redirectWithCookies(request, supabaseResponse, workspace);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
