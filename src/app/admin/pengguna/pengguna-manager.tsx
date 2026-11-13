
"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  BookOpen,
  ShieldCheck,
  Search,
  RefreshCw,
  UserRound,
  Phone,
  CalendarDays,
  Plus,
  X,
  CheckCircle2,
  LockKeyhole,
  GraduationCap,
  Ban,
  Sparkles,
  Eye,
  MapPin,
  Target,
  Megaphone,
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================

export type MemberRow = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  acquisition_source: string | null;
  registration_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
  roles: string[];
};

export type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  source: string;
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type CourseOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number | string;
};

type Props = {
  initialMembers: MemberRow[];
  initialEnrollments: EnrollmentRow[];
  courses: CourseOption[];
  initialError: string | null;
};

type FilterType = "all" | "active" | "none" | "admin";


const SURFACE_SHADOW =
  "0 8px 32px rgba(15, 45, 40, 0.055)";

const CARD_SHADOW =
  "0 4px 20px rgba(15, 45, 40, 0.045)";

// ======================================================
// HELPERS
// ======================================================

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name: string) {
  return (
    (name || "Member")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "M"
  );
}

function formatPrice(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

type BreakdownItem = {
  label: string;
  count: number;
};

function normalizeSurveyLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Alamat domisili pada formulir bersifat teks bebas. Untuk ringkasan,
 * tampilkan bagian wilayah paling akhir; jika bagian terakhir adalah nama
 * provinsi, gabungkan dengan satu bagian sebelumnya agar kota/kabupaten
 * tetap terbaca. Detail alamat lengkap tetap tersedia pada detail peserta.
 */
function getRegionLabel(address: string | null) {
  if (!address?.trim()) return null;

  const parts = address
    .split(",")
    .map((part) => normalizeSurveyLabel(part))
    .filter(Boolean);

  if (parts.length <= 1) {
    const singleValue = parts[0] ?? null;
    if (!singleValue) return null;
    if (
      singleValue.length > 55 ||
      /^(jl\.?|jalan\b|gang\b|gg\.?\b|rt\b|rw\b|nomor\b|no\.?\b)/i.test(singleValue)
    ) {
      return "Alamat lengkap (wilayah belum dipisahkan)";
    }
    return singleValue;
  }

  const provinceAliases = new Set([
    "aceh", "sumatera utara", "sumut", "sumatera barat", "sumbar",
    "riau", "kepulauan riau", "kepri", "jambi", "sumatera selatan",
    "sumsel", "bengkulu", "lampung", "kepulauan bangka belitung",
    "bangka belitung", "banten", "dki jakarta", "jakarta", "jawa barat",
    "jabar", "jawa tengah", "jateng", "di yogyakarta", "yogyakarta",
    "jawa timur", "jatim", "bali", "nusa tenggara barat", "ntb",
    "nusa tenggara timur", "ntt", "kalimantan barat", "kalbar",
    "kalimantan tengah", "kalteng", "kalimantan selatan", "kalsel",
    "kalimantan timur", "kaltim", "kalimantan utara", "kalut",
    "sulawesi utara", "sulut", "sulawesi tengah", "sulteng",
    "sulawesi selatan", "sulsel", "sulawesi tenggara", "sultra",
    "gorontalo", "sulawesi barat", "sulbar", "maluku",
    "maluku utara", "papua", "papua barat", "papua selatan",
    "papua tengah", "papua pegunungan", "papua barat daya",
  ]);

  const last = parts[parts.length - 1];
  if (provinceAliases.has(last.toLocaleLowerCase("id-ID")) && parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${last}`;
  }

  return last;
}

function buildBreakdown(values: Array<string | null | undefined>): BreakdownItem[] {
  const counts = new Map<string, BreakdownItem>();

  for (const rawValue of values) {
    if (!rawValue?.trim()) continue;
    const label = normalizeSurveyLabel(rawValue);
    const key = label.toLocaleLowerCase("id-ID");
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { label, count: 1 });
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "id-ID")
  );
}

function RoleBadges({
  roles,
  compact = false,
}: {
  roles: string[];
  compact?: boolean;
}) {
  const labels: Record<string, { label: string; className: string }> = {
    admin: {
      label: "Administrator",
      className: "bg-[#F0EDFC] text-[#7057B7]",
    },
    instructor: {
      label: "Mentor",
      className: "bg-[#E8EAFE] text-[#5D55A5]",
    },
    member: {
      label: "Member",
      className: "bg-[#F3EEFF] text-[#6D28D9]",
    },
  };

  const visibleRoles = ["admin", "instructor", "member"].filter((role) =>
    roles.includes(role)
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleRoles.map((role) => {
        const item = labels[role];
        return (
          <span
            key={role}
            className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${
              compact ? "text-[10px]" : "text-[11px]"
            } ${item.className}`}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

// ======================================================
// AVATAR
// ======================================================

function MemberAvatar({
  member,
  size = "md",
}: {
  member: MemberRow;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-10 w-10 rounded-xl text-xs",
    md: "h-12 w-12 rounded-2xl text-sm",
    lg: "h-14 w-14 rounded-2xl text-base",
  };

  const sizeClass = sizes[size];

  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name}
        className={`${sizeClass} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center bg-[#F1EBFF] font-bold text-[#6D28D9]`}
    >
      {initials(member.full_name)}
    </div>
  );
}

// ======================================================
// STATISTIC CARD
// ======================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBackground,
  iconColor,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <div
      className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,45,40,0.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(15,45,40,0.07)]"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#817A97]">
            {title}
          </p>

          <p className="mt-3 text-[26px] font-semibold leading-none tracking-tight text-[#1B1730]">
            {value.toLocaleString("id-ID")}
          </p>

          <p className="mt-2 text-[11px] text-[#9D97B4]">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBackground} ${iconColor}`}
        >
          <Icon size={19} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function InsightBreakdown({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  items: BreakdownItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const top = items[0];

  return (
    <section className="min-w-0 rounded-2xl border border-[#EEEAF7] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#6D28D9]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-[#211A37]">{title}</h4>
          <p className="mt-1 text-[10px] leading-4 text-[#9D97B4]">{description}</p>
        </div>
      </div>

      {top ? (
        <div className="mt-4 rounded-xl bg-[#F8F6FD] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9D97B4]">Paling banyak</p>
          <p className="mt-1 truncate text-[12px] font-semibold text-[#5B21B6]" title={top.label}>
            {top.label} <span className="font-medium text-[#817A97]">· {top.count} peserta</span>
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#F8F6FD] px-3 py-4 text-center text-[11px] text-[#9D97B4]">Belum ada jawaban yang dapat diringkas.</div>
      )}

      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.slice(0, 5).map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.label} className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
                  <span className="min-w-0 truncate font-medium text-[#625A76]" title={item.label}>{item.label}</span>
                  <span className="shrink-0 font-semibold text-[#817A97]">{item.count} · {percentage}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#F0EDF6]">
                  <div className="h-full rounded-full bg-[#8B5CF6] transition-all" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 border-t border-[#F1EEF6] pt-3 text-[9px] text-[#AAA5B8]">{total} jawaban terisi</p>
    </section>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function PenggunaManager({
  initialMembers,
  initialEnrollments,
  courses,
  initialError,
}: Props) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);

  const [members, setMembers] = useState<MemberRow[]>(
    initialMembers
  );

  const [enrollments, setEnrollments] =
    useState<EnrollmentRow[]>(initialEnrollments);

  const [search, setSearch] = useState("");

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [selectedMember, setSelectedMember] =
    useState<MemberRow | null>(null);

  const [selectedDetailMember, setSelectedDetailMember] =
    useState<MemberRow | null>(null);

  const [selectedCourseId, setSelectedCourseId] =
    useState("");

  const [participantCourseId, setParticipantCourseId] =
    useState(courses[0]?.id ?? "");

  const [participantSearch, setParticipantSearch] = useState("");

  const [activeTab, setActiveTab] = useState<"users" | "participants">("users");

  const [saving, setSaving] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(initialError ?? "");

  const [success, setSuccess] = useState("");

  // ----------------------------------------------------
  // AVAILABLE COURSES
  // ----------------------------------------------------

  const availableCourses = useMemo(
    () => courses.filter(
      (course) => course.status !== "archived"
    ),
    [courses]
  );

  // ----------------------------------------------------
  // ACTIVE ENROLLMENT COUNTS
  // ----------------------------------------------------

  const activeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    enrollments
      .filter((item) => item.status === "active")
      .forEach((item) => {
        counts.set(
          item.user_id,
          (counts.get(item.user_id) ?? 0) + 1
        );
      });

    return counts;
  }, [enrollments]);

  const activeTotal = enrollments.filter(
    (item) => item.status === "active"
  ).length;

  const activeMembers = members.filter(
    (member) =>
      (activeCounts.get(member.id) ?? 0) > 0
  ).length;

  const adminCount = members.filter(
    (member) => member.roles.includes("admin")
  ).length;

  // ----------------------------------------------------
  // INSIGHT PENDAFTARAN PESERTA
  // Data diringkas dari kolom profil yang sudah diisi pada form registrasi.
  // Admin dan Mentor tidak dimasukkan ke statistik peserta.
  // ----------------------------------------------------

  const participantMembers = useMemo(
    () => members.filter((member) => member.role === "member"),
    [members]
  );

  const regionBreakdown = useMemo(
    () => buildBreakdown(participantMembers.map((member) => getRegionLabel(member.address))),
    [participantMembers]
  );

  const sourceBreakdown = useMemo(
    () => buildBreakdown(participantMembers.map((member) => member.acquisition_source)),
    [participantMembers]
  );

  const reasonBreakdown = useMemo(
    () => buildBreakdown(participantMembers.map((member) => member.registration_reason)),
    [participantMembers]
  );

  // ----------------------------------------------------
  // SEARCH AND FILTER
  // ----------------------------------------------------

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.full_name.toLowerCase().includes(keyword) ||
        (member.phone ?? "").toLowerCase().includes(keyword) ||
        member.id.toLowerCase().includes(keyword);

      const accessCount =
        activeCounts.get(member.id) ?? 0;

      const matchesFilter =
        filter === "all" ||
        (filter === "active" && accessCount > 0) ||
        (filter === "none" && accessCount === 0) ||
        (filter === "admin" && member.roles.includes("admin"));

      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter, activeCounts]);

  // ----------------------------------------------------
  // LOAD DATA FROM SUPABASE
  // ----------------------------------------------------

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const [
        profilesResult,
        rolesResult,
        enrollmentsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, phone, whatsapp_number, address, acquisition_source, registration_reason, avatar_url, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),

        supabase
          .from("user_roles")
          .select("user_id, role")
          .limit(500),

        supabase
          .from("enrollments")
          .select(
            "id, user_id, course_id, status, source, granted_at, revoked_at, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      if (rolesResult.error) {
        throw rolesResult.error;
      }

      if (enrollmentsResult.error) {
        throw enrollmentsResult.error;
      }

      const roleMap = new Map<string, string[]>();

      for (const item of rolesResult.data ?? []) {
        const current = roleMap.get(item.user_id) ?? [];
        if (!current.includes(item.role)) current.push(item.role);
        roleMap.set(item.user_id, current);
      }

      setMembers(
        (profilesResult.data ?? []).map((profile) => {
          const roles = roleMap.get(profile.id) ?? ["member"];
          const primaryRole = roles.includes("admin")
            ? "admin"
            : roles.includes("instructor")
              ? "instructor"
              : "member";

          return {
            ...profile,
            role: primaryRole,
            roles,
          };
        })
      );

      setEnrollments(
        (enrollmentsResult.data ?? []) as EnrollmentRow[]
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui data member."
      );
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  // ----------------------------------------------------
  // ACCESS MODAL
  // ----------------------------------------------------

  function openAccess(member: MemberRow) {
    setSelectedMember(member);

    setSelectedCourseId(
      availableCourses[0]?.id ?? ""
    );

    setError("");
    setSuccess("");
  }

  function openDetail(member: MemberRow) {
    setSelectedDetailMember(member);
  }

  function closeDetail() {
    setSelectedDetailMember(null);
  }

  function closeAccess() {
    if (saving) return;

    setSelectedMember(null);
    setSelectedCourseId("");
  }

  // ----------------------------------------------------
  // GRANT ACCESS
  // ----------------------------------------------------

  async function grantAccess() {
    if (!selectedMember || !selectedCourseId) {
      setError("Pilih kelas terlebih dahulu.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const existingRows = enrollments
        .filter(
          (item) =>
            item.user_id === selectedMember.id &&
            item.course_id === selectedCourseId
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

      const alreadyActive = existingRows.some(
        (item) => item.status === "active"
      );

      if (alreadyActive) {
        setSuccess(
          "Member sudah memiliki akses kelas ini."
        );
        return;
      }

      const now = new Date().toISOString();
      const latest = existingRows[0];

      if (latest) {
        const { error: updateError } = await supabase
          .from("enrollments")
          .update({
            status: "active",
            source: "admin",
            granted_at: now,
            revoked_at: null,
          })
          .eq("id", latest.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("enrollments")
          .insert({
            user_id: selectedMember.id,
            course_id: selectedCourseId,
            status: "active",
            source: "admin",
            granted_at: now,
            revoked_at: null,
          });

        if (insertError) throw insertError;
      }

      await loadData();

      setSuccess("Akses kelas berhasil diberikan.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memberikan akses kelas."
      );
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------
  // REVOKE ACCESS
  // ----------------------------------------------------

  async function revokeAccess(courseId: string) {
    if (!selectedMember) return;

    const course = courses.find(
      (item) => item.id === courseId
    );

    const confirmed = await confirmDialog({
      title: "Cabut akses kelas?",
      message: `Cabut akses ${selectedMember.full_name} dari kelas "${course?.title ?? "ini"}"?`,
      confirmLabel: "Cabut akses",
      variant: "danger",
    });

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("enrollments")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("user_id", selectedMember.id)
        .eq("course_id", courseId)
        .eq("status", "active");

      if (updateError) throw updateError;

      await loadData();

      setSuccess("Akses kelas berhasil dicabut.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mencabut akses."
      );
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------
  // SELECTED MEMBER DATA
  // ----------------------------------------------------

  const selectedActiveCourses = useMemo(
    () =>
      selectedMember
        ? enrollments.filter(
            (item) =>
              item.user_id === selectedMember.id &&
              item.status === "active"
          )
        : [],
    [selectedMember, enrollments]
  );

  const detailActiveCourses = useMemo(
    () =>
      selectedDetailMember
        ? enrollments.filter(
            (item) =>
              item.user_id === selectedDetailMember.id &&
              item.status === "active"
          )
        : [],
    [selectedDetailMember, enrollments]
  );

  const selectedCourse = availableCourses.find(
    (course) => course.id === selectedCourseId
  );

  const participantCourse = courses.find((course) => course.id === participantCourseId);
  const participantRows = useMemo(() => {
    const memberMap = new Map(members.map((member) => [member.id, member]));
    const keyword = participantSearch.trim().toLowerCase();
    return enrollments
      .filter((item) => item.course_id === participantCourseId && item.status === "active")
      .map((enrollment) => ({ enrollment, member: memberMap.get(enrollment.user_id) ?? null }))
      .filter(({ enrollment, member }) => {
        if (!keyword) return true;
        return (member?.full_name ?? "Peserta").toLowerCase().includes(keyword)
          || enrollment.user_id.toLowerCase().includes(keyword);
      })
      .sort((a, b) => new Date(b.enrollment.granted_at || b.enrollment.created_at).getTime() - new Date(a.enrollment.granted_at || a.enrollment.created_at).getTime());
  }, [enrollments, members, participantCourseId, participantSearch]);

  // ----------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------

  const stats = [
    {
      title: "Total Akun",
      value: members.length,
      description: "Seluruh pengguna terdaftar",
      icon: Users,
      iconBackground: "bg-[#F3EEFF]",
      iconColor: "text-[#6D28D9]",
    },
    {
      title: "Memiliki Akses",
      value: activeMembers,
      description: "Member dengan kelas aktif",
      icon: BookOpen,
      iconBackground: "bg-[#F0EAFE]",
      iconColor: "text-[#8B5CF6]",
    },
    {
      title: "Total Enrollment",
      value: activeTotal,
      description: "Seluruh akses kelas aktif",
      icon: CheckCircle2,
      iconBackground: "bg-[#F0EAFE]",
      iconColor: "text-[#7C3AED]",
    },
    {
      title: "Administrator",
      value: adminCount,
      description: "Akun pengelola platform",
      icon: ShieldCheck,
      iconBackground: "bg-[#EEEAFE]",
      iconColor: "text-[#7663B7]",
    },
  ];

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="space-y-7 text-[#1B1730]">
      {/* PAGE HEADING */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
            <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
            Manajemen Pengguna
          </div>

          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#817A97]">
            Pantau aktivitas member, kelola kepemilikan kelas, dan atur hak akses pembelajaran.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/admin/mentor"
            className="inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-xl border border-[#EEEAF7] bg-white px-4 text-[12px] font-semibold text-[#6D28D9] transition hover:bg-[#F6F2FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          >
            <GraduationCap size={15} />
            Manajemen Mentor
          </Link>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={refreshing}
            className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(109,40,217,0.14)] transition hover:bg-[#5B21B6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memperbarui..." : "Perbarui Data"}
          </button>
        </div>
      </section>

      {/* STATISTICS */}
        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {stats.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              description={item.description}
              icon={item.icon}
              iconBackground={item.iconBackground}
              iconColor={item.iconColor}
            />
          ))}

        </section>

        {/* =================================================
            INSIGHT PENDAFTARAN - TETAP DI TAB PENGGUNA
        ================================================= */}
        {activeTab === "users" && (
        <section className="rounded-[22px] border border-[#EEEAF7] bg-white p-5 shadow-[0_8px_32px_rgba(15,45,40,0.045)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6D28D9]">
                <Sparkles size={13} />
                Insight Pendaftaran
              </div>
              <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-[#1B1730]">Mengenal peserta Kiki Creator Class</h3>
              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#9D97B4]">Ringkasan domisili, sumber informasi, dan tujuan belajar berdasarkan jawaban pada formulir pendaftaran peserta.</p>
            </div>
            <div className="rounded-xl bg-[#F3EEFF] px-3.5 py-2 text-[11px] font-semibold text-[#6D28D9]">
              {participantMembers.length.toLocaleString("id-ID")} peserta dianalisis
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <InsightBreakdown
              title="Domisili peserta"
              description="Diringkas dari bagian wilayah pada isian alamat domisili."
              icon={MapPin}
              items={regionBreakdown}
            />
            <InsightBreakdown
              title="Sumber informasi kelas"
              description="Dari mana peserta pertama kali mengetahui Kiki Creator Class."
              icon={Megaphone}
              items={sourceBreakdown}
            />
            <InsightBreakdown
              title="Tujuan mengikuti kelas"
              description="Alasan dan tujuan belajar yang dipilih peserta saat mendaftar."
              icon={Target}
              items={reasonBreakdown}
            />
          </div>

          <p className="mt-4 rounded-xl bg-[#FAF9FD] px-3.5 py-3 text-[10px] leading-5 text-[#8E879F]">
            Catatan data: ringkasan hanya menghitung jawaban yang terisi. Pada alur aktivasi alumni, kolom sumber informasi dan tujuan belajar memang tidak ditanyakan dan sistem menyimpannya sebagai “Lainnya”; karena itu kategori tersebut tidak selalu berarti jawaban survei langsung. Variasi penulisan domisili juga dapat membuat wilayah serupa terhitung terpisah.
          </p>
        </section>
        )}

        {/* =================================================
            NOTIFICATIONS
        ================================================= */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl bg-[#FFF0EF] p-4 text-[12px] font-medium text-[#B83D36]"
          >
            <Ban size={17} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">
              {error}
            </span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl bg-[#F3EEFF] p-4 text-[12px] font-semibold text-[#6D28D9]"
          >
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span>{success}</span>
          </div>
        )}

        {/* =================================================
            CONTENT TABS
        ================================================= */}
        <div className="rounded-2xl border border-[#EEEAF7] bg-[#F7F6FC] p-1.5">
          <div
            role="tablist"
            aria-label="Kategori pengguna"
            className="grid grid-cols-2 gap-1.5"
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const nextTab = activeTab === "users" ? "participants" : "users";
              setActiveTab(nextTab);
              document.getElementById(`${nextTab}-tab`)?.focus();
            }}
          >
            <button
              id="users-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              aria-controls="users-panel"
              tabIndex={activeTab === "users" ? 0 : -1}
              onClick={() => setActiveTab("users")}
              className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] sm:text-[13px] ${
                activeTab === "users"
                  ? "bg-white text-[#5B21B6] shadow-[0_2px_8px_rgba(31,20,55,0.08)]"
                  : "text-[#817A97] hover:bg-white/70 hover:text-[#5B21B6]"
              }`}
            >
              <Users size={16} />
              <span>Pengguna</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === "users"
                  ? "bg-[#F1EBFF] text-[#6D28D9]"
                  : "bg-white/80 text-[#817A97]"
              }`}>
                {members.length.toLocaleString("id-ID")}
              </span>
            </button>

            <button
              id="participants-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "participants"}
              aria-controls="participants-panel"
              tabIndex={activeTab === "participants" ? 0 : -1}
              onClick={() => setActiveTab("participants")}
              className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] sm:text-[13px] ${
                activeTab === "participants"
                  ? "bg-white text-[#5B21B6] shadow-[0_2px_8px_rgba(31,20,55,0.08)]"
                  : "text-[#817A97] hover:bg-white/70 hover:text-[#5B21B6]"
              }`}
            >
              <BookOpen size={16} />
              <span>Peserta Kelas</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === "participants"
                  ? "bg-[#F1EBFF] text-[#6D28D9]"
                  : "bg-white/80 text-[#817A97]"
              }`}>
                {activeMembers.toLocaleString("id-ID")}
              </span>
            </button>
          </div>
        </div>

        <section
          hidden={activeTab !== "participants"}
          id="participants-panel"
          role="tabpanel"
          aria-labelledby="participants-tab"
          tabIndex={0}
          className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#6D28D9]">Peserta Kelas</p>
              <h3 className="mt-1 text-[16px] font-semibold text-[#211A37]">Daftar Peserta per Kelas</h3>
              <p className="mt-1 text-[12px] leading-5 text-[#9D97B4]">Menampilkan akun yang memiliki akses aktif pada kelas terpilih.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_190px] sm:min-w-[390px]">
              <select value={participantCourseId} onChange={(event) => setParticipantCourseId(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#EEEAF7] bg-[#F7F6FC] px-3 text-[12px] font-medium text-[#584C6E] outline-none transition focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20">
                {courses.length === 0 && <option value="">Belum ada kelas</option>}
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <input value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Cari nama peserta..." className="h-11 min-w-0 rounded-xl border border-[#EEEAF7] bg-[#F7F6FC] px-3 text-[12px] text-[#1B1730] outline-none transition placeholder:text-[#AAA5B8] focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FBFAFD] px-5 py-3 sm:px-6">
            <p className="text-[11px] text-slate-500">Kelas: <strong className="text-slate-700">{participantCourse?.title ?? "Belum dipilih"}</strong></p>
            <p className="text-[11px] font-semibold text-[#09483F]">{participantRows.length} peserta aktif</p>
          </div>
          {participantRows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="mx-auto text-slate-300" size={28} />
              <p className="mt-2 text-[13px] font-semibold text-slate-700">Belum ada peserta pada kelas ini</p>
              <p className="mt-1 text-[12px] text-slate-400">Peserta akan muncul setelah akses kelas diberikan dan status enrollment aktif.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {participantRows.map(({ enrollment, member }) => (
                <div key={enrollment.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    {member ? <MemberAvatar member={member} size="sm" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">P</div>}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#211A37]">{member?.full_name || "Peserta"}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">{member?.phone || member?.whatsapp_number || enrollment.user_id}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Akses aktif</span>
                    <span className="text-[10px] text-slate-400">Bergabung {formatDate(enrollment.granted_at || enrollment.created_at)}</span>
                    {member && (
                      <>
                        <button
                          type="button"
                          onClick={() => openDetail(member)}
                          aria-label={`Lihat detail ${member.full_name}`}
                          title={`Lihat detail ${member.full_name}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EEEAF7] bg-white text-[#6D28D9] transition hover:bg-[#F3EEFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openAccess(member)}
                          aria-label={`Kelola akses ${member.full_name}`}
                          title={`Kelola akses ${member.full_name}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EEEAF7] bg-white text-[#6D28D9] transition hover:bg-[#F3EEFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                        >
                          <LockKeyhole size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* =================================================
            MEMBER MANAGEMENT PANEL
        ================================================= */}

        <section
          hidden={activeTab !== "users"}
          id="users-panel"
          role="tabpanel"
          aria-labelledby="users-tab"
          tabIndex={0}
          className="overflow-hidden rounded-[22px] border border-[#EEEAF7] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          style={{ boxShadow: SURFACE_SHADOW }}
        >

          {/* PANEL HEADER */}

          <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#6D28D9]">
                <Users size={21} strokeWidth={1.8} />
              </div>

              <div>
                <h3 className="text-[16px] font-semibold tracking-tight text-[#1B1730]">
                  Daftar Pengguna
                </h3>

                <p className="mt-1 text-[12px] text-[#9D97B4]">
                  Kelola akun, peran, dan hak akses pengguna.
                </p>
              </div>

            </div>

            {/* SEARCH AND FILTER */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(200px,1fr)_190px] xl:w-auto xl:min-w-[470px]">

              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9D97B4]"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, nomor, atau ID..."
                  className="h-11 w-full rounded-xl border border-transparent bg-[#F7F6FC] pl-11 pr-4 text-[12px] text-[#1B1730] outline-none transition placeholder:text-[#AAA5B8] focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
                />
              </div>

              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as FilterType)
                }
                className="h-11 w-full cursor-pointer rounded-xl border border-transparent bg-[#F7F6FC] px-4 text-[12px] font-medium text-[#6C6280] outline-none transition focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-[#8B5CF6]/20"
              >
                <option value="all">Semua Pengguna</option>
                <option value="active">Memiliki Akses</option>
                <option value="none">Belum Memiliki Akses</option>
                <option value="admin">Administrator</option>
              </select>

            </div>

          </div>

          {/* =================================================
              DESKTOP TABLE
          ================================================= */}

          <div className="hidden overflow-x-auto lg:block">

            <table className="w-full border-collapse text-left">

              <thead>
                <tr className="bg-[#F8F7FC]">
                  <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9B95AB]">
                    Member
                  </th>

                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9B95AB]">
                    Jenis Akun
                  </th>

                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9B95AB]">
                    Akses Kelas
                  </th>

                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9B95AB]">
                    Tanggal Bergabung
                  </th>

                  <th className="px-7 py-4 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#9B95AB]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.map((member) => {
                  const accessCount =
                    activeCounts.get(member.id) ?? 0;

                  return (
                    <tr
                      key={member.id}
                      className="group transition hover:bg-[#FBFAFF]"
                    >

                      <td className="px-7 py-4">
                        <div className="flex items-center gap-3">

                          <MemberAvatar
                            member={member}
                            size="md"
                          />

                          <div className="min-w-0">
                            <p className="max-w-64 truncate text-[13px] font-semibold text-[#211A37]">
                              {member.full_name}
                            </p>

                            <p className="mt-1 text-[10px] text-[#9D97B4]">
                              ID: {member.id.slice(0, 8)}
                            </p>

                            {member.phone && (
                              <p className="mt-1 flex items-center gap-1 text-[10px] text-[#9D97B4]">
                                <Phone size={10} />
                                {member.phone}
                              </p>
                            )}
                          </div>

                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <RoleBadges roles={member.roles} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen
                            size={15}
                            className="text-[#8B5CF6]"
                          />

                          <span className="text-[13px] font-semibold text-[#584C6E]">
                            {accessCount} kelas
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-[11px] text-[#817A97]">
                          <CalendarDays
                            size={14}
                            className="text-[#AAA5B8]"
                          />
                          {formatDate(member.created_at)}
                        </div>
                      </td>

                      <td className="px-7 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(member)}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E8E1F3] bg-white px-3 text-[11px] font-semibold text-[#6D28D9] transition hover:bg-[#F7F3FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                          >
                            <Eye size={14} />
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => openAccess(member)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#5B21B6] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                          >
                            <LockKeyhole size={14} />
                            Kelola Akses
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>

          {/* =================================================
              TABLET AND MOBILE CARDS
          ================================================= */}

          <div className="space-y-3 p-4 lg:hidden">

            {filteredMembers.map((member) => {
              const accessCount =
                activeCounts.get(member.id) ?? 0;

              return (
                <article
                  key={member.id}
                  className="rounded-[20px] bg-[#F8F7FC] p-4 transition hover:bg-[#F8F6FD] sm:p-5"
                >

                  <div className="flex items-center gap-3">

                    <MemberAvatar
                      member={member}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#211A37]">
                        {member.full_name}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-[#9D97B4]">
                        {member.phone || "Nomor belum diisi"}
                      </p>

                      <p className="mt-1 text-[10px] text-[#AAA5B8]">
                        ID: {member.id.slice(0, 8)}
                      </p>
                    </div>

                    <RoleBadges roles={member.roles} compact />

                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F1EBFF] text-[#6D28D9]">
                        <BookOpen size={16} />
                      </div>

                      <div>
                        <p className="text-[11px] text-[#9D97B4]">
                          Akses kelas
                        </p>

                        <p className="mt-0.5 text-[12px] font-semibold text-[#584C6E]">
                          {accessCount} kelas
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(member)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E8E1F3] bg-white px-3 text-[11px] font-semibold text-[#6D28D9] transition hover:bg-[#F7F3FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                      >
                        <Eye size={14} />
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => openAccess(member)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#5B21B6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                      >
                        <LockKeyhole size={14} />
                        Kelola Akses
                      </button>
                    </div>

                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[10px] text-[#9D97B4]">
                    <CalendarDays size={12} />
                    Bergabung {formatDate(member.created_at)}
                  </div>

                </article>
              );
            })}

          </div>

          {/* =================================================
              EMPTY STATE
          ================================================= */}

          {filteredMembers.length === 0 && (
            <div className="px-5 py-16 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F3EEFF] text-[#6D28D9]">
                <UserRound size={28} strokeWidth={1.6} />
              </div>

              <h4 className="mt-5 text-[14px] font-semibold text-[#211A37]">
                Pengguna tidak ditemukan
              </h4>

              <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-[#9D97B4]">
                Tidak ada member yang sesuai dengan kata
                kunci atau filter yang dipilih.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-[#F3EEFF] px-3 text-[11px] font-semibold text-[#6D28D9] transition hover:bg-[#EAE1FF]"
              >
                Reset Pencarian
              </button>

            </div>
          )}

          {/* PANEL FOOTER */}

          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF9FF] px-5 py-4 sm:px-7">
            <p className="text-[11px] text-[#9D97B4]">
              Menampilkan{" "}
              <span className="font-semibold text-[#6C6280]">
                {filteredMembers.length}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-[#6C6280]">
                {members.length}
              </span>{" "}
              akun.
            </p>

            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6D28D9]">
              <CheckCircle2 size={13} />
              Data tersimpan di Supabase
            </div>
          </div>

        </section>

        {/* FOOTER */}

        <footer className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#9D97B4]">
            <GraduationCap size={15} />
            Kiki Creator Class
          </div>

          <p className="text-[10px] text-[#AAA5B8]">
            © 2026 Kiki Creator Class. All rights reserved.
          </p>
        </footer>

      {/* =====================================================
          ACCESS MANAGEMENT MODAL
      ===================================================== */}

      {selectedMember && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#211A37]/55 p-3 backdrop-blur-[5px] sm:p-6"
          onClick={closeAccess}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-[25px] bg-white shadow-[0_25px_90px_rgba(0,0,0,0.22)] sm:max-h-[88dvh] sm:rounded-[28px]"
          >

            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-center justify-between bg-[#5B21B6] px-5 py-5 text-white sm:px-7 sm:py-6">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <LockKeyhole size={21} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#D8C7FF]">
                    <Sparkles size={12} />
                    Access Management
                  </div>

                  <h3
                    id="access-modal-title"
                    className="mt-1.5 text-[16px] font-semibold tracking-tight sm:text-[17px]"
                  >
                    Kelola Akses Kelas
                  </h3>

                  <p className="mt-1 truncate text-[11px] text-[#E3D8FF]">
                    Atur hak akses pembelajaran member.
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={closeAccess}
                disabled={saving}
                aria-label="Tutup modal"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
              >
                <X size={19} />
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">

              {/* ALERT */}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#FFF0EF] p-3.5 text-[11px] font-medium text-[#B83D36]"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl bg-[#F3EEFF] p-3.5 text-[11px] font-semibold text-[#6D28D9]"
                >
                  <CheckCircle2 size={16} />
                  {success}
                </div>
              )}

              {/* MEMBER PROFILE */}

              <section className="flex items-center gap-4 rounded-[20px] bg-[#F7F6FC] p-4 sm:p-5">

                <MemberAvatar
                  member={selectedMember}
                  size="lg"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#211A37]">
                    {selectedMember.full_name}
                  </p>

                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9D97B4]">
                    <Phone size={12} />
                    {selectedMember.phone ||
                      "Nomor belum tersedia"}
                  </p>

                  <div className="mt-2">
                    <RoleBadges roles={selectedMember.roles} compact />
                  </div>
                </div>

              </section>

              {/* REGISTRATION DETAILS */}
              <section className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5">
                <div className="mb-3">
                  <h4 className="text-[14px] font-semibold text-[#202742]">
                    Informasi pendaftaran
                  </h4>
                  <p className="mt-1 text-[10px] leading-5 text-slate-500">
                    Data yang diisi peserta ketika membuat akun.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-[#f7f7fb] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">WhatsApp</p>
                    <p className="mt-1 break-words text-xs font-semibold text-[#28304a]">
                      {selectedMember.whatsapp_number || selectedMember.phone || "Belum diisi"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#f7f7fb] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Alamat domisili</p>
                    <p className="mt-1 break-words text-xs font-semibold text-[#28304a]">
                      {selectedMember.address || "Belum diisi"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#f7f7fb] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mengetahui dari</p>
                    <p className="mt-1 break-words text-xs font-semibold text-[#28304a]">
                      {selectedMember.acquisition_source || "Data lama / belum diisi"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#f7f7fb] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tujuan mengikuti kelas</p>
                    <p className="mt-1 break-words text-xs font-semibold text-[#28304a]">
                      {selectedMember.registration_reason || "Data lama / belum diisi"}
                    </p>
                  </div>
                </div>
              </section>

              {/* GRANT ACCESS */}

              <section className="rounded-[22px] bg-[#F8F7FC] p-4 sm:p-5">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-[#6D28D9]">
                    <Plus size={20} />
                  </div>

                  <div>
                    <h4 className="text-[13px] font-semibold text-[#211A37]">
                      Berikan Akses Baru
                    </h4>

                    <p className="mt-1 text-[11px] leading-5 text-[#9D97B4]">
                      Pilih kelas yang akan diberikan kepada
                      member ini.
                    </p>
                  </div>

                </div>

                {availableCourses.length === 0 ? (
                  <div className="mt-4 rounded-xl bg-[#FFF6E6] p-4 text-[11px] font-medium text-[#996B20]">
                    Belum ada kelas yang tersedia. Tambahkan
                    kelas terlebih dahulu melalui Manajemen Kelas.
                  </div>
                ) : (
                  <div className="mt-5">

                    <label
                      htmlFor="access-course"
                      className="mb-2 block text-[11px] font-semibold text-[#6C6280]"
                    >
                      Pilih Kelas
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row">

                      <select
                        id="access-course"
                        value={selectedCourseId}
                        onChange={(e) =>
                          setSelectedCourseId(e.target.value)
                        }
                        disabled={saving}
                        className="h-12 min-w-0 flex-1 rounded-xl border border-transparent bg-white px-4 text-[12px] font-medium text-[#584C6E] outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 disabled:opacity-60"
                      >
                        {availableCourses.map((course) => (
                          <option
                            key={course.id}
                            value={course.id}
                          >
                            {course.title}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void grantAccess()}
                        disabled={saving || !selectedCourseId}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5B21B6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? (
                          <RefreshCw
                            size={15}
                            className="animate-spin"
                          />
                        ) : (
                          <Plus size={16} />
                        )}

                        Berikan Akses
                      </button>

                    </div>

                    {selectedCourse && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#F3EEFF] px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="text-[10px] text-[#9D97B4]">
                            Kelas yang dipilih
                          </p>

                          <p className="mt-1 truncate text-[11px] font-semibold text-[#584C6E]">
                            {selectedCourse.title}
                          </p>
                        </div>

                        <p className="shrink-0 text-[11px] font-semibold text-[#6D28D9]">
                          {formatPrice(selectedCourse.price)}
                        </p>
                      </div>
                    )}

                  </div>
                )}

              </section>

              {/* ACTIVE COURSES */}

              <section>

                <div className="mb-4 flex items-center justify-between gap-3">

                  <div>
                    <h4 className="text-[14px] font-semibold text-[#211A37]">
                      Kelas yang Dimiliki
                    </h4>

                    <p className="mt-1 text-[11px] text-[#9D97B4]">
                      Daftar akses kelas aktif member.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-[#F1EBFF] px-3 py-1.5 text-[10px] font-semibold text-[#6D28D9]">
                    {selectedActiveCourses.length} Kelas
                  </span>

                </div>

                {selectedActiveCourses.length === 0 ? (
                  <div className="rounded-[20px] bg-[#F8F7FC] px-5 py-9 text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F0FF] text-[#6D28D9]">
                      <BookOpen size={23} />
                    </div>

                    <p className="mt-4 text-[12px] font-semibold text-[#6C6280]">
                      Belum memiliki akses kelas
                    </p>

                    <p className="mt-1 text-[10px] text-[#9D97B4]">
                      Berikan akses kelas menggunakan pilihan di atas.
                    </p>

                  </div>
                ) : (
                  <div className="space-y-3">

                    {selectedActiveCourses.map((item) => {
                      const course = courses.find(
                        (c) => c.id === item.course_id
                      );

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F8F7FC] p-3.5 sm:p-4"
                        >

                          <div className="flex min-w-0 items-center gap-3">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-[#6D28D9]">
                              <BookOpen size={19} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-[#584C6E]">
                                {course?.title ??
                                  "Kelas tidak ditemukan"}
                              </p>

                              <p className="mt-1 text-[10px] text-[#9D97B4]">
                                Aktif sejak{" "}
                                {formatDate(item.granted_at)}
                              </p>
                            </div>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void revokeAccess(item.course_id)
                            }
                            disabled={saving}
                            title="Cabut akses kelas"
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#FCECEA] px-3 text-[11px] font-semibold text-[#B94740] transition hover:bg-[#F8DCD9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B94740] disabled:opacity-50"
                          >
                            <Ban size={13} />
                            <span className="hidden sm:inline">
                              Cabut
                            </span>
                          </button>

                        </div>
                      );
                    })}

                  </div>
                )}

              </section>

              {/* PERMANENT ACCESS INFORMATION */}

              <div className="flex items-start gap-3 rounded-[18px] bg-[#F3EEFF] p-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#6D28D9]">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <p className="text-[12px] font-semibold text-[#5B21B6]">
                    Sistem Akses Permanen
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-[#716687]">
                    Akses kelas bersifat permanen sesuai konfigurasi
                    database. Jika akses dicabut, status enrollment
                    akan berubah menjadi revoked.
                  </p>
                </div>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex shrink-0 items-center justify-between gap-3 bg-white px-5 py-4 shadow-[0_-5px_20px_rgba(20,50,45,0.045)] sm:px-7">

              <p className="hidden text-[11px] text-[#9D97B4] sm:block">
                Pengaturan akses member
              </p>

              <button
                type="button"
                onClick={closeAccess}
                disabled={saving}
                className="ml-auto inline-flex h-11 items-center justify-center rounded-xl bg-[#F6F2FC] px-4 text-[12px] font-semibold text-[#6C6280] transition hover:bg-[#EEE7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:opacity-50"
              >
                Selesai
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          DETAIL PESERTA - READ ONLY
      ===================================================== */}
      {selectedDetailMember && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#211A37]/55 p-2 backdrop-blur-[4px] sm:p-4"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-detail-title"
            onClick={(event) => event.stopPropagation()}
            className="flex w-[calc(100vw-24px)] max-w-[680px] max-h-[82dvh] min-h-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.20)] sm:rounded-[22px]"
            style={{ width: "calc(100vw - 24px)", maxWidth: "680px", maxHeight: "82dvh" }}
          >
            <div className="flex shrink-0 items-center justify-between bg-[#5B21B6] px-4 py-3.5 text-white sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <UserRound size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#D8C7FF]">Profil Peserta</p>
                  <h3 id="member-detail-title" className="mt-1 text-[16px] font-semibold">Detail Peserta</h3>
                  <p className="mt-0.5 truncate text-[10px] text-[#E3D8FF]">Informasi pendaftaran dan tujuan belajar.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Tutup detail peserta"
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5 sm:p-5">
              <section className="flex items-center gap-3 rounded-[16px] bg-[#F7F6FC] p-3 sm:p-4">
                <MemberAvatar member={selectedDetailMember} size="lg" />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[14px] font-semibold text-[#211A37]">{selectedDetailMember.full_name}</h4>
                  <p className="mt-1 text-[10px] text-[#9D97B4]">ID: {selectedDetailMember.id}</p>
                  <div className="mt-2"><RoleBadges roles={selectedDetailMember.roles} compact /></div>
                </div>
              </section>

              <section className="rounded-[16px] border border-[#EEEAF7] p-3 sm:p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <UserRound size={16} className="text-[#6D28D9]" />
                  <h4 className="text-[13px] font-semibold text-[#211A37]">Informasi peserta</h4>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#F8F7FC] p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#9D97B4]">Nomor WhatsApp</p>
                    <p className="mt-1 break-words text-[11px] font-semibold text-[#584C6E]">{selectedDetailMember.whatsapp_number || selectedDetailMember.phone || "Belum diisi"}</p>
                  </div>
                  <div className="rounded-xl bg-[#F8F7FC] p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#9D97B4]">Tanggal bergabung</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#584C6E]">{formatDate(selectedDetailMember.created_at)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F8F7FC] p-3 sm:col-span-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#9D97B4]"><MapPin size={11} /> Domisili / asal daerah</p>
                    <p className="mt-1 break-words text-[11px] font-semibold leading-5 text-[#584C6E]">{selectedDetailMember.address || "Belum diisi"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-[#EEEAF7] p-3 sm:p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <Megaphone size={16} className="text-[#6D28D9]" />
                  <h4 className="text-[13px] font-semibold text-[#211A37]">Jawaban formulir pendaftaran</h4>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#F8F7FC] p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#9D97B4]">Mengetahui kelas dari</p>
                    <p className="mt-1 break-words text-[11px] font-semibold leading-5 text-[#584C6E]">{selectedDetailMember.acquisition_source || "Belum diisi / data lama"}</p>
                  </div>
                  <div className="rounded-xl bg-[#F8F7FC] p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#9D97B4]">Tujuan mengikuti kelas</p>
                    <p className="mt-1 break-words text-[11px] font-semibold leading-5 text-[#584C6E]">{selectedDetailMember.registration_reason || "Belum diisi / data lama"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-[#EEEAF7] p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-[#6D28D9]" />
                    <h4 className="text-[13px] font-semibold text-[#211A37]">Kelas yang diikuti</h4>
                  </div>
                  <span className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[9px] font-semibold text-[#6D28D9]">{detailActiveCourses.length} kelas aktif</span>
                </div>
                {detailActiveCourses.length > 0 ? (
                  <div className="space-y-2">
                    {detailActiveCourses.map((enrollment) => {
                      const course = courses.find((item) => item.id === enrollment.course_id);
                      return (
                        <div key={enrollment.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F8F7FC] px-3 py-2.5">
                          <p className="min-w-0 truncate text-[11px] font-semibold text-[#584C6E]">{course?.title || "Kelas tidak ditemukan"}</p>
                          <span className="shrink-0 text-[9px] text-[#9D97B4]">Aktif sejak {formatDate(enrollment.granted_at || enrollment.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#F8F7FC] px-3 py-4 text-center text-[11px] text-[#9D97B4]">Peserta belum memiliki akses kelas aktif.</p>
                )}
              </section>
            </div>

            <div className="flex shrink-0 justify-end border-t border-[#F1EEF6] px-4 py-3 sm:px-5 sm:py-3">
              <button type="button" onClick={closeDetail} className="inline-flex h-9 min-h-0 items-center justify-center rounded-lg bg-[#F3EEFF] px-4 text-[11px] font-semibold text-[#6D28D9] transition hover:bg-[#EAE1FF]">Tutup Detail</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
