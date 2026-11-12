import { redirect } from "next/navigation";

/**
 * Halaman Hak Akses Member sudah digabung ke Pengguna & Akses.
 * Pertahankan route lama sebagai redirect agar bookmark/link lama tidak 404.
 */
export default function AdminAccessRedirectPage(): never {
  redirect("/admin/pengguna");
}
