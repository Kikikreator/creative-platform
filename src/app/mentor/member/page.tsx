import Link from "next/link";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Eye, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";

type AssignedCourse = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: string;
};

export default async function MentorMemberModePage() {
  await connection();

  const cookieStore = await cookies();
  if (cookieStore.get("kcc_mentor_mode")?.value !== "member") {
    redirect("/mentor");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/mentor/member")}`);
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(`Gagal memeriksa role akun: ${roleError.message}`);
  }

  const roles = normalizeRoles(roleRows);
  if (hasRole(roles, "admin")) redirect("/admin");
  if (!hasRole(roles, "instructor")) redirect("/dashboard");

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("course_task_mentors")
    .select("course_id")
    .eq("mentor_user_id", user.id);

  if (assignmentError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Kelas yang ditugaskan belum dapat dimuat: {assignmentError.message}
      </div>
    );
  }

  const courseIds = Array.from(new Set((assignmentRows ?? []).map((row) => row.course_id)));
  let courses: AssignedCourse[] = [];
  let courseErrorMessage = "";

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, slug, short_description, description, cover_image_url, status")
      .in("id", courseIds)
      .eq("status", "published")
      .order("title", { ascending: true });

    if (error) courseErrorMessage = error.message;
    courses = (data ?? []) as AssignedCourse[];
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] border border-teal-100 bg-gradient-to-br from-white via-white to-teal-50 p-5 shadow-[0_10px_30px_rgba(38,27,72,.055)] sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.14em] text-teal-800">
              <Eye size={13} /> Mode Member · Hanya Lihat
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-[#211a37] sm:text-2xl">
              Tinjau kelas yang kamu ampu.
            </h2>
            <p className="mt-2 text-xs leading-6 text-[#77738b] sm:text-sm">
              Buka materi dan instruksi tugas sebagaimana tampilan peserta. Dalam mode ini kamu tidak dapat mengerjakan, mengumpulkan tugas, menandai materi selesai, atau memperoleh progres belajar.
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
            <BookOpen size={27} />
          </div>
        </div>
      </section>

      {courseErrorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          Gagal memuat daftar kelas: {courseErrorMessage}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-teal-700">Kelas ditugaskan</p>
            <h3 className="mt-1 text-lg font-extrabold text-slate-900">Kelas yang bisa ditinjau</h3>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-bold text-teal-800">{courses.length} kelas</span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-[22px] border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <GraduationCap className="mx-auto text-slate-300" size={36} />
            <h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada kelas yang dapat ditinjau</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
              Kelas akan muncul setelah Admin menetapkan kamu sebagai Mentor dan materi kelas tersebut dipublikasikan.
            </p>
            <p className="mt-4 text-[10px] font-semibold text-teal-800">
              Untuk kembali mengajar, pilih Mode Mentor melalui dropdown di bagian atas halaman.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_8px_24px_rgba(38,27,72,.06)]">
                {course.cover_image_url ? (
                  <div className="h-44 bg-slate-100">
                    <img src={course.cover_image_url} alt={`Sampul ${course.title}`} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-teal-50 to-violet-50 text-teal-800">
                    <BookOpen size={38} />
                  </div>
                )}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-bold text-teal-800">Kelas ditugaskan</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400"><Eye size={12} /> Akses hanya lihat</span>
                  </div>
                  <h4 className="mt-3 text-lg font-extrabold text-slate-900">{course.title}</h4>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-6 text-slate-500">
                    {course.short_description || course.description || "Materi kelas yang telah dipublikasikan."}
                  </p>
                  <Link href={`/kelas/${course.slug}/belajar`} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-[11px] font-bold text-white transition hover:bg-teal-800">
                    Lihat Materi & Tugas <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
