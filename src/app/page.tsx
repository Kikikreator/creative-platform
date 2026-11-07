import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Infinity,
  Layers3,
  MessageCircle,
  MonitorPlay,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  price: number | string;
};

const ADMIN_WHATSAPP_NUMBER = "6281270885153";
const ADMIN_WHATSAPP_MESSAGE =
  "Halo Admin Kiki Creator Class, saya tertarik dengan kelas yang tersedia. Boleh minta informasi tentang pilihan kelas, materi yang dipelajari, biaya pendaftaran, sistem belajar, dan cara bergabung? Terima kasih.";
const ADMIN_WHATSAPP_URL = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  ADMIN_WHATSAPP_MESSAGE
)}`;

const learningSteps = [
  {
    number: "01",
    icon: MonitorPlay,
    iconStyle: "bg-sky-50 text-sky-600 ring-sky-100",
    title: "Belajar melalui website",
    description:
      "Masuk ke akun peserta dan buka ruang belajar khusus untuk mengakses video serta materi kelas.",
  },
  {
    number: "02",
    icon: Layers3,
    iconStyle: "bg-violet-50 text-violet-600 ring-violet-100",
    title: "Ikuti materi secara bertahap",
    description:
      "Materi disusun dalam bab, materi inti, dan mini materi agar kamu lebih mudah mengikuti alur pembelajaran.",
  },
  {
    number: "03",
    icon: ClipboardCheck,
    iconStyle: "bg-orange-50 text-orange-600 ring-orange-100",
    title: "Praktik dan kumpulkan tugas",
    description:
      "Terapkan materi melalui tugas kelas, lalu pantau hasil penilaian dan masukan dari mentor.",
  },
  {
    number: "04",
    icon: Award,
    iconStyle: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    title: "Selesaikan kelas dan raih sertifikat",
    description:
      "Penuhi persyaratan pembelajaran, persetujuan tugas, serta ulasan kelas untuk membuka sertifikat kelulusan.",
  },
];

const features = [
  {
    icon: Infinity,
    iconStyle: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    title: "Sekali bayar, akses selamanya",
    description:
      "Setelah pembelian disetujui, kamu dapat mengakses kelas yang dibeli tanpa biaya berlangganan bulanan.",
  },
  {
    icon: BookOpen,
    iconStyle: "bg-violet-50 text-violet-600 ring-violet-100",
    title: "Materi tersusun dan terarah",
    description:
      "Belajar dari materi dasar secara bertahap sehingga kamu tidak perlu bingung menentukan langkah berikutnya.",
  },
  {
    icon: Clock3,
    iconStyle: "bg-sky-50 text-sky-600 ring-sky-100",
    title: "Waktu belajar lebih fleksibel",
    description:
      "Atur jadwal belajarmu sendiri dan ulangi materi melalui ruang belajar kapan pun kamu membutuhkannya.",
  },
  {
    icon: ClipboardCheck,
    iconStyle: "bg-orange-50 text-orange-600 ring-orange-100",
    title: "Belajar sambil menghasilkan karya",
    description:
      "Latihan dan tugas membantumu menerapkan materi, bukan hanya menonton video pembelajaran.",
  },
  {
    icon: MessageCircle,
    iconStyle: "bg-pink-50 text-pink-600 ring-pink-100",
    title: "Ada penilaian dan masukan mentor",
    description:
      "Hasil tugas dapat ditinjau mentor agar kamu mengetahui bagian yang sudah baik dan yang masih perlu ditingkatkan.",
  },
  {
    icon: BadgeCheck,
    iconStyle: "bg-amber-50 text-amber-600 ring-amber-100",
    title: "Kesempatan memperoleh sertifikat",
    description:
      "Sertifikat tersedia setelah seluruh ketentuan kelulusan kelas berhasil kamu penuhi.",
  },
];

function formatPrice(price: number | string) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) return "Hubungi kami";
  if (amount === 0) return "Gratis";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function CourseSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
        >
          <div className="h-40 animate-pulse bg-[#F4F0F6] sm:h-48" />
          <div className="space-y-3 p-4 sm:p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function FeaturedCourses() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, slug, short_description, description, cover_image_url, price"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <BookOpen size={27} />
        </div>
        <h3 className="mt-4 font-bold text-slate-800">
          Katalog belum dapat dimuat
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Ada kendala saat mengambil daftar kelas. Silakan muat ulang halaman
          atau hubungi admin untuk mendapatkan informasi kelas.
        </p>
        <a
          href={ADMIN_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #22C55E 0%, #0F9D78 58%, #087F5B 100%)",
          }}
        >
          <MessageCircle size={17} />
          Tanya Admin
        </a>
      </div>
    );
  }

  const courses = (data ?? []) as Course[];

  if (courses.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#D9CDDF] bg-white p-7 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F0F6] text-[#260047]">
          <GraduationCap size={28} />
        </div>

        <h3 className="mt-4 text-lg font-bold text-slate-800">
          Kelas sedang disiapkan
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Kami sedang menyiapkan program pembelajaran. Hubungi admin untuk
          mengetahui informasi kelas yang tersedia.
        </p>
        <a
          href={ADMIN_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #22C55E 0%, #0F9D78 58%, #087F5B 100%)",
          }}
        >
          <MessageCircle size={17} />
          Tanya Kelas via WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 min-[480px]:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {courses.map((course) => (
        <Link
          key={course.id}
          href={`/kelas/${course.slug}`}
          className="group overflow-hidden rounded-2xl border border-[#EAE5ED] bg-white shadow-[0_3px_14px_rgba(38,0,71,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(38,0,71,0.11)]"
        >
          <div
            role="img"
            aria-label={`Cover ${course.title}`}
            className="relative flex h-40 items-center justify-center overflow-hidden bg-[#F4F0F6] bg-cover bg-center sm:h-48"
            style={
              course.cover_image_url
                ? {
                    backgroundImage: `url("${course.cover_image_url}")`,
                  }
                : undefined
            }
          >
            {!course.cover_image_url && (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#260047] shadow-sm">
                <GraduationCap size={28} />
              </div>
            )}

            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-[#260047] shadow-sm">
              KELAS PILIHAN
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <h3 className="line-clamp-2 text-base font-bold text-slate-900 transition group-hover:text-[#09483F] sm:text-lg">
              {course.title}
            </h3>

            <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500 sm:text-sm">
              {course.short_description ||
                course.description ||
                "Pelajari materi lengkap melalui kelas Kiki Creator Class."}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 sm:mt-5 sm:pt-4">
              <div>
                <p className="text-[10px] text-slate-400 sm:text-[11px]">
                  Investasi belajar
                </p>
                <p className="mt-1 text-sm font-bold text-[#260047] sm:text-base">
                  {formatPrice(course.price)}
                </p>
              </div>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#260047] text-white transition group-hover:bg-[#09483F] sm:h-10 sm:w-10">
                <ArrowRight size={17} />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function Home() {
  // Akun yang sudah login diarahkan kembali ke workspace sesuai perannya.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) redirect("/login?reason=role-check-failed");

    const roles = normalizeRoles(roleRows);
    const primaryRole = getPrimaryRole(roles);
    if (primaryRole === "admin") redirect("/admin");
    if (primaryRole === "instructor") redirect("/mentor");
    if (primaryRole === "member") redirect("/dashboard");
    redirect("/login?reason=role-unassigned");
  }

  return (
    <main
      id="beranda"
      className="min-h-screen overflow-hidden bg-white text-slate-900"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[#EAE5ED] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-2 px-4 sm:h-[76px] sm:px-5 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2.5 sm:gap-3"
          >
            <Image
              src="/logo_brand.png"
              alt="Kiki Creator Class Logo"
              width={48}
              height={48}
              priority
              className="h-9 w-9 shrink-0 rounded-xl object-contain sm:h-11 sm:w-11"
            />

            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold tracking-tight text-slate-900 sm:text-base">
                Kiki Creator Class
              </p>
              <p className="hidden text-[9px] font-semibold uppercase tracking-[0.17em] text-[#09483F] min-[370px]:block sm:text-[10px]">
                Learn · Create · Grow
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <Link
              href="#beranda"
              className="text-sm font-semibold text-[#260047]"
            >
              Beranda
            </Link>
            <Link
              href="#sistem-belajar"
              className="text-sm font-medium text-slate-600 transition hover:text-[#09483F]"
            >
              Sistem Belajar
            </Link>
            <Link
              href="#keunggulan"
              className="text-sm font-medium text-slate-600 transition hover:text-[#09483F]"
            >
              Keunggulan
            </Link>
            <Link
              href="#kelas"
              className="text-sm font-medium text-slate-600 transition hover:text-[#09483F]"
            >
              Kelas
            </Link>
            <Link
              href="#tentang"
              className="text-sm font-medium text-slate-600 transition hover:text-[#09483F]"
            >
              Tentang
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              Masuk
            </Link>
            <Link
              href="#kelas"
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#260047] px-3 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(38,0,71,0.16)] transition hover:bg-[#09483F] sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
            >
              Pilih Kelas
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#F0EBF2] bg-[#FAF8FB]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#E9F4F0] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#F0E8F7] blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:gap-10 sm:px-5 sm:py-16 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#EAE5ED] bg-white px-3 py-1.5 text-[10px] font-bold text-[#260047] shadow-sm sm:px-4 sm:py-2 sm:text-xs">
              <Sparkles size={13} className="text-amber-500" />
              RUANG BELAJAR DAN BERKEMBANG
            </div>

            <h1 className="mt-5 max-w-2xl text-[36px] font-extrabold leading-[1.1] tracking-tight text-[#21182A] sm:mt-7 sm:text-5xl lg:text-[58px]">
              Kembangkan Potensi,
              <span className="block text-[#260047]">
                Wujudkan Karya Terbaikmu.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:mt-6 sm:text-base sm:leading-8">
              Belajar desain dengan materi yang tersusun, praktik melalui
              tugas, dan kembangkan kemampuanmu selangkah demi selangkah
              bersama Kiki Creator Class.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-9 sm:gap-3">
              <Link
                href="#kelas"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-xs font-bold text-white shadow-[0_6px_16px_rgba(38,0,71,0.18)] transition hover:-translate-y-0.5 hover:bg-[#09483F] sm:h-12 sm:px-6 sm:text-sm"
              >
                Jelajahi Kelas
                <ArrowRight size={15} />
              </Link>
              <a
                href={ADMIN_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white shadow-[0_6px_18px_rgba(15,157,120,0.22)] transition hover:-translate-y-0.5 sm:h-12 sm:px-6 sm:text-sm"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #25D366 0%, #12A879 55%, #087F5B 100%)",
                }}
              >
                <MessageCircle size={16} />
                Tanya Admin
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 sm:mt-9 sm:gap-x-6 sm:gap-y-3">
              {[
                "Materi terstruktur",
                "Akses permanen",
                "Tugas dan penilaian",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 sm:gap-2 sm:text-xs"
                >
                  <CheckCircle2
                    size={14}
                    className="shrink-0 text-[#0F9D78]"
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* HERO VISUAL — menggunakan icon_01.png dari folder public */}
          <div className="relative mx-auto flex w-full max-w-[540px] items-center justify-center lg:max-w-[590px]">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EDE5F3] blur-3xl"
            />

            <div className="relative w-full max-w-[500px]">
              <Image
                src="/icon_01.png"
                alt="Buku ilustrasi desain kreatif Kiki Creator Class"
                width={1312}
                height={1199}
                priority
                className="relative z-10 h-auto w-full object-contain drop-shadow-[0_28px_34px_rgba(38,0,71,0.18)]"
              />

              <div className="absolute left-0 top-[17%] z-20 hidden items-center gap-2.5 rounded-2xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_12px_30px_rgba(38,0,71,0.10)] sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                  <Sparkles size={19} />
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-800">
                    Belajar kreatif
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    Kembangkan ide dan skill
                  </span>
                </span>
              </div>

              <div className="absolute bottom-[13%] right-0 z-20 hidden items-center gap-2.5 rounded-2xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_12px_30px_rgba(38,0,71,0.10)] sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BadgeCheck size={19} />
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-800">
                    Akses permanen
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    Belajar sesuai waktumu
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SISTEM BELAJAR */}
      <section
        id="sistem-belajar"
        className="scroll-mt-24 bg-white py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#0F9D78] sm:text-xs">
              SISTEM BELAJAR DI KELAS INI
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#21182A] sm:mt-3 sm:text-4xl">
              Belajar lebih terarah, dari materi hingga karya
            </h2>
            <p className="mt-3 text-xs leading-6 text-slate-500 sm:mt-4 sm:text-sm sm:leading-7">
              Kamu tidak hanya menonton materi. Ikuti alur belajar, praktikkan
              kemampuan, dan lihat perkembanganmu melalui ruang belajar Kiki
              Creator Class.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
            {learningSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.number}
                  className="relative rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_5px_20px_rgba(38,0,71,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(38,0,71,0.09)] sm:p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${step.iconStyle}`}
                    >
                      <Icon size={23} strokeWidth={1.9} />
                    </span>
                    <span className="text-2xl font-black tracking-tight text-[#EAE5ED]">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-extrabold leading-snug text-[#21182A]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* KENAPA HARUS IKUT KELAS INI */}
      <section
        id="keunggulan"
        className="scroll-mt-24 border-y border-[#F0EBF2] bg-[#FAF8FB] py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#0F9D78] sm:text-xs">
              KENAPA HARUS IKUT KELAS INI?
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#21182A] sm:mt-3 sm:text-4xl">
              Investasikan waktumu untuk skill yang bisa berkembang
            </h2>
            <p className="mt-3 text-xs leading-6 text-slate-500 sm:mt-4 sm:text-sm sm:leading-7">
              Dapatkan pengalaman belajar yang praktis dan fleksibel untuk
              membantumu meningkatkan kemampuan serta membangun portofolio karya.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:mt-12 sm:gap-5 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_4px_16px_rgba(38,0,71,0.035)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(38,0,71,0.08)] sm:p-6"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition group-hover:scale-105 ${feature.iconStyle}`}
                  >
                    <Icon size={23} strokeWidth={1.9} />
                  </div>
                  <h3 className="mt-4 text-sm font-extrabold leading-6 text-[#21182A] sm:text-base">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* KATALOG KELAS */}
      <section
        id="kelas"
        className="scroll-mt-24 bg-white py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#0F9D78] sm:text-xs">
                PROGRAM PEMBELAJARAN
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#21182A] sm:mt-3 sm:text-4xl">
                Temukan kelas pilihanmu
              </h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500 sm:mt-3 sm:text-sm sm:leading-7">
                Pilih program yang sesuai dengan minat dan tujuanmu. Setiap
                kelas dirancang agar proses belajar lebih mudah diikuti.
              </p>
            </div>

            <Link
              href="/kelas"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#260047] transition hover:text-[#0F9D78] sm:text-sm"
            >
              Lihat semua kelas
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-7 sm:mt-10">
            <Suspense fallback={<CourseSkeleton />}>
              <FeaturedCourses />
            </Suspense>
          </div>
        </div>
      </section>

      {/* CTA / TENTANG */}
      <section id="tentang" className="scroll-mt-24 bg-[#FAF8FB] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
          <div className="relative overflow-hidden rounded-[26px] bg-[#260047] px-5 py-10 shadow-[0_20px_55px_rgba(38,0,71,0.16)] sm:rounded-[32px] sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#0F9D78]/35 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#8B5CF6]/25 blur-3xl"
            />

            <div className="relative mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300 ring-1 ring-white/15 sm:h-14 sm:w-14">
                <Sparkles size={24} />
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:mt-6 sm:text-4xl">
                Siap mulai belajar dan membuat karya terbaikmu?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-xs leading-6 text-white/75 sm:mt-4 sm:text-sm sm:leading-7">
                Temukan kelas yang cocok untukmu. Jika masih ingin mengetahui
                materi, biaya, atau cara pendaftaran, admin kami siap membantu.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
                <Link
                  href="#kelas"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-extrabold text-[#260047] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F4F0F6] sm:h-12 sm:px-6 sm:text-sm"
                >
                  Lihat Pilihan Kelas
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={ADMIN_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-extrabold text-white shadow-[0_8px_22px_rgba(18,168,121,0.22)] transition hover:-translate-y-0.5 sm:h-12 sm:px-6 sm:text-sm"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #25D366 0%, #12A879 55%, #087F5B 100%)",
                  }}
                >
                  <MessageCircle size={17} />
                  Tanya Admin Sekarang
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#EAE5ED] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-11 sm:px-5 sm:py-14 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] lg:gap-12 lg:px-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo_brand.png"
                alt="Kiki Creator Class Logo"
                width={48}
                height={48}
                className="h-11 w-11 rounded-xl object-contain"
              />
              <span>
                <span className="block text-sm font-extrabold text-[#21182A]">
                  Kiki Creator Class
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0F9D78]">
                  Learn · Create · Grow
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-500 sm:text-sm">
              Ruang belajar online untuk membantu kamu mengembangkan kemampuan,
              menambah pengalaman, dan menghasilkan karya kreatif.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#21182A]">Navigasi</h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-500 sm:text-sm">
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="#beranda">
                  Beranda
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="#sistem-belajar">
                  Sistem Belajar
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="#keunggulan">
                  Keunggulan Kelas
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="/kelas">
                  Katalog Kelas
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#21182A]">Akun Peserta</h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-500 sm:text-sm">
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="/login">
                  Masuk
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="/register">
                  Daftar Akun
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#0F9D78]" href="#kelas">
                  Pilih Kelas
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#21182A]">Butuh Bantuan?</h3>
            <p className="mt-4 text-xs leading-6 text-slate-500 sm:text-sm">
              Punya pertanyaan tentang pilihan kelas, isi materi, biaya, atau
              proses pendaftaran? Silakan hubungi admin kami.
            </p>
            <a
              href={ADMIN_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(18,168,121,0.20)] transition hover:-translate-y-0.5 sm:text-sm"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #25D366 0%, #12A879 55%, #087F5B 100%)",
              }}
            >
              <MessageCircle size={17} />
              Chat Admin WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-[#F0EBF2]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:text-xs lg:px-8">
            <p>
              © {new Date().getFullYear()} Kiki Creator Class. Seluruh hak cipta
              dilindungi.
            </p>
            <p>Belajar hari ini, ciptakan peluang esok hari.</p>
          </div>
        </div>
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a
        href={ADMIN_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tanya Admin Kiki Creator Class melalui WhatsApp"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2.5 rounded-full px-4 py-3 text-xs font-extrabold text-white shadow-[0_12px_32px_rgba(8,127,91,0.30)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(8,127,91,0.38)] sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5 sm:text-sm"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #25D366 0%, #12A879 55%, #087F5B 100%)",
        }}
      >
        <MessageCircle size={19} />
        <span>Tanya Admin</span>
      </a>
    </main>
  );
}
