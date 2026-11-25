"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import MentorHeader from "./mentor-header";
import MentorSidebar from "./mentor-sidebar";

export type MentorShellUser = { id: string; name: string; email: string; avatarUrl?: string | null };
export type MentorWorkspaceMode = "mentor" | "member";

export default function MentorShell({
  user,
  children,
  activeMode = "mentor",
  canSwitchMode = false,
}: {
  user: MentorShellUser;
  children: ReactNode;
  activeMode?: MentorWorkspaceMode;
  canSwitchMode?: boolean;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      <MentorSidebar userId={user.id} activeMode={activeMode} open={sidebarOpen} collapsed={collapsed} onClose={() => setSidebarOpen(false)} onOpen={() => { setCollapsed(false); setSidebarOpen(true); }} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]"}`}>
        <MentorHeader userName={user.name} userEmail={user.email} avatarUrl={user.avatarUrl} activeMode={activeMode} canSwitchMode={canSwitchMode} onOpenSidebar={() => { setCollapsed(false); setSidebarOpen(true); }} />
        <main className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 app-mobile-safe">{children}</main>
      </div>
    </div>
  );
}
