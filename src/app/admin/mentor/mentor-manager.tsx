"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  UserX,
} from "lucide-react";

export type MentorAccount = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
  assignedCourses: string[];
};

type Props = {
  initialAccounts: MentorAccount[];
  initialError: string | null;
};

type FilterType = "all" | "mentor" | "not_mentor";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrator";
  if (role === "instructor") return "Mentor";
  if (role === "member") return "Member";
  return role;
}

export default function MentorManager({
  initialAccounts,
  initialError,
}: Props) {
  const confirmDialog = useConfirmDialog();
  const supabase = useMemo(() => createClient(), []);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState("");

  const mentorCount = accounts.filter((account) =>
    account.roles.includes("instructor")
  ).length;

  const assignedMentorCount = accounts.filter(
    (account) =>
      account.roles.includes("instructor") &&
      account.assignedCourses.length > 0
  ).length;

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const isMentor = account.roles.includes("instructor");

      const matchesFilter =
        filter === "all" ||
        (filter === "mentor" && isMentor) ||
        (filter === "not_mentor" && !isMentor);

      const matchesSearch =
        !keyword ||
        account.full_name.toLowerCase().includes(keyword) ||
        account.id.toLowerCase().includes(keyword) ||
        (account.phone ?? "").toLowerCase().includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [accounts, filter, search]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError("");
    setSuccess("");

    try {
      const [
        profilesResult,
        rolesResult,
        assignmentsResult,
        coursesResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),

        supabase
          .from("user_roles")
          .select("user_id, role")
          .limit(5000),

        supabase
          .from("course_task_mentors")
          .select("mentor_user_id, course_id")
          .limit(5000),

        supabase
          .from("courses")
          .select("id, title")
          .limit(1000),
      ]);

      const firstError =
        profilesResult.error ??
        rolesResult.error ??
        assignmentsResult.error ??
        coursesResult.error;

      if (firstError) throw firstError;

      const roleMap = new Map<string, string[]>();
      for (const row of rolesResult.data ?? []) {
        const current = roleMap.get(row.user_id) ?? [];
        if (!current.includes(row.role)) current.push(row.role);
        roleMap.set(row.user_id, current);
      }

      const courseMap = new Map<string, string>(
        (coursesResult.data ?? []).map((course) => [
          course.id,
          course.title,
        ] as const)
      );

      const assignmentsMap = new Map<string, string[]>();
      for (const row of assignmentsResult.data ?? []) {
        const title = courseMap.get(row.course_id);
        if (!title) continue;
        const current = assignmentsMap.get(row.mentor_user_id) ?? [];
        if (!current.includes(title)) current.push(title);
        assignmentsMap.set(row.mentor_user_id, current);
      }

      setAccounts(
        (profilesResult.data ?? []).map((profile) => ({
          ...profile,
          roles: roleMap.get(profile.id) ?? [],
          assignedCourses: assignmentsMap.get(profile.id) ?? [],
        }))
      );
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal memuat data mentor."
      );
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  async function activateMentor(account: MentorAccount) {
    if (account.roles.includes("instructor")) return;

    const confirmed = await confirmDialog({
      title: "Aktifkan role Mentor?",
      message: `Tambahkan role Mentor untuk akun "${account.full_name}"? Akun ini tetap mempertahankan role yang sudah dimiliki.`,
      confirmLabel: "Aktifkan Mentor",
      variant: "primary",
    });

    if (!confirmed) return;

    setBusyId(account.id);
    setError("");
    setSuccess("");

    try {
      const { error: upsertError } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: account.id,
            role: "instructor",
          },
          {
            onConflict: "user_id,role",
            ignoreDuplicates: true,
          }
        );

      if (upsertError) throw upsertError;

      await loadData();
      setSuccess(
        `Role Mentor berhasil diaktifkan untuk ${account.full_name}. Akun tersebut sekarang dapat ditugaskan ke kelas.`
      );
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal mengaktifkan role Mentor."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deactivateMentor(account: MentorAccount) {
    if (account.assignedCourses.length > 0) {
      setError(
        `Role Mentor ${account.full_name} belum dapat dicabut karena masih ditugaskan pada: ${account.assignedCourses.join(", ")}. Lepaskan penugasan kelas terlebih dahulu melalui Manajemen Tugas.`
      );
      return;
    }

    const confirmed = await confirmDialog({
      title: "Cabut role Mentor?",
      message: `Cabut role Mentor dari "${account.full_name}"? Role lain seperti Member tidak akan dihapus.`,
      confirmLabel: "Cabut role",
      variant: "danger",
    });

    if (!confirmed) return;

    setBusyId(account.id);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", account.id)
        .eq("role", "instructor");

      if (deleteError) throw deleteError;

      await loadData();
      setSuccess(
        `Role Mentor berhasil dicabut dari ${account.full_name}. Role lainnya tetap dipertahankan.`
      );
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal mencabut role Mentor."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-7 text-[#1B1730]">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6D28D9]">
            <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
            Instructor Management
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#817A97]">
            Aktifkan role Mentor pada akun yang sudah terdaftar, pantau kelas
            yang ditugaskan, dan atur penugasan melalui Manajemen Tugas.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/admin/tugas"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#EEEAF7] bg-white px-4 text-[12px] font-semibold text-[#6D28D9] transition hover:bg-[#F6F2FF]"
          >
            <BookOpen size={15} />
            Atur Penugasan Kelas
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/admin/mentor/publikasi"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#EEEAF7] bg-white px-4 text-[12px] font-semibold text-[#6D28D9] transition hover:bg-[#F6F2FF]"
          >
            <FileCheck2 size={15} />
            Review Materi
          </Link>
          <Link
            href="/admin/mentor/profil"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#EEEAF7] bg-white px-4 text-[12px] font-semibold text-[#6D28D9] transition hover:bg-[#F6F2FF]"
          >
            <UserRound size={15} />
            Review Profil
          </Link>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5B21B6] disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Memuat..." : "Perbarui Data"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[20px] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#817A97]">Total akun terdaftar</p>
          <p className="mt-2 text-3xl font-bold">{accounts.length}</p>
          <p className="mt-1 text-[11px] text-[#9D97B4]">
            Akun yang dapat diberi role Mentor
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#817A97]">Mentor aktif</p>
          <p className="mt-2 text-3xl font-bold">{mentorCount}</p>
          <p className="mt-1 text-[11px] text-[#9D97B4]">
            Memiliki role instructor
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-5 shadow-sm">
          <p className="text-xs text-[#817A97]">Mentor dengan penugasan</p>
          <p className="mt-2 text-3xl font-bold">{assignedMentorCount}</p>
          <p className="mt-1 text-[11px] text-[#9D97B4]">
            Sudah ditetapkan pada minimal satu kelas
          </p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-xs font-medium text-rose-700"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-700"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#F7F5FB] p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#6D28D9]">
              <GraduationCap size={21} />
            </div>
            <div>
              <h3 className="text-base font-semibold">Daftar Akun dan Role Mentor</h3>
              <p className="mt-1 text-[11px] text-[#9D97B4]">
                Pilih akun yang sudah terdaftar untuk mengaktifkan akses Mentor.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(200px,1fr)_180px] xl:min-w-[440px]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9D97B4]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau ID akun..."
                className="h-11 w-full rounded-xl bg-[#F7F6FC] pl-11 pr-4 text-xs outline-none focus:ring-2 focus:ring-violet-600/20"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterType)}
              className="h-11 rounded-xl bg-[#F7F6FC] px-4 text-xs font-semibold text-[#6C6280] outline-none"
            >
              <option value="all">Semua Akun</option>
              <option value="mentor">Sudah Menjadi Mentor</option>
              <option value="not_mentor">Belum Menjadi Mentor</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-[#F7F5FB]">
          {filteredAccounts.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <UserRound className="mx-auto text-slate-300" size={32} />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Tidak ada akun yang cocok
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Coba ubah kata kunci atau filter pencarian.
              </p>
            </div>
          ) : (
            filteredAccounts.map((account) => {
              const isMentor = account.roles.includes("instructor");
              const isBusy = busyId === account.id;

              return (
                <article
                  key={account.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-[#FFFFFF] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {account.avatar_url ? (
                      <img
                        src={account.avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F1EBFF] text-sm font-bold text-[#6D28D9]">
                        {initials(account.full_name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-bold text-[#211A37]">
                          {account.full_name || "Pengguna tanpa nama"}
                        </h4>
                        {account.roles.map((role) => (
                          <span
                            key={role}
                            className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                              role === "admin"
                                ? "bg-violet-50 text-violet-700"
                                : role === "instructor"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-violet-50 text-violet-700"
                            }`}
                          >
                            {roleLabel(role)}
                          </span>
                        ))}
                        {account.roles.length === 0 && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] text-slate-500">
                            Belum memiliki role
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[10px] text-[#9D97B4]">
                        ID: {account.id}
                        {account.phone ? ` · ${account.phone}` : ""}
                      </p>
                      <p className="mt-1 text-[10px] text-[#9D97B4]">
                        Bergabung {formatDate(account.created_at)}
                      </p>

                      {account.assignedCourses.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {account.assignedCourses.map((course) => (
                            <span
                              key={course}
                              className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700"
                            >
                              {course}
                            </span>
                          ))}
                        </div>
                      ) : (
                        isMentor && (
                          <p className="mt-2 text-[10px] text-amber-700">
                            Belum ditugaskan ke kelas.
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {isMentor ? (
                      <button
                        type="button"
                        onClick={() => void deactivateMentor(account)}
                        disabled={isBusy}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <UserX size={14} />
                        )}
                        Cabut Role Mentor
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void activateMentor(account)}
                        disabled={isBusy}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-[11px] font-semibold text-white transition hover:bg-[#5B21B6] disabled:opacity-50"
                      >
                        {isBusy ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <UserPlus size={14} />
                        )}
                        Aktifkan sebagai Mentor
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#F7F5FB] bg-[#FFFFFF] px-5 py-4 text-[10px] leading-5 text-[#9D97B4] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Menampilkan {filteredAccounts.length} dari {accounts.length} akun.</span>
          <span>Role Mentor ditambahkan tanpa menghapus role Member atau Administrator.</span>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-violet-700" size={19} />
          <div>
            <h3 className="text-sm font-bold text-violet-900">
              Bagaimana cara mengaktifkan Mentor?
            </h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-5 text-violet-900/80">
              <li>Pastikan orang yang akan menjadi Mentor sudah memiliki akun Kiki Creator Class.</li>
              <li>Cari akunnya di daftar di atas, lalu klik <strong>Aktifkan sebagai Mentor</strong>.</li>
              <li>Buka <strong>Manajemen Tugas</strong>, pilih kelas, lalu tentukan Mentor pada panel Penugasan Mentor.</li>
              <li>Mentor login kembali. Akun dengan role Mentor saja diarahkan ke Workspace Mentor.</li>
            </ol>
            <p className="mt-3 text-[10px] leading-5 text-violet-900/70">
              Catatan: tombol ini mengaktifkan role untuk akun yang sudah terdaftar. Undangan email dan pembuatan akun baru otomatis akan dibuat pada tahap lanjutan.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
