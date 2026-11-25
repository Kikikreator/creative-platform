"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { getAdminPageMeta } from "./admin-config";
import ImpersonationSwitcher from "@/components/impersonation/impersonation-switcher";

type Props = { userName: string; userEmail: string; onOpenSidebar: () => void };
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return parts.length === 1 ? parts[0].slice(0, 1).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function AdminHeader({ userName, userEmail, onOpenSidebar }: Props) {
  const meta = getAdminPageMeta(usePathname());
  return (
    <header className="kcc-workspace-header sticky top-0 z-30 border-b border-[#f0edf7]/80 bg-white/80 backdrop-blur-2xl">
      <div className="kcc-workspace-header-inner mx-auto flex min-h-[78px] max-w-[1560px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onOpenSidebar} aria-label="Buka menu admin" className="kcc-workspace-menu-button flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#F2EFF5] text-[#260047] lg:hidden"><Menu size={19} /></button>
          <div className="min-w-0"><h1 className="truncate text-[18px] font-semibold tracking-tight text-[#211a37] sm:text-[20px]">{meta.title}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ImpersonationSwitcher />
          <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 ring-1 ring-[#eee9f0] sm:px-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#260047] text-xs font-semibold text-white">{initials(userName)}</span><div className="hidden min-w-0 sm:block"><p className="max-w-[160px] truncate text-[11px] font-bold text-[#29233e]">{userName}</p><p className="max-w-[160px] truncate text-[10px] text-[#9892a8]">{userEmail}</p></div></div>
        </div>
      </div>
    </header>
  );
}
