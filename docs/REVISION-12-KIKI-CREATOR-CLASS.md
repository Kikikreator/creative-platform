# Kiki Creator Class — Paket Revisi 12 Permintaan

Paket ini berisi revisi source berdasarkan ZIP proyek yang diberikan. Tidak ada migration SQL baru dan tidak ada perubahan data Supabase.

## Perubahan yang diterapkan

1. **Warna global** — menetapkan palet putih, ungu gelap `#260047`, dan hijau gelap `#09483F`. Menambahkan lapisan kompatibilitas untuk menormalkan kelas Tailwind/hex lama agar warna ungu terang/fuchsia/indigo tidak lagi tersebar tidak konsisten.
2. **Logout Admin dan Mentor** — memindahkan tombol Keluar dari header ke bagian bawah sidebar. Saat sidebar diciutkan, tombol menjadi ikon saja.
3. **Proteksi navigasi dan sesi** — route privat `/admin`, `/mentor`, `/dashboard`, `/checkout`, dan ruang belajar kelas meminta sesi valid di `proxy.ts`. Layout Admin/Mentor tetap memeriksa role di server. Halaman `/` mengarahkan pengguna yang masih login kembali ke workspace sesuai role, sehingga pengguna harus logout untuk melihat landing page. Route privat diberi header `no-store` untuk mengurangi risiko halaman privat tampil dari cache setelah logout.
4. **Login** — menambah padding input yang terkontrol agar placeholder tidak menempel ke tepi maupun terlalu masuk; menyesuaikan warna ke palet baru; pengguna yang masih login diarahkan ke workspace.
5. **Landing page** — menambahkan ilustrasi dekoratif berlapis dengan ikon Palette, PenTool, Layers, dan Shapes agar area hero terasa lebih hidup tanpa menambah dependensi gambar eksternal.
6. **Detail kelas** — menata tinggi area harga dan ukuran teks harga agar lebih konsisten; menambahkan informasi syarat penerbitan sertifikat.
7. **Sidebar collapse** — ketika sidebar diciutkan, logo menjadi tombol pembuka; ikon buka muncul saat hover. Ketika terbuka, tombol ciutkan berada di baris logo.
8. **Menu yang belum aktif** — menu yang sudah memiliki halaman tetap tersedia. `Promo & Voucher` dan `Pengaturan` masih dinonaktifkan karena route dan fondasi penyimpanannya belum tersedia pada source yang diberikan. Menu tersebut sengaja tidak diaktifkan sebagai tautan kosong. Aktivasi fungsional memerlukan tahap database setelah audit SQL.
9. **Tanda selesai materi** — materi inti yang telah ditandai selesai menampilkan ceklis di sisi kanan daftar kurikulum. Mini materi memiliki tombol “Tandai selesai” dan ceklis di playlist. Status mini materi sementara disimpan di localStorage per akun dan kelas; belum tersinkron lintas perangkat/database sampai struktur SQL diaudit.
10. **Informasi sertifikat** — copy pada panel sertifikat peserta dan detail kelas menjelaskan penyelesaian materi wajib, tugas Bab, tugas akhir, persetujuan Mentor, serta rating dan ulasan.
11. **Scrollbar sidebar** — scrollbar visual disembunyikan, tetapi sidebar tetap dapat digulir jika item menu melebihi tinggi layar.
12. **Responsivitas** — mempertahankan bottom navigation mobile, memperbaiki area teks agar tidak memaksa lebar card, dan menjaga tombol serta input lebih nyaman disentuh.

## File utama yang diubah

- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/kelas/[slug]/page.tsx`
- `src/app/kelas/[slug]/belajar/learning-room.tsx`
- `src/components/auth/logout-button.tsx`
- `src/components/admin/admin-sidebar.tsx`
- `src/components/admin/admin-header.tsx`
- `src/components/admin/admin-shell.tsx`
- `src/components/mentor/mentor-sidebar.tsx`
- `src/components/mentor/mentor-header.tsx`
- `src/components/mentor/mentor-shell.tsx`
- `src/components/certificates/course-certificate-panel.tsx`
- `src/proxy.ts`

## Pemeriksaan yang berhasil

- 85 file TypeScript/TSX dipindai dengan parser TypeScript: **0 syntax error**.
- 122 import lokal diperiksa: **0 import lokal hilang**.
- `globals.css` dipindai dengan parser CSS: **0 parse error**.

## Batas pemeriksaan

- `npm ci` tidak berhasil diselesaikan di lingkungan pemeriksaan karena paket dari npm registry tidak dapat diunduh dalam batas waktu yang tersedia. Karena itu `next build`, ESLint penuh, dan pemeriksaan tipe lengkap belum dapat dinyatakan lulus.
- SQL/RLS, RPC, trigger, dan Storage sengaja belum diubah atau diaudit pada tahap ini sesuai arahan pengguna. Pemeriksaan keamanan database dijadwalkan setelah revisi source ini diuji.
- Status selesai mini materi saat ini tersimpan lokal di browser. Agar sinkron antarperangkat dan menjadi sumber progres yang tepercaya untuk sertifikat, perlu dibuat/ditinjau tabel dan RPC setelah audit SQL.
- `Promo & Voucher` dan `Pengaturan` masih nonaktif sampai route, penyimpanan, dan validasi servernya dirancang. Tidak ada tautan palsu yang dibuat.

## Cara memasang

1. Backup folder proyek yang sekarang.
2. Ekstrak ZIP revisi ke folder sementara.
3. Gabungkan folder `src/` dan `public/` dengan proyek yang sedang digunakan; pertahankan konfigurasi lokal dan `.env.local` milikmu.
4. Jangan menimpa atau menghapus `.env.local`.
5. Jalankan `npm install` jika dependency belum terpasang, lalu `npm run dev`.
6. Uji logout, akses role, landing, login, detail kelas, serta tanda selesai materi.

Tidak ada SQL yang perlu dijalankan untuk paket revisi ini.
