
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

import MateriManager, {
  type CourseOption,
} from "./materi-manager";

type PageProps = {
  searchParams?: Promise<{
    course?: string | string[];
  }>;
};

export default async function AdminMateriPage({
  searchParams,
}: PageProps) {
  // Memastikan halaman menggunakan rendering dinamis.
  await connection();

  const supabase = await createClient();

  // Mengambil daftar kelas dari Supabase.
  const {
    data: courses,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select(
      "id, title, slug, status, cover_image_url, price"
    )
    .order("created_at", {
      ascending: false,
    });

  // Membaca parameter URL.
  const params = (await searchParams) ?? {};

  const requestedCourse = Array.isArray(params.course)
    ? params.course[0] ?? null
    : params.course ?? null;

  // Memastikan kelas yang dipilih tersedia.
  const validCourseId: string | null =
    requestedCourse &&
    (courses ?? []).some(
      (course) => course.id === requestedCourse
    )
      ? requestedCourse
      : null;

  return (
    <MateriManager
      courses={(courses ?? []) as CourseOption[]}
      initialCourseId={validCourseId}
      initialError={coursesError?.message ?? null}
    />
  );
}
