# Audit & Perbaikan Kiki Creator Class
Tanggal pengerjaan: 6 November 2026

## Ringkasan

Source code yang dikirim dipertahankan sebagai basis. Perubahan dilakukan secara bertahap dan tidak menghapus tabel atau data lama. Folder `public` (termasuk logo) dan struktur proyek asli tetap dipertahankan.

## Perbaikan yang sudah diterapkan pada source

### Identitas dan tampilan
- Sistem warna diseragamkan ke putih, ungu gelap `#260047`, dan hijau gelap `#09483F`.
- Gradient ungu terang/fuchsia lama diarahkan ke kombinasi ungu gelap dan aksen hijau.
- Landing page mendapat elemen dekoratif bergaya 3D menggunakan ikon dan transform CSS, tanpa menambah dependensi gambar.
- Form login mendapat jarak teks/placeholder yang lebih nyaman.
- Kartu harga di halaman detail kelas dirapikan.
- Detail kelas menampilkan preview kurikulum berupa bab, judul materi, dan jumlah mini materi dalam keadaan terkunci. Preview tidak membocorkan URL file atau konten privat.
- Informasi syarat sertifikat ditampilkan pada detail kelas.
- Sidebar admin dan mentor memakai logo sebagai kontrol buka saat sidebar diciutkan; ikon buka muncul ketika logo diarahkan kursor.
- Scrollbar visual sidebar disembunyikan, tetapi area menu tetap dapat digulir.
- Tombol Keluar admin dan mentor dipindahkan ke bagian bawah sidebar. Tombol Keluar peserta tetap berada di area header.
- Logout menangani kegagalan sign-out dan baru mengarahkan pengguna setelah sign-out berhasil.

### Akses dan alur akun
- Pengguna yang masih memiliki sesi aktif diarahkan ke workspace berdasarkan role saat membuka `/`.
- Halaman login dan registrasi memeriksa sesi aktif agar pengguna tidak membuat sesi/akun kedua secara tidak sengaja.
- Parameter `redirect` pada login diperiksa agar hanya menerima path internal, bukan URL eksternal.
- Endpoint diagnostik Supabase dibatasi untuk administrator dan tidak lagi mengirim pesan error database mentah ke pengunjung.
- Form registrasi mengikuti pengaturan buka/tutup pendaftaran dan dapat menampilkan pengumuman publik dari admin.

### Pembelajaran peserta
- Mini materi tetap memakai pola satu segmen aktif pada satu waktu; daftar segmen menjadi playlist, bukan menampilkan seluruh video sekaligus.
- Setiap mini materi memiliki tombol **Tandai selesai** dan indikator centang.
- Materi utama menampilkan centang di sisi kanan ketika sudah selesai.
- Materi berikutnya dikunci di UI sampai materi sebelumnya selesai.
- Tombol menyelesaikan materi utama menunggu semua mini materi pada materi tersebut selesai.
- Progres mini materi disimpan melalui RPC baru, bukan hanya state browser.
- Panel sertifikat yang sudah ada tetap dipertahankan; informasi sertifikat juga ditampilkan pada halaman detail kelas.

### Admin dan pemantauan
- Menu Promo & Voucher dan Pengaturan sekarang memiliki halaman aktif, tidak lagi ditandai “Soon”.
- Dashboard admin mendapat shortcut tambahan ke tugas, mentor, sertifikat, transaksi, analisis, promo, dan pengaturan.
- Halaman Pengaturan mengelola nomor WhatsApp dukungan, email dukungan, status pendaftaran, dan pengumuman publik.
- Nomor WhatsApp dari pengaturan digunakan pada checkout dan halaman status pesanan.
- Analisis aktivitas menghitung pengguna aktif berdasarkan hari kalender lokal perangkat admin, bukan rolling 24 jam.
- Aktivitas belajar mini materi dicatat sebagai event penyelesaian materi dengan metadata khusus.

## Catatan khusus Promo & Voucher

Checkout pada source sudah memanggil RPC `apply_course_promo` dan `remove_course_promo`. Namun, ZIP awal tidak menyertakan migrasi SQL yang mendefinisikan tabel promo dan kedua RPC tersebut. Karena itu, halaman `/admin/promo` dibuat aktif dalam mode baca riwayat promo yang tercatat pada pesanan. Halaman ini **belum melakukan CRUD kode promo**.

Saya sengaja tidak membuat tabel promo duplikat atau mengganti RPC promo yang mungkin sudah digunakan database produksi. Pengelolaan kode promo baru dapat disambungkan setelah definisi tabel dan RPC yang sudah ada diperiksa melalui audit SQL.

## File database yang disertakan

### Migration utama
`supabase/migrations/20261106_kcc_platform_features.sql`

Migration ini bersifat additive:
- Membuat tabel `course_lesson_content_progress`.
- Membuat RPC `mark_course_lesson_content_complete`.
- Membuat RPC publik terbatas `get_public_course_curriculum_preview` yang hanya mengembalikan judul dan jumlah mini materi dari kelas yang dipublikasikan.
- Membuat tabel proyek `kcc_platform_settings` untuk pengaturan kontak dan pendaftaran.
- Mengaktifkan RLS dan menambahkan policy untuk tabel baru.

Migration utama **tidak mengganti** RPC lama seperti `mark_course_lesson_complete`, `apply_course_promo`, atau `remove_course_promo`.

### Optional hardening
`supabase/optional/20261106_kcc_lesson_progress_guard.sql`

File ini menambahkan trigger untuk memaksa penyelesaian mini materi dan urutan materi di sisi database. **Jangan jalankan dulu** sebelum definisi RPC lama `mark_course_lesson_complete` dan struktur tabel `course_lesson_progress` diperiksa. Trigger sengaja dipisahkan agar tidak mengubah alur produksi tanpa pemeriksaan.

Sampai optional trigger ini diverifikasi dan dijalankan, urutan materi berikutnya dikunci pada UI. Penyimpanan tanda selesai mini materi sendiri sudah divalidasi server-side melalui RPC baru, termasuk pemeriksaan enrollment aktif dan status publikasi konten.

### Audit SQL read-only
`supabase/audit/20261106_security_audit_read_only.sql`

Jalankan untuk memeriksa:
- Status RLS tabel aplikasi.
- Policy SELECT/INSERT/UPDATE/DELETE.
- Fungsi SECURITY DEFINER dan definisi RPC sensitif.
- Hak akses tabel untuk `anon` dan `authenticated`.
- Bucket Storage dan policy file.

File ini hanya membaca metadata database dan tidak mengubah data.

## Temuan keamanan dan batas audit

### Yang dapat diverifikasi dari source
- Tidak ditemukan `.env`, service-role key, token JWT, atau kredensial database di source yang dikirim.
- Layout admin memeriksa sesi dan role admin.
- Layout mentor memeriksa sesi dan role pengajar.
- Dashboard peserta, checkout, ruang belajar, dan unduhan sertifikat memiliki pemeriksaan autentikasi/akses pada source.
- Endpoint diagnostik Supabase kini admin-only.
- Tidak ada route tujuan sidebar admin/mentor yang hilang; semua tujuan menu memiliki `page.tsx`.

### Yang belum dapat dipastikan
ZIP awal tidak menyertakan folder `supabase/migrations` atau definisi SQL database lama. Karena itu, saya belum bisa menyatakan RLS dan seluruh RPC lama aman. Source code saja tidak cukup untuk memastikan policy database, trigger, grant, dan isi fungsi `SECURITY DEFINER`.

Sebelum menyatakan audit keamanan database selesai, jalankan file audit read-only dan kirim hasilnya. Jangan menempelkan secret, password, service-role key, atau data pribadi peserta.

### Akun member lama
Menu Pengguna & Akses dapat digunakan untuk memberikan akses kelas kepada akun peserta yang sudah ada di Supabase Auth. Membuat akun Auth baru langsung dari panel admin membutuhkan Edge Function/server-side service-role yang aman; jangan pernah menaruh service-role key di browser atau source client.

### Penandaan video selesai
Embed YouTube/TikTok tidak selalu memberikan event selesai tonton yang dapat dipercaya lintas platform. Karena itu, tombol **Tandai selesai** adalah konfirmasi manual peserta. Progresnya tetap disimpan di database.

### Status build
- Pemeriksaan sintaks TypeScript/TSX: **88 file diperiksa, 0 syntax error**.
- `npm ci` dan build Next.js penuh belum berhasil dijalankan di lingkungan audit karena akses registry npm mengalami kegagalan DNS (`EAI_AGAIN`). Ini bukan bukti build berhasil maupun gagal.
- Jalankan `npm ci`, `npm run lint`, dan `npm run build` pada komputer proyek sebelum deploy.

## Urutan pengujian yang disarankan

1. Backup database Supabase.
2. Jalankan `supabase/audit/20261106_security_audit_read_only.sql` terlebih dahulu dan simpan hasilnya.
3. Cocokkan definisi RPC lama, terutama `mark_course_lesson_complete`, `apply_course_promo`, dan `remove_course_promo`.
4. Setelah skema lama cocok, jalankan migration utama `supabase/migrations/20261106_kcc_platform_features.sql`.
5. Jangan jalankan optional hardening sampai definisi RPC lama diperiksa.
6. Jalankan lokal:
   - `npm ci`
   - `npm run lint`
   - `npm run build`
   - `npm run dev`
7. Uji alur admin → mentor → peserta, checkout, mini materi, tugas, rating/ulasan, dan unduhan sertifikat.

## Skenario uji manual

- Pengunjung: landing page, katalog, detail kelas, preview kurikulum terkunci, profil mentor.
- Admin: seluruh menu sidebar, Pengaturan, riwayat Promo, transaksi, log aktivitas, logout.
- Mentor: kelas yang ditugaskan, materi, publikasi, review tugas, profil, logout.
- Peserta: registrasi, login, kelas aktif, playlist mini materi, tanda selesai, urutan materi, tugas, rating/ulasan, persetujuan mentor, sertifikat.
- Responsif: desktop, tablet, dan HP; periksa tombol panjang, form, sidebar, dan video vertikal.
