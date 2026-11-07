import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";
import LearningRoom, {
  type LearningCourse,
  type LearningSection,
  type LearningLesson,
  type LearningContent,
  type LearningTask,
  type LearningTaskSubmission,
} from "./learning-room";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const sectionFields =
  "id, course_id, title, description, position, created_at";

const lessonFields =
  "id, section_id, title, content, video_provider, video_url, resource_path, duration_minutes, is_preview, status, position, created_at, updated_at";

const lessonContentFields =
  "id, lesson_id, title, content_type, body, media_url, resource_path, link_url, link_label, settings, position, status, created_at, updated_at";

const taskFields =
  "id, course_id, section_id, anchor_lesson_id, placement, position, title, description, instructions, submission_type, reference_url, due_at, max_score, is_required, allow_late_submission, status, created_at, updated_at";

const taskSubmissionFields =
  "id, task_id, user_id, answer_text, answer_url, file_path, attempt_count, status, score, mentor_feedback, reviewed_by, reviewed_at, submitted_at, created_at, updated_at";

export default async function BelajarKelasPage({
  params,
}: PageProps) {
  await connection();

  const { slug } = await params;
  const supabase = await createClient();

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      `/login?redirect=${encodeURIComponent(
        `/kelas/${slug}/belajar`
      )}`
    );
  }

  // Ruang belajar peserta hanya untuk akun dengan role member utama.
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(`Gagal memeriksa hak akses ruang belajar: ${roleError.message}`);
  }

  const primaryRole = getPrimaryRole(normalizeRoles(roleRows));
  if (primaryRole === "admin") redirect("/admin");
  if (primaryRole === "instructor") redirect("/mentor");
  if (primaryRole !== "member") redirect("/login?reason=role-unassigned");

  // ==========================================
  // PROFILE
  // ==========================================

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const profileName =
    profile?.full_name ?? user.email ?? "Member";

  // ==========================================
  // COURSE
  // ==========================================

  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      short_description,
      description,
      cover_image_url,
      mentor_name,
      benefits,
      target_audience,
      status
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    return (
      <LearningRoom
        course={null}
        sections={[]}
        lessons={[]}
        contents={[]}
        tasks={[]}
        submissions={[]}
        userId={user.id}
        profileName={profileName}
        grantedAt={null}
        loadError={courseError.message}
        taskLoadError={null}
        submissionLoadError={null}
      />
    );
  }

  if (!course) {
    notFound();
  }

  const learningCourse = course as LearningCourse;

  // ==========================================
  // ENROLLMENT ACCESS
  // ==========================================

  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("id, status, granted_at")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .eq("status", "active")
    .maybeSingle();

  if (enrollmentError) {
    return (
      <LearningRoom
        course={learningCourse}
        sections={[]}
        lessons={[]}
        contents={[]}
        tasks={[]}
        submissions={[]}
        userId={user.id}
        profileName={profileName}
        grantedAt={null}
        loadError={enrollmentError.message}
        taskLoadError={null}
        submissionLoadError={null}
      />
    );
  }

  if (!enrollment) {
    redirect("/dashboard#pembelian");
  }

  // ==========================================
  // LOAD BAB / COURSE SECTIONS
  // ==========================================

  const {
    data: sectionData,
    error: sectionError,
  } = await supabase
    .from("course_sections")
    .select(sectionFields)
    .eq("course_id", course.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (sectionError) {
    return (
      <LearningRoom
        course={learningCourse}
        sections={[]}
        lessons={[]}
        contents={[]}
        tasks={[]}
        submissions={[]}
        userId={user.id}
        profileName={profileName}
        grantedAt={enrollment.granted_at ?? null}
        loadError={sectionError.message}
        taskLoadError={null}
        submissionLoadError={null}
      />
    );
  }

  const sections = (sectionData ?? []) as LearningSection[];

  // ==========================================
  // LOAD MATERI INTI / LESSONS
  // ==========================================

  let lessons: LearningLesson[] = [];

  if (sections.length > 0) {
    const sectionIds = sections.map(
      (section) => section.id
    );

    const {
      data: lessonData,
      error: lessonError,
    } = await supabase
      .from("lessons")
      .select(lessonFields)
      .in("section_id", sectionIds)
      .eq("status", "published")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (lessonError) {
      return (
        <LearningRoom
          course={learningCourse}
          sections={sections}
          lessons={[]}
          contents={[]}
          tasks={[]}
          submissions={[]}
          userId={user.id}
          profileName={profileName}
          grantedAt={enrollment.granted_at ?? null}
          loadError={lessonError.message}
          taskLoadError={null}
          submissionLoadError={null}
        />
      );
    }

    lessons = (lessonData ?? []) as LearningLesson[];
  }

  // ==========================================
  // LOAD MINI MATERI / LESSON CONTENTS
  // ==========================================

  let contents: LearningContent[] = [];

  if (lessons.length > 0) {
    const lessonIds = lessons.map(
      (lesson) => lesson.id
    );

    const {
      data: contentData,
      error: contentError,
    } = await supabase
      .from("lesson_contents")
      .select(lessonContentFields)
      .in("lesson_id", lessonIds)
      .eq("status", "published")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (contentError) {
      return (
        <LearningRoom
          course={learningCourse}
          sections={sections}
          lessons={lessons}
          contents={[]}
          tasks={[]}
          submissions={[]}
          userId={user.id}
          profileName={profileName}
          grantedAt={enrollment.granted_at ?? null}
          loadError={contentError.message}
          taskLoadError={null}
          submissionLoadError={null}
        />
      );
    }

    contents = (contentData ?? []) as LearningContent[];
  }

  // ==========================================
  // LOAD PUBLISHED TASKS
  // ==========================================

  const taskDb = supabase as any;

  const {
    data: taskData,
    error: taskError,
  } = await taskDb
    .from("course_tasks")
    .select(taskFields)
    .eq("course_id", course.id)
    .eq("status", "published")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (taskError) {
    return (
      <LearningRoom
        course={learningCourse}
        sections={sections}
        lessons={lessons}
        contents={contents}
        tasks={[]}
        submissions={[]}
        userId={user.id}
        profileName={profileName}
        grantedAt={enrollment.granted_at ?? null}
        loadError={null}
        taskLoadError={taskError.message}
        submissionLoadError={null}
      />
    );
  }

  const tasks = (taskData ?? []) as LearningTask[];

  // ==========================================
  // LOAD CURRENT PARTICIPANT SUBMISSIONS
  // ==========================================

  let submissions: LearningTaskSubmission[] = [];
  let taskLoadError: string | null = null;
  let submissionLoadError: string | null = null;

  if (tasks.length > 0) {
    const taskIds = tasks.map((task) => task.id);

    const {
      data: submissionData,
      error: submissionError,
    } = await taskDb
      .from("course_task_submissions")
      .select(taskSubmissionFields)
      .eq("user_id", user.id)
      .in("task_id", taskIds)
      .order("submitted_at", { ascending: false });

    if (submissionError) {
      submissionLoadError = submissionError.message;
    } else {
      submissions =
        (submissionData ?? []) as LearningTaskSubmission[];
    }
  }

  // ==========================================
  // LOAD COMPLETED LESSON PROGRESS
  // ==========================================

  let completedLessonIds: string[] = [];
  if (lessons.length > 0) {
    const progressDb = supabase as any;
    const { data: progressData } = await progressDb
      .from("course_lesson_progress")
      .select("lesson_id")
      .eq("course_id", course.id)
      .eq("user_id", user.id);
    completedLessonIds = (progressData ?? []).map((row: { lesson_id: string }) => row.lesson_id);
  }

  // ==========================================
  // RENDER LEARNING ROOM
  // ==========================================

  return (
    <LearningRoom
      course={learningCourse}
      sections={sections}
      lessons={lessons}
      contents={contents}
      tasks={tasks}
      submissions={submissions}
      completedLessonIds={completedLessonIds}
      userId={user.id}
      profileName={profileName}
      grantedAt={enrollment.granted_at ?? null}
      loadError={null}
      taskLoadError={taskLoadError}
      submissionLoadError={submissionLoadError}
    />
  );
}
