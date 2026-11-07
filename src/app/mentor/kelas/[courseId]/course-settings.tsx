"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  Save,
} from "lucide-react";

export type MentorCourseSettingsData = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  target_audience: string | null;
  benefits: string[] | null;
  status: string;
  price: number | string;
};

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "block text-[11px] font-bold text-slate-700";

export default function MentorCourseSettings({ course }: { course: MentorCourseSettingsData }) {
  const [shortDescription, setShortDescription] = useState(course.short_description ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(course.cover_image_url ?? "");
  const [category, setCategory] = useState(course.category ?? "");
  const [targetAudience, setTargetAudience] = useState(course.target_audience ?? "");
  const [benefits, setBenefits] = useState((course.benefits ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (coverImageUrl.trim()) {
      try {
        const parsed = new URL(coverImageUrl.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setError("URL cover harus menggunakan http atau https.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_assigned_course_learning_details", {
        p_course_id: course.id,
        p_short_description: shortDescription.trim() || null,
        p_description: description.trim() || null,
        p_cover_image_url: coverImageUrl.trim() || null,
        p_category: category.trim() || null,
        p_target_audience: targetAudience.trim() || null,
        p_benefits: benefits.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      if (rpcError) throw rpcError;
      setNotice("Pengaturan pembelajaran kelas berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan kelas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-sm sm:p-7">
        <Link href="/mentor/kelas" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-[9px] font-bold text-white hover:bg-white/20"><ArrowLeft size={12} /> Kembali ke Kelas Saya</Link>
        <p className="mt-5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Class learning settings</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{course.title}</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Atur presentasi dan informasi pembelajaran kelas yang kamu dampingi. Pengaturan komersial dan status publikasi tetap dikelola Admin.</p>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} />{notice}</div>}

      <form onSubmit={saveSettings} className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-extrabold text-slate-900">Informasi pembelajaran</h3><p className="mt-1 text-[10px] text-slate-500">Perubahan ini tidak mengubah harga, slug, status, atau hak akses kelas.</p></div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Nama kelas<input disabled value={course.title} className={`${inputClass} bg-slate-50 text-slate-500`} /></label>
            <label className={labelClass}>Kategori<input value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} placeholder="Contoh: Desain Grafis" /></label>
          </div>
          <label className={labelClass}>Deskripsi singkat<textarea rows={2} maxLength={500} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-violet-500" /></label>
          <label className={labelClass}>Deskripsi lengkap<textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-6 outline-none focus:border-violet-500" /></label>
          <label className={labelClass}>URL cover kelas<input type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} className={inputClass} placeholder="https://..." /></label>
          {coverImageUrl && <img src={coverImageUrl} alt="Pratinjau cover kelas" className="max-h-64 w-full rounded-2xl border border-slate-100 object-cover" />}
          <label className={labelClass}>Target peserta<textarea rows={3} value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-violet-500" placeholder="Jelaskan peserta yang cocok mengikuti kelas ini." /></label>
          <label className={labelClass}>Manfaat / hasil belajar (satu poin per baris)<textarea rows={4} value={benefits} onChange={(event) => setBenefits(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-6 outline-none focus:border-violet-500" placeholder={"Memahami dasar desain\nMampu membuat karya mandiri\nMenguasai tools utama"} /></label>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-2 text-[9px] leading-5 text-slate-500"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-violet-700" /><span>Harga, status publikasi, slug, dan akses kelas hanya dapat diubah Admin.</span></div>
          <button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-[10px] font-bold text-white hover:bg-violet-800 disabled:opacity-50"><Save size={13} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}</button>
        </div>
      </form>
    </div>
  );
}
