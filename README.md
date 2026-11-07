# Kiki Creator Class — Audit 1 Follow-up

Paket ini berisi source proyek lengkap berdasarkan Revisi 12 + perbaikan pemisahan role Audit 1 + perbaikan navigasi katalog/checkout dari hasil pengujian browser.

## Isi perubahan follow-up

- Katalog `/kelas` tetap publik agar pengunjung dapat melihat kelas.
- Katalog mengenali sesi aktif dan menampilkan tombol sesuai role: Workspace Admin, Workspace Mentor, atau Dashboard Peserta. Tombol Masuk/Daftar hanya ditampilkan untuk pengunjung anonim.
- Detail kelas mengarahkan Admin/Mentor kembali ke workspace masing-masing, Peserta yang sudah login langsung ke `/checkout?course=<UUID>`, dan pengunjung anonim ke pendaftaran dengan ID kelas tetap dibawa.
- Checkout tanpa parameter `course` tetap dikembalikan ke katalog karena belum ada kelas yang dipilih.

## Cara memasang

1. Backup folder proyek yang sedang digunakan.
2. Ekstrak ZIP ini ke folder sementara.
3. Salin folder `src/` dari hasil ekstrak ke proyek, lalu izinkan penggantian file.
4. Pertahankan `.env.local` dan `node_modules` milik proyek lokal. Jangan mengunggah atau membagikan `.env.local`.
5. Restart server: hentikan `npm run dev`, lalu jalankan kembali `npm run dev`.
6. Jika browser masih menampilkan tampilan lama, lakukan hard refresh (`Ctrl + Shift + R`).

## Skenario uji follow-up

1. Login sebagai Mentor, buka `/kelas`: katalog boleh tampil, header harus menampilkan `Workspace Mentor`, bukan Masuk/Daftar.
2. Login sebagai Peserta, buka `/kelas`: header harus menampilkan `Dashboard Peserta`, bukan Masuk/Daftar.
3. Login sebagai Peserta, buka detail kelas, klik `Lanjut ke Checkout`: URL harus memuat `?course=<UUID>` dan halaman checkout harus memuat kelas yang benar.
4. Login sebagai Peserta, buka `/checkout` tanpa parameter: kembali ke katalog adalah perilaku yang diharapkan; header katalog harus tetap menampilkan `Dashboard Peserta`.
5. Ulangi logout, Back browser, dan akses URL privat untuk memastikan halaman privat tidak dapat digunakan setelah logout.

Lihat `AUDIT-1-ROLE-ACCESS-FIX.md` untuk matriks role, pemeriksaan teknis, batas audit, dan catatan keamanan database.

**Catatan:** SQL/RLS/RPC/trigger/Storage belum termasuk dalam paket ini dan akan diperiksa pada audit database terpisah. Build dan lint penuh juga perlu dijalankan pada komputer proyek setelah dependensi terpasang.
