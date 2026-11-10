
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

import {
  LockKeyhole,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [courseId, setCourseId] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [mentorInvite, setMentorInvite] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);

    const requestedCourseId = params.get("course");
    const requestedMentorInvite = params.get("mentor_invite");
    const requestedNextPath = params.get("next") ?? params.get("redirect");

    const isSafeInternalPath = Boolean(
      requestedNextPath &&
      requestedNextPath.startsWith("/") &&
      !requestedNextPath.startsWith("//") &&
      !requestedNextPath.includes("\\") &&
      !requestedNextPath.startsWith("/login") &&
      !requestedNextPath.startsWith("/register")
    );

    setCourseId(requestedCourseId);
    setMentorInvite(requestedMentorInvite);

    if (isSafeInternalPath && requestedNextPath) {
      setNextPath(requestedNextPath);
    }

    // Jika sesi masih aktif, arahkan akun sesuai role.
    void (async () => {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active || !user) return;

        const { data: roleRows, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (!active) return;

        if (roleError) {
          setError(
            "Hak akses akun belum dapat diverifikasi. Silakan muat ulang atau hubungi Admin."
          );
          return;
        }

        const roles = normalizeRoles(roleRows);
        const primaryRole = getPrimaryRole(roles);

        // Proses undangan Mentor.
        if (
          requestedMentorInvite &&
          primaryRole !== "admin" &&
          primaryRole !== "instructor"
        ) {
          const { error: inviteError } = await supabase.rpc(
            "accept_mentor_invitation",
            { p_token: requestedMentorInvite },
          );

          if (inviteError) {
            setError(inviteError.message);
            return;
          }

          const {
            data: updatedRoleRows,
            error: updatedRoleError,
          } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (updatedRoleError) {
            setError(
              "Undangan diterima, tetapi hak akses Mentor belum dapat diverifikasi."
            );
            return;
          }

          if (
            getPrimaryRole(normalizeRoles(updatedRoleRows)) !==
            "instructor"
          ) {
            setError(
              "Undangan belum memberikan akses Mentor. Hubungi Admin untuk pemeriksaan."
            );
            return;
          }

          router.replace("/mentor");
          router.refresh();
          return;
        }

        if (primaryRole === "admin") {
          router.replace("/admin");
          router.refresh();
          return;
        }

        if (primaryRole === "instructor") {
          router.replace("/mentor");
          router.refresh();
          return;
        }

        if (primaryRole !== "member") {
          setError(
            "Akun ini belum memiliki hak akses. Hubungi Admin untuk pemeriksaan akun."
          );
          return;
        }

        let destination = "/dashboard";

        if (isSafeInternalPath && requestedNextPath) {
          destination = requestedNextPath;
        } else if (requestedCourseId) {
          destination = `/checkout?course=${encodeURIComponent(
            requestedCourseId
          )}`;
        }

        router.replace(destination);
        router.refresh();
      } catch {
        // Jika pemeriksaan sesi gagal sementara,
        // formulir login tetap tersedia.
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const registerHref = courseId
    ? `/register?course=${encodeURIComponent(courseId)}`
    : "/register";

  // ==========================================
  // LUPA PASSWORD
  // ==========================================

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Masukkan alamat email terlebih dahulu.");
      setSuccess("");
      return;
    }

    if (resetLoading || loading) return;

    setResetLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );

      if (resetError) throw resetError;

      setSuccess(
        "Jika alamat email terdaftar, tautan untuk mengatur ulang password akan dikirim. Periksa inbox atau folder spam."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengirim tautan reset password. Silakan coba kembali."
      );
    } finally {
      setResetLoading(false);
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      // 1. AUTENTIKASI
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        throw new Error(
          "Email atau password salah. Pastikan akun sudah terverifikasi."
        );
      }

      // 2. VERIFIKASI USER
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Gagal memverifikasi akun.");
      }

      if (mentorInvite) {
        const {
          data: existingRoleRows,
          error: existingRoleError,
        } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (existingRoleError) throw existingRoleError;

        const existingPrimaryRole = getPrimaryRole(
          normalizeRoles(existingRoleRows)
        );

        if (existingPrimaryRole === "admin") {
          router.replace("/admin");
          router.refresh();
          return;
        }

        if (existingPrimaryRole === "instructor") {
          router.replace("/mentor");
          router.refresh();
          return;
        }

        const { error: inviteError } = await supabase.rpc(
          "accept_mentor_invitation",
          { p_token: mentorInvite },
        );

        if (inviteError) throw inviteError;
      }

      // 3. CEK SEMUA ROLE PENGGUNA
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roleError) {
        throw roleError;
      }

      // Satu akun dapat memiliki beberapa role.
      const roles = normalizeRoles(roleRows);

      if (roles.length === 0) {
        await supabase.auth.signOut();

        throw new Error(
          "Akun belum memiliki role yang valid. Hubungi Admin."
        );
      }

      const primaryRole = getPrimaryRole(roles);

      if (primaryRole === "admin") {
        setSuccess(
          "Login administrator berhasil! Mengarahkan ke Admin Workspace..."
        );

        router.replace("/admin");
        router.refresh();
        return;
      }

      if (primaryRole === "instructor") {
        setSuccess(
          mentorInvite
            ? "Undangan Mentor berhasil diterima! Mengarahkan ke Mentor Workspace..."
            : "Login mentor berhasil! Mengarahkan ke Mentor Workspace..."
        );

        router.replace("/mentor");
        router.refresh();
        return;
      }

      if (primaryRole !== "member") {
        await supabase.auth.signOut();

        throw new Error(
          "Role akun tidak dikenali. Hubungi Admin."
        );
      }

      // Sinkronkan metadata pendaftaran hanya untuk Peserta.
      const userMetadata = user.user_metadata ?? {};

      if (
        userMetadata.whatsapp_number ||
        userMetadata.acquisition_source ||
        userMetadata.registration_reason
      ) {
        const { error: intakeSyncError } = await supabase.rpc(
          "save_member_registration_details",
          {
            p_full_name: String(userMetadata.full_name ?? ""),
            p_whatsapp_number: String(
              userMetadata.whatsapp_number ??
              userMetadata.phone ??
              ""
            ),
            p_address: String(userMetadata.address ?? "") || null,
            p_acquisition_source:
              String(userMetadata.acquisition_source ?? "") || null,
            p_registration_reason:
              String(userMetadata.registration_reason ?? "") || null,
          },
        );

        if (intakeSyncError) {
          console.warn(
            "Detail pendaftaran belum tersinkron:",
            intakeSyncError.message
          );
        }
      }

      let destination = "/dashboard";

      if (nextPath) {
        destination = nextPath;

        setSuccess(
          "Login berhasil! Mengarahkan ke halaman yang kamu tuju..."
        );
      } else if (courseId) {
        destination = `/checkout?course=${encodeURIComponent(
          courseId
        )}`;

        setSuccess("Login berhasil! Mengarahkan ke checkout...");
      } else {
        setSuccess(
          "Login berhasil! Mengarahkan ke Dashboard Peserta..."
        );
      }

      // 4. REDIRECT
      router.replace(destination);
      router.refresh();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan. Silakan coba kembali."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="kcc-login-main relative flex min-h-screen items-start justify-center overflow-hidden bg-[#F8F7FC] px-4 py-4 sm:items-center sm:px-6 sm:py-6">

      {/* BACKGROUND */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-300/15 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />

      {/* MAIN CARD */}
      <div className="kcc-login-card relative grid w-full max-w-[440px] overflow-hidden rounded-[26px] border border-white bg-white shadow-[0_18px_55px_rgba(76,29,149,0.12)] sm:rounded-[28px] lg:max-w-[920px] lg:min-h-[560px] lg:grid-cols-2">

        {/* LEFT PANEL */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#260047] p-8 text-white lg:flex xl:p-10">

          {/* DECORATION */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/15" />

          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full border border-white/15" />

          <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-white/[0.04]" />

          {/* BRAND */}
          <div className="relative z-10 flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5">
              <Image
                src="/logo_brand.png"
                alt="Kiki Creator Class"
                width={38}
                height={38}
                priority
                className="h-full w-full rounded-lg object-contain"
              />
            </div>

            <div>
              <p className="text-sm font-extrabold">
                Kiki Creator Class
              </p>

              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#DED0FF]">
                Learn · Create · Grow
              </p>
            </div>

          </div>

          {/* INTRO */}
          <div className="relative z-10 mt-8">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-[#EAE1FF]">
              <Sparkles size={13} />
              LEARNING WORKSPACE
            </div>

            <h1 className="max-w-[340px] text-[36px] font-extrabold leading-[1.13] tracking-tight">
              Belajar dan
              <br />
              kembangkan

              <span className="block text-[#D8C7FF]">
                kreativitas
                <br />
                bersama.
              </span>
            </h1>

            <p className="mt-4 max-w-[340px] text-[12px] leading-6 text-[#E8DEFF]">
              Satu ruang untuk mengembangkan kemampuan,
              mengikuti pembelajaran, dan mengelola
              perjalanan kreatifmu.
            </p>

            <div className="mt-7 space-y-3">
              {[
                "Akses kelas dan materi pembelajaran",
                "Pengalaman belajar terstruktur",
                "Kelola aktivitas dalam satu platform",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15">
                    <CheckCircle2
                      size={13}
                      className="text-[#D8C7FF]"
                    />
                  </div>

                  <span className="text-xs font-medium text-[#F3EEFF]">
                    {item}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* BOTTOM */}
          <div className="relative z-10 flex items-center gap-2 text-[10px] text-[#DED0FF]">
            <GraduationCap size={15} />
            Learn · Create · Grow
          </div>

        </section>

        {/* RIGHT PANEL */}
        <section className="kcc-login-panel flex min-w-0 flex-col justify-start px-5 py-6 sm:px-10 sm:py-10 lg:justify-center lg:px-9 lg:py-9 xl:px-11">

          {/* MOBILE BRAND */}
          <Link
            href="/"
            className="kcc-login-mobile-brand mb-5 flex items-center gap-3 lg:hidden"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#EEEAF7] bg-[#FBFAFF] p-1.5">
              <Image
                src="/logo_brand.png"
                alt="Kiki Creator Class"
                width={38}
                height={38}
                priority
                className="h-full w-full rounded-lg object-contain"
              />
            </div>

            <div>
              <p className="text-sm font-extrabold text-[#211A37]">
                Kiki Creator Class
              </p>

              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#260047]">
                Learn · Create · Grow
              </p>
            </div>
          </Link>

          {/* MOBILE LEARNING IDENTITY — kept directly below the brand */}
          <div className="kcc-login-mobile-intro mb-6 lg:hidden">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#EEEAF7] bg-[#F8F6FA] px-3 py-1.5 text-[12px] font-medium text-[#51436F]">
              <Sparkles size={14} />
              Learning Workspace
            </span>
            <p className="mt-3 max-w-[28ch] text-[21px] font-semibold leading-[1.25] tracking-tight text-[#211A37]">
              Belajar dan kembangkan kreativitas bersama.
            </p>
          </div>

          {/* HEADING */}
          <div className="mb-6">

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#EEEAF7] bg-[#FBFAFF] text-[#260047] shadow-sm">
              <GraduationCap size={23} />
            </div>

            <h2 className="mt-2 text-[27px] font-extrabold tracking-tight text-[#211A37] sm:text-[30px]">
              Selamat datang!
            </h2>

            <p className="mt-2 max-w-[340px] text-sm leading-6 text-slate-500">
              Masuk ke akunmu untuk melanjutkan perjalanan
              belajar bersama Kiki Creator Class.
            </p>

          </div>

          {/* LOGIN FORM */}
          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >

            {/* EMAIL */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Alamat Email
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-[#FFFFFF] px-3.5 transition focus-within:border-[#260047] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#260047]/10">

                <Mail
                  size={17}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="login-input h-full w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-[#FFFFFF] px-3.5 transition focus-within:border-[#260047] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#260047]/10">

                <LockKeyhole
                  size={17}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="login-input h-full w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
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

            {/* FORGOT PASSWORD */}
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading || loading}
                className="text-xs font-bold text-[#6D28D9] transition hover:text-[#260047] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetLoading
                  ? "Mengirim tautan..."
                  : "Lupa Password?"}
              </button>
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

            {/* SUCCESS */}
            {success && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-700">
                {success}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] text-sm font-bold text-white shadow-[0_4px_12px_rgba(109,40,217,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#260047] hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Memproses login...
                </>
              ) : (
                <>
                  Masuk ke Akun
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>

          </form>

          {/* FOOTER */}
          <div className="mt-7 border-t border-slate-100 pt-5">

            <p className="text-center text-sm text-slate-500">
              Belum punya akun?{" "}

              <Link
                href={registerHref}
                className="font-bold text-[#260047] transition hover:text-[#09483F]"
              >
                Daftar sekarang
              </Link>
            </p>

            <div className="mt-5">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 transition hover:text-[#260047]"
              >
                <ArrowLeft
                  size={14}
                  className="transition-transform group-hover:-translate-x-1"
                />
                Kembali ke halaman utama
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">

              <p className="text-[9px] text-slate-400">
                © {new Date().getFullYear()} Kiki Creator Class
              </p>

              <div className="text-[9px] font-medium text-[#260047]">
                Secure Access
              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}
