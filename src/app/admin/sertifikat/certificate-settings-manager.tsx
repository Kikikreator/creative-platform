"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { fitCertificateName } from "@/lib/certificates/name-layout";
import {
  CheckCircle2, CircleAlert, FileImage, ImagePlus, LoaderCircle, Move, Save,
  ShieldCheck, Sparkles, UploadCloud,
} from "lucide-react";

const BUCKET = "course-certificate-templates";
const inputClass = "mt-1.5 h-11 w-full rounded-xl bg-[#F7F6FB] px-3.5 text-sm text-[#241B39] shadow-inner shadow-[#30204A]/[0.025] outline-none ring-1 ring-inset ring-[#ECE8F4] transition focus:bg-white focus:ring-2 focus:ring-violet-300";
const labelClass = "block text-xs font-bold text-[#51476B]";
const defaultBox = { x: 0.22, y: 0.39, width: 0.56, height: 0.15 };

type NameBox = { x: number; y: number; width: number; height: number };
type DragState = { mode: "move" | "resize"; startX: number; startY: number; initial: NameBox };
export type CertificateCourse = { id: string; title: string; slug: string; status: string };
export type CertificateTask = { id: string; course_id: string; title: string; status: string; is_required: boolean; max_score: number | string };
export type CertificateSetting = {
  course_id: string; enabled: boolean; passing_score: number | string; final_task_id: string | null;
  issuer_name: string; issuer_title: string; signature_name: string | null; updated_at: string;
  template_path: string | null; template_mime_type: string | null; template_width: number | null; template_height: number | null;
  name_box_x: number | string | null; name_box_y: number | string | null; name_box_width: number | string | null; name_box_height: number | string | null;
  name_font_min_size: number | string | null; name_font_max_size: number | string | null; name_font_color: string | null; name_font_bold: boolean | null; name_font_family: string | null;
};
type IssuedCertificate = { id: string; course_id: string; issued_at: string; revoked_at: string | null };

function settingBox(setting: CertificateSetting | null): NameBox {
  if (!setting) return defaultBox;
  return {
    x: Number(setting.name_box_x ?? defaultBox.x),
    y: Number(setting.name_box_y ?? defaultBox.y),
    width: Number(setting.name_box_width ?? defaultBox.width),
    height: Number(setting.name_box_height ?? defaultBox.height),
  };
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function cssFontFamily(value: string) {
  if (value === "TimesRoman") return '"Times New Roman", serif';
  if (value === "Courier") return '"Courier New", monospace';
  return "Arial, sans-serif";
}

export default function CertificateSettingsManager({ courses, tasks, settings, issuedCertificates, initialError }: {
  courses: CertificateCourse[]; tasks: CertificateTask[]; settings: CertificateSetting[];
  issuedCertificates: IssuedCertificate[]; initialError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const setting = settings.find((item) => item.course_id === courseId) ?? null;
  const selectedCourse = courses.find((course) => course.id === courseId) ?? null;
  const courseTasks = tasks.filter((task) => task.course_id === courseId);
  const publishedRequiredTasks = courseTasks.filter((task) => task.status === "published" && task.is_required);

  const [enabled, setEnabled] = useState(setting?.enabled ?? false);
  const [passingScore, setPassingScore] = useState(String(setting?.passing_score ?? 75));
  const [finalTaskId, setFinalTaskId] = useState(setting?.final_task_id ?? "");
  const [issuerName, setIssuerName] = useState(setting?.issuer_name ?? "Kiki Creator Class");
  const [issuerTitle, setIssuerTitle] = useState(setting?.issuer_title ?? "Penyelenggara");
  const [signatureName, setSignatureName] = useState(setting?.signature_name ?? "");
  const [templatePath, setTemplatePath] = useState(setting?.template_path ?? "");
  const [templateMimeType, setTemplateMimeType] = useState(setting?.template_mime_type ?? "");
  const [templateWidth, setTemplateWidth] = useState(Number(setting?.template_width ?? 0));
  const [templateHeight, setTemplateHeight] = useState(Number(setting?.template_height ?? 0));
  const [templateUrl, setTemplateUrl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [box, setBox] = useState<NameBox>(settingBox(setting));
  const [minFontSize, setMinFontSize] = useState(Number(setting?.name_font_min_size ?? 16));
  const [maxFontSize, setMaxFontSize] = useState(Number(setting?.name_font_max_size ?? 42));
  const [fontColor, setFontColor] = useState(setting?.name_font_color ?? "#30204A");
  const [fontBold, setFontBold] = useState(setting?.name_font_bold ?? true);
  const [fontFamily, setFontFamily] = useState(setting?.name_font_family ?? "Helvetica");
  const [previewName, setPreviewName] = useState("Nama Peserta");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(720);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const element = previewRef.current;
    if (!element || !templateUrl || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setPreviewWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [templateUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplateUrl() {
      if (!setting?.template_path) { setTemplateUrl(""); return; }
      const { data, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(setting.template_path, 3600);
      if (!cancelled) {
        if (signedError) setError((current) => current || `Preview template tidak dapat dibuka: ${signedError.message}`);
        else setTemplateUrl(data?.signedUrl ?? "");
      }
    }
    void loadTemplateUrl();
    return () => { cancelled = true; };
  }, [setting?.template_path, supabase]);

  function changeCourse(nextId: string) {
    const next = settings.find((item) => item.course_id === nextId) ?? null;
    setCourseId(nextId);
    setEnabled(next?.enabled ?? false);
    setPassingScore(String(next?.passing_score ?? 75));
    setFinalTaskId(next?.final_task_id ?? "");
    setIssuerName(next?.issuer_name ?? "Kiki Creator Class");
    setIssuerTitle(next?.issuer_title ?? "Penyelenggara");
    setSignatureName(next?.signature_name ?? "");
    setTemplatePath(next?.template_path ?? "");
    setTemplateMimeType(next?.template_mime_type ?? "");
    setTemplateWidth(Number(next?.template_width ?? 0));
    setTemplateHeight(Number(next?.template_height ?? 0));
    setTemplateName("");
    setBox(settingBox(next));
    setMinFontSize(Number(next?.name_font_min_size ?? 16));
    setMaxFontSize(Number(next?.name_font_max_size ?? 42));
    setFontColor(next?.name_font_color ?? "#30204A");
    setFontBold(next?.name_font_bold ?? true);
    setFontFamily(next?.name_font_family ?? "Helvetica");
    setPreviewName("Nama Peserta");
    setError(""); setNotice("");
    setTemplateUrl("");
  }

  async function uploadTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Format desain harus PNG atau JPG/JPEG."); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB."); return;
    }
    setUploading(true); setError(""); setNotice("");
    const objectUrl = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("File gambar tidak dapat dibaca."));
        image.src = objectUrl;
      });
      if (!dimensions.width || !dimensions.height || dimensions.width > 12000 || dimensions.height > 12000) {
        throw new Error("Resolusi gambar tidak valid atau terlalu besar (maksimal 12.000 px per sisi).");
      }
      const extension = file.type === "image/png" ? "png" : "jpg";
      const path = `${courseId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (signedError) throw signedError;
      setTemplatePath(path);
      setTemplateMimeType(file.type);
      setTemplateWidth(dimensions.width);
      setTemplateHeight(dimensions.height);
      setTemplateUrl(signed?.signedUrl ?? objectUrl);
      if (signed?.signedUrl) URL.revokeObjectURL(objectUrl);
      setTemplateName(file.name);
      setNotice("Desain berhasil diunggah. Atur kotak nama pada preview, lalu simpan pengaturan.");
    } catch (uploadError: any) {
      URL.revokeObjectURL(objectUrl);
      setError(uploadError?.message || "Template gagal diunggah.");
    } finally {
      setUploading(false);
    }
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") {
    if (!previewRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    previewRef.current.setPointerCapture(event.pointerId);
    setDragState({ mode, startX: event.clientX, startY: event.clientY, initial: box });
  }
  function moveBox(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (event.clientX - dragState.startX) / rect.width;
    const dy = (event.clientY - dragState.startY) / rect.height;
    if (dragState.mode === "move") {
      setBox({
        ...dragState.initial,
        x: clamp(dragState.initial.x + dx, 0, 1 - dragState.initial.width),
        y: clamp(dragState.initial.y + dy, 0, 1 - dragState.initial.height),
      });
    } else {
      setBox({
        ...dragState.initial,
        width: clamp(dragState.initial.width + dx, 0.08, 1 - dragState.initial.x),
        height: clamp(dragState.initial.height + dy, 0.06, 1 - dragState.initial.y),
      });
    }
  }

  async function saveSettings() {
    if (!courseId) return;
    setSaving(true); setError(""); setNotice("");
    const score = Number(passingScore);
    if (!Number.isFinite(score) || score < 1 || score > 100) { setError("Nilai minimum harus berada di antara 1 sampai 100."); setSaving(false); return; }
    if (enabled && !finalTaskId) { setError("Pilih satu tugas wajib yang sudah dipublikasikan sebagai Tugas Akhir."); setSaving(false); return; }
    if (enabled && !templatePath) { setError("Unggah desain sertifikat PNG/JPG terlebih dahulu sebelum mengaktifkan penerbitan."); setSaving(false); return; }
    if (!issuerName.trim()) { setError("Nama penerbit wajib diisi."); setSaving(false); return; }
    if (minFontSize < 8 || maxFontSize > 120 || minFontSize > maxFontSize) { setError("Rentang font harus 8–120 pt dan ukuran minimum tidak boleh melebihi maksimum."); setSaving(false); return; }
    const { error: saveError } = await (supabase as any).rpc("admin_save_course_certificate_template_settings", {
      p_course_id: courseId,
      p_enabled: enabled,
      p_passing_score: score,
      p_final_task_id: finalTaskId || null,
      p_issuer_name: issuerName.trim(),
      p_issuer_title: issuerTitle.trim(),
      p_signature_name: signatureName.trim() || null,
      p_template_path: templatePath || null,
      p_template_mime_type: templateMimeType || null,
      p_template_width: templateWidth || null,
      p_template_height: templateHeight || null,
      p_name_box_x: box.x,
      p_name_box_y: box.y,
      p_name_box_width: box.width,
      p_name_box_height: box.height,
      p_name_font_min_size: minFontSize,
      p_name_font_max_size: maxFontSize,
      p_name_font_color: fontColor,
      p_name_font_bold: fontBold,
      p_name_font_family: fontFamily,
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Pengaturan sertifikat dan posisi nama berhasil disimpan."); window.location.reload(); }
    setSaving(false);
  }

  const activeCertificates = issuedCertificates.filter((item) => item.course_id === courseId && !item.revoked_at).length;
  const selectedFinalTask = courseTasks.find((task) => task.id === finalTaskId);
  const enableReady = Boolean(selectedCourse && publishedRequiredTasks.length > 0 && finalTaskId && issuerName.trim() && templatePath);
  const previewLayout = useMemo(() => {
    if (!templateWidth || !templateHeight) return null;
    const scale = previewWidth / 842 * (96 / 72);
    const canvas = mounted && typeof document !== "undefined" ? document.createElement("canvas") : null;
    const context = canvas?.getContext("2d");
    const family = cssFontFamily(fontFamily);
    const measure = (text: string, size: number) => {
      if (!context) return text.length * size * 0.56;
      context.font = `${fontBold ? "700" : "400"} ${size}px ${family}`;
      return context.measureText(text).width;
    };
    return fitCertificateName(previewName, box.width * previewWidth, box.height * (previewWidth * templateHeight / templateWidth), maxFontSize * scale, minFontSize * scale, measure);
  }, [box.height, box.width, fontBold, fontFamily, maxFontSize, minFontSize, mounted, previewName, previewWidth, templateHeight, templateWidth]);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700"><Sparkles size={13}/> Certificate studio</div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#211A37] sm:text-3xl">Sertifikat & Kelulusan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#89829B]">Atur kelulusan kelas dan unggah desain sertifikat sendiri. Nama peserta akan ditempatkan otomatis pada area yang kamu tentukan.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-2xl bg-white px-4 py-3 text-xs font-bold text-violet-700 shadow-[0_8px_24px_rgba(47,30,82,.06)]"><ShieldCheck size={16}/> Admin Workspace</div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Total kelas</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{courses.length}</p><p className="mt-1 text-[10px] text-[#A49DB2]">Kelas di platform</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Sertifikat diterbitkan</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{issuedCertificates.filter((item) => !item.revoked_at).length}</p><p className="mt-1 text-[10px] text-[#A49DB2]">Seluruh kelas</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_26px_rgba(47,30,82,.055)]"><p className="text-xs text-[#938BA5]">Kelas aktif sertifikat</p><p className="mt-2 text-3xl font-extrabold text-[#211A37]">{settings.filter((item) => item.enabled).length}</p><p className="mt-1 text-[10px] text-[#A49DB2]">Pengaturan telah diaktifkan</p></div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700"><CircleAlert size={15} className="mt-0.5 shrink-0"/>{error}</div>}
      {notice && <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>{notice}</div>}

      <section className="rounded-[26px] bg-white p-5 shadow-[0_12px_34px_rgba(47,30,82,.065)] sm:p-7">
        <label className={labelClass}>Pilih kelas<select value={courseId} onChange={(event) => changeCourse(event.target.value)} className={`${inputClass} max-w-xl`}><option value="">Pilih kelas</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        {!selectedCourse ? <div className="mt-6 rounded-2xl bg-[#F8F6FC] p-6 text-sm text-[#938BA5]">Belum ada kelas yang dapat diatur.</div> : <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(310px,.82fr)_minmax(0,1.5fr)]">
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#F8F6FC] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-[#33284D]">Aktifkan penerbitan otomatis</p><p className="mt-1 text-[10px] leading-5 text-[#938BA5]">Sertifikat diterbitkan setelah semua syarat kelulusan dan ulasan terpenuhi.</p></div><button type="button" onClick={() => setEnabled((value) => !value)} aria-pressed={enabled} className={`relative h-8 w-[58px] shrink-0 rounded-full transition ${enabled ? "bg-violet-600" : "bg-[#D9D4E3]"}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${enabled ? "left-[30px]" : "left-1"}`}/></button></div></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className={labelClass}>Nilai minimum kelulusan (%)<input type="number" min="1" max="100" step="1" value={passingScore} onChange={(event) => setPassingScore(event.target.value)} className={inputClass}/><span className="mt-1 block text-[10px] font-normal text-[#A29AAF]">Nilai tugas dibandingkan secara proporsional dengan nilai maksimal tugas.</span></label>
              <label className={labelClass}>Tugas Akhir *<select value={finalTaskId} onChange={(event) => setFinalTaskId(event.target.value)} className={inputClass}><option value="">Pilih tugas akhir</option>{publishedRequiredTasks.map((task) => <option key={task.id} value={task.id}>{task.title} · maks. {task.max_score}</option>)}</select><span className="mt-1 block text-[10px] font-normal text-[#A29AAF]">Tugas wajib lainnya otomatis dihitung sebagai Tugas Bab.</span></label>
            </div>
            {publishedRequiredTasks.length === 0 && <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">Belum ada tugas wajib yang dipublikasikan. Buat tugas terlebih dahulu di Manajemen Tugas.</div>}
            {selectedFinalTask && <div className="rounded-xl bg-violet-50 px-4 py-3 text-xs text-violet-800"><CheckCircle2 size={14} className="mr-2 inline"/>Tugas Akhir: <strong>{selectedFinalTask.title}</strong>.</div>}
            <div className="border-t border-[#F0ECF6] pt-5"><p className="text-sm font-extrabold text-[#302647]">Identitas penerbit</p><div className="mt-4 space-y-3"><label className={labelClass}>Nama penerbit<input value={issuerName} onChange={(event) => setIssuerName(event.target.value)} maxLength={120} className={inputClass}/></label><label className={labelClass}>Jabatan penerbit<input value={issuerTitle} onChange={(event) => setIssuerTitle(event.target.value)} maxLength={100} className={inputClass}/></label><label className={labelClass}>Nama penandatangan (opsional)<input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} maxLength={120} className={inputClass}/></label></div></div>
            <div className="rounded-2xl bg-[#FAF9FC] p-4"><p className="text-xs font-extrabold text-[#33284D]">Status template</p><div className="mt-2 flex items-center gap-2 text-xs">{templatePath ? <><CheckCircle2 size={15} className="text-emerald-600"/><span className="font-semibold text-emerald-700">Desain sudah diunggah</span></> : <><CircleAlert size={15} className="text-amber-600"/><span className="font-semibold text-amber-700">Belum ada desain</span></>}</div><p className="mt-2 break-all text-[10px] leading-5 text-[#9A92A9]">{templateName || templatePath || "Unggah desain PNG/JPG yang bagian namanya masih kosong."}</p></div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-base font-extrabold text-[#261E3C]">Studio template sertifikat</h2><p className="mt-1 text-xs leading-5 text-[#938BA5]">Seret kotak ungu ke area nama kosong. Tarik sudut kanan bawah untuk mengubah ukuran.</p></div><div className="flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={uploadTemplate} className="hidden"/><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || !courseId} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 text-xs font-extrabold text-white shadow-[0_7px_18px_rgba(109,40,217,.18)] disabled:opacity-50">{uploading ? <LoaderCircle size={15} className="animate-spin"/> : <UploadCloud size={15}/>} {templatePath ? "Ganti desain" : "Unggah desain"}</button></div></div>
            {templateUrl && templateWidth > 0 && templateHeight > 0 ? <>
              <div className="overflow-hidden rounded-2xl bg-[#F0EDF6] p-3 sm:p-4">
                <div ref={previewRef} className="relative mx-auto w-full max-w-[900px] touch-none select-none overflow-hidden rounded-lg bg-white shadow-[0_14px_34px_rgba(38,24,64,.15)]" style={{ aspectRatio: `${templateWidth} / ${templateHeight}` }} onPointerMove={moveBox} onPointerUp={() => setDragState(null)} onPointerCancel={() => setDragState(null)}>
                  <img src={templateUrl} alt="Preview desain sertifikat" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-fill"/>
                  <div onPointerDown={(event) => startDrag(event, "move")} className="absolute flex cursor-move items-center justify-center overflow-visible rounded-md border-2 border-dashed border-violet-600 bg-violet-500/10 shadow-[0_0_0_9999px_rgba(20,12,38,.035)]" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%`, touchAction: "none" }}>
                    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center overflow-hidden px-1 text-center" style={{ color: fontColor, fontFamily: cssFontFamily(fontFamily), fontWeight: fontBold ? 700 : 400, fontSize: `${previewLayout?.fontSize ?? 18}px`, lineHeight: `${previewLayout?.lineHeight ?? 21}px` }}>
                      {(previewLayout?.lines ?? [previewName || "Nama Peserta"]).map((line, index) => <span key={`${index}-${line}`} className="block max-w-full whitespace-nowrap">{line}</span>)}
                    </div>
                    <span className="pointer-events-none absolute -top-6 left-0 inline-flex items-center gap-1 rounded-md bg-violet-700 px-2 py-1 text-[9px] font-bold text-white shadow"><Move size={10}/> AREA NAMA</span>
                    <button type="button" aria-label="Ubah ukuran kotak nama" onPointerDown={(event) => startDrag(event, "resize")} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-violet-700 shadow-lg"/>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 rounded-2xl bg-[#FAF9FC] p-4 sm:grid-cols-2">
                <label className={labelClass}>Nama contoh untuk preview<input value={previewName} onChange={(event) => setPreviewName(event.target.value)} maxLength={160} className={inputClass} placeholder="Contoh: Gita Nas tria"/></label>
                <div className="flex items-end"><p className="text-[10px] leading-5 text-[#938BA5]">Preview memakai perhitungan ukuran yang sama dengan PDF. Coba nama pendek, sedang, dan panjang sebelum menyimpan.</p></div>
                <label className={labelClass}>Warna nama<input type="color" value={fontColor} onChange={(event) => setFontColor(event.target.value)} className="mt-1.5 h-11 w-full cursor-pointer rounded-xl bg-[#F7F6FB] p-1.5 ring-1 ring-inset ring-[#ECE8F4]"/></label>
                <label className={labelClass}>Jenis font<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)} className={inputClass}><option value="Helvetica">Sans-serif (Helvetica)</option><option value="TimesRoman">Serif (Times Roman)</option><option value="Courier">Monospace (Courier)</option></select></label>
                <label className={labelClass}>Ukuran minimum (pt)<input type="number" min="8" max="120" value={minFontSize} onChange={(event) => setMinFontSize(Number(event.target.value))} className={inputClass}/></label>
                <label className={labelClass}>Ukuran maksimum (pt)<input type="number" min="8" max="120" value={maxFontSize} onChange={(event) => setMaxFontSize(Number(event.target.value))} className={inputClass}/></label>
                <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-xs font-bold text-[#51476B] shadow-sm sm:col-span-2"><input type="checkbox" checked={fontBold} onChange={(event) => setFontBold(event.target.checked)} className="h-4 w-4 accent-violet-600"/> Gunakan huruf tebal</label>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([['Posisi X', box.x, (value: number) => setBox((current) => ({ ...current, x: clamp(value / 100, 0, 1 - current.width) }))], ['Posisi Y', box.y, (value: number) => setBox((current) => ({ ...current, y: clamp(value / 100, 0, 1 - current.height) }))], ['Lebar', box.width, (value: number) => setBox((current) => ({ ...current, width: clamp(value / 100, 0.08, 1 - current.x) }))], ['Tinggi', box.height, (value: number) => setBox((current) => ({ ...current, height: clamp(value / 100, 0.06, 1 - current.y) }))]] as Array<[string, number, (value: number) => void]>).map(([label, value, setter]) => <label key={label} className={labelClass}>{label} (%)<input type="number" min="0" max="100" step="0.5" value={(value * 100).toFixed(1)} onChange={(event) => setter(Number(event.target.value || 0))} className={inputClass}/></label>)}
              </div>
            </> : <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E4DDF0] bg-[#FAF9FC] px-6 py-10 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><FileImage size={27}/></span><h3 className="mt-4 text-sm font-extrabold text-[#302647]">Belum ada desain sertifikat</h3><p className="mt-2 max-w-md text-xs leading-5 text-[#938BA5]">Unggah file PNG/JPG yang sudah didesain dan sisakan area kosong untuk nama peserta. Kamu akan mengatur posisi nama langsung pada preview.</p><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || !courseId} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-50 px-4 text-xs font-bold text-violet-700">{uploading ? <LoaderCircle size={14} className="animate-spin"/> : <ImagePlus size={14}/>} Pilih file desain</button></div>}
            <p className="text-[10px] leading-5 text-[#9A92A9]">Format PNG/JPG · Maksimal 10 MB · Template lama tidak dihapus agar sertifikat yang sudah terbit tetap menggunakan desain aslinya.</p>
          </div>
        </div>}
        {selectedCourse && <div className="mt-7 flex flex-col justify-between gap-3 border-t border-[#F0ECF6] pt-5 sm:flex-row sm:items-center"><div><p className="text-xs font-extrabold text-[#33284D]">{activeCertificates} sertifikat telah diterbitkan</p><p className="mt-1 text-[10px] text-[#938BA5]">Arsip sertifikat yang sudah terbit tidak berubah saat template diperbarui.</p></div><button type="button" onClick={() => void saveSettings()} disabled={saving || uploading || (enabled && !enableReady)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-6 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(109,40,217,.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>} Simpan pengaturan sertifikat</button></div>}
      </section>
    </main>
  );
}
