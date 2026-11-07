import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList, Layers3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function MentorClassesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignments, error } = await supabase
    .from("course_task_mentors")
    .select("course_id, created_at")
    .eq("mentor_user_id", user.id)
    .order("created_at", { ascending: false });

  const ids = Array.from(new Set((assignments ?? []).map((row) => row.course_id)));
  const { data: courses, error: coursesError } = ids.length
    ? await supabase
        .from("courses")
        .select("id, title, slug, short_description, description, cover_image_url, status")
        .in("id", ids)
        .order("title", { ascending: true })
    : { data: [], error: null };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-3 rounded-[20px] bg-white/90 p-4 shadow-[0_8px_22px_rgba(38,27,72,.05)] sm:flex-row sm:items-center sm:p-5">
        <p className="max-w-2xl text-xs leading-6 text-[#77738b]">Kelas yang ditetapkan Admin akan muncul di sini. Kamu dapat mengelola materi dan tugas sesuai kelas yang dipercayakan kepadamu.</p>
        <div className="rounded-xl bg-[#f5f1ff] px-4 py-2.5"><p className="text-[9px] font-bold text-violet-700">Total kelas</p><p className="mt-0.5 text-xl font-extrabold text-violet-900">{courses?.length ?? 0}</p></div>
      </section>

      {(error || coursesError) && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          {error?.message ?? coursesError?.message}
        </div>
      )}

      {!courses?.length ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_8px_22px_rgba(38,27,72,.055)]">
          <BookOpen className="mx-auto text-slate-300" size={34} />
          <h3 className="mt-3 text-sm font-bold text-slate-800">Belum ada kelas untuk ditampilkan</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
            Hubungi Admin agar kelas yang perlu kamu dampingi ditambahkan ke penugasan Mentor.
          </p>
          <Link href="/mentor" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white">Kembali ke dashboard <ArrowRight size={14} /></Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {courses.map((course) => (
            <article key={course.id} className="group overflow-hidden rounded-[22px] bg-white shadow-[0_8px_24px_rgba(38,27,72,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(38,27,72,.10)]">
              {course.cover_image_url ? (
                <img src={course.cover_image_url} alt="" className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700"><BookOpen size={36} /></div>
              )}
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-800">{course.status === "published" ? "Kelas aktif" : "Kelas ditugaskan"}</span>
                  <span className="text-[9px] text-slate-400">Akses terbatas sesuai penugasan</span>
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-slate-900">{course.title}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{course.short_description || course.description || "Belum ada deskripsi kelas."}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/mentor/materi?course=${course.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-[11px] font-bold text-white hover:bg-violet-800"><Layers3 size={15} /> Bab & Materi</Link>
                  <Link href={`/mentor/kelola-tugas?course=${course.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-600 hover:border-violet-200 hover:text-violet-800"><ClipboardList size={15} /> Kelola Tugas</Link>
                  <Link href={`/mentor/kelas/${course.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-600 hover:border-violet-200 hover:text-violet-800">Pengaturan Kelas</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
