"use client";

import { Menu, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { getMentorPageMeta } from "./mentor-config";
import ImpersonationSwitcher from "@/components/impersonation/impersonation-switcher";

type Props = { userName: string; userEmail: string; avatarUrl?: string | null; onOpenSidebar: () => void };
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return parts.length === 1 ? parts[0].slice(0, 1).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function MentorHeader({ userName, userEmail, avatarUrl, onOpenSidebar }: Props) {
  const meta = getMentorPageMeta(usePathname());
  return (
    <header className="sticky top-0 z-30 border-b border-[#f0edf7]/80 bg-white/80 backdrop-blur-2xl">
      <div className="kcc-workspace-header-inner mx-auto flex min-h-[78px] max-w-[1560px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onOpenSidebar} aria-label="Buka menu mentor" className="kcc-workspace-menu-button flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#F2EFF5] text-[#260047] lg:hidden"><Menu size={19} /></button>
          <div className="min-w-0"><p className="kcc-workspace-header-kicker text-[9px] font-extrabold uppercase tracking-[.18em] text-[#260047]">Mentor workspace</p><h1 className="mt-1 truncate text-[18px] font-extrabold tracking-tight text-[#211a37] sm:text-[20px]">{meta.title}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3"><ImpersonationSwitcher showWhenInactive={false} /><span className="hidden items-center gap-1.5 rounded-full bg-[#efedf5] px-3 py-2 text-[10px] font-bold text-[#51436f] md:inline-flex"><ShieldCheck size={13} /> Pengajar</span><div className="flex items-center gap-2.5 rounded-[17px] bg-white px-2.5 py-2 shadow-[0_5px_18px_rgba(41,29,74,.07)] ring-1 ring-[#f2eff8] sm:px-3">{avatarUrl ? <img src={avatarUrl} alt="" className="h-9 w-9 rounded-[12px] object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#382653] to-[#263b60] text-xs font-extrabold text-white shadow-[0_5px_12px_rgba(42,45,83,.16)]">{initials(userName)}</span>}<div className="hidden min-w-0 sm:block"><p className="max-w-[160px] truncate text-[11px] font-bold text-[#29233e]">{userName}</p><p className="max-w-[160px] truncate text-[10px] text-[#9892a8]">{userEmail}</p></div></div></div>
      </div>
    </header>
  );
}
