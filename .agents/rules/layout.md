# Aturan Tata Letak & Arsitektur Panel (Layout Architecture)

Dokumen ini mengatur struktur tampilan 3-panel terintegrasi pada **Global HL7 FHIR Learning Lab**.

---

## 1. Arsitektur 3-Panel Split Screen

Pada viewport mulai 1280 px (`xl`), aplikasi menggunakan tiga panel horizontal dalam tinggi viewport, dengan header/footer di luar area scroll panel:

1. **Panel Kiri (LeftCurriculumPanel — 248 px; 280 px mulai 1536 px)**:
   - Modul kurikulum step-by-step: 12 pelajaran terstruktur dalam 5 tingkat taksonomi.
   - Status pembelajaran (Completed, In Progress, Locked).
   - Katalog 35 resource FHIR dengan badge status adopsi nasional.
2. **Panel Tengah (CenterSandboxPanel — `minmax(0, 1fr)`)**:
   - Tab 1: **Interactive Normalization Sandbox** (SIMRS raw data input, normalizer controls, error highlights).
   - Tab 2: **Interactive Visual Pipeline** (@xyflow/react node graph menampilkan transformasi SIMRS -> FHIR -> SQL).
   - Indikator status normalisasi instan (Pass / Fail validation markers).
3. **Panel Kanan (RightInspectorPanel — 360 px; 400 px mulai 1536 px)**:
   - Tab 1: **FHIR JSON Inspector** (Tree view dan raw JSON dengan copy function).
   - Tab 2: **SQL-on-FHIR Console** (PGlite interactive SQL query runner & analytical views table explorer).
   - Tab 3: **Validation Errors & Warnings** (Rule-by-rule conformance log).

---

## 2. Invarian Responsif & Scrolling

- Panel desktop memiliki scrolling mandiri; scrollbar ramping memakai thumb slate terang di atas track transparan.
- Di bawah 1280 px, panel ditumpuk vertikal agar teks tetap terbaca. Navigasi bab dibatasi tinggi 420 px dengan scroll, ruang tengah minimal 720 px, dan inspector memiliki area 760 px dengan scroll mandiri.
- Jangan memaksakan minimum lebar gabungan panel yang melebihi viewport. Tabel/JSON yang lebar memiliki scroll lokal; halaman tidak ikut melebar.
- Header global berukuran mengikuti konten dan wrap pada layar kecil; pada desktop tetap terlihat karena berada di luar scroller ruang kerja.
- Panel memakai latar putih, kanvas slate sangat terang, dan border halus; tab/control dapat wrap tanpa menyembunyikan fungsi.
- Modals dan dialog overlay (jika digunakan) berpusat di layar, dengan kontras tema terang dan fokus keyboard yang terlihat.
