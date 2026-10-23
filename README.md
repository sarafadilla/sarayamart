# SARAYAMART — Mini Market Web (gaya iPhone 15)

## Struktur
```
sarayamart/
├── index.html        # kerangka aplikasi
├── style.css         # desain iOS, responsif, CSS cetak struk
├── script.js         # seluruh logika (PIN, produk, keranjang, checkout, struk, riwayat, admin)
├── manifest.json     # PWA
├── sw.js             # service worker (offline, hanya aktif di http(s))
└── icons/            # icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png
```

## Menjalankan
- Cara cepat: klik dua kali `index.html` (semua fitur jalan; PWA/offline tidak aktif di file://).
- Disarankan: `python3 -m http.server 8080` di folder ini, buka http://localhost:8080
- Dari HP: jalankan server di laptop, satu Wi-Fi, buka `http://IP-LAPTOP:8080`. Untuk PWA penuh di iPhone, host lewat HTTPS (GitHub Pages / Netlify / Vercel gratis).
- Tambah ke layar utama iPhone: Safari → Bagikan → Tambah ke Layar Utama. Ini PWA, bukan aplikasi native App Store.

## PIN
- PIN pengguna: `123456` (ubah di Profil → Ubah PIN aplikasi)
- PIN admin: `654321` (ubah di Admin → Pengaturan → Keamanan)

## Mengubah data
- Produk, harga, stok, diskon, gambar: Profil → Panel admin → Produk (atau ubah array `SEED` di script.js lalu "Reset data demo").
- Alamat, kontak, ongkir, area antar, rekening bank & e-wallet: Panel admin → Pengaturan.
- Logo: fungsi `logo()` di script.js dan `icons/icon.svg`.
- Nama toko: Pengaturan admin (default `SARAYAMART`).

---
## Revisi: Emerald Luxury, layar iPhone, admin terpisah, chat

**Halaman**
- `index.html` = pelanggan (di laptop tampil dulu layar utama iPhone simulasi; klik ikon Saraya Mart untuk masuk; bar putih di bawah layar = kembali ke layar utama).
- `admin.html` = admin, dilindungi PIN admin (bawaan `654321`, ubah di Pengaturan). Tidak ada tautan ke halaman ini dari sisi pelanggan.

**Penyimpanan (localStorage, satu browser & satu perangkat)**
`sarayamart_v1` produk/pesanan/pengaturan · `sarayamart_cart` keranjang · `sarayamart_profile` nama+foto pelanggan · `sarayamart_chat` chat.
Admin dan pelanggan baru saling terhubung bila dibuka di browser dan perangkat yang sama. Antarperangkat memerlukan backend/database bersama (belum ada).

**Aturan stok & pesanan**
Stok berkurang satu kali saat pesanan dibuat. Pembatalan (oleh pelanggan saat status *Diproses*, atau oleh admin) mengembalikan stok satu kali. *Selesai* dan *Dibatalkan* bersifat final.

**Batasan keamanan**: PIN dicek di JavaScript browser, cukup untuk demo, belum aman untuk produksi (perlu autentikasi server).

## Satuan grosir & varian (admin)
Di admin: Produk > Edit. **Satuan dasar** = satuan stok (mis. bungkus). **Satuan grosir**, satu baris: `Nama | isi | harga` (harga kosong = isi x harga dasar), mis. `Renteng | 10 | 25000`. **Varian**, satu baris: `Nama | Kode | Harga | Stok | URL gambar`. Stok selalu dihitung dalam satuan dasar. Jika produk memakai varian, Harga & Stok produk otomatis dari varian.
Produk lama tetap berjalan sebagai produk satuan tunggal tanpa varian.

## Ongkir per area
Admin > Pengaturan: tulis satu baris per area `Nama | ongkir` (tanpa ongkir = pakai ongkir standar), serta ongkir untuk tujuan di luar daftar/luar kota. Pelanggan memilih area atau "Lainnya / luar kota (ketik sendiri)". Diskon ongkir belum ada.

## Ekspedisi (luar kota), resi, voucher ongkir
Admin > Pengaturan: isi daftar kurir `Kurir | Layanan | ongkir | estimasi` dan voucher `KODE | potongan | minimal belanja | kuota`. Ongkir ekspedisi diisi manual oleh admin (bukan tarif otomatis dari J&T/SiCepat; tarif otomatis butuh API berbayar/server).
Pelanggan: Pesan antar > Ekspedisi (luar kota) > pilih kurir, ketik kota tujuan, pakai kode voucher. Admin mengisi No. resi di tab Pesanan lalu mengubah status ke Dikirim; pelanggan melihat kurir dan resi di detail pesanan.

## Pembayaran dikonfirmasi admin
Pelanggan tidak punya tombol untuk melunasi pesanan sendiri. Semua pesanan mulai "Menunggu Pembayaran". Pelanggan boleh mengunggah bukti transfer; admin memeriksa mutasi rekening lalu menekan "Konfirmasi Pembayaran". Pesanan belum lunas tidak bisa diubah ke Dikirim/Selesai.
Catatan: ini perlindungan di tampilan saja (frontend). Verifikasi pembayaran yang aman memerlukan server/payment gateway.

## Simulasi kerja sama ekspedisi
Saat admin menekan Konfirmasi Pembayaran pada pesanan ekspedisi, sistem otomatis membuat nomor resi (simulasi booking ke J&T/SiCepat/JNE). Setelah status Dikirim, halaman detail pesanan pelanggan menampilkan pelacakan yang bergerak tiap 1 menit. Ini SIMULASI untuk demo: nomor tidak ada di sistem ekspedisi sungguhan. Integrasi nyata memerlukan akun bisnis dan API ekspedisi di sisi server.

## Revisi: baterai, bunyi notifikasi, penilaian, data pelanggan, hapus transaksi
- **Baterai** di status bar (layar iPhone simulasi) mengikuti baterai perangkat tanpa angka persen. Hijau saat mengisi daya, merah saat 20% ke bawah. Memakai Battery API (Chrome/Edge); di browser yang tidak mendukung, ikon tetap penuh.
- **Bunyi notifikasi** (dibuat dengan Web Audio, tanpa file suara): chat masuk ke admin (juga balasan admin ke pelanggan), pesanan baru masuk ke admin, dan pesanan sampai ke pelanggan (status Selesai). Browser baru boleh bunyi setelah halaman diketuk/diklik sekali (mis. saat mengetik PIN).
- **Penilaian & komentar**: saat pesanan berstatus Selesai, pelanggan diminta memberi bintang 1-5 dan komentar. Bisa juga dari Riwayat > Beri Penilaian. Admin melihat penilaian di kartu transaksi. Disimpan di pesanan (`rating`).
- **Profil pelanggan** kini berisi data pelanggan (nama, nomor HP, alamat) dan otomatis mengisi form checkout. Alamat & nomor HP toko dipindah ke kartu **Lokasi Toko** di bagian bawah Beranda (ada tombol Buka di Maps dan Hubungi).
- **Admin**: kartu Transaksi, Total penjualan, Produk, dan Stok menipis/habis bisa diketuk dan menampilkan daftarnya.
- **Chat**: ketuk pesan untuk Batal kirim (hilang untuk kedua pihak) atau Hapus untuk saya; ikon tempat sampah di atas chat membersihkan seluruh percakapan dari tampilan sendiri.
- **Hapus transaksi** (pelanggan & admin): hanya untuk status Selesai/Dibatalkan, satuan atau massal. Penghapusan oleh pelanggan hanya menyembunyikan dari riwayatnya (`hideC`); penghapusan oleh admin menghapus permanen sehingga total penjualan ikut berkurang.
- Format penyimpanan tidak berubah (kunci `sarayamart_v1` dll.), jadi produk dan gambar yang sudah Anda tambahkan tetap terbaca. Tidak ada file yang dihapus.

## Revisi 3: periode penjualan, pencarian admin, rating toko publik, banner suara
- **Total penjualan** punya pilihan periode: Hari ini, Minggu ini (mulai Senin), Bulan ini, Semua. Pilih lewat kartu Total penjualan > chip periode. Kartu di depan ikut berganti dan pilihan diingat. Periode dihitung dari waktu pesanan dibuat, hanya transaksi lunas.
- **Pencarian admin** di tab Produk (nama/kategori/ukuran), Pesanan (no. transaksi, nama pembeli, HP, barang, status) dan Chat (nama pelanggan/isi pesan).
- **Rating & Ulasan Toko** tampil di Beranda pelanggan: rata-rata bintang, sebaran 1-5, dan 5 ulasan terbaru (nama disingkat, mis. Sarah V.). Ulasan disimpan terpisah (`reviews`) sehingga tidak hilang walau admin menghapus transaksinya. Tetap tersimpan di browser yang sama (belum ada server).
- **Banner suara**: bila halaman dibuka tanpa klik (mis. refresh saat sesi masih terbuka), muncul tulisan "Ketuk untuk mengaktifkan suara notifikasi".

## Revisi 4
- **Hapus riwayat admin tidak mengurangi total.** Tombol Hapus di admin kini hanya membersihkan daftar (data pesanan tetap tersimpan), jadi Total penjualan dan jumlah Transaksi tidak berubah. Riwayat di sisi pelanggan tidak ikut terhapus.
- **Tab Transaksi dipisah: Aktif dan Selesai.** Aktif = pesanan yang masih harus diproses (yang terlama di atas). Selesai = yang sudah Selesai/Dibatalkan, tombol hapus hanya di sini.
- **Form penilaian hanya muncul otomatis sekali per pesanan.** Setelah itu menilai lewat tombol "Beri Penilaian" di Riwayat.
- Catatan: "Reset data demo" tetap menghapus semuanya, termasuk total.

## Revisi 5: data produk ikut terbawa
Produk disimpan di browser (localStorage), jadi tidak ikut saat ZIP dikirim atau di-upload ke Netlify. Solusinya file `data.js`:
1. Di browser yang produknya sudah lengkap: Admin > Pengaturan > **Unduh data produk (data.js)**.
2. Taruh file hasil unduhan di folder aplikasi, gantikan `data.js` lama.
3. Upload ulang ke Netlify / kirim ZIP. Siapa pun yang membuka dari browser yang belum pernah membuka aplikasi akan melihat produk itu.
Catatan: browser yang sudah pernah membuka aplikasi tetap memakai data lamanya (tekan "Reset data demo" untuk memuat isi data.js). Pesanan, chat, dan PIN tidak ikut diekspor. Gambar yang diunggah dari galeri membuat data.js besar; lebih ringan bila gambar ditaruh di folder `gambar/` dan diisi lewat URL.
