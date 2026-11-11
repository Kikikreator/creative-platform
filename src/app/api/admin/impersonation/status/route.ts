import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  decryptImpersonationPayload,
  IMPERSONATION_COOKIE_NAME,
} from "@/lib/auth/impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const encryptedPayload = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;

  if (!encryptedPayload) {
    return Response.json(
      { active: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const payload = decryptImpersonationPayload(encryptedPayload);

  if (!payload) {
    cookieStore.delete(IMPERSONATION_COOKIE_NAME);
    return Response.json(
      { active: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || user.id !== payload.targetUserId) {
      // Jangan menampilkan mode pengujian jika sesi browser bukan akun target.
      if (user?.id === payload.adminUserId) {
        cookieStore.delete(IMPERSONATION_COOKIE_NAME);
      }

      return Response.json(
        { active: false },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    return Response.json(
      {
        active: true,
        targetUserId: payload.targetUserId,
        targetName: payload.targetName,
        targetEmail: payload.targetEmail,
        targetRole: payload.targetRole,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Impersonation status lookup failed:", error);
    return Response.json(
      { active: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
