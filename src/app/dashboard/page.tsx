
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Home,
  Compass,
  BookOpen,
  CheckCircle2,
  Clock3,
  CircleAlert,
  GraduationCap,
  ReceiptText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";
import ImpersonationSwitcher from "@/components/impersonation/impersonation-switcher";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

// =====================================================
// TYPES
// =====================================================

type Profile = {
  full_name: string | null;
};

type Enrollment = {
  id: string;
  course_id: string;
  status: string;
  granted_at: string | null;
  created_at: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  category: string | null;
};

type Order = {
  id: string;
  invoice_number: string;
  status: string;
  total: number | string;
  currency: string;
  created_at: string;
};

type OrderItem = {
  order_id: string;
  course_title_snapshot: string | null;
};

// =====================================================
// HELPERS
// =====================================================

function formatMoney(
  value: number | string,
  currency = "IDR"
) {
  const safeCurrency = /^[A-Z]{3}$/.test(currency)
    ? currency
    : "IDR";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getOrderStatus(status: string) {
  switch (status) {
    case "paid":
      return {
        label: "Pembayaran Berhasil",
        className: "bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };

    case "waiting_verification":
      return {
        label: "Menunggu Verifikasi",
        className: "bg-amber-50 text-amber-700",
        icon: Clock3,
      };

    case "pending_payment":
      return {
        label: "Menunggu Pembayaran",
        className: "bg-slate-100 text-slate-600",
        icon: Clock3,
      };

    case "rejected":
      return {
        label: "Pembayaran Ditolak",
        className: "bg-rose-50 text-rose-700",
        icon: CircleAlert,
      };

    default:
      return {
        label: status,
        className: "bg-slate-100 text-slate-600",
        icon: Clock3,
      };
  }
}

// =====================================================
// DASHBOARD MEMBER
// =====================================================

export default async function MemberDashboardPage() {
  await connection();

  const supabase = await createClient();

  // ===================================================
  // 1. AUTHENTICATION
  // ===================================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // ===================================================
  // 2. ROLE CHECK
  // ===================================================

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(`Gagal memeriksa role akun: ${roleError.message}`);
  }

  const roles = normalizeRoles(roleRows);

  const primaryRole = getPrimaryRole(roles);

  if (primaryRole === "admin") {
    redirect("/admin");
  }

  if (primaryRole === "instructor") {
    redirect("/mentor");
  }

  if (primaryRole !== "member") {
    redirect("/login?reason=role-unassigned");
  }

  // ===================================================
  // 3. LOAD MEMBER DATA
  // ===================================================

  const [
    profileResult,
    enrollmentResult,
    orderResult,
    pendingOrderResult,
  ] = await Promise.all([

    // PROFILE
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),

    // ACTIVE ENROLLMENTS
    supabase
      .from("enrollments")
      .select(`
        id,
        course_id,
        status,
        granted_at,
        created_at
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      }),

    // RECENT PURCHASES
    supabase
      .from("orders")
      .select(`
        id,
        invoice_number,
        status,
        total,
        currency,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(5),

    // LATEST PENDING PAYMENT
    supabase
      .from("orders")
      .select(`
        id,
        invoice_number,
        status,
        total,
        currency,
        created_at
      `)
      .eq("user_id", user.id)
      .in("status", [
        "waiting_verification",
        "pending_payment",
      ])
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),

  ]);

  const profile =
    profileResult.data as Profile | null;

  const enrollments =
    (enrollmentResult.data ?? []) as Enrollment[];

  const orders =
    (orderResult.data ?? []) as Order[];

  const pendingOrder =
    pendingOrderResult.data as Order | null;

  const memberName =
    profile?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Member";

  const firstName = memberName.split(/\s+/)[0];

  // ===================================================
  // 4. LOAD ACTIVE COURSES
  // ===================================================

  const courseIds = [
    ...new Set(
      enrollments.map((item) => item.course_id)
    ),
  ];

  let courses: Course[] = [];
  let courseError = "";

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select(`
        id,
        title,
        slug,
        short_description,
        cover_image_url,
        category
      `)
      .in("id", courseIds);

    if (error) {
      courseError = error.message;
    } else {
      courses = (data ?? []) as Course[];
    }
  }

  // ===================================================
  // 5. LOAD PURCHASE ITEMS
  // ===================================================

  const orderIds = [
    ...new Set([
      ...orders.map((item) => item.id),
      ...(pendingOrder ? [pendingOrder.id] : []),
    ]),
  ];

  let orderItems: OrderItem[] = [];
  let orderItemsError = "";

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from("order_items")
      .select(`
        order_id,
        course_title_snapshot
      `)
      .in("order_id", orderIds);

    if (error) {
      orderItemsError = error.message;
    } else {
      orderItems = (data ?? []) as OrderItem[];
    }
  }

  // ===================================================
  // 6. DATA MAPPING
  // ===================================================

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const enrolledCourses = enrollments
    .map((enrollment) => ({
      enrollment,
      course: courseMap.get(enrollment.course_id),
    }))
    .filter(
      (
        item
      ): item is {
        enrollment: Enrollment;
        course: Course;
      } => Boolean(item.course)
    );

  const orderItemMap = new Map<string, string[]>();

  orderItems.forEach((item) => {
    const existing =
      orderItemMap.get(item.order_id) ?? [];

    if (item.course_title_snapshot) {
      existing.push(item.course_title_snapshot);
    }

    orderItemMap.set(item.order_id, existing);
  });

  const getOrderTitle = (orderId: string) => {
    const titles = orderItemMap.get(orderId) ?? [];

    return titles.length > 0
      ? titles.join(", ")
      : "Pembelian kelas Kiki Creator Class";
  };

  const dashboardError =
    enrollmentResult.error?.message ||
    courseError;

  const isWaitingVerification =
    pendingOrder?.status === "waiting_verification";

  // ===================================================
  // 7. RENDER
  // ===================================================

  return (
    <main className="min-h-screen bg-[#F8F7FC] pb-24 text-[#1B1730] md:pb-0">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 border-b border-[#F1EDF8] bg-white/95 backdrop-blur-xl">

        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

          {/* BRAND */}

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B21B6] text-white">
              <GraduationCap size={22} />
            </div>

            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-[#251A3D]">
                Kiki Creator Class
              </h1>

              <p className="text-[10px] text-[#9D97B4]">
                Learn · Create · Grow
              </p>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}

          <nav className="hidden items-center gap-8 md:flex">

            <Link
              href="/dashboard"
              className="text-xs font-bold text-[#6D28D9]"
            >
              Beranda
            </Link>

            <Link
              href="#kelas-saya"
              className="text-xs font-medium text-[#817A97] transition hover:text-[#6D28D9]"
            >
              Kelas Saya
            </Link>

            <Link
              href="/kelas"
              className="text-xs font-medium text-[#817A97] transition hover:text-[#6D28D9]"
            >
              Jelajahi Kelas
            </Link>

            <Link
              href="#pembelian"
              className="text-xs font-medium text-[#817A97] transition hover:text-[#6D28D9]"
            >
              Pembelian
            </Link>

            <Link
              href="/dashboard/sertifikat"
              className="text-xs font-medium text-[#817A97] transition hover:text-[#6D28D9]"
            >
              Sertifikat Saya
            </Link>

          </nav>

          {/* MODE PENGUJIAN + PROFILE */}

          <ImpersonationSwitcher showWhenInactive={false} />

          <div className="flex items-center gap-2.5 rounded-xl border border-[#F1EDF8] bg-white px-3 py-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3EEFF] text-xs font-bold text-[#6D28D9]">
              {memberName.charAt(0).toUpperCase()}
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[130px] truncate text-[11px] font-bold text-[#5D5473]">
                {memberName}
              </p>

              <p className="max-w-[130px] truncate text-[9px] text-[#9D97B4]">
                {user.email}
              </p>
            </div>

          </div>
          <LogoutButton compact />

        </div>

      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-6 sm:pt-9 lg:px-8">

        {/* =================================================
            WELCOME SECTION
        ================================================= */}

        <section className="relative overflow-hidden rounded-[26px] border border-[#EEE7FF] bg-gradient-to-br from-[#F3EEFF] via-[#F4F0FF] to-[#FAF9FF] px-6 py-8 sm:px-9 sm:py-10">

          {/* DECORATION */}

          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[#D8C7FF]/50" />

          <div className="pointer-events-none absolute -right-4 -top-12 h-52 w-52 rounded-full border border-[#D8C7FF]/50" />

          <div className="relative z-10 flex flex-col justify-between gap-7 md:flex-row md:items-center">

            <div className="max-w-2xl">

              <div className="inline-flex items-center gap-2 rounded-full border border-[#DED0FF] bg-white/70 px-3 py-1.5 text-[9px] font-bold tracking-wider text-[#6D28D9]">
                <Sparkles size={12} />
                RUANG BELAJAR MEMBER
              </div>

              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[#332052] sm:text-3xl lg:text-4xl">
                Halo, {firstName}!
              </h2>

              <p className="mt-3 max-w-lg text-xs leading-6 text-[#77718A] sm:text-sm">
                Senang melihatmu kembali.
                Yuk, lanjutkan perjalanan belajar dan
                kembangkan kemampuanmu bersama Kiki Creator Class.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">

                <Link
                  href="#kelas-saya"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5B21B6] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#6D28D9]"
                >
                  Kelas Saya
                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/kelas"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#DED0FF] bg-white/80 px-5 py-3 text-xs font-bold text-[#5B21B6] transition hover:bg-white"
                >
                  Jelajahi Kelas
                </Link>

              </div>

            </div>

            {/* HERO VISUAL */}

            <div className="hidden shrink-0 md:block">

              <div className="relative flex h-40 w-40 items-center justify-center rounded-[32px] border border-white/80 bg-white/60 shadow-[0_15px_45px_rgba(25,94,77,0.08)]">

                <div className="absolute inset-4 rounded-[25px] bg-[#F0EAFE]" />

                <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#5B21B6] text-white shadow-lg">
                  <GraduationCap size={42} strokeWidth={1.5} />
                </div>

                <div className="absolute -bottom-3 -right-3 flex h-11 w-11 items-center justify-center rounded-2xl border-4 border-[#F4F0FF] bg-[#E8DEFF] text-[#6D28D9]">
                  <CheckCircle2 size={21} />
                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            PENDING PAYMENT NOTIFICATION
        ================================================= */}

        {pendingOrder && (

          <section className="mt-6">

            <div className="flex flex-col justify-between gap-4 rounded-[20px] border border-amber-200 bg-[#FFFCF3] p-5 sm:flex-row sm:items-center sm:p-6">

              <div className="flex min-w-0 items-start gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Clock3 size={21} />
                </div>

                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="text-sm font-bold text-[#79551B]">
                      {isWaitingVerification
                        ? "Pembayaran Sedang Diverifikasi"
                        : "Selesaikan Pembayaran Kelas"}
                    </h3>

                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold text-amber-800">
                      {isWaitingVerification
                        ? "Dalam Pemeriksaan"
                        : "Belum Dibayar"}
                    </span>

                  </div>

                  <p className="mt-1.5 text-[11px] leading-5 text-[#967C4C]">
                    {isWaitingVerification
                      ? "Bukti pembayaran sudah diterima. Admin sedang memeriksa pembayaranmu. Akses kelas akan aktif setelah disetujui."
                      : "Pesanan kelasmu sudah dibuat. Selesaikan pembayaran agar Admin dapat memproses pembelianmu."}
                  </p>

                  <p className="mt-2 break-all text-[10px] font-semibold text-[#79551B]">
                    Invoice: {pendingOrder.invoice_number}
                  </p>

                </div>

              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">

                <p className="text-sm font-extrabold text-[#79551B]">
                  {formatMoney(
                    pendingOrder.total,
                    pendingOrder.currency
                  )}
                </p>

                <Link
                  href={`/checkout/${pendingOrder.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B7791F] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#986515]"
                >
                  {isWaitingVerification
                    ? "Lihat Status Pembayaran"
                    : "Lanjutkan Pembayaran"}

                  <ArrowRight size={13} />
                </Link>

              </div>

            </div>

          </section>

        )}

        {/* =================================================
            MY COURSES
        ================================================= */}

        <section
          id="kelas-saya"
          className="mt-10 scroll-mt-24"
        >

          {/* SECTION HEADING */}

          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

            <div>

              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
                <BookOpen size={13} />
                MY LEARNING
              </div>

              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-[#3E315D] sm:text-2xl">
                Kelas Saya
              </h2>

              <p className="mt-1.5 text-xs text-[#9D97B4]">
                Semua kelas yang sudah kamu miliki.
              </p>

            </div>

            <Link
              href="/kelas"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6D28D9] transition hover:text-[#5B21B6]"
            >
              Temukan kelas lainnya
              <ArrowUpRight size={15} />
            </Link>

          </div>

          {/* ERROR */}

          {dashboardError ? (

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-700">
              Tidak dapat memuat kelas: {dashboardError}
            </div>

          ) : enrolledCourses.length > 0 ? (

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {enrolledCourses.map(({ enrollment, course }) => (

                <article
                  key={enrollment.id}
                  className="group overflow-hidden rounded-[22px] border border-[#F1EDF8] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(25,65,52,0.08)]"
                >

                  {/* COVER */}

                  <Link
                    href={`/kelas/${encodeURIComponent(course.slug)}/belajar`}
                    className="relative block aspect-[16/9] overflow-hidden bg-[#F3EEFF]"
                  >

                    {course.cover_image_url ? (

                      <img
                        src={course.cover_image_url}
                        alt={course.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                    ) : (

                      <div className="flex h-full items-center justify-center text-[#6D28D9]">
                        <BookOpen size={44} strokeWidth={1.3} />
                      </div>

                    )}

                    <div className="absolute left-3 top-3">

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-bold text-emerald-700 shadow-sm">
                        <CheckCircle2 size={12} />
                        Kelas Aktif
                      </span>

                    </div>

                  </Link>

                  {/* COURSE INFORMATION */}

                  <div className="p-5">

                    {course.category && (

                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#6D28D9]">
                        {course.category}
                      </p>

                    )}

                    <h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-6 text-[#3E315D]">
                      {course.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 min-h-10 text-[11px] leading-5 text-[#9D97B4]">
                      {course.short_description ||
                        "Program pembelajaran Kiki Creator Class."}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-[#F8F6FD] pt-4">

                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                        <ShieldCheck size={14} />
                        Akses tersedia
                      </div>

                      <Link
                        href={`/kelas/${encodeURIComponent(course.slug)}/belajar`}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#5B21B6] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#6D28D9]"
                      >
                        Buka Kelas
                        <ArrowRight size={13} />
                      </Link>

                    </div>

                  </div>

                </article>

              ))}

            </div>

          ) : (

            /* EMPTY STATE */

            <div className="overflow-hidden rounded-[24px] border border-[#EEEAF7] bg-white px-5 py-12 text-center sm:py-16">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F3EEFF] text-[#6D28D9]">
                <BookOpen size={30} strokeWidth={1.5} />
              </div>

              <h3 className="mt-5 text-base font-extrabold text-[#5D5473]">
                Belum Ada Kelas di Sini
              </h3>

              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#9D97B4]">
                Kelas yang sudah kamu beli dan disetujui oleh
                Admin akan otomatis muncul di halaman ini.
                Yuk, temukan kelas pertamamu!
              </p>

              <Link
                href="/kelas"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#5B21B6] px-6 py-3 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
              >
                Jelajahi Kelas
                <ArrowRight size={15} />
              </Link>

            </div>

          )}

        </section>

        {/* =================================================
            PURCHASE HISTORY
        ================================================= */}

        <section
          id="pembelian"
          className="mt-12 scroll-mt-24"
        >

          <div className="mb-5">

            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
              <ReceiptText size={13} />
              MY PURCHASES
            </div>

            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-[#3E315D]">
              Pembelian Saya
            </h2>

            <p className="mt-1.5 text-xs text-[#9D97B4]">
              Lihat invoice dan status pembayaran kelasmu.
            </p>

          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#F1EDF8] bg-white">

            {orderItemsError && (

              <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-[10px] text-amber-800">
                Sebagian informasi nama kelas belum dapat dimuat.
              </div>

            )}

            {orders.length > 0 ? (

              <div className="divide-y divide-[#F8F6FD]">

                {orders.map((order) => {

                  const status = getOrderStatus(order.status);
                  const StatusIcon = status.icon;

                  return (

                    <div
                      key={order.id}
                      className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="flex min-w-0 items-start gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#6D28D9]">
                          <ReceiptText size={19} />
                        </div>

                        <div className="min-w-0">

                          <p className="break-all text-xs font-bold text-[#5D5473]">
                            {order.invoice_number}
                          </p>

                          <p className="mt-1 truncate text-[10px] text-[#9D97B4]">
                            {getOrderTitle(order.id)}
                          </p>

                          <p className="mt-1 text-[9px] text-[#AAA5B8]">
                            {formatDate(order.created_at)}
                          </p>

                        </div>

                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">

                        <div className="sm:text-right">

                          <p className="text-xs font-extrabold text-[#3E315D]">
                            {formatMoney(
                              order.total,
                              order.currency
                            )}
                          </p>

                          <span
                            className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold ${status.className}`}
                          >
                            <StatusIcon size={11} />
                            {status.label}
                          </span>

                        </div>

                        <Link
                          href={`/checkout/${order.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#EEEAF7] px-3 py-2.5 text-[10px] font-bold text-[#6D28D9] transition hover:bg-[#F8F6FD]"
                        >
                          Lihat Invoice
                          <ArrowUpRight size={13} />
                        </Link>

                      </div>

                    </div>

                  );

                })}

              </div>

            ) : (

              <div className="px-5 py-12 text-center">

                <ReceiptText
                  size={30}
                  className="mx-auto text-[#C8B2FF]"
                />

                <p className="mt-3 text-xs font-bold text-[#5D5473]">
                  Belum Ada Pembelian
                </p>

                <p className="mt-1 text-[10px] text-[#9D97B4]">
                  Riwayat pembelian kelasmu akan muncul di sini.
                </p>

              </div>

            )}

            <div className="flex items-center justify-between border-t border-[#F8F6FD] bg-[#FFFFFF] px-5 py-3">

              <p className="text-[9px] text-[#9D97B4]">
                Maksimal 5 pembelian terbaru.
              </p>

              <ShieldCheck
                size={14}
                className="text-[#6D28D9]"
              />

            </div>

          </div>

        </section>

        {/* =================================================
            EXPLORE MORE
        ================================================= */}

        <section className="relative mt-10 overflow-hidden rounded-[24px] bg-[#5B21B6] px-6 py-7 text-white sm:px-9 sm:py-8">

          <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full border border-white/10" />

          <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

            <div>

              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#D8C7FF]">
                <Sparkles size={13} />
                KEEP GROWING
              </div>

              <h3 className="mt-3 text-lg font-extrabold sm:text-xl">
                Masih Banyak Hal untuk Dipelajari
              </h3>

              <p className="mt-2 max-w-lg text-[11px] leading-6 text-[#E8DEFF]">
                Temukan program pembelajaran lainnya dan
                terus tingkatkan kemampuanmu bersama Kiki Creator Class.
              </p>

            </div>

            <Link
              href="/kelas"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-[#5B21B6] transition hover:bg-[#F3EEFF]"
            >
              Lihat Semua Kelas
              <ArrowRight size={15} />
            </Link>

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[#F1EDF8] pt-6 text-center sm:flex-row">

          <div>
            <p className="text-xs font-extrabold text-[#5B21B6]">
              Kiki Creator Class
            </p>

            <p className="mt-1 text-[9px] text-[#9D97B4]">
              Learn · Create · Grow
            </p>
          </div>

          <p className="text-[10px] text-[#9D97B4]">
            © {new Date().getFullYear()} Kiki Creator Class.
            All rights reserved.
          </p>

        </footer>

      </div>

      <nav aria-label="Navigasi member" className="fixed bottom-3 left-3 right-3 z-40 flex items-center justify-around rounded-[22px] border border-white/80 bg-white/95 px-1.5 py-2 shadow-[0_12px_35px_rgba(38,27,72,.14)] backdrop-blur-xl md:hidden" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        <Link href="/dashboard" className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold text-violet-700"><span className="flex h-8 w-9 items-center justify-center rounded-xl bg-[#F1EBFF]"><Home size={18} /></span>Beranda</Link>
        <Link href="#kelas-saya" className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold text-[#9A95A9]"><span className="flex h-8 w-9 items-center justify-center rounded-xl"><BookOpen size={18} /></span>Kelas Saya</Link>
        <Link href="/kelas" className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold text-[#9A95A9]"><span className="flex h-8 w-9 items-center justify-center rounded-xl"><Compass size={18} /></span>Jelajahi</Link>
        <Link href="#pembelian" className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold text-[#9A95A9]"><span className="flex h-8 w-9 items-center justify-center rounded-xl"><ReceiptText size={18} /></span>Pembelian</Link>
        <Link href="/dashboard/sertifikat" className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold text-[#9A95A9]"><span className="flex h-8 w-9 items-center justify-center rounded-xl"><Award size={18} /></span>Sertifikat</Link>
      </nav>
    </main>
  );
}
