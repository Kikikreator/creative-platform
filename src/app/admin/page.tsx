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
      title: "Total Akun",
      value: profilesResult.count ?? 0,
      description: "Akun dengan profil terdaftar",
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
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Ringkasan platform</h2>
          <p className="mt-1 text-sm text-slate-500">Data utama aktivitas Kiki Creator Class.</p>
        </div>
      </section>

      {/* STATISTICS */}
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="group rounded-xl border border-[#eae5ed] bg-white p-5 transition-colors hover:border-[#d8cddd]"
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
      <section className="rounded-xl border border-[#eae5ed] bg-white p-5 sm:p-6">

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pengelolaan Platform
              </h3>

            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {managementLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-lg border border-[#eae5ed] bg-white p-4 transition-colors hover:bg-[#faf8fb]"
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