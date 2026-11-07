"use client";

import { useState } from "react";
import { LogOut, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  compact?: boolean;
  iconOnly?: boolean;
  dark?: boolean;
  className?: string;
};

export default function LogoutButton({
  compact = false,
  iconOnly = false,
  dark = false,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });

      if (signOutError) throw signOutError;

      // Hard navigation clears the current App Router view and requests a fresh
      // server render after Supabase has removed the auth cookies.
      window.location.replace("/login?logged_out=1");
    } catch {
      setError("Belum berhasil keluar. Silakan coba kembali.");
      setLoading(false);
    }
  }

  const tone = dark
    ? "bg-white/10 text-white hover:bg-white/18 focus-visible:outline-white/70"
    : "bg-[#F2EFF5] text-[#260047] hover:bg-[#E9E4EE]";

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loading}
        aria-label="Keluar dari akun"
        title="Keluar dari akun"
        className={`inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${tone} ${className}`}
      >
        {loading ? <LoaderCircle size={15} className="shrink-0 animate-spin" /> : <LogOut size={15} className="shrink-0" />}
        {!iconOnly && <span className={compact ? "hidden sm:inline" : "truncate"}>{loading ? "Keluar..." : "Keluar"}</span>}
      </button>
      {error && (
        <p role="alert" className="absolute bottom-full right-0 z-[70] mb-2 w-52 rounded-xl bg-rose-50 p-2.5 text-[10px] leading-4 text-rose-700 shadow-lg">
          {error}
        </p>
      )}
    </div>
  );
}
