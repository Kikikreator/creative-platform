# Kiki Creator Class — Pengajuan Materi Mentor per Bab (v3)

## Perubahan utama

Alur publikasi diubah dari pengajuan per Bab/Materi Inti/Mini Materi secara terpisah menjadi **satu pengajuan untuk satu Bab lengkap**.

Mentor sekarang dapat:
- Membuat Bab sebagai draft.
- Menambah dan mengedit banyak Materi Inti tanpa menunggu Admin.
- Menambah dan mengedit Mini Materi untuk setiap Materi Inti.
- Mengunggah file ke penyimpanan proposal.
- Menyimpan draft, berpindah halaman, lalu melanjutkan pekerjaan.
- Mengajukan satu Bab sekaligus setelah semua isinya siap.
- Memperbaiki draft jika Admin meminta revisi.

Admin sekarang dapat:
- Melihat satu pengajuan Bab dengan seluruh Materi Inti dan Mini Materi.
- Membaca isi teks, membuka tautan video, gambar, PDF, audio, dan file pendukung.
- Melihat versi resmi saat ini untuk pengajuan perubahan.
- Menyetujui seluruh Bab secara atomik atau meminta revisi.
- Tetap mengedit, mengurutkan, memublikasikan, menarik publikasi, dan menghapus materi melalui `/admin/materi`.

Materi resmi peserta tidak berubah ketika Mentor menyimpan draft atau mengajukan Bab. Perubahan baru diterapkan setelah Admin menyetujui.

## File source yang berubah

- `app/mentor/materi/mentor-content-manager.tsx`
- `app/mentor/publikasi/page.tsx`
- `app/mentor/publikasi/publication-list.tsx`
- `app/admin/mentor/publikasi/page.tsx`
- `app/admin/mentor/publikasi/review-manager.tsx`

## PENTING — urutan penerapan

Pengguna telah menjalankan migration sebelumnya `20261106_mentor_content_version_workflow.sql`. **Jangan jalankan ulang migration lama tersebut.**

1. Backup database Supabase terlebih dahulu. Project yang tampak pada screenshot berada di branch `main / PRODUCTION`; pastikan backup tersedia sebelum mengubah database produksi.
2. Buka Supabase Dashboard → SQL Editor pada project yang sama.
3. Jalankan seluruh isi file `20261106_mentor_chapter_submission_workflow.sql` satu kali.
4. Pastikan hasilnya `Success` tanpa error.
5. Backup folder source Next.js lokal.
6. Salin lima file source di atas dari paket v3 ke lokasi yang sama di project lokal. Jangan mengganti `.env.local`.
7. Jalankan aplikasi lokal dan uji alur terlebih dahulu sebelum deploy.

Migration v3 bersifat tambahan. Migration ini membuat tabel draft Bab dan tabel riwayat pengajuan Bab; tidak menghapus tabel materi resmi maupun riwayat `mentor_publication_requests` lama. Jika masih ada pengajuan lama berupa penambahan Bab yang menunggu Admin, migration akan memindahkannya menjadi draft Bab agar Mentor dapat melanjutkan isi Bab. Pengajuan lama per-item lainnya ditandai perlu diajukan ulang dengan alur Bab lengkap.

## Struktur data baru

- `mentor_chapter_drafts`: workspace draft yang dapat disimpan dan diedit Mentor.
- `mentor_chapter_submissions`: snapshot pengajuan yang tidak berubah selama proses review.
- `get_mentor_course_chapter_snapshots`: mengambil baseline resmi yang konsisten untuk mendeteksi perubahan Admin.
- `save_mentor_chapter_draft`: menyimpan satu paket Bab sebagai draft.
- `submit_mentor_chapter_draft`: membuat satu pengajuan lengkap per Bab.
- `review_mentor_chapter_submission`: meminta revisi atau menerapkan seluruh Bab setelah persetujuan Admin.

RLS tetap membatasi Mentor agar tidak dapat menulis langsung ke `course_sections`, `lessons`, atau `lesson_contents`. Penulisan materi resmi dilakukan oleh RPC review dengan hak Admin dan pemeriksaan konflik snapshot.

## Skenario uji wajib

1. Login sebagai Mentor dan buka `/mentor/materi`.
2. Buat satu Bab baru. Pastikan Bab berstatus `Draft tersimpan`, belum muncul di antrean Admin, dan peserta belum melihat Bab tersebut.
3. Tambahkan minimal dua Materi Inti dengan beberapa Mini Materi (teks, video, atau file). Pastikan semua perubahan tersimpan sebagai draft tanpa pengajuan otomatis.
4. Refresh halaman. Pastikan seluruh draft dan isi Bab tetap muncul.
5. Klik `Ajukan Bab`. Pastikan hanya satu pengajuan dibuat untuk Bab tersebut.
6. Login sebagai Admin dan buka `/admin/mentor/publikasi`. Pastikan seluruh Bab, Materi Inti, Mini Materi, isi teks, dan tautan/file dapat diperiksa.
7. Minta revisi dengan catatan. Pastikan materi resmi peserta tetap tidak berubah dan Mentor dapat mengedit draft.
8. Ajukan ulang Bab. Setujui dari Admin. Pastikan semua isi diterapkan sekaligus ke kurikulum resmi.
9. Buka `/admin/materi`, edit salah satu isi yang baru disetujui. Pastikan Admin tetap memiliki kendali penuh.
10. Uji konflik: buat perubahan draft dan ajukan, lalu ubah materi resmi melalui `/admin/materi` sebelum menyetujui pengajuan. Persetujuan pengajuan lama harus ditolak dengan pesan konflik, bukan menimpa perubahan Admin.
11. Uji hak akses: dari sesi Mentor, percobaan `insert/update/delete` langsung ke tabel materi resmi harus ditolak oleh RLS.

## Status verifikasi paket

- Lima file TSX yang berubah lolos pemeriksaan transpile TypeScript/JSX.
- Full Next.js build belum dijalankan karena paket source yang tersedia tidak menyertakan `package.json`, lockfile, dan dependency project.
- SQL migration belum dieksekusi di database pengguna dari lingkungan ini. Jalankan di SQL Editor dan kirim pesan error jika muncul agar bisa diperbaiki sebelum deploy.
- Jangan anggap alur sudah teruji sampai skenario di atas berhasil pada project lokal dan Supabase.
