# Master Documentation Hub (`docs/`)

Selamat datang di pusat dokumentasi resmi **Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox**.

Dokumentasi repositori ini diorganisasi secara modular untuk memudahkan navigasi pengembang, agen AI, dan analis sistem.

---

## 1. Indeks Dokumen Utama

- **[Rencana Perbaikan & Audit Kepatuhan (`spec.md`)](spec.md)**:
  Rencana perbaikan FHIR R4 (4.0.1) dan SQL-on-FHIR 2.0.0: koreksi seluruh 12 bab dan 35 entri katalog, kontrak 26 concrete resource types/27 tabel analitik, prioritas implementasi, batas assessment SATUSEHAT, serta gerbang verifikasi independen dan smoke browser. Statusnya rencana, bukan sertifikasi atau laporan implementasi selesai.
- **[Status Dokumentasi & Conformance Ledger (`DOCUMENTATION_STATUS.md`)](DOCUMENTATION_STATUS.md)**:
  Matriks status dokumen hidup, status aturan kanonikal, dan log audit verifikasi berkala.
- **[Interactive Workflow Flowchart (`workflow-flowchart.html`)](workflow-flowchart.html)**:
  Diagram visual interaktif alur kerja tim (8 tahap: task, sync, push, pr, checks, merge, deploy, deploy prod).
- **[Dokumen Perencanaan Master (`../01_master_plan_architecture_and_fhir_normalization.md`)](../01_master_plan_architecture_and_fhir_normalization.md)**:
  Cetak biru arsitektur, 5 level pembelajaran FHIR, dan 5 hukum normalisasi SIMRS ke FHIR.
- **[Kurikulum & Data Schema (`../02_data_schema_curriculum_and_ai_agent_prompt.md`)](../02_data_schema_curriculum_and_ai_agent_prompt.md)**:
  Silabus 12 modul pembelajaran, struktur data mentah SIMRS, dan panduan prompt agen AI.

---

## 2. Aturan Operasional & Agen (`../.agents/`)

- **[Panduan Agen Utama (`../AGENTS.md`)](../AGENTS.md)**:
  Hierarki pembacaan konteks, layout repositori, dan matriks navigasi task.
- **[Aturan Alur Kerja Tim (`../.agents/rules/08-workflow-environments.md`)](../.agents/rules/08-workflow-environments.md)**:
  SOP operasional branching, larangan auto-push/merge, dan inventaris perintah harian.
- **[Master Manifest (`../.agents/rules/00-master-manifest.md`)](../.agents/rules/00-master-manifest.md)**:
  Keputusan arsitektur dan standar resmi yang diratifikasi.
- **[Arsitektur Teknis (`../.agents/rules/02-tech-and-architecture.md`)](../.agents/rules/02-tech-and-architecture.md)**:
  Spesifikasi stack Vite, React 18, TypeScript, Tailwind, PGlite WASM, dan Zustand.
- **[Standar Desain UI/UX (`../.agents/rules/10-anti-ai-slop-design.md`)](../.agents/rules/10-anti-ai-slop-design.md)**:
  Prinsip densitas data dan color code status adopsi nasional.
- **[Arsitektur Layout Panel (`../.agents/rules/layout.md`)](../.agents/rules/layout.md)**:
  Struktur tampilan 3-panel terintegrasi (Left Curriculum, Center Sandbox, Right Inspector).

---

## 3. Tooling & Skrip Otomasi (`../scripts/`)

- Lihat **[Tooling Inventory & Automation Guide (`../scripts/README.md`)](../scripts/README.md)** untuk dokumentasi lengkap eksekusi skrip CI, local dev runner, dan sinkronisasi Git.
