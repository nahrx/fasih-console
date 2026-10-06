# fasih-console

Pustaka JavaScript yang dijalankan dari **DevTools Console** browser untuk membaca dan mengubah isi dokumen assignment di **FASIH** lewat API, tanpa membuka form satu per satu di UI.

Cocok untuk perbaikan data massal (mis. mengubah status keluarga, mengisi nomor BANR, memperbaiki kode pilihan, memindahkan foto, mengubah geotag) yang kalau dikerjakan manual memakan waktu lama.

> [!WARNING]
> **Server FASIH tidak memvalidasi isi dokumen.**
> Semua aturan FormGear (enable condition, range, konsistensi antar-blok, kalkulasi turunan) hanya berjalan di sisi klien. Update lewat API **melewati seluruh aturan itu**: record bisa tersimpan dalam keadaan tidak konsisten dan baru ketahuan saat dibuka di UI.
>
> Selalu: **backup → dry run → uji 1 record → buka hasilnya di UI → baru jalankan massal.**

## Isi repository

| Berkas | Keterangan |
| --- | --- |
| [`console.js`](console.js) | Pustaka utama. Mendefinisikan objek global `FASIH`. |
| [`example/update keluarga banr - batch.js`](example/update%20keluarga%20banr%20-%20batch.js) | Contoh batch: keluarga "tidak dapat ditemui" (kode 5) → "ditemukan" + BANR, roster anggota keluarga dibentuk dari prelist. |

## Prasyarat

- Browser berbasis Chromium/Firefox versi baru (butuh `CompressionStream` dan top-level `await` di Console).
- Sudah **login** ke `https://fasih-sm.bps.go.id` dan punya hak edit pada assignment yang akan diubah.
- `assignmentId` (UUID) record yang ingin diubah.

## Memulai

1. Buka `https://fasih-sm.bps.go.id`, login, lalu buka salah satu halaman assignment dari survei yang sama.
2. Buka DevTools (`F12`) → tab **Console**.
3. Salin seluruh isi `console.js`, tempel ke Console, tekan Enter. Akan muncul:
   ```
   FASIH editor siap.  Mulai:  await FASIH.init()  lalu  await FASIH.dump("<assignmentId>")
   ```
4. Muat skema template (sekali per sesi/survei):
   ```js
   await FASIH.init()                                  // dari URL halaman assignment yang terbuka
   await FASIH.init({ assignmentId: '...' })           // atau sebut ID-nya langsung
   ```
5. Untuk template/survei baru, jalankan audit dulu agar tahu field mana yang tidak bisa divalidasi otomatis:
   ```js
   await FASIH.audit()
   ```

## Alur kerja yang disarankan

```js
await FASIH.init()
const ID = 'e110fb00-ea62-4034-a693-4d2555a002f4'

// 1. Kenali datanya
await FASIH.dump(ID)                 // semua field terisi + tipe + section
FASIH.find('hubungan')               // cari dataKey dari label
FASIH.schema('hubungan')             // tipe + daftar opsi valid

// 2. Cadangkan dulu (mengunduh file .json)
await FASIH.backup([ID])

// 3. Dry run — tidak ada yang dikirim, hanya rencana & daftar perubahan
const r = await FASIH.update(ID, { 'hubungan#2': '3' })
console.table(r.changes)

// 4. Live
await FASIH.update(ID, { 'hubungan#2': '3' }, { dryRun: false })

// 5. Buka record di UI FASIH, pastikan tidak ada error validasi.
```

Semua fungsi yang menulis **default-nya `dryRun: true`**. Data baru benar-benar dikirim jika Anda memberi `{ dryRun: false }`.

## Referensi API

### Membaca & menjelajah

| Fungsi | Keterangan |
| --- | --- |
| `await FASIH.init(opts?)` | Memuat skema template. `opts`: `{ assignmentId, mode, force }`. `mode` default dari assignment (mis. `'CAPI'`); `force: true` untuk memuat ulang. |
| `await FASIH.audit(assignmentId?)` | Ringkasan komponen per tipe, field pilihan tanpa daftar opsi statis, dan tipe yang butuh perlakuan khusus. |
| `FASIH.find(teks)` | Cari komponen berdasarkan `dataKey` atau label (tidak peka huruf besar/kecil). |
| `FASIH.schema(dataKey)` | Info satu komponen: `type`, `kind`, `label`, `section`, `options`, `source` (tabel lookup). Sufiks roster `#n` otomatis dilepas. |
| `await FASIH.dump(id, filter?)` | Tabel semua jawaban yang terisi. `filter` berupa regex untuk dataKey/label/section. |
| `await FASIH.rows(id, base)` | Daftar baris roster untuk satu dataKey dasar, mis. `FASIH.rows(ID, 'hubungan')`. |
| `await FASIH.getAssignment(id)` | Objek assignment mentah dari API (`data`, `pre_defined_data`, `comment`, `data1..data10`, dst.). |
| `await FASIH.getGeotag(id, dataKey?)` | Baca geotag sebagai `{ lat, lon, accuracy, url }`. |

### Menulis

| Fungsi | Keterangan |
| --- | --- |
| `await FASIH.update(id, values, opts?)` | Ubah sekumpulan field: `{ dataKey: nilai, ... }`. |
| `await FASIH.patch(id, (doc, { set, get }) => {...}, opts?)` | Mutator bebas atas dokumen — untuk logika yang bergantung pada nilai lain, menghapus baris, mengubah metadata dokumen, dll. |
| `await FASIH.updateBatch(rows, opts?)` | Update massal. `rows`: `[{ assignmentId, values, columns? }]`, atau array ID + `opts.values` untuk nilai yang sama ke semua record. |
| `await FASIH.setComment(id, dataKey, teks, opts?)` | Tambah catatan per-pertanyaan ke `comment.json`. `opts.author` opsional. |
| `await FASIH.setGeotag(id, lat, lon, opts?)` | Set geotag. `opts`: `{ accuracy, dataKey, dryRun }`. Akurasi lama dipertahankan jika tidak diberi. |
| `await FASIH.roundTrip(id)` | Kirim ulang dokumen tanpa perubahan (live) — untuk menguji pipeline submit. |

**Opsi umum (`opts`)**

| Opsi | Default | Keterangan |
| --- | --- | --- |
| `dryRun` | `true` | `false` untuk benar-benar mengirim. |
| `columns` | `null` | Override kolom `data1`…`data10` assignment. |
| `comment` | `null` | Override isi `comment.json` (string JSON). |
| `log` | `true` | Cetak ringkasan hasil ke Console. |
| `delayMs` | `1500` (`updateBatch`), `1200` (`restore`) | Jeda antar-record. |
| `stopOnError` | `false` | (`updateBatch`) berhenti di error pertama. |

**Nilai kembalian** berisi `assignmentId`, `code`, `status`, `version`, `nChanges`, `changes` (tabel `dataKey / dari / ke`), dan saat live juga `ok`, `versionAfter`, `statusAfter`.

### Backup & rollback

| Fungsi | Keterangan |
| --- | --- |
| `await FASIH.backup(ids, filename?)` | Mengunduh file `fasih-backup-<timestamp>.json` berisi dokumen asli, komentar, dan kolom `data1..data10`. **Wajib sebelum batch.** |
| `await FASIH.restore(backup, opts?)` | Mengembalikan record ke isi backup. Terima objek hasil `JSON.parse` file backup atau array `items`. Default dry run. |

Contoh memulihkan dari file backup:

```js
const backup = /* tempel isi file fasih-backup-xxx.json di sini */;
await FASIH.restore(backup)                     // dry run
await FASIH.restore(backup, { dryRun: false })  // live
```

### Helper nilai

| Fungsi | Keterangan |
| --- | --- |
| `FASIH.raw(nilai)` | Pasang nilai apa adanya, tanpa konversi/validasi. |
| `FASIH.geotag(lat, lon, accuracy?)` | Bangun nilai geotag 5-slot yang siap dipakai di `update`. |

## Cara nilai dikonversi

`update` / `set` menerjemahkan nilai sesuai tipe komponen di template:

| Tipe komponen | Input yang diterima | Disimpan sebagai |
| --- | --- | --- |
| Pilihan (21, 26, 27, 33) | Kode opsi (`'3'`) atau teks label (`'3. Anak'`) | `[{ label, value, ... }]` sesuai objek opsi di template |
| Pilihan + isian "lainnya" | `{ value: '99', open: 'teks lainnya' }` | Objek opsi dengan `open` terisi |
| Pilihan, multi | Array kode (`['1', '3']`) | Array objek opsi |
| Toggle (16, 17) | Apa saja | `Boolean(nilai)` |
| Angka (20, 28) | Angka atau string angka | `Number(nilai)` |
| Lainnya / tidak ada di template | Apa saja | Apa adanya |

Catatan:

- **Field roster/repeat** disimpan sebagai `<dataKey>#<indeks>`, mis. `hubungan#2`, `keberadaan_dtsen#1`. Skema dicari dari dataKey dasarnya.
- Saat mengganti jawaban pilihan yang sudah ada, **set dan urutan kunci objek lama dipertahankan** (termasuk properti khusus baris seperti `is_prelist`, `nik`, `no_urut`), sehingga diff minimal.
- Kode yang **tidak ada di daftar opsi** akan ditolak dengan pesan berisi daftar opsi yang valid.
- Field pilihan **tanpa daftar opsi statis** (opsi dari tabel lookup/MFD atau dibangun skrip form saat runtime) tidak bisa divalidasi — nilai dipasang apa adanya dengan peringatan. Tiru bentuk nilai yang sudah ada (lihat `FASIH.dump`).
- **Pengaman bentuk:** menulis nilai non-array ke field pilihan akan ditolak. FormGear membaca `answer[0].value.toString()`; string telanjang seperti `"4. Menantu"` membuat seluruh section gagal dirender (`Cannot read properties of undefined (reading 'toString')`), dan server tidak menolaknya. Bungkus dengan `FASIH.raw(...)` hanya jika memang disengaja.

### Tipe yang butuh perlakuan khusus

| Tipe | Catatan |
| --- | --- |
| `variable/hidden` (4) | Turunan — dihitung ulang FormGear dari field lain. Jangan ditulis manual kecuali Anda meniru hasil FormGear. |
| `nested` (29) / `table` (38) | Container. Isinya muncul sebagai `<dataKey>#<indeks>`. |
| `photo` (32), `signature` (34) | Array rujukan berkas (`{ filename, uri, url }`); berkas fisiknya di object storage dan tidak bisa dibuat dari sini. Bisa dipindah antar-field. |
| `lookup` (24) | Nilai dari tabel referensi eksternal. |
| `datetime` (35) | String ISO, mis. `"2026-09-17T13:06:29.737Z"`. |
| `geotag` | Array 5 slot tetap — gunakan `FASIH.geotag()` / `FASIH.setGeotag()`. |

Contoh:

```js
await FASIH.update(ID, { geotag: FASIH.geotag(-0.49051, 117.140465, 5) }, { dryRun: false })
await FASIH.update(ID, { 'hubungan#2': FASIH.raw([{ label: '3. Anak', value: 3 }]) }, { dryRun: false })
```

## Membuat skrip batch sendiri

Pola di folder [`example/`](example/):

1. Tempel `console.js` lebih dulu (contoh menyebutnya `general_console.js` — itu berkas yang sama).
2. Isi `DAFTAR` dengan data dari spreadsheet/ekspor, mis. `[{ "assignment_id": "...", "no_banr": "..." }]`.
3. Biarkan `DRY_RUN = true`, tempel skrip, periksa tabel hasil di akhir.
4. Aktifkan baris `FASIH.backup(...)` untuk mencadangkan semua record.
5. Ubah `DRY_RUN = false`, tempel lagi untuk menjalankan live.

Kerangka minimal:

```js
const DRY_RUN = true;
const DAFTAR = [ /* { assignment_id: '...', ... } */ ];

await FASIH.init({ assignmentId: DAFTAR[0].assignment_id });
await FASIH.backup(DAFTAR.map((d) => d.assignment_id));

const hasil = await FASIH.updateBatch(
  DAFTAR.map((d) => ({ assignmentId: d.assignment_id, values: { /* dataKey: nilai */ } })),
  { dryRun: DRY_RUN, delayMs: 3000 });
console.table(hasil);
```

Untuk perubahan yang bergantung pada data lain di record (prelist, roster, nilai field lain), gunakan `FASIH.patch` seperti di contoh — baca `asg.pre_defined_data` lewat `FASIH.getAssignment`, bentuk nilainya, lalu `set(...)` di dalam mutator.

## Cara kerja singkat

1. `GET .../assignment/get-by-assignment-id` → ambil dokumen (`data`) dan komentar.
2. Dokumen diubah di memori, perubahan dibandingkan dengan snapshot awal.
3. `data.json`, `comment.json`, `media.json` dikemas menjadi ZIP (deflate via `CompressionStream`, CRC32 & MD5 dihitung sendiri — tanpa dependensi).
4. Minta presigned URL (`.../s3/edit/presign-url`) → `PUT` ZIP ke object storage.
5. Commit lewat `.../s3/edit` dengan `sourceFrom: 'SCM-EDIT'`, lalu assignment dibaca ulang untuk memastikan versi bertambah.

Autentikasi memakai cookie sesi browser dan header `X-XSRF-TOKEN` dari cookie `XSRF-TOKEN`; tidak ada kredensial yang disimpan di skrip.

## Penafian

Alat ini bukan bagian resmi dari FASIH/BPS. Gunakan hanya pada assignment yang memang menjadi wewenang Anda, dan tanggung jawab atas perubahan data ada pada pengguna.
