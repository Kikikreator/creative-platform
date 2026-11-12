"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminHeader from "./admin-header";
import AdminSidebar from "./admin-sidebar";

export type AdminShellUser = { id: string; name: string; email: string };

export default function AdminShell({ user, children }: { user: AdminShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-white" />
      <AdminSidebar userId={user.id} open={sidebarOpen} collapsed={collapsed} onClose={() => setSidebarOpen(false)} onOpen={() => { setCollapsed(false); setSidebarOpen(true); }} onToggleCollapsed={() => setCollapsed((prev) => !prev)} />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]"}`}>
        <AdminHeader userName={user.name} userEmail={user.email} onOpenSidebar={() => { setCollapsed(false); setSidebarOpen(true); }} />
        <main className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 app-mobile-safe">{children}</main>
      </div>
    </div>
  );
}
