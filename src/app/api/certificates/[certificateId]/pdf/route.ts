import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { fitCertificateName } from "@/lib/certificates/name-layout";
import { getPrimaryRole, normalizeRoles } from "@/lib/auth/roles";

type RouteContext = { params: Promise<{ certificateId: string }> };
const BUCKET = "course-certificate-templates";

function hexToRgb(hex: string) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#30204A";
  return rgb(parseInt(safe.slice(1, 3), 16) / 255, parseInt(safe.slice(3, 5), 16) / 255, parseInt(safe.slice(5, 7), 16) / 255);
}
function standardFont(family: string, bold: boolean) {
  if (family === "TimesRoman") return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  if (family === "Courier") return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

async function buildLegacyPdf(certificate: any, issuer: any) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Sertifikat ${certificate.full_name_snapshot} - ${certificate.course_title_snapshot}`);
  pdf.setAuthor(issuer?.issuer_name || "Kiki Creator Class");
  pdf.setSubject(`Certificate ${certificate.certificate_number}`);
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const purple = rgb(0.31, 0.13, 0.61);
  const dark = rgb(0.13, 0.10, 0.22);
  const muted = rgb(0.42, 0.39, 0.49);
  const gold = rgb(0.76, 0.58, 0.24);
  const center = (text: string, font: PDFFont, size: number) => (842 - font.widthOfTextAtSize(text, size)) / 2;
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 22, y: 22, width: 798, height: 551, borderColor: purple, borderWidth: 2 });
  page.drawRectangle({ x: 31, y: 31, width: 780, height: 533, borderColor: gold, borderWidth: 0.8 });
  page.drawRectangle({ x: 31, y: 31, width: 780, height: 7, color: purple });
  const title = "SERTIFIKAT PENYELESAIAN";
  page.drawText(title, { x: center(title, bold, 25), y: 445, size: 25, font: bold, color: dark });
  const intro = "Diberikan dengan penghargaan kepada";
  page.drawText(intro, { x: center(intro, regular, 12), y: 408, size: 12, font: regular, color: muted });
  const name = certificate.full_name_snapshot;
  const nameSize = Math.min(30, Math.max(18, 560 / Math.max(name.length, 1) * 1.55));
  page.drawText(name, { x: center(name, bold, nameSize), y: 360, size: nameSize, font: bold, color: purple });
  page.drawRectangle({ x: 280, y: 345, width: 282, height: 1.4, color: gold });
  const courseTitle = certificate.course_title_snapshot;
  const courseSize = Math.min(20, Math.max(13, 600 / Math.max(courseTitle.length, 1) * 1.5));
  page.drawText(courseTitle, { x: center(courseTitle, bold, courseSize), y: 280, size: courseSize, font: bold, color: dark });
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(certificate.issued_at));
  page.drawText(`Diterbitkan pada ${date}`, { x: 90, y: 195, size: 10, font: regular, color: muted });
  page.drawText(`Mentor: ${certificate.mentor_name_snapshot}`, { x: 90, y: 176, size: 10, font: regular, color: muted });
  page.drawText(`Nomor sertifikat: ${certificate.certificate_number}`, { x: 90, y: 157, size: 9, font: bold, color: purple });
  const issuerName = issuer?.signature_name || issuer?.issuer_name || "Kiki Creator Class";
  const issuerTitle = issuer?.issuer_title || "Penyelenggara";
  page.drawText(issuerName, { x: 540, y: 176, size: 11, font: bold, color: dark });
  page.drawRectangle({ x: 540, y: 169, width: 165, height: 0.8, color: gold });
  page.drawText(issuerTitle, { x: 540, y: 153, size: 9, font: regular, color: muted });
  return pdf.save();
}

export async function GET(request: Request, { params }: RouteContext) {
  const { certificateId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  const db = supabase as any;
  const { data: roleRows, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError) {
    return NextResponse.json({ error: "Hak akses akun belum dapat diverifikasi." }, { status: 503 });
  }

  const primaryRole = getPrimaryRole(normalizeRoles(roleRows));
  if (primaryRole !== "member" && primaryRole !== "admin") {
    return NextResponse.json({ error: "Fitur sertifikat peserta tidak tersedia untuk akun Mentor." }, { status: 403 });
  }

  const { data: certificate, error: certificateError } = await db.from("course_certificates")
    .select("id, course_id, user_id, certificate_number, full_name_snapshot, course_title_snapshot, mentor_name_snapshot, issued_at, revoked_at, template_path_snapshot, template_mime_type_snapshot, template_width_snapshot, template_height_snapshot, name_box_x_snapshot, name_box_y_snapshot, name_box_width_snapshot, name_box_height_snapshot, name_font_min_size_snapshot, name_font_max_size_snapshot, name_font_color_snapshot, name_font_bold_snapshot, name_font_family_snapshot")
    .eq("id", certificateId).maybeSingle();
  if (certificateError || !certificate) return NextResponse.json({ error: "Sertifikat tidak ditemukan." }, { status: 404 });
  if (certificate.revoked_at) return NextResponse.json({ error: "Sertifikat ini telah dicabut." }, { status: 410 });
  if (certificate.user_id !== user.id) {
    const { data: adminRole } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return NextResponse.json({ error: "Kamu tidak memiliki akses ke sertifikat ini." }, { status: 403 });
  }

  const { data: issuer } = await db.from("course_certificate_settings").select("issuer_name, issuer_title, signature_name").eq("course_id", certificate.course_id).maybeSingle();
  let pdfBytes: Uint8Array;

  if (!certificate.template_path_snapshot) {
    // Compatibility for certificates issued before image templates were introduced.
    pdfBytes = await buildLegacyPdf(certificate, issuer);
  } else {
    const { data: templateBlob, error: templateError } = await db.storage.from(BUCKET).download(certificate.template_path_snapshot);
    if (templateError || !templateBlob) {
      return NextResponse.json({ error: "Desain sertifikat arsip tidak dapat dibuka. Hubungi Admin." }, { status: 500 });
    }
    const templateBytes = new Uint8Array(await templateBlob.arrayBuffer());
    const width = Number(certificate.template_width_snapshot || 0);
    const height = Number(certificate.template_height_snapshot || 0);
    if (!width || !height) return NextResponse.json({ error: "Ukuran template sertifikat tidak valid." }, { status: 500 });

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Sertifikat ${certificate.full_name_snapshot} - ${certificate.course_title_snapshot}`);
    pdf.setAuthor(issuer?.issuer_name || "Kiki Creator Class");
    pdf.setSubject(`Certificate ${certificate.certificate_number}`);
    const pageWidth = 842;
    const pageHeight = pageWidth * height / width;
    const page = pdf.addPage([pageWidth, pageHeight]);
    const mime = certificate.template_mime_type_snapshot || "image/png";
    const image = mime === "image/jpeg" ? await pdf.embedJpg(templateBytes) : await pdf.embedPng(templateBytes);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    const fontName = standardFont(certificate.name_font_family_snapshot || "Helvetica", Boolean(certificate.name_font_bold_snapshot));
    const font = await pdf.embedFont(fontName);
    const boxX = Number(certificate.name_box_x_snapshot ?? 0.22) * pageWidth;
    const boxYTop = Number(certificate.name_box_y_snapshot ?? 0.39) * pageHeight;
    const boxWidth = Number(certificate.name_box_width_snapshot ?? 0.56) * pageWidth;
    const boxHeight = Number(certificate.name_box_height_snapshot ?? 0.15) * pageHeight;
    const boxBottom = pageHeight - boxYTop - boxHeight;
    const minSize = Number(certificate.name_font_min_size_snapshot ?? 16);
    const maxSize = Number(certificate.name_font_max_size_snapshot ?? 42);
    const layout = fitCertificateName(
      certificate.full_name_snapshot,
      boxWidth,
      boxHeight,
      maxSize,
      minSize,
      (text, size) => font.widthOfTextAtSize(text, size),
    );
    const color = hexToRgb(certificate.name_font_color_snapshot || "#30204A");
    const blockHeight = layout.lineHeight * layout.lines.length;
    const firstBaseline = boxBottom + (boxHeight + blockHeight) / 2 - layout.fontSize * 0.82;
    layout.lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, layout.fontSize);
      page.drawText(line, {
        x: boxX + (boxWidth - textWidth) / 2,
        y: firstBaseline - index * layout.lineHeight,
        size: layout.fontSize,
        font,
        color,
      });
    });
    pdfBytes = await pdf.save();
  }

  const safeNumber = String(certificate.certificate_number).replace(/[^A-Za-z0-9-]/g, "-");
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Sertifikat-${safeNumber}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
