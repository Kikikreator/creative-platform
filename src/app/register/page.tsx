
"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IndonesiaRegionSelect from "@/components/forms/indonesia-region-select";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [province, setProvince] = useState("");
  const [regency, setRegency] = useState("");
  const [acquisitionSource, setAcquisitionSource] = useState("");
  const [registrationReason, setRegistrationReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [courseId, setCourseId] = useState<string | null>(
    null
  );
  const [mentorInvite, setMentorInvite] = useState<string | null>(null);
  const [alumniFlow, setAlumniFlow] = useState(false);
  const [alumniNextPath, setAlumniNextPath] = useState("/akses-alumni");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [successHref, setSuccessHref] = useState("/login");
  const [successLabel, setSuccessLabel] = useState(
    "Lanjut ke Login"
  );

  // ================================================
  // CHECK SESSION DAN COURSE
  // ================================================

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const params = new URLSearchParams(
        window.location.search
      );

      const selectedCourseId = params.get("course");
      const mentorInviteToken = params.get("mentor_invite");
      const requestedNextPath = params.get("next") ?? params.get("redirect");
      const isSafeNextPath = Boolean(
        requestedNextPath &&
        requestedNextPath.startsWith("/") &&
        !requestedNextPath.startsWith("//") &&
        !requestedNextPath.includes("\\") &&
        !requestedNextPath.startsWith("/login") &&
        !requestedNextPath.startsWith("/register")
      );
      const nextPath = isSafeNextPath && requestedNextPath ? requestedNextPath : "/akses-alumni";
      const isAlumniFlow = params.get("flow") === "alumni" || (isSafeNextPath && nextPath === "/akses-alumni");

      setCourseId(selectedCourseId);
      setMentorInvite(mentorInviteToken);
      setAlumniFlow(isAlumniFlow);
      setAlumniNextPath(nextPath);

      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (user && mentorInviteToken) {
          const { data: existingRoleRows, error: existingRoleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (existingRoleError) {
            setError("Hak akses akun belum dapat diverifikasi. Silakan coba kembali.");
            setCheckingSession(false);
            return;
          }

          const existingPrimaryRole = getPrimaryRole(normalizeRoles(existingRoleRows));
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
            { p_token: mentorInviteToken },
          );
          if (inviteError) {
            setError(inviteError.message);
            setCheckingSession(false);
            return;
          }

          router.replace("/mentor");
          router.refresh();
          return;
        }

        if (user) {
          const { data: roleRows, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (roleError) {
            setError("Hak akses akun belum dapat diverifikasi. Silakan coba kembali.");
            setCheckingSession(false);
            return;
          }

          const primaryRole = getPrimaryRole(normalizeRoles(roleRows));
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
          if (primaryRole === "member") {
            router.replace(
              isAlumniFlow
                ? nextPath
                : selectedCourseId
                  ? `/checkout?course=${encodeURIComponent(selectedCourseId)}`
                  : "/dashboard",
            );
            router.refresh();
            return;
          }

          setError("Akun ini belum memiliki hak akses yang valid. Hubungi Admin.");
          setCheckingSession(false);
          return;
        }
      } catch (err) {
        console.error(
          "Gagal memeriksa sesi pengguna:",
          err
        );
      }

      if (!cancelled) {
        setCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loginHref = alumniFlow
    ? `/login?next=${encodeURIComponent(alumniNextPath)}`
    : courseId
      ? `/login?course=${encodeURIComponent(courseId)}`
      : "/login";

  // ================================================
  // REGISTER
  // ================================================

  async function handleRegister(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedWhatsapp = whatsappNumber.replace(/[^0-9+]/g, "");
    const address = province && regency ? `${regency}, ${province}` : "";

    if (province && !regency) {
      setError("Pilih kabupaten/kota sesuai provinsi yang dipilih.");
      return;
    }

    if (name.length < 3) {
      setError("Nama lengkap minimal 3 karakter.");
      return;
    }

    if (normalizedWhatsapp.replace(/\D/g, "").length < 9) {
      setError("Nomor WhatsApp harus berisi minimal 9 angka.");
      return;
    }

    if (!mentorInvite && !alumniFlow && !acquisitionSource) {
      setError("Pilih dari mana kamu mengetahui Kiki Creator Class.");
      return;
    }

    if (!mentorInvite && !alumniFlow && !registrationReason) {
      setError("Pilih alasan kamu mengikuti kelas.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: registerError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: alumniFlow
              ? `${window.location.origin}/login?next=${encodeURIComponent(alumniNextPath)}`
              : undefined,
            data: {
              full_name: name,
              phone: normalizedWhatsapp,
              whatsapp_number: normalizedWhatsapp,
              address: address.trim(),
              acquisition_source: mentorInvite ? null : alumniFlow ? "Lainnya" : acquisitionSource,
              registration_reason: mentorInvite ? null : alumniFlow ? "Lainnya" : registrationReason,
            },
          },
        });

      if (registerError) {
        throw registerError;
      }

      if (!data.user) {
        throw new Error(
          "Registrasi gagal. Silakan coba kembali."
        );
      }

      if (mentorInvite && data.session) {
        const { error: inviteError } = await supabase.rpc(
          "accept_mentor_invitation",
          { p_token: mentorInvite },
        );
        if (inviteError) throw inviteError;
      }

      // Simpan profil melalui mekanisme registrasi Peserta juga untuk alumni.
      // Field sumber dan tujuan belajar tidak ditanyakan pada alur alumni,
      // sehingga keduanya dicatat sebagai "Lainnya".
      if (data.session && !mentorInvite) {
        const { error: profileSaveError } = await supabase.rpc(
          "save_member_registration_details",
          {
            p_full_name: name,
            p_whatsapp_number: normalizedWhatsapp,
            p_address: address.trim() || null,
            p_acquisition_source: alumniFlow ? "Lainnya" : acquisitionSource,
            p_registration_reason: alumniFlow ? "Lainnya" : registrationReason,
          },
        );
        if (profileSaveError) {
          console.warn("Data pendaftaran belum tersinkron ke profil:", profileSaveError.message);
        }
      }

      let nextHref = mentorInvite
        ? `/login?mentor_invite=${encodeURIComponent(mentorInvite)}`
        : loginHref;
      let nextLabel = alumniFlow ? "Login setelah verifikasi" : "Lanjut ke Login";

      if (data.session) {
        if (mentorInvite) {
          nextHref = "/mentor";
          nextLabel = "Masuk ke Mentor Workspace";
        } else if (alumniFlow) {
          nextHref = alumniNextPath;
          nextLabel = "Lanjutkan aktivasi alumni";
        } else if (courseId) {
          nextHref =
            `/checkout?course=${encodeURIComponent(
              courseId
            )}`;

          nextLabel = "Lanjut ke Pembayaran";
        } else {
          nextHref = "/kelas";
          nextLabel = "Lanjut ke Kelas";
        }
      }

      setSuccessHref(nextHref);
      setSuccessLabel(nextLabel);

      setSuccess(
        mentorInvite
          ? data.session
            ? "Akun berhasil dibuat dan undangan Mentor telah diterima. Kamu dapat masuk ke Mentor Workspace."
            : "Akun berhasil dibuat. Konfirmasi email terlebih dahulu, lalu login melalui tautan undangan untuk mengaktifkan role Mentor."
          : alumniFlow
            ? data.session
              ? "Akun alumni berhasil dibuat. Lanjutkan ke halaman Akses Alumni, lalu tekan Aktifkan Akses Gratis. Kamu tidak perlu checkout atau membeli kelas lagi."
              : "Akun alumni berhasil dibuat. Buka email dan klik tautan verifikasi dari Kiki Creator Class. Setelah email terverifikasi, kembali ke halaman Akses Alumni dan login menggunakan email yang sama dengan pengajuan. Kemudian tekan Aktifkan Akses Gratis. Kamu tidak perlu checkout atau membeli kelas lagi."
            : data.session
              ? "Akun berhasil dibuat dan sudah aktif. Kamu bisa melanjutkan ke pembayaran kelas."
              : "Akun berhasil dibuat. Silakan periksa email untuk melakukan konfirmasi akun jika diminta. Setelah itu, kamu dapat masuk menggunakan akunmu."
      );

      setFullName("");
      setEmail("");
      setWhatsappNumber("");
      setProvince("");
      setRegency("");
      setAcquisitionSource("");
      setRegistrationReason("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membuat akun."
      );
    } finally {
      setLoading(false);
    }
  }

  // ================================================
  // STYLES
  // ================================================

  const inputClass =
    "w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400";

  const fieldClass =
    "flex h-12 items-center gap-3 rounded-xl border border-[#EEE7FF] bg-[#FFFFFF] px-3.5 transition focus-within:border-[#6D28D9] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#6D28D9]/10";

  // ================================================
  // SESSION CHECKING
  // ================================================

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FC] px-4">
        <div className="flex items-center gap-3 text-[#5B21B6]">
          <Loader2 size={21} className="animate-spin" />

          <span className="text-sm font-semibold">
            Memeriksa akun...
          </span>
        </div>
      </main>
    );
  }

  // ================================================
  // REGISTER PAGE
  // ================================================

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F6FC] px-4 py-8 sm:px-6">

      {/* BACKGROUND */}

      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#E3D8FF]/40 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#D0BCFF]/40 blur-3xl" />

      {/* REGISTER CARD */}

      <div className="relative z-10 w-full max-w-[460px] rounded-[26px] border border-[#EEEAF7] bg-white p-6 shadow-[0_16px_55px_rgba(76,29,149,0.09)] sm:p-9">

        {/* BRAND */}

        <Link
          href="/"
          className="mb-8 flex items-center gap-3"
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

            <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#6D28D9]">
              Learn · Create · Grow
            </p>
          </div>
        </Link>

        {/* HEADING */}

        <div className="mb-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
            <UserRound size={20} />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6D28D9]">
            {mentorInvite ? "MENTOR INVITATION" : alumniFlow ? "ALUMNI ACCESS" : "MEMBER REGISTRATION"}
          </p>

          <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-[#211A37]">
            {mentorInvite ? "Aktifkan akun Mentor" : alumniFlow ? "Buat akun untuk akses alumni" : "Buat akun baru"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mentorInvite
              ? "Lengkapi identitas dasar untuk mengaktifkan akses Mentor Workspace. Akun ini akan digunakan untuk mengelola kelas dan membimbing peserta."
              : alumniFlow
                ? "Gunakan email yang sama dengan pengajuan alumni. Setelah email diverifikasi, kamu bisa mengaktifkan kelas yang sudah disetujui Admin tanpa melakukan pembayaran ulang."
                : "Daftar dan mulai perjalanan belajarmu bersama Kiki Creator Class."}
          </p>
        </div>

        {/* SUCCESS */}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={23} />
            </div>

            <h2 className="font-bold text-emerald-900">
              Registrasi berhasil!
            </h2>

            <p className="mt-2 text-sm leading-6 text-emerald-800">
              {success}
            </p>

            <Link
              href={successHref}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] py-3.5 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
            >
              {successLabel}
              <ArrowRight size={16} />
            </Link>

          </div>
        ) : (

          <form
            onSubmit={handleRegister}
            className="space-y-4"
          >

            {/* NAME */}

            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-xs font-semibold text-[#2A2042]"
              >
                Nama lengkap
              </label>

              <div className={fieldClass}>
                <UserRound
                  size={18}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="fullName"
                  type="text"
                  required
                  minLength={3}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  placeholder="Masukkan nama lengkap"
                  className={inputClass}
                />
              </div>
            </div>

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold text-[#2A2042]"
              >
                Alamat email
              </label>

              <div className={fieldClass}>
                <Mail
                  size={18}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="nama@email.com"
                  className={inputClass}
                />
              </div>
            </div>

            {/* WHATSAPP */}
            <div>
              <label
                htmlFor="whatsappNumber"
                className="mb-2 block text-xs font-semibold text-[#2A2042]"
              >
                Nomor WhatsApp aktif
              </label>
              <div className={fieldClass}>
                <Phone size={18} className="shrink-0 text-slate-400" />
                <input
                  id="whatsappNumber"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className={inputClass}
                />
              </div>
            </div>

            {/* ASAL DAERAH */}
            <div>
              <div className="mb-2">
                <p className="text-xs font-semibold text-[#2A2042]">
                  Asal daerah
                  <span className="ml-1 font-normal text-slate-400">(opsional)</span>
                </p>
              </div>
              <IndonesiaRegionSelect
                province={province}
                regency={regency}
                onProvinceChange={setProvince}
                onRegencyChange={setRegency}
                labelClassName="mb-1.5 block text-xs font-medium text-[#2A2042]"
                fieldClassName={fieldClass}
                selectClassName={`${inputClass} h-full flex-1 appearance-none`}
                iconClassName="shrink-0 text-slate-400"
                helperClassName="mt-1.5 text-[11px] leading-5 text-slate-500"
                withIcon
              />
            </div>

            {!mentorInvite && !alumniFlow && (
              <>
                {/* ACQUISITION SOURCE - KHUSUS PESERTA */}
                <div>
                  <label
                    htmlFor="acquisitionSource"
                    className="mb-2 block text-xs font-semibold text-[#2A2042]"
                  >
                    Mengetahui Kiki Creator Class dari mana?
                  </label>
                  <select
                    id="acquisitionSource"
                    required
                    value={acquisitionSource}
                    onChange={(e) => setAcquisitionSource(e.target.value)}
                    className="h-12 w-full px-3.5 text-sm text-slate-700 outline-none transition focus:ring-4 focus:ring-[#51436f]/10"
                  >
                    <option value="">Pilih sumber informasi</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="YouTube">YouTube</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Teman atau keluarga">Teman atau keluarga</option>
                    <option value="Google atau mesin pencari">Google atau mesin pencari</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* REGISTRATION REASON - KHUSUS PESERTA */}
                <div>
                  <label
                    htmlFor="registrationReason"
                    className="mb-2 block text-xs font-semibold text-[#2A2042]"
                  >
                    Apa tujuan kamu mengikuti kelas?
                  </label>
                  <select
                    id="registrationReason"
                    required
                    value={registrationReason}
                    onChange={(e) => setRegistrationReason(e.target.value)}
                    className="h-12 w-full px-3.5 text-sm text-slate-700 outline-none transition focus:ring-4 focus:ring-[#51436f]/10"
                  >
                    <option value="">Pilih tujuan belajar</option>
                    <option value="Belajar dari dasar">Belajar dari dasar</option>
                    <option value="Meningkatkan keterampilan">Meningkatkan keterampilan</option>
                    <option value="Membangun portofolio">Membangun portofolio</option>
                    <option value="Kebutuhan pekerjaan atau usaha">Kebutuhan pekerjaan atau usaha</option>
                    <option value="Persiapan karier atau freelance">Persiapan karier atau freelance</option>
                    <option value="Mengembangkan bisnis atau brand">Mengembangkan bisnis atau brand</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </>
            )}

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold text-[#2A2042]"
              >
                Password
              </label>

              <div className={fieldClass}>
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Minimal 8 karakter"
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  className="shrink-0 text-slate-400 transition hover:text-[#6D28D9]"
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-xs font-semibold text-[#2A2042]"
              >
                Konfirmasi password
              </label>

              <div className={fieldClass}>
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Ulangi password"
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm((prev) => !prev)
                  }
                  className="shrink-0 text-slate-400 transition hover:text-[#6D28D9]"
                  aria-label={
                    showConfirm
                      ? "Sembunyikan konfirmasi password"
                      : "Tampilkan konfirmasi password"
                  }
                >
                  {showConfirm ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600"
              >
                {error}
              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] text-sm font-bold text-white shadow-[0_5px_14px_rgba(109,40,217,0.18)] transition hover:bg-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Membuat akun...
                </>
              ) : (
                <>
                  {mentorInvite ? "Aktifkan Akun Mentor" : alumniFlow ? "Buat Akun Alumni" : "Daftar Sekarang"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>

          </form>
        )}

        {/* FOOTER */}

        <div className="mt-7 border-t border-[#F5F1FC] pt-5">

          <p className="text-center text-sm text-slate-500">
            Sudah punya akun?{" "}
            <Link
              href={loginHref}
              className="font-bold text-[#6D28D9] hover:text-[#5B21B6]"
            >
              Masuk di sini
            </Link>
          </p>

          <div className="mt-5 text-center text-[10px] text-slate-400">
            © {new Date().getFullYear()} Kiki Creator Class
          </div>

        </div>

      </div>
    </main>
  );
}
