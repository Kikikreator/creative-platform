"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, ShieldCheck, Trash2, X } from "lucide-react";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
};

type PendingConfirm = {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
};

type ConfirmDialogFunction = (
  options: ConfirmDialogOptions,
) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmDialogFunction | null>(null);

export function ConfirmDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const titleId = useId();
  const messageId = useId();

  const confirm = useCallback<ConfirmDialogFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      // Jika dua konfirmasi dipicu hampir bersamaan, selesaikan dialog lama
      // sebagai batal agar tidak ada Promise yang menggantung.
      pendingRef.current?.resolve(false);

      const nextPending = { options, resolve };
      pendingRef.current = nextPending;
      setPending(nextPending);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;

    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }, []);

  useEffect(() => {
    if (!pending) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pending, settle]);

  const variant = pending?.options.variant ?? "primary";
  const Icon = variant === "danger" ? Trash2 : ShieldCheck;

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-[#160B22]/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) settle(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#EEEAF2] bg-white shadow-[0_28px_90px_rgba(17,8,31,.28)]"
          >
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  variant === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-[#F2EEF5] text-[#260047]"
                }`}
              >
                {variant === "danger" ? (
                  <Icon size={20} />
                ) : (
                  <Icon size={20} />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id={titleId}
                  className="text-[15px] font-extrabold tracking-tight text-[#21182A]"
                >
                  {pending.options.title}
                </h2>
                <p
                  id={messageId}
                  className="mt-2 whitespace-pre-line text-[12px] leading-6 text-[#746D7B]"
                >
                  {pending.options.message}
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => settle(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#9A929F] transition hover:bg-[#F6F3F7] hover:text-[#260047]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#F0ECF2] bg-[#FCFBFD] p-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                autoFocus
                onClick={() => settle(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E8E2EB] bg-white px-4 text-[11px] font-bold text-[#62596A] transition hover:bg-[#F8F6F9]"
              >
                {pending.options.cancelLabel ?? "Batal"}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 ${
                  variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#260047] hover:bg-[#09483F]"
                }`}
              >
                {variant === "danger" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {pending.options.confirmLabel ?? "Ya, lanjutkan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const confirm = useContext(ConfirmDialogContext);

  if (!confirm) {
    throw new Error(
      "useConfirmDialog harus digunakan di dalam ConfirmDialogProvider.",
    );
  }

  return confirm;
}
