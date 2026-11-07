import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

import {
  BookOpen,
  Users,
  ShoppingCart,
  BookOpenCheck,
  ArrowUpRight,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

function AdminLoading() {
  return (
    <div className="space-y-7">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-[22px] bg-white shadow-sm"
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded-[22px] bg-white shadow-sm" />
    </div>
  );
}

async function AdminDashboard() {
  await connection();

  const supabase = await createClient();

  const [
    coursesResult,
    profilesResult,
    ordersResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("orders")
      .select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    {
      title: "Total Kelas",
      value: coursesResult.count ?? 0,
      description: "Seluruh kelas pembelajaran",
      icon: BookOpen,
      iconStyle: "bg-violet-50 text-violet-700",
    },
    {
      title: "Total Member",
      value: profilesResult.count ?? 0,
      description: "Pengguna terdaftar",
      icon: Users,
      iconStyle: "bg-violet-50 text-cyan-700",
    },
    {
      title: "Total Pesanan",
      value: ordersResult.count ?? 0,
      description: "Seluruh pesanan tercatat",
      icon: ShoppingCart,
      iconStyle: "bg-violet-50 text-violet-700",
    },
  ];

  const hasError = [
    coursesResult.error,
    profilesResult.error,
    ordersResult.error,
  ].some(Boolean);

  const managementLinks = [
    {
      title: "Manajemen Kelas",
      description:
        "Buat kelas baru, atur harga, informasi, dan publikasi kelas.",
      href: "/admin/kelas",
      icon: BookOpen,
      iconStyle: "bg-violet-50 text-violet-700",
    },
    {
      title: "Manajemen Materi",
      description:
        "Kelola bab, video, dan seluruh materi pembelajaran.",
      href: "/admin/materi",
      icon: BookOpenCheck,
      iconStyle: "bg-violet-50 text-cyan-700",
    },
    {
      title: "Pengguna & Akses",
      description:
        "Pantau member dan atur kepemilikan akses kelas.",
      href: "/admin/pengguna",
      icon: Users,
      iconStyle: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="space-y-7">

      {/* WELCOME SECTION */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">
              Overview
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Selamat Datang di Workspace
          </h2>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Pantau perkembangan Kiki Creator Class dan kelola
            seluruh aktivitas administrasi dari satu tempat.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-violet-700 shadow-[0_3px_14px_rgba(15,23,42,0.04)]">
          <TrendingUp size={15} />
          Platform Overview
        </div>
      </section>

      {/* STATISTICS */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ringkasan Platform
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Statistik keseluruhan platform.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="group rounded-[22px] bg-white p-5 shadow-[0_5px_24px_rgba(15,23,42,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {item.title}
                    </p>

                    <p className="mt-3 text-[30px] font-bold tracking-tight text-slate-900">
                      {new Intl.NumberFormat("id-ID").format(item.value)}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {item.description}
                    </p>
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconStyle}`}
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasError && (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Sebagian statistik belum berhasil dimuat. Silakan periksa
            koneksi database.
          </div>
        )}
      </section>

      {/* MANAGEMENT */}
      <section className="rounded-[24px] bg-white p-5 shadow-[0_5px_24px_rgba(15,23,42,0.035)] sm:p-6">

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <GraduationCap size={22} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pengelolaan Platform
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Akses cepat ke menu administrasi.
              </p>
            </div>
          </div>

          <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700">
            Admin Workspace
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {managementLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[19px] bg-[#FBFAFF] p-5 transition-all duration-200 hover:bg-violet-50/70"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.iconStyle}`}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </div>

                  <ArrowUpRight
                    size={19}
                    className="text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-700"
                  />
                </div>

                <h4 className="mt-5 text-sm font-bold text-slate-900">
                  {item.title}
                </h4>

                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pb-3 pt-2 text-center">
        <p className="text-[11px] text-slate-400">
          © 2026 Kiki Creator Class. All rights reserved.
        </p>
      </footer>

    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminDashboard />
    </Suspense>
  );
}