"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, ShieldAlert } from "lucide-react";

type ImpersonationStatus = {
  active: boolean;
  targetName?: string;
  targetEmail?: string;
  targetRole?: "instructor" | "member";
};

export default function ImpersonationBanner() {
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/admin/impersonation/status", {
          cache: "no-store",
        });
        const result = await response.json();
        if (active) setStatus(result);
      } catch {
        if (active) setStatus({ active: false });
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  async function returnToAdmin() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/impersonation/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Sesi Administrator gagal dipulihkan.");
      }

      window.location.assign(result.redirectTo || "/admin");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sesi Administrator gagal dipulihkan.",
      );
      setBusy(false);
    }
  }

  if (!status?.active) return null;

  const roleLabel =
    status.targetRole === "instructor" ? "Mentor" : "Peserta";

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-300 bg-[#FFF7DF] px-3 py-2.5 text-[#68420A] shadow-sm sm:px-5">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <ShieldAlert size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em]">
              Mode pengujian aktif
            </p>
            <p className="truncate text-[11px]">
              Sedang melihat sebagai <strong>{status.targetName}</strong>
              {" · "}{roleLabel}
              {status.targetEmail ? ` · ${status.targetEmail}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span role="alert" className="max-w-[220px] text-[10px] text-rose-700">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => void returnToAdmin()}
            disabled={busy}
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#35134F] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#4B1C70] disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? <LoaderCircle size={13} className="animate-spin" />
              : <ArrowLeft size={13} />}
            {busy ? "Memulihkan..." : "Kembali ke Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
