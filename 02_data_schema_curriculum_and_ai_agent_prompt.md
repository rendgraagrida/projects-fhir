# MASTER PLAN & TECHNICAL SPECIFICATION (v10.0 - Global FHIR Blueprint for Indonesia)
## DOKUMEN 2: Skema PostgreSQL Berbasis Parameter Global FHIR, Kurikulum 12 Modul, & Validator Standar HL7 FHIR

**Proyek:** Global HL7 FHIR (R5/R4 Standard), SQL-on-FHIR v2 (`fhir-data-pipes`) & National Healthcare Normalization Learning Lab

---

## 1. Spesifikasi Skema Database PostgreSQL Berbasis Parameter Global FHIR (`PGlite` DDL)

Seluruh tabel di bawah ini menggunakan **Official HL7 FHIR Global Search Parameters** sebagai kolom relasionalnya dan dilengkapi dengan `raw_fhir JSONB` serta kolom `implementation_status`:
* `'IMPLEMENTED_SATUSEHAT'`: Komponen yang sudah diimplementasikan secara nasional di Indonesia.
* `'PARTIAL_NATIONAL'`: Komponen yang baru sebagian diterapkan di Indonesia dan dilengkapi dengan standar global FHIR.
* `'PIONEER_GLOBAL_FHIR'`: Komponen resmi HL7 FHIR (seperti modul *Financial/Claims* dan *Quality Measures*) yang belum memiliki aturan baku di Indonesia, namun **telah diimplementasikan secara utuh di sistem kita sebagai standar pelopor nasional**.

```sql
-- ============================================================================
-- 0. MASTER ORGANIZATION / HEALTHCARE PROVIDER & PAYOR (TABEL 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fhir_organization (
    id VARCHAR(100) PRIMARY KEY,
    identifier_system VARCHAR(255),
    identifier_value VARCHAR(100) UNIQUE,      -- Global Search Param: identifier
    active BOOLEAN DEFAULT TRUE,               -- Global Search Param: active
    type_code VARCHAR(50) DEFAULT 'prov',      -- Global Search Param: type (prov = Provider RS, ins = Insurance/BPJS, govt = Government)
    name VARCHAR(255) NOT NULL,                -- Global Search Param: name
    address_province_code VARCHAR(20),         -- Global Search Param: address-state (Kemendagri Province Code)
    address_city_code VARCHAR(20),             -- Global Search Param: address-city (Kemendagri City Code)
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 1. LEVEL 2 & 3: ADMINISTRATION, ENTITIES, & SECURITY (TABEL 2 - 9)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fhir_patient (
    id VARCHAR(100) PRIMARY KEY,
    managing_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters: identifier, name, gender, birthdate, active, address, link
    nik VARCHAR(50),                           -- system: https://fhir.kemkes.go.id/id/nik
    ihs_number VARCHAR(100),                   -- system: https://fhir.kemkes.go.id/id/ihs-number
    local_mrn VARCHAR(100),                    -- Nomor Rekam Medis lokal RS
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) NOT NULL,               -- male | female | other | unknown
    birth_date DATE,
    active BOOLEAN DEFAULT TRUE,
    citizenship_code VARCHAR(20) DEFAULT 'WNI',
    address_province_code VARCHAR(20),
    address_city_code VARCHAR(20),
    address_district_code VARCHAR(20),
    address_village_code VARCHAR(20),
    replaced_by_patient_id VARCHAR(100),       -- HL7 FHIR Patient.link[] untuk resolusi duplikat/pasien darurat
    
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fhir_practitioner (
    id VARCHAR(100) PRIMARY KEY,
    ihs_number VARCHAR(100),
    identifier_system VARCHAR(255),
    identifier_value VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    full_name VARCHAR(255) NOT NULL,
    qualification_code VARCHAR(100),
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_location (
    id VARCHAR(100) PRIMARY KEY,
    managing_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    identifier_value VARCHAR(100),
    status VARCHAR(30) DEFAULT 'active',       -- active | suspended | inactive
    name VARCHAR(255) NOT NULL,
    mode_code VARCHAR(30) DEFAULT 'instance',
    physical_type_code VARCHAR(50),            -- ro (Room) | bd (Bed) | wa (Ward) | bu (Building)
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_episode_of_care (
    id VARCHAR(100) PRIMARY KEY,
    managing_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,               -- planned | waitlist | active | onhold | finished | cancelled
    type_code VARCHAR(100),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_service_request (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    requester_practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    performer_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    identifier_value VARCHAR(100),
    status VARCHAR(40) NOT NULL,               -- draft | active | on-hold | revoked | completed
    intent VARCHAR(40) NOT NULL,               -- proposal | plan | directive | order
    category_code VARCHAR(100),
    priority_code VARCHAR(30) DEFAULT 'routine',
    code_system VARCHAR(255),
    code_value VARCHAR(100),
    code_display TEXT,
    authored_on TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'PARTIAL_NATIONAL',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_encounter (
    id VARCHAR(100) PRIMARY KEY,
    service_provider_org_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    location_id VARCHAR(100) REFERENCES fhir_location(id) ON UPDATE CASCADE ON DELETE SET NULL,
    episode_of_care_id VARCHAR(100) REFERENCES fhir_episode_of_care(id) ON UPDATE CASCADE ON DELETE SET NULL,
    based_on_service_request_id VARCHAR(100) REFERENCES fhir_service_request(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters: identifier, status, class, date (period)
    identifier_system VARCHAR(255),
    identifier_value VARCHAR(100),
    status VARCHAR(40) NOT NULL,               -- planned | arrived | triaged | in-progress | onleave | finished | cancelled
    class_code VARCHAR(40) NOT NULL,           -- AMB | EMER | IMP (v3-ActCode)
    service_type_code VARCHAR(100),
    discharge_disposition_code VARCHAR(50),    -- HL7 discharge-disposition: home | other-hcf | aadvice | exp
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ,
    
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_consent (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- draft | proposed | active | rejected | inactive
    scope_code VARCHAR(50) NOT NULL,           -- patient-privacy | treatment | research
    category_code VARCHAR(100) NOT NULL,
    date_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    implementation_status VARCHAR(40) DEFAULT 'PARTIAL_NATIONAL',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_provenance (
    id VARCHAR(100) PRIMARY KEY,
    target_resource_type VARCHAR(50) NOT NULL,
    target_resource_id VARCHAR(100) NOT NULL,  -- Extracted via target.first().getReferenceKey()
    agent_practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    recorded_datetime TIMESTAMPTZ NOT NULL,
    activity_code VARCHAR(50),
    signature_type_code VARCHAR(50),
    implementation_status VARCHAR(40) DEFAULT 'PARTIAL_NATIONAL',
    raw_fhir JSONB NOT NULL
);

-- ============================================================================
-- 2. LEVEL 4A & 4B: CLINICAL, DIAGNOSTICS, MEDICATIONS & WORKFLOW (TABEL 10 - 18)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fhir_condition (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    
    -- Global Search Parameters: clinical-status, verification-status, category, code, recorded-date
    clinical_status VARCHAR(40) DEFAULT 'active',
    verification_status VARCHAR(40) DEFAULT 'confirmed',
    category_code VARCHAR(50) DEFAULT 'encounter-diagnosis',
    diagnosis_role_code VARCHAR(20) DEFAULT 'DD', -- Dari Encounter.diagnosis[].use (AD | DD | CC | CM)
    diagnosis_rank INTEGER DEFAULT 1,             -- Dari Encounter.diagnosis[].rank (1..n)
    code_system VARCHAR(255) NOT NULL,            -- http://hl7.org/fhir/sid/icd-10 atau http://snomed.info/sct
    code_value VARCHAR(50) NOT NULL,
    code_display TEXT NOT NULL,
    recorded_date TIMESTAMPTZ,
    
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_procedure (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,               -- preparation | in-progress | completed
    category_code VARCHAR(50),
    code_system VARCHAR(255) NOT NULL,         -- http://hl7.org/fhir/sid/icd-9-cm atau http://snomed.info/sct
    code_value VARCHAR(50) NOT NULL,
    code_display TEXT NOT NULL,
    performed_datetime TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_observation (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    performer_practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    based_on_service_request_id VARCHAR(100) REFERENCES fhir_service_request(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters: status, category, code, value-quantity, component-code-value-quantity, date
    status VARCHAR(40) NOT NULL,               -- registered | preliminary | final | amended
    category_code VARCHAR(50) NOT NULL,        -- vital-signs | laboratory | imaging | exam | survey
    code_system VARCHAR(255) NOT NULL,         -- http://loinc.org
    code_value VARCHAR(50) NOT NULL,
    code_display TEXT,
    value_quantity NUMERIC,                    -- NULL pada panel multi-komponen (Invariant obs-7)
    value_unit VARCHAR(50),                    -- Kode UCUM
    value_string TEXT,
    systolic_value NUMERIC,                    -- Dari component[] LOINC 8480-6
    diastolic_value NUMERIC,                   -- Dari component[] LOINC 8462-4
    effective_datetime TIMESTAMPTZ,
    
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_diagnostic_report (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    based_on_service_request_id VARCHAR(100) REFERENCES fhir_service_request(id) ON UPDATE CASCADE ON DELETE SET NULL,
    primary_observation_id VARCHAR(100) REFERENCES fhir_observation(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- registered | partial | preliminary | final
    category_code VARCHAR(50) NOT NULL,
    code_system VARCHAR(255) NOT NULL,
    code_value VARCHAR(50) NOT NULL,
    code_display TEXT,
    conclusion TEXT,
    issued_datetime TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_medication (
    id VARCHAR(100) PRIMARY KEY,
    code_system VARCHAR(255) NOT NULL,         -- http://sys-ids.kemkes.go.id/kfa
    code_value VARCHAR(100) NOT NULL,
    code_display TEXT NOT NULL,
    form_code VARCHAR(100),
    medication_type_code VARCHAR(20) DEFAULT 'NC', -- NC (Non-compound) | EP (Extemporaneous)
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_medication_request (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    requester_practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    medication_id VARCHAR(100) REFERENCES fhir_medication(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,               -- active | on-hold | cancelled | completed
    intent VARCHAR(40) NOT NULL,               -- proposal | plan | order | original-order
    category_code VARCHAR(50),
    dosage_text TEXT,
    authored_on TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_medication_dispense (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    medication_id VARCHAR(100) REFERENCES fhir_medication(id) ON UPDATE CASCADE ON DELETE CASCADE,
    authorizing_prescription_id VARCHAR(100) REFERENCES fhir_medication_request(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- preparation | in-progress | completed
    quantity_value NUMERIC,
    quantity_unit VARCHAR(40),
    days_supply_value INTEGER,
    when_handed_over TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_composition (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    author_practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- preliminary | final | amended
    type_system VARCHAR(255) DEFAULT 'http://loinc.org',
    type_code VARCHAR(50) DEFAULT '18842-5',
    title VARCHAR(255) NOT NULL,
    section_count INTEGER DEFAULT 5,
    composition_date TIMESTAMPTZ NOT NULL,
    implementation_status VARCHAR(40) DEFAULT 'IMPLEMENTED_SATUSEHAT',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_appointment (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    practitioner_id VARCHAR(100) REFERENCES fhir_practitioner(id) ON UPDATE CASCADE ON DELETE SET NULL,
    location_id VARCHAR(100) REFERENCES fhir_location(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- proposed | pending | booked | arrived | fulfilled | cancelled
    service_category_code VARCHAR(100),
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

-- ============================================================================
-- 3. LEVEL 4C & LEVEL 5: PIONEER GLOBAL FHIR MODULES FOR INDONESIA (TABEL 19 - 26)
--    (Financial, Claims, Eligibility, & Clinical Quality Measures)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fhir_coverage (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    payor_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters: identifier, subscriber, status, type, beneficiary, payor, class-type, class-value
    subscriber_id VARCHAR(100),
    status VARCHAR(40) NOT NULL,               -- active | cancelled | draft
    type_code VARCHAR(100),
    payor_display VARCHAR(255) NOT NULL,
    class_type_code VARCHAR(50) DEFAULT 'plan',-- http://terminology.hl7.org/CodeSystem/coverage-class
    class_value VARCHAR(100),
    
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_coverage_eligibility_response (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    insurer_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    coverage_id VARCHAR(100) REFERENCES fhir_coverage(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL,               -- active | cancelled | draft
    outcome VARCHAR(30) NOT NULL,              -- queued | complete | error | partial
    inforce BOOLEAN DEFAULT TRUE,
    disposition TEXT,
    created_datetime TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_account (
    id VARCHAR(100) PRIMARY KEY,
    service_provider_org_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,               -- active | inactive | on-hold
    type_code VARCHAR(50),
    name VARCHAR(255),
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_charge_item (
    id VARCHAR(100) PRIMARY KEY,
    performing_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE CASCADE,
    account_id VARCHAR(100) REFERENCES fhir_account(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters: status, code, subject, context, account, quantity, price-override
    status VARCHAR(40) NOT NULL,               -- planned | billable | billed
    category_code VARCHAR(100),
    code_system VARCHAR(255) NOT NULL,
    code_value VARCHAR(100) NOT NULL,
    code_display VARCHAR(255) NOT NULL,
    quantity_value NUMERIC DEFAULT 1,
    unit_price_value NUMERIC NOT NULL,
    total_price_value NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    supporting_info_ref VARCHAR(150),          -- Reference ke Procedure / Observation / MedicationDispense
    
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_claim (
    id VARCHAR(100) PRIMARY KEY,
    provider_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE SET NULL,
    coverage_id VARCHAR(100) REFERENCES fhir_coverage(id) ON UPDATE CASCADE ON DELETE SET NULL,
    composition_id VARCHAR(100) REFERENCES fhir_composition(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters HL7 FHIR Claim: identifier, status, use, type, patient, provider, priority, created
    identifier_system VARCHAR(255),
    identifier_value VARCHAR(100),
    status VARCHAR(40) NOT NULL,               -- active | cancelled | draft
    type_code VARCHAR(50) NOT NULL,            -- institutional | oral | pharmacy | professional | vision
    sub_type_code VARCHAR(50),
    use_code VARCHAR(40) NOT NULL,             -- claim | preauthorization | predetermination
    priority_code VARCHAR(30) DEFAULT 'normal',
    diagnosis_package_system VARCHAR(255),     -- Claim.diagnosis[].packageCode.coding[].system
    diagnosis_package_code VARCHAR(100),       -- Claim.diagnosis[].packageCode.coding[].code
    diagnosis_package_display TEXT,
    total_value NUMERIC NOT NULL,              -- Claim.total.value (0..1 Money)
    total_currency VARCHAR(10) DEFAULT 'IDR',  -- Claim.total.currency
    created_datetime TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

-- Tabel Rincian Baris Item Klaim (Hasil Unnesting Standar SQL-on-FHIR v2 `forEach: "item"`)
CREATE TABLE IF NOT EXISTS fhir_claim_item (
    id VARCHAR(120) PRIMARY KEY,               -- claim_id + '-' + sequence
    claim_id VARCHAR(100) REFERENCES fhir_claim(id) ON UPDATE CASCADE ON DELETE CASCADE,
    encounter_id VARCHAR(100) REFERENCES fhir_encounter(id) ON UPDATE CASCADE ON DELETE SET NULL,
    sequence INTEGER NOT NULL,
    category_system VARCHAR(255),              -- http://terminology.hl7.org/CodeSystem/ex-benefitcategory
    category_code VARCHAR(100),
    category_display VARCHAR(255),
    product_or_service_system VARCHAR(255) NOT NULL,
    product_or_service_code VARCHAR(100) NOT NULL,
    product_or_service_display VARCHAR(255),
    quantity_value NUMERIC DEFAULT 1,
    unit_price_value NUMERIC,
    net_value NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR'
);

CREATE TABLE IF NOT EXISTS fhir_claim_response (
    id VARCHAR(100) PRIMARY KEY,
    claim_id VARCHAR(100) UNIQUE REFERENCES fhir_claim(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    insurer_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters HL7 FHIR ClaimResponse: status, use, request, outcome, insurer, created, disposition
    status VARCHAR(40) NOT NULL,               -- active | cancelled | draft
    type_code VARCHAR(50) NOT NULL,
    use_code VARCHAR(40) NOT NULL,
    outcome VARCHAR(30) NOT NULL,              -- queued | complete | error | partial
    disposition TEXT,
    total_submitted_value NUMERIC NOT NULL,    -- ClaimResponse.total[category='submitted'].amount.value
    total_benefit_value NUMERIC NOT NULL,      -- ClaimResponse.total[category='benefit'].amount.value
    add_item_benefit_value NUMERIC DEFAULT 0,  -- ClaimResponse.addItem[].net.value
    currency VARCHAR(10) DEFAULT 'IDR',
    process_note_text TEXT,
    created_datetime TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_explanation_of_benefit (
    id VARCHAR(100) PRIMARY KEY,
    claim_id VARCHAR(100) UNIQUE REFERENCES fhir_claim(id) ON UPDATE CASCADE ON DELETE CASCADE,
    claim_response_id VARCHAR(100) UNIQUE REFERENCES fhir_claim_response(id) ON UPDATE CASCADE ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES fhir_patient(id) ON UPDATE CASCADE ON DELETE CASCADE,
    provider_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    insurer_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE SET NULL,
    coverage_id VARCHAR(100) REFERENCES fhir_coverage(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Global Search Parameters HL7 FHIR EOB: status, claim, coverage, patient, provider, insurer, outcome
    status VARCHAR(40) NOT NULL,               -- active | cancelled | draft
    type_code VARCHAR(50) NOT NULL,
    use_code VARCHAR(40) NOT NULL,
    outcome VARCHAR(30) NOT NULL,              -- queued | complete | error | partial
    total_submitted_value NUMERIC NOT NULL,
    total_benefit_value NUMERIC NOT NULL,
    variance_value NUMERIC NOT NULL,           -- (total_benefit_value - total_submitted_value)
    currency VARCHAR(10) DEFAULT 'IDR',
    created_datetime TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fhir_measure_report (
    id VARCHAR(100) PRIMARY KEY,
    reporter_organization_id VARCHAR(100) REFERENCES fhir_organization(id) ON UPDATE CASCADE ON DELETE CASCADE,
    measure_url VARCHAR(255) NOT NULL,
    measure_name VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL,               -- complete | pending | error
    type_code VARCHAR(40) NOT NULL,            -- individual | subject-list | summary
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    numerator_count INTEGER,
    denominator_count INTEGER,
    measure_score_value NUMERIC,
    implementation_status VARCHAR(40) DEFAULT 'PIONEER_GLOBAL_FHIR',
    raw_fhir JSONB NOT NULL
);

-- ============================================================================
-- 4. GLOBAL ANALYTICAL & RECAP VIEWS (BERBASIS PARAMETER GLOBAL FHIR)
-- ============================================================================

-- View 1: Rekapitulasi Epidemiologi & Diagnosa Klinis Lintas RS (Parameter Global Condition + Encounter)
CREATE OR REPLACE VIEW vw_fhir_clinical_diagnosis_recap AS
SELECT 
    org.name AS organization_name,
    org.address_province_code AS province_code,
    e.class_code AS encounter_class,
    c.code_system,
    c.code_value AS diagnosis_code,
    c.code_display AS diagnosis_display,
    c.diagnosis_role_code,
    c.diagnosis_rank,
    COUNT(DISTINCT e.id) AS total_encounters,
    COUNT(DISTINCT COALESCE(p.nik, p.id)) AS total_unique_patients
FROM fhir_condition c
JOIN fhir_encounter e ON c.encounter_id = e.id
JOIN fhir_patient p ON c.patient_id = p.id
JOIN fhir_organization org ON e.service_provider_org_id = org.id
GROUP BY 
    org.name, org.address_province_code, e.class_code, c.code_system, c.code_value, c.code_display, c.diagnosis_role_code, c.diagnosis_rank;

-- View 2: Rekapitulasi Klaim & Adjudikasi Finansial Standar Global FHIR (Claim + ClaimResponse + EOB)
CREATE OR REPLACE VIEW vw_fhir_financial_claim_recap AS
SELECT 
    org.name AS provider_organization,
    cl.type_code AS claim_type,
    cl.diagnosis_package_code,
    cl.diagnosis_package_display,
    COALESCE(cr.outcome, 'queued') AS adjudication_outcome,
    COUNT(DISTINCT cl.id) AS total_claims,
    SUM(cl.total_value) AS total_submitted_amount,
    SUM(COALESCE(cr.total_benefit_value, 0)) AS total_approved_benefit_amount,
    SUM(COALESCE(cr.total_benefit_value, 0) - cl.total_value) AS total_variance_amount,
    cl.total_currency AS currency
FROM fhir_claim cl
LEFT JOIN fhir_claim_response cr ON cr.claim_id = cl.id
JOIN fhir_organization org ON cl.provider_organization_id = org.id
GROUP BY 
    org.name, cl.type_code, cl.diagnosis_package_code, cl.diagnosis_package_display, COALESCE(cr.outcome, 'queued'), cl.total_currency;

-- View 3: Audit Rantai Bukti Klinis-ke-Finansial (Clinical-to-Claim Evidence Chain Audit)
CREATE OR REPLACE VIEW vw_fhir_clinical_to_claim_audit AS
SELECT 
    org.name AS provider_organization,
    cl.id AS claim_id,
    cl.identifier_value AS claim_identifier,
    p.full_name AS patient_name,
    e.class_code AS encounter_class,
    e.discharge_disposition_code,
    CASE WHEN comp.status = 'final' THEN 'FINAL_COMPLETE' ELSE 'INCOMPLETE_OR_PRELIMINARY' END AS discharge_summary_status,
    c_prim.code_value || ' - ' || c_prim.code_display AS principal_diagnosis,
    COALESCE(STRING_AGG(DISTINCT c_sec.code_value || ' (' || c_sec.code_display || ')', ', '), 'None') AS secondary_diagnoses,
    cl.diagnosis_package_code,
    cl.total_value AS submitted_amount,
    COALESCE(cr.total_benefit_value, 0) AS approved_benefit_amount,
    COALESCE(cr.outcome, 'queued') AS claim_outcome,
    cr.disposition,
    cr.process_note_text
FROM fhir_claim cl
JOIN fhir_organization org ON cl.provider_organization_id = org.id
JOIN fhir_patient p ON cl.patient_id = p.id
LEFT JOIN fhir_encounter e ON cl.encounter_id = e.id
LEFT JOIN fhir_composition comp ON cl.composition_id = comp.id
LEFT JOIN fhir_claim_response cr ON cr.claim_id = cl.id
LEFT JOIN fhir_condition c_prim ON c_prim.encounter_id = e.id AND c_prim.diagnosis_rank = 1
LEFT JOIN fhir_condition c_sec ON c_sec.encounter_id = e.id AND c_sec.diagnosis_rank > 1
GROUP BY 
    org.name, cl.id, cl.identifier_value, p.full_name, e.class_code, e.discharge_disposition_code,
    comp.status, c_prim.code_value, c_prim.code_display, cl.diagnosis_package_code,
    cl.total_value, cr.total_benefit_value, cr.outcome, cr.disposition, cr.process_note_text;
```

---

## 2. Kurikulum Pembelajaran Interaktif (12 Modul: Dari Dasar hingga Pionir Standar Global FHIR)

Setiap modul dilengkapi **Badge Status Implementasi Nasional vs Global** serta latihan interaktif:

1. **Modul 1 (Level 1 Foundation — 🟢 `Implemented in Indonesia`):** Pengenalan Arsitektur HL7 FHIR, Struktur Dasar `Resource`, `DataTypes`, dan Elemen Polimorfik (`value[x]`).
2. **Modul 2 (Level 1 & 2 — 🟢 `Implemented` / 🟡 `Partial`):** Sistem `Identifier` (NIK, IHS, MRN), Aturan `Extension` (Wilayah Administratif Kemendagri `valueCode`), Resolusi Pasien dengan `Patient.link[]`, serta Privasi & Jejak Audit (`Consent` & `Provenance`).
3. **Modul 3 (Level 3 Administration — 🟢 `Implemented in Indonesia`):** Entitas `Organization`, `Location`, `Practitioner`, `Patient`, serta Siklus Kunjungan `Encounter` (`class`, `statusHistory`, `diagnosis[]` role & rank, `hospitalization.dischargeDisposition`) dan `EpisodeOfCare`.
4. **Modul 4 (Level 4A Diagnostics — 🟢 `Implemented in Indonesia`):** Pengamatan Klinis `Observation` (Nilai Tunggal vs Multi-Komponen `component[]` dengan Invariant `obs-7`), Satuan Standar UCUM, dan Laporan Penunjang `DiagnosticReport`.
5. **Modul 5 (Level 4A Clinical — 🟢 `Implemented in Indonesia`):** Pencatatan `Condition` (ICD-10 / SNOMED-CT), Tindakan Medis `Procedure` (ICD-9-CM / SNOMED-CT), dan `AllergyIntolerance`.
6. **Modul 6 (Level 4A Medications & Documents — 🟢 `Implemented in Indonesia`):** Rantai Farmasi (`Medication` -> `MedicationRequest` -> `MedicationDispense` dengan `SimpleQuantity`) dan Struktur Dokumen Resume Medis `Composition` (5 Seksi Standar dengan Invariant `cmp-1`).
7. **Modul 7 (Level 4B Workflow — 🟡 `Partial` / 🔵 `Pioneer Global FHIR`):** Orkestrasi Permintaan Layanan & Rujukan (`ServiceRequest`) serta Penjadwalan Antrean (`Schedule`, `Slot`, `Appointment`).
8. **Modul 8 (Level 4C Financial — 🔵 `Pioneer Global FHIR for Indonesia`):** Standarisasi Kepesertaan Jaminan Kesehatan/BPJS/Asuransi menggunakan FHIR `Coverage` (`beneficiary`, `payor[]`, `class[]`) dan Validasi Eligibilitas (`CoverageEligibilityRequest` & `CoverageEligibilityResponse`).
9. **Modul 9 (Level 4C Financial — 🔵 `Pioneer Global FHIR for Indonesia`):** Akumulasi Biaya Layanan dengan `ChargeItem` & `Account`, serta Penyusunan Berkas Klaim Standar Global FHIR `Claim` (`diagnosis[]` dengan `packageCode`, `procedure[]`, `supportingInfo[]` merujuk ke `Composition`/`Observation`, `item[]` dengan `productOrService` mandatory, dan `total` bertipe `Money`).
10. **Modul 10 (Level 4C Financial — 🔵 `Pioneer Global FHIR for Indonesia`):** Keputusan Adjudikasi & Verifikasi Klaim pada `ClaimResponse` (`outcome`: `queued | complete | error | partial`, `total[]` `submitted` vs `benefit`, `addItem[]`) dan Rincian Penyelesaian Klaim pada `ExplanationOfBenefit` (EOB).
11. **Modul 11 (Level 5 & Bundle — 🔵 `Pioneer Global FHIR` / 🟢 `Core`):** Pelaporan Indikator Mutu Otomatis (`Measure` & `MeasureReport`) serta Pengiriman Paket Transaksi Atomik `Bundle` (`type: "transaction"` dengan aturan urutan HTTP `DELETE` -> `POST` -> `PUT` -> `GET`).
12. **Modul 12 (SQL-on-FHIR v2 Architecture — 🟢 `Core Data Pipes`):** Transformasi Deklaratif JSON FHIR ke 27 Tabel PostgreSQL menggunakan `ViewDefinition` (`fhir-data-pipes` dengan `getResourceKey()`, `getReferenceKey()`, dan `forEach`) serta Eksplorasi Query Rekapitulasi Nasional di **Interactive SQL Console**.

---

## 3. Enam Aturan Validator Kepatuhan Standar HL7 FHIR & Rantai Bukti Klinis-Finansial

Aplikasi menyertakan mesin validator otomatis berbasis standar resmi HL7 FHIR untuk menguji kualitas normalisasi data:

1. **`FHIR_STD_01_MANDATORY_CARDINALITY`**: Memastikan seluruh elemen mandatory (`1..1` dan `1..*`) pada setiap Resource FHIR terisi sesuai spesifikasi resmi HL7 FHIR (termasuk `Encounter.status`, `Encounter.class`, `Coverage.payor[]`, `Claim.item[].productOrService`, 7 elemen wajib `ClaimResponse`, dan 9 elemen wajib `ExplanationOfBenefit`).
2. **`FHIR_STD_02_OBSERVATION_INVARIANT_OBS7`**: Memastikan `Observation` multi-komponen (seperti Tekanan Darah `85354-9`) menyimpan nilai di dalam `component[]` dan tidak mengisi `value[x]` di level root.
3. **`FHIR_STD_03_COMPOSITION_INVARIANT_CMP1`**: Memastikan setiap elemen `Composition.section[]` pada dokumen Resume Medis memiliki `entry[]`, `text`, atau `emptyReason` yang sah.
4. **`FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN`**: Memastikan setiap diagnosis (`Claim.diagnosis[].diagnosisReference`), prosedur (`Claim.procedure[].procedureReference`), dan informasi pendukung (`Claim.supportingInfo[].valueReference`) di dalam `Claim` menunjuk ke Resource bukti klinis (`Condition`, `Procedure`, `Observation`, `Composition`) yang valid pada `Encounter` yang sama.
5. **`FHIR_STD_05_FINANCIAL_RECONCILIATION`**: Memastikan penjumlahan seluruh `ChargeItem` pada suatu kunjungan dan penjumlahan `Claim.item[].net.value` konsisten dengan nilai `Claim.total.value` (dalam mata uang `"IDR"`).
6. **`FHIR_STD_06_BUNDLE_TRANSACTION_BDL3`**: Memastikan setiap entri di dalam `Bundle` (`type: "transaction"`) memiliki objek `request` (`method` dan `url`) dengan urutan eksekusi HTTP standar HL7 FHIR.