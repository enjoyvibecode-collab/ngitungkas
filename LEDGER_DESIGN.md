# Dokumentasi Ledger System - Ngitung KAS

## 1. Prinsip Utama
Sistem ini menggunakan pendekatan **Double-Entry Lite** (Ledger Syem) untuk memastikan integritas data keuangan:
- **Transaksi Abadi:** Data transaksi finansial tidak pernah dihapus secara fisik (`Hard Delete`). Penghapusan dilakukan melalui flag `isDeleted: true`.
- **Atomic Balance:** Saldo dihitung melalui mutasi log, bukan hanya mengandalkan satu field statis.
- **Audit Trail:** Setiap perubahan mencatat `createdBy`, `createdAt`, `updatedBy`, dan `updatedAt`.

## 2. Struktur Data Ledger
### Kas Umum
Setiap pemasukan/pengeluaran organisasi dicatat di `/transactions`.
- **Query Dasar:** `where('isDeleted', '==', false)`
- **Keamanan:** Security Rules melarang penghapusan dokumen di koleksi ini.

### Tabungan Anggota (Multi-Path Sinkronisasi)
Proses menabung melibatkan dua penulisan dalam satu `WriteBatch`:
1. **Set/Update:** `/organizations/{orgId}/savings/{userId}` (Saldo saat ini).
2. **Add:** `/organizations/{orgId}/savings_logs/{logId}` (Detail mutasi).

## 3. ID Unik & Pencegahan Duplikasi
Untuk sistem Iuran, ID dokumen dipaksa menggunakan format:
`[USER_ID]_[MONTH]_[YEAR]`
Contoh: `userA_01_2026`
Hal ini menjamin bahwa satu anggota tidak bisa membayar iuran bulan yang sama lebih dari satu kali (Idempotency).

## 4. Mekanisme Keamanan Firestore
Aturan keamanan diperketat untuk:
- Mencegah manipulasi `amount` oleh non-admin.
- Validasi `request.time` untuk memastikan audit trail tidak dipalsukan oleh client.
- Mengunci field `createdBy` agar tidak bisa diubah setelah dokumen dibuat.
