# Audit dan Perubahan Source — Kiki Creator Class

Tanggal pengerjaan: 6 November 2026

## 1. Perubahan yang diterapkan

### Mini materi
- Mini materi tidak lagi dirender seluruhnya dalam daftar panjang.
- Hanya satu segmen aktif yang dimuat pada satu waktu.
- Desktop menggunakan player dan playlist ringkas di sisi kanan.
- Tablet/HP memakai tombol daftar mini materi dan bottom sheet.
- Tombol Sebelumnya/Selanjutnya tersedia untuk berpindah segmen.
- Pemutar TikTok/YouTube dan resource file hanya dimount ketika segmen dipilih. Ini mengurangi embed yang dimuat bersamaan.
- Semua jenis konten yang sebelumnya didukung tetap dipertahankan: teks, TikTok, YouTube, gambar, PDF, audio, tautan, dan callout.
- Penyelesaian materi inti tetap memakai mekanisme progress yang sudah ada; tidak dibuat status selesai mini materi palsu karena source/database yang diberikan belum memiliki tabel progress per segmen.

### Identitas dan visual
- Teks brand `Creative Platform` dan `Kiki Creator Design` pada source diganti menjadi `Kiki Creator Class`.
- Metadata browser diperbarui.
- Palet global diarahkan ke ungu tua dan biru navy dengan permukaan netral.
- Sidebar admin dan mentor diperbarui menjadi gradasi gelap, dengan logo `/logo_brand.png`.
- Tombol logout ditambahkan pada header admin, mentor, dashboard peserta, dan ruang belajar.

### Registrasi dan data peserta
- Form registrasi ditambah nomor WhatsApp, alamat domisili, sumber mengetahui kelas, dan tujuan mengikuti kelas.
- Data tambahan disimpan pada Auth metadata dan disinkronkan ke tabel `profiles` melalui RPC yang dibatasi ke `auth.uid()`.
- Admin dapat melihat detail pendaftaran pada panel detail member.
- Kolom tambahan dan RPC disediakan melalui migration additive. Data profil lama tidak dihapus.

### Aktivitas dan analisis
- Tracker mencatat page view untuk pengguna yang sudah login.
- Ruang belajar mencatat pembukaan materi, pembukaan tugas, dan penyelesaian materi.
- Halaman Analisis Platform dan Log Aktivitas ditambahkan.
- Ringkasan pengguna aktif dihitung berdasarkan aktivitas yang tercatat dalam 24 jam terakhir. Ini bukan status online realtime.
- Migration membuat tabel aktivitas dengan RLS: pengguna hanya dapat memasukkan event atas user_id sendiri; pembacaan log dibatasi untuk admin.

### Menu admin
- Hak Akses Member diaktifkan dengan memakai kembali pengelola member/enrollment yang sudah ada.
- Pendapatan diaktifkan dengan perhitungan dari pesanan berstatus `paid`.
- Analisis Platform dan Log Aktivitas diaktifkan dengan tabel aktivitas baru.
- Promo & Voucher dan Pengaturan tetap dinonaktifkan karena source yang diberikan tidak menyertakan halaman CRUD admin dan schema/migration yang dapat diverifikasi untuk kedua modul tersebut. Mengaktifkan link tanpa implementasi akan menghasilkan halaman kosong atau error.

## 2. Temuan dari audit source

- Sebelum perubahan, komponen mini materi melakukan `.map()` atas semua `publishedContents`, sehingga semua player/embed ikut dirender.
- Source awal belum memiliki komponen logout (`auth.signOut`) di workspace.
- Form registrasi awal hanya meminta nama, email, password, dan konfirmasi password.
- Beberapa menu admin menunjuk ke route yang tidak ada pada ZIP.
- Source telah memiliki role `admin`, `instructor`, dan `member`, serta pemeriksaan role pada layout admin/mentor.
- Halaman belajar memeriksa autentikasi, kelas berstatus published, dan enrollment aktif sebelum menampilkan materi.
- Endpoint PDF sertifikat memeriksa kepemilikan sertifikat atau role admin.
- Detail mentor pada halaman publik kelas sudah memiliki jalur melalui RPC `get_public_course_mentor_profiles`, dengan fallback nama/bio dari data kelas.

## 3. Yang belum dapat diverifikasi / perlu dilengkapi

1. **Build dan type-check penuh belum dapat dijalankan.** ZIP awal tidak berisi `package.json`, `tsconfig.json`, konfigurasi Next.js, maupun dependency. Pemeriksaan sintaks TypeScript/TSX dan resolusi import lokal pada source yang tersedia berhasil tanpa error, tetapi ini bukan pengganti `npm run build`.
2. **RLS tabel lama belum dapat diaudit.** Migration dan policy untuk `profiles`, `courses`, `lessons`, `lesson_contents`, `enrollments`, `course_tasks`, `course_task_submissions`, sertifikat, dan tabel mentor tidak disertakan. Perlu audit langsung pada database Supabase.
3. **Pembuatan akun member oleh admin belum ditambahkan.** Pengelola member yang tersedia dapat mengelola akun dan enrollment yang sudah ada. Pembuatan akun Auth baru oleh admin memerlukan server route yang memakai Supabase service-role key secara aman; key tersebut tidak boleh dipasang di browser.
4. **Promo & Voucher** memiliki pemanggilan RPC di checkout (`apply_course_promo` dan `remove_course_promo`), tetapi schema dan fungsi administrasi promo tidak tersedia pada ZIP. Halaman admin belum aman dibuat hanya dengan menebak nama tabel.
5. **Pengaturan platform** belum memiliki schema atau halaman yang dapat dijadikan dasar.
6. **Logo** tidak ada di ZIP yang dikirim. Pastikan `public/logo_brand.png` tersedia pada proyek utama.
7. **Retensi log aktivitas** belum dijadwalkan. Tabel akan terus bertambah; setelah masa uji, tentukan retensi dan jadwal pembersihan log.
8. Detail registrasi baru akan terlihat pada profil admin setelah migration dijalankan. Pengguna lama akan menampilkan keterangan data belum diisi.

## 4. Migration yang wajib dijalankan

Jalankan berurutan melalui Supabase SQL Editor:

1. `20261106_member_registration_details.sql`
2. `20261106_platform_activity_logs.sql`

Kedua migration bersifat additive; tidak menghapus tabel atau data lama.
