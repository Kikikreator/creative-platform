"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileImage,
  GraduationCap,
  ImagePlus,
  Loader2,
  MapPin,
  Megaphone,
  RefreshCw,
  Send,
  Target,
  ShieldCheck,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AlumniCourseOption = {
  id: string;
  title: string;
  slug: string;
};

type AlumniRequestStatus = {
  request_id: string;
  full_name: string;
  email: string;
  whatsapp_number: string;
  course_id: string;
  course_title: string;
  status: "pending" | "approved" | "rejected" | "claimed" | "expired" | string;
  admin_note: string | null;
  expires_at: string | null;
  claimed_at: string | null;
};

type ClaimResult = {
  request_id: string;
  course_id: string;
  course_title: string;
  outcome: "granted" | "already_active" | string;
};

type Props = {
  courses: AlumniCourseOption[];
  courseLoadError: string | null;
  initialName: string;
  initialEmail: string;
  isSignedIn: boolean;
  canClaim: boolean;
  roleCheckError: boolean;
  accountRole: string | null;
  adminWhatsapp: string;
};

const REQUEST_STORAGE_KEY = "kiki_creator_alumni_request_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-[#E7E0EB] bg-white px-3.5 py-2.5 text-sm leading-5 text-[#30243A] outline-none transition placeholder:text-[#756B7C] placeholder:opacity-100 focus:border-[#6B3B88] focus:ring-4 focus:ring-[#260047]/10";

function getRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return data ? [data as T] : [];
}


export default function AlumniRequestForm({
  courses,
  courseLoadError,
  initialName,
  initialEmail,
  isSignedIn,
  canClaim,
  roleCheckError,
  accountRole,
  adminWhatsapp,
}: Props) {
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [acquisitionSource, setAcquisitionSource] = useState("");
  const [registrationReason, setRegistrationReason] = useState("");
  const [courseId, setCourseId] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [requestStatus, setRequestStatus] = useState<AlumniRequestStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [showCreateAccountInfo, setShowCreateAccountInfo] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function fetchRequestStatus(id: string) {
    setStatusLoading(true);
    setStatusError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_alumni_access_request_status", {
        p_request_id: id,
      });
      if (error) throw new Error(error.message);
      const row = getRows<AlumniRequestStatus>(data)[0];
      if (!row) throw new Error("Data pengajuan tidak ditemukan. Pastikan tautan alumni yang dibuka benar.");
      setRequestStatus(row);
      setRequestId(id);
      localStorage.setItem(REQUEST_STORAGE_KEY, id);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Status pengajuan belum dapat diperiksa.");
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRequestId = params.get("request");
    const savedRequestId = localStorage.getItem(REQUEST_STORAGE_KEY);
    const id = urlRequestId && UUID_PATTERN.test(urlRequestId)
      ? urlRequestId
      : savedRequestId && UUID_PATTERN.test(savedRequestId)
        ? savedRequestId
        : "";

    if (!id) {
      setStatusLoading(false);
      return;
    }
    if (urlRequestId !== id) {
      const url = new URL(window.location.href);
      url.searchParams.set("request", id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
    void fetchRequestStatus(id);
    // Initial lookup only; refresh is user-triggered afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProofFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSubmitError("");
    if (!file) {
      setProofFile(null);
      return;
    }
    if (!ALLOWED_PROOF_TYPES.has(file.type)) {
      setProofFile(null);
      event.target.value = "";
      setSubmitError("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > MAX_PROOF_FILE_SIZE) {
      setProofFile(null);
      event.target.value = "";
      setSubmitError("Ukuran foto maksimal 5 MB.");
      return;
    }
    setProofFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError("");

    if (website.trim()) return;

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedWhatsapp = whatsapp.replace(/[^0-9+]/g, "");

    if (normalizedName.length < 3) return setSubmitError("Nama lengkap minimal 3 karakter.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setSubmitError("Masukkan alamat email yang valid.");
    if (normalizedWhatsapp.replace(/\D/g, "").length < 9) return setSubmitError("Nomor WhatsApp minimal 9 angka.");
    if (address.trim().length < 3) return setSubmitError("Isi asal daerah minimal 3 karakter.");
    if (!acquisitionSource) return setSubmitError("Pilih dari mana kamu mengetahui Kiki Creator Class.");
    if (!registrationReason) return setSubmitError("Pilih tujuan kamu mengikuti kelas.");
    if (!courseId) return setSubmitError("Pilih kelas yang pernah kamu ikuti.");
    if (!proofFile && !proofNote.trim()) return setSubmitError("Unggah foto bukti atau tulis keterangan keikutsertaanmu.");

    setSubmitting(true);
    try {
      const supabase = createClient();
      let evidencePath: string | null = null;

      if (proofFile) {
        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = extensionByType[proofFile.type];
        evidencePath = `intake/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("alumni-evidence")
          .upload(evidencePath, proofFile, {
            cacheControl: "3600",
            contentType: proofFile.type,
            upsert: false,
          });
        if (uploadError) throw new Error(`Foto bukti gagal diunggah: ${uploadError.message}`);
      }

      const { data, error } = await supabase.rpc("submit_alumni_access_request_with_survey", {
        p_full_name: normalizedName,
        p_email: normalizedEmail,
        p_whatsapp_number: normalizedWhatsapp,
        p_course_id: courseId,
        p_proof_note: proofNote.trim() || null,
        p_evidence_path: evidencePath,
        p_address: address.trim(),
        p_acquisition_source: acquisitionSource,
        p_registration_reason: registrationReason,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("duplicate") || message.includes("already")) {
          throw new Error("Pengajuan untuk email dan kelas tersebut sudah pernah dikirim. Gunakan tautan pengajuan sebelumnya untuk memeriksa statusnya.");
        }
        if (message.includes("rate") || message.includes("limit")) {
          throw new Error("Pengajuan dari email ini sudah mencapai batas harian. Silakan coba kembali besok.");
        }
        throw new Error(error.message);
      }

      const id = String(data ?? "");
      if (!UUID_PATTERN.test(id)) throw new Error("Pengajuan terkirim, tetapi nomor pengajuan tidak terbaca. Simpan email yang digunakan dan hubungi Admin.");

      const selectedCourse = courses.find((course) => course.id === courseId);
      const optimisticRequest: AlumniRequestStatus = {
        request_id: id,
        full_name: normalizedName,
        email: normalizedEmail,
        whatsapp_number: normalizedWhatsapp,
        course_id: courseId,
        course_title: selectedCourse?.title ?? "Kelas pilihan",
        status: "pending",
        admin_note: null,
        expires_at: null,
        claimed_at: null,
      };

      localStorage.setItem(REQUEST_STORAGE_KEY, id);
      setRequestId(id);
      setRequestStatus(optimisticRequest);
      
      setWhatsapp("");
      setAddress("");
      setAcquisitionSource("");
      setRegistrationReason("");
      setProofNote("");
      setProofFile(null);
      if (proofFileInputRef.current) proofFileInputRef.current.value = "";
      const url = new URL(window.location.href);
      url.searchParams.set("request", id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Pengajuan belum berhasil dikirim. Silakan coba kembali.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    setClaimError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_my_alumni_access");
      if (error) throw new Error(error.message);
      const results = getRows<ClaimResult>(data);
      if (!results.length) throw new Error("Belum ada persetujuan yang siap diaktifkan. Pastikan email akun sama dengan email pengajuan dan Admin sudah menyetujui.");
      setRequestStatus((current) => current ? { ...current, status: "claimed", claimed_at: new Date().toISOString() } : current);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Akses alumni belum dapat diaktifkan. Silakan coba kembali.");
    } finally {
      setClaiming(false);
    }
  }

  async function handleSignOutForCorrectEmail() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setClaimError(error.message);
      return;
    }
    window.location.href = `/akses-alumni?request=${encodeURIComponent(requestId)}`;
  }

  function handleContactAdmin() {
    if (!requestStatus) return;
    const phone = adminWhatsapp.replace(/\D/g, "");
    const message = [
      "Halo Admin Kiki Creator Class, saya ingin meminta bantuan terkait akses alumni.",
      "",
      `Nama: ${requestStatus.full_name}`,
      `Email: ${requestStatus.email}`,
      `Kelas: ${requestStatus.course_title}`,
      `Nomor pengajuan: ${requestStatus.request_id}`,
      "",
      "Mohon bantu periksa status pengajuan saya. Terima kasih.",
    ].join("\n");
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    } else {
      void navigator.clipboard.writeText(message).then(
        () => setFeedback("Pesan untuk Admin sudah disalin. Tempelkan ke WhatsApp Admin."),
        () => setFeedback(message),
      );
    }
  }

  function clearRequestAndStartAgain() {
    localStorage.removeItem(REQUEST_STORAGE_KEY);
    window.history.replaceState({}, "", "/akses-alumni");
    setRequestId("");
    setRequestStatus(null);
    setStatusError("");
    
    setClaimError("");
    setFeedback("");
  }

  const registerHref = requestId
    ? `/akses-alumni/buat-akun?request=${encodeURIComponent(requestId)}`
    : "/akses-alumni";

  const currentEmailMatches = Boolean(
    requestStatus && initialEmail && initialEmail.trim().toLowerCase() === requestStatus.email.toLowerCase(),
  );
  const canActivate = Boolean(isSignedIn && currentEmailMatches && canClaim && !roleCheckError);

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-[#756A7D] transition hover:text-[#260047]">
        <ArrowRight size={14} className="rotate-180" /> Kembali ke beranda
      </Link>

      <section className="mt-5 overflow-hidden rounded-[26px] border border-[#EAE3EF] bg-white shadow-[0_18px_50px_rgba(38,0,71,.07)]">
        <div className="bg-[#260047] px-6 py-7 text-white sm:px-9 sm:py-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
            <GraduationCap size={25} />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.19em] text-white/65">Kiki Creator Class</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Akses Khusus Alumni</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
            Ajukan akses kembali ke kelas yang pernah kamu ikuti. Admin akan memeriksa data dan bukti keikutsertaan sebelum akses diberikan.
          </p>
        </div>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0">
            {statusLoading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-[#EAE3EF] bg-[#FCFAFD] text-sm text-[#62576D]">
                <Loader2 size={18} className="animate-spin" /> Memeriksa status pengajuan...
              </div>
            ) : statusError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <h2 className="text-base font-semibold text-rose-900">Status pengajuan belum dapat dibuka</h2>
                <p className="mt-2 text-sm leading-6 text-rose-800">{statusError}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {requestId && <button type="button" onClick={() => void fetchRequestStatus(requestId)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#260047] px-4 text-xs font-semibold text-white"><RefreshCw size={14} /> Coba lagi</button>}
                  <button type="button" onClick={clearRequestAndStartAgain} className="inline-flex min-h-10 items-center rounded-xl border border-rose-300 bg-white px-4 text-xs font-medium text-rose-800">Kembali ke formulir</button>
                </div>
              </div>
            ) : requestStatus ? (
              <div className="rounded-2xl border border-[#EAE3EF] bg-white p-5 sm:p-6">
                {requestStatus.status === "pending" && (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={22} /></div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-amber-700">Tahap 2 · Menunggu pemeriksaan</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#30243A]">Pengajuan berhasil dikirim</h2>
                    <p className="mt-2 text-sm leading-6 text-[#62576D]">
                      Terima kasih, {requestStatus.full_name}. Pengajuan untuk kelas <strong className="font-semibold text-[#30243A]">{requestStatus.course_title}</strong> sudah diterima. Admin sedang memeriksa bukti keikutsertaanmu.
                    </p>
                    <div className="mt-4 rounded-xl bg-[#F8F5FA] p-3.5 text-xs leading-5 text-[#62576D]">
                      <p><strong className="font-semibold text-[#40334B]">Email pengajuan:</strong> {requestStatus.email}</p>
                      <p className="mt-1"><strong className="font-semibold text-[#40334B]">Nomor pengajuan:</strong> <span className="break-all">{requestStatus.request_id}</span></p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#62576D]">
                      Untuk sekarang kamu belum perlu membuat akun. Setelah Admin menyetujui pengajuan, buka kembali tautan ini. Status persetujuan dan tombol <strong className="font-semibold text-[#40334B]">Buat Akun Alumni</strong> akan muncul di halaman ini.
                    </p>
                    <button type="button" onClick={handleContactAdmin} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white transition hover:bg-[#3A0A5E]">
                      <Send size={15} /> Konfirmasi ke Admin
                    </button>
                    <p className="mt-2 text-xs leading-5 text-[#756B7C]">
                      Pesan akan disiapkan dengan data pengajuanmu. Jika WhatsApp Admin belum terbuka, pesan akan disalin agar bisa kamu kirim secara manual.
                    </p>
                  </>
                )}

                {requestStatus.status === "approved" && (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={22} /></div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-700">Tahap 3 · Disetujui Admin</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#30243A]">Pengajuanmu sudah disetujui!</h2>
                    <p className="mt-2 text-sm leading-6 text-[#62576D]">
                      Akses alumni untuk kelas <strong className="font-semibold text-[#30243A]">{requestStatus.course_title}</strong> sudah disetujui. Selanjutnya buat akun menggunakan email yang sama dengan formulir pengajuan.
                    </p>
                    <div className="mt-4 rounded-xl bg-[#F8F5FA] p-3.5 text-xs leading-5 text-[#62576D]">
                      <p><strong className="font-semibold text-[#40334B]">Nama:</strong> {requestStatus.full_name}</p>
                      <p className="mt-1"><strong className="font-semibold text-[#40334B]">Email akun:</strong> {requestStatus.email}</p>
                      {requestStatus.expires_at && <p className="mt-1"><strong className="font-semibold text-[#40334B]">Batas aktivasi:</strong> {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(requestStatus.expires_at))}</p>}
                    </div>

                    {!isSignedIn ? (
                      <button type="button" onClick={() => setShowCreateAccountInfo(true)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white transition hover:bg-[#3A0A5E]">
                        Buat Akun Alumni <ArrowRight size={15} />
                      </button>
                    ) : !currentEmailMatches ? (
                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">Email akun berbeda dengan email pengajuan</p>
                        <p className="mt-1 text-xs leading-5 text-amber-800">Kamu sedang masuk sebagai {initialEmail}. Keluar terlebih dahulu, lalu gunakan akun dengan email {requestStatus.email}.</p>
                        <button type="button" onClick={handleSignOutForCorrectEmail} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#260047] px-3 text-xs font-semibold text-white">Keluar dan lanjutkan</button>
                      </div>
                    ) : roleCheckError ? (
                      <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800">Akun sudah masuk, tetapi hak akses Peserta belum dapat diperiksa. Silakan hubungi Admin.</p>
                    ) : accountRole === "admin" || accountRole === "instructor" ? (
                      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Akun yang sedang digunakan adalah akun {accountRole === "admin" ? "Admin" : "Mentor"}. Keluar dan gunakan akun Peserta dengan email pengajuan di atas.</p>
                    ) : canActivate ? (
                      <>
                        <p className="mt-4 text-sm leading-6 text-[#62576D]">Akun Peserta sudah siap. Tekan tombol berikut untuk memasukkan kelas gratis ke Kelas Saya.</p>
                        <button type="button" onClick={handleClaim} disabled={claiming} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                          {claiming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          {claiming ? "Mengaktifkan akses..." : "Aktifkan Akses Gratis"}
                        </button>
                        {claimError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-700">{claimError}</p>}
                      </>
                    ) : (
                      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Akun ini belum dikenali sebagai akun Peserta. Jangan membuat akun kedua. Hubungi Admin untuk pemeriksaan.</p>
                    )}
                  </>
                )}

                {requestStatus.status === "claimed" && (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={22} /></div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-700">Tahap 5 · Selesai</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#30243A]">Kelas sudah aktif di akunmu</h2>
                    <p className="mt-2 text-sm leading-6 text-[#62576D]">Kamu tidak perlu membeli kelas atau melakukan checkout lagi. Masuk ke halaman Peserta untuk mulai belajar.</p>
                    <Link href="/dashboard" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white">Masuk ke Kelas Saya <ArrowRight size={15} /></Link>
                  </>
                )}

                {requestStatus.status === "rejected" && (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><X size={22} /></div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-rose-700">Pengajuan belum disetujui</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#30243A]">Admin belum dapat menyetujui pengajuan ini</h2>
                    <p className="mt-2 text-sm leading-6 text-[#62576D]">{requestStatus.admin_note || "Silakan hubungi Admin untuk mengetahui informasi lebih lanjut atau melengkapi bukti keikutsertaan."}</p>
                    {adminWhatsapp && <button type="button" onClick={handleContactAdmin} className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#260047] px-4 text-xs font-semibold text-white">Hubungi Admin</button>}
                    <button type="button" onClick={clearRequestAndStartAgain} className="mt-5 ml-2 inline-flex min-h-10 items-center rounded-xl border border-[#DED4E6] px-4 text-xs font-medium text-[#51465D]">Kembali ke formulir</button>
                  </>
                )}

                {requestStatus.status === "expired" && (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={22} /></div>
                    <h2 className="mt-4 text-lg font-semibold text-[#30243A]">Waktu aktivasi sudah berakhir</h2>
                    <p className="mt-2 text-sm leading-6 text-[#62576D]">Persetujuan alumni untuk kelas ini sudah melewati batas aktivasi. Hubungi Admin untuk meminta bantuan atau mengajukan kembali.</p>
                    {adminWhatsapp && <button type="button" onClick={handleContactAdmin} className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#260047] px-4 text-xs font-semibold text-white">Hubungi Admin</button>}
                    <button type="button" onClick={clearRequestAndStartAgain} className="mt-5 ml-2 inline-flex min-h-10 items-center rounded-xl border border-[#DED4E6] px-4 text-xs font-medium text-[#51465D]">Ajukan kembali</button>
                  </>
                )}

                {claimError && requestStatus.status !== "approved" && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-700">{claimError}</p>}
                {feedback && <p className="mt-3 rounded-lg bg-[#F8F5FA] p-3 text-xs leading-5 text-[#51465D]">{feedback}</p>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="alumni-name" className="text-xs font-medium text-[#51465D]">Nama lengkap <span className="text-rose-500">*</span></label>
                  <input id="alumni-name" required minLength={3} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Masukkan nama lengkap" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="alumni-email" className="text-xs font-medium text-[#51465D]">Email aktif <span className="text-rose-500">*</span></label>
                  <input id="alumni-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" className={inputClass} />
                  <p className="mt-1.5 text-[11px] leading-5 text-[#756B7C]">Gunakan email yang masih bisa kamu buka. Email ini akan dipakai saat membuat akun alumni.</p>
                </div>
                <div>
                  <label htmlFor="alumni-whatsapp" className="text-xs font-medium text-[#51465D]">Nomor WhatsApp aktif <span className="text-rose-500">*</span></label>
                  <input id="alumni-whatsapp" type="tel" inputMode="tel" required minLength={9} maxLength={24} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xxxxxxxxxx" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="alumni-address" className="text-xs font-medium text-[#51465D]">Asal daerah <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8EA3]" />
                    <input id="alumni-address" type="text" required minLength={3} maxLength={180} autoComplete="address-level2" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Contoh: Gemolong, Sragen, Jawa Tengah" className={`${inputClass} pl-10`} />
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#756B7C]">Tuliskan kota/kabupaten dan provinsi tempat kamu tinggal.</p>
                </div>
                <div>
                  <label htmlFor="alumni-acquisition-source" className="text-xs font-medium text-[#51465D]">Mengetahui Kiki Creator Class dari mana? <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Megaphone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8EA3]" />
                    <select id="alumni-acquisition-source" required value={acquisitionSource} onChange={(event) => setAcquisitionSource(event.target.value)} className={`${inputClass} appearance-none pl-10`}>
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
                </div>
                <div>
                  <label htmlFor="alumni-registration-reason" className="text-xs font-medium text-[#51465D]">Apa tujuan kamu mengikuti kelas? <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Target size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8EA3]" />
                    <select id="alumni-registration-reason" required value={registrationReason} onChange={(event) => setRegistrationReason(event.target.value)} className={`${inputClass} appearance-none pl-10`}>
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
                </div>
                <div>
                  <label htmlFor="alumni-course" className="text-xs font-medium text-[#51465D]">Kelas yang pernah diikuti <span className="text-rose-500">*</span></label>
                  <select id="alumni-course" required value={courseId} onChange={(event) => setCourseId(event.target.value)} className={inputClass}>
                    <option value="">Pilih kelas</option>
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                  {courseLoadError && <p className="mt-1.5 text-[11px] text-rose-600">Daftar kelas belum dapat dimuat. Silakan coba lagi beberapa saat.</p>}
                  {!courseLoadError && courses.length === 0 && <p className="mt-1.5 text-[11px] text-amber-700">Belum ada kelas yang tersedia untuk pengajuan alumni.</p>}
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-xs font-medium text-[#51465D]">Bukti pernah mengikuti kelas <span className="text-rose-500">*</span></p>
                    <p className="mt-1 text-[11px] leading-5 text-[#756B7C]">Unggah foto/screenshot atau tulis keterangan. Minimal pilih salah satu.</p>
                  </div>
                  <div className="rounded-xl border border-dashed border-[#D9CFE1] bg-[#FCFAFD] p-3.5">
                    <input ref={proofFileInputRef} id="alumni-proof-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProofFileChange} className="sr-only" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#40334B]">Foto atau screenshot bukti</p>
                        <p className="mt-1 text-[11px] text-[#756B7C]">JPG, PNG, WEBP · Maksimal 5 MB</p>
                      </div>
                      <label htmlFor="alumni-proof-file" className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#DED4E6] bg-white px-3.5 text-xs font-semibold text-[#40334B] transition hover:bg-[#F7F3FA]"><ImagePlus size={15} /> {proofFile ? "Ganti foto" : "Pilih foto"}</label>
                    </div>
                    {proofFile && <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5"><span className="flex min-w-0 items-center gap-2 text-xs text-[#51465D]"><FileImage size={15} className="shrink-0 text-[#0B6254]" /><span className="truncate">{proofFile.name}</span></span><button type="button" onClick={() => { setProofFile(null); if (proofFileInputRef.current) proofFileInputRef.current.value = ""; }} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-rose-700 hover:bg-rose-50">Hapus</button></div>}
                  </div>
                  <div>
                    <label htmlFor="alumni-proof-note" className="text-xs font-medium text-[#51465D]">Atau tulis keterangan keikutsertaan</label>
                    <textarea id="alumni-proof-note" rows={3} maxLength={1000} value={proofNote} onChange={(event) => setProofNote(event.target.value)} placeholder="Contoh: nama akun lama, waktu mengikuti kelas, nomor transaksi, atau nama grup kelas." className={`${inputClass} min-h-24 resize-y`} />
                  </div>
                  <p className="text-[11px] leading-5 text-[#756B7C]">Bukti dapat berupa screenshot pembayaran, grup belajar, akses materi, atau sertifikat. Jangan kirim password maupun kode OTP.</p>
                </div>
                <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="alumni-website">Website</label><input id="alumni-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
                {submitError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-700">{submitError}</div>}
                <button type="submit" disabled={submitting || courses.length === 0 || Boolean(courseLoadError)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3A0A5E] disabled:cursor-not-allowed disabled:opacity-55">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? "Mengirim pengajuan..." : "Kirim Pengajuan Alumni"}
                </button>
              </form>
            )}
          </div>

          <aside>
            <div className="rounded-2xl border border-[#EAE3EF] bg-[#FCFAFD] p-4 sm:p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EAF5] text-[#260047]"><ClipboardList size={18} /></div>
              <h3 className="mt-3 text-sm font-semibold text-[#30243A]">Panduan proses alumni</h3>
              <ol className="mt-3 space-y-3.5 text-xs leading-5 text-[#62576D]">
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0EAF5] text-[10px] font-semibold text-[#260047]">1</span><span><strong className="font-semibold text-[#40334B]">Kirim pengajuan.</strong> Isi identitas, email aktif, kelas yang pernah diikuti, dan bukti keikutsertaan.</span></li>
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0EAF5] text-[10px] font-semibold text-[#260047]">2</span><span><strong className="font-semibold text-[#40334B]">Tunggu pemeriksaan.</strong> Admin akan mencocokkan data dan bukti. Kamu belum perlu membuat akun pada tahap ini.</span></li>
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0EAF5] text-[10px] font-semibold text-[#260047]">3</span><span><strong className="font-semibold text-[#40334B]">Tunggu persetujuan.</strong> Jika disetujui, tombol Buat Akun Alumni akan muncul pada halaman status pengajuan.</span></li>
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0EAF5] text-[10px] font-semibold text-[#260047]">4</span><span><strong className="font-semibold text-[#40334B]">Masuk ke akun Peserta.</strong> Setelah akun dibuat, sistem mencoba login otomatis dan mengembalikanmu ke halaman Akses Alumni.</span></li>
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0EAF5] text-[10px] font-semibold text-[#260047]">5</span><span><strong className="font-semibold text-[#40334B]">Aktifkan dan mulai belajar.</strong> Tekan Aktifkan Akses Gratis. Kelas masuk ke Kelas Saya tanpa pembayaran ulang.</span></li>
              </ol>
              <p className="mt-4 rounded-xl bg-white px-3 py-2.5 text-[11px] leading-5 text-[#756B7C]">Simpan tautan pengajuan setelah mengirim formulir. Admin juga akan mengirim tautan status pribadi saat pengajuan disetujui.</p>
            </div>
          </aside>
        </div>
      </section>

      {showCreateAccountInfo && requestStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#170027]/55 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="alumni-create-account-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EAF5] text-[#260047]"><ShieldCheck size={22} /></div>
            <h2 id="alumni-create-account-title" className="mt-4 text-lg font-semibold text-[#30243A]">Sebelum membuat akun</h2>
            <p className="mt-2 text-sm leading-6 text-[#62576D]">Akun akan dibuat menggunakan email <strong className="font-semibold text-[#30243A]">{requestStatus.email}</strong>. Pastikan email ini benar, aktif, dan milikmu.</p>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-[#62576D]">
              <li>1. Isi password pada halaman Buat Akun Alumni.</li>
              <li>2. Akun dibuat tanpa pengiriman email verifikasi. Kamu akan langsung masuk jika pembuatan akun berhasil.</li>
              <li>3. Kembali ke halaman Akses Alumni dan tekan Aktifkan Akses Gratis.</li>
              <li>4. Kelas masuk ke Kelas Saya tanpa pembayaran ulang.</li>
            </ol>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowCreateAccountInfo(false)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DED4E6] px-4 text-sm font-medium text-[#51465D]">Nanti</button>
              <Link href={registerHref} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-sm font-semibold text-white">Lanjut Buat Akun <ArrowRight size={15} /></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
