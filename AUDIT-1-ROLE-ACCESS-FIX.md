# Kiki Creator Class — Audit 1: Pemisahan Role dan Akses Workspace

## Tujuan

Memastikan akun Admin, Mentor, dan Peserta hanya dapat memasuki workspace dan fitur yang sesuai dengan role utamanya. Pemeriksaan dilakukan di proxy/server, bukan hanya dengan menyembunyikan menu.

## Aturan role

Prioritas role yang digunakan aplikasi:

1. `admin` → `/admin`
2. `instructor` → `/mentor`
3. `member` → `/dashboard`

Jika sebuah akun memiliki `instructor` dan `member` sekaligus, aplikasi memperlakukannya sebagai Mentor. Akun tersebut tidak dapat membuka Dashboard Peserta, checkout, invoice, ruang belajar peserta, atau endpoint unduhan sertifikat peserta.

## Perubahan source

- `src/proxy.ts`
  - Memvalidasi sesi.
  - Membaca role dari `user_roles`.
  - Membatasi `/admin`, `/mentor`, `/dashboard`, `/checkout`, dan `/kelas/[slug]/belajar` berdasarkan role utama.
  - Menolak akses jika role gagal diverifikasi (fail closed).
  - Mempertahankan cookie Supabase saat redirect dan menerapkan no-store pada halaman privat.
- `src/lib/auth/roles.ts`
  - Menetapkan prioritas `admin > instructor > member`.
  - Role yang tidak dikenal atau kosong menghasilkan `null`, bukan otomatis dianggap Peserta.
- `src/app/login/page.tsx` dan `src/app/register/page.tsx`
  - Login dan sesi aktif diarahkan berdasarkan role utama.
  - Mentor tidak diarahkan ke checkout walaupun masih memiliki baris role `member`.
  - Form penerimaan undangan Mentor tidak menjalankan sinkronisasi data pendaftaran Peserta.
  - Tautan undangan setelah konfirmasi email diproses sebelum pengalihan workspace.
- `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/admin/layout.tsx`, `src/app/mentor/layout.tsx`
  - Menambahkan pemeriksaan role sisi server dan pengalihan workspace yang konsisten.
- `src/app/checkout/page.tsx`, `src/app/checkout/[orderId]/page.tsx`, `src/app/kelas/[slug]/belajar/page.tsx`
  - Menambahkan pemeriksaan role Peserta sebelum memuat data atau menjalankan alur pembelian/pembelajaran.
- `src/app/api/certificates/[certificateId]/pdf/route.ts`
  - Menolak penggunaan endpoint sertifikat peserta oleh akun Mentor.
- `src/app/api/supabase-check/route.ts`
  - Membatasi endpoint diagnostik hanya untuk Admin dan tidak mengirim pesan error database mentah.

## Matriks akses yang diharapkan

| Role utama | `/admin` | `/mentor` | `/dashboard` | `/checkout` | `/kelas/[slug]/belajar` |
|---|---|---|---|---|---|
| Admin | Diizinkan | Redirect `/admin` | Redirect `/admin` | Redirect `/admin` | Redirect `/admin` |
| Mentor | Redirect `/mentor` | Diizinkan | Redirect `/mentor` | Redirect `/mentor` | Redirect `/mentor` |
| Peserta | Redirect `/dashboard` | Redirect `/dashboard` | Diizinkan | Diizinkan | Diizinkan jika enrollment aktif |

Halaman katalog dan detail kelas (`/kelas` dan `/kelas/[slug]`) tetap publik. Tombol pembelian tidak memberikan hak akses; route checkout tetap memeriksa role.


## Follow-up dari pengujian browser pengguna

Pengguna menguji source pada browser lokal dan melaporkan: seluruh pengujian Admin yang dicantumkan lulus; akun Mentor tetap berada di `/mentor` saat membuka route workspace lain; logout dan tombol Back tetap aman. Dua temuan tambahan dianalisis sebagai berikut:

1. **Mentor membuka `/kelas`:** `/kelas` adalah katalog publik, bukan workspace Peserta. Membukanya tidak memberikan enrollment, checkout, akses materi, atau hak Peserta. Route ini sengaja tetap publik agar calon peserta dapat melihat kelas. Agar status sesi tidak membingungkan, header katalog sekarang menampilkan `Workspace Mentor` untuk Mentor, `Workspace Admin` untuk Admin, dan `Dashboard Peserta` untuk Peserta—bukan tombol `Masuk`/`Daftar` pada sesi yang sudah aktif. CTA detail kelas juga diarahkan sesuai role.
2. **Peserta membuka `/checkout` tanpa parameter kelas:** halaman checkout memerlukan `?course=<UUID>`. Tanpa ID kelas, route mengarahkan pengguna ke katalog untuk memilih kelas; ini bukan logout dan bukan kegagalan pemeriksaan role. CTA detail kelas sekarang mengarahkan pengguna Peserta yang sudah login langsung ke `/checkout?course=<UUID>`. Pengunjung yang belum login tetap diarahkan ke pendaftaran dengan ID kelas yang dipertahankan.

## Follow-up source patch

- `src/app/kelas/page.tsx`: mengambil sesi dan role utama di server sebelum merender katalog.
- `src/app/kelas/kelas-catalog.tsx`: header katalog menampilkan tombol workspace sesuai role; tombol Masuk/Daftar hanya untuk pengunjung anonim.
- `src/app/kelas/[slug]/page.tsx`: CTA detail kelas diarahkan ke workspace Admin/Mentor, checkout untuk Peserta yang sudah login, atau pendaftaran untuk pengunjung anonim.

## Pengujian ulang yang masih wajib dilakukan

- Login sebagai Mentor → buka `/kelas`: katalog publik boleh tampil, tetapi header harus menampilkan `Workspace Mentor`; CTA kelas tidak boleh membawa ke checkout/peserta.
- Login sebagai Peserta → buka `/kelas`: header harus menampilkan `Dashboard Peserta`, bukan `Masuk`/`Daftar`.
- Peserta → buka detail kelas → klik `Lanjut ke Checkout`: URL harus berisi `?course=<UUID>` dan halaman checkout harus memuat kelas yang dipilih.
- Buka `/checkout` tanpa parameter sebagai Peserta: kembali ke katalog adalah perilaku yang diharapkan; header tetap harus mengenali sesi Peserta.
- Logout lalu tekan Back dan buka URL privat: halaman privat tidak boleh dapat digunakan.

Status Audit 1 belum dinyatakan 100% lulus sampai empat skenario follow-up di atas dijalankan pada browser setelah memasang patch ini. Pemeriksaan SQL/RLS/RPC tetap terpisah dan belum termasuk Audit 1 source/browser.

## Pemeriksaan teknis yang dilakukan

- Parsing sintaks TypeScript/TSX pada 13 file yang diubah: **lulus, tidak ditemukan syntax error**.
- Uji prioritas role:
  - `member + instructor` → `instructor`: **lulus**.
  - `instructor + admin` → `admin`: **lulus**.
  - `member` → `member`: **lulus**.
  - role kosong → `null`: **lulus**.
  - role tidak dikenal → `null`: **lulus**.
- Uji pola route privat: 10 contoh URL untuk Admin, Mentor, Dashboard, Checkout, dan ruang belajar: **lulus**.

## Pemeriksaan yang belum dapat dinyatakan lulus

- `npm run lint` dan `tsc --noEmit` belum dapat dijalankan sampai selesai di lingkungan pemeriksaan ini karena instalasi `node_modules` tidak lengkap (binary ESLint dan beberapa deklarasi `@types` tidak tersedia).
- Pengujian browser dengan akun Supabase asli belum dilakukan karena server `localhost` berjalan di komputer pengguna, bukan di lingkungan pemeriksaan ini.
- SQL, RLS, trigger, dan RPC belum diubah atau dinyatakan aman. Khususnya, trigger pendaftaran atau RPC undangan mungkin masih menyisakan role `member` pada akun Mentor. Aplikasi sekarang memprioritaskan `instructor`, tetapi pembersihan role di database dan perlindungan terhadap pemanggilan RPC langsung harus diselesaikan pada audit SQL berikutnya.

## Checklist uji browser setelah memasang source

1. Admin login → `/admin`.
2. Admin mengetik `/mentor` dan `/dashboard` → kembali ke `/admin`.
3. Admin mengetik `/checkout?course=<UUID>` dan `/kelas/<slug>/belajar` → kembali ke `/admin`.
4. Mentor login → `/mentor`.
5. Mentor mengetik `/admin`, `/dashboard`, `/checkout?course=<UUID>`, `/checkout/<orderId>`, dan `/kelas/<slug>/belajar` → semuanya kembali ke `/mentor`.
6. Peserta login → `/dashboard`.
7. Peserta mencoba `/admin` dan `/mentor` → kembali ke `/dashboard`.
8. Peserta dapat membuka checkout dan ruang belajar jika enrollment aktif.
9. Logout dari masing-masing role, tekan Back browser, lalu ketik URL privat → tidak boleh menampilkan halaman privat; harus menuju login.
10. Uji khusus akun Mentor yang mungkin memiliki dua baris role (`member` dan `instructor`) untuk memastikan tetap masuk ke `/mentor` dan tidak dapat menggunakan fitur Peserta.

Jangan centang checklist browser sebagai lulus sebelum hasilnya benar-benar diuji pada aplikasi lokal.
