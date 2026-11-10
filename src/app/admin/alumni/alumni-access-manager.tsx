"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Filter,
  FileImage,
  Mail,
  Link2,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";

export type AlumniAccessRequestRow = {
  id: string;
  full_name: string;
  email: string;
  whatsapp_number: string;
  course_id: string;
  previous_platform: string | null;
  proof_note: string | null;
  evidence_path: string | null;
  status: "pending" | "approved" | "rejected" | "claimed" | string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

export type AlumniAdminCourseOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type Props = {
  initialRequests: AlumniAccessRequestRow[];
  courses: AlumniAdminCourseOption[];
  initialError: string | null;
};

type FilterValue = "all" | "pending" | "approved" | "claimed" | "rejected" | "expired";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isExpired(row: AlumniAccessRequestRow) {
  return row.status === "approved" && Boolean(row.expires_at) &&
    new Date(row.expires_at as string).getTime() <= Date.now();
}

function statusMeta(row: AlumniAccessRequestRow) {
  if (isExpired(row)) {
    return { label: "Kedaluwarsa", className: "bg-amber-50 text-amber-700", icon: Clock3 };
  }
  switch (row.status) {
    case "pending":
      return { label: "Menunggu verifikasi", className: "bg-amber-50 text-amber-700", icon: Clock3 };
    case "approved":
      return { label: "Disetujui · menunggu aktivasi", className: "bg-sky-50 text-sky-700", icon: CheckCircle2 };
    case "claimed":
      return { label: "Sudah diaktifkan", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
    case "rejected":
      return { label: "Ditolak", className: "bg-rose-50 text-rose-700", icon: XCircle };
    default:
      return { label: row.status, className: "bg-slate-100 text-slate-600", icon: Filter };
  }
}

export default function AlumniAccessManager({
  initialRequests,
  courses,
  initialError,
}: Props) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [requests, setRequests] = useState(initialRequests);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<{ id: string; message: string } | null>(null);

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((row) => row.status === "pending").length,
    approved: requests.filter((row) => row.status === "approved" && !isExpired(row)).length,
    claimed: requests.filter((row) => row.status === "claimed").length,
    rejected: requests.filter((row) => row.status === "rejected").length,
  }), [requests]);

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return requests.filter((row) => {
      const expired = isExpired(row);
      const matchesFilter =
        filter === "all" ||
        (filter === "expired" && expired) ||
        (filter === "approved" && row.status === "approved" && !expired) ||
        (filter !== "expired" && filter !== "approved" && row.status === filter);
      const courseTitle = courseMap.get(row.course_id) ?? "Kelas tidak ditemukan";
      const matchesSearch = !keyword ||
        row.full_name.toLowerCase().includes(keyword) ||
        row.email.toLowerCase().includes(keyword) ||
        row.whatsapp_number.toLowerCase().includes(keyword) ||
        courseTitle.toLowerCase().includes(keyword);
      return matchesFilter && matchesSearch;
    });
  }, [requests, search, filter, courseMap]);

  async function prepareEvidenceLink(row: AlumniAccessRequestRow) {
    if (!row.evidence_path || evidenceLoadingId) return;

    setEvidenceLoadingId(row.id);
    setEvidenceError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("alumni-evidence")
        .createSignedUrl(row.evidence_path, 15 * 60);

      if (error) throw new Error(error.message);
      if (!data?.signedUrl) throw new Error("Tautan bukti tidak tersedia.");

      setEvidenceUrls((current) => ({
        ...current,
        [row.id]: data.signedUrl,
      }));
    } catch (error) {
      setEvidenceError({
        id: row.id,
        message: error instanceof Error ? error.message : "Bukti tidak dapat dibuka.",
      });
    } finally {
      setEvidenceLoadingId(null);
    }
  }

  async function reviewRequest(row: AlumniAccessRequestRow, decision: "approved" | "rejected") {
    if (savingId) return;

    if (decision === "rejected") {
      const approved = await confirm({
        title: "Tolak pengajuan akses alumni?",
        message: `Pengajuan dari ${row.full_name} akan ditolak. Tindakan ini dapat diberitahukan kepada pemohon.`,
        confirmLabel: "Tolak pengajuan",
        cancelLabel: "Batal",
        variant: "danger",
      });
      if (!approved) return;
    }

    setSavingId(row.id);
    setActionError("");
    setActionSuccess("");

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_review_alumni_access_request", {
        p_request_id: row.id,
        p_decision: decision,
        p_admin_note: null,
        p_valid_days: 30,
      });
      if (error) throw new Error(error.message);

      const now = new Date().toISOString();
      const expiry = decision === "approved"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      setRequests((current) => current.map((item) => item.id === row.id
        ? { ...item, status: decision, reviewed_at: now, expires_at: expiry }
        : item));
      setActionSuccess(
        decision === "approved"
          ? `Pengajuan ${row.full_name} disetujui. Kirim tautan pribadi agar peserta membuat akun dengan email aktif, lalu mengaktifkan akses gratis.`
          : `Pengajuan ${row.full_name} ditolak.`,
      );
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Tindakan belum berhasil.");
    } finally {
      setSavingId(null);
    }
  }

  async function copyPublicInvitationLink() {
    const invitationUrl = `${window.location.origin}/akses-alumni`;
    setActionError("");
    setActionSuccess("");

    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedPublicLink(true);
      window.setTimeout(() => setCopiedPublicLink(false), 2000);
    } catch {
      setActionError(`Browser tidak mengizinkan penyalinan otomatis. Salin tautan ini: ${invitationUrl}`);
    }
  }

  async function copyActivationMessage(row: AlumniAccessRequestRow) {
    // Link ini bersifat personal: UUID pengajuan digunakan sebagai token untuk
    // menampilkan status tanpa membuka tabel alumni_access_requests secara publik.
    const activationUrl = `${window.location.origin}/akses-alumni?request=${encodeURIComponent(row.id)}`;
    const message = [
      `Halo ${row.full_name},`,
      "",
      "Pengajuan Akses Alumni Kiki Creator Class kamu sudah DISETUJUI.",
      `Kelas yang diberikan: ${courseMap.get(row.course_id) ?? "Kelas pilihanmu"}`,
      "",
      "Ikuti langkah berikut untuk mengaktifkan kelas gratis:",
      "1. Buka tautan pribadi Akses Alumni ini:",
      activationUrl,
      "2. Tekan tombol ‘Buat Akun Alumni’. Email pengajuan sudah disiapkan otomatis; pastikan email itu aktif dan benar-benar milikmu.",
      "3. Buat password. Tidak ada email verifikasi yang dikirim; akun akan langsung dibuat setelah Admin menyetujui pengajuan.",
      "4. Setelah akun dibuat, login jika belum masuk, lalu kembali ke halaman Akses Alumni.",
      "5. Tekan ‘Aktifkan Akses Gratis’. Kelas akan masuk ke menu Kelas Saya.",
      "",
      "Kamu tidak perlu membeli kelas atau melakukan checkout lagi. Akses ini diberikan gratis sebagai peserta lama.",
      "",
      "Tautan ini khusus untuk pengajuanmu. Jangan bagikan kepada orang lain. Aktivasi paling lambat 30 hari sejak persetujuan.",
      "Jika mengalami kendala, balas pesan ini agar Admin dapat membantu.",
      "",
      "Kiki Creator Class",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((current) => current === row.id ? null : current), 1800);
    } catch {
      setActionError("Browser tidak mengizinkan penyalinan otomatis. Salin tautan halaman alumni secara manual: " + activationUrl);
    }
  }

  return (
    <div className="space-y-5">
      {initialError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
          Data Akses Alumni belum dapat dimuat. Pastikan SQL migration sudah dijalankan. Detail: {initialError}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
          {actionSuccess}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-[#EAE5ED] bg-white p-4 shadow-[0_5px_18px_rgba(38,0,71,.035)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#30243A]">Link formulir peserta lama</h3>
          <p className="mt-1 text-xs leading-5 text-[#8D8294]">Bagikan halaman ini kepada alumni agar mereka mengajukan akses kelas secara mandiri.</p>
          <p className="mt-1 break-all text-[11px] font-medium text-[#6B3B88]">/akses-alumni</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href="/akses-alumni"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5DDEA] px-3.5 text-xs font-medium text-[#51465D] transition hover:bg-[#FAF8FB]"
          >
            <Link2 size={14} /> Buka halaman
          </a>
          <button
            type="button"
            onClick={copyPublicInvitationLink}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#260047] px-3.5 text-xs font-semibold text-white transition hover:bg-[#3A0A5E]"
          >
            {copiedPublicLink ? <Check size={14} /> : <Copy size={14} />}
            {copiedPublicLink ? "Link tersalin" : "Salin link undangan"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total pengajuan", value: counts.total, tone: "bg-[#F3EFF8] text-[#260047]" },
          { label: "Menunggu verifikasi", value: counts.pending, tone: "bg-amber-50 text-amber-700" },
          { label: "Disetujui", value: counts.approved, tone: "bg-sky-50 text-sky-700" },
          { label: "Sudah diaktifkan", value: counts.claimed, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Ditolak", value: counts.rejected, tone: "bg-rose-50 text-rose-700" },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-[#EAE5ED] bg-white p-4 shadow-[0_5px_18px_rgba(38,0,71,.035)]">
            <p className="text-xs font-medium text-[#817688]">{item.label}</p>
            <p className={`mt-2 inline-flex min-w-10 items-center justify-center rounded-xl px-3 py-1.5 text-xl font-semibold ${item.tone}`}>
              {item.value}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#EAE5ED] bg-white shadow-[0_8px_24px_rgba(38,0,71,.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F0ECF2] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#30243A]">Daftar pengajuan alumni</h3>
            <p className="mt-1 text-xs text-[#8D8294]">Periksa identitas dan kelas sebelum memberikan akses gratis.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A49AAA]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau kelas"
                className="h-10 w-full rounded-xl border border-[#E7E0EB] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#6B3B88]"
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterValue)}
              className="h-10 rounded-xl border border-[#E7E0EB] bg-white px-3 text-xs text-[#51465D] outline-none focus:border-[#6B3B88]"
            >
              <option value="all">Semua status</option>
              <option value="pending">Menunggu verifikasi</option>
              <option value="approved">Disetujui</option>
              <option value="claimed">Sudah diaktifkan</option>
              <option value="expired">Kedaluwarsa</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3EFF8] text-[#6A4380]">
              <UserRound size={22} />
            </span>
            <h4 className="mt-3 text-sm font-semibold text-[#30243A]">Belum ada pengajuan</h4>
            <p className="mt-1 text-xs text-[#948B9B]">Pengajuan peserta lama akan tampil di halaman ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0ECF2]">
            {filteredRequests.map((row) => {
              const status = statusMeta(row);
              const StatusIcon = status.icon;
              const courseTitle = courseMap.get(row.course_id) ?? "Kelas tidak ditemukan";
              const busy = savingId === row.id;

              return (
                <article key={row.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#30243A]">{row.full_name}</h4>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${status.className}`}>
                          <StatusIcon size={12} /> {status.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col gap-1.5 text-xs text-[#766D7D] sm:flex-row sm:flex-wrap sm:gap-x-4">
                        <span className="inline-flex items-center gap-1.5 break-all"><Mail size={13} /> {row.email}</span>
                        <span className="inline-flex items-center gap-1.5"><MessageCircle size={13} /> {row.whatsapp_number}</span>
                      </div>
                      <div className="mt-3 rounded-xl bg-[#FAF8FB] p-3">
                        <p className="text-xs font-semibold text-[#51465D]">{courseTitle}</p>
                        {row.previous_platform?.trim() && (
                          <p className="mt-1 text-[11px] text-[#8E8494]">
                            Platform sebelumnya: {row.previous_platform}
                          </p>
                        )}
                        {row.proof_note && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#62576D]">
                            Keterangan bukti: {row.proof_note}
                          </p>
                        )}
                        {row.evidence_path && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {evidenceUrls[row.id] ? (
                              <a
                                href={evidenceUrls[row.id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#DED4E6] bg-white px-3 text-[11px] font-semibold text-[#40334B] hover:bg-[#F7F3FA]"
                              >
                                <FileImage size={13} /> Buka foto bukti
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => prepareEvidenceLink(row)}
                                disabled={evidenceLoadingId === row.id}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#DED4E6] bg-white px-3 text-[11px] font-semibold text-[#40334B] hover:bg-[#F7F3FA] disabled:opacity-60"
                              >
                                <FileImage size={13} />
                                {evidenceLoadingId === row.id ? "Menyiapkan tautan..." : "Lihat foto bukti"}
                              </button>
                            )}
                            {evidenceError?.id === row.id && (
                              <span role="alert" className="text-[11px] text-rose-600">
                                {evidenceError.message}
                              </span>
                            )}
                          </div>
                        )}
                        {!row.proof_note && !row.evidence_path && (
                          <p className="mt-1 text-[11px] text-[#8E8494]">
                            Tidak ada bukti yang dilampirkan.
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#A097A7]">
                        <span>Diajukan: {formatDate(row.created_at)}</span>
                        {row.reviewed_at && <span>Ditinjau: {formatDate(row.reviewed_at)}</span>}
                        {row.expires_at && row.status === "approved" && <span>Batas aktivasi: {formatDate(row.expires_at)}</span>}
                        {row.claimed_at && <span>Diaktifkan: {formatDate(row.claimed_at)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:max-w-[280px] xl:justify-end">
                      {row.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => reviewRequest(row, "approved")}
                            disabled={Boolean(savingId)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#260047] px-3.5 text-xs font-semibold text-white transition hover:bg-[#3A0A5E] disabled:opacity-50"
                          >
                            {busy ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                            Setujui 30 hari
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewRequest(row, "rejected")}
                            disabled={Boolean(savingId)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            <X size={14} /> Tolak
                          </button>
                        </>
                      )}
                      {row.status === "approved" && !isExpired(row) && (
                        <button
                          type="button"
                          onClick={() => copyActivationMessage(row)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#E5DDEA] px-3.5 text-xs font-semibold text-[#51465D] transition hover:bg-[#FAF8FB]"
                        >
                          {copiedId === row.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === row.id ? "Pesan disalin" : "Salin pesan undangan"}
                        </button>
                      )}
                      {row.status === "claimed" && (
                        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 text-xs font-medium text-emerald-700">
                          <ShieldCheck size={14} /> Akses aktif
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-[#EAE5ED] bg-[#FCFBFD] px-4 py-3 text-xs leading-5 text-[#827889]">
        <strong className="font-semibold text-[#51465D]">Catatan:</strong> Persetujuan tidak mengirim email otomatis. Setelah menyetujui, gunakan tombol “Salin pesan undangan” untuk mengirim tautan pribadi melalui WhatsApp. Peserta membuat akun dari tautan tersebut menggunakan email aktif miliknya, lalu mengaktifkan akses gratis. Sistem tidak mengirim email verifikasi; Admin dapat menghubungi peserta melalui WhatsApp bila perlu konfirmasi.
      </div>
    </div>
  );
}
