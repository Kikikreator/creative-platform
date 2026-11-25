"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
} from "lucide-react";

type MentorMode = "mentor" | "member";

type Props = {
  activeMode: MentorMode;
  compact?: boolean;
};

export default function MentorModeSwitcher({ activeMode, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function switchMode(nextMode: MentorMode) {
    if (busy || nextMode === activeMode) {
      setOpen(false);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/mentor/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Mode akun belum dapat diubah.");
      }

      window.location.assign(result.redirectTo || (nextMode === "member" ? "/mentor/member" : "/mentor"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mode akun belum dapat diubah.");
      setBusy(false);
    }
  }

  const activeLabel = activeMode === "member" ? "Mode Member" : "Mode Mentor";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-70 ${
          activeMode === "member"
            ? "border-teal-100 bg-teal-50 text-teal-800 hover:bg-teal-100"
            : "border-violet-100 bg-violet-50 text-[#3B1760] hover:bg-violet-100"
        } ${compact ? "px-2.5" : "sm:px-3.5"}`}
      >
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
        <span>{activeLabel}</span>
        <ChevronDown size={13} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-[100] w-[min(280px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-violet-100 bg-white p-2 shadow-[0_18px_55px_rgba(35,15,65,.18)]"
        >
          <div className="px-3 pb-2 pt-2">
            <p className="text-xs font-extrabold text-[#25143D]">Beralih mode akun</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Gunakan satu akun untuk mengajar atau meninjau materi kelas yang kamu ampu.
            </p>
          </div>
          <div className="h-px bg-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void switchMode("mentor")}
            disabled={busy || activeMode === "mentor"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-50 disabled:cursor-default disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
              <GraduationCap size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800">Mode Mentor</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">Kelola kelas, materi, dan tugas</span>
            </span>
            {activeMode === "mentor" && <span className="text-[9px] font-bold text-emerald-700">Aktif</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void switchMode("member")}
            disabled={busy || activeMode === "member"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50 disabled:cursor-default disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
              <BookOpen size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800">Mode Member</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">Hanya melihat materi dan tugas</span>
            </span>
            {activeMode === "member" && <span className="text-[9px] font-bold text-emerald-700">Aktif</span>}
          </button>
          {error && <p role="alert" className="mx-2 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] leading-4 text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
