# Protokol Alur Kerja: Task Feature Branching, Command Local, Sync, Push, PR, Merge, Deploy, Deploy Prod, Rollback, Audit & Mode Debug

Aturan ini mengikat seluruh interaksi agen AI dan Pengguna (Product Owner) terkait lingkungan kerja, efisiensi eksekusi, deployment, dan version control pada repositori **Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox**.

---

## 0. Protokol Branching Two-Tier (`development` vs `main`) & Strict Main Protection Invariant

- **Arsitektur Two-Tier Branching (`development` vs `main`)**:
  - **Branch `development`**: Branch integrasi utama untuk pengembangan aktif dan staging. Seluruh feature branch baru dicabangkan dari dan di-merge kembali ke branch `development` ini.
  - **Branch `main`**: Branch produksi kanonikal live. **DILARANG KERAS melakukan push langsung ke branch `main` dari komputer lokal (`git push origin main` DILARANG KERAS)!** Branch `main` HANYA diperbarui melalui promosi resmi dari `development` saat pengguna secara eksplisit mengetik perintah `merge main`.
- **Siklus Task:** Pemilihan branch mengikuti §1; publikasi hanya §3, PR §4, merge §5, dan deployment §6. Scope koding/audit tidak otomatis mengotorisasi mutasi Git remote.
- **Larangan Mutlak Auto-Push & Auto-Merge (Strict Manual User Control)**:
  - **DILARANG KERAS AUTO-PUSH**: AI Agent **DILARANG** melakukan `git push` ke remote origin secara otomatis tanpa perintah eksplisit dari Pengguna. Perintah `git push` HANYA boleh dieksekusi apabila Pengguna secara eksplisit mengetik kata `push`!
  - **DILARANG KERAS AUTO-MERGE**: AI Agent **DILARANG** melakukan merge Pull Request secara otomatis tanpa perintah eksplisit dari Pengguna. Perintah merge HANYA boleh dieksekusi apabila Pengguna secara eksplisit mengetik kata `merge` atau `merge main`!
  - Seluruh pengerjaan koding dan modifikasi file dibatasi pada mesin lokal (`local host`). Setelah task selesai, AI Agent melaporkan perubahan di lokal dan menunggu instruksi manual Pengguna.
- **Radar Antrean PR Terbuka (Zero-Skipped PR Invariant)**: `sync`, `pr`, dan `merge` menampilkan PR tim yang terbuka sebagai informasi. Radar **bukan** izin me-merge semua PR sekaligus.
- **Satu Penanggung Jawab per Feature Branch (Single-Branch Focus)**: Task terkait tetap berada di feature branch aktif. Branch baru dicabangkan dari `development` yang bersih hanya setelah task sebelumnya selesai/merged atau pengguna secara eksplisit meminta branch baru.

---

## 1. Command `task <nama>` (Mencatat Task & Manajemen Branch Fitur)

- **Tujuan**: Memilih/membuat task dan mempertahankan branch kerja aktual.
- **Konvensi Penamaan Branch**: Gunakan awalan `feat/<nama-kebab-case>`, `fix/<nama-kebab-case>`, atau `chore/<nama-kebab-case>`.
- **Single-Branch Focus**: Jangan berpindah ke branch lama/rekan tanpa kesepakatan. Branch baru dibuat dari `development` yang telah diperbarui.
- **Safety**: Baca status Git sebelum mutasi. Working tree yang kotor dipertahankan, tidak di-stash atau di-reset otomatis tanpa izin.

---

## 2. Command `local` & Dev Server Lokal (Host Bun, Zero-Docker)

- **Tujuan**: Menjalankan dev server lokal Vite SPA dengan runtime Bun murni di mesin host tanpa kontainer Docker.
- **Zero-Docker Host Development**: PGlite menjalankan PostgreSQL in-memory/WASM langsung di browser; tidak memerlukan container Docker PostgreSQL eksternal untuk development lokal.
- **Port Scanner & Health Guard**: Runner `local` (`bun scripts/local.ts` atau `.\scripts\local.ps1`) otomatis memeriksa ketersediaan port 5173 (Vite dev) dan port dev lainnya, membersihkan proses zombie milik development (`node`, `bun`, `vite`), dan menyalakan frontend server.

---

## 3. Command `sync` (Sinkronisasi Tanpa Menulis Ulang Riwayat Tim)

- **Tujuan**: Memperbarui feature branch dengan commit terbaru dari tim tanpa melakukan rewrite history.
- **Perilaku**:
  - `main`/`development`: Fast-forward only dari remote branch yang sama (`origin/development` atau `origin/main`).
  - Feature branch: Fast-forward `origin/<branch>` terlebih dahulu, kemudian merge `origin/development`.
  - Tidak ada auto-stash, rebase, auto-push, atau auto-install package.
- **Ignored Paths Protection**: Memeriksa incoming tree terhadap file/folder ignored lokal untuk mencegah tabrakan/penimpaan file lokal pribadi.
- **Konflik Merge**: Jika terjadi konflik, proses berhenti di lokal untuk review manual. Agen atau developer meninjau diff, menyelesaikan konflik, menjalankan `git add -- <file-resolved>`, lalu `git merge --continue`.

---

## 4. Command `push` (Publikasi Feature Branch, Bukan Deployment)

- **Tujuan**: Mempublikasikan commit lokal ke remote repository pada branch fitur yang bersangkutan.
- **Prasyarat**: HANYA dijalankan atas perintah eksplisit `push` dari Pengguna.
- **Aturan Eksekusi**:
  - Dilarang force-push (`git push --force`).
  - Dilarang melakukan direct push ke branch `main` atau `development`.
  - Hanya men-stage file yang ditinjau sesuai task: `git add -- <explicit-task-files>`.
  - Membuat semantic commit yang deskriptif dan akurat.
  - Push hanya mengunggah commit ke branch fitur di GitHub; tidak men-deploy atau me-merge.

---

## 5. Command `pr` (Membuat Pull Request OPEN/Ready ke `development`)

- **Tujuan**: Mengajukan Pull Request resmi untuk branch fitur yang telah di-push ke branch target `development`.
- **Prasyarat**:
  - Branch fitur aktif, working tree bersih.
  - HEAD lokal sama persis dengan commit yang sudah di-push di `origin/<branch>`.
  - Precheck lokal wajib lolos (`tsc --noEmit`, lint/rules).
- **Aturan**:
  - PR baru dibuat berstatus `OPEN` (ready for review) dengan target base `development`.
  - PR tidak melakukan auto-push dan tidak mem-bypass precheck.

---

## 6. Command `merge` & `merge main` (Two-Tier Staging & Release Promotion)

### A. Command `merge [PR]` (Merge Feature PR ke `development`)
- Memilih PR branch aktif atau nomor PR yang ditentukan.
- **Kriteria Kelayakan**:
  - PR berstatus OPEN, non-draft, MERGEABLE.
  - Canonical CI (`CI Gate: Security, Rules, Tests & Build`) berstatus **SUCCESS**.
  - Pengecekan status checks wajib selesai (bukan pending/in-progress/failed).
- Merge dilakukan ke branch `development`. Tidak ada deployment otomatis yang menyertai merge.

### B. Command `merge main` (Promosi Rilis development → main)
- Menggabungkan perubahan dari branch `development` yang terverifikasi ke branch `main`.
- Membuat atau memilih release PR dari `development` ke `main`.
- Menunggu Canonical CI pada release PR lolos sebelum merge diselesaikan.

---

## 7. Command `deploy` & `deploy prod` (Deployment Staging & Produksi)

- **Command `deploy`**: Memperbarui lingkungan staging / preview dari branch `development` yang sudah lolos uji.
- **Command `deploy prod`**: Menjalankan alur rilis produksi kanonikal dari branch `main` (misal GitHub Actions workflow dispatch). Membutuhkan otorisasi eksplisit terpisah dari perintah merge.

---

## 8. Command `rollback` (Pemulihan yang Diotorisasi)

- Memerlukan konfirmasi lingkup pemulihan yang jelas: revert commit lokal vs revert commit remote yang sudah dipublikasikan.
- Untuk commit yang sudah dipublikasikan ke branch bersama, gunakan `git revert` untuk mempertahankan riwayat kolaborasi tanpa force-push.

---

## 9. Command `audit` (Audit Komprehensif FHIR & Kesehatan Monorepo)

Kapan pun Pengguna mengetik kata `audit`:
- **Tujuan**: Menjalankan evaluasi komprehensif kepatuhan standar HL7 FHIR R4, SQL-on-FHIR v2, integritas PGlite, dan kualitas kode tanpa menunggu konfirmasi lanjutan.
- **Langkah-langkah Audit**:
  1. Catat baseline working tree dan perubahan lokal pengguna.
  2. Periksa keselarasan schema FHIR, resource normalizer, dan analytical SQL flattener.
  3. Jalankan suite pengujian kanonikal: `bun test` dan typecheck `tsc --noEmit`.
  4. Jalankan validasi struktur repository: `bun scripts/check-repository-structure.ts`.
  5. Laporkan temuan secara faktual, eviden-first, mencantumkan jumlah pass/fail dan batas verifikasi.

---

## 10. Mode Debug vs Mode Default

- **Mode Default (Lean & Focused)**:
  - Eksekusi cepat, fokus pada tugas spesifik, laporan ringkas berbasis fakta dan tindakan konkret.
- **Mode Debug (Diagnostic & Deep Trace)**:
  - Menampilkan trace eksekusi mendalam, log query PGlite SQL, inspect AST / JSON payload lengkap untuk investigasi bug kompleks.
