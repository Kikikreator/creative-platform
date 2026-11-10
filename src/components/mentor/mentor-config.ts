import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  UserRound,
  Wallet,
} from "lucide-react";

export type MentorNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type MentorNavSection = {
  label: string;
  items: MentorNavItem[];
};

export const mentorNavigation: MentorNavSection[] = [
  {
    label: "WORKSPACE",
    items: [
      {
        title: "Dashboard",
        href: "/mentor",
        icon: LayoutDashboard,
        description: "Ringkasan aktivitas mengajar",
      },
      {
        title: "Kelas Saya",
        href: "/mentor/kelas",
        icon: BookOpen,
        description: "Kelas yang ditugaskan Admin",
      },
    ],
  },
  {
    label: "PENGELOLAAN PEMBELAJARAN",
    items: [
      {
        title: "Bab & Materi",
        href: "/mentor/materi",
        icon: GraduationCap,
        description: "Susun kurikulum dan mini materi",
      },
      {
        title: "Kelola Tugas",
        href: "/mentor/kelola-tugas",
        icon: ClipboardList,
        description: "Buat dan atur tugas kelas",
      },
      {
        title: "Pemeriksaan Tugas",
        href: "/mentor/tugas",
        icon: ClipboardCheck,
        description: "Nilai dan beri feedback peserta",
      },
      {
        title: "Publikasi Materi",
        href: "/mentor/publikasi",
        icon: FileCheck2,
        description: "Pantau persetujuan Admin",
      },
      {
        title: "Persetujuan Kelulusan",
        href: "/mentor/sertifikat",
        icon: Award,
        description: "Setujui kelulusan dan sertifikat peserta",
      },
    ],
  },
  {
    label: "PENGAJAR",
    items: [
      {
        title: "Ruang Pengajar",
        href: "/mentor/ruang-pengajar",
        icon: CalendarDays,
        description: "Catatan dan agenda pribadi",
      },
      {
        title: "Pendapatan",
        href: "/mentor/pendapatan",
        icon: Wallet,
        description: "Kesepakatan, saldo, dan penarikan",
      },
      {
        title: "Profil Pengajar",
        href: "/mentor/profil",
        icon: UserRound,
        description: "Biodata, keahlian, dan CV",
      },
    ],
  },
];

export function getMentorPageMeta(pathname: string) {
  if (pathname === "/mentor") {
    return {
      title: "Dashboard Mentor",
      description: "Pantau kelas, materi, tugas, dan aktivitas mengajarmu.",
    };
  }
  if (pathname.startsWith("/mentor/kelas")) {
    return {
      title: "Kelas Saya",
      description: "Semua kelas yang dipercayakan Admin kepadamu.",
    };
  }
  if (pathname.startsWith("/mentor/materi")) {
    return {
      title: "Bab & Materi",
      description: "Bangun kurikulum kelas dan susun materi pembelajaran.",
    };
  }
  if (pathname.startsWith("/mentor/kelola-tugas")) {
    return {
      title: "Kelola Tugas",
      description: "Buat, atur, dan publikasikan tugas untuk peserta.",
    };
  }
  if (pathname.startsWith("/mentor/tugas")) {
    return {
      title: "Pemeriksaan Tugas",
      description: "Periksa karya peserta, berikan nilai, dan kirim revisi.",
    };
  }
  if (pathname.startsWith("/mentor/sertifikat")) {
    return {
      title: "Persetujuan Kelulusan",
      description: "Periksa persyaratan akhir dan setujui kelulusan peserta.",
    };
  }
  if (pathname.startsWith("/mentor/publikasi")) {
    return {
      title: "Publikasi Materi",
      description: "Pantau status pengajuan materi kepada Administrator.",
    };
  }
  if (pathname.startsWith("/mentor/ruang-pengajar")) {
    return {
      title: "Ruang Pengajar",
      description: "Ruang pribadi untuk catatan, agenda, dan rencana mengajar.",
    };
  }
  if (pathname.startsWith("/mentor/pendapatan")) {
    return {
      title: "Pendapatan Saya",
      description: "Lihat pendapatan, kesepakatan bagi hasil, dan pengajuan penarikan.",
    };
  }
  if (pathname.startsWith("/mentor/profil")) {
    return {
      title: "Profil Pengajar",
      description: "Kelola identitas profesional dan dokumen pendukung.",
    };
  }
  return {
    title: "Mentor Workspace",
    description: "Ruang kerja pengajar Kiki Creator Class.",
  };
}
