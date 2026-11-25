"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  X,
  Briefcase,
  Globe2,
  Sparkles,
} from "lucide-react";

export type AdminMentorAssignedCourse = {
  id: string;
  title: string;
  category: string | null;
};

export type AdminMentorProfile = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  education: string | null;
  experience: string | null;
  portfolio_url: string | null;
  photo_url: string | null;
  cv_path: string | null;
  cv_file_name: string | null;
  approval_status: string;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  assigned_courses: AdminMentorAssignedCourse[];
};

function dateLabel(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusText(status: string) {
  if (status === "approved") return "Disetujui";
  if (status === "pending") return "Menunggu pemeriksaan";
  if (status === "revision_requested") return "Perlu perbaikan";
  if (status === "draft") return "Draft";
  return "Belum mengisi";
}

function statusClass(status: string) {
  if (status === "approved")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "revision_requested")
    return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "draft")
    return "border-slate-200 bg-slate-100 text-slate-600";

  return "border-violet-200 bg-violet-50 text-violet-700";
}

function assignedFields(item: AdminMentorProfile) {
  return Array.from(
    new Set(
      item.assigned_courses
        .map((course) => course.category?.trim() || course.title)
        .filter(Boolean)
    )
  );
}

function DetailCard({
  icon,
  title,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          {icon}
        </span>

        <h4 className="text-xs font-extrabold text-slate-800 sm:text-sm">
          {title}
        </h4>
      </div>

      {children}
    </section>
  );
}

export default function MentorProfileReview({
  items,
  initialError,
}: {
  items: AdminMentorProfile[];
  initialError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [rows, setRows] = useState(items);
  const [selected, setSelected] = useState<AdminMentorProfile | null>(null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  // Sinkronkan daftar saat server page memuat ulang data terbaru.
  useEffect(() => {
    setRows(items);
  }, [items]);

  // Realtime Supabase.
  useEffect(() => {
    const channel = supabase
      .channel("admin-mentor-profile-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentor_profiles" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "course_task_mentors" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // Tutup popup menggunakan Escape dan kunci scroll halaman belakang.
  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busyId !== selected.user_id) {
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected, busyId]);

  // Pencarian mentor.
  const filteredRows = rows.filter((item) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return true;

    return (
      item.full_name.toLowerCase().includes(keyword) ||
      assignedFields(item).some((field) =>
        field.toLowerCase().includes(keyword)
      ) ||
      item.assigned_courses.some((course) =>
        course.title.toLowerCase().includes(keyword)
      )
    );
  });

  // Proses persetujuan dan permintaan revisi.
  async function review(
    item: AdminMentorProfile,
    decision: "approved" | "revision_requested"
  ) {
    const note = notes[item.user_id]?.trim() ?? "";

    if (decision === "revision_requested" && !note) {
      setError("Catatan perbaikan wajib diisi.");
      return;
    }

    setBusyId(item.user_id);
    setError("");
    setNotice("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "review_mentor_profile",
        {
          p_user_id: item.user_id,
          p_decision: decision,
          p_note: note || null,
        }
      );

      if (rpcError) throw rpcError;

      const updated = {
        ...item,
        approval_status: decision,
        admin_note: decision === "revision_requested" ? note : null,
      };

      setRows((current) =>
        current.map((row) =>
          row.user_id === item.user_id ? updated : row
        )
      );

      setSelected(updated);

      setNotice(
        decision === "approved"
          ? `Profil ${item.full_name} berhasil disetujui.`
          : `Catatan perbaikan dikirim kepada ${item.full_name}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses profil Mentor."
      );
    } finally {
      setBusyId(null);
    }
  }

  // Membuka CV melalui signed URL Supabase.
  async function openCv(item: AdminMentorProfile) {
    if (!item.cv_path) return;

    const { data, error: signedError } = await supabase.storage
      .from("mentor-private")
      .createSignedUrl(item.cv_path, 10 * 60);

    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? "CV belum dapat dibuka.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const selectedPhoto =
    selected?.photo_url || selected?.avatar_url || null;

  const selectedFields = selected
    ? assignedFields(selected)
    : [];

  return (
    <div className="space-y-5">

      {/* HEADER HALAMAN */}
      <section className="rounded-[22px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">
              Pengelolaan Mentor
            </p>

            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              Data Profil Mentor
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Pilih mentor untuk melihat biodata dan memeriksa profil lengkap.
            </p>
          </div>

          <div className="rounded-xl bg-violet-50 px-4 py-2.5">
            <p className="text-[9px] font-bold text-violet-700">
              Total mentor
            </p>

            <p className="mt-0.5 text-xl font-extrabold text-violet-900">
              {rows.length}
            </p>
          </div>
        </div>
      </section>

      {/* NOTIFIKASI */}
      {!selected && error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selected && notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* DAFTAR MENTOR */}
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <GraduationCap size={17} className="text-violet-700" />

            <h3 className="text-sm font-extrabold text-slate-900">
              Daftar Mentor
            </h3>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau bidang mentor..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound
              className="mx-auto text-slate-300"
              size={30}
            />

            <p className="mt-3 text-xs font-semibold text-slate-700">
              {rows.length
                ? "Mentor tidak ditemukan."
                : "Belum ada akun dengan role Mentor."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((item, index) => {

              // Ambil kategori/bidang mentor.
              const mentorCategories = Array.from(
                new Set(
                  item.assigned_courses
                    .map((course) => course.category?.trim())
                    .filter(
                      (category): category is string =>
                        Boolean(category)
                    )
                )
              );

              // Ambil nama kelas yang ditugaskan.
              const assignedClassNames = Array.from(
                new Set(
                  item.assigned_courses
                    .map((course) => course.title.trim())
                    .filter(Boolean)
                )
              );

              const photo = item.photo_url || item.avatar_url;
              const rowNumber = index + 1;

              return (
                <button
                  key={item.user_id}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setError("");
                    setNotice("");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-violet-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 sm:px-5"
                >

                  {/* NOMOR */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-extrabold text-slate-500">
                    {String(rowNumber).padStart(2, "0")}
                  </span>

                  {/* FOTO */}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-sm font-extrabold text-violet-700">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      item.full_name.charAt(0).toUpperCase()
                    )}
                  </span>

                  {/* INFORMASI MENTOR */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-extrabold text-slate-900">
                      {item.full_name}
                    </span>

                    <span className="mt-1 block truncate text-[10px] font-semibold text-violet-700">
                      {mentorCategories.length
                        ? `Mentor ${mentorCategories.join(" · ")}`
                        : "Bidang mentor belum ditentukan"}
                    </span>

                    {assignedClassNames.length > 0 && (
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        Kelas: {assignedClassNames.join(" · ")}
                      </span>
                    )}
                  </span>

                  {/* STATUS */}
                  <span
                    className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold sm:inline-flex ${statusClass(
                      item.approval_status
                    )}`}
                  >
                    {statusText(item.approval_status)}
                  </span>

                  <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-400"
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400 sm:px-5">
          Menampilkan {filteredRows.length} dari {rows.length} mentor. Klik nama mentor untuk membuka detail.
        </div>
      </section>

      {/* POPUP DETAIL MENTOR */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              busyId !== selected.user_id
            ) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-detail-title"
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[26px] border border-white/70 bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:rounded-[26px]"
          >

            {/* HEADER POPUP */}
            <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-violet-700">
                    Administrasi
                  </p>

                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusClass(
                      selected.approval_status
                    )}`}
                  >
                    {statusText(selected.approval_status)}
                  </span>
                </div>

                <h3
                  id="mentor-detail-title"
                  className="mt-1 text-base font-extrabold text-slate-900 sm:text-lg"
                >
                  Detail Profil Mentor
                </h3>

                <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">
                  Periksa informasi profesional dan dokumen mentor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={busyId === selected.user_id}
                aria-label="Tutup detail mentor"
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </header>

            {/* ISI POPUP */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 sm:p-6">

              {/* NOTIFIKASI POPUP */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
                >
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {/* IDENTITAS MENTOR */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                  {/* FOTO TERBATAS 76 X 76 PX */}
                  <div
                    className="shrink-0 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50 text-2xl font-extrabold text-violet-700 shadow-sm"
                    style={{
                      width: 76,
                      height: 76,
                      minWidth: 76,
                      minHeight: 76,
                      maxWidth: 76,
                      maxHeight: 76,
                      flex: "0 0 76px",
                    }}
                  >
                    {selectedPhoto ? (
                      <img
                        src={selectedPhoto}
                        alt={`Foto ${selected.full_name}`}
                        className="block"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        {selected.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Identitas pengajar
                    </p>

                    <h4 className="mt-1 break-words text-lg font-extrabold text-slate-900 sm:text-xl">
                      {selected.full_name}
                    </h4>

                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {selected.headline || "Jabatan belum diisi"}
                    </p>

                    {selectedFields.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedFields.map((field) => (
                          <span
                            key={field}
                            className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* PENUGASAN DARI ADMIN */}
              <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
                    <BookOpen size={16} />
                  </span>

                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 sm:text-sm">
                      Penugasan dari Admin
                    </h4>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Bidang dan kelas yang ditugaskan kepada mentor.
                    </p>
                  </div>
                </div>

                {selected.assigned_courses.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.assigned_courses.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-xl border border-violet-100 bg-white p-3"
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">
                          {course.category || "Bidang pengajaran"}
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-800">
                          {course.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-violet-200 bg-white/70 p-3 text-xs text-slate-500">
                    Mentor belum menerima penugasan kelas dari Admin.
                  </p>
                )}
              </section>

              {/* TENTANG SAYA */}
              <div className="grid gap-3">
                <DetailCard
                  icon={<UserRound size={16} />}
                  title="Tentang Saya"
                >
                  <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 sm:text-[13px]">
                    {selected.bio || "Informasi tentang mentor belum diisi."}
                  </p>
                </DetailCard>

                {/* KEAHLIAN */}
                <DetailCard
                  icon={<Sparkles size={16} />}
                  title="Keahlian"
                >
                  {selected.expertise?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.expertise.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Keahlian belum diisi.
                    </p>
                  )}
                </DetailCard>

                {/* PENDIDIKAN DAN PENGALAMAN */}
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailCard
                    icon={<GraduationCap size={16} />}
                    title="Pendidikan"
                  >
                    <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 sm:text-[13px]">
                      {selected.education ||
                        "Informasi pendidikan belum diisi."}
                    </p>
                  </DetailCard>

                  <DetailCard
                    icon={<Briefcase size={16} />}
                    title="Pengalaman Profesional"
                  >
                    <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 sm:text-[13px]">
                      {selected.experience ||
                        "Informasi pengalaman belum diisi."}
                    </p>
                  </DetailCard>
                </div>
              </div>

              {/* PORTOFOLIO DAN CV */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <FileText size={16} />
                  </span>

                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 sm:text-sm">
                      Portofolio & Dokumen
                    </h4>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Tautan karya dan curriculum vitae mentor.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">

                  {/* PORTOFOLIO */}
                  {selected.portfolio_url ? (
                    <a
                      href={selected.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-violet-200 hover:bg-violet-50/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <Globe2 size={16} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-slate-800">
                          Portofolio / Website
                        </span>

                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                          Lihat karya mentor
                        </span>
                      </span>

                      <ExternalLink
                        size={14}
                        className="shrink-0 text-slate-400 transition group-hover:text-violet-700"
                      />
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <Globe2 size={16} />
                      </span>

                      <span className="text-[10px] text-slate-400">
                        Portofolio belum ditambahkan.
                      </span>
                    </div>
                  )}

                  {/* CURRICULUM VITAE */}
                  {selected.cv_path ? (
                    <button
                      type="button"
                      onClick={() => void openCv(selected)}
                      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                        <FileText size={16} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-slate-800">
                          Curriculum Vitae
                        </span>

                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                          {selected.cv_file_name || "Buka dokumen CV"}
                        </span>
                      </span>

                      <ExternalLink
                        size={14}
                        className="shrink-0 text-slate-400 transition group-hover:text-violet-700"
                      />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <FileText size={16} />
                      </span>

                      <span className="text-[10px] text-slate-400">
                        CV belum diunggah.
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* INFORMASI PENGAJUAN */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <CalendarDays
                    size={14}
                    className="shrink-0 text-slate-400"
                  />

                  <span>
                    Diajukan:{" "}
                    <strong className="font-semibold text-slate-700">
                      {dateLabel(selected.submitted_at)}
                    </strong>
                  </span>
                </div>

                {selected.reviewed_at && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <CheckCircle2
                      size={14}
                      className="shrink-0 text-emerald-600"
                    />

                    <span>
                      Ditinjau:{" "}
                      <strong className="font-semibold text-slate-700">
                        {dateLabel(selected.reviewed_at)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* CATATAN ADMIN SEBELUMNYA */}
              {selected.admin_note && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      size={15}
                      className="text-amber-700"
                    />

                    <h4 className="text-xs font-extrabold text-amber-900">
                      Catatan Admin Sebelumnya
                    </h4>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-amber-800">
                    {selected.admin_note}
                  </p>
                </section>
              )}

              {/* FORM PEMERIKSAAN ADMIN */}
              {selected.approval_status === "pending" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-3">
                    <h4 className="text-xs font-extrabold text-slate-800 sm:text-sm">
                      Pemeriksaan Admin
                    </h4>

                    <p className="mt-1 text-[10px] leading-5 text-slate-500">
                      Isi catatan apabila profil perlu diperbaiki. Catatan wajib diisi sebelum meminta revisi.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
                      Catatan untuk Mentor
                    </span>

                    <textarea
                      rows={4}
                      value={notes[selected.user_id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [selected.user_id]: event.target.value,
                        }))
                      }
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                      placeholder="Tuliskan bagian profil yang perlu diperbaiki..."
                    />
                  </label>
                </section>
              )}

              {selected.approval_status === "not_started" && (
                <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                  Mentor belum menyimpan profil. Detail akan terisi setelah mentor melengkapi profilnya.
                </p>
              )}
            </div>

            {/* FOOTER AKSI */}
            <footer className="z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <p className="hidden text-[10px] text-slate-400 sm:block">
                {selected.approval_status === "pending"
                  ? "Pastikan profil sudah diperiksa sebelum mengambil keputusan."
                  : "Informasi profil mentor."}
              </p>

              {selected.approval_status === "pending" ? (
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">

                  {/* MINTA REVISI */}
                  <button
                    type="button"
                    onClick={() =>
                      void review(selected, "revision_requested")
                    }
                    disabled={busyId === selected.user_id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Minta Revisi
                  </button>

                  {/* SETUJUI PROFIL */}
                  <button
                    type="button"
                    onClick={() =>
                      void review(selected, "approved")
                    }
                    disabled={busyId === selected.user_id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === selected.user_id ? (
                      <RefreshCw
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}

                    {busyId === selected.user_id
                      ? "Memproses..."
                      : "Setujui Profil"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  Tutup
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}