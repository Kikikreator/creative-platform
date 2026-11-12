"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone =
      window.navigator as NavigatorWithStandalone;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    setIsStandalone(standalone);

    const iosDevice =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);

    setIsIos(iosDevice && !standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    const registerServiceWorker = () => {
      if (!("serviceWorker" in navigator)) return;

      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error: unknown) => {
          console.error("Gagal mendaftarkan service worker Kiki Creator Class:", error);
        });
    };

    let waitingForWindowLoad = false;

    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        waitingForWindowLoad = true;
        window.addEventListener("load", registerServiceWorker, { once: true });
      }
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (waitingForWindowLoad) {
        window.removeEventListener("load", registerServiceWorker);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  if (isStandalone || (!installPrompt && !isIos)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        aria-label={
          isIos
            ? "Lihat cara memasang Kiki Creator Class"
            : "Instal aplikasi Kiki Creator Class"
        }
        className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full bg-[#260047] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(38,0,71,.28)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[#09483F] focus:outline-none focus:ring-4 focus:ring-violet-200"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ↓
        </span>
        {isIos ? "Cara Instal" : "Instal Aplikasi"}
      </button>

      {showIosGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowIosGuide(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kcc-ios-install-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              aria-label="Tutup petunjuk instalasi"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-600"
            >
              ×
            </button>

            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#09483F]">
              Kiki Creator Class
            </p>
            <h2
              id="kcc-ios-install-title"
              className="mt-2 pr-8 text-xl font-bold text-[#260047]"
            >
              Pasang aplikasi di iPhone atau iPad
            </h2>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
              <li>Buka Kiki Creator Class melalui browser Safari.</li>
              <li>
                Tekan tombol <strong>Bagikan</strong> (ikon kotak dengan panah
                ke atas).
              </li>
              <li>
                Pilih <strong>Tambahkan ke Layar Utama</strong> atau{" "}
                <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tekan <strong>Tambah</strong> atau <strong>Add</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-6 w-full rounded-xl bg-[#260047] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#09483F]"
            >
              Mengerti
            </button>
          </section>
        </div>
      )}
    </>
  );
}
