import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Award, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

type PageProps = { params: Promise<{ certificateNumber: string }> };
type Verification = { valid: boolean; certificate_number?: string; full_name?: string; course_title?: string; mentor_name?: string; issuer_name?: string; issued_at?: string };

export default async function VerifyCertificatePage({ params }: PageProps) {
  await connection();
  const { certificateNumber } = await params;
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc("verify_course_certificate", { p_certificate_number: certificateNumber });
  const result = (data ?? { valid: false }) as Verification;
  const valid = !error && result.valid === true;
  const issuedDate = result.issued_at ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(result.issued_at)) : "-";
  return <main className="flex min-h-screen items-center justify-center bg-[#F8F7FC] px-4 py-10"><section className="w-full max-w-xl rounded-[28px] bg-white p-6 text-center shadow-[0_18px_50px_rgba(47,30,82,.09)] sm:p-9"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${valid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{valid ? <ShieldCheck size={32}/> : <XCircle size={32}/>}</span><p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.2em] text-violet-700">Kiki Creator Class · Certificate Verification</p><h1 className="mt-2 text-2xl font-extrabold text-[#211A37]">{valid ? "Sertifikat Valid" : "Sertifikat Tidak Valid"}</h1><p className="mt-2 text-xs leading-6 text-[#938BA5]">{valid ? "Nomor sertifikat berikut tercatat dan diterbitkan oleh Kiki Creator Class." : "Nomor sertifikat tidak ditemukan, tidak valid, atau telah dicabut."}</p>{valid && <div className="mt-7 rounded-2xl bg-[#FAF9FC] p-5 text-left"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={16}/><p className="text-xs font-extrabold">Data sertifikat terverifikasi</p></div><p className="mt-4 text-[10px] text-[#A49CB3]">Diberikan kepada</p><p className="mt-1 text-lg font-extrabold text-[#2C2342]">{result.full_name}</p><p className="mt-4 text-[10px] text-[#A49CB3]">Program pembelajaran</p><p className="mt-1 text-sm font-bold text-[#45395E]">{result.course_title}</p><div className="mt-4 grid gap-3 border-t border-[#EEEAF5] pt-4 sm:grid-cols-2"><div><p className="text-[9px] text-[#A49CB3]">Nomor sertifikat</p><p className="mt-1 break-all text-xs font-bold text-violet-700">{result.certificate_number}</p></div><div><p className="text-[9px] text-[#A49CB3]">Tanggal terbit</p><p className="mt-1 text-xs font-bold text-[#45395E]">{issuedDate}</p></div><div><p className="text-[9px] text-[#A49CB3]">Mentor</p><p className="mt-1 text-xs font-bold text-[#45395E]">{result.mentor_name}</p></div><div><p className="text-[9px] text-[#A49CB3]">Penerbit</p><p className="mt-1 text-xs font-bold text-[#45395E]">{result.issuer_name}</p></div></div></div>}{error && <p className="mt-4 text-[10px] text-rose-600">{error.message}</p>}<Link href="/" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-xs font-bold text-white"><Award size={15}/> Kiki Creator Class</Link></section></main>;
}
