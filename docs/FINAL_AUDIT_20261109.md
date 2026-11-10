# Final Audit — Kiki Creator Class

Tanggal: 9 November 2026

## Ruang lingkup

Paket ini menggabungkan source `src(9).zip`, aset `public.zip`, konfigurasi project yang diberikan, revisi UI sebelumnya, dan implementasi sembilan permintaan terbaru. File `.env.local` dan kredensial tidak disertakan.

## Implementasi yang tersedia di source

1. Konsistensi skala tipografi, heading, label, tombol, input, modal, border, fokus keyboard, dan jarak komponen melalui `src/app/globals.css`.
2. Navigasi responsif Admin/Mentor dengan bottom navigation mobile dan akses menu tambahan melalui drawer.
3. Pengaturan penugasan kelas dipusatkan di `/admin/mentor`; halaman tugas hanya menampilkan penugasan yang sudah dibuat.
4. Kesepakatan bagi hasil per kelas ditetapkan Admin. Satu kelas hanya memiliki satu Mentor penerima bagi hasil aktif; pembagian tetap 80% Mentor dan 20% platform.
5. Halaman `/admin/pendapatan` dan `/mentor/pendapatan` menampilkan data pendapatan dan pembelian berdasarkan ledger.
6. Form penarikan meminta nama pemilik rekening, bank/e-wallet, nomor rekening, dan nominal. Admin melihat antrean pengajuan, dapat memproses, menandai dibayar, atau menolak dengan catatan.
7. Daftar peserta menampilkan nama dan tanggal akses; RPC peserta Mentor hanya mengembalikan data minimum untuk kelas yang ditugaskan.
8. Preview materi tersedia dalam mode baca-saja tanpa mengubah progres peserta.
9. Alur pengajuan Bab Mentor dan persetujuan Admin tetap dipertahankan.
10. Perubahan sebelumnya untuk identitas Kiki Creator Class, login, session/role guard, logout, detail kelas, sertifikat, progres mini materi, analitik, dan pengaturan tetap ada pada source.

## Pemeriksaan source yang berhasil

- 92 file TypeScript/TSX dipindai dengan TypeScript transpile parser: **0 syntax error**.
- Import relatif/lokal pada 92 file diperiksa: **0 import lokal hilang**.
- `src/app/globals.css` dipindai dengan PostCSS: **0 CSS parse error**.
- Navigasi Admin/Mentor dan rute utama ditinjau terhadap file route yang tersedia.
- File migration revenue ditinjau secara statis. Ditambahkan rekonsiliasi saat enrollment tidak aktif/dihapus, order item dihapus/dipindahkan, serta backfill untuk pesanan paid yang memenuhi syarat sebelum migration dipasang.

## Pemeriksaan yang belum dapat dinyatakan lulus

- `npm ci` tidak selesai karena npm registry tidak dapat dijangkau/timeout. Karena dependency tidak lengkap, `npm run lint` dan `npm run build` tidak dapat dijalankan; hasilnya **belum terverifikasi**, bukan dianggap berhasil.
- Type-check penuh belum dapat dijalankan.
- Tidak ada koneksi ke project Supabase produksi pada proses ini. RLS, constraint, trigger, RPC, Storage, dan data aktual belum dapat dipastikan hanya dari source.
- Migration revenue belum dijalankan. Jangan jalankan sebelum backup dan hasil preflight database cocok.
- Pengiriman notifikasi email/WhatsApp otomatis belum tersedia. Pemberitahuan pengajuan yang ada berupa antrean/banner di workspace Admin.

## Urutan database yang aman

1. Buat backup database produksi.
2. Jalankan `supabase/audit/20261106_security_audit_read_only.sql`.
3. Jalankan `supabase/audit/20261109_revenue_preflight.sql`.
4. Pastikan tabel/kolom `orders`, `order_items`, `courses`, `enrollments`, `course_task_mentors`, `profiles`, `user_roles`, fungsi `is_platform_admin()` dan `is_assigned_course_mentor()`, serta unique key `(course_id, mentor_user_id)` pada `course_task_mentors` sesuai.
5. Pastikan migration mentor chapter dan public course landing hanya dijalankan jika belum pernah diterapkan. Migration `20261106_mentor_content_version_workflow.sql` diarsipkan sebagai migration yang sudah diterapkan; jangan dijalankan ulang.
6. Jalankan `supabase/migrations/20261109_mentor_revenue_and_withdrawals.sql` satu kali setelah semua prasyarat cocok.
7. Jalankan audit read-only kembali dan uji pembayaran sukses, enrollment aktif/nonaktif, agreement aktif/nonaktif, saldo, permintaan penarikan, dan transisi status Admin.

## Catatan perhitungan

- Dasar pembagian adalah nilai total order setelah diskon, dialokasikan secara proporsional terhadap `order_items.line_total` menggunakan `orders.subtotal`.
- Biaya payment provider tidak dikurangi dalam migration ini.
- Pendapatan baru dicatat jika order berstatus `paid`, enrollment peserta aktif, mentor ditugaskan pada kelas, dan kesepakatan bagi hasil aktif pada saat pembayaran.
- Nilai penarikan tidak dipercaya dari browser. RPC menghitung saldo dan menggunakan advisory lock untuk mencegah dua permintaan bersamaan melampaui saldo.
- Jika enrollment dicabut atau order dibatalkan, ledger tersedia yang terkait dibalik. Permintaan yang sudah dibayar memerlukan kebijakan rekonsiliasi/refund terpisah jika terjadi pembatalan setelah pembayaran mentor.

## Menjalankan di komputer pengguna

1. Salin `.env.example` menjadi `.env.local`, lalu isi URL dan publishable key Supabase milik project sendiri.
2. Jalankan `npm ci`.
3. Jalankan `npm run lint` dan `npm run build`.
4. Jalankan `npm run dev` dan uji peran Admin, Mentor, serta Member.
5. Jangan deploy sebelum lint/build dan pemeriksaan Supabase berhasil.
