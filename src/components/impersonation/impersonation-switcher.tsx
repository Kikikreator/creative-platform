"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

type ImpersonationTarget = {
  userId: string;
  name: string;
  email: string;
  role: "instructor" | "member";
};

type ImpersonationStatus = {
  active: boolean;
  targetUserId?: string;
  targetName?: string;
  targetEmail?: string;
  targetRole?: "instructor" | "member";
};

type Props = {
  /**
   * Admin selalu menampilkan dropdown.
   * Pada dashboard Mentor/Peserta, dropdown hanya tampil jika mode pengujian aktif.
   */
  showWhenInactive?: boolean;
};

export default function ImpersonationSwitcher({
  showWhenInactive = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [targets, setTargets] = useState<ImpersonationTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/admin/impersonation/status", {
          cache: "no-store",
        });
        const result = await response.json();

        if (mounted) {
          setStatus({
            active: Boolean(result.active),
            targetUserId: result.targetUserId,
            targetName: result.targetName,
            targetEmail: result.targetEmail,
            targetRole: result.targetRole,
          });
        }
      } catch {
        if (mounted) setStatus({ active: false });
      }
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open || targets.length > 0 || loadingTargets) return;

    const controller = new AbortController();

    async function loadTargets() {
      setLoadingTargets(true);
      setError("");

      try {
        const response = await fetch("/api/admin/impersonation/targets", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal memuat akun pengujian.");
        }

        setTargets(Array.isArray(result.targets) ? result.targets : []);
        setStatus((current) => ({
          active: Boolean(result.isImpersonating ?? current?.active),
          targetUserId:
            result.currentTargetUserId ??
            current?.targetUserId,
          targetName: current?.targetName,
          targetEmail: current?.targetEmail,
          targetRole: current?.targetRole,
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat akun pengujian.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingTargets(false);
      }
    }

    void loadTargets();

    return () => controller.abort();
  }, [open, targets.length]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function switchAccount(target: ImpersonationTarget) {
    if (busyAction) return;

    if (status?.active && status.targetUserId === target.userId) {
      setOpen(false);
      return;
    }

    setBusyAction(target.userId);
    setError("");

    try {
      const response = await fetch("/api/admin/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: target.userId }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal beralih ke akun pengujian.");
      }

      window.location.assign(result.redirectTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal beralih ke akun pengujian.",
      );
      setBusyAction("");
    }
  }

  async function returnToAdmin() {
    if (busyAction) return;

    setBusyAction("admin");
    setError("");

    try {
      const response = await fetch("/api/admin/impersonation/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal kembali ke Administrator.");
      }

      window.location.assign(result.redirectTo || "/admin");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal kembali ke Administrator.",
      );
      setBusyAction("");
    }
  }

  if (!showWhenInactive && !status?.active) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] font-bold text-[#3B1760] transition hover:border-violet-200 hover:bg-violet-100 sm:px-3.5"
      >
        <ArrowLeftRight size={14} />
        <span className="hidden sm:inline">Uji sebagai</span>
        <ChevronDown
          size={13}
          className={open ? "rotate-180 transition" : "transition"}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-violet-100 bg-white p-2 shadow-[0_18px_55px_rgba(35,15,65,.18)]"
        >
          <div className="px-3 pb-2 pt-2">
            <p className="text-xs font-extrabold text-[#25143D]">
              Mode Pengujian
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Buka dashboard asli akun yang dipilih tanpa login ulang.
            </p>
          </div>

          <div className="h-px bg-slate-100" />

          {loadingTargets && (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
              <LoaderCircle size={15} className="animate-spin" />
              Memuat akun pengujian...
            </div>
          )}

          {!loadingTargets && targets.length === 0 && !error && (
            <p className="px-3 py-4 text-xs text-slate-500">
              Akun pengujian belum ditemukan.
            </p>
          )}

          {targets.map((target) => {
            const isMentor = target.role === "instructor";
            const Icon = isMentor ? GraduationCap : UserRound;
            const isCurrent =
              status?.active && status.targetUserId === target.userId;

            return (
              <button
                key={target.userId}
                type="button"
                role="menuitem"
                disabled={Boolean(busyAction) || Boolean(isCurrent)}
                onClick={() => void switchAccount(target)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-default disabled:opacity-100 ${
                  isCurrent
                    ? "bg-violet-50"
                    : "hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isMentor
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-violet-50 text-violet-700"
                  }`}
                >
                  {busyAction === target.userId ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Icon size={17} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-[#25143D]">
                    {target.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {target.email}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${
                    isCurrent
                      ? "bg-violet-100 text-violet-700"
                      : isMentor
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-violet-50 text-violet-700"
                  }`}
                >
                  {isCurrent ? "Aktif" : isMentor ? "Mentor" : "Peserta"}
                </span>
              </button>
            );
          })}

          {status?.active && (
            <>
              <div className="my-1 h-px bg-slate-100" />

              <button
                type="button"
                role="menuitem"
                disabled={Boolean(busyAction)}
                onClick={() => void returnToAdmin()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  {busyAction === "admin" ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={17} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-[#25143D]">
                    Administrator
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    Kembali ke akun Administrator
                  </span>
                </span>

                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                  Admin
                </span>
              </button>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mx-2 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] leading-4 text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-[9px] leading-4 text-slate-400">
            <Users size={12} />
            Hanya akun pengujian yang sudah diizinkan.
          </div>
        </div>
      )}
    </div>
  );
}
