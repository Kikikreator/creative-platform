"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

export type AdminMentorProfile = {
  user_id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  education: string | null;
  experience: string | null;
  portfolio_url: string | null;
  photo_url: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  approval_status: string;
  admin_note: string | null;
  submitted_at: string | null;
};

function dateLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MentorProfileReview({
  items,
  initialError,
}: {
  items: AdminMentorProfile[];
  initialError: string | null;
}) {
  const [rows, setRows] = useState(items);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function review(item: AdminMentorProfile, decision: "approved" | "revision_requested") {
    const note = notes[item.user_id]?.trim() ?? "";
    if (decision === "revision_requested" && !note) {
      setError("Catatan perbaikan wajib diisi.");
      return;
    }
    setBusyId(item.user_id);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("review_mentor_profile", {
        p_user_id: item.user_id,
        p_decision: decision,
        p_note: note || null,
      });
      if (rpcError) throw rpcError;
      setRows((current) => current.filter((row) => row.user_id !== item.user_id));
      setNotice(decision === "approved" ? `Profil ${item.full_name} disetujui.` : `Perbaikan profil dikirim kepada ${item.full_name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses profil Mentor.");
    } finally {
      setBusyId(null);
    }
  }

  async function openCv(item: AdminMentorProfile) {
    if (!item.cv_path) return;
    const supabase = createClient();
    const { data, error: signedError } = await supabase.storage.from("mentor-private").createSignedUrl(item.cv_path, 10 * 60);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? "CV belum dapat dibuka.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-sm sm:p-7">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Mentor quality review</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Review Profil Pengajar</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Periksa biodata profesional, keahlian, pendidikan, pengalaman, portofolio, dan CV sebelum profil Mentor ditampilkan secara publik.</p>
      </section>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 size={15} />{notice}</div>}
      <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-[20px] border border-slate-200 bg-white p-4"><p className="text-[10px] text-slate-500">Profil menunggu pemeriksaan</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{rows.length}</p></div><div className="rounded-[20px] border border-slate-200 bg-white p-4"><p className="text-[10px] text-slate-500">Standar publikasi</p><p className="mt-1 text-sm font-extrabold text-emerald-700">Persetujuan Admin</p></div></section>
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><GraduationCap size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Daftar profil Mentor</h3></div></div>
        {rows.length === 0 ? <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={32} /><h3 className="mt-3 text-sm font-bold text-slate-800">Tidak ada profil menunggu review</h3></div> : (
          <div className="divide-y divide-slate-100">
            {rows.map((item) => (
              <article key={item.user_id} className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row">
                  {item.photo_url ? <img src={item.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-xl font-extrabold text-violet-700">{item.full_name.charAt(0)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-extrabold text-slate-900">{item.full_name}</h4><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">Menunggu pemeriksaan</span></div>
                    <p className="mt-1 text-[10px] font-semibold text-violet-700">{item.headline || "Headline belum diisi"}</p>
                    <p className="mt-1 text-[9px] text-slate-400">Diajukan: {dateLabel(item.submitted_at)}</p>
                    {item.bio && <p className="mt-3 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{item.bio}</p>}
                    {item.expertise?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.expertise.map((tag) => <span key={tag} className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-800">{tag}</span>)}</div> : null}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {item.education && <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-extrabold text-slate-500">PENDIDIKAN</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-700">{item.education}</p></div>}
                      {item.experience && <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-extrabold text-slate-500">PENGALAMAN</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-700">{item.experience}</p></div>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.cv_path && <button type="button" onClick={() => void openCv(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600"><FileText size={12} /> {item.cv_file_name || "Buka CV"} <ExternalLink size={11} /></button>}
                      {item.portfolio_url && <a href={item.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600">Portofolio <ExternalLink size={11} /></a>}
                    </div>
                  </div>
                </div>
                <label className="mt-4 block text-[10px] font-bold text-slate-600">Catatan Admin<textarea rows={2} value={notes[item.user_id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.user_id]: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-500" placeholder="Wajib diisi jika meminta revisi." /></label>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => void review(item, "revision_requested")} disabled={busyId === item.user_id} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><RotateCcw size={13} /> Minta revisi</button>
                  <button type="button" onClick={() => void review(item, "approved")} disabled={busyId === item.user_id} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={13} /> Setujui profil</button>
                </div>
                {busyId === item.user_id && <p className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-400"><RefreshCw size={12} className="animate-spin" /> Memproses...</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
