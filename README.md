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

Lihat `docs/UI-REDESIGN-NOTES.md` untuk ringkasan penyempurnaan UI/UX dan `SKILL.md` untuk standar desain wajib proyek.

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

## Penyempurnaan UI/UX — November 2026

Paket ini juga memuat penyempurnaan tampilan lintas halaman berdasarkan `SKILL.md`:

- `src/app/design-system.css` sekarang dimuat secara global setelah `globals.css`.
- Admin dan Mentor memakai wrapper workspace tersendiri agar aturan visual tetap terlingkup.
- Halaman publik, katalog, detail kelas, autentikasi, checkout, dan verifikasi sertifikat memiliki scope desain masing-masing.
- Header workspace disederhanakan; label dekoratif berbahasa Inggris dan badge role yang berulang dihilangkan.
- Label kelompok navigasi Admin dan Mentor menggunakan Bahasa Indonesia.
- Dashboard Mentor diringkas dengan menghilangkan kumpulan tautan cepat yang mengulang navigasi sidebar.
- Dashboard Admin memakai ringkasan yang lebih ringkas; hitungan `profiles` diberi label `Total Akun`, bukan `Total Member`.
- Kontrol formulir, tabel, fokus keyboard, radius, bayangan, dan tampilan mobile diselaraskan.

Perubahan ini berfokus pada presentasi dan teks antarmuka. Tidak ada migration database, perubahan skema, perubahan RLS, atau perubahan kontrak API yang dibuat dalam penyempurnaan UI ini.

### Pemeriksaan paket UI

- 122 file TypeScript/TSX diproses dengan parser TypeScript: tidak ditemukan kesalahan sintaks.
- Import lokal diperiksa: tidak ditemukan path import lokal yang hilang.
- Kurung kurawal tiga stylesheet utama diperiksa: seimbang.
- `npm ci` tidak selesai dalam batas waktu lingkungan penyusunan karena proses instalasi dependensi timeout. Karena itu `next build`, ESLint penuh, dan pengujian browser belum dapat dinyatakan lulus. Jalankan pemeriksaan tersebut di komputer lokal setelah `npm ci` berhasil.

`SKILL.md` disertakan di root proyek sebagai standar desain untuk perubahan berikutnya.
