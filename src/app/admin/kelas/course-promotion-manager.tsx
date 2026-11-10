"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  AppWindow,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquareQuote,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";

export type CourseSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  mentor_name: string | null;
  mentor_bio: string | null;
  price: number | string | null;
};

export type CaseStudyImage = {
  url: string;
  path: string;
  alt?: string | null;
};

export type UsedApp = {
  name: string;
  url: string;
  path: string;
  alt?: string | null;
};

export type PromotionSettings = {
  course_id: string;
  mentor_display_name: string | null;
  mentor_headline: string | null;
  mentor_bio: string | null;
  mentor_expertise: string[] | null;
  mentor_photo_url: string | null;
  original_price: number | string | null;
  case_study_images: CaseStudyImage[] | null;
  used_apps: UsedApp[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualReview = {
  id: string;
  course_id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  is_published: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FallbackMentor = {
  full_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  expertise?: string[] | null;
  photo_url?: string | null;
} | null;

type Props = {
  course: CourseSummary;
  userId: string;
  initialSettings: PromotionSettings | null;
  initialReviews: ManualReview[];
  fallbackMentor: FallbackMentor;
  initialError: string | null;
};

type MentorForm = {
  displayName: string;
  headline: string;
  bio: string;
  expertise: string;
  photoUrl: string;
};

type PendingCaseStudy = {
  file: File;
  previewUrl: string;
  key: string;
};

type PendingUsedApp = {
  name: string;
  file: File;
  previewUrl: string;
  key: string;
};

type ReviewForm = {
  reviewerName: string;
  rating: number;
  reviewText: string;
  isPublished: boolean;
};

const PHOTO_BUCKET = "course-covers";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_CASE_STUDIES = 12;
const MAX_USED_APPS = 8;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const emptyReviewForm: ReviewForm = {
  reviewerName: "",
  rating: 5,
  reviewText: "",
  isPublished: true,
};

function stars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => index < rating);
}

export default function CoursePromotionManager({
  course,
  userId,
  initialSettings,
  initialReviews,
  fallbackMentor,
  initialError,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const confirmDialog = useConfirmDialog();

  const [settings, setSettings] = useState(initialSettings);
  const [reviews, setReviews] = useState(initialReviews);
  const [caseStudyImages, setCaseStudyImages] = useState<CaseStudyImage[]>(
    initialSettings?.case_study_images ?? [],
  );
  const [usedApps, setUsedApps] = useState<UsedApp[]>(initialSettings?.used_apps ?? []);
  const [pendingUsedApps, setPendingUsedApps] = useState<PendingUsedApp[]>([]);
  const pendingUsedAppsRef = useRef<PendingUsedApp[]>([]);
  const [removedUsedAppPaths, setRemovedUsedAppPaths] = useState<string[]>([]);
  const [newAppName, setNewAppName] = useState("");
  const [newAppFile, setNewAppFile] = useState<File | null>(null);
  const [newAppPreview, setNewAppPreview] = useState<string | null>(null);
  const [pendingCaseStudies, setPendingCaseStudies] = useState<PendingCaseStudy[]>([]);
  const pendingCaseStudiesRef = useRef<PendingCaseStudy[]>([]);
  const [removedCaseStudyPaths, setRemovedCaseStudyPaths] = useState<string[]>([]);
  const [savingCaseStudies, setSavingCaseStudies] = useState(false);
  const [caseStudyError, setCaseStudyError] = useState("");
  const [caseStudySuccess, setCaseStudySuccess] = useState("");
  const [mentorForm, setMentorForm] = useState<MentorForm>(() => ({
    displayName: initialSettings
      ? initialSettings.mentor_display_name ?? ""
      : fallbackMentor?.full_name ?? course.mentor_name ?? "",
    headline: initialSettings
      ? initialSettings.mentor_headline ?? ""
      : fallbackMentor?.headline ?? "",
    bio: initialSettings
      ? initialSettings.mentor_bio ?? ""
      : fallbackMentor?.bio ?? course.mentor_bio ?? "",
    expertise: (
      initialSettings
        ? initialSettings.mentor_expertise ?? []
        : fallbackMentor?.expertise ?? []
    ).join("\n"),
    photoUrl: initialSettings
      ? initialSettings.mentor_photo_url ?? ""
      : fallbackMentor?.photo_url ?? "",
  }));

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingMentor, setSavingMentor] = useState(false);
  const [mentorError, setMentorError] = useState("");
  const [mentorSuccess, setMentorSuccess] = useState("");

  const [reviewForm, setReviewForm] = useState<ReviewForm>(emptyReviewForm);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  useEffect(() => {
    if (!photoPreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  useEffect(() => {
    return () => {
      pendingCaseStudiesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
      pendingUsedAppsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!newAppPreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(newAppPreview);
  }, [newAppPreview]);

  function updateMentorForm<K extends keyof MentorForm>(
    field: K,
    value: MentorForm[K],
  ) {
    setMentorForm((current) => ({ ...current, [field]: value }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setMentorError("Foto mentor harus berformat JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setMentorError("Ukuran foto mentor maksimal 5 MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setMentorError("");
    setMentorSuccess("");
  }

  async function saveMentorPresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingMentor(true);
    setMentorError("");
    setMentorSuccess("");

    let uploadedPath: string | null = null;

    try {
      let photoUrl = mentorForm.photoUrl.trim() || null;

      if (photoFile) {
        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = extensionByType[photoFile.type];
        const path = `courses/${userId}/mentor-${course.id}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, photoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: photoFile.type,
          });

        if (uploadError) {
          throw new Error(`Foto mentor gagal diunggah: ${uploadError.message}`);
        }

        uploadedPath = path;
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      const payload = {
        course_id: course.id,
        mentor_display_name: mentorForm.displayName.trim() || null,
        mentor_headline: mentorForm.headline.trim() || null,
        mentor_bio: mentorForm.bio.trim() || null,
        mentor_expertise: mentorForm.expertise
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 12),
        mentor_photo_url: photoUrl,
        updated_by: userId,
      };

      const selectedFields =
        "course_id, mentor_display_name, mentor_headline, mentor_bio, mentor_expertise, mentor_photo_url, original_price, case_study_images, used_apps, created_by, updated_by, created_at, updated_at";
      let savedSettings: PromotionSettings;

      if (settings) {
        const { data, error } = await supabase
          .from("course_promotion_settings")
          .update(payload)
          .eq("course_id", course.id)
          .select(selectedFields)
          .single();
        if (error) throw error;
        savedSettings = data as PromotionSettings;
      } else {
        const { data, error } = await supabase
          .from("course_promotion_settings")
          .insert({ ...payload, created_by: userId })
          .select(selectedFields)
          .single();
        if (error) throw error;
        savedSettings = data as PromotionSettings;
      }

      setSettings(savedSettings);
      setMentorForm((current) => ({ ...current, photoUrl: photoUrl ?? "" }));
      setPhotoFile(null);
      setPhotoPreview(null);
      setMentorSuccess("Informasi mentor untuk halaman promosi berhasil disimpan.");
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .remove([uploadedPath]);
        if (cleanupError) {
          console.error("Gagal membersihkan foto mentor yang belum tersimpan:", cleanupError);
        }
      }
      setMentorError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan informasi mentor.",
      );
    } finally {
      setSavingMentor(false);
    }
  }

  function handleNewAppFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setCaseStudyError("Logo aplikasi harus berformat JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setCaseStudyError("Ukuran logo aplikasi maksimal 5 MB.");
      return;
    }
    setNewAppFile(file);
    setNewAppPreview(URL.createObjectURL(file));
    setCaseStudyError("");
    setCaseStudySuccess("");
  }

  function addUsedApp() {
    const name = newAppName.trim();
    if (!name) {
      setCaseStudyError("Nama aplikasi wajib diisi.");
      return;
    }
    if (!newAppFile || !newAppPreview) {
      setCaseStudyError("Pilih gambar atau logo aplikasi terlebih dahulu.");
      return;
    }
    if (usedApps.length + pendingUsedApps.length >= MAX_USED_APPS) {
      setCaseStudyError(`Maksimal ${MAX_USED_APPS} aplikasi untuk satu kelas.`);
      return;
    }

    const item: PendingUsedApp = {
      name,
      file: newAppFile,
      previewUrl: URL.createObjectURL(newAppFile),
      key: `${name}-${newAppFile.name}-${newAppFile.lastModified}-${Math.random().toString(36).slice(2)}`,
    };
    setPendingUsedApps((current) => {
      const next = [...current, item];
      pendingUsedAppsRef.current = next;
      return next;
    });
    setNewAppName("");
    setNewAppFile(null);
    setNewAppPreview(null);
    setCaseStudyError("");
    setCaseStudySuccess("");
  }

  function removePendingUsedApp(key: string) {
    setPendingUsedApps((current) => {
      const removed = current.find((item) => item.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = current.filter((item) => item.key !== key);
      pendingUsedAppsRef.current = next;
      return next;
    });
  }

  function removeSavedUsedApp(app: UsedApp) {
    setUsedApps((current) => current.filter((item) => item.path !== app.path));
    setRemovedUsedAppPaths((current) =>
      current.includes(app.path) ? current : [...current, app.path],
    );
    setCaseStudyError("");
    setCaseStudySuccess("");
  }

  function handleCaseStudyFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remaining = MAX_CASE_STUDIES - caseStudyImages.length - pendingCaseStudies.length;
    if (remaining <= 0) {
      setCaseStudyError(`Maksimal ${MAX_CASE_STUDIES} gambar contoh studi kasus per kelas.`);
      return;
    }

    const accepted: PendingCaseStudy[] = [];
    const errors: string[] = [];

    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        errors.push(`${file.name}: gunakan JPG, PNG, atau WebP.`);
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        errors.push(`${file.name}: ukuran maksimal 5 MB.`);
        continue;
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      });
    }

    if (files.length > remaining) {
      errors.push(`Hanya ${remaining} gambar tambahan yang dapat dipilih.`);
    }

    if (accepted.length > 0) {
      setPendingCaseStudies((current) => {
        const next = [...current, ...accepted];
        pendingCaseStudiesRef.current = next;
        return next;
      });
    }

    setCaseStudyError(errors.join(" "));
    setCaseStudySuccess("");
  }

  function removePendingCaseStudy(key: string) {
    setPendingCaseStudies((current) => {
      const removed = current.find((item) => item.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = current.filter((item) => item.key !== key);
      pendingCaseStudiesRef.current = next;
      return next;
    });
  }

  function removeSavedCaseStudy(image: CaseStudyImage) {
    setCaseStudyImages((current) => current.filter((item) => item.path !== image.path));
    setRemovedCaseStudyPaths((current) =>
      current.includes(image.path) ? current : [...current, image.path],
    );
    setCaseStudyError("");
    setCaseStudySuccess("");
  }

  async function saveCaseStudySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCaseStudies(true);
    setCaseStudyError("");
    setCaseStudySuccess("");

    if (caseStudyImages.length + pendingCaseStudies.length > MAX_CASE_STUDIES) {
      setCaseStudyError(`Maksimal ${MAX_CASE_STUDIES} gambar contoh studi kasus per kelas.`);
      setSavingCaseStudies(false);
      return;
    }

    if (usedApps.length + pendingUsedApps.length > MAX_USED_APPS) {
      setCaseStudyError(`Maksimal ${MAX_USED_APPS} aplikasi untuk satu kelas.`);
      setSavingCaseStudies(false);
      return;
    }

    const uploadedPaths: string[] = [];

    try {
      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const uploadedImages: CaseStudyImage[] = [];
      for (let index = 0; index < pendingCaseStudies.length; index += 1) {
        const item = pendingCaseStudies[index];
        const extension = extensionByType[item.file.type];
        const path = `courses/${userId}/case-studies/${course.id}-${Date.now()}-${index}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, item.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: item.file.type,
          });
        if (uploadError) {
          throw new Error(`Gambar ${item.file.name} gagal diunggah: ${uploadError.message}`);
        }
        uploadedPaths.push(path);
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        uploadedImages.push({
          url: data.publicUrl,
          path,
          alt: item.file.name.replace(/\.[^.]+$/, ""),
        });
      }

      const uploadedApps: UsedApp[] = [];
      for (let index = 0; index < pendingUsedApps.length; index += 1) {
        const item = pendingUsedApps[index];
        const extension = extensionByType[item.file.type];
        const path = `courses/${userId}/used-apps/${course.id}-${Date.now()}-${index}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, item.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: item.file.type,
          });
        if (uploadError) {
          throw new Error(`Logo ${item.name} gagal diunggah: ${uploadError.message}`);
        }
        uploadedPaths.push(path);
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        uploadedApps.push({ name: item.name, url: data.publicUrl, path, alt: item.name });
      }

      const nextImages = [...caseStudyImages, ...uploadedImages];
      const nextApps = [...usedApps, ...uploadedApps];
      const payload = {
        course_id: course.id,
        case_study_images: nextImages,
        used_apps: nextApps,
        updated_by: userId,
      };
      const selectedFields =
        "course_id, mentor_display_name, mentor_headline, mentor_bio, mentor_expertise, mentor_photo_url, original_price, case_study_images, used_apps, created_by, updated_by, created_at, updated_at";

      let savedSettings: PromotionSettings;
      if (settings) {
        const { data, error } = await supabase
          .from("course_promotion_settings")
          .update(payload)
          .eq("course_id", course.id)
          .select(selectedFields)
          .single();
        if (error) throw error;
        savedSettings = data as PromotionSettings;
      } else {
        const { data, error } = await supabase
          .from("course_promotion_settings")
          .insert({ ...payload, created_by: userId })
          .select(selectedFields)
          .single();
        if (error) throw error;
        savedSettings = data as PromotionSettings;
      }

      setSettings(savedSettings);
      setCaseStudyImages(nextImages);
      setUsedApps(nextApps);

      pendingCaseStudiesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      pendingCaseStudiesRef.current = [];
      setPendingCaseStudies([]);
      pendingUsedAppsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      pendingUsedAppsRef.current = [];
      setPendingUsedApps([]);

      const pathsToRemove = [...removedCaseStudyPaths, ...removedUsedAppPaths];
      if (pathsToRemove.length > 0) {
        const { error: removeError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .remove(pathsToRemove);
        if (removeError) {
          console.warn("Data promosi tersimpan, tetapi sebagian file lama belum terhapus:", removeError);
        }
      }
      setRemovedCaseStudyPaths([]);
      setRemovedUsedAppPaths([]);
      setCaseStudySuccess("Aplikasi dan contoh studi kasus berhasil disimpan.");
      router.refresh();
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Gagal membersihkan file promosi yang belum tersimpan:", cleanupError);
        }
      }
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message ?? "Gagal menyimpan aplikasi dan contoh studi kasus.";
      setCaseStudyError(message);
    } finally {
      setSavingCaseStudies(false);
    }
  }

  function startAddReview() {
    setEditingReviewId(null);
    setReviewForm(emptyReviewForm);
    setReviewFormOpen(true);
    setReviewError("");
    setReviewSuccess("");
  }

  function startEditReview(review: ManualReview) {
    setEditingReviewId(review.id);
    setReviewForm({
      reviewerName: review.reviewer_name,
      rating: review.rating,
      reviewText: review.review_text,
      isPublished: review.is_published,
    });
    setReviewFormOpen(true);
    setReviewError("");
    setReviewSuccess("");
  }

  function closeReviewForm() {
    if (savingReview) return;
    setReviewFormOpen(false);
    setEditingReviewId(null);
    setReviewForm(emptyReviewForm);
    setReviewError("");
  }

  async function saveManualReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingReview(true);
    setReviewError("");
    setReviewSuccess("");

    const reviewerName = reviewForm.reviewerName.trim();
    const reviewText = reviewForm.reviewText.trim();

    if (reviewerName.length < 2) {
      setReviewError("Nama pemberi ulasan minimal 2 karakter.");
      setSavingReview(false);
      return;
    }
    if (reviewText.length < 10) {
      setReviewError("Isi ulasan minimal 10 karakter.");
      setSavingReview(false);
      return;
    }

    try {
      const payload = {
        course_id: course.id,
        reviewer_name: reviewerName,
        rating: reviewForm.rating,
        review_text: reviewText,
        is_published: reviewForm.isPublished,
        updated_by: userId,
      };

      if (editingReviewId) {
        const { data, error } = await supabase
          .from("course_manual_reviews")
          .update(payload)
          .eq("id", editingReviewId)
          .eq("course_id", course.id)
          .select(
            "id, course_id, reviewer_name, rating, review_text, is_published, created_by, updated_by, created_at, updated_at",
          )
          .single();
        if (error) throw error;

        setReviews((current) =>
          current.map((item) =>
            item.id === editingReviewId ? (data as ManualReview) : item,
          ),
        );
        setReviewSuccess("Ulasan manual berhasil diperbarui.");
      } else {
        const { data, error } = await supabase
          .from("course_manual_reviews")
          .insert({ ...payload, created_by: userId })
          .select(
            "id, course_id, reviewer_name, rating, review_text, is_published, created_by, updated_by, created_at, updated_at",
          )
          .single();
        if (error) throw error;

        setReviews((current) => [data as ManualReview, ...current]);
        setReviewSuccess("Ulasan manual berhasil ditambahkan.");
      }

      setReviewFormOpen(false);
      setEditingReviewId(null);
      setReviewForm(emptyReviewForm);
      router.refresh();
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Gagal menyimpan ulasan manual.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  async function deleteManualReview(review: ManualReview) {
    const confirmed = await confirmDialog({
      title: "Hapus ulasan manual?",
      message: `Ulasan dari ${review.reviewer_name} akan dihapus dan tidak lagi dihitung dalam rating kelas. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: "Hapus ulasan",
      variant: "danger",
    });
    if (!confirmed) return;

    setDeletingReviewId(review.id);
    setReviewError("");
    setReviewSuccess("");
    try {
      const { error } = await supabase
        .from("course_manual_reviews")
        .delete()
        .eq("id", review.id)
        .eq("course_id", course.id);
      if (error) throw error;

      setReviews((current) => current.filter((item) => item.id !== review.id));
      setReviewSuccess("Ulasan manual berhasil dihapus.");
      router.refresh();
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Gagal menghapus ulasan manual.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function toggleReviewVisibility(review: ManualReview) {
    setReviewError("");
    setReviewSuccess("");
    try {
      const { data, error } = await supabase
        .from("course_manual_reviews")
        .update({ is_published: !review.is_published, updated_by: userId })
        .eq("id", review.id)
        .eq("course_id", course.id)
        .select(
          "id, course_id, reviewer_name, rating, review_text, is_published, created_by, updated_by, created_at, updated_at",
        )
        .single();
      if (error) throw error;

      setReviews((current) =>
        current.map((item) => (item.id === review.id ? (data as ManualReview) : item)),
      );
      setReviewSuccess(
        data.is_published ? "Ulasan ditampilkan di halaman kelas." : "Ulasan disembunyikan dari halaman kelas.",
      );
      router.refresh();
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Gagal mengubah status ulasan.",
      );
    }
  }

  const visibleManualCount = reviews.filter((item) => item.is_published).length;
  const photoSrc = photoPreview ?? mentorForm.photoUrl;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/kelas"
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#746D7B] transition hover:text-[#260047]"
          >
            <ArrowLeft size={15} />
            Kembali ke Manajemen Kelas
          </Link>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#74627E]">
            PENGELOLAAN HALAMAN PUBLIK
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#21182A] sm:text-3xl">
            Tampilan Promosi Kelas
          </h1>
          <p className="mt-1 text-sm text-[#84798C]">{course.title}</p>
        </div>
        {course.status === "published" ? (
          <Link
            href={`/kelas/${course.slug}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#EAE5ED] bg-white px-4 text-xs font-bold text-[#51465D] transition hover:border-[#CFC1D8] hover:text-[#260047]"
          >
            <Eye size={15} />
            Lihat Halaman Kelas
          </Link>
        ) : (
          <span className="inline-flex h-10 items-center rounded-xl bg-slate-100 px-4 text-[10px] font-bold text-slate-500">
            Kelas belum dipublikasikan
          </span>
        )}
      </div>

      {initialError && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
          {initialError}
          <p className="mt-1 font-semibold">Pastikan migration promosi, harga/studi kasus, dan aplikasi yang digunakan sudah diterapkan sebelum menyimpan.</p>
        </div>
      )}

      <section className="overflow-hidden rounded-[24px] border border-[#EAE5ED] bg-white shadow-[0_8px_24px_rgba(38,0,71,.04)]">
        <div className="border-b border-[#F0ECF2] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]">
              <UserRound size={19} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#21182A]">Informasi Mentor</h2>
              <p className="mt-0.5 text-[11px] text-[#948B9B]">Atur foto dan keterangan mentor yang tampil khusus pada kelas ini.</p>
            </div>
          </div>
        </div>

        <form onSubmit={saveMentorPresentation} className="p-5 sm:p-7">
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">Foto mentor</label>
              <div className="overflow-hidden rounded-2xl border border-dashed border-[#D8CDDF] bg-[#FCFBFD] p-3">
                {photoSrc ? (
                  <img src={photoSrc} alt="Preview foto mentor" className="aspect-[4/4.5] w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex aspect-[4/4.5] flex-col items-center justify-center rounded-xl bg-[#F3EFF6] text-[#806C8C]">
                    <UserRound size={38} />
                    <span className="mt-2 text-[10px] font-semibold">Belum ada foto</span>
                  </div>
                )}
                <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F0EBF3] px-3 text-[11px] font-extrabold text-[#260047] transition hover:bg-[#E8DFED]">
                  <ImagePlus size={15} />
                  {photoSrc ? "Ganti Foto" : "Unggah Foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                </label>
                {photoSrc && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      updateMentorForm("photoUrl", "");
                    }}
                    className="mt-2 w-full text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Hapus foto
                  </button>
                )}
                <p className="mt-2 text-center text-[9px] leading-4 text-[#A49BAA]">JPG, PNG, WebP · Maks. 5 MB</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Nama mentor
                <input
                  maxLength={120}
                  value={mentorForm.displayName}
                  onChange={(event) => updateMentorForm("displayName", event.target.value)}
                  placeholder="Nama yang ditampilkan"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Profesi / keahlian utama
                <input
                  maxLength={160}
                  value={mentorForm.headline}
                  onChange={(event) => updateMentorForm("headline", event.target.value)}
                  placeholder="Contoh: Graphic Designer & Canva Instructor"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Deskripsi singkat mentor
                <textarea
                  rows={4}
                  maxLength={700}
                  value={mentorForm.bio}
                  onChange={(event) => updateMentorForm("bio", event.target.value)}
                  placeholder="Tuliskan pengalaman dan cara mentor membimbing peserta..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Keahlian khusus (satu keahlian per baris)
                <textarea
                  rows={3}
                  maxLength={500}
                  value={mentorForm.expertise}
                  onChange={(event) => updateMentorForm("expertise", event.target.value)}
                  placeholder={"Canva\nDesain Konten\nBranding"}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[#F8F6F9] px-4 py-3 text-[10px] leading-5 text-[#746D7B]">
            Pengaturan ini hanya mengubah tampilan promosi mentor pada kelas <strong>{course.title}</strong>. Profil akun mentor dan penugasan mentor tidak diubah.
          </div>

          {mentorError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{mentorError}</p>}
          {mentorSuccess && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/>{mentorSuccess}</p>}

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={savingMentor || savingCaseStudies} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:opacity-60">
              {savingMentor ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>}
              {savingMentor ? "Menyimpan..." : "Simpan Informasi Mentor"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#EAE5ED] bg-white shadow-[0_8px_24px_rgba(38,0,71,.04)]">
        <div className="border-b border-[#F0ECF2] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4E8] text-[#C77A17]">
              <ImagePlus size={19} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#21182A]">Aplikasi yang Digunakan & Contoh Studi Kasus</h2>
              <p className="mt-0.5 text-[11px] text-[#948B9B]">Atur logo aplikasi dan unggah hasil karya yang tampil berdampingan di bawah profil Mentor.</p>
            </div>
          </div>
        </div>

        <form onSubmit={saveCaseStudySettings} className="space-y-6 p-5 sm:p-7">
          <div className="rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4">
            <p className="text-xs font-bold text-[#51465D]">Tampilan halaman kelas</p>
            <p className="mt-1 text-[10px] leading-5 text-[#948B9B]">Bagian Aplikasi yang Digunakan akan berada di sebelah kiri, sedangkan Contoh Studi Kasus berada di sebelah kanan. Keduanya tampil tepat di bawah profil Mentor.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold">
              <span className="rounded-lg bg-white px-3 py-2 text-[#51465D]">Maks. 8 aplikasi</span>
              <span className="rounded-lg bg-white px-3 py-2 text-[#51465D]">Maks. 12 contoh karya</span>
              <span className="rounded-lg bg-white px-3 py-2 text-[#51465D]">JPG · PNG · WebP</span>
              <span className="rounded-lg bg-white px-3 py-2 text-[#51465D]">Maks. 5 MB / gambar</span>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]"><AppWindow size={17}/></div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#30243A]">Aplikasi yang Digunakan</h3>
                  <p className="mt-1 text-[10px] text-[#948B9B]">Tambahkan logo atau foto aplikasi beserta namanya.</p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[#EAE5ED] bg-white p-3">
                <label className="block text-[10px] font-bold text-[#51465D]" htmlFor="used-app-name">Nama aplikasi</label>
                <input
                  id="used-app-name"
                  value={newAppName}
                  onChange={(event) => setNewAppName(event.target.value)}
                  maxLength={60}
                  placeholder="Contoh: Canva, Photoshop, Figma"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#6D4388] focus:ring-2 focus:ring-[#6D4388]/10"
                />
                <div className="flex items-center gap-3">
                  {newAppPreview ? (
                    <img src={newAppPreview} alt="Preview logo aplikasi" className="h-12 w-12 rounded-xl border border-[#EAE5ED] bg-white object-contain p-1.5" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[#D8CDDF] bg-white text-[#A99AAF]"><ImagePlus size={18}/></div>
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#EAE5ED] bg-white px-3 text-[10px] font-bold text-[#51465D] hover:bg-[#F8F6F9]">
                    <ImagePlus size={13}/> Pilih Logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleNewAppFile} className="hidden" />
                  </label>
                  <button type="button" onClick={addUsedApp} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#260047] px-3 text-[10px] font-extrabold text-white hover:bg-[#09483F]">
                    <Plus size={13}/> Tambah
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {usedApps.map((app, index) => (
                  <div key={app.path} className="flex items-center gap-3 rounded-xl border border-[#EAE5ED] bg-white p-2.5">
                    <img src={app.url} alt={app.alt || app.name} className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#51465D]">{app.name}</span>
                    <button type="button" onClick={() => removeSavedUsedApp(app)} aria-label={`Hapus aplikasi ${app.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={13}/></button>
                  </div>
                ))}
                {pendingUsedApps.map((app) => (
                  <div key={app.key} className="flex items-center gap-3 rounded-xl border border-dashed border-[#BDA8CA] bg-[#F8F4FA] p-2.5">
                    <img src={app.previewUrl} alt={`Preview ${app.name}`} className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#5C3A70]">{app.name}</span>
                    <button type="button" onClick={() => removePendingUsedApp(app.key)} aria-label={`Batalkan aplikasi ${app.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 hover:bg-rose-50"><Trash2 size={13}/></button>
                  </div>
                ))}
                {usedApps.length === 0 && pendingUsedApps.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#D8CDDF] px-3 py-5 text-center text-[10px] text-[#948B9B]">Belum ada aplikasi yang ditambahkan.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#30243A]">Upload contoh studi kasus</h3>
                <p className="mt-1 text-[10px] text-[#948B9B]">Pilih beberapa gambar sekaligus. Gambar baru akan diunggah saat tombol simpan ditekan.</p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#260047] px-4 text-[10px] font-extrabold text-white transition hover:bg-[#09483F]">
                <Plus size={14} /> Pilih Gambar
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleCaseStudyFiles} className="hidden" />
              </label>
            </div>

            {caseStudyImages.length === 0 && pendingCaseStudies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D8CDDF] bg-[#FCFBFD] px-5 py-10 text-center">
                <ImagePlus size={28} className="mx-auto text-[#A99AAF]" />
                <p className="mt-3 text-xs font-bold text-[#51465D]">Belum ada contoh studi kasus</p>
                <p className="mt-1 text-[10px] text-[#948B9B]">Gambar yang diunggah akan muncul sebagai slider kecil di sisi kanan halaman kelas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {caseStudyImages.map((image, index) => (
                  <article key={image.path} className="group relative overflow-hidden rounded-xl border border-[#EAE5ED] bg-[#F8F6F9]">
                    <img src={image.url} alt={image.alt || `Contoh studi kasus ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="truncate text-[9px] font-semibold text-[#746D7B]">Gambar {index + 1}</span>
                      <button type="button" onClick={() => removeSavedCaseStudy(image)} aria-label={`Hapus gambar ${index + 1}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                ))}
                {pendingCaseStudies.map((item, index) => (
                  <article key={item.key} className="overflow-hidden rounded-xl border border-dashed border-[#BDA8CA] bg-[#F8F4FA]">
                    <img src={item.previewUrl} alt={`Preview gambar baru ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="truncate text-[9px] font-semibold text-[#5C3A70]">Gambar baru</span>
                      <button type="button" onClick={() => removePendingCaseStudy(item.key)} aria-label="Batalkan gambar baru" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 transition hover:bg-rose-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            </div>
          </div>

          {caseStudyError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{caseStudyError}</p>}
          {caseStudySuccess && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/>{caseStudySuccess}</p>}

          <div className="flex flex-col-reverse gap-2 border-t border-[#F0ECF2] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] leading-5 text-[#A49BAA]">Data aplikasi dan karya akan tampil di bawah profil Mentor pada halaman detail kelas.</p>
            <button type="submit" disabled={savingCaseStudies || savingMentor} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#260047] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#09483F] disabled:cursor-not-allowed disabled:opacity-60">
              {savingCaseStudies ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>}
              {savingCaseStudies ? "Menyimpan..." : "Simpan Aplikasi & Studi Kasus"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#EAE5ED] bg-white shadow-[0_8px_24px_rgba(38,0,71,.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0ECF2] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7E8] text-[#D58A12]"><MessageSquareQuote size={19}/></div>
            <div>
              <h2 className="text-base font-extrabold text-[#21182A]">Ulasan Manual Kelas Sebelumnya</h2>
              <p className="mt-0.5 text-[11px] text-[#948B9B]">Tambahkan testimoni lama agar tampil bersama rating peserta.</p>
            </div>
          </div>
          <button type="button" onClick={startAddReview} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#260047] px-4 text-[11px] font-extrabold text-white transition hover:bg-[#09483F]"><Plus size={15}/>Tambah Ulasan</button>
        </div>

        <div className="px-5 py-4 sm:px-7">
          <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-semibold text-[#746D7B]">
            <span className="rounded-lg bg-[#F4F0F6] px-3 py-2">Total ulasan manual: {reviews.length}</span>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">Ditampilkan: {visibleManualCount}</span>
          </div>

          {reviewError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{reviewError}</p>}
          {reviewSuccess && <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">{reviewSuccess}</p>}

          {reviewFormOpen && (
            <form onSubmit={saveManualReview} className="mb-5 space-y-4 rounded-2xl border border-[#EAE5ED] bg-[#FCFBFD] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[#30243A]">{editingReviewId ? "Edit Ulasan" : "Tambah Ulasan Manual"}</h3>
                <span className="rounded-full bg-[#F0EBF3] px-3 py-1 text-[9px] font-bold text-[#5C3A70]">Tanpa tanggal publik</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                <label className="block text-xs font-bold text-slate-700">
                  Nama pemberi ulasan
                  <input required minLength={2} maxLength={120} value={reviewForm.reviewerName} onChange={(event) => setReviewForm((current) => ({ ...current, reviewerName: event.target.value }))} placeholder="Nama yang ditampilkan" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10" />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Rating bintang
                  <select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#6D4388]">
                    <option value={5}>5 bintang</option><option value={4}>4 bintang</option><option value={3}>3 bintang</option><option value={2}>2 bintang</option><option value={1}>1 bintang</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                Isi ulasan
                <textarea required minLength={10} maxLength={2000} rows={4} value={reviewForm.reviewText} onChange={(event) => setReviewForm((current) => ({ ...current, reviewText: event.target.value }))} placeholder="Masukkan testimoni asli dari kelas sebelumnya..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-[#6D4388] focus:ring-4 focus:ring-[#6D4388]/10" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#51465D]">
                <input type="checkbox" checked={reviewForm.isPublished} onChange={(event) => setReviewForm((current) => ({ ...current, isPublished: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-[#260047]" />
                Tampilkan ulasan di halaman publik dan hitung ke rating keseluruhan
              </label>
              {reviewError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{reviewError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeReviewForm} disabled={savingReview} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button type="submit" disabled={savingReview} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#260047] px-4 text-xs font-extrabold text-white hover:bg-[#09483F] disabled:opacity-60">{savingReview ? <LoaderCircle size={14} className="animate-spin"/> : <Save size={14} />}{savingReview ? "Menyimpan..." : "Simpan Ulasan"}</button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DED6E3] bg-[#FCFBFD] px-5 py-10 text-center">
              <MessageSquareQuote size={26} className="mx-auto text-[#B8AEBF]" />
              <p className="mt-3 text-xs font-bold text-[#51465D]">Belum ada ulasan manual</p>
              <p className="mt-1 text-[10px] text-[#948B9B]">Tambahkan testimoni asli dari kelas sebelumnya.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0ECF2]">
              {reviews.map((review) => (
                <article key={review.id} className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-extrabold text-[#30243A]">{review.reviewer_name}</p>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${review.is_published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{review.is_published ? "Ditampilkan" : "Disembunyikan"}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-0.5">
                      {stars(review.rating).map((filled, index) => <Star key={index} size={12} className={filled ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-xs leading-6 text-[#746D7B]">{review.review_text}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => void toggleReviewVisibility(review)} title={review.is_published ? "Sembunyikan" : "Tampilkan"} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50">{review.is_published ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                    <button type="button" onClick={() => startEditReview(review)} title="Edit ulasan" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5DCEC] bg-[#F7F3F9] text-[#5B3472] transition hover:bg-[#EEE6F3]"><Pencil size={14}/></button>
                    <button type="button" onClick={() => void deleteManualReview(review)} disabled={deletingReviewId === review.id} title="Hapus ulasan" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:opacity-50">{deletingReviewId === review.id ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F6F9] px-4 py-3 text-[10px] leading-5 text-[#746D7B]">
        <span>Rating publik menggabungkan ulasan manual Admin dan ulasan peserta terverifikasi.</span>
        <span className="font-semibold">Ulasan manual tidak menampilkan tanggal.</span>
      </div>
    </div>
  );
}
