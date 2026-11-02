# Master Manifest: Keputusan Arsitektur & Standar Kanonikal

Dokumen ini adalah aturan kanonikal arsitektur untuk **Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox**. `docs/spec.md` menjabarkan kontrak implementasi dan paket kerja Fase 2; jika terjadi perbedaan, versi R4/SQL-on-FHIR yang dipin dan aturan di sini mengalahkan contoh atau klaim historis.

## 1. Baseline standar dan batas klaim

1. **HL7 FHIR R4 4.0.1** adalah model klinis utama. Resource, datatype, pilihan `[x]`, kardinalitas, invariant, binding, reference, JSON, dan Bundle harus dinilai terhadap definisi R4 4.0.1.
2. **SQL-on-FHIR v2 2.0.0** adalah kontrak proyeksi. Runner menggunakan ViewDefinition standar, FHIRPath dengan model R4, nested `select`, `forEach`, `forEachOrNull`, sibling cross-join, union dengan skema konsisten, typed collections, dan key functions yang didefinisikan spesifikasi.
3. **SATUSEHAT** dinilai berdasarkan use case, profil, versi, terminologi, environment, dan bukti yang disebutkan. Financial/claims, Appointment, dan workflow **tidak boleh** disebut tidak diatur secara nasional secara umum. Dokumentasi nasional atau sandbox bukan bukti production conformance.
4. Data sintetis, URI lokal, KFA/IHS contoh, dan kode yang belum dibuktikan harus berstatus `synthetic`, `unverified`, atau `not-assessed`; namespace resmi tidak boleh dipakai untuk kode lokal.
5. Aplikasi ini bukan server FHIR, terminology server, payment gateway, digital-signature verifier, atau integrasi endpoint nasional. Tidak ada pengiriman SATUSEHAT otomatis.

## 2. Inventaris kanonikal pipeline

### 2.1 Resource graph

Graph normalisasi menghasilkan tepat **26 concrete top-level FHIR R4 resource types** berikut:

`Organization`, `Patient`, `Practitioner`, `Location`, `EpisodeOfCare`, `ServiceRequest`, `Encounter`, `Consent`, `Provenance`, `Condition`, `Procedure`, `Observation`, `DiagnosticReport`, `Medication`, `MedicationRequest`, `MedicationDispense`, `Composition`, `Appointment`, `Coverage`, `CoverageEligibilityResponse`, `Account`, `ChargeItem`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit`, `MeasureReport`.

`Bundle` adalah envelope transaksi/inspeksi terpisah dan bukan resource table. `CoverageEligibilityRequest` hanya didukung sebagai **contained resource** di dalam `CoverageEligibilityResponse` pada skenario eligibility; id contained `eligibility-request`, reference `#eligibility-request`, divalidasi dalam owner scope, dan tidak mendapat tabel SQL/top-level row sendiri.

### 2.2 Analytical persistence

Pipeline mempertahankan tepat **27 analytical PostgreSQL tables**: satu tabel untuk tiap 26 concrete type ditambah `fhir_claim_item` untuk `Claim.item`. Bundle dan contained CoverageEligibilityRequest tidak menambah tabel. Setiap row menyimpan `raw_fhir` JSONB dari resource sumber yang tepat, provenance `(resourceType,id)`, dataset/hospital scope, serta timestamp/lexeme yang diperlukan. `fhir_claim_item.raw_fhir` adalah Claim induk; item sequence menjadi child identity.

Pipeline mempertahankan tepat **3 analytical views** dengan nama registry kanonikal:

- `vw_fhir_clinical_diagnosis_recap`
- `vw_fhir_financial_claim_recap`
- `vw_fhir_clinical_to_claim_audit`

Nama legacy `view_patient_clinical_summary`, `view_hospital_financial_summary`, dan `view_diagnostic_lab_summary` tidak boleh dipakai sebagai alias baru atau klaim aktif.

## 3. Lima hukum normalisasi

1. **Dekomposisi entitas:** row SIMRS dipecah menjadi resource FHIR dengan boundary dan lifecycle masing-masing.
2. **Standardisasi terminologi:** map kode lokal ke system/code yang dibuktikan; kode lokal memakai CodeSystem URI proyek.
3. **Integritas referensi:** relasi dinyatakan dengan FHIR Reference, typed target, identity scope, dan provenance sumber.
4. **Validasi struktur/invariant:** core R4, profile `lab-r4`, dan national assessment dipisah; optional core tidak boleh difabrikasi menjadi mandatory.
5. **Flattening analitik:** proyeksi SQL-on-FHIR mempertahankan resource key, raw provenance, temporal precision, numeric precision, dan null/collection semantics.

## 4. Invarian runtime, keamanan, dan lingkungan

- **Zero-Docker host development:** `bun run dev` menjalankan Vite pada host; Docker PostgreSQL bukan dependency.
- **PGlite WASM in-browser:** PGlite menjalankan DDL/DML, parameterized query, transaction, migration, dan tiga views di browser. Snapshot invalid tidak menggantikan last-valid snapshot.
- **Pure client-side state:** Zustand mengoordinasikan curriculum, normalized graph, assessments, SQL history, dan merge state; satu canonical graph revision dipakai oleh JSON, validator, flattener, DB, dan UI.
- **No clinical fabrication:** validator/flattener/database tidak boleh memberi default status, code, date, inforce, benefit, atau amount. Missing tetap null atau menghasilkan issue sesuai profile.
- **Input/query safety:** query values harus parameterized; table/column names berasal dari internal registry; SQL console adalah fitur edukasi lokal, bukan jaminan production isolation. Raw FHIR ditampilkan text-safe, tanpa HTML injection.
- **Auditability:** issue memuat path, source, rule/profile, severity, dan standard URL/version. National result default `not-assessed` tanpa named profile + terminology/master-ID evidence.
- **Workflow:** aturan branch, push, merge, deploy, rollback, dan manual user control di `08-workflow-environments.md` tidak boleh diubah oleh spesifikasi fitur.

## 5. Kontrak lintas modul yang wajib dipatuhi

- Normalizer menerima seed SIMRS eksplisit dan menghasilkan `NormalizedHospitalDataset` sinkron/pure; malformed ordinary input menghasilkan `NormalizationError` dengan hospital/source/row/field.
- Reference index mengindeks `(resourceType,id)`, Bundle fullUrl, dan contained owner scope. Resolver membedakan `resolved`, `external`, `logical`, `unresolved`, dan `invalid`; hanya visitor Reference yang boleh di-rewrite.
- Validator memisahkan `coreR4`, `labProfile`, dan `national` assessment. Enam `ValidationRuleId` adalah **application rule groups**, bukan invariant HL7 resmi.
- Flattener menggunakan ViewDefinition portable dan `ProjectionDefinition` lokal. Unsupported FHIRPath, union schema mismatch, scalar multiplicity, dan key collision adalah typed error, bukan empty/default result.
- PGlite hanya sync graph yang telah memenuhi persistence profile, dalam satu transaction/migration version. Merge patient atomik terhadap seluruh graph, Bundle, named handles, store, dan DB.

## 6. Source precedence

Standar R4 4.0.1 dan SQL-on-FHIR 2.0.0 > profil nasional bernama/berversi > `lab-r4` local profile > seed mapping > UI display copy. Temuan historis, kode contoh, dan badge tidak dapat menggantikan source normatif. Setiap national evidence harus memuat URL, versi/tanggal, use case, environment (`documented|sandbox|production|not-assessed`), dan limitation.
