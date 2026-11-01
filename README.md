# ☕ KopiNusa POS — Aplikasi Kasir Tablet Kafe & Resto (React + Tailwind + Framer Motion)

Aplikasi Point of Sale (POS) modern yang dirancang khusus untuk **Layar Tablet (Landscape/Portrait)** pada usaha **Kafe, Coffee Shop, dan Restoran (F&B)** dengan proteksi hak akses **Admin vs Kasir/Client (Karyawan)**.

## ✨ Fitur Utama

1. **Kasir POS Tablet Interaktif (`PosView`)**
   - Mode pesanan **Dine-In (Pilih Meja)**, **Takeaway**, dan **Delivery**.
   - Kustomisasi varian minuman/makanan (**Level Gula**, **Level Es/Suhu**, dan **Catatan Barista/Dapur**).
   - Kalkulasi otomatis Subtotal, Diskon Promo, Pajak PB1 (%), dan Service Charge (%).
   - Checkout cepat dengan metode **QRIS**, **Tunai** (tombol uang pas & nominal cepat + hitung kembalian otomatis), **Debit/Kartu**, dan **Transfer**.

2. **Cek Ketersediaan Barang & Manajemen Stok (`InventoryView`)**
   - Pemotongan stok otomatis setiap kali transaksi selesai.
   - Indikator status stok real-time: **Tersedia**, **Stok Menipis**, dan **Habis / Nonaktif**.
   - **Proteksi Role**: Karyawan/Kasir hanya dapat melihat ketersediaan stok (*Read-Only*), sedangkan **Admin** dapat menambah barang, mengubah harga jual/modal (HPP), dan restock cepat (`+1`, `-1`, `+10`).

3. **Laporan Omset, Pemasukan & Pengeluaran (`FinanceView`)**
   - Ringkasan KPI: **Total Omset Penjualan**, **Total Kas Masuk**, **Total Pengeluaran**, **HPP Bahan**, dan **Estimasi Laba Bersih**.
   - Buku Kas terpadu (otomatis mencatat penjualan POS + catatan pemasukan/pengeluaran operasional) & Ekspor laporan ke **CSV**.
   - **Proteksi Role**: Hanya **Admin** yang dapat mengedit atau menghapus catatan pemasukan/pengeluaran.

4. **Cetak & Edit Struk Thermal + Multi-Akun PIN (`ReceiptModal` & `ReceiptsSettingsView`)**
   - Pratinjau struk thermal **58mm / 80mm** siap cetak (`window.print()`).
   - **Admin** dapat mengedit isi struk yang sudah tercetak (koreksi jumlah item, diskon, meja, metode bayar) serta mengubah desain template struk (Nama kafe, alamat, pajak, info Wi-Fi di struk).
   - **Kasir (Client)** hanya dapat melihat dan mencetak ulang struk tanpa bisa mengedit atau menghapusnya.

## 🔐 Akun Demo Default

| Peran | Nama Akun | PIN Default | Hak Akses |
| :--- | :--- | :---: | :--- |
| **Admin (Owner)** | `Alif (Owner / Admin)` | `1234` | Akses penuh (Edit barang, stok, struk, omset, pengeluaran & akun) |
| **Kasir / Client** | `Sari Wulandari (Kasir Pagi)` | `0000` | Mode terbatas (Input kasir, cek ketersediaan barang, cetak struk) |
| **Kasir / Client** | `Dimas Pratama (Kasir Malam)` | `1111` | Mode terbatas (Input kasir, cek ketersediaan barang, cetak struk) |

## 🚀 Cara Menjalankan di Lokal

```bash
npm install
npm run dev
```
