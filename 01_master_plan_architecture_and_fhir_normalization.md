# MASTER PLAN & TECHNICAL SPECIFICATION (v10.0 - Global FHIR Blueprint for Indonesia)
## DOKUMEN 1: Arsitektur Sistem, Model Pembelajaran FHIR, Aturan Kepatuhan Standar Global, & Spesifikasi Mapping Normalisasi Data

**Proyek:** Global HL7 FHIR (R5/R4 Standard), SQL-on-FHIR v2 (`fhir-data-pipes`) & National Healthcare Normalization Learning Lab  
**Referensi Standar Resmi yang Dipatuhi:**
1. **HL7 FHIR Official Specification (Latest R5 / R4 Baseline):** `https://hl7.org/fhir/`
2. **OHS Foundation `fhir-data-pipes` & HL7 SQL-on-FHIR v2 Specification:** `https://ohs-foundation.github.io/fhir-data-pipes/`
3. **SATUSEHAT Kemenkes RI Playbook (Baseline Komponen Nasional):** `https://satusehat.kemkes.go.id/platform/docs/id/playbook/`

---

## 1. Visi Arsitektur & Point of View (POV) Strategis Proyek

Proyek ini membangun aplikasi web pembelajaran interaktif (*Interactive Web Learning Model*) sekaligus simulator normalisasi data rekam medis rumah sakit (*Data Normalization Sandbox*) yang menyatukan berbagai struktur database SIMRS di Indonesia ke dalam **PostgreSQL** menggunakan acuan standar **HL7 FHIR terbaru**.

### Paradigma Utama ("Global-First Pioneer Blueprint for Indonesia"):
1. **Mengadopsi Standar Resmi HL7 FHIR Secara Utuh (Level 1 s/d Level 5):**
   Di Indonesia saat ini, implementasi nasional (SATUSEHAT) baru mencakup sebagian domain administrasi dan klinis dasar, sementara domain krusial lain seperti **Financial/Claims (`Coverage`, `Account`, `ChargeItem`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit`)**, **Workflow Terpadu**, dan **Clinical Reasoning / Quality Reporting (`Measure`, `MeasureReport`)** belum memiliki aturan FHIR baku di Indonesia.
2. **Sistem Kita Sebagai Cetak Biru Standar Masa Depan:**
   Alih-alih membuat aturan lokal yang spekulatif atau menunggu regulasi lokal selesai, **sistem kita mengimplementasikan langsung standar resmi HL7 FHIR Global terbaru** untuk seluruh komponen yang belum diatur di Indonesia. Dengan demikian, arsitektur aplikasi dan tabel PostgreSQL yang kita bangun menjadi pionir yang siap diadopsi secara nasional kapan pun Indonesia memperluas cakupan interoperabilitasnya (termasuk integrasi klaim JKN/BPJS dan asuransi berbasis FHIR).
3. **Transparansi Status Adopsi pada Setiap Modul & Tabel:**
   Setiap *Resource* FHIR dan modul pembelajaran wajib menampilkan indikator status secara eksplisit:
   * 🟢 **`[IMPLEMENTED IN INDONESIA - SATUSEHAT BASELINE]`**: Komponen yang sudah diimplementasikan di Indonesia dan telah memiliki profil nasional (tetap divalidasi terhadap standar inti HL7 FHIR).
   * 🟡 **`[PARTIAL IN INDONESIA - EXTENDED BY GLOBAL FHIR]`**: Komponen yang baru diterapkan sebagian di Indonesia, dan dilengkapi secara utuh pada sistem kita menggunakan spesifikasi resmi HL7 FHIR.
   * 🔵 **`[PIONEER GLOBAL FHIR STANDARD - READY FOR INDONESIA ADOPTION]`**: Komponen resmi HL7 FHIR (seperti *Financial/Claim Module*, *Clinical Decision Support*, dan *Quality Measures*) yang belum diimplementasikan di Indonesia, namun **telah dibangun secara lengkap pada sistem kita mengikuti standar resmi HL7 FHIR terbaru**.

---

## 2. Model Pembelajaran Kognitif Step-by-Step (Memahami FHIR dari Nol)

Agar pengembang sistem, tim TI rumah sakit, maupun analis data yang terbiasa dengan tabel relasional (SQL) dapat memahami FHIR dengan mudah, aplikasi menggunakan **Model Pembelajaran 5 Tahap**:

### A. Analogi "Balok Lego Standar Global" (*Modular Resources*)
Pada SIMRS konvensional, data disimpan dalam tabel-tabel lokal yang kaku dan berbeda di tiap rumah sakit. HL7 FHIR memecah informasi kesehatan menjadi entitas modular standar yang disebut **Resource**:
1. **Domain Foundation & Security (Level 1 & 2):** Struktur dasar `Resource`, tipe data (`Coding`, `CodeableConcept`, `Quantity`, `Money`, `Period`), `Extension`, pembungkus transaksi `Bundle`, serta privasi dan jejak audit (`Consent`, `Provenance`).
2. **Domain Administration (Level 3):** Entitas utama layanan kesehatan meliputi `Patient` (Pasien), `Practitioner` (Tenaga Medis), `Organization` (Rumah Sakit / Penjamin Asuransi), `Location` (Ruangan/Poli/Bed), `HealthcareService`, `EpisodeOfCare`, `Encounter` (Kunjungan), dan `Device`.
3. **Domain Clinical, Diagnostics & Medications (Level 4A):** Bukti medis utama yang mencakup `Condition` (Diagnosis/Masalah Klinis), `Procedure` (Tindakan/Operasi), `Observation` (Tanda Vital & Hasil Lab), `DiagnosticReport` (Laporan Penunjang), `Medication`, `MedicationRequest`, `MedicationDispense`, `AllergyIntolerance`, dan `Composition` (Dokumen Resume Medis).
4. **Domain Workflow (Level 4B):** Orkestrasi alur layanan dan rujukan melalui `ServiceRequest`, `Appointment`, `Schedule`, `Slot`, dan `Task`.
5. **Domain Financial & Claims (Level 4C - Pioneer Global Standard):** Siklus finansial dan penjaminan klaim medis yang terhubung langsung ke bukti klinis melalui `Coverage` (Kepesertaan Jaminan Kesehatan), `CoverageEligibilityRequest`, `CoverageEligibilityResponse`, `Account` (Akun Tagihan Pasien), `ChargeItem` (Item Biaya Layanan), `Claim` (Pengajuan Klaim), `ClaimResponse` (Keputusan Adjudikasi/Verifikasi Klaim), dan `ExplanationOfBenefit` (Rincian Penyelesaian Klaim).
6. **Domain Clinical Reasoning & Quality (Level 5 - Pioneer Global Standard):** Standar evaluasi mutu layanan dan panduan klinis terkomputasi melalui `PlanDefinition`, `Measure`, dan `MeasureReport`.

### B. Lima Hukum Normalisasi Data ke HL7 FHIR (*The 5 Normalization Laws*)

| Tahap | Kondisi Data Mentah (SIMRS Rumah Sakit) | Aturan Normalisasi Standar HL7 FHIR |
| :--- | :--- | :--- |
| **1. Normalisasi Identitas (`Identifier`)** | Nomor identitas (NIK, No. RM, No. Asuransi/SEP) tersebar di berbagai kolom dengan penamaan berbeda. | Seluruh identitas dipetakan ke dalam array `identifier[]` yang wajib memiliki pasangan URI namespace `system` dan string `value`. |
| **2. Normalisasi Kamus Kode (`CodeableConcept`)** | Kode diagnosis, pemeriksaan, obat, dan kategori biaya ditulis dengan teks bebas atau kode lokal RS. | Setiap konsep dikodekan ke dalam `CodeableConcept` (`coding[]: [{ system, code, display }]`) menggunakan sistem terminologi standar resmi (`ICD-10`, `ICD-9-CM`, `LOINC`, `SNOMED-CT`, `UCUM`, `KFA`, dan `HL7 Terminology`). |
| **3. Normalisasi Tipe Data & Polimorfisme (`value[x]` & `Money`)** | Angka hasil lab bercampur dengan teks satuan, tensi digabung `"120/80"`, dan nominal biaya ditulis tanpa standar mata uang. | Menggunakan tipe polimorfik standar (`valueQuantity` dengan satuan UCUM, `valueCodeableConcept`, `valueString`), memecah pemeriksaan multi-komponen ke dalam `component[]`, dan membungkus seluruh nilai finansial dengan tipe `Money` (`{ value, currency: "IDR" }`). |
| **4. Normalisasi Relasi & Rantai Bukti (`Reference`)** | Tabel-tabel dihubungkan dengan *Foreign Key* lokal yang tidak seragam, serta tabel klaim terpisah dari tabel rekam medis klinis. | Menghubungkan antar-Resource menggunakan objek `Reference` (`{ reference: "ResourceType/id" }`), sehingga resource finansial (`ChargeItem`, `Claim`) merujuk langsung ke bukti klinisnya (`Encounter`, `Condition`, `Procedure`, `Observation`, `Composition`). |
| **5. Normalisasi Analitik Relasional (`SQL-on-FHIR v2`)** | Struktur JSON FHIR yang bersarang (*nested*) tidak dapat langsung di-query dengan SQL biasa untuk rekapitulasi lintas RS. | Menggunakan spesifikasi deklaratif `ViewDefinition` (`fhir-data-pipes`) berbasis **FHIRPath** untuk meratakan (*flatten*) parameter global FHIR ke dalam tabel relasional PostgreSQL. |

### C. Tabel Translasi Konsep Database Relasional (SQL) ke HL7 FHIR

| Konsep Database Relasional (PostgreSQL) | Padanan Standar HL7 FHIR | Prinsip Kepatuhan Utama |
| :--- | :--- | :--- |
| **Nama Tabel (`Table`)** | **`resourceType`** | Nama Resource selalu ditulis dalam *PascalCase* tunggal (contoh: `"Patient"`, `"Encounter"`, `"Claim"`). |
| **Primary Key (`id`)** | **Logical `id` + `identifier[]`** | `id` adalah kunci teknis di server/tabel (`getResourceKey()`), sedangkan nomor identitas resmi disimpan di dalam array `identifier[]`. |
| **Foreign Key (`*_id`)** | **`Reference`** | Tautan eksplisit antar-Resource yang diekstrak menjadi kolom FK di PostgreSQL menggunakan fungsi `.getReferenceKey('ResourceType')`. |
| **Tabel Referensi / Enum** | **`Coding` & `CodeableConcept`** | Mengacu pada URI `CodeSystem` resmi. Mendukung *multiple coding* di dalam satu elemen `CodeableConcept` (misalnya menyimpan kode DRG/grouper global berdampingan dengan kode nasional). |
| **Kolom Spesifik Lokal** | **`extension[]`** | Penambahan elemen di luar atribut inti FHIR wajib menggunakan struktur `Extension` dengan `url` definisi struktur yang sah. |
| **Transaksi Database (`BEGIN..COMMIT`)** | **`Bundle` (`type: "transaction"`)** | Paket pengiriman multi-resource secara atomik dengan urutan eksekusi HTTP standar: `DELETE` -> `POST` -> `PUT` -> `GET`. |

---

## 3. Matriks Komponen Lengkap HL7 FHIR & Status Implementasinya

| Level FHIR | Kategori / Modul | Daftar Resource FHIR yang Dibangun di Aplikasi | Status di Indonesia Saat Ini | Implementasi pada Sistem Kita (Global FHIR Blueprint) |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | Foundation | `Resource`, `Extension`, `Bundle` | 🟢 **Sudah Diimplementasikan** | Mengikuti aturan inti HL7 FHIR (termasuk invariant transaksi `Bundle` `bdl-3` dan ekstensi wilayah administratif resmi). |
| **Level 2** | Terminology & Security | `CodeSystem`, `ValueSet`, `ConceptMap`, `Consent`, `Provenance` | 🟢 **Terminology**<br>🟡 **Security (Sebagian)** | Menggunakan kamus standar internasional & nasional, serta mengimplementasikan `Consent` dan `Provenance` (`target[]`, `recorded`, `agent[].who`) sesuai standar resmi HL7 FHIR. |
| **Level 3** | Administration | `Patient`, `Practitioner`, `Organization`, `Location`, `HealthcareService`, `EpisodeOfCare`, `Encounter`, `Device` | 🟢 **Sudah Diimplementasikan**<br>🟡 **`Device` (Sebagian)** | Mengakomodasi parameter nasional (NIK, IHS Number, wilayah Kemendagri) sekaligus atribut lengkap HL7 FHIR (`Encounter.diagnosis[]`, `Encounter.hospitalization`, `Patient.link[]`). |
| **Level 4A** | Clinical, Diagnostics & Medications | `Condition`, `Procedure`, `Observation`, `DiagnosticReport`, `Specimen`, `ImagingStudy`, `Medication`, `MedicationRequest`, `MedicationDispense`, `AllergyIntolerance`, `Composition` | 🟢 **Sudah Diimplementasikan** | Menerapkan rantai klinis utuh sesuai HL7 FHIR (termasuk `Observation.component[]` dengan invariant `obs-7`, rantai `authorizingPrescription`, serta `Composition.section[]` dengan invariant `cmp-1`). |
| **Level 4B** | Workflow | `ServiceRequest`, `Appointment`, `Schedule`, `Slot`, `Task` | 🟡 **`ServiceRequest` (Sebagian)**<br>🔵 **Lainnya Belum Baku** | Mengimplementasikan siklus permintaan layanan/rujukan (`ServiceRequest`) dan penjadwalan antrean (`Schedule`, `Slot`, `Appointment`) sesuai spesifikasi resmi HL7 FHIR Workflow. |
| **Level 4C** | **Financial & Claims** | `Coverage`, `CoverageEligibilityRequest`, `CoverageEligibilityResponse`, `Account`, `ChargeItem`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit` | 🔵 **Belum Diimplementasikan di SATUSEHAT** | **Fokus Pionir Sistem Kita:** Mengimplementasikan secara penuh modul finansial & klaim sesuai standar resmi HL7 FHIR (`hl7.org/fhir/financial-module.html`) untuk menormalisasi kepesertaan asuransi/JKN, rincian biaya layanan RS, pengajuan klaim, hingga adjudikasi klaim. |
| **Level 5** | Clinical Reasoning & Quality | `PlanDefinition`, `GuidanceResponse`, `Measure`, `MeasureReport` | 🔵 **Belum Diimplementasikan di SATUSEHAT** | **Fokus Pionir Sistem Kita:** Mengimplementasikan pelaporan indikator mutu rumah sakit (`Measure` & `MeasureReport`) dan evaluasi aturan klinis-finansial berbasis standar resmi HL7 FHIR. |

---

## 4. Sepuluh Aturan Kepatuhan Standar Resmi HL7 FHIR & SQL-on-FHIR v2 (Strict Conformance Rules)

1. **Kepatuhan Struktur Identitas & Ekstensi Resmi (`Patient`, `Practitioner`, `Organization`):**
   * Mendukung multipel `identifier[]` dengan sistem URI resmi (`https://fhir.kemkes.go.id/id/nik`, `https://fhir.kemkes.go.id/id/ihs-number`, serta namespace standar untuk nomor rekam medis dan nomor kepesertaan jaminan kesehatan).
   * Pada `Patient.address[].extension[]`, kode wilayah administratif menggunakan URL `https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode` dengan sub-ekstensi (`province`, `city`, `district`, `village`, `rt`, `rw`) bertipe `valueCode`.
   * Mendukung penggabungan rekaman pasien duplikat/darurat menggunakan atribut standar HL7 FHIR `Patient.link[]` (`type: "replaces" | "replaced-by" | "refer" | "seealso"`).

2. **Kepatuhan Struktur Kunjungan (`Encounter`):**
   * `Encounter.status` menggunakan kode resmi (`planned | arrived | triaged | in-progress | onleave | finished | cancelled`).
   * `Encounter.class` menggunakan kode standar `http://terminology.hl7.org/CodeSystem/v3-ActCode` (`AMB`, `EMER`, `IMP`).
   * Peran dan urutan prioritas diagnosis kunjungan disimpan secara standar di dalam **`Encounter.diagnosis[]`** yang memuat `condition` (`Reference(Condition)`), `use` (`http://terminology.hl7.org/CodeSystem/diagnosis-role`: `AD` = Admission, `DD` = Discharge, `CC` = Chief Complaint, `CM` = Comorbidity), dan `rank` (integer positif `1..n`).
   * Cara pulang pasien disimpan pada `Encounter.hospitalization.dischargeDisposition` menggunakan sistem standar `http://terminology.hl7.org/CodeSystem/discharge-disposition` (`home`, `other-hcf`, `aadvice`, `exp`).

3. **Kepatuhan Bukti Klinis & Diagnostik (`Condition`, `Procedure`, `Observation`, `DiagnosticReport`):**
   * `Condition` wajib memiliki `clinicalStatus` (`http://terminology.hl7.org/CodeSystem/condition-clinical`), `verificationStatus` (`http://terminology.hl7.org/CodeSystem/condition-ver-status`), `category`, `code` (ICD-10 / SNOMED-CT), `subject`, dan `encounter`.
   * `Observation` wajib memiliki `status`, `category` (`http://terminology.hl7.org/CodeSystem/observation-category`), `code` (LOINC), `subject`, `encounter`, dan `performer[]`.
   * **Aturan Invariant `obs-7`:** Untuk pemeriksaan panel multi-komponen seperti Tekanan Darah (LOINC `85354-9`), nilai Sistolik (`8480-6`) dan Diastolik (`8462-4`) wajib diletakkan di dalam `Observation.component[]` dengan `valueQuantity` bersatuan UCUM `mm[Hg]`, dan properti `value[x]` di level root wajib dikosongkan.
   * `DiagnosticReport` wajib mencantumkan `status`, `category`, `code`, `subject`, `encounter`, dan menautkan seluruh objek pengamatan di dalam `result[]` (`Reference(Observation)`).

4. **Kepatuhan Rantai Farmasi & Dokumen Resume Medis (`Medication`, `MedicationRequest`, `MedicationDispense`, `Composition`):**
   * `Medication` menggunakan kode standar (`http://sys-ids.kemkes.go.id/kfa` atau kode standar internasional) beserta ekstensi tipe obat (`NC` / `EP`).
   * `MedicationRequest` dan `MedicationDispense` merujuk ke `Medication/{id}` melalui `medicationReference`. `MedicationDispense` wajib menautkan `authorizingPrescription[]` ke `MedicationRequest/{id}` dan menggunakan objek `SimpleQuantity` pada `quantity` serta `daysSupply`.
   * **Aturan Invariant `cmp-1` pada `Composition`:** Dokumen ringkasan pulang (`LOINC 18842-5`) wajib memiliki `status`, `type`, `subject`, `encounter`, `date`, `author[]`, `title`, dan array `section[]` di mana setiap seksi wajib memiliki minimal salah satu dari `entry[]` (`Reference`), `text` (narasi XHTML), atau `emptyReason` (`http://terminology.hl7.org/CodeSystem/list-empty-reason`).

5. **Kepatuhan Standar Global FHIR Financial — Hulu Kepesertaan & Tagihan (`Coverage`, `CoverageEligibilityResponse`, `Account`, `ChargeItem`):**
   * **`Coverage`**: Wajib mencantumkan `status` (`active | cancelled | draft`), `subscriberId`, `beneficiary` (`Reference(Patient)`), `payor[]` (`1..* Reference(Organization)`), `type` (`http://terminology.hl7.org/CodeSystem/v3-ActCode`), dan `class[]` (`http://terminology.hl7.org/CodeSystem/coverage-class`: `plan`, `class`, `group`).
   * **`CoverageEligibilityResponse`**: Wajib mencantumkan 7 atribut mandatory HL7 FHIR (`status`, `purpose`, `patient`, `created`, `insurer`, `outcome`, dan `insurance[].coverage`).
   * **`Account` & `ChargeItem`**: Setiap item layanan/tindakan/obat yang ditagihkan dicatat sebagai `ChargeItem` (`status`, `code` bertipe `CodeableConcept`, `subject`, `context` merujuk ke `Encounter`, `account[]` merujuk ke `Account`, `quantity`, `priceOverride` bertipe `Money` dengan `currency: "IDR"`, dan `supportingInformation[]` yang merujuk ke resource bukti klinis `Procedure`/`Observation`/`MedicationDispense`).

6. **Kepatuhan Standar Global FHIR Financial — Pengajuan Klaim (`Claim`):**
   * **`Claim` Mandatory Elements**: Wajib mencantumkan `status`, `type` (`http://terminology.hl7.org/CodeSystem/claim-type`: `institutional | oral | pharmacy | professional | vision`), `use` (`claim | preauthorization | predetermination`), `patient`, `created`, `provider`, `priority` (`http://terminology.hl7.org/CodeSystem/processpriority`), dan `insurance[]` (`sequence`, `focal`, `coverage`).
   * **Rantai Bukti Klinis di Dalam `Claim`**:
     * `Claim.diagnosis[]`: Memuat `sequence` (`1..n`), `diagnosisReference` (`Reference(Condition)`), `type[]` (`http://terminology.hl7.org/CodeSystem/ex-diagnosistype`: `principal`, `admitting`, `comorbidity`, `discharge`), dan `packageCode` (`CodeableConcept` untuk menyimpan kode pengelompokan DRG/CBG).
     * `Claim.procedure[]`: Memuat `sequence` dan `procedureReference` (`Reference(Procedure)`).
     * `Claim.supportingInfo[]`: Memuat `sequence`, `category` (`http://terminology.hl7.org/CodeSystem/claiminformationcategory`), dan `valueReference` (menunjuk ke `Composition`, `Observation`, atau `ServiceRequest`).
   * **Aturan `Claim.item[]` & `Claim.total` (`0..1 Money`)**:
     * Setiap elemen `Claim.item[]` wajib memiliki `sequence` (`1..1`), **`productOrService` (`1..1 Mandatory` `CodeableConcept`)**, `category` (`http://terminology.hl7.org/CodeSystem/ex-benefitcategory`), `encounter[]` (`Reference(Encounter)`), `diagnosisSequence[]`, `procedureSequence[]`, `informationSequence[]`, dan `net` (`Money` dalam `"IDR"`).
     * Di level root `Claim`, properti **`total`** memiliki kardinalitas **`0..1` dan bertipe `Money` secara langsung** (`"total": { "value": 11500000, "currency": "IDR" }`), sehingga ekspresi FHIRPath pengekstraknya adalah `total.value`.

7. **Kepatuhan Standar Global FHIR Financial — Adjudikasi & Penyelesaian Klaim (`ClaimResponse` & `ExplanationOfBenefit`):**
   * **`ClaimResponse`**: Wajib memiliki 7 atribut mandatory (`status`, `type`, `use`, `patient`, `created`, `insurer`, dan `outcome`: `queued | complete | error | partial`), atribut `request` (`Reference(Claim)`), `disposition`, `addItem[]` (untuk item/komponen tarif tambahan yang disetujui penjamin), `processNote[]`, serta array **`total[]`** (`0..* BackboneElement`) yang memisahkan `category` (`http://terminology.hl7.org/CodeSystem/adjudication`: `submitted` vs `benefit`) dan `amount` (`Money`).
   * **`ExplanationOfBenefit` (EOB)**: Wajib memiliki 8 atribut mandatory di level root (`status`, `type`, `use`, `patient`, `created`, `insurer`, `provider`, `outcome`) serta array mandatory **`insurance[]` (`1..*`)** yang memuat `focal` (`boolean`) dan `coverage` (`Reference(Coverage)`).

8. **Kepatuhan Standar Global Level 5 (`Measure` & `MeasureReport`):**
   * `MeasureReport` wajib mencantumkan `status` (`complete | pending | error`), `type` (`individual | subject-list | summary`), `measure` (canonical URL), `period`, serta `group[].population[]` (`initial-population`, `denominator`, `numerator`) dan `measureScore` (`Quantity`).

9. **Kepatuhan Spesifikasi `SQL-on-FHIR v2` (`ViewDefinition` & `fhir-data-pipes`):**
   * Menggunakan fungsi standar `getResourceKey()` untuk mengekstrak Primary Key dan `getReferenceKey('ResourceType')` (atau `getReferenceKey()` tanpa argumen untuk referensi polimorfik) untuk mengekstrak Foreign Key.
   * Menggunakan `.exists(...)` saat memfilter koleksi `coding[]` di dalam `.where(...)`, menutup ekspresi skalar dengan `.first()`, serta menggunakan `forEach` / `forEachOrNull` di dalam sub-blok `select` untuk meratakan array multi-baris (seperti `Claim.item[]` ke tabel `fhir_claim_item` dan `Encounter.diagnosis[]` ke tabel `fhir_encounter_diagnosis`).

10. **Kepatuhan Invariant Transaksi `Bundle` (`bdl-3`):**
    * Pada `Bundle` (`type: "transaction"`), setiap `entry[]` wajib memiliki `fullUrl` (mendukung `urn:uuid:<uuid-v4>`) dan objek `request: { method, url }`, diproses dengan urutan `DELETE` -> `POST` -> `PUT` -> `GET`, serta menghasilkan respons `Bundle` (`type: "transaction-response"`) yang memuat `response: { status, location }`.

---

## 5. Spesifikasi Pemetaan Parameter Global HL7 FHIR ke PostgreSQL (`SQL-on-FHIR v2 ViewDefinition`)

| Resource HL7 FHIR | Parameter Global FHIR (Search Parameters) | Ekspresi FHIRPath Standar (`SQL-on-FHIR v2 ViewDefinition`) | Tabel & Kolom Target PostgreSQL |
| :--- | :--- | :--- | :--- |
| **`Organization`** | `id`, `identifier`, `active`, `type`, `name`, `address-state`, `address-city` | `getResourceKey()`, `identifier.first().value`, `active`, `type.first().coding.first().code`, `name` | `fhir_organization` (`id`, `identifier_value`, `active`, `type_code`, `name`, `address_province_code`, `address_city_code`) |
| **`Patient`** | `id`, `identifier`, `name`, `gender`, `birthdate`, `active`, `organization` | `getResourceKey()`, `identifier.where(system='https://fhir.kemkes.go.id/id/nik').first().value`, `identifier.where(system='https://fhir.kemkes.go.id/id/ihs-number').first().value`, `name.first().text`, `gender`, `birthDate` | `fhir_patient` (`id`, `nik`, `ihs_number`, `local_mrn`, `full_name`, `gender`, `birth_date`, `managing_organization_id`) |
| **`Practitioner`** | `id`, `identifier`, `name`, `active`, `communication` | `getResourceKey()`, `identifier.where(system='https://fhir.kemkes.go.id/id/ihs-number').first().value`, `name.first().text`, `qualification.first().code.coding.first().code` | `fhir_practitioner` (`id`, `ihs_number`, `identifier_value`, `full_name`, `qualification_code`) |
| **`Encounter`** | `id`, `identifier`, `status`, `class`, `subject`, `participant`, `location`, `date`, `based-on` | `getResourceKey()`, `identifier.first().value`, `status`, `class.code`, `subject.getReferenceKey('Patient')`, `serviceProvider.getReferenceKey('Organization')`, `period.start`, `period.end`, `hospitalization.dischargeDisposition.coding.first().code` | `fhir_encounter` (`id`, `identifier_value`, `status`, `class_code`, `patient_id`, `practitioner_id`, `service_provider_org_id`, `period_start`, `period_end`, `discharge_disposition_code`) |
| **`Condition`** | `id`, `clinical-status`, `verification-status`, `category`, `code`, `subject`, `encounter`, `recorded-date` | `getResourceKey()`, `clinicalStatus.coding.first().code`, `verificationStatus.coding.first().code`, `category.first().coding.first().code`, `code.coding.first().system`, `code.coding.first().code`, `subject.getReferenceKey('Patient')`, `encounter.getReferenceKey('Encounter')` | `fhir_condition` (`id`, `clinical_status`, `verification_status`, `category_code`, `code_system`, `code_value`, `code_display`, `patient_id`, `encounter_id`, `diagnosis_role_code`, `diagnosis_rank`) |
| **`Procedure`** | `id`, `status`, `category`, `code`, `subject`, `encounter`, `date` | `getResourceKey()`, `status`, `code.coding.first().system`, `code.coding.first().code`, `subject.getReferenceKey('Patient')`, `encounter.getReferenceKey('Encounter')`, `performed.ofType(dateTime)` | `fhir_procedure` (`id`, `status`, `code_system`, `code_value`, `code_display`, `patient_id`, `encounter_id`, `performed_datetime`) |
| **`Observation`** | `id`, `status`, `category`, `code`, `subject`, `encounter`, `performer`, `value-quantity`, `component-code-value-quantity`, `date` | `getResourceKey()`, `status`, `category.first().coding.first().code`, `code.coding.first().code`, `value.ofType(Quantity).value`, `value.ofType(Quantity).code`, `component.where(code.coding.exists(code='8480-6')).first().value.ofType(Quantity).value`, `component.where(code.coding.exists(code='8462-4')).first().value.ofType(Quantity).value` | `fhir_observation` (`id`, `status`, `category_code`, `code_system`, `code_value`, `value_quantity`, `value_unit`, `systolic_value`, `diastolic_value`, `patient_id`, `encounter_id`, `performer_practitioner_id`) |
| **`DiagnosticReport`** | `id`, `status`, `category`, `code`, `subject`, `encounter`, `result`, `issued` | `getResourceKey()`, `status`, `category.first().coding.first().code`, `code.coding.first().code`, `result.first().getReferenceKey('Observation')`, `conclusion`, `issued` | `fhir_diagnostic_report` (`id`, `status`, `category_code`, `code_value`, `primary_observation_id`, `conclusion`, `issued_datetime`) |
| **`Medication`, `MedicationRequest`, `MedicationDispense`** | `id`, `status`, `intent`, `code`, `medication`, `subject`, `context`, `prescription`, `quantity` | `getResourceKey()`, `status`, `medication.ofType(Reference).getReferenceKey('Medication')`, `authorizingPrescription.first().getReferenceKey('MedicationRequest')`, `quantity.value`, `daysSupply.value` | `fhir_medication`, `fhir_medication_request`, `fhir_medication_dispense` |
| **`Composition`** | `id`, `status`, `type`, `subject`, `encounter`, `author`, `date`, `title`, `section` | `getResourceKey()`, `status`, `type.coding.first().code`, `subject.getReferenceKey('Patient')`, `encounter.getReferenceKey('Encounter')`, `author.first().getReferenceKey('Practitioner')`, `date`, `title` | `fhir_composition` (`id`, `status`, `type_code`, `patient_id`, `encounter_id`, `author_practitioner_id`, `composition_date`, `title`) |
| **`Coverage`** *(Pioneer Global)* | `id`, `identifier`, `subscriber`, `status`, `type`, `beneficiary`, `payor`, `class-type`, `class-value` | `getResourceKey()`, `subscriberId`, `status`, `type.coding.first().code`, `beneficiary.getReferenceKey('Patient')`, `payor.first().getReferenceKey('Organization')`, `class.where(type.coding.exists(code='plan')).first().value` | `fhir_coverage` (`id`, `subscriber_id`, `status`, `type_code`, `patient_id`, `payor_organization_id`, `payor_display`, `class_value`) |
| **`Account` & `ChargeItem`** *(Pioneer Global)* | `id`, `status`, `code`, `subject`, `context`, `account`, `quantity`, `price-override`, `supporting-info` | `getResourceKey()`, `status`, `code.coding.first().code`, `subject.getReferenceKey('Patient')`, `context.getReferenceKey('Encounter')`, `account.first().getReferenceKey('Account')`, `quantity.value`, `priceOverride.value`, `supportingInformation.first().getReferenceKey()` | `fhir_account`, `fhir_charge_item` (`id`, `status`, `category_code`, `code_value`, `patient_id`, `encounter_id`, `account_id`, `quantity_value`, `unit_price_value`, `total_price_value`, `supporting_info_ref`) |
| **`Claim` & `Claim.item[]`** *(Pioneer Global)* | `id`, `identifier`, `status`, `type`, `use`, `patient`, `provider`, `priority`, `created`, `total`, `item` | Header: `getResourceKey()`, `identifier.first().value`, `status`, `type.coding.first().code`, `use`, `patient.getReferenceKey('Patient')`, `item.first().encounter.first().getReferenceKey('Encounter')`, `total.value`, `total.currency`. Rincian: `forEach: "item"` | `fhir_claim` (Header 1 baris per klaim) & `fhir_claim_item` (Rincian N baris per klaim hasil unnesting `forEach: "item"`) |
| **`ClaimResponse` & `ExplanationOfBenefit`** *(Pioneer Global)* | `id`, `status`, `type`, `use`, `patient`, `request`, `insurer`, `provider`, `outcome`, `disposition`, `total` | `getResourceKey()`, `status`, `outcome`, `request.getReferenceKey('Claim')`, `total.where(category.coding.exists(code='submitted')).first().amount.value`, `total.where(category.coding.exists(code='benefit')).first().amount.value` | `fhir_claim_response` & `fhir_explanation_of_benefit` |
| **`MeasureReport`** *(Pioneer Global)* | `id`, `status`, `type`, `measure`, `reporter`, `period`, `evaluated-resource` | `getResourceKey()`, `status`, `type`, `measure`, `reporter.getReferenceKey('Organization')`, `period.start`, `period.end`, `group.first().measureScore.value` | `fhir_measure_report` |

---

## 6. Concrete JSON Blueprints (100% Valid HL7 FHIR Standard & SQL-on-FHIR v2)

### A. Blueprint Valid `Claim` & `ClaimResponse` (Standar Resmi HL7 FHIR Financial Module)
```json
{
  "resourceType": "Claim",
  "id": "claim-global-std-001",
  "identifier": [
    {
      "system": "http://hospital.example.org/fhir/id/claim-number",
      "value": "CLM-202611-0001"
    }
  ],
  "status": "active",
  "type": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/claim-type",
        "code": "institutional",
        "display": "Institutional"
      }
    ]
  },
  "subType": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/ex-claimsubtype",
        "code": "inpatient",
        "display": "Inpatient Claim"
      }
    ]
  },
  "use": "claim",
  "patient": { "reference": "Patient/pat-001" },
  "billablePeriod": {
    "start": "2026-10-25T08:00:00+07:00",
    "end": "2026-10-30T14:00:00+07:00"
  },
  "created": "2026-10-30T15:00:00+07:00",
  "provider": { "reference": "Organization/org-hospital-001" },
  "priority": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/processpriority",
        "code": "normal"
      }
    ]
  },
  "insurance": [
    {
      "sequence": 1,
      "focal": true,
      "coverage": { "reference": "Coverage/cov-001" }
    }
  ],
  "supportingInfo": [
    {
      "sequence": 1,
      "category": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/claiminformationcategory",
            "code": "info",
            "display": "Information"
          }
        ]
      },
      "valueReference": { "reference": "Composition/comp-discharge-001" }
    }
  ],
  "diagnosis": [
    {
      "sequence": 1,
      "diagnosisReference": { "reference": "Condition/cond-primary-001" },
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/ex-diagnosistype",
              "code": "principal",
              "display": "Principal Diagnosis"
            }
          ]
        }
      ],
      "packageCode": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/ex-diagnosisrelatedgroup",
            "code": "DRG-RESP-MCC",
            "display": "Respiratory System Diagnosis with Major Complication/Comorbidity"
          }
        ]
      }
    },
    {
      "sequence": 2,
      "diagnosisReference": { "reference": "Condition/cond-secondary-002" },
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/ex-diagnosistype",
              "code": "comorbidity",
              "display": "Comorbidity Diagnosis"
            }
          ]
        }
      ]
    }
  ],
  "procedure": [
    {
      "sequence": 1,
      "procedureReference": { "reference": "Procedure/proc-001" }
    }
  ],
  "item": [
    {
      "sequence": 1,
      "diagnosisSequence": [1, 2],
      "informationSequence": [1],
      "category": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/ex-benefitcategory",
            "code": "1",
            "display": "Medical Care / Room & Board"
          }
        ]
      },
      "productOrService": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/ex-USCLS",
            "code": "ROOM-INPATIENT",
            "display": "Inpatient Room & Accommodation"
          }
        ]
      },
      "encounter": [{ "reference": "Encounter/enc-001" }],
      "quantity": { "value": 5, "unit": "d", "system": "http://unitsofmeasure.org", "code": "d" },
      "unitPrice": { "value": 700000, "currency": "IDR" },
      "net": { "value": 3500000, "currency": "IDR" }
    },
    {
      "sequence": 2,
      "procedureSequence": [1],
      "category": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/ex-benefitcategory",
            "code": "2",
            "display": "Surgical / Intensive Procedure"
          }
        ]
      },
      "productOrService": {
        "coding": [
          {
            "system": "http://hl7.org/fhir/sid/icd-9-cm",
            "code": "96.71",
            "display": "Continuous invasive mechanical ventilation < 96 consecutive hours"
          }
        ]
      },
      "encounter": [{ "reference": "Encounter/enc-001" }],
      "quantity": { "value": 1, "unit": "{procedure}" },
      "unitPrice": { "value": 8000000, "currency": "IDR" },
      "net": { "value": 8000000, "currency": "IDR" }
    }
  ],
  "total": {
    "value": 11500000,
    "currency": "IDR"
  }
}
```

### B. Blueprint Valid `SQL-on-FHIR v2 ViewDefinition` (`fhir_claim` Header & `fhir_claim_item` Unnested)
```json
[
  {
    "resourceType": "ViewDefinition",
    "name": "fhir_claim_header_view",
    "resource": "Claim",
    "status": "active",
    "select": [
      {
        "column": [
          { "name": "id", "path": "getResourceKey()", "type": "string" },
          { "name": "identifier_system", "path": "identifier.first().system", "type": "string" },
          { "name": "identifier_value", "path": "identifier.first().value", "type": "string" },
          { "name": "status", "path": "status", "type": "string" },
          { "name": "type_code", "path": "type.coding.first().code", "type": "string" },
          { "name": "sub_type_code", "path": "subType.coding.first().code", "type": "string" },
          { "name": "use_code", "path": "use", "type": "string" },
          { "name": "patient_id", "path": "patient.getReferenceKey('Patient')", "type": "string" },
          { "name": "provider_organization_id", "path": "provider.getReferenceKey('Organization')", "type": "string" },
          { "name": "encounter_id", "path": "item.first().encounter.first().getReferenceKey('Encounter')", "type": "string" },
          { "name": "coverage_id", "path": "insurance.where(focal=true).first().coverage.getReferenceKey('Coverage')", "type": "string" },
          { "name": "diagnosis_package_system", "path": "diagnosis.where(sequence=1).first().packageCode.coding.first().system", "type": "string" },
          { "name": "diagnosis_package_code", "path": "diagnosis.where(sequence=1).first().packageCode.coding.first().code", "type": "string" },
          { "name": "total_value", "path": "total.value", "type": "decimal" },
          { "name": "total_currency", "path": "total.currency", "type": "string" }
        ]
      }
    ]
  },
  {
    "resourceType": "ViewDefinition",
    "name": "fhir_claim_item_view",
    "resource": "Claim",
    "status": "active",
    "select": [
      {
        "column": [
          { "name": "claim_id", "path": "getResourceKey()", "type": "string" }
        ],
        "select": [
          {
            "forEach": "item",
            "column": [
              { "name": "sequence", "path": "sequence", "type": "integer" },
              { "name": "encounter_id", "path": "encounter.first().getReferenceKey('Encounter')", "type": "string" },
              { "name": "category_system", "path": "category.coding.first().system", "type": "string" },
              { "name": "category_code", "path": "category.coding.first().code", "type": "string" },
              { "name": "product_or_service_system", "path": "productOrService.coding.first().system", "type": "string" },
              { "name": "product_or_service_code", "path": "productOrService.coding.first().code", "type": "string" },
              { "name": "product_or_service_display", "path": "productOrService.coding.first().display", "type": "string" },
              { "name": "quantity_value", "path": "quantity.value", "type": "decimal" },
              { "name": "unit_price_value", "path": "unitPrice.value", "type": "decimal" },
              { "name": "net_value", "path": "net.value", "type": "decimal" },
              { "name": "currency", "path": "net.currency", "type": "string" }
            ]
          }
        ]
      }
    ]
  }
]
```