"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";

type Props = {
  courseId: string;
  courseTitle: string;
  currentPrice: number;
};

type CaseStudyItem = {
  url: string;
};

function formatRupiah(value: number | null | undefined) {
  if (!value || value <= 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CoursePromoCaseStudyManager({
  courseId,
  courseTitle,
  currentPrice,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();

  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [caseStudies, setCaseStudies] = useState<CaseStudyItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("course_promo_settings")
        .select("original_price, case_study_images")
        .eq("course_id", courseId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setMessage(error.message);
      } else if (data) {
        setOriginalPrice(data.original_price ? String(data.original_price) : "");
        const items = Array.isArray(data.case_study_images)
          ? data.case_study_images
          : [];
        setCaseStudies(
          items
            .filter((item: any) => item?.url)
            .map((item: any) => ({ url: item.url }))
        );
      }

      setLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [courseId, supabase]);

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage("");

    try {
      const uploadedItems: CaseStudyItem[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${courseId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("course-case-studies")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("course-case-studies")
          .getPublicUrl(fileName);

        uploadedItems.push({
          url: publicUrlData.publicUrl,
        });
      }

      setCaseStudies((prev) => [...prev, ...uploadedItems]);
    } catch (error: any) {
      setMessage(error?.message || "Upload gambar gagal.");
    } finally {
      setUploading(false);
    }
  }

  function removeCaseStudy(index: number) {
    setCaseStudies((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLeft(index: number) {
    if (index === 0) return;
    setCaseStudies((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveRight(index: number) {
    if (index === caseStudies.length - 1) return;
    setCaseStudies((prev) => {
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  function handleSave() {
    startSaving(async () => {
      setMessage("");

      const payload = caseStudies.map((item) => ({
        url: item.url,
      }));

      const parsedOriginalPrice =
        originalPrice.trim() === "" ? null : Number(originalPrice);

      const { error } = await supabase.rpc("set_course_promo_settings", {
        p_course_id: courseId,
        p_original_price: parsedOriginalPrice,
        p_case_study_images: payload,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Pengaturan promosi berhasil disimpan.");
    });
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat pengaturan promosi kelas...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">Promosi Detail Kelas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Atur harga coret dan contoh studi kasus untuk kelas <b>{courseTitle}</b>.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Harga Coret
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Harga Normal / Harga Coret
                </label>
                <input
                  type="number"
                  min={0}
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="Contoh: 250000"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-violet-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Kosongkan jika tidak ingin menampilkan harga coret.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preview Harga
                </p>
                <div className="mt-3 space-y-1">
                  {originalPrice && Number(originalPrice) > currentPrice ? (
                    <p className="text-sm text-slate-400 line-through">
                      {formatRupiah(Number(originalPrice))}
                    </p>
                  ) : null}
                  <p className="text-3xl font-extrabold text-violet-900">
                    {formatRupiah(currentPrice)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Upload Contoh Studi Kasus
            </h3>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-600 transition hover:border-violet-400 hover:bg-violet-50">
                <ImagePlus className="h-5 w-5" />
                {uploading ? "Sedang mengunggah..." : "Pilih gambar studi kasus"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Bisa upload banyak gambar. Urutan gambar akan menjadi urutan slider.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {caseStudies.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Belum ada gambar studi kasus.
                </div>
              ) : (
                caseStudies.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <img
                      src={item.url}
                      alt={`Studi kasus ${index + 1}`}
                      className="h-20 w-24 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        Studi Kasus {index + 1}
                      </p>
                      <p className="truncate text-xs text-slate-500">{item.url}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => moveLeft(index)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Geser Kiri
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRight(index)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Geser Kanan
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCaseStudy(index)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Pengaturan Promosi
          </button>

          {message ? (
            <p className="text-sm text-slate-600">{message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}