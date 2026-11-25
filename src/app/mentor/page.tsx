import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  status: string;
};

function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof BookOpen;
  tone: "teal" | "violet" | "amber" | "green";
}) {
  const tones = {
    teal: "bg-violet-50 text-violet-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="app-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[30px] font-extrabold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">{note}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
}

export default async function MentorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: assignments, error: assignmentError } = await supabase
    .from("course_task_mentors")
    .select("course_id")
    .eq("mentor_user_id", user.id);

  if (assignmentError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Gagal memuat kelas Mentor: {assignmentError.message}
      </div>
    );
  }

  const courseIds = Array.from(new Set((assignments ?? []).map((row) => row.course_id)));
  let courses: CourseRow[] = [];
  let taskCount = 0;
  let pendingCount = 0;
  let revisionCount = 0;
  let reviewedCount = 0;

  if (courseIds.length) {
    const [courseResult, taskResult] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, slug, short_description, cover_image_url, status")
        .in("id", courseIds)
        .order("title", { ascending: true }),
      supabase
        .from("course_tasks")
        .select("id", { count: "exact", head: true })
        .in("course_id", courseIds),
    ]);
    courses = (courseResult.data ?? []) as CourseRow[];
    taskCount = taskResult.count ?? 0;

    const { data: tasks } = await supabase
      .from("course_tasks")
      .select("id")
      .in("course_id", courseIds);

    const taskIds = (tasks ?? []).map((task) => task.id);
    if (taskIds.length) {
      const { data: submissions } = await supabase
        .from("course_task_submissions")
        .select("status")
        .in("task_id", taskIds);
      pendingCount = (submissions ?? []).filter((item) => item.status === "submitted").length;
      revisionCount = (submissions ?? []).filter((item) => item.status === "revision_requested").length;
      reviewedCount = (submissions ?? []).filter((item) => item.status === "reviewed").length;
    }
  }


  return (
    <div className="kcc-mentor-dashboard space-y-7">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#211a37]">Ringkasan mengajar</h2>
          <p className="mt-1 text-sm text-slate-500">Aktivitas pada kelas yang ditugaskan kepadamu.</p>
        </div>
        <Link href="/mentor/kelas" className="app-secondary-button shrink-0">Lihat kelas <ArrowRight size={15} /></Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Kelas ditugaskan" value={courses.length} note="Akses dari penugasan Admin" icon={BookOpen} tone="teal" />
        <Metric label="Tugas kelas" value={taskCount} note="Tugas pada kelas yang kamu dampingi" icon={ClipboardList} tone="violet" />
        <Metric label="Menunggu pemeriksaan" value={pendingCount} note="Karya yang perlu diperiksa" icon={ClipboardCheck} tone="amber" />
        <Metric label="Selesai dinilai" value={reviewedCount} note={`${revisionCount} pengumpulan menunggu revisi`} icon={CheckCircle2} tone="green" />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Kelas yang ditugaskan</h2>
          </div>
          <Link href="/mentor/kelas" className="text-[11px] font-bold text-violet-700 hover:text-violet-900">Kelola kelas</Link>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-[#eae5ed] bg-white px-6 py-12 text-center">
            <BookOpen className="mx-auto text-slate-300" size={32} />
            <h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada kelas yang ditugaskan</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
              Admin perlu menetapkan akunmu sebagai Mentor melalui Manajemen Mentor dan Manajemen Tugas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="overflow-hidden rounded-xl border border-[#eae5ed] bg-white">
                {course.cover_image_url ? (
                  <img src={course.cover_image_url} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700">
                    <BookOpen size={34} />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-800">
                      {course.status === "published" ? "Kelas aktif" : "Akses Mentor"}
                    </span>
                    <span className="text-[9px] text-slate-400">Ditugaskan oleh Admin</span>
                  </div>
                  <h3 className="mt-3 text-base font-extrabold text-slate-900">{course.title}</h3>
                  {course.short_description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{course.short_description}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/mentor/materi?course=${course.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-700 px-3.5 text-[10px] font-bold text-white hover:bg-violet-800">
                      Kelola materi <ArrowRight size={13} />
                    </Link>
                    <Link href={`/mentor/kelola-tugas?course=${course.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-[10px] font-bold text-slate-600 hover:border-violet-200 hover:text-violet-800">
                      Kelola tugas
                    </Link>
                    <Link href={`/mentor/kelas/${course.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-[10px] font-bold text-slate-600 hover:border-violet-200 hover:text-violet-800">
                      Pengaturan kelas
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
