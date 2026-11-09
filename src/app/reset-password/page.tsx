
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LockKeyhole,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================
  // VERIFIKASI LINK PEMULIHAN SUPABASE
  // ==========================================

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const searchParams = new URLSearchParams(
      window.location.search
    );

    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const authError =
      searchParams.get("error_description") ||
      hashParams.get("error_description");

    const authErrorCode =
      searchParams.get("error_code") ||
      hashParams.get("error_code");

    if (authError || authErrorCode) {
      setCanReset(false);

      setError(
        authErrorCode === "otp_expired"
          ? "Tautan reset password sudah kedaluwarsa atau sudah pernah digunakan. Kembali ke halaman login dan minta tautan baru."
          : "Tautan pemulihan tidak valid. Silakan minta tautan reset password yang baru."
      );

      setChecking(false);

      return () => {
        active = false;
      };
    }

    // Supabase memproses callback PKCE dari URL
    // ketika browser client diinisialisasi.

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setCanReset(true);
        setError("");
        setChecking(false);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;

        if (sessionError || !data.session) {
          setCanReset(false);

          setError(
            "Sesi pemulihan tidak ditemukan. Silakan kembali ke halaman login dan minta tautan reset password yang baru."
          );
        } else {
          setCanReset(true);
          setError("");

          // Bersihkan kode/token dari address bar
          // setelah Supabase selesai memproses callback.

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }

        setChecking(false);
      })
      .catch(() => {
        if (!active) return;

        setCanReset(false);

        setError(
          "Gagal memverifikasi tautan pemulihan. Silakan coba kembali."
        );

        setChecking(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // SIMPAN PASSWORD BARU
  // ==========================================

  async function handleResetPassword(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Konfirmasi password tidak sama dengan password baru."
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      // Akhiri sesi lokal setelah password berhasil diperbarui.
      // Password tetap sudah berhasil diperbarui jika logout gagal.

      await supabase.auth
        .signOut({ scope: "local" })
        .catch(() => undefined);

      setPassword("");
      setConfirmPassword("");
      setCanReset(false);

      setSuccess(
        "Password berhasil diperbarui. Sekarang kamu bisa masuk menggunakan password baru."
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui password. Silakan coba kembali."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // TAMPILAN HALAMAN
  // ==========================================

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F7FC] px-4 py-8 sm:px-6">

      {/* BACKGROUND */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-300/15 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />

      {/* MAIN CARD */}
      <section className="relative w-full max-w-md rounded-[26px] border border-white bg-white p-7 shadow-[0_18px_55px_rgba(76,29,149,0.12)] sm:rounded-[28px] sm:p-9">

        {/* ICON */}
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EEEAF7] bg-[#FBFAFF] text-[#260047] shadow-sm">
          <LockKeyhole size={26} />
        </div>

        {/* HEADING */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#260047]">
          ACCOUNT SECURITY
        </p>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#211A37] sm:text-[28px]">
          Atur Password Baru
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Buat password baru untuk akun Kiki Creator Class kamu.
        </p>

        {/* LOADING VERIFIKASI */}
        {checking ? (
          <div className="mt-8 flex items-center justify-center gap-3 py-8 text-sm text-slate-500">
            <Loader2
              size={20}
              className="animate-spin"
            />
            Memverifikasi tautan...
          </div>

        ) : success ? (

          /* BERHASIL */
          <div className="mt-7 space-y-5">

            <div
              role="status"
              className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700"
            >
              <div className="mb-2 flex items-center gap-2 font-bold">
                <CheckCircle2 size={19} />
                Password berhasil diperbarui!
              </div>

              {success}
            </div>

            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#260047] text-sm font-bold text-white transition hover:bg-[#6D28D9]"
            >
              Masuk ke Akun
            </Link>

          </div>

        ) : !canReset ? (

          /* LINK TIDAK VALID */
          <div className="mt-7 space-y-5">

            <div
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700"
            >
              {error || "Tautan pemulihan tidak dapat digunakan."}
            </div>

            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#260047] text-sm font-bold text-white transition hover:bg-[#6D28D9]"
            >
              Kembali ke Login
            </Link>

          </div>

        ) : (

          /* FORM PASSWORD BARU */
          <form
            onSubmit={handleResetPassword}
            className="mt-7 space-y-5"
          >

            {/* PASSWORD BARU */}
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-xs font-bold text-slate-700"
              >
                Password Baru
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition focus-within:border-[#260047] focus-within:ring-4 focus-within:ring-[#260047]/10">

                <LockKeyhole
                  size={17}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="h-full w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[#F3EEFF] hover:text-[#260047]"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>

              </div>
            </div>

            {/* KONFIRMASI PASSWORD */}
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-xs font-bold text-slate-700"
              >
                Konfirmasi Password Baru
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition focus-within:border-[#260047] focus-within:ring-4 focus-within:ring-[#260047]/10">

                <LockKeyhole
                  size={17}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword ? "text" : "password"
                  }
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Ulangi password baru"
                  className="h-full w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Sembunyikan konfirmasi password"
                      : "Tampilkan konfirmasi password"
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[#F3EEFF] hover:text-[#260047]"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>

              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700"
              >
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] text-sm font-bold text-white shadow-[0_4px_12px_rgba(109,40,217,0.18)] transition hover:bg-[#260047] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Menyimpan Password...
                </>
              ) : (
                "Simpan Password Baru"
              )}
            </button>

          </form>
        )}

        {/* FOOTER */}
        <div className="mt-7 border-t border-slate-100 pt-5">

          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 transition hover:text-[#260047]"
          >
            <ArrowLeft
              size={14}
              className="transition-transform group-hover:-translate-x-1"
            />
            Kembali ke Login
          </Link>

          <div className="mt-5 flex items-center justify-between gap-2">

            <p className="text-[9px] text-slate-400">
              © {new Date().getFullYear()} Kiki Creator Class
            </p>

            <p className="text-[9px] font-medium text-[#260047]">
              Secure Access
            </p>

          </div>

        </div>

      </section>
    </main>
  );
}
