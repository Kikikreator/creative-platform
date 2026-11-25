import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeInternalPath(value: string | null) {
  const fallback = "/akses-alumni";
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const internalUrl = new URL(value, "https://internal.invalid");

    // Hanya izinkan URL internal. Halaman login dan callback tidak boleh
    // menjadi tujuan callback agar tidak terjadi loop autentikasi.
    if (internalUrl.origin !== "https://internal.invalid") return fallback;
    if (internalUrl.pathname === "/auth/callback" || internalUrl.pathname === "/login") {
      return fallback;
    }

    // Registrasi hanya boleh menjadi tujuan callback jika membawa token
    // undangan Mentor. Ini diperlukan setelah verifikasi email calon Mentor.
    if (internalUrl.pathname === "/register" && !internalUrl.searchParams.get("mentor_invite")) {
      return fallback;
    }

    if (internalUrl.pathname.startsWith("/register/")) return fallback;

    return `${internalUrl.pathname}${internalUrl.search}${internalUrl.hash}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failedUrl = new URL(destination, request.url);
      failedUrl.searchParams.set("verification", "failed");
      return NextResponse.redirect(failedUrl);
    }
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
