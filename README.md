# Kiki Creator Class — Revisi Website

Project source hasil penggabungan `src(9).zip`, `public.zip`, dan file konfigurasi yang telah diberikan, beserta pembaruan untuk sembilan revisi Kiki Creator Class, penguatan rekonsiliasi ledger, dan laporan audit akhir.

## Teknologi

- Next.js App Router 16
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase Auth + PostgreSQL + Storage
- Lucide React

## Menjalankan secara lokal

1. Pertahankan `.env.local` milik project asli. File tersebut tidak disertakan dalam paket ini.
2. Pastikan variabel berikut tersedia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Jalankan `npm ci`.
4. Jalankan `npm run dev`.
5. Buka `http://localhost:3000`.

Sebelum deployment, jalankan `npm run lint` dan `npm run build` pada komputer yang memiliki akses ke npm registry.

## Perubahan tambahan

Lihat `docs/REVISION-9-IMPLEMENTATION.md` untuk daftar sembilan revisi dan implementasinya, serta `docs/FINAL_AUDIT_20261109.md` untuk hasil pemeriksaan dan batas pengujian.

## Migrasi database

Folder `supabase/` berisi migration, audit read-only, dan preflight. **Jangan jalankan seluruh file secara berurutan tanpa memeriksa database terlebih dahulu.** Database produksi tidak diakses atau diubah dari proses penyusunan paket ini.

Urutan aman:

1. Buat backup Supabase.
2. Jalankan `supabase/audit/20261106_security_audit_read_only.sql` dan simpan hasilnya.
3. Jalankan `supabase/audit/20261109_revenue_preflight.sql`. Jika kolom atau fungsi prasyarat tidak lengkap, hentikan dan sesuaikan migration sebelum dijalankan.
4. `20261106_mentor_content_version_workflow.sql` berada di `supabase/previously-applied/` sebagai arsip. Pengguna telah menjalankannya; **jangan jalankan ulang**.
5. Periksa apakah tabel/fungsi dari `20261106_mentor_chapter_submission_workflow.sql` sudah ada. Jika belum, jalankan file di `supabase/migrations/` satu kali. README v3 sebelumnya menyatakan migration ini belum dijalankan pada saat paket v3 disiapkan.
6. Periksa apakah fungsi `get_public_course_curriculum` dan `get_public_course_review_summary` sudah ada. Jika belum, jalankan `20261106_public_course_landing_data.sql` satu kali.
7. Setelah prasyarat database cocok, jalankan `20261109_mentor_revenue_and_withdrawals.sql` satu kali.
8. Jalankan kembali audit read-only dan uji alur Admin → Mentor → Peserta sebelum deployment.

### Aturan bagi hasil

- Admin menetapkan kelas dan Mentor penerima bagi hasil melalui **Manajemen Mentor**.
- Satu kelas hanya dapat memiliki satu Mentor penerima bagi hasil aktif.
- Mentor yang disepakati menerima 80%; platform menerima 20%.
- Pendapatan dicatat hanya saat pesanan berstatus `paid` dan enrollment peserta pada kelas tersebut berstatus `active`.
- Dasar hitung memakai total invoice setelah diskon, dialokasikan proporsional ke item kelas. Biaya payment provider tidak dikurangi pada migration ini.
- Mentor tidak dapat menulis ledger, mengubah saldo, atau mengubah status pengajuan penarikan langsung dari browser. Database menghitung saldo dan memvalidasi permintaan.

### File database yang tidak disertakan

Audit historis menyebut migration `20261106_kcc_platform_features.sql` dan optional hardening `20261106_kcc_lesson_progress_guard.sql`, tetapi file SQL tersebut tidak tersedia pada snapshot project dan file Library yang dapat diakses pada sesi ini. Keduanya tidak direka ulang atau diganti agar tidak berisiko menimpa fungsi/database produksi. Fitur yang membutuhkan definisi SQL lama harus diverifikasi melalui audit database.

## Pengujian yang dilakukan pada paket

- Pemeriksaan sintaks TypeScript/TSX dengan parser TypeScript.
- Pemeriksaan import lokal.
- Pemeriksaan keberadaan route `page.tsx` untuk navigasi utama.
- Pemeriksaan struktur SQL secara statis dan preflight kolom.

`npm ci` tidak dapat diselesaikan di lingkungan penyusunan karena akses ke npm registry mengalami timeout. Karena itu, `next build`, ESLint penuh, dan type-check penuh belum dapat dinyatakan lulus. Migration SQL juga belum dijalankan di Supabase.
