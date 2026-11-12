"use client";

import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import LogoutButton from "@/components/auth/logout-button";
import { adminNavigation } from "./admin-config";
import { useSidebarNotifications } from "@/components/notifications/use-sidebar-notifications";

type AdminSidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onOpen: () => void;
  onToggleCollapsed: () => void;
  userId: string;
};

const mobileItems = [
  { href: "/admin", title: "Home" },
  { href: "/admin/kelas", title: "Kelas" },
  { href: "/admin/materi", title: "Materi" },
  { href: "/admin/pengguna", title: "Pengguna" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  const matches = adminNavigation.flatMap((section) => section.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href === href;
}

function NotificationBadge({ count, collapsed = false }: { count: number; collapsed?: boolean }) {
  if (count <= 0) return null;
  if (collapsed) {
    return <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#260047]" aria-label={`${count} notifikasi`} />;
  }
  return <span className="ml-auto inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[9px] font-extrabold leading-none text-white shadow-sm" aria-label={`${count} notifikasi`}>{count > 99 ? "99+" : count}</span>;
}

export default function AdminSidebar({ open, collapsed, onClose, onOpen, onToggleCollapsed, userId }: AdminSidebarProps) {
  const pathname = usePathname();
  const notificationCounts = useSidebarNotifications(userId, pathname);

  return (
    <>
      <button
        type="button"
        aria-label="Tutup menu admin"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#17112b]/35 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <aside className={`kcc-workspace-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#260047] text-white shadow-[10px_0_34px_rgba(38,0,71,.18)] transition-[width,transform] duration-300 ${collapsed ? "w-[84px]" : "w-[264px]"} ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-[82px] shrink-0 items-center gap-3 px-4 ${collapsed ? "justify-center" : ""}`}>
          {collapsed ? (
            <button type="button" onClick={onToggleCollapsed} aria-label="Perluas sidebar" title="Buka sidebar" className="group/logo relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white p-1.5 shadow-[0_8px_18px_rgba(8,13,34,.2)]">
              <Image src="/logo_brand.png" alt="Kiki Creator Class" width={40} height={40} priority className="h-full w-full object-contain transition-opacity group-hover/logo:opacity-35" />
              <span className="absolute inset-0 flex items-center justify-center text-[#260047] opacity-0 transition-opacity group-hover/logo:opacity-100"><PanelLeftOpen size={18} /></span>
            </button>
          ) : (
            <>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white p-1.5 shadow-[0_8px_18px_rgba(8,13,34,.2)]">
                <Image src="/logo_brand.png" alt="Kiki Creator Class" width={40} height={40} priority className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold tracking-tight text-white">Kiki Creator Class</p><p className="mt-1 text-[9px] font-medium uppercase tracking-[.15em] text-white/60">Administration</p></div>
              <button type="button" onClick={onToggleCollapsed} aria-label="Ciutkan sidebar" title="Ciutkan sidebar" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 lg:flex"><PanelLeftClose size={16} /></button>
            </>
          )}
          <button type="button" onClick={onClose} aria-label="Tutup menu" className="kcc-sidebar-close-button ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 lg:hidden"><ChevronLeft size={17} /></button>
        </div>

        <div className="mx-4 h-px shrink-0 bg-white/15" />

        <nav className="sidebar-scrollbar-hidden flex-1 overflow-y-auto overscroll-contain px-3 py-5">
          {adminNavigation.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              {!collapsed && <p className="mb-2.5 px-3 text-[9px] font-medium uppercase tracking-[.14em] text-white/50">{section.label}</p>}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  const shared = `group flex min-h-[44px] items-center gap-3 rounded-[14px] px-3 text-[11px] font-medium leading-[1.35] transition-all duration-200 ${collapsed ? "justify-center px-2" : ""}`;
                  if (item.disabled) return (
                    <div key={item.href} title={collapsed ? `${item.title} · belum tersedia` : undefined} aria-disabled="true" className={`${shared} cursor-not-allowed text-white/35`}>
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-white/40"><Icon size={16} strokeWidth={1.8} /></span>
                      {!collapsed && <><span className="kcc-sidebar-menu-label min-w-0 flex-1 whitespace-normal break-words leading-[1.35]">{item.title}</span>{item.badge && <span className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-medium text-white/45">{item.badge}</span>}</>}
                    </div>
                  );
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? `${item.title}${notificationCounts[item.href] ? ` · ${notificationCounts[item.href]} notifikasi` : ""}` : undefined} onClick={onClose} className={`${shared} ${active ? "bg-white/15 text-white shadow-[inset_3px_0_0_#09483F]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition ${active ? "bg-white/15 text-white" : "text-white/55 group-hover:bg-white/10 group-hover:text-white"}`}><Icon size={16} strokeWidth={1.9} />{collapsed && <NotificationBadge count={notificationCounts[item.href] ?? 0} collapsed />}</span>
                      {!collapsed && <><span className="kcc-sidebar-menu-label min-w-0 flex-1 whitespace-normal break-words leading-[1.35]">{item.title}</span>{item.badge && <span className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-medium text-white/65">{item.badge}</span>}<NotificationBadge count={notificationCounts[item.href] ?? 0} /></>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-3 pt-2">
          <LogoutButton dark iconOnly={collapsed} className={collapsed ? "h-10" : "h-11 justify-start px-3"} />
        </div>
      </aside>

      <nav aria-label="Navigasi cepat admin" className="kcc-mobile-bottom-nav fixed bottom-3 left-3 right-3 z-30 flex items-center justify-around rounded-[22px] border border-white/80 bg-white/95 px-1.5 py-2 shadow-[0_12px_35px_rgba(38,27,72,.14)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        {mobileItems.map((item) => {
          const nav = adminNavigation.flatMap((section) => section.items).find((entry) => entry.href === item.href)!;
          const Icon = nav.icon;
          const active = isActivePath(pathname, item.href);
          return <Link key={item.href} href={item.href} onClick={onClose} className={`kcc-sidebar-mobile-link flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-medium ${active ? "text-[#260047]" : "text-[#77717D]"}`}><span className={`relative flex h-8 w-9 items-center justify-center rounded-xl ${active ? "bg-[#F2EFF5]" : ""}`}><Icon size={18} /><NotificationBadge count={notificationCounts[item.href] ?? 0} collapsed /></span>{item.title}</Link>;
        })}
        <button type="button" onClick={onOpen} className="kcc-sidebar-mobile-action flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-medium text-[#77717D]" aria-label="Menu lainnya"><span className="flex h-8 w-9 items-center justify-center rounded-xl"><Menu size={18} /></span>Menu</button>
      </nav>
    </>
  );
}
