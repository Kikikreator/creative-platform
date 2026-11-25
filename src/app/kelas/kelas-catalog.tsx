"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  BookOpen,
  GraduationCap,
  ArrowRight,
  X,
} from "lucide-react";
import type { AppRole } from "@/lib/auth/roles";

export type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  target_audience: string | null;
  benefits: string[];
  mentor_name: string | null;
  mentor_bio: string | null;
  price: number | string;
  status: string;
  access_type: string;
  created_at: string;
};

function formatPrice(value: number | string) {
  const price = Number(value) || 0;

  if (price === 0) return "Gratis";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function KelasCatalog({
  courses,
  loadError,
  userRole,
  isAuthenticated,
}: {
  courses: Course[];
  loadError: string | null;
  userRole: AppRole | null;
  isAuthenticated: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Semua");

  // KATEGORI KELAS
  const categories = useMemo(() => {
    const values = courses
      .map((course) => course.category?.trim())
      .filter((value): value is string => Boolean(value));

    return ["Semua", ...Array.from(new Set(values))];
  }, [courses]);

  // PENCARIAN DAN FILTER
  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(keyword) ||
        (course.short_description ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (course.description ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (course.category ?? "")
          .toLowerCase()
          .includes(keyword) ||
        (course.mentor_name ?? "")
          .toLowerCase()
          .includes(keyword);

      const matchesCategory =
        selectedCategory === "Semua" ||
        course.category?.trim() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [courses, search, selectedCategory]);

  return (
    <main className="kcc-course-catalog min-h-screen bg-[#F7F6FC] text-[#1B1730]">

      {/* =========================================
          NAVIGATION
      ========================================= */}

      <header className="sticky top-0 z-40 border-b border-[#F1EDF8] bg-white/95 backdrop-blur-xl">

        <div className="mx-auto flex h-[66px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <Link
            href="/"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B21B6] text-white shadow-sm">
              <GraduationCap size={22} />
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight text-[#251A3D]">
                Kiki Creator Class
              </h1>

            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {userRole === "admin" ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl bg-[#260047] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#09483F] sm:text-sm"
              >
                Panel Admin <ArrowRight size={14} />
              </Link>
            ) : userRole === "instructor" ? (
              <Link
                href="/mentor"
                className="inline-flex items-center gap-2 rounded-xl bg-[#260047] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#09483F] sm:text-sm"
              >
                Panel Mentor <ArrowRight size={14} />
              </Link>
            ) : userRole === "member" ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#260047] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#09483F] sm:text-sm"
              >
                Dashboard Peserta <ArrowRight size={14} />
              </Link>
            ) : isAuthenticated ? (
              <Link
                href="/login?reason=role-check-failed"
                className="rounded-xl border border-[#E8E1ED] bg-white px-4 py-2.5 text-xs font-semibold text-[#260047] transition hover:bg-[#F7F5F8] sm:text-sm"
              >
                Periksa Akses Akun
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-[#6C6280] transition hover:bg-[#F8F6FD] hover:text-[#260047] sm:text-sm"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-[#260047] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#09483F] active:scale-[0.98] sm:text-sm"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>

        </div>

      </header>

      {/* =========================================
          MAIN CATALOG
      ========================================= */}

      <section className="mx-auto min-h-[calc(100vh-140px)] max-w-7xl px-4 pb-9 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8">

        {/* HEADER DAN SEARCH */}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

          <div>
            <h2 className="mt-0 text-2xl font-bold tracking-tight text-[#251A3D] sm:text-[28px]">
              Jelajahi Kelas
            </h2>

            <p className="mt-1.5 text-xs leading-6 text-[#9B95AB] sm:text-sm">
              Pilih kelas dan mulai kembangkan kemampuanmu.
            </p>
          </div>

          {/* SEARCH */}

          <div className="w-full lg:max-w-[380px]">

            <label
              htmlFor="search-course"
              className="sr-only"
            >
              Cari kelas
            </label>

            <div className="flex h-[46px] items-center gap-3 rounded-xl border border-[#EEEAF7] bg-white px-4 shadow-[0_2px_10px_rgba(20,60,50,0.025)] transition focus-within:border-[#AA8AFF] focus-within:ring-4 focus-within:ring-[#6D28D9]/5">

              <Search
                size={18}
                className="shrink-0 text-[#9D97B4]"
              />

              <input
                id="search-course"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kelas yang ingin dipelajari..."
                className="w-full bg-transparent text-sm text-[#1B1730] outline-none placeholder:text-[#AAA5B8]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Hapus pencarian"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9B95AB] transition hover:bg-[#F7F4FD] hover:text-[#5B21B6]"
                >
                  <X size={15} />
                </button>
              )}

            </div>

          </div>

        </div>

        {/* =====================================
            CATEGORY FILTER
        ===================================== */}

        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1.5 sm:mt-7 sm:pb-2">

          {categories.map((category) => {
            const active = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={active}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition duration-200 ${
                  active
                    ? "bg-[#5B21B6] text-white shadow-[0_3px_10px_rgba(91,33,182,0.16)]"
                    : "border border-[#EEEAF7] bg-white text-[#817A97] hover:border-[#C8B2FF] hover:bg-[#FBFAFF] hover:text-[#5B21B6]"
                }`}
              >
                {category}
              </button>
            );
          })}

        </div>

        {/* =====================================
            COURSE COUNT
        ===================================== */}

        <div className="mb-3 mt-3 flex items-center justify-between sm:mb-5 sm:mt-5">

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0EAFE] text-[#6D28D9]">
              <BookOpen size={16} />
            </div>

            <span className="text-sm font-bold text-[#302044]">
              Semua Kelas
            </span>
          </div>

          <p className="text-xs text-[#84958F]">
            <span className="font-bold text-[#5B21B6]">
              {filteredCourses.length}
            </span>{" "}
            kelas tersedia
          </p>

        </div>

        {/* =====================================
            ERROR STATE
        ===================================== */}

        {loadError ? (

          <div className="rounded-2xl border border-red-100 bg-white px-5 py-14 text-center shadow-sm">

            <p className="font-semibold text-red-700">
              Katalog belum dapat dimuat.
            </p>

            <p className="mt-2 text-sm text-[#9B95AB]">
              Silakan periksa koneksi database dan kebijakan akses kelas.
            </p>

          </div>

        ) : filteredCourses.length === 0 ? (

          /* =====================================
              EMPTY STATE
          ===================================== */

          <div className="rounded-2xl border border-[#EEEAF7] bg-white px-5 py-16 text-center shadow-sm">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#6D28D9]">
              <BookOpen size={28} strokeWidth={1.5} />
            </div>

            <h3 className="mt-5 text-base font-bold text-[#3E315D]">
              {courses.length === 0
                ? "Belum Ada Kelas"
                : "Kelas Tidak Ditemukan"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-[#9B95AB]">
              {courses.length === 0
                ? "Kelas yang sudah dipublikasikan administrator akan tampil di sini."
                : "Coba gunakan kata kunci atau kategori pencarian lainnya."}
            </p>

            {courses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("Semua");
                }}
                className="mt-5 rounded-xl bg-[#F3EEFF] px-4 py-2.5 text-xs font-bold text-[#6D28D9] transition hover:bg-[#EEE7FF]"
              >
                Reset Pencarian
              </button>
            )}

          </div>

        ) : (

          /* =====================================
              COURSE CARDS
          ===================================== */

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:gap-6">

            {filteredCourses.map((course) => (

              <article
                key={course.id}
                className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#EEEAF7] bg-white shadow-[0_3px_18px_rgba(25,65,52,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-[#DED0FF] hover:shadow-[0_12px_30px_rgba(25,65,52,0.09)] sm:rounded-2xl"
              >

                {/* COVER */}

                <Link
                  href={`/kelas/${course.slug}`}
                  className="relative block aspect-[16/9] overflow-hidden bg-[#F3EEFF]"
                >

                  {course.cover_image_url ? (

                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />

                  ) : (

                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#F3EEFF] to-[#EAE1FF] text-[#6D28D9]">
                      <BookOpen
                        size={42}
                        strokeWidth={1.3}
                      />
                    </div>

                  )}

                  {/* CATEGORY BADGE */}

                  {course.category && (

                    <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md border border-white/60 bg-white/95 px-2 py-1 text-[8px] font-bold text-[#6D28D9] shadow-sm backdrop-blur sm:left-3 sm:top-3 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[10px]">
                      {course.category}
                    </span>

                  )}

                  {/* IMAGE OVERLAY */}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/10 to-transparent" />

                </Link>

                {/* COURSE INFORMATION */}

                <div className="flex flex-1 flex-col p-2.5 sm:p-5">

                  {/* TITLE */}

                  <Link
                    href={`/kelas/${course.slug}`}
                    className="line-clamp-2 text-[12px] font-bold leading-4 text-[#251A3D] transition hover:text-[#6D28D9] sm:text-[15px] sm:leading-6"
                  >
                    {course.title}
                  </Link>

                  {/* DESCRIPTION */}

                  <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[10px] leading-4 text-[#84958F] sm:mt-2 sm:min-h-[40px] sm:text-xs sm:leading-5">
                    {course.short_description ||
                      course.description ||
                      "Pelajari program ini bersama Kiki Creator Class."}
                  </p>

                  {/* MENTOR */}

                  <div className="mt-2 flex min-h-[18px] items-center gap-1.5 sm:mt-3 sm:min-h-[20px] sm:gap-2">

                    {course.mentor_name && (
                      <>
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F3EEFF] text-[#6D28D9] sm:h-6 sm:w-6">
                          <GraduationCap size={11} />
                        </div>

                        <span className="truncate text-[9px] font-medium text-[#817A97] sm:text-[11px]">
                          {course.mentor_name}
                        </span>
                      </>
                    )}

                  </div>

                  {/* PRICE AND ACTION */}

                  <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-[#F8F6FD] pt-2.5 sm:gap-3 sm:pt-4">

                    <div className="min-w-0">

                      <p className="text-[9px] font-medium text-[#9D97B4] sm:text-[10px]">
                        Harga kelas
                      </p>

                      <p className="mt-0.5 text-[11px] font-bold tracking-tight text-[#5B21B6] sm:mt-1 sm:text-[15px]">
                        {formatPrice(course.price)}
                      </p>

                    </div>

                    <Link
                      href={`/kelas/${course.slug}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#F3EEFF] px-2 py-2 text-[9px] font-bold text-[#6D28D9] transition duration-200 hover:bg-[#5B21B6] hover:text-white active:scale-[0.97] sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[11px]"
                    >
                      <span className="sm:hidden">Detail</span>
                      <span className="hidden sm:inline">Lihat Detail</span>

                      <ArrowRight size={12} className="sm:hidden" />
                      <ArrowRight size={14} className="hidden sm:block" />
                    </Link>

                  </div>

                </div>

              </article>

            ))}

          </div>

        )}

      </section>

      {/* =========================================
          FOOTER
      ========================================= */}

      <footer className="border-t border-[#EEEAF7] bg-white">

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">

          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-[#5B21B6]"
          >
            <GraduationCap size={19} />
            Kiki Creator Class
          </Link>

          <p className="text-[10px] text-[#9D97B4]">
            © 2026 Kiki Creator Class. All rights reserved.
          </p>

        </div>

      </footer>

    </main>
  );
}