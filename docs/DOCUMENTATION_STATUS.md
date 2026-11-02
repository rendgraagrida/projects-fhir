# Documentation Status & Conformance Ledger

Dokumen ini mencatat status terkini seluruh dokumen arsitektur, spesifikasi standar, aturan agen, dan log verifikasi pada **Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox**.

---

## 1. Status Dokumen Arsitektur & Spesifikasi

| Dokumen | Status | Pemilik Domain | Ringkasan Cakupan |
| :--- | :--- | :--- | :--- |
| `docs/spec.md` | **ACTIVE — PLAN / AUDIT** | Standards & Normalization | Rencana perbaikan FHIR R4/SQL-on-FHIR, matriks 12 bab/35 entri, pekerjaan per file dan gerbang penerimaan. Implementasi perbaikan belum dinyatakan selesai. |
| `01_master_plan_architecture_and_fhir_normalization.md` | **REFERENCE** | Master Architecture | Master blueprint sistem, arsitektur 5 level, dan 5 hukum normalisasi SIMRS ke FHIR. |
| `02_data_schema_curriculum_and_ai_agent_prompt.md` | **REFERENCE** | Curriculum & Data Schema | Struktur skema data mentah SIMRS, 12 modul kurikulum, dan prompt agen AI. |
| `docs/workflow-flowchart.html` | **ACTIVE** | DevOps & Workflow | Diagram alur kerja kolaborasi 8 tahap (task, sync, push, pr, checks, merge, deploy, deploy prod). |
| `docs/README.md` | **ACTIVE** | Master Index | Indeks navigasi utama seluruh dokumentasi repositori. |

---

## 2. Status Master Rules (`.agents/rules/`)

| Rule File | Status | Terakhir Ditinjau | Keterangan |
| :--- | :--- | :--- | :--- |
| `00-master-manifest.md` | **RATIFIED** | 2026-11-02 | Standar resmi (FHIR R4 4.0.1, SQL-on-FHIR v2, SATUSEHAT), 5 hukum normalisasi. |
| `02-tech-and-architecture.md` | **RATIFIED** | 2026-11-02 | Arsitektur Vite, React 18, TypeScript, Tailwind, PGlite WASM, Zustand store. |
| `08-workflow-environments.md` | **RATIFIED** | 2026-11-02 | SOP operasional branching Two-Tier, larangan auto-push/merge, command inventory. |
| `10-anti-ai-slop-design.md` | **RATIFIED** | 2026-11-02 | Tema putih, aksen teal, font sistem, teks utama 14 px/metadata minimal 12 px, warna status kontras dan fokus keyboard. |
| `layout.md` | **RATIFIED** | 2026-11-02 | Tiga panel mulai 1280 px; susunan vertikal pada layar kecil, scroll lokal tabel/JSON dan panel desktop mandiri. |

---

## 3. Log Verifikasi Kanonikal (Audit Trail)

Hasil test/build historis di bawah tidak membuktikan seluruh implementasi memenuhi FHIR atau SATUSEHAT. Penerimaan rencana perbaikan harus menggunakan bukti baru sesuai `docs/spec.md` §10.E; hasil yang belum dijalankan tidak boleh dicatat sebagai lulus.

| Tanggal | Target Verifikasi | Hasil | Keterangan |
| :--- | :--- | :--- | :--- |
| 2026-11-02 | FHIR R4 & SQL-on-FHIR Tests | **54 PASSED, 0 FAILED** | 1.671 assertions pada `tests/fhir-lab.test.ts` berhasil diverifikasi dengan runtime Bun. |
| 2026-11-02 | TypeScript Strict Typecheck | **0 ERRORS** | `tsc --noEmit` lolos tanpa diagnostik error. |
| 2026-11-02 | Production Client Build | **SUCCESS** | `vite build` menghasilkan artefak client dan WASM PGlite di folder `dist/`. |
| 2026-11-02 | Workflow Adoption | **COMPLETED** | Tooling `scripts/` (local, ci, sync, pr, task) dan panduan `AGENTS.md` diadopsi. |
| 2026-11-02 | Light UI — Typecheck & Build | **SUCCESS** | `bun run build` menjalankan `tsc --noEmit` dan Vite production build. Terdapat warning bundler PGlite Node externals/eval dan ukuran chunk >500 kB; build selesai. Test suite tidak dijalankan ulang pada perubahan visual ini. |
| 2026-11-02 | Light UI — Browser Smoke | **PASS** | Tujuh mode tengah dan empat tab inspector dibuka; ketiga rumah sakit dapat dipilih; filter Partial menampilkan 2 bab dan ekspansi bab berfungsi. Query `SELECT COUNT(*) AS patient_count FROM fhir_patient;` mengembalikan 4. Graph menampilkan 32 node pada skenario Surabaya dan kontrol zoom berfungsi. |
| 2026-11-02 | Light UI — Responsive & Typography | **PASS** | Seluruh tujuh mode diperiksa pada lebar 390, 768, 1280, dan 1600 px tanpa overflow horizontal tingkat halaman. Computed font sesuai stack Segoe UI/Cascadia Code, body 14 px dan JSON 12 px; tidak ditemukan teks terlihat <12 px pada tampilan sandbox akhir. Screenshot desktop/mobile diperiksa; tidak ada error browser baru selama smoke akhir. |
