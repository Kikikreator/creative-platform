import { resolveMx } from "node:dns/promises";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

async function domainHasMailExchange(domain: string): Promise<boolean> {
  try {
    return (await resolveMx(domain)).length > 0;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    if (origin && host) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        return json({ success: false, message: "Asal permintaan tidak valid." }, 403);
      }
      if (originHost !== host) {
        return json({ success: false, message: "Permintaan tidak diizinkan." }, 403);
      }
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 12_000) {
      return json({ success: false, message: "Data permintaan terlalu besar." }, 413);
    }

    const body = await request.json().catch(() => null) as {
      requestId?: string;
      password?: string;
      emailOwnershipConfirmed?: boolean;
    } | null;

    const requestId = String(body?.requestId ?? "").trim();
    const password = String(body?.password ?? "");
    const emailOwnershipConfirmed = body?.emailOwnershipConfirmed === true;

    if (!UUID_PATTERN.test(requestId)) {
      return json({ success: false, message: "Tautan pengajuan tidak valid. Buka kembali tautan pribadi dari Admin." }, 400);
    }
    if (password.length > 72) {
      return json({ success: false, code: "PASSWORD_TOO_LONG", message: "Password maksimal 72 karakter." }, 400);
    }

    // Server-side validation must mirror Supabase Authentication > Email
    // > Password requirements (lowercase, uppercase letters and digits).
    const passwordRequirementsMet =
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password);

    if (!passwordRequirementsMet) {
      return json({
        success: false,
        code: "PASSWORD_POLICY",
        message: "Password belum memenuhi ketentuan. Gunakan minimal 8 karakter yang mengandung setidaknya 1 huruf kecil, 1 huruf kapital, dan 1 angka.",
      }, 400);
    }
    if (!emailOwnershipConfirmed) {
      return json({ success: false, message: "Centang pernyataan bahwa email tersebut aktif dan milikmu." }, 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicApiKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publicApiKey || !serviceRoleKey) {
      console.error("Alumni account provisioning is missing Supabase server configuration.", {
        hasUrl: Boolean(supabaseUrl),
        hasPublicKey: Boolean(publicApiKey),
        hasServiceKey: Boolean(serviceRoleKey),
      });
      return json({
        success: false,
        message: "Konfigurasi Supabase server belum lengkap. Periksa URL, publishable/anon key, dan service-role/secret key.",
      }, 503);
    }

    const clientOptions = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    };

    // This RPC is intentionally granted to anon/authenticated and is the same
    // limited lookup used by the public alumni status page.
    const lookup = createSupabaseClient(supabaseUrl, publicApiKey, clientOptions);

    // The secret client is used only for privileged Auth and role operations.
    const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, clientOptions);

    const { data: requestRows, error: requestError } = await lookup.rpc(
      "get_alumni_access_request_status",
      { p_request_id: requestId },
    );

    if (requestError) {
      console.error("Alumni request RPC lookup failed:", {
        message: requestError.message,
        code: requestError.code,
        details: requestError.details,
        hint: requestError.hint,
      });

      const response: Record<string, unknown> = {
        success: false,
        message: "Server belum bisa membaca status pengajuan alumni. Pastikan RPC get_alumni_access_request_status(uuid) tersedia dan konfigurasi public Supabase benar.",
      };

      if (process.env.NODE_ENV !== "production") {
        response.debug = requestError.message;
        response.code = requestError.code;
      }

      return json(response, 500);
    }

    const statusRow = Array.isArray(requestRows) ? requestRows[0] : null;
    if (!statusRow) {
      return json({ success: false, message: "Pengajuan tidak ditemukan. Buka tautan pribadi terbaru dari Admin." }, 404);
    }

    const alumniRequestBase = {
      id: statusRow.request_id,
      full_name: statusRow.full_name,
      email: statusRow.email,
      whatsapp_number: statusRow.whatsapp_number,
      status: statusRow.status,
      expires_at: statusRow.expires_at,
    };

    if (
      alumniRequestBase.status === "expired" ||
      !alumniRequestBase.expires_at ||
      new Date(alumniRequestBase.expires_at).getTime() <= Date.now()
    ) {
      return json({ success: false, message: "Masa persetujuan sudah berakhir. Hubungi Admin untuk meminta persetujuan ulang." }, 410);
    }
    if (alumniRequestBase.status !== "approved") {
      return json({ success: false, message: "Akun hanya dapat dibuat setelah pengajuan disetujui Admin." }, 409);
    }

    // Ambil jawaban survei dari tabel pengajuan menggunakan service-role.
    // RPC publik status sengaja hanya mengembalikan data minimum untuk halaman status.
    const { data: surveyRow, error: surveyError } = await admin
      .from("alumni_access_requests")
      .select("address, acquisition_source, registration_reason")
      .eq("id", requestId)
      .maybeSingle();

    if (surveyError || !surveyRow) {
      console.error("Alumni survey data lookup failed:", surveyError?.message ?? "Request row not found");
      return json({
        success: false,
        message: "Data asal daerah dan survei pengajuan belum dapat dibaca. Pastikan migrasi data survei alumni sudah dijalankan, lalu coba kembali.",
      }, 500);
    }

    const alumniRequest = {
      ...alumniRequestBase,
      address: String(surveyRow.address ?? "").trim() || null,
      acquisition_source: String(surveyRow.acquisition_source ?? "").trim() || "Lainnya",
      registration_reason: String(surveyRow.registration_reason ?? "").trim() || "Akses Alumni",
    };

    const email = String(alumniRequest.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return json({ success: false, message: "Alamat email pada pengajuan tidak valid. Hubungi Admin untuk memperbaikinya." }, 400);
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (
      !domain ||
      ["localhost", "example.com", "example.net", "example.org"].includes(domain) ||
      /\.(test|invalid|localhost)$/.test(domain)
    ) {
      return json({ success: false, message: "Gunakan alamat email pribadi dengan domain email yang benar-benar digunakan." }, 400);
    }

    if (!(await domainHasMailExchange(domain))) {
      return json({ success: false, message: "Domain email tidak memiliki MX record untuk menerima email. Periksa kembali alamat email pada pengajuan dan hubungi Admin jika perlu." }, 400);
    }

    // Alumni account creation skips an email challenge by design.
    // MX validation does not prove ownership of the individual mailbox.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: alumniRequest.full_name,
        phone: alumniRequest.whatsapp_number,
        whatsapp_number: alumniRequest.whatsapp_number,
        address: alumniRequest.address,
        acquisition_source: alumniRequest.acquisition_source,
        registration_reason: alumniRequest.registration_reason,
        account_origin: "approved_alumni_request",
        alumni_request_id: alumniRequest.id,
      },
    });

    if (createError || !created.user) {
      const message = createError?.message ?? "Akun belum berhasil dibuat.";
      const lower = message.toLowerCase();

      if (
        lower.includes("already") ||
        lower.includes("registered") ||
        lower.includes("exists") ||
        lower.includes("email_exists")
      ) {
        return json({
          success: false,
          code: "EMAIL_EXISTS",
          message: "Email ini sudah memiliki akun Kiki Creator Class. Silakan login menggunakan akun tersebut.",
        }, 409);
      }

      console.error("Alumni Auth user creation failed:", {
        message,
        code: createError?.code ?? null,
        status: createError?.status ?? null,
      });

      // Keep the user-facing error helpful if the Supabase password policy
      // is changed later and no longer matches this application's validation.
      if (lower.includes("password should contain") || lower.includes("password") && lower.includes("weak")) {
        return json({
          success: false,
          code: "PASSWORD_POLICY",
          message: "Password belum memenuhi kebijakan keamanan. Gunakan minimal 8 karakter dengan huruf kecil, huruf kapital, dan angka.",
        }, 400);
      }

      return json({ success: false, message: "Akun belum berhasil dibuat karena ada kendala pada layanan autentikasi. Silakan coba kembali atau hubungi Admin." }, 500);
    }

    const userId = created.user.id;
    const { data: roleRows, error: roleReadError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleReadError) {
      await admin.auth.admin.deleteUser(userId);
      console.error("Alumni role lookup failed:", roleReadError.message);
      return json({ success: false, message: "Akun belum dapat disiapkan sebagai Peserta. Silakan hubungi Admin." }, 500);
    }

    const roles = (roleRows ?? []).map((row) => String(row.role));
    if (roles.includes("admin") || roles.includes("instructor")) {
      await admin.auth.admin.deleteUser(userId);
      return json({ success: false, message: "Akun ini tidak dapat dibuat sebagai akun alumni Peserta." }, 403);
    }

    if (!roles.includes("member")) {
      const { error: roleInsertError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "member" });

      if (roleInsertError) {
        await admin.auth.admin.deleteUser(userId);
        console.error("Alumni member role creation failed:", roleInsertError.message);
        return json({ success: false, message: "Akun berhasil disiapkan, tetapi role Peserta gagal dibuat. Silakan hubungi Admin sebelum mencoba lagi." }, 500);
      }
    }

    // Pastikan jawaban survei masuk ke profil yang dibaca halaman Admin > Pengguna.
    // Metadata Auth juga sudah diisi di atas sebagai cadangan sinkronisasi.
    const { error: profileUpsertError } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: alumniRequest.full_name,
        phone: alumniRequest.whatsapp_number,
        whatsapp_number: alumniRequest.whatsapp_number,
        address: alumniRequest.address,
        acquisition_source: alumniRequest.acquisition_source,
        registration_reason: alumniRequest.registration_reason,
      }, { onConflict: "id" });

    if (profileUpsertError) {
      await admin.auth.admin.deleteUser(userId);
      console.error("Alumni profile survey sync failed:", profileUpsertError.message);
      return json({
        success: false,
        message: "Akun belum dapat diselesaikan karena data profil peserta gagal disimpan. Silakan coba kembali atau hubungi Admin.",
      }, 500);
    }

    return json({
      success: true,
      email,
      message: "Akun alumni berhasil dibuat tanpa email verifikasi. Kamu bisa langsung masuk dan mengaktifkan kelas.",
    });
  } catch (error) {
    console.error("Unexpected alumni account provisioning error:", error);
    return json({ success: false, message: "Terjadi kendala saat membuat akun alumni. Coba lagi atau hubungi Admin." }, 500);
  }
}
