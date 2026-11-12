import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, normalizeRoles } from "@/lib/auth/roles";
import MentorTaskReview, { type MentorReviewItem } from "@/app/mentor/tugas/mentor-task-review";

type CourseRow = { id: string; title: string; slug: string };
type TaskRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string;
  submission_type: string;
  reference_url: string | null;
  due_at: string | null;
  max_score: number;
  status: string;
};
type SubmissionRow = {
  id: string;
  task_id: string;
  user_id: string;
  answer_text: string | null;
  answer_url: string | null;
  file_path: string | null;
  attempt_count: number;
  status: "submitted" | "revision_requested" | "reviewed";
  score: number | null;
  mentor_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};
type SettingRow = {
  course_id: string;
  enabled: boolean;
  passing_score: number | string;
  final_task_id: string | null;
};
type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};
type AdminTaskReviewPayload = {
  courses?: CourseRow[];
  tasks?: TaskRow[];
  settings?: SettingRow[];
  submissions?: SubmissionRow[];
  profiles?: ProfileRow[];
};

export default async function AdminTaskReviewPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?redirect=%2Fadmin%2Fpemeriksaan-tugas");
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError || !hasRole(normalizeRoles(roleRows), "admin")) {
    redirect("/admin");
  }

  // Ambil data melalui SECURITY DEFINER RPC yang memverifikasi role Admin.
  // Dengan demikian halaman ini tidak bergantung pada service-role key lokal.
  const { data, error: loadError } = await (supabase as any).rpc(
    "admin_get_task_review_data"
  );

  const mentorName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "Administrator";

  if (loadError) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments
        initialError={`Gagal memuat data pemeriksaan Admin: ${loadError.message}. Pastikan SQL perbaikan lanjutan sudah dijalankan di Supabase.`}
        workspaceLabel="Admin"
        reviewRpcName="admin_review_course_task_submission"
        accessDescription="Admin dapat memeriksa pengumpulan dari seluruh kelas."
      />
    );
  }

  const payload = (data ?? {}) as AdminTaskReviewPayload;
  const courses = Array.isArray(payload.courses) ? payload.courses : [];
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const settings = Array.isArray(payload.settings) ? payload.settings : [];
  const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const settingsByCourse = new Map(settings.map((setting) => [setting.course_id, setting]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const items: MentorReviewItem[] = submissions.flatMap((submission) => {
    const task = taskById.get(submission.task_id);
    if (!task) return [];

    const course = courseById.get(task.course_id);
    const student = profileById.get(submission.user_id);
    const setting = settingsByCourse.get(task.course_id);

    return [{
      ...submission,
      task_title: task.title,
      task_description: task.description,
      task_instructions: task.instructions,
      submission_type: task.submission_type,
      reference_url: task.reference_url,
      due_at: task.due_at,
      max_score: Number(task.max_score),
      course_id: task.course_id,
      course_title: course?.title ?? "Kelas tanpa nama",
      course_slug: course?.slug ?? "",
      student_name: student?.full_name?.trim() || "Peserta",
      student_avatar_url: student?.avatar_url ?? null,
      certificate_enabled: setting?.enabled ?? false,
      passing_score: setting?.enabled ? Number(setting.passing_score ?? 75) : null,
      is_final_task: setting?.final_task_id === task.id,
    }];
  });

  return (
    <MentorTaskReview
      mentorName={mentorName}
      items={items}
      hasAssignments
      initialError={null}
      workspaceLabel="Admin"
      reviewRpcName="admin_review_course_task_submission"
      accessDescription="Admin dapat memeriksa pengumpulan dari seluruh kelas."
    />
  );
}
