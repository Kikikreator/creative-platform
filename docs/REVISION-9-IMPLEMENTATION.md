# Kiki Creator Class — Implementasi 9 Revisi

Tanggal paket: 9 November 2026

## 1. Konsistensi ukuran teks dan hierarki

- Menambahkan skala tipografi bersama pada `globals.css`.
- Menaikkan label legacy yang terlalu kecil secara konsisten.
- Menyamakan tinggi minimum tombol, fokus keyboard, judul halaman, deskripsi, dan komponen statistik.
- Skala mobile tetap terbaca tanpa mengubah ukuran heading hero yang sudah ditentukan per halaman.

## 2. Tampilan mobile seperti aplikasi

- Mempertahankan bottom navigation khusus Admin dan Mentor.
- Mempertahankan drawer menu untuk item lain, termasuk Pendapatan Mentor.
- Memperbesar target sentuh, menjaga safe-area, dan menambah ruang bawah untuk bottom navigation.
- Tabel baru memakai baris responsif/kartu pada layar kecil; desktop/tablet tetap memakai layout lebar.

## 3. Penugasan Mentor dipusatkan di Manajemen Mentor

- Menambahkan tombol **Atur Kelas & Bagi Hasil** pada setiap akun Mentor.
- Admin dapat memilih kelas dan mengaktifkan kesepakatan bagi hasil dari modal yang sama.
- Penyimpanan dilakukan melalui RPC Admin, bukan perubahan langsung dari browser.
- Panel Manajemen Tugas hanya menampilkan Mentor yang ditugaskan dan mengarahkan perubahan ke Manajemen Mentor.

## 4. Pendapatan Admin dan Mentor — 80:20

- Admin menetapkan Mentor penerima bagi hasil untuk tiap kelas.
- Satu kelas hanya memiliki satu Mentor penerima bagi hasil aktif.
- Pesanan manual-payment yang berubah menjadi `paid` dan memiliki enrollment `active` menghasilkan ledger.
- Dasar hitung adalah total invoice setelah diskon, dialokasikan proporsional ke item kelas.
- Mentor menerima 80% dari nilai transaksi item; platform menerima 20%.
- Halaman Admin menampilkan total transaksi, bagian Mentor, bagian platform, ringkasan Mentor, dan rincian pembelian.
- Halaman Mentor menampilkan pendapatan bersih Mentor, bukan menampilkan seluruh nilai invoice sebagai pendapatan Mentor.

## 5. Data pembelian kelas di bawah hero pendapatan Mentor

- Menampilkan nama lengkap peserta, kelas yang dibeli, tanggal transaksi, nilai transaksi, dan bagian Mentor 80% tepat di bawah hero Pendapatan Saya.
- Data hanya berasal dari ledger untuk pesanan paid dan enrollment aktif.

## 6. Penarikan pendapatan dan notifikasi Admin

- Mentor mengisi nama pemilik rekening, bank/e-wallet, nomor rekening, dan nominal.
- Admin melihat banner jumlah pengajuan yang memerlukan tindakan, detail rekening, dan nominal di halaman Pendapatan.
- Admin dapat memindahkan status ke diproses, menandai sudah dibayar, atau menolak dengan catatan.
- Nominal penarikan dihitung ulang oleh RPC database; permintaan tidak dapat melebihi saldo yang tersedia.
- Permintaan pending/processing/paid mengunci saldo; permintaan rejected melepaskan saldo.

## 7. Daftar peserta dengan nama lengkap

- Admin mendapat panel **Daftar Peserta per Kelas** pada halaman Pengguna & Akses.
- Mentor mendapat daftar peserta aktif di halaman detail/pengaturan kelas.
- RPC Mentor hanya mengembalikan user ID, nama lengkap, dan tanggal enrollment untuk kelas yang memang ditugaskan. Email, nomor telepon, dan data profil lain tidak diekspos melalui RPC tersebut.

## 8. Preview materi seperti peserta

- Mentor mendapat tombol **Preview Peserta** pada setiap Bab. Preview menampilkan satu Materi Inti per pilihan, Mini Materi, media, dan file dalam mode baca-saja.
- Admin mendapat tombol **Lihat sebagai Peserta** pada preview pengajuan Bab, dengan navigasi Materi Inti satu per satu.
- Preview tidak menandai progres atau menyimpan status selesai.
- Alur draft/pengajuan Bab lengkap dan persetujuan Admin tetap dipertahankan.

## 9. Audit proporsi, tombol, teks, modal, dan judul

- Menambahkan normalisasi ukuran tipografi, tinggi kontrol, border, fokus, radius, dan safe-area.
- Meninjau shell Admin/Mentor, bottom navigation, halaman pendapatan, daftar peserta, modal penugasan, dan preview materi.
- Mempertahankan tampilan desktop/tablet dan memperkuat layout mobile tanpa mengganti struktur fitur yang sudah berjalan.

## Aturan keamanan yang diterapkan

- Agreement dan penugasan hanya dapat diubah melalui RPC Admin.
- Ledger pendapatan hanya dapat dibaca Mentor pemilik atau Admin; tidak ada akses insert/update/delete dari client.
- Withdrawal request hanya dapat dibuat melalui RPC yang memeriksa role Mentor, nominal, dan saldo.
- Status withdrawal hanya dapat diubah melalui RPC Admin dengan transisi status yang dibatasi.
- Trigger ledger memeriksa status pesanan, enrollment aktif, penugasan Mentor, dan agreement yang aktif.

## Batas pengujian

- Source diperiksa secara sintaks, import, dan route secara statis.
- Full build, lint, dan type-check belum dapat dilakukan karena npm registry timeout saat `npm ci`.
- SQL migration belum dieksekusi pada Supabase. Preflight dan backup wajib dilakukan sebelum penerapan.
- Notifikasi yang tersedia dalam paket ini adalah banner/panel di workspace Admin; pengiriman email/WhatsApp otomatis belum dibuat karena tidak ada provider notifikasi yang terhubung.
