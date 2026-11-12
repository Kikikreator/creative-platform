"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AlumniRequest = {
  request_id: string;
  full_name: string;
  email: string;
  whatsapp_number: string;
  course_id: string;
  course_title: string;
  status: string;
  expires_at: string | null;
};

function getRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return data ? [data as T] : [];
}

export default function AlumniCreateAccountPage() {
  const [requestId, setRequestId] = useState("");
  const [request, setRequest] = useState<AlumniRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [pageError, setPageError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailOwnershipConfirmed, setEmailOwnershipConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [signedInDifferentAccount, setSignedInDifferentAccount] = useState(false);

  const alumniUrl = useMemo(
    () => requestId ? `/akses-alumni?request=${encodeURIComponent(requestId)}` : "/akses-alumni",
    [requestId],
  );

  // Samakan validasi frontend dengan kebijakan Supabase:
  // minimal 8 karakter, huruf kecil, huruf kapital, dan angka.
  const passwordRequirements = [
    { label: "Minimal 8 karakter", valid: password.length >= 8 },
    { label: "Mengandung huruf kecil (a–z)", valid: /[a-z]/.test(password) },
    { label: "Mengandung huruf kapital (A–Z)", valid: /[A-Z]/.test(password) },
    { label: "Mengandung angka (0–9)", valid: /[0-9]/.test(password) },
  ];
  const passwordIsValid = passwordRequirements.every((item) => item.valid);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("request") ?? "";
    setRequestId(id);

    if (!id) {
      setPageError("Tautan pembuatan akun tidak lengkap. Buka kembali tautan Akses Alumni pribadi dari Admin.");
      setLoadingRequest(false);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const supabase = createClient();
        const [{ data, error }, { data: userData }] = await Promise.all([
          supabase.rpc("get_alumni_access_request_status", { p_request_id: id }),
          supabase.auth.getUser(),
        ]);
        if (error) throw new Error(error.message);
        const row = getRows<AlumniRequest>(data)[0];
        if (!row) throw new Error("Data pengajuan tidak ditemukan. Minta Admin mengirim ulang tautan pribadi.");
        if (row.status === "claimed") {
          window.location.replace("/dashboard");
          return;
        }
        if (row.status !== "approved") {
          throw new Error("Pengajuan belum disetujui atau masa aktivasi sudah berakhir. Kembali ke halaman Akses Alumni untuk melihat status terbaru.");
        }
        if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
          throw new Error("Masa aktivasi pengajuan ini sudah berakhir. Hubungi Admin untuk meminta persetujuan ulang.");
        }
        if (!active) return;
        setRequest(row);

        const user = userData.user;
        if (user) {
          if (user.email?.toLowerCase() === row.email.toLowerCase()) {
            window.location.replace(`/akses-alumni?request=${encodeURIComponent(id)}`);
            return;
          }
          setSignedInDifferentAccount(true);
        }
      } catch (error) {
        if (active) setPageError(error instanceof Error ? error.message : "Data pengajuan belum dapat diperiksa.");
      } finally {
        if (active) setLoadingRequest(false);
      }
    })();

    return () => { active = false; };
  }, []);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request || submitting) return;
    setSubmitError("");
    setExistingAccount(false);
    setAccountCreated(false);

    if (password.length > 72) {
      setSubmitError("Password maksimal 72 karakter.");
      return;
    }
    if (!passwordIsValid) {
      setSubmitError(
        "Password belum memenuhi ketentuan: minimal 8 karakter serta mengandung huruf kecil, huruf kapital, dan angka.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Konfirmasi password belum sama.");
      return;
    }
    if (!emailOwnershipConfirmed) {
      setSubmitError("Pastikan email tersebut aktif dan benar-benar milikmu dengan mencentang pernyataan di bawah.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/alumni/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          requestId: request.request_id,
          password,
          emailOwnershipConfirmed,
        }),
      });

      const result = await response.json().catch(() => ({})) as {
        success?: boolean;
        code?: string;
        message?: string;
      };

      if (!response.ok || !result.success) {
        if (result.code === "EMAIL_EXISTS") setExistingAccount(true);
        throw new Error(result.message || "Akun belum berhasil dibuat. Silakan coba kembali.");
      }

      setAccountCreated(true);
      setSuccessMessage(result.message || "Akun alumni berhasil dibuat.");

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: request.email,
        password,
      });

      if (signInError) {
        setSubmitError("Akun berhasil dibuat, tetapi login otomatis belum berhasil. Gunakan tombol Login Alumni untuk masuk.");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { error: profileError } = await supabase.rpc("save_member_registration_details", {
        p_full_name: request.full_name,
        p_whatsapp_number: request.whatsapp_number,
        p_address: null,
        p_acquisition_source: "Lainnya",
        p_registration_reason: "Akses Alumni",
      });
      if (profileError) {
        // The account and member role are already created on the server.
        // Keep the activation flow available; profile sync can be repaired by Admin.
        console.warn("Data profil alumni belum tersinkron:", profileError.message);
      }

      window.location.replace(alumniUrl);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Akun belum berhasil dibuat. Silakan coba kembali.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOutWrongAccount() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSubmitError(error.message);
      return;
    }
    window.location.reload();
  }

  if (loadingRequest) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F8F7FA] px-4"><div className="flex items-center gap-3 text-sm text-[#62576D]"><Loader2 size={18} className="animate-spin" /> Memeriksa persetujuan alumni...</div></main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FA] px-4 py-8 sm:px-6">
      <section className="w-full max-w-lg rounded-[26px] border border-[#EAE3EF] bg-white p-5 shadow-[0_18px_50px_rgba(38,0,71,.07)] sm:p-8">
        <Link href={alumniUrl} className="inline-flex items-center gap-2 text-xs font-medium text-[#756A7D] hover:text-[#260047]"><ArrowLeft size={14} /> Kembali ke Akses Alumni</Link>
        <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0EAF5] text-[#260047]"><UserRound size={24} /></div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.18em] text-[#80658F]">Kiki Creator Class · Alumni</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#30243A]">Buat Akun Alumni</h1>
        <p className="mt-2 text-sm leading-6 text-[#62576D]">Pengajuanmu sudah disetujui Admin. Buat password untuk akun menggunakan email yang kamu cantumkan saat mengajukan akses.</p>

        {pageError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">{pageError}<Link href={alumniUrl} className="mt-3 inline-flex items-center gap-2 font-semibold text-[#260047]">Lihat status pengajuan <ArrowRight size={14} /></Link></div>
        ) : request ? (
          <>
            <div className="mt-5 rounded-xl bg-[#F8F5FA] p-4 text-sm text-[#62576D]">
              <div className="flex items-center gap-2 text-emerald-700"><ShieldCheck size={17} /><span className="text-xs font-semibold">Pengajuan disetujui Admin</span></div>
              <p className="mt-3 text-xs text-[#80658F]">Nama peserta</p><p className="font-medium text-[#30243A]">{request.full_name}</p>
              <p className="mt-3 text-xs text-[#80658F]">Email akun</p><p className="break-all font-semibold text-[#30243A]">{request.email}</p>
              <p className="mt-3 text-xs text-[#80658F]">Kelas yang diberikan</p><p className="font-medium text-[#30243A]">{request.course_title}</p>
            </div>

            {signedInDifferentAccount ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Kamu sedang masuk dengan email lain</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">Keluar dari akun tersebut terlebih dahulu. Setelah itu buat akun menggunakan {request.email}.</p>
                <button type="button" onClick={signOutWrongAccount} className="mt-3 min-h-10 rounded-lg bg-[#260047] px-4 text-xs font-semibold text-white">Keluar dan lanjutkan</button>
              </div>
            ) : accountCreated ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-700"><CheckCircle2 size={22} /></div>
                <h2 className="mt-3 text-base font-semibold text-emerald-900">Akun alumni berhasil dibuat</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-800">{successMessage} Tidak ada email verifikasi yang dikirim. Masuk menggunakan email dan password yang baru dibuat, lalu aktifkan kelas di halaman Akses Alumni.</p>
                {submitError && <p className="mt-3 text-xs leading-5 text-amber-800">{submitError}</p>}
                <Link href={`/login?next=${encodeURIComponent(alumniUrl)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white">Login Alumni <ArrowRight size={15} /></Link>
              </div>
            ) : (
              <form onSubmit={handleCreateAccount} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="alumni-password" className="text-xs font-medium text-[#51465D]">Buat password <span className="text-rose-500">*</span></label>
                  <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-[#E7E0EB] bg-white px-3.5 focus-within:border-[#6B3B88] focus-within:ring-4 focus-within:ring-[#260047]/10">
                    <input id="alumni-password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" className="min-w-0 flex-1 bg-transparent text-sm text-[#30243A] outline-none placeholder:text-[#756B7C]" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#756B7C]" aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  <div className="mt-2 rounded-lg bg-[#FAF8FC] p-3">
                    <p className="mb-2 text-[11px] font-medium text-[#51465D]">Ketentuan password:</p>
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {passwordRequirements.map((item) => (
                        <li key={item.label} className={`flex items-center gap-2 text-[11px] ${item.valid ? "text-emerald-700" : "text-[#756B7C]"}`}>
                          <span aria-hidden="true" className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.valid ? "bg-emerald-100 text-emerald-700" : "bg-[#EEEAF1] text-[#756B7C]"}`}>
                            {item.valid ? "✓" : "·"}
                          </span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[10px] leading-4 text-[#756B7C]">Contoh format: KikiBelajar2026. Gunakan password pribadi dan jangan bagikan kepada orang lain.</p>
                  </div>
                </div>
                <div>
                  <label htmlFor="alumni-confirm-password" className="text-xs font-medium text-[#51465D]">Ulangi password <span className="text-rose-500">*</span></label>
                  <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-[#E7E0EB] bg-white px-3.5 focus-within:border-[#6B3B88] focus-within:ring-4 focus-within:ring-[#260047]/10">
                    <input id="alumni-confirm-password" type={showConfirmPassword ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Masukkan ulang password" className="min-w-0 flex-1 bg-transparent text-sm text-[#30243A] outline-none placeholder:text-[#756B7C]" />
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#756B7C]" aria-label={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`mt-1.5 text-[11px] ${passwordsMatch ? "text-emerald-700" : "text-rose-600"}`} role="status">
                      {passwordsMatch ? "Password sudah sama." : "Password belum sama."}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-[#E7E0EB] bg-[#FCFAFD] p-3.5 text-xs leading-5 text-[#51465D]">
                  <input type="checkbox" checked={emailOwnershipConfirmed} onChange={(event) => setEmailOwnershipConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#260047]" />
                  <span>Saya memastikan email <strong className="font-semibold text-[#30243A]">{request.email}</strong> benar, aktif, dan milik saya. Saya memahami bahwa sistem tidak mengirim email verifikasi.</span>
                </label>
                <p className="text-[11px] leading-5 text-[#756B7C]">Sistem memeriksa format dan domain email. Pemeriksaan ini tidak dapat memastikan bahwa kotak masuk benar-benar milikmu. Admin dapat menghubungimu melalui WhatsApp jika perlu konfirmasi.</p>

                {submitError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{submitError}</div>}
                {existingAccount && <Link href={`/login?next=${encodeURIComponent(alumniUrl)}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[#DED4E6] px-4 text-sm font-semibold text-[#51465D]">Login dengan akun yang sudah ada</Link>}
                <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white transition hover:bg-[#3A0A5E] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {submitting ? "Membuat akun..." : "Buat Akun dan Lanjutkan"}
                </button>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
