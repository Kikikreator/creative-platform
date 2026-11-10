import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Percent,
  Settings,
  ShieldCheck,
  UserRound,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavigation: AdminNavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "MANAJEMEN PEMBELAJARAN",
    items: [
      {
        title: "Manajemen Kelas",
        href: "/admin/kelas",
        icon: BookOpen,
      },
      {
        title: "Manajemen Materi",
        href: "/admin/materi",
        icon: BookOpenCheck,
      },
      {
        title: "Manajemen Tugas",
        href: "/admin/tugas",
        icon: ClipboardList,
      },
      {
        title: "Review Publikasi Mentor",
        href: "/admin/mentor/publikasi",
        icon: FileCheck2,
      },
      {
        title: "Sertifikat & Kelulusan",
        href: "/admin/sertifikat",
        icon: Award,
      },
    ],
  },
  {
    label: "MANAJEMEN PENGGUNA",
    items: [
      {
        title: "Pengguna & Akses",
        href: "/admin/pengguna",
        icon: Users,
      },
      {
        title: "Manajemen Mentor",
        href: "/admin/mentor",
        icon: GraduationCap,
      },
      {
        title: "Review Profil Mentor",
        href: "/admin/mentor/profil",
        icon: UserRound,
      },
      {
        title: "Hak Akses Member",
        href: "/admin/akses",
        icon: ShieldCheck,
      },
      {
        title: "Akses Alumni",
        href: "/admin/alumni",
        icon: UserPlus,
      },
    ],
  },
  {
    label: "KEUANGAN",
    items: [
      {
        title: "Transaksi",
        href: "/admin/transaksi",
        icon: CreditCard,
      },
      {
        title: "Pembayaran",
        href: "/admin/pembayaran",
        icon: Wallet,
      },
      {
        title: "Pendapatan",
        href: "/admin/pendapatan",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "ANALISIS & PEMASARAN",
    items: [
      {
        title: "Analisis Platform",
        href: "/admin/analisis",
        icon: BarChart3,
      },
      {
        title: "Promo & Voucher",
        href: "/admin/promo",
        icon: Percent,
      },
    ],
  },
  {
    label: "SISTEM",
    items: [
      {
        title: "Pengaturan",
        href: "/admin/pengaturan",
        icon: Settings,
        disabled: true,
        badge: "Perlu setup",
      },
      {
        title: "Log Aktivitas",
        href: "/admin/log-aktivitas",
        icon: Activity,
      },
    ],
  },
];

export function getAdminPageMeta(pathname: string) {
  if (pathname === "/admin") {
    return {
      title: "Dashboard",
      description:
        "Ringkasan performa platform, aktivitas, dan statistik utama.",
    };
  }

  if (pathname.startsWith("/admin/kelas")) {
    return {
      title: "Manajemen Kelas",
      description:
        "Kelola kelas, detail program, dan publikasi pembelajaran.",
    };
  }

  if (pathname.startsWith("/admin/materi")) {
    return {
      title: "Manajemen Materi",
      description:
        "Atur bab, lesson, urutan materi, dan struktur pembelajaran.",
    };
  }

  if (pathname.startsWith("/admin/tugas")) {
    return {
      title: "Manajemen Tugas",
      description:
        "Buat tugas kelas dan atur mentor yang bertanggung jawab memeriksa peserta.",
    };
  }

  if (pathname.startsWith("/admin/sertifikat")) {
    return {
      title: "Sertifikat & Kelulusan",
      description: "Atur syarat kelulusan dan penerbitan sertifikat otomatis per kelas.",
    };
  }

  if (pathname.startsWith("/admin/mentor/publikasi")) {
    return {
      title: "Review Publikasi Mentor",
      description:
        "Periksa materi yang diajukan Mentor sebelum ditampilkan kepada peserta.",
    };
  }

  if (pathname.startsWith("/admin/mentor/profil")) {
    return {
      title: "Review Profil Mentor",
      description:
        "Periksa biodata profesional, portofolio, dan CV pengajar.",
    };
  }

  if (pathname.startsWith("/admin/mentor")) {
    return {
      title: "Manajemen Mentor",
      description:
        "Undang Mentor, aktifkan role, dan pantau penugasan kelas.",
    };
  }

  if (pathname.startsWith("/admin/alumni")) {
    return {
      title: "Akses Alumni",
      description: "Verifikasi peserta lama dan aktifkan akses kelas gratis.",
    };
  }

  if (pathname.startsWith("/admin/akses")) {
    return {
      title: "Hak Akses Member",
      description: "Kelola kepemilikan kelas dan hak akses peserta.",
    };
  }

  if (pathname.startsWith("/admin/pengguna")) {
    return {
      title: "Pengguna & Akses",
      description:
        "Pantau member dan kelola hak akses pembelajaran mereka.",
    };
  }

  if (pathname.startsWith("/admin/transaksi")) {
    return {
      title: "Transaksi",
      description:
        "Pantau dan kelola seluruh riwayat transaksi member.",
    };
  }

  if (pathname.startsWith("/admin/pembayaran")) {
    return {
      title: "Pembayaran",
      description:
        "Periksa bukti pembayaran dan kelola verifikasi transaksi member.",
    };
  }

  if (pathname.startsWith("/admin/pendapatan")) {
    return {
      title: "Pendapatan",
      description: "Pantau pendapatan dari pesanan yang telah berhasil dibayar.",
    };
  }

  if (pathname.startsWith("/admin/analisis")) {
    return {
      title: "Analisis Platform",
      description: "Pantau pengguna aktif, kunjungan, dan aktivitas belajar.",
    };
  }

  if (pathname.startsWith("/admin/promo")) {
    return {
      title: "Promo & Voucher",
      description:
        "Buat kode diskon, atur kuota dan masa berlaku, serta pantau penggunaannya.",
    };
  }

  if (pathname.startsWith("/admin/log-aktivitas")) {
    return {
      title: "Log Aktivitas",
      description: "Telusuri catatan aktivitas akun dan pembelajaran.",
    };
  }

  return {
    title: "Administrator",
    description:
      "Kelola seluruh kebutuhan admin Kiki Creator Class.",
  };
}
