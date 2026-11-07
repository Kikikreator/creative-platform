"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Copy, MailPlus, ShieldCheck } from "lucide-react";

export default function MentorInvitePanel() {
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    setInviteUrl("");
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_mentor_invitation", {
        p_email: email.trim().toLowerCase(),
      });
      if (rpcError) throw rpcError;
      if (typeof data !== "string" || !data) {
        throw new Error("Token undangan tidak diterima dari database.");
      }
      const url = `${window.location.origin}/register?mentor_invite=${encodeURIComponent(data)}`;
      setInviteUrl(url);
      setSuccess("Undangan berhasil dibuat. Bagikan tautan ini kepada calon Mentor.");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat undangan Mentor.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setSuccess("Tautan undangan berhasil disalin.");
    } catch {
      setError("Browser tidak mengizinkan penyalinan otomatis. Salin tautan secara manual.");
    }
  }

  return (
    <section className="rounded-[22px] border border-violet-100 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-800"><MailPlus size={20} /></span>
          <div><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Invite a teacher</p><h3 className="mt-1 text-sm font-extrabold text-slate-900">Undang Mentor baru</h3><p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">Buat tautan undangan yang terikat ke alamat email calon Mentor. Bagikan melalui WhatsApp atau email secara manual.</p></div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-bold text-violet-800"><ShieldCheck size={12} /> Berlaku 7 hari</div>
      </div>
      <form onSubmit={createInvite} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email calon mentor" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-[10px] font-bold text-white hover:bg-violet-800 disabled:opacity-50">{busy ? "Membuat..." : "Buat tautan undangan"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-[10px] text-rose-700">{error}</p>}
      {success && <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={13} />{success}</p>}
      {inviteUrl && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-violet-100 bg-white p-3 sm:flex-row sm:items-center"><p className="min-w-0 flex-1 break-all text-[10px] text-slate-600">{inviteUrl}</p><button type="button" onClick={() => void copyInvite()} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-50 px-3 text-[10px] font-bold text-violet-800 hover:bg-violet-100"><Copy size={13} /> Salin tautan</button></div>}
      <p className="mt-3 text-[9px] leading-5 text-slate-400">Catatan: sistem membuat tautan undangan, bukan mengirim email otomatis. Calon Mentor harus mendaftar menggunakan email yang sama dengan alamat undangan.</p>
    </section>
  );
}
