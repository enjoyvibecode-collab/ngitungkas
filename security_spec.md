# Security Specification - Ngitung KAS

## 1. Data Invariants
- Transaksi tidak boleh dibuat tanpa `orgId` yang valid.
- Hanya Admin dan Bendahara yang bisa menulis transaksi.
- Anggota hanya memiliki akses baca (read-only) untuk transaksi organisasi mereka.
- User hanya bisa melihat profil mereka sendiri (PII isolation).
- Saldo tabungan hanya bisa diupdate oleh Bendahara/Admin, tetapi bisa dilihat oleh pemiliknya.

## 2. Dirty Dozen Payloads (Test Case)
1. **Identitas Palsu:** Mencoba membuat transaksi dengan `createdBy` bukan UID user saat ini. -> **DENIED**
2. **Ghost Org:** Mencoba membaca transaksi dari `orgId` yang bukan milik user. -> **DENIED**
3. **Escalasi Role:** User `member` mencoba mengupdate `role` menjadi `admin`. -> **DENIED**
4. **Saldo Ilegal:** Mencoba menyetor tabungan tanpa melalui Bendahara (write langsung ke `savings`). -> **DENIED**
5. **Update Abadi:** Mencoba mengubah `createdAt` pada transaksi yang sudah ada. -> **DENIED**
6. **Poison ID:** Mencoba membuat dokumen dengan ID sangat panjang (>1MB). -> **DENIED**
7. **Bypass Org:** Mencoba mendaftar User baru dengan `orgId` organisasi lain tanpa persetujuan. -> **DENIED**
8. **Negative Amount:** Mencoba memasukkan `amount` negatif pada iuran. -> **DENIED**
9. **Future Date:** Mencoba memasukkan transaksi untuk tanggal di masa depan. -> **DENIED**
10. **Malicious Category:** Mencoba memasukkan kategori berupa script injection. -> **DENIED**
11. **Mass Delete:** User `member` mencoba menghapus (delete) seluruh koleksi transaksi. -> **DENIED**
12. **PII Leak:** User mencoba membaca koleksi `users` secara massal (list without filter). -> **DENIED**
