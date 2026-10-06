/* ============================================================================
 * BATCH: "tidak dapat ditemui sampai akhir pendataan" (kode 5)  ->  "ditemukan" + BANR
 *        + roster anggota keluarga dari prelist (seperti yang dibentuk FormGear di UI)
 * ----------------------------------------------------------------------------
 * Pola diambil dari diff record 3efd51ee (v9 -> v8):
 *   data tidak dapat ditemui sampai akhir pendataan - NON RESPON.json -> data ditemukan - NON RESPON.json
 * Semua isi roster (nama, NIK, JK, hubungan, tgl lahir, aset, kepemilikan, dinding)
 * DITURUNKAN dari pre_defined_data record masing-masing — bukan disalin dari 3efd51ee.
 *
 * Dipakai bersama general_console.js (FASIH) — paste general_console.js dulu.
 *
 * Langkah:
 *   1. Paste apa adanya (DRY_RUN = true): backup semua ID, lalu tabel perubahan per
 *      assignment. Periksa kolom "adaKeluargaSebelum" dan jumlah ART.
 *   2. Ubah DRY_RUN = false, paste lagi -> live.
 * ==========================================================================*/

const DRY_RUN = true;
const JEDA_MS = 5000;

// JSON: [{ "assignment_id": "...","no_banr":"..." }, ...]
const DAFTAR = [];


/* Nomor bangunan terbesar di SLS (turunan FormGear, hanya tampilan). Keempat record
   ada di SLS yang sama (6472061005000501) sehingga nilainya sama: 231.
   Set null untuk tidak mengirimnya; atau isi per item: { ..., no_bangunan_terbesar: 231 } */
const NO_BANGUNAN_TERBESAR = 231;

/* Record yang ada_keluarga-nya sudah "1. Ditemukan" dilewati */
const LEWATI_JIKA_SUDAH = true;

/* Kode penggunaan bangunan yang dipilih di UI untuk kasus ini */
const KODE_BANG = [{ label: '3. Bangunan Tempat Tinggal', value: '3', open: false }];

/* Foto bangunan yang diambil saat status kode 5 (foto_depan_p, blok keterangan
   keluarga) dipindahkan ke field foto rumah tampak depan (foto_depan, Blok IV) —
   keduanya bertipe photo dengan bentuk nilai yang sama. Baris foto_depan_p lalu dihapus. */
const PINDAH = [['foto_depan_p', 'foto_depan']];
const HAPUS = PINDAH.map(([dari]) => dari);

/* Non-respon disimpan UI dengan force submit */
const DOC_META = { isForceSubmit: true };

/* ---------------------------------------------------------------------------
 * Turunan dari prelist — meniru inisialisasi FormGear saat keluarga "ditemukan"
 * ------------------------------------------------------------------------- */
const opt = (o) => (Array.isArray(o) && o[0] ? [{ label: o[0].label, value: o[0].value }] : o);   // [{value,label}] -> [{label,value}]
const umur = (tgl, bln, thn, ref = new Date()) => {                                                 // umur penuh pada tanggal ref
  const t = Number(tgl) || 1, b = Number(bln) || 1, y = Number(thn);
  let u = ref.getFullYear() - y;
  if (ref.getMonth() + 1 < b || (ref.getMonth() + 1 === b && ref.getDate() < t)) u--;
  return u;
};

function turunanPrelist(asgPredata, item) {
  const P = Object.fromEntries(asgPredata.map((p) => [p.dataKey, p.answer]));
  const daftarArt = P.list_individu_dtsen_prelist || [];
  const art = daftarArt.map((x, idx) => {
    const i = x.value ?? idx + 1;
    const hub = P[`hubungan#${i}`], jk = P[`jk_dtsen#${i}`];
    return { i, nama: P[`nama_dtsen#${i}`] ?? x.nama_ak ?? x.label, nik: P[`nik_dtsen#${i}`],
             hub, hubV: Number(hub && hub[0] && hub[0].value), jk, jkV: Number(jk && jk[0] && jk[0].value),
             tgl: P[`tgl_lahir#${i}`], bln: P[`bln_lahir#${i}`], thn: P[`thn_lahir#${i}`],
             umur: umur(P[`tgl_lahir#${i}`], P[`bln_lahir#${i}`] && P[`bln_lahir#${i}`][0] && P[`bln_lahir#${i}`][0].value, P[`thn_lahir#${i}`]) };
  });
  const n = art.length, krt = art.find((a) => a.hubV === 1) || art[0];
  const hit = (f) => String(art.filter(f).length);
  const V = {
    /* ---- status keluarga ---- */
    ada_keluarga: [{ label: '1. Ditemukan', value: '1', open: false }],
    ec_keluarga: true,
    ec_keluarga_respons: true,
    pilihan_kode_bang: [{ label: '2. Bangunan Campuran', value: '2' }, { label: '3. Bangunan Tempat Tinggal', value: '3' }, { label: '9. Non Respon', value: '9' }],
    ...(NO_BANGUNAN_TERBESAR != null || item.no_bangunan_terbesar != null ? { no_bangunan_terbesar: item.no_bangunan_terbesar ?? NO_BANGUNAN_TERBESAR } : {}),
    kode_bang: KODE_BANG,
    banr: true,
    no_banr: item.no_banr,
    /* ---- ringkasan keluarga (Blok I) ---- */
    jumlah_ak_kk: P.jumlah_ak_kk,
    jumlah_usaha_ditemukan: String(P.jml_usaha_keluarga ?? 0),
    ec_ada_usaha: true,
    label_usaha: '',
    tambah_dtsen: [{ label: 'lastId#0', value: '0' }],
    gabung_dtsen: art.map((a) => ({ no_urut: a.i, label: a.nama, value: a.i, is_prelist: '1' })),
    art_keberadaan15: art.map((a) => ({ label: a.nama, value: String(a.i) })),
    cek1: n,
    jum_krt: hit((a) => a.hubV === 1),
    jk_krt: krt ? [{ gender: krt.jkV, label: krt.nama, value: String(krt.i) }] : [],
    umur_krt: krt ? String(krt.umur) : '',
    umur_ak_dr_keltunggal: '0',
    jum_anakmantucucu: hit((a) => [3, 4, 5].includes(a.hubV)),
    jum_pasangan: hit((a) => a.hubV === 2),
    jum_istri: hit((a) => a.hubV === 2 && a.jkV === 2),
    jum_art_semua: n,
    jum_art_1345: String(n),                 // keberadaan default 1 untuk semua ART prelist
    jum_ak_disabilitas: '0',
    jum_art_1345_umurkur10: hit((a) => a.umur < 10),
    jum_ak_15: String(n),
    jum_kk_lebihdr10th: hit((a) => a.hubV === 1 && a.umur > 10),
    jum_kk: hit((a) => a.hubV === 1),
  };
  /* ---- roster ART: identitas (Blok I) ---- */
  for (const a of art) Object.assign(V, {
    [`isprelistart#${a.i}`]: '1',
    [`no_urut_kk#${a.i}`]: a.i,
    [`nama_dtsen#${a.i}`]: a.nama,
    [`nama_dtsen_edit#${a.i}`]: a.nama,
    [`nik_dtsen#${a.i}`]: a.nik,
    [`nik_dtsen_prelist#${a.i}`]: a.nik,
    [`ec_anggota_keluarga#${a.i}`]: true,
    [`hubungan#${a.i}`]: opt(a.hub),
    [`keberadaan_dtsen#${a.i}`]: '1',        // 1. Tinggal di rumah/tempat tinggal ini (dari skema)
    [`jk_prelist#${a.i}`]: opt(a.jk),
    [`jk_dtsen#${a.i}`]: opt(a.jk),
    [`tgl_lahir#${a.i}`]: a.tgl,
    [`bln_lahir#${a.i}`]: opt(a.bln),
    [`thn_lahir#${a.i}`]: a.thn,
    [`umur_ak#${a.i}`]: a.umur,
    [`ec_ada_usaha_art#${a.i}`]: false,
  });
  Object.assign(V, {
    art_pengusaha: [],
    nama_usaha_tambahan: [{ label: 'lastId#0', value: '0' }],
    /* ---- identitas keluarga (Blok III) ---- */
    dtsen_nama_kk: P.dtsen_nama_kk ?? P.nama_kk,
    nik_kk: P.nik_kk ?? P.nik,
    dtsen_no_kk: P.dtsen_no_kk ?? P.no_kk,
    jml_kk: n,
    jml_kk_update: n,
    gabung_dtsen_var: art.map((a) => ({ label: a.nama, value: a.i, is_prelist: '1' })),
    gabung_dtsen_2: art.map((a) => ({ no_urut: a.i, label: a.nama, value: a.i, is_prelist: '1' })),
  });
  for (const a of art) Object.assign(V, {
    [`no_urut_kk_var#${a.i}`]: a.i,
    [`nama_dtsen_var#${a.i}`]: a.nama,
    [`index_ak#${a.i}`]: a.i,
    [`ec_art_dtsen#${a.i}`]: true,
    [`ec_art_pendapatan#${a.i}`]: true,
  });
  /* ---- perumahan & aset dari prelist (Blok IV), hanya yang terisi ---- */
  for (const k of ['status_kepemilikan', 'luas_lantai', 'jns_lantai', 'jns_dinding', 'jns_atap', 'air_minum'])
    if (P[k] != null) V[k] = opt(P[k]);
  Object.assign(V, {
    total_pendapatan_keluarga_sebulan: 0, total_pengeluaran_keluarga_sebulan: 0, selisih_pendapatan_pengeluaran: 0,
    total_pendapatan_keluarga_sebulan_tampil: 0, total_pengeluaran_keluarga_sebulan_tampil: 0, selisih_pendapatan_pengeluaran_tampil: 0,
  });
  for (const k of ['jumlah_kulkas', 'jumlah_ac', 'jumlah_emas', 'jumlah_laptop', 'jumlah_motor', 'jumlah_mobil'])
    if (P[k] != null) { V[k] = P[k]; V[`${k}_new`] = P[k]; }
  /* ---- ringkasan & pemberi jawaban ---- */
  Object.assign(V, {
    jumlah_usaha_pendataan: String(P.jml_usaha_keluarga ?? 0),
    jumlah_ak_pendataan: n,
    ak_info: [...art.map((a) => ({ no_urut: a.i, label: a.nama, value: a.i, is_prelist: '1' })),
              { label: 'Lainnya', value: '99' }, { label: 'Pemilik Usaha', value: '98' }],   // daftar ART + 2 opsi tetap
  });
  return { V, n };
}

const label0 = (v) => (Array.isArray(v) && v[0] && v[0].label != null ? v[0].label : JSON.stringify(v));
const value0 = (v) => (Array.isArray(v) && v[0] ? String(v[0].value) : null);

async function prosesSatu(item) {
  const asg = await FASIH.getAssignment(item.assignment_id);
  if (LEWATI_JIKA_SUDAH) {
    const answers = asg.data ? JSON.parse(asg.data).answers || [] : [];
    const adaKel = (answers.find((a) => a.dataKey === 'ada_keluarga') || {}).answer;
    if (value0(adaKel) === '1') return { code: asg.code_identity, dilewati: true, adaKeluargaSebelum: label0(adaKel) };
  }
  const predata = JSON.parse(asg.pre_defined_data).predata;
  const { V, n } = turunanPrelist(predata, item);
  let sebelum = null;
  const res = await FASIH.patch(item.assignment_id, (doc, { set, get }) => {
    sebelum = label0(get('ada_keluarga'));
    for (const [dari, ke] of PINDAH) {                  // pindahkan nilai sebelum baris asalnya dihapus
      const nilai = get(dari);
      if (nilai != null && get(ke) == null) set(ke, nilai);
    }
    for (const [k, v] of Object.entries(V)) set(k, v);
    for (const k of HAPUS) {
      const i = doc.answers.findIndex((a) => a.dataKey === k);
      if (i >= 0) doc.answers.splice(i, 1);
    }
    Object.assign(doc, DOC_META);
  }, { dryRun: DRY_RUN, log: false });
  return { ...res, adaKeluargaSebelum: sebelum, jumlahArt: n };
}

/* Rekursif: kerjakan item ke-i, jeda, lanjut ke i+1 */
async function jalankan(i = 0, hasil = []) {
  if (i >= DAFTAR.length) return hasil;
  const item = DAFTAR[i];
  try {
    const r = await prosesSatu(item);
    if (r.dilewati) {
      hasil.push({ no: i + 1, assignmentId: item.assignment_id, code: r.code, adaKeluargaSebelum: r.adaKeluargaSebelum, ok: 'dilewati' });
      console.log(`${i + 1}/${DAFTAR.length} [LEWATI] ${item.assignment_id} ${r.code} | ada_keluarga sudah: ${r.adaKeluargaSebelum}`);
    } else {
      hasil.push({ no: i + 1, assignmentId: item.assignment_id, code: r.code, adaKeluargaSebelum: r.adaKeluargaSebelum, jumlahArt: r.jumlahArt,
                   nChanges: r.nChanges, versi: r.version, versiSesudah: r.versionAfter, ok: r.dryRun ? 'dry-run' : r.ok });
      console.log(`${i + 1}/${DAFTAR.length} ${r.dryRun ? '[DRY RUN]' : '[OK]'} ${item.assignment_id} ${r.code} | ada_keluarga sebelum: ${r.adaKeluargaSebelum} | ${r.jumlahArt} ART | ${r.nChanges} perubahan, ${PINDAH.map(([a, b]) => a + ' -> ' + b).join(', ')}`);
      //if (r.changes && r.changes.length) console.table(r.changes);
    }
  } catch (e) {
    hasil.push({ no: i + 1, assignmentId: item.assignment_id, ok: false, error: String(e) });
    console.warn(`${i + 1}/${DAFTAR.length} FAIL ${item.assignment_id} ${e}`);
  }
  if (i < DAFTAR.length - 1) await new Promise((r) => setTimeout(r, JEDA_MS));
  return jalankan(i + 1, hasil);
}

await FASIH.init({ assignmentId: DAFTAR[0].assignment_id });
//await FASIH.backup(DAFTAR.map((d) => d.assignment_id));          // cadangan semua record sebelum apa pun disentuh
const HASIL = await jalankan();
console.log(DRY_RUN ? '=== DRY RUN selesai — periksa, lalu set DRY_RUN = false ===' : '=== LIVE selesai ===');
console.table(HASIL);
