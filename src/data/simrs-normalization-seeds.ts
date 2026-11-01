import type { ImplementationStatus, SandboxClinicalFinancialOverrides, SimrsHospitalSeed } from '../types/fhir-global';

export const STANDARD_TERMINOLOGY_DICTIONARY = {
  ICD10: {
    system: 'http://hl7.org/fhir/sid/icd-10',
    concepts: { 'J18.9': 'Pneumonia, unspecified', 'E11.9': 'Type 2 diabetes mellitus without complications', 'I21.0': 'ST elevation (STEMI) myocardial infarction', 'I10': 'Essential (primary) hypertension', 'O14.1': 'Severe pre-eclampsia', 'Z38.01': 'Single live birth, born in hospital' }
  },
  ICD9CM: {
    system: 'http://hl7.org/fhir/sid/icd-9-cm',
    concepts: { '96.71': 'Continuous invasive mechanical ventilation', '36.06': 'Insertion of coronary artery stent', '74.1': 'Low cervical cesarean section' }
  },
  LOINC: {
    system: 'http://loinc.org',
    concepts: { '85354-9': 'Blood pressure panel', '8480-6': 'Systolic blood pressure', '8462-4': 'Diastolic blood pressure', '8867-4': 'Heart rate', '8310-5': 'Body temperature', '18842-5': 'Discharge summary' }
  },
  SNOMED_CT: { system: 'http://snomed.info/sct', concepts: { '386661006': 'Fever', '29857009': 'Chest pain', '116154003': 'Patient (person)' } },
  UCUM: { system: 'http://unitsofmeasure.org', concepts: { 'mm[Hg]': 'millimeter of mercury', '/min': 'per minute', 'Cel': 'degree Celsius', 'd': 'day', '1': 'one' } },
  KFA: { system: 'http://sys-ids.kemkes.go.id/kfa', concepts: { '93000001': 'Paracetamol 500 mg tablet', '93000002': 'Ceftriaxone 1 g injection', '93000003': 'Aspirin 80 mg tablet' } },
  WILAYAH_KEMENDAGRI: {
    system: 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
    province: { '35': 'Jawa Timur', '31': 'DKI Jakarta', '32': 'Jawa Barat' },
    city: { '3578': 'Kota Surabaya', '3171': 'Kota Administrasi Jakarta Selatan', '3273': 'Kota Bandung' },
    district: { '357826': 'Sukolilo', '317106': 'Kebayoran Baru', '327311': 'Coblong' },
    village: { '3578261001': 'Keputih', '3171061003': 'Senayan', '3273111002': 'Dago' },
    rt: { '001': 'RT 001' }, rw: { '002': 'RW 002' }
  },
  HL7_FINANCIAL: {
    claimType: { system: 'http://terminology.hl7.org/CodeSystem/claim-type', institutional: 'Institutional', professional: 'Professional', pharmacy: 'Pharmacy' },
    benefitCategory: { system: 'http://terminology.hl7.org/CodeSystem/ex-benefitcategory', room: 'Medical care / room and board', procedure: 'Medical procedure', medication: 'Pharmacy' },
    diagnosisType: { system: 'http://terminology.hl7.org/CodeSystem/ex-diagnosistype', principal: 'Principal', admitting: 'Admitting', comorbidity: 'Comorbidity', discharge: 'Discharge' },
    adjudication: { system: 'http://terminology.hl7.org/CodeSystem/adjudication', submitted: 'Submitted amount', benefit: 'Benefit amount' },
    coverageClass: { system: 'http://terminology.hl7.org/CodeSystem/coverage-class', plan: 'Plan', class: 'Class', group: 'Group' },
    dischargeDisposition: { system: 'http://terminology.hl7.org/CodeSystem/discharge-disposition', home: 'Home', 'other-hcf': 'Other healthcare facility', aadvice: 'Against medical advice', exp: 'Expired' },
    diagnosisRole: { system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role', AD: 'Admission', DD: 'Discharge', CC: 'Chief complaint', CM: 'Comorbidity' }
  }
} as const;

const defaults = (extra: Partial<SandboxClinicalFinancialOverrides> = {}): Required<SandboxClinicalFinancialOverrides> => ({
  encounterStatus: 'finished', encounterClass: 'IMP', dischargeDispositionCode: 'home', primaryDiagnosisCode: '', secondaryDiagnosisCode: '', procedureCode: '', systolicBp: 120, diastolicBp: 80, heartRate: 82, bodyTemp: 36.8, roomChargeDays: 3, roomUnitPriceIdr: 750000, procedurePriceIdr: 2500000, medicationPriceIdr: 125000, adjudicationOutcome: 'complete', approvedRoomBenefitIdr: 2250000, approvedProcedureBenefitIdr: 2500000, approvedMedicationBenefitIdr: 125000, addItemBenefitIdr: 0, injectObs7Violation: false, injectCmp1Violation: false, injectBrokenEvidenceChain: false, injectFinancialMismatch: false, injectBundleOrderViolation: false, mergedDuplicatePatient: false, ...extra
});

export const SIMRS_HOSPITAL_SEEDS: SimrsHospitalSeed[] = [
  {
    id: 'rsud-soetomo-surabaya', hospitalCode: 'RSUD-SBY-001', hospitalName: 'RSUD Dr. Soetomo Nusantara', city: 'Surabaya', provinceCode: '35', cityCode: '3578', districtCode: '357826', villageCode: '3578261001', simrsArchitectureStyle: 'Legacy flat snake_case', scenarioTitle: 'Pneumonia berat dengan ventilasi mekanik', scenarioSummary: 'Rawat inap dengan pneumonia dan diabetes, tindakan ventilasi mekanik, serta klaim INA-CBG.',
    rawSimrsTables: { tb_pasien_rsud: [{ id_pasien: 'pat-soetomo-001', nik: '3578010101800001', no_rm: 'RM-SBY-001', nama_lengkap: 'Budi Santoso', jenis_kelamin: 'L', tanggal_lahir: '1980-01-01' }], tb_kunjungan_ranap: [{ id_kunjungan: 'enc-soetomo-001', id_pasien: 'pat-soetomo-001', kelas: 'IMP', status: 'finished', masuk: '2026-10-25T08:00:00+07:00', pulang: '2026-10-30T14:00:00+07:00', kode_diagnosa_utama: 'J18.9', kode_diagnosa_sekunder: 'E11.9', kode_ruang: 'ICU-01' }], tb_billing_ina_cbg: [{ id_tagihan: 'clm-soetomo-001', drg_code: 'DRG-RESP-MCC', total_kamar: 2250000, total_tindakan: 2500000, total_obat: 125000, status_klaim: 'complete' }] },
    defaultOverrides: defaults({ primaryDiagnosisCode: 'J18.9', secondaryDiagnosisCode: 'E11.9', procedureCode: '96.71', roomChargeDays: 3, roomUnitPriceIdr: 750000, procedurePriceIdr: 2500000, medicationPriceIdr: 125000, approvedRoomBenefitIdr: 2250000, approvedProcedureBenefitIdr: 2500000, approvedMedicationBenefitIdr: 125000 })
  },
  {
    id: 'rs-harapan-bangsa-jakarta', hospitalCode: 'RSHB-JKT-001', hospitalName: 'RS Premier Harapan Bangsa', city: 'Jakarta Selatan', provinceCode: '31', cityCode: '3171', districtCode: '317106', villageCode: '3171061003', simrsArchitectureStyle: 'Modular JSON/CamelCase', scenarioTitle: 'Acute STEMI intervensi kardiologi', scenarioSummary: 'Episode akut infark miokard dengan pemasangan coronary stent dan penjamin komersial.',
    rawSimrsTables: { MasterPasien: [{ patientId: 'pat-harapan-001', nationalId: '3171010202850002', medicalRecordNumber: 'MR-JKT-001', fullName: 'Siti Rahmawati', gender: 'female', birthDate: '1985-02-02' }], EpisodeKunjungan: [{ episodeId: 'enc-harapan-001', patientId: 'pat-harapan-001', encounterClass: 'IMP', encounterStatus: 'finished', startAt: '2026-10-26T19:00:00+07:00', endAt: '2026-10-28T11:00:00+07:00', primaryCode: 'I21.0', secondaryCode: 'I10', room: 'CCU-02' }], TagihanFinansial: [{ claimId: 'clm-harapan-001', packageCode: 'DRG-CARD-STEMI', roomAmount: 1500000, procedureAmount: 18000000, medicationAmount: 450000, adjudication: 'complete' }] },
    defaultOverrides: defaults({ primaryDiagnosisCode: 'I21.0', secondaryDiagnosisCode: 'I10', procedureCode: '36.06', roomChargeDays: 2, roomUnitPriceIdr: 750000, procedurePriceIdr: 18000000, medicationPriceIdr: 450000, approvedRoomBenefitIdr: 1500000, approvedProcedureBenefitIdr: 18000000, approvedMedicationBenefitIdr: 450000 })
  },
  {
    id: 'rsia-bunda-bandung', hospitalCode: 'RSIA-BDG-001', hospitalName: 'RSIA Bunda Sejahtera', city: 'Bandung', provinceCode: '32', cityCode: '3273', districtCode: '327311', villageCode: '3273111002', simrsArchitectureStyle: 'Regional clinic / maternal', scenarioTitle: 'Pre-eklampsia emergency delivery', scenarioSummary: 'IGD maternal dengan operasi seksio sesarea; tersedia pasien temporer untuk latihan Patient.link merge.',
    rawSimrsTables: { reg_pasien: [{ patient_key: 'pat-bunda-001', nik: '3273010303900003', mrn: 'MR-BDG-001', name: 'Dewi Lestari', sex: 'F', dob: '1990-03-03' }], igd_visit: [{ visit_key: 'enc-bunda-001', patient_key: 'pat-bunda-001', kelas: 'EMER', state: 'finished', check_in: '2026-10-29T03:00:00+07:00', discharge: '2026-10-30T10:00:00+07:00', dx_primary: 'O14.1', dx_secondary: 'Z38.01', room_code: 'VK-03' }], klaim_jkn: [{ claim_key: 'clm-bunda-001', cbg_code: 'DRG-OBS-CSECTION', biaya_kamar: 1000000, biaya_tindakan: 8500000, biaya_obat: 225000, hasil: 'complete' }], pasien_temp_igd: [{ patient_key: 'pat-temp-igd-003', name: 'Dewi L.', sex: 'F', dob: '1990-03-03' }] },
    defaultOverrides: defaults({ encounterClass: 'EMER', primaryDiagnosisCode: 'O14.1', secondaryDiagnosisCode: 'Z38.01', procedureCode: '74.1', roomChargeDays: 1, roomUnitPriceIdr: 1000000, procedurePriceIdr: 8500000, medicationPriceIdr: 225000, approvedRoomBenefitIdr: 1000000, approvedProcedureBenefitIdr: 8500000, approvedMedicationBenefitIdr: 225000, mergedDuplicatePatient: true })
  }
];

export const FHIR_ATTRIBUTE_ANNOTATIONS: Record<string, Record<string, string>> = {
  Organization: { id: 'ID teknis resource organisasi', identifier: 'Nomor identitas fasilitas dan namespace URI', name: 'Nama resmi rumah sakit', address: 'Alamat dan kode wilayah Kemendagri' },
  Patient: { identifier: 'NIK/IHS/MRN dinormalisasi sebagai identifier[]', name: 'Nama pasien dalam HumanName', managingOrganization: 'Referensi organisasi pengelola pasien', link: 'Hubungan rekam duplikat menggunakan replaced-by/replaces' },
  Encounter: { status: 'Status siklus kunjungan FHIR', class: 'Kelas layanan AMB/EMER/IMP', diagnosis: 'Diagnosis beserta use/rank', hospitalization: 'Informasi pulang/disposisi' },
  Condition: { clinicalStatus: 'Status klinis diagnosis', code: 'Kode ICD-10 atau SNOMED CT', encounter: 'Kunjungan yang mendasari diagnosis', diagnosis_role_code: 'Peran diagnosis dari Encounter.diagnosis.use' },
  Observation: { code: 'Kode LOINC pemeriksaan', component: 'Komponen panel seperti sistolik/diastolik', valueQuantity: 'Nilai tunggal dengan unit UCUM' },
  Claim: { diagnosis: 'Bukti diagnosis klinis', procedure: 'Bukti tindakan klinis', item: 'Rincian biaya yang dapat diratakan SQL-on-FHIR', total: 'Money langsung, mata uang IDR' },
  ClaimResponse: { total: 'Array adjudikasi submitted dan benefit', outcome: 'Hasil proses adjudikasi' },
  Composition: { section: 'Lima bagian resume medis dengan entry/text/emptyReason' },
  Bundle: { entry: 'Resource transaksi dan request HTTP yang diurutkan' },
  Practitioner: { identifier: 'IHS tenaga kesehatan', qualification: 'Kualifikasi profesi standar' },
  Location: { status: 'Status ruangan', managingOrganization: 'Organisasi pengelola lokasi' },
  EpisodeOfCare: { patient: 'Referensi pasien', period: 'Rentang episode pelayanan' },
  ServiceRequest: { code: 'Kode layanan yang diminta', requester: 'Praktisi peminta layanan' },
  Consent: { scope: 'Ruang lingkup persetujuan', provision: 'Aturan permit/deny pasien' },
  Provenance: { target: 'Resource yang diproses', agent: 'Aktor pencatat jejak audit' },
  Procedure: { code: 'Kode tindakan ICD-9-CM/SNOMED', performedPeriod: 'Waktu tindakan' },
  DiagnosticReport: { result: 'Referensi hasil Observation', conclusion: 'Kesimpulan laporan diagnostik' },
  Medication: { code: 'Kode obat KFA', form: 'Bentuk sediaan' },
  MedicationRequest: { medicationReference: 'Referensi Medication', dosageInstruction: 'Aturan pemakaian obat' },
  MedicationDispense: { authorizingPrescription: 'Resep yang mengotorisasi dispensing', quantity: 'Jumlah obat diserahkan' },
  Appointment: { participant: 'Pasien dan tenaga kesehatan', start: 'Waktu mulai antrean' },
  Coverage: { beneficiary: 'Pasien penerima manfaat', payor: 'Organisasi penjamin', class: 'Kelas polis' },
  CoverageEligibilityResponse: { outcome: 'Hasil validasi eligibilitas', insurance: 'Detail coverage dan manfaat' },
  Account: { subject: 'Subjek tagihan', coverage: 'Coverage yang digunakan' },
  ChargeItem: { priceOverride: 'Tarif aktual dalam Money IDR', supportingInformation: 'Bukti klinis pendukung' },
  ExplanationOfBenefit: { insurance: 'Coverage yang membayar', total: 'Submitted dan benefit adjudikasi' },
  MeasureReport: { measure: 'Canonical URL indikator mutu', group: 'Populasi denominator/numerator' },
};

export const SAMPLE_ANALYTICAL_SQL_QUERIES: { id: string; title: string; badge: ImplementationStatus; description: string; sql: string }[] = [
  { id: 'clinical-diagnosis-recap', title: 'Rekap diagnosis klinis lintas rumah sakit', badge: 'IMPLEMENTED_SATUSEHAT', description: 'Menghitung encounter dan pasien unik berdasarkan organisasi, kelas encounter, peran diagnosis, dan peringkat.', sql: 'SELECT organization_name, province_code, encounter_class, diagnosis_code, diagnosis_display, diagnosis_role_code, diagnosis_rank, total_encounters, total_unique_patients FROM vw_fhir_clinical_diagnosis_recap ORDER BY total_encounters DESC;' },
  { id: 'financial-claim-recap', title: 'Rekap klaim dan adjudikasi', badge: 'PIONEER_GLOBAL_FHIR', description: 'Membandingkan nilai klaim yang diajukan dengan manfaat yang disetujui.', sql: 'SELECT provider_organization, claim_type, diagnosis_package_code, adjudication_outcome, total_claims, total_submitted_amount, total_approved_benefit_amount, total_variance_amount, currency FROM vw_fhir_financial_claim_recap ORDER BY total_submitted_amount DESC;' },
  { id: 'clinical-to-claim-audit', title: 'Audit rantai bukti klinis ke klaim', badge: 'PIONEER_GLOBAL_FHIR', description: 'Menggabungkan diagnosis primer, resume pulang, encounter, claim, response, dan EOB.', sql: 'SELECT provider_organization, claim_id, patient_name, principal_diagnosis, diagnosis_package_code, submitted_amount, approved_benefit_amount, claim_outcome FROM vw_fhir_clinical_to_claim_audit ORDER BY claim_id;' },
  { id: 'cross-hospital-condition-claim', title: 'Join diagnosis dan finansial lintas rumah sakit', badge: 'PIONEER_GLOBAL_FHIR', description: 'Contoh join tabel normalized untuk audit per diagnosis.', sql: 'SELECT o.name AS hospital, c.code_value AS diagnosis, cl.total_value AS submitted_amount, cr.total_benefit_value AS approved_amount FROM fhir_condition c JOIN fhir_encounter e ON e.id = c.encounter_id JOIN fhir_organization o ON o.id = e.service_provider_org_id JOIN fhir_claim cl ON cl.encounter_id = e.id LEFT JOIN fhir_claim_response cr ON cr.claim_id = cl.id ORDER BY o.name, c.diagnosis_rank;' }
];
