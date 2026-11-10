# Audit sumber Garment Padang System

## Prinsip migrasi
- Frontend lama dipertahankan sebagai sumber tampilan.
- Tidak ada perubahan CSS, layout, ukuran, warna, posisi, label, atau markup halaman dalam paket ini.
- Satu tag script non-visual ditambahkan di `<head>` untuk menyediakan kompatibilitas API.
- Backend Google Apps Script digantikan oleh Vercel API + Supabase PostgreSQL.
- Login tetap username/password melalui pemetaan username ke synthetic auth email. Pengguna tidak diminta mengetik email.

## Inventaris frontend yang terbaca
- 14 `view-section`: absensi, hpp, investor, riwayat_absensi, dashboard, orders, kasbon, gaji, clients, resellers, stats, reports, users, rekap_absensi.
- 16 ID navigasi teridentifikasi.
- Dua helper utama: `fetchGAS` dan `fetchGASSilent`.
- 19 titik `google.script.run` pada source lama. Compatibility bridge mempertahankan pola tersebut.

## Inventaris backend
- 38 action dispatcher, termasuk login dan getData.
- 59 deklarasi fungsi backend teridentifikasi.
- Fungsi langsung di luar dispatcher:
  - getInvestorData / saveInvestorData / saveInvestorDataBatch
  - getMasterTukang / saveMasterTukangBatch
  - getInvestorProjectData / saveInvestorProjectBatch
  - generateTidakHadirOtomatis
  - perbaikiTidakHadir29September2026 (fungsi koreksi historis satu kali; tidak dijalankan otomatis)
- Aturan bisnis HPP, keterlambatan absensi, lembur, dividen 10%, dan pengembalian investor +2 bulan dipetakan ke API baru.

## Inventaris 14 sheet
1. Users
2. Clients
3. Resellers
4. Orders
5. Settings
6. Absensi
7. Kasbon
8. Gaji
9. HPP
10. BiayaOperasional
11. KategoriBiaya
12. InvestorData
13. MASTER_TUKANG
14. INVESTOR_PROJECT

## Hal yang sengaja dipertahankan
- ID legacy disimpan sebagai text, bukan diganti menjadi UUID.
- JSON lama pada order, kasbon, HPP, dan investor disimpan sebagai JSONB dan kolom raw JSON.
- Field username, role, nama lengkap, dan jabatan dipertahankan.
- Respons API disesuaikan dengan bentuk objek yang sudah dipakai frontend.
- UI lama tidak ditulis ulang.

## Batasan yang harus dituntaskan sebelum production
1. Source yang tersedia berisi kode aplikasi, bukan ekspor data aktual Google Sheets. Migrasi data nyata baru dapat dijalankan setelah 14 CSV diekspor.
2. Hak akses lama sebagian besar diterapkan di frontend. Backend lama tidak melakukan pemeriksaan role yang konsisten. Paket awal ini memvalidasi sesi untuk semua API, tetapi matriks izin per-role perlu diaudit dan diuji sebelum production.
3. Akun Auth dibuat melalui script migrasi dari kolom Password lama. Password dikirim ke Supabase Auth untuk di-hash; password tidak disimpan di `profiles`.
4. Jika password legacy tidak memenuhi kebijakan minimum Supabase Auth, akun tersebut perlu reset password terkontrol. Script tidak akan mengganti password secara diam-diam.
5. Perlu perbandingan jumlah baris, total nominal, tanggal, JSON, dan hasil hitung antara sumber dan Supabase sebelum cutover.
6. Perlu pengujian browser nyata terhadap seluruh modul. File ini merupakan fondasi migrasi, bukan pernyataan bahwa production sudah siap.


## Keputusan autentikasi yang berlaku
- Selama migrasi dan tahap operasional awal, pengguna tetap login dengan `Username` dan `Password` lama.
- `Users.csv` tidak membutuhkan kolom `Email`; kolom lama `ID_User`, `Username`, `Password`, `Role`, `Nama_Lengkap`, dan `Jabatan` dipertahankan.
- Karena Supabase Auth menggunakan identitas email atau telepon untuk password sign-in, backend membuat email internal unik dari `ID_User`. Email internal ini bukan alamat email karyawan dan tidak digunakan untuk pengiriman email.
- Password lama dikirim melalui server-side importer ke Supabase Auth untuk di-hash; password tidak disimpan di tabel `profiles`.
- Setelah migrasi stabil, fitur pendaftaran berbasis email asli dapat dikembangkan sebagai tahap terpisah.
