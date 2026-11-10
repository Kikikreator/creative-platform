import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeInternalPath(value: string | null) {
  if (!value) return "/akses-alumni";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/akses-alumni";
  }
  if (value.startsWith("/auth/callback") || value.startsWith("/login") || value.startsWith("/register")) {
    return "/akses-alumni";
  }
  return value;
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
