"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Save,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";

export type MentorProfileData = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  education: string | null;
  experience: string | null;
  portfolio_url: string | null;
  photo_url: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  approval_status: "draft" | "pending" | "approved" | "revision_requested";
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "block text-[11px] font-bold text-slate-700";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}
function statusText(status: MentorProfileData["approval_status"] | undefined) {
  if (status === "approved") return "Disetujui Admin";
  if (status === "pending") return "Menunggu pemeriksaan";
  if (status === "revision_requested") return "Perlu perbaikan";
  return "Draft";
}

export default function MentorProfileManager({
  userId,
  email,
  fullName,
  avatarUrl,
  initialProfile,
  initialError,
}: {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  initialProfile: MentorProfileData | null;
  initialError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<MentorProfileData | null>(initialProfile);
  const [headline, setHeadline] = useState(initialProfile?.headline ?? "");
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [expertise, setExpertise] = useState((initialProfile?.expertise ?? []).join(", "));
  const [education, setEducation] = useState(initialProfile?.education ?? "");
  const [experience, setExperience] = useState(initialProfile?.experience ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initialProfile?.portfolio_url ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialProfile?.photo_url ?? avatarUrl ?? "");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function uploadCv() {
    if (!cvFile) return profile?.cv_path ?? null;
    if (cvFile.type !== "application/pdf" && !cvFile.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("CV harus berupa file PDF.");
    }
    if (cvFile.size > 10 * 1024 * 1024) {
      throw new Error("Ukuran CV maksimal 10 MB.");
    }
    const safeName = cvFile.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    const path = `${userId}/cv/${randomId}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("mentor-private").upload(path, cvFile, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    return path;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      for (const [label, value] of [["Foto profil", photoUrl], ["Portofolio", portfolioUrl]] as const) {
        if (!value.trim()) continue;
        const parsed = new URL(value.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error(`${label} harus menggunakan URL http atau https.`);
        }
      }

      let cvPath = profile?.cv_path ?? null;
      if (cvFile) cvPath = await uploadCv();
      const payload = {
        user_id: userId,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        expertise: expertise.split(",").map((item) => item.trim()).filter(Boolean),
        education: education.trim() || null,
        experience: experience.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        photo_url: photoUrl.trim() || null,
        cv_path: cvPath,
        cv_file_name: cvFile?.name ?? profile?.cv_file_name ?? null,
        approval_status: "draft",
        admin_note: null,
        updated_at: new Date().toISOString(),
      };
      const { data, error: dbError } = await supabase
        .from("mentor_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
      if (dbError) throw dbError;
      setProfile(data as MentorProfileData);
      setCvFile(null);
      setNotice("Profil berhasil disimpan sebagai draft. Ajukan ke Admin jika sudah siap ditampilkan.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("submit_mentor_profile_for_review");
      if (rpcError) throw rpcError;
      setProfile((current) => current ? { ...current, approval_status: "pending", admin_note: null } : current);
      setNotice("Profil berhasil diajukan untuk diperiksa Admin.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function openCv() {
    if (!profile?.cv_path) return;
    const { data, error: signedError } = await supabase.storage.from("mentor-private").createSignedUrl(profile.cv_path, 10 * 60);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? "CV belum dapat dibuka.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const isPending = profile?.approval_status === "pending";
  const statusTone = profile?.approval_status === "approved"
    ? "bg-emerald-50 text-emerald-700"
    : profile?.approval_status === "pending"
      ? "bg-blue-50 text-blue-700"
      : profile?.approval_status === "revision_requested"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Professional identity</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Profil Pengajar</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Lengkapi profil profesional agar peserta mengenal pengajar yang membimbing kelas mereka. Profil publik hanya ditampilkan setelah disetujui Admin.</p></div>
          <span className={`inline-flex h-9 items-center gap-2 self-start rounded-full px-3 text-[10px] font-extrabold ${statusTone}`}><ShieldCheck size={13} /> {statusText(profile?.approval_status)}</span>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} />{notice}</div>}
      {profile?.admin_note && profile.approval_status === "revision_requested" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-extrabold text-amber-900">Catatan perbaikan dari Admin</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-amber-800">{profile.admin_note}</p></div>}

      <form onSubmit={saveProfile} className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><GraduationCap size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Identitas profesional</h3></div><p className="mt-1 text-[10px] text-slate-500">Informasi dasar akun diambil dari profil Kiki Creator Class.</p></div>
        <div className="grid gap-5 p-5 lg:grid-cols-[220px_1fr] sm:p-6">
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[22px] border border-slate-100 bg-gradient-to-br from-violet-50 to-violet-100 text-4xl font-extrabold text-violet-700">
              {photoUrl ? <img src={photoUrl} alt="Foto profil Mentor" className="h-full w-full object-cover" /> : fullName.trim().charAt(0).toUpperCase() || "M"}
            </div>
            <label className={labelClass}>URL foto profil<input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} className={inputClass} placeholder="https://..." /></label>
            <p className="text-[9px] leading-4 text-slate-400">Gunakan URL foto yang dapat diakses publik. Foto tidak diunggah ke penyimpanan privat CV.</p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Nama lengkap<input disabled value={fullName || "Nama belum diatur"} className={`${inputClass} bg-slate-50 text-slate-500`} /></label>
              <label className={labelClass}>Email akun<input disabled value={email} className={`${inputClass} bg-slate-50 text-slate-500`} /></label>
            </div>
            <label className={labelClass}>Headline / Jabatan pengajar<input maxLength={180} value={headline} onChange={(event) => setHeadline(event.target.value)} className={inputClass} placeholder="Contoh: Graphic Designer & Creative Educator" /></label>
            <label className={labelClass}>Tentang saya<textarea rows={4} maxLength={3000} value={bio} onChange={(event) => setBio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-6 outline-none focus:border-violet-500" placeholder="Ceritakan latar belakang, pendekatan mengajar, dan pengalaman profesional." /></label>
            <label className={labelClass}>Keahlian (pisahkan dengan koma)<input value={expertise} onChange={(event) => setExpertise(event.target.value)} className={inputClass} placeholder="CorelDRAW, Branding, Ilustrasi, ..." /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Pendidikan<textarea rows={3} value={education} onChange={(event) => setEducation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs outline-none focus:border-violet-500" placeholder="Riwayat pendidikan dan sertifikasi." /></label>
              <label className={labelClass}>Pengalaman<textarea rows={3} value={experience} onChange={(event) => setExperience(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs outline-none focus:border-violet-500" placeholder="Pengalaman kerja, proyek, dan pengalaman mengajar." /></label>
            </div>
            <label className={labelClass}>Portofolio / Website<input type="url" value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} className={inputClass} placeholder="https://..." /></label>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800"><FileText size={15} className="text-violet-700" /> Curriculum Vitae</div>
              <p className="mt-1 text-[10px] text-slate-500">Unggah CV PDF maksimal 10 MB. File disimpan secara privat.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50"><Upload size={14} /> Pilih CV PDF<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setCvFile(event.target.files?.[0] ?? null)} /></label>
                <span className="min-w-0 truncate text-[10px] text-slate-500">{cvFile?.name ?? profile?.cv_file_name ?? "Belum ada CV"}</span>
                {profile?.cv_path && <button type="button" onClick={() => void openCv()} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-violet-700 hover:bg-violet-50">Lihat CV <ExternalLink size={12} /></button>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:px-6">
          <p className="text-[9px] leading-5 text-slate-400">Status saat ini: {statusText(profile?.approval_status)}. Menyimpan perubahan akan mengembalikan profil ke draft.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-700 disabled:opacity-50"><Save size={13} /> {saving ? "Menyimpan..." : "Simpan Draft"}</button>
            <button type="button" disabled={saving || isPending || !profile} onClick={() => void submitForReview()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white hover:bg-violet-800 disabled:opacity-40"><Send size={13} /> Ajukan ke Admin</button>
          </div>
        </div>
      </form>
    </div>
  );
}
