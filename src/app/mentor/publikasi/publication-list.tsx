"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, RotateCcw, Trash2 } from "lucide-react";

export type MentorPublicationItem = {
  id: string;
  course_id: string;
  section_id: string;
  title: string;
  action: "create" | "update" | "delete";
  status: "pending" | "approved" | "revision_requested";
  mentor_note: string | null;
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  course_title: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusMeta(status: MentorPublicationItem["status"]) {
  if (status === "approved") return { label: "Disetujui", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  if (status === "revision_requested") return { label: "Perlu revisi", className: "bg-rose-50 text-rose-700", icon: RotateCcw };
  return { label: "Menunggu Admin", className: "bg-amber-50 text-amber-700", icon: Clock3 };
}

function actionLabel(action: MentorPublicationItem["action"]) {
  if (action === "create") return "Bab baru";
  if (action === "update") return "Perubahan Bab";
  return "Penghapusan Bab";
}

export default function MentorPublicationList({
  items,
  initialError,
}: {
  items: MentorPublicationItem[];
  initialError: string | null;
}) {
  const pending = items.filter((item) => item.status === "pending").length;
  const approved = items.filter((item) => item.status === "approved").length;
  const revision = items.filter((item) => item.status === "revision_requested").length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6] p-5 text-white shadow-sm sm:p-7">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-violet-100">Chapter approval</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Status Pengajuan Bab</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-violet-50/90">Simpan draft dan lengkapi semua Materi Inti serta Mini Materi terlebih dahulu. Setelah siap, ajukan satu Bab untuk diperiksa Admin secara menyeluruh.</p>
      </section>
      {initialError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{initialError}. Pastikan migration Pengajuan Bab sudah diterapkan.</div>}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-4"><p className="text-[10px] text-slate-500">Menunggu</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{pending}</p></div>
        <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-4"><p className="text-[10px] text-slate-500">Disetujui</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{approved}</p></div>
        <div className="rounded-[20px] border border-[#EEEAF7] bg-white p-4"><p className="text-[10px] text-slate-500">Perlu revisi</p><p className="mt-1 text-2xl font-extrabold text-rose-700">{revision}</p></div>
      </section>
      <section className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><FileCheck2 size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-900">Riwayat pengajuan Bab</h3></div></div>
        {items.length === 0 ? (
          <div className="p-10 text-center"><FileCheck2 className="mx-auto text-slate-300" size={30} /><h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada Bab yang diajukan</h3><p className="mt-1 text-xs text-slate-500">Kamu bebas menyusun Bab, Materi Inti, dan Mini Materi terlebih dahulu dari menu Bab & Materi.</p><Link href="/mentor/materi" className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[10px] font-bold text-white">Buka Bab & Materi <ArrowRight size={13} /></Link></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const meta = statusMeta(item.status);
              const Icon = meta.icon;
              return (
                <article key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-extrabold text-slate-900">{item.title}</h4><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold ${meta.className}`}><Icon size={11} />{meta.label}</span></div>
                      <p className="mt-1 text-[10px] text-slate-500">{item.course_title} · {actionLabel(item.action)}</p>
                      <p className="mt-1 text-[9px] text-slate-400">Diajukan: {formatDate(item.submitted_at)}{item.reviewed_at ? ` · Ditinjau: ${formatDate(item.reviewed_at)}` : ""}</p>
                    </div>
                    <Link href={`/mentor/materi?course=${item.course_id}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600 hover:border-violet-200 hover:text-violet-800">Buka kelas <ArrowRight size={12} /></Link>
                  </div>
                  {item.admin_note && <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/70 p-3"><p className="text-[9px] font-extrabold text-rose-800">Catatan Admin</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-rose-700">{item.admin_note}</p></div>}
                  {item.action === "delete" && <p className="mt-2 inline-flex items-center gap-1 text-[9px] text-rose-600"><Trash2 size={11} /> Pengajuan penghapusan Bab beserta seluruh isinya.</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
