"use client";

import { Activity, BookOpenCheck, Clock3, Users, Eye } from "lucide-react";
import type { ActivityProfile, PlatformActivityLog } from "@/lib/analytics/platform-activity";

type Props = {
  logs: PlatformActivityLog[];
  profiles: ActivityProfile[];
  error: string | null;
  mode: "overview" | "logs";
};

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    page_view: "Membuka halaman",
    lesson_open: "Membuka materi",
    task_open: "Membuka tugas",
    lesson_complete: "Menyelesaikan materi",
    login: "Login",
  };
  return labels[type] ?? type;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ActivityDashboard({ logs, profiles, error, mode }: Props) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = logs.filter((log) => new Date(log.created_at).getTime() >= since);
  const activeUserIds = Array.from(new Set(recent.map((log) => log.user_id)));
  const learningEvents = recent.filter((log) =>
    ["lesson_open", "lesson_complete", "task_open"].includes(log.event_type)
  );
  const pageViews = recent.filter((log) => log.event_type === "page_view").length;

  return (
    <div className="space-y-6">
      <div className="app-page-heading">
        <div>
          <p className="app-eyebrow">Platform intelligence</p>
          <h2 className="app-page-title">
            {mode === "overview" ? "Analisis Aktivitas" : "Log Aktivitas"}
          </h2>
          <p className="app-page-description">
            Pantau kunjungan, aktivitas belajar, dan pengguna yang aktif dalam 24 jam terakhir.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e9e7f1] px-3 py-2 text-[10px] font-bold text-[#463b68]">
          <Activity size={14} /> Data 30 hari terakhir
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Data aktivitas belum dapat dimuat: {error}. Pastikan migration aktivitas sudah dijalankan.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pengguna aktif", value: activeUserIds.length, note: "Pengguna unik, 24 jam", icon: Users },
          { label: "Aktivitas belajar", value: learningEvents.length, note: "Materi dan tugas dibuka", icon: BookOpenCheck },
          { label: "Kunjungan halaman", value: pageViews, note: "Page view, 24 jam", icon: Eye },
          { label: "Total aktivitas", value: recent.length, note: "Semua event, 24 jam", icon: Clock3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="app-stat-card min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#efedf5] text-[#51436f]">
                  <Icon size={17} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#1c2340]">{item.value.toLocaleString("id-ID")}</p>
              <p className="mt-1 text-[10px] text-slate-400">{item.note}</p>
            </article>
          );
        })}
      </div>

      {mode === "overview" && (
        <section className="app-surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-[#202742]">Pengguna aktif dalam 24 jam terakhir</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Daftar berdasarkan aktivitas terakhir yang tercatat, bukan pelacakan layar secara langsung.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {activeUserIds.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada aktivitas pengguna dalam 24 jam terakhir.</p>
            ) : activeUserIds.map((userId) => {
              const userLogs = recent.filter((log) => log.user_id === userId);
              const last = userLogs[0];
              const profile = profileMap.get(userId);
              const learned = userLogs.filter((log) => ["lesson_open", "lesson_complete", "task_open"].includes(log.event_type)).length;
              return (
                <div key={userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#202742]">{profile?.full_name || "Member"}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{profile?.phone || "Nomor belum diisi"}</p>
                    <p className="mt-1 break-all text-[10px] text-slate-400">{last.path || "Halaman tidak diketahui"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[#51436f]">{learned} aktivitas belajar</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatTime(last.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="app-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#202742]">Riwayat aktivitas terbaru</h3>
            <p className="mt-1 text-[11px] text-slate-500">Maksimal 2.000 aktivitas selama 30 hari terakhir.</p>
          </div>
          <span className="rounded-full bg-[#f0eef6] px-3 py-1.5 text-[10px] font-bold text-[#51436f]">{logs.length} catatan</span>
        </div>
        <div className="divide-y divide-slate-100">
          {logs.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-400">Belum ada aktivitas yang tercatat.</p>
          ) : logs.slice(0, mode === "overview" ? 12 : 100).map((log) => {
            const profile = profileMap.get(log.user_id);
            const metadata = log.metadata ?? {};
            const context = String(metadata.lesson_id || metadata.task_id || "");
            return (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#202742]">{profile?.full_name || "Member"}</p>
                  <p className="mt-1 text-[11px] text-[#51436f]">{eventLabel(log.event_type)}</p>
                  <p className="mt-1 break-all text-[10px] text-slate-400">{log.path || "—"}{context ? ` · ID ${context.slice(0, 8)}` : ""}</p>
                </div>
                <time className="shrink-0 text-[10px] text-slate-400">{formatTime(log.created_at)}</time>
              </div>
            );
          })}
        </div>
      </section>
      <p className="text-[10px] leading-5 text-slate-400">
        Catatan: pengguna disebut aktif apabila melakukan aktivitas yang berhasil tercatat. Sistem ini tidak menyatakan pengguna masih membuka halaman saat ini.
      </p>
    </div>
  );
}
