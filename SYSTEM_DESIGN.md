# Dokumentasi Sistem Ngitung KAS

## 1. Konsep Sistem
Aplikasi **Ngitung KAS** adalah platform manajemen keuangan organisasi berbasis cloud yang dirancang untuk meningkatkan transparansi dan akuntabilitas dalam pengelolaan dana kelompok. Sistem ini memungkinkan pencatatan transaksi secara real-time yang dapat dipantau oleh seluruh anggota.

## 2. Peran Pengguna & Hak Akses
| Peran | Deskripsi | Hak Akses |
| :--- | :--- | :--- |
| **Admin** | Pengelola utama organisasi. | Manajemen user, pengaturan iuran, hapus/edit transaksi, akses laporan penuh. |
| **Bendahara** | Pelaksana harian keuangan. | Input pemasukan/pengeluaran, verifikasi iuran, input tabungan, cetak laporan. |
| **Anggota** | Pemilik dana/anggota grup. | Lihat laporan, cek status iuran pribadi, lihat saldo tabungan pribadi, notifikasi. |

## 3. Daftar Fitur Utama
### A. Dashboard Laporan
- Visualisasi saldo kas total.
- Grafik tren pemasukan vs pengeluaran bulanan.
- Ringkasan iuran bulan berjalan.

### B. Manajemen Transaksi
- Pemasukan (Iuran, Donasi, Bunga Bank, dll).
- Pengeluaran (Operasional, Pembelian barang, dll).
- Upload bukti transaksi (simulasi).

### C. Iuran & Tabungan
- **Iuran Rutin:** Daftar ceklis bulanan untuk setiap anggota.
- **Tabungan Anggota:** Saldo terpisah yang bisa ditarik atau disetor oleh anggota melalui bendahara.

### D. Notifikasi (Simulasi)
- Alert saat ada pengeluaran besar.
- Pengingat iuran belum bayar.
- Konfirmasi transaksi baru.

## 4. Alur Kerja (Workflow)
1. **Autentikasi:** User login menggunakan Google Auth.
2. **Pendaftaran Peran:** User baru didaftarkan atau memilih organisasi (Admin menyetujui).
3. **Pencatatan:** Bendahara menginput iuran masuk atau pengeluaran logistik.
4. **Validasi:** Sistem mengupdate saldo kas secara otomatis.
5. **Monitoring:** Anggota menerima notifikasi dan melihat dashboard terbaru.

## 5. Struktur Halaman (Routing)
- `/` : Landing Page & Login
- `/dashboard` : Ringkasan Keuangan
- `/transaksi` : Daftar & Form Transaksi
- `/iuran` : Manajemen Iuran Rutin
- `/tabungan` : Saldo Tabungan Anggota
- `/pengaturan` : Profil & Manajemen Anggota (Admin)
