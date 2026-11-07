import { connection } from "next/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import MentorTaskReview, {
  type MentorReviewItem,
} from "./mentor-task-review";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
};

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

type StudentProfileRow = {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default async function MentorTaskReviewPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      `/login?redirect=${encodeURIComponent("/mentor/tugas")}`
    );
  }

  const [{ data: ownProfile }, assignmentResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("course_task_mentors")
      .select("course_id")
      .eq("mentor_user_id", user.id),
  ]);

  const mentorName =
    ownProfile?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Mentor";

  if (assignmentResult.error) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments={false}
        initialError={assignmentResult.error.message}
      />
    );
  }

  const courseIds = Array.from(
    new Set((assignmentResult.data ?? []).map((row) => row.course_id))
  );

  if (courseIds.length === 0) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments={false}
        initialError={null}
      />
    );
  }

  const certificateDb = supabase as any;
  const [courseResult, taskResult, certificateSettingsResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds),
    supabase
      .from("course_tasks")
      .select(
        "id, course_id, title, description, instructions, submission_type, reference_url, due_at, max_score, status"
      )
      .in("course_id", courseIds)
      .order("created_at", { ascending: false }),
    certificateDb
      .from("course_certificate_settings")
      .select("course_id, enabled, passing_score, final_task_id")
      .in("course_id", courseIds),
  ]);

  const loadErrors = [
    courseResult.error?.message,
    taskResult.error?.message,
  ].filter(Boolean);

  if (loadErrors.length > 0) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments
        initialError={loadErrors.join(" | ")}
      />
    );
  }

  const courses = (courseResult.data ?? []) as CourseRow[];
  const tasks = (taskResult.data ?? []) as TaskRow[];
  const certificateSettingsByCourse = new Map<string, { enabled: boolean; passing_score: number | string; final_task_id: string | null }>(
    (certificateSettingsResult.data ?? []).map((row: { course_id: string; enabled: boolean; passing_score: number | string; final_task_id: string | null }) => [row.course_id, row])
  );
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length === 0) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments
        initialError={null}
      />
    );
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from("course_task_submissions")
    .select(
      "id, task_id, user_id, answer_text, answer_url, file_path, attempt_count, status, score, mentor_feedback, reviewed_by, reviewed_at, submitted_at, created_at, updated_at"
    )
    .in("task_id", taskIds)
    .order("submitted_at", { ascending: false });

  if (submissionError) {
    return (
      <MentorTaskReview
        mentorName={mentorName}
        items={[]}
        hasAssignments
        initialError={submissionError.message}
      />
    );
  }

  const submissions = (submissionData ?? []) as SubmissionRow[];
  const userIds = Array.from(
    new Set(submissions.map((submission) => submission.user_id))
  );

  let studentProfiles: StudentProfileRow[] = [];

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase.rpc(
      "get_mentor_task_student_profiles",
      { p_user_ids: userIds }
    );

    if (profileError) {
      return (
        <MentorTaskReview
          mentorName={mentorName}
          items={[]}
          hasAssignments
          initialError={
            `Gagal mengambil nama peserta: ${profileError.message}. ` +
            "Pastikan SQL mentor-review-access.sql sudah dijalankan."
          }
        />
      );
    }

    studentProfiles = (profileData ?? []) as StudentProfileRow[];
  }

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const profileById = new Map(
    studentProfiles.map((profile) => [profile.profile_id, profile])
  );

  const items: MentorReviewItem[] = submissions.flatMap((submission) => {
    const task = taskById.get(submission.task_id);
    if (!task) return [];

    const course = courseById.get(task.course_id);
    const student = profileById.get(submission.user_id);

    return [
      {
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
        certificate_enabled: certificateSettingsByCourse.get(task.course_id)?.enabled ?? false,
        passing_score: certificateSettingsByCourse.get(task.course_id)?.enabled
          ? Number(certificateSettingsByCourse.get(task.course_id)?.passing_score ?? 75)
          : null,
        is_final_task: certificateSettingsByCourse.get(task.course_id)?.final_task_id === task.id,
      },
    ];
  });

  return (
    <MentorTaskReview
      mentorName={mentorName}
      items={items}
      hasAssignments
      initialError={null}
    />
  );
}
