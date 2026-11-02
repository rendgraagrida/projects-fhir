import type {
  Account, Address, Appointment, Bundle, BundleEntry, ChargeItem, Claim, ClaimItem, ClaimResponse, CodeableConcept, Composition, Condition, Consent, Coverage, CoverageEligibilityRequest, CoverageEligibilityResponse, DiagnosticReport, Encounter, EpisodeOfCare, ExplanationOfBenefit, FhirResource, HumanName, Location, MeasureReport, Medication, MedicationDispense, MedicationRequest, Money, NormalizedHospitalDataset, Observation, Organization, Patient, Practitioner, Procedure, Provenance, Reference, ReferenceIndex, ReferenceResolution, ServiceRequest, SimpleQuantity, SandboxClinicalFinancialOverrides, SupportedTopLevelResource
} from '../types/fhir-global';
import { STANDARD_TERMINOLOGY_DICTIONARY } from '../data/simrs-normalization-seeds';
import type { SimrsHospitalSeed } from '../types/fhir-global';
export class NormalizationError extends Error {
  constructor(message: string, readonly path?: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}


const coding = (system: string, code: string, display?: string) => ({ system, code, display });
const concept = (system: string, code: string, display?: string): CodeableConcept => ({ coding: [coding(system, code, display)] });
const ref = (resourceType: string, id: string, display?: string): Reference => ({ reference: `${resourceType}/${id}`, display });
const money = (value: number, currency = 'IDR'): Money => ({ value, currency });
const quantity = (value: number, unit: string, system = 'http://unitsofmeasure.org', code = unit) => ({ value, unit, system, code });
const identifier = (system: string, value: string, use?: 'official' | 'usual' | 'temp' | 'secondary', typeCode?: { code: string; display: string }) => ({
  ...(use ? { use } : {}),
  ...(typeCode ? { type: concept('http://terminology.hl7.org/CodeSystem/v2-0203', typeCode.code, typeCode.display) } : {}),
  system,
  value,
});
const deterministicUuidV4 = (seedStr: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0xcafebabe;
  let h4 = 0xdeadbeef;
  for (let i = 0; i < seedStr.length; i++) {
    const c = seedStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ c, 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ c, 0x27d4eb2f) >>> 0;
  }
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0').slice(0, len);
  return `${hex(h1, 8)}-${hex(h2, 4)}-4${hex(h2 >>> 16, 3)}-8${hex(h3, 3)}-${hex(h3 >>> 12, 4)}${hex(h4, 8)}`;
};
const mergedTableRow = (seed: SimrsHospitalSeed): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const [tableName, rows] of Object.entries(seed.rawSimrsTables)) {
    if (tableName === 'pasien_temp_igd') continue;
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (merged[k] === undefined) merged[k] = v;
      }
    }
  }
  return merged;
};
const findValue = (row: Record<string, unknown>, keys: string[], fallback: string): string => {
  for (const key of keys) { const value = row[key]; if (typeof value === 'string' && value.length > 0) return value; if (typeof value === 'number') return String(value); }
  return fallback;
};
const dateValue = (row: Record<string, unknown>, keys: string[], fallback: string): string => {
  const value = findValue(row, keys, fallback);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new NormalizationError(`Tanggal tidak valid: ${value}.`, keys[0]);
  }
  return value;
};
const amount = (v: number | undefined, fallback: number, path = 'amount'): number => {
  if (v === undefined) return fallback;
  if (!Number.isFinite(v) || v < 0) throw new NormalizationError(`Nilai finansial tidak valid: ${String(v)}.`, path);
  if (v > 1_000_000_000_000) throw new NormalizationError('Nilai finansial melebihi batas aman.', path);
  return v;
};

export function sortBundleEntriesForTransaction(entries: BundleEntry[]): BundleEntry[] {
  const rank: Record<string, number> = { DELETE: 0, POST: 1, PUT: 2, GET: 3 };
  return entries.map((entry, index) => ({ entry, index })).sort((a, b) => {
    const ar = rank[a.entry.request?.method ?? 'GET'] ?? 3;
    const br = rank[b.entry.request?.method ?? 'GET'] ?? 3;
    return ar - br || a.index - b.index;
  }).map(({ entry }) => entry);
}

function replaceUrns(value: unknown, mappings: Map<string, string>): unknown {
  if (typeof value === 'string') {
    if (mappings.has(value)) return mappings.get(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(item => replaceUrns(item, mappings));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      result[key] = replaceUrns(child, mappings);
    }
    return result;
  }
  return value;
}
export function resolveTransactionBundleUrns(bundle: Bundle): Bundle {
  const mappings = new Map<string, string>();
  for (const entry of bundle.entry ?? []) {
    if (!entry.fullUrl || !entry.resource?.id) continue;
    mappings.set(entry.fullUrl, `${entry.resource.resourceType}/${entry.resource.id}`);
  }
  const resolvedEntries = (bundle.entry ?? []).map(entry => {
    const resolved: BundleEntry = { ...entry };
    if (resolved.resource) resolved.resource = replaceUrns(resolved.resource, mappings) as FhirResource;
    return resolved;
  });
  return { ...bundle, entry: resolvedEntries };
}
export function buildReferenceIndex(resources: readonly FhirResource[], bundle?: Bundle): ReferenceIndex {
  const byKey = new Map<string, FhirResource>();
  const byFullUrl = new Map<string, FhirResource>();
  for (const resource of resources) if (resource.id) byKey.set(`${resource.resourceType}/${resource.id}`, resource);
  for (const entry of bundle?.entry ?? []) {
    if (entry.resource?.id) byKey.set(`${entry.resource.resourceType}/${entry.resource.id}`, entry.resource);
    if (entry.fullUrl && entry.resource) byFullUrl.set(entry.fullUrl, entry.resource);
  }
  return { byKey, byFullUrl };
}

export function resolveReference(reference: Reference, owner: FhirResource, index: ReferenceIndex, expectedTypes: readonly string[] = []): ReferenceResolution {
  if (reference.identifier && !reference.reference) return { state: 'logical', identifier: reference.identifier };
  const value = reference.reference;
  if (!value) return { state: 'invalid', reason: 'Reference requires reference or identifier.' };
  if (value.startsWith('#')) {
    const target = owner.contained?.find(resource => `#${resource.id}` === value);
    if (!target) return { state: 'unresolved', reference: value };
    if (expectedTypes.length && !expectedTypes.includes(target.resourceType)) return { state: 'invalid', reference: value, reason: 'Contained reference has an unexpected resource type.' };
    return { state: 'resolved', target, key: `${target.resourceType}/${target.id}`, owner: `${owner.resourceType}/${owner.id}` };
  }
  const directKey = value.match(/(?:^|\/)([A-Z][A-Za-z]+)\/([^/]+)$/);
  const key = directKey ? `${directKey[1]}/${directKey[2]}` : undefined;
  const target = index.byFullUrl.get(value) ?? (key ? index.byKey.get(key) : undefined);
  if (!target) return /^https?:\/\//.test(value) ? { state: 'external', reference: value } : { state: 'unresolved', reference: value };
  if (expectedTypes.length && !expectedTypes.includes(target.resourceType)) return { state: 'invalid', reference: value, reason: 'Reference has an unexpected resource type.' };
  return { state: 'resolved', target, key: `${target.resourceType}/${target.id}` };
}


export function normalizeSimrsToFhir(seed: SimrsHospitalSeed, overrides: Partial<SandboxClinicalFinancialOverrides> = {}): NormalizedHospitalDataset {
  const o = { ...seed.defaultOverrides, ...overrides };
  const baseRow = mergedTableRow(seed);
  const patientId = `patient-${seed.id}`;
  const orgId = `org-${seed.id}`;
  const payorId = `payor-${seed.id}`;
  const practitionerId = `practitioner-${seed.id}`;
  const locationId = `location-${seed.id}`;
  const episodeId = `episode-${seed.id}`;
  const serviceRequestId = `service-request-${seed.id}`;
  const encounterId = `encounter-${seed.id}`;
  const consentId = `consent-${seed.id}`;
  const provenanceId = `provenance-${seed.id}`;
  const procedureId = `procedure-${seed.id}`;
  const diagnosticReportId = `diagnostic-report-${seed.id}`;
  const medicationId = `medication-${seed.id}`;
  const medicationRequestId = `medication-request-${seed.id}`;
  const medicationDispenseId = `medication-dispense-${seed.id}`;
  const compositionId = `composition-${seed.id}`;
  const appointmentId = `appointment-${seed.id}`;
  const coverageId = `coverage-${seed.id}`;
  const eligibilityId = `coverage-eligibility-${seed.id}`;
  const accountId = `account-${seed.id}`;
  const claimId = `claim-${seed.id}`;
  const responseId = `claim-response-${seed.id}`;
  const eobId = `eob-${seed.id}`;
  const measureId = `measure-report-${seed.id}`;
  const now = '2026-10-30T15:00:00+07:00';
  const start = dateValue(baseRow, ['masuk', 'startAt', 'check_in'], '2026-10-25T08:00:00+07:00');
  const end = dateValue(baseRow, ['pulang', 'endAt', 'discharge'], '2026-10-30T14:00:00+07:00');
  const fullName = findValue(baseRow, ['nama_lengkap', 'fullName', 'name'], seed.city === 'Surabaya' ? 'Budi Santoso' : seed.city === 'Bandung' ? 'Dewi Lestari' : 'Siti Rahmawati');
  const nik = findValue(baseRow, ['nik', 'nationalId'], `999${seed.provinceCode}000000000`);
  const mrn = findValue(baseRow, ['no_rm', 'medicalRecordNumber', 'mrn'], `MR-${seed.hospitalCode}`);
  const genderRaw = findValue(baseRow, ['jenis_kelamin', 'gender', 'sex'], 'unknown').toLowerCase();
  const gender: Patient['gender'] = genderRaw === 'l' || genderRaw === 'male' ? 'male' : genderRaw === 'p' || genderRaw === 'f' || genderRaw === 'female' ? 'female' : 'unknown';
  const birthDate = findValue(baseRow, ['tanggal_lahir', 'birthDate', 'dob'], '1980-01-01');
  const primaryCode = o.primaryDiagnosisCode ?? findValue(baseRow, ['kode_diagnosa_utama', 'primaryCode', 'primary_code', 'dx_primary'], 'J18.9');
  const secondaryCode = o.secondaryDiagnosisCode ?? findValue(baseRow, ['kode_diagnosa_sekunder', 'secondaryCode', 'secondary_code', 'dx_secondary'], 'E11.9');
  const procedureCode = o.procedureCode ?? findValue(baseRow, ['kode_tindakan', 'procedureCode', 'procedure_code'], '96.71');
  const roomName = findValue(baseRow, ['kode_ruang', 'room', 'room_code'], 'WARD-01');
  const addresses = (use: 'home' | 'work'): Address[] => [
    {
      use,
      type: 'both',
      city: seed.city,
      state: seed.provinceCode,
      district: seed.districtCode,
      line: [`Jalan Pendidikan ${seed.hospitalCode}`],
      country: 'ID',
      extension: [
        {
          url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
          extension: [
            { url: 'province', valueCode: seed.provinceCode },
            { url: 'city', valueCode: seed.cityCode },
            { url: 'district', valueCode: seed.districtCode },
            { url: 'village', valueCode: seed.villageCode },
            { url: 'rt', valueCode: '001' },
            { url: 'rw', valueCode: '002' },
          ],
        },
      ],
    },
  ];
  const rawPayorType = findValue(baseRow, ['payor_type', 'payerType', 'coverage_type'], seed.id === 'rs-harapan-bangsa-jakarta' ? 'commercial' : 'public');
  const commercialPayor = rawPayorType === 'commercial';
  const payorName = findValue(baseRow, ['payor_name', 'payerName'], commercialPayor ? 'PT Asuransi Kesehatan Sejahtera' : `Penjamin ${seed.hospitalName}`);
  const organization: Organization = { resourceType: 'Organization', id: orgId, identifier: [identifier('http://sys-ids.kemkes.go.id/organization', seed.hospitalCode, 'official')], active: true, type: [concept('http://terminology.hl7.org/CodeSystem/organization-type', 'prov', 'Healthcare Provider')], name: seed.hospitalName, address: addresses('work') };
  const payorOrganization: Organization = { resourceType: 'Organization', id: payorId, identifier: [commercialPayor ? identifier('https://example.org/fhir/insurance-organization', 'COMM-INS-001', 'official') : identifier('http://bpjs-kesehatan.go.id/id', `BPJS-${seed.hospitalCode}`, 'official')], active: true, type: [concept('http://terminology.hl7.org/CodeSystem/organization-type', 'ins', 'Insurance')], name: payorName, address: addresses('work') };
  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    extension: [{ url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/citizenshipStatus', valueCode: 'WNI' }],
    identifier: [
      identifier('https://fhir.kemkes.go.id/id/nik', nik, 'official', { code: 'NNIDN', display: 'National Person Identifier (Indonesia)' }),
      identifier('https://fhir.kemkes.go.id/id/ihs-number', `P${seed.provinceCode}${seed.hospitalCode}`, 'official'),
      identifier(`http://sys-ids.kemkes.go.id/mrn/${seed.hospitalCode}`, mrn, 'usual', { code: 'MR', display: 'Medical record number' }),
    ],
    active: true,
    name: [{ use: 'official', text: fullName, family: fullName.split(' ').slice(-1)[0], given: fullName.split(' ').slice(0, -1) }],
    gender,
    birthDate,
    address: addresses('home'),
    managingOrganization: ref('Organization', orgId),
  };
  let duplicateEmergencyPatient: Patient | undefined;
  if (seed.id === 'rsia-bunda-bandung' && o.mergedDuplicatePatient) {
    duplicateEmergencyPatient = {
      ...patient,
      id: 'pat-temp-igd-003',
      identifier: [identifier(`http://sys-ids.kemkes.go.id/mrn/${seed.hospitalCode}`, 'pat-temp-igd-003', 'temp', { code: 'MR', display: 'Medical record number' })],
      name: [{ use: 'temp', text: 'Dewi L.' }],
      link: [{ other: ref('Patient', patientId), type: 'replaced-by' }],
    };
  }
  const practitioner: Practitioner = { resourceType: 'Practitioner', id: practitionerId, identifier: [identifier('https://fhir.kemkes.go.id/id/ihs-number', `PRACT-${seed.hospitalCode}`, 'official')], active: true, name: [{ use: 'official', text: 'dr. Andi Pratama', family: 'Pratama', given: ['Andi'] }], qualification: [{ code: concept('http://snomed.info/sct', '309343006', 'Physician') }] };
  const location: Location = { resourceType: 'Location', id: locationId, identifier: [identifier(`http://sys-ids.kemkes.go.id/location/${seed.hospitalCode}`, roomName, 'official')], status: 'active', name: roomName, mode: 'instance', physicalType: concept('http://terminology.hl7.org/CodeSystem/location-physical-type', 'ro', 'Room'), managingOrganization: ref('Organization', orgId) };
  const episodeOfCare: EpisodeOfCare = { resourceType: 'EpisodeOfCare', id: episodeId, identifier: [identifier(`http://sys-ids.kemkes.go.id/episode-of-care/${seed.hospitalCode}`, `EOC-${seed.hospitalCode}`)], status: 'finished', patient: ref('Patient', patientId), managingOrganization: ref('Organization', orgId), period: { start, end } };
  const procedureDisplay = STANDARD_TERMINOLOGY_DICTIONARY.ICD9CM.concepts[procedureCode as keyof typeof STANDARD_TERMINOLOGY_DICTIONARY.ICD9CM.concepts] ?? procedureCode;
  const serviceRequest: ServiceRequest = { resourceType: 'ServiceRequest', id: serviceRequestId, identifier: [identifier(`http://sys-ids.kemkes.go.id/servicerequest/${seed.hospitalCode}`, `SR-${seed.hospitalCode}`)], status: 'completed', intent: 'order', category: [concept('http://snomed.info/sct', '386053000', 'Evaluation procedure')], priority: 'routine', code: concept('http://hl7.org/fhir/sid/icd-9-cm', procedureCode, procedureDisplay), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), authoredOn: start, requester: ref('Practitioner', practitionerId), performer: [ref('Organization', orgId)] };
  const encounterClass = Object.prototype.hasOwnProperty.call(overrides, 'encounterClass') ? overrides.encounterClass ?? 'IMP' : findValue(baseRow, ['kelas', 'encounterClass', 'encounter_class'], o.encounterClass || 'IMP');
  const encounterStatus = Object.prototype.hasOwnProperty.call(overrides, 'encounterStatus') ? overrides.encounterStatus ?? 'finished' : findValue(baseRow, ['status', 'encounterStatus', 'encounter_status', 'state'], o.encounterStatus || 'finished') as Encounter['status'];
  const encounter: Encounter = { resourceType: 'Encounter', id: encounterId, identifier: [identifier(`http://sys-ids.kemkes.go.id/encounter/${seed.hospitalCode}`, `ENC-${seed.hospitalCode}`, 'official')], status: encounterStatus, class: coding('http://terminology.hl7.org/CodeSystem/v3-ActCode', encounterClass, encounterClass === 'EMER' ? 'emergency' : encounterClass === 'IMP' ? 'inpatient encounter' : 'ambulatory'), serviceType: concept('http://terminology.hl7.org/CodeSystem/service-type', encounterClass === 'EMER' ? '57' : '124', encounterClass === 'EMER' ? 'Emergency Medical' : 'General Medical'), subject: ref('Patient', patientId), episodeOfCare: [ref('EpisodeOfCare', episodeId)], basedOn: [ref('ServiceRequest', serviceRequestId)], period: { start, end }, participant: [{ individual: ref('Practitioner', practitionerId), type: [concept('http://terminology.hl7.org/CodeSystem/v3-ParticipationType', 'ATND', 'Attender')] }], location: [{ location: ref('Location', locationId), status: 'completed', period: { start, end } }], hospitalization: { dischargeDisposition: concept('http://terminology.hl7.org/CodeSystem/discharge-disposition', o.dischargeDispositionCode || 'home') }, serviceProvider: ref('Organization', orgId) };
  const conditions: Condition[] = [
    { resourceType: 'Condition', id: `condition-${seed.id}-primary`, clinicalStatus: concept('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active'), verificationStatus: concept('http://terminology.hl7.org/CodeSystem/condition-ver-status', 'confirmed'), category: [concept('http://terminology.hl7.org/CodeSystem/condition-category', 'encounter-diagnosis')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.ICD10.system, primaryCode, STANDARD_TERMINOLOGY_DICTIONARY.ICD10.concepts[primaryCode as keyof typeof STANDARD_TERMINOLOGY_DICTIONARY.ICD10.concepts] ?? primaryCode), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), recordedDate: start },
    { resourceType: 'Condition', id: `condition-${seed.id}-secondary`, clinicalStatus: concept('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active'), verificationStatus: concept('http://terminology.hl7.org/CodeSystem/condition-ver-status', 'confirmed'), category: [concept('http://terminology.hl7.org/CodeSystem/condition-category', 'encounter-diagnosis')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.ICD10.system, secondaryCode, STANDARD_TERMINOLOGY_DICTIONARY.ICD10.concepts[secondaryCode as keyof typeof STANDARD_TERMINOLOGY_DICTIONARY.ICD10.concepts] ?? secondaryCode), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), recordedDate: start }
  ];
  encounter.diagnosis = [{ condition: ref('Condition', conditions[0].id), use: concept('http://terminology.hl7.org/CodeSystem/diagnosis-role', 'AD', 'Admission diagnosis'), rank: 1 }, { condition: ref('Condition', conditions[1].id), use: concept('http://terminology.hl7.org/CodeSystem/diagnosis-role', 'CM', 'Comorbidity diagnosis'), rank: 2 }];
  if (o.injectBrokenEvidenceChain) encounter.diagnosis[0].condition = ref('Condition', 'condition-missing');
  const procedures: Procedure[] = [{ resourceType: 'Procedure', id: procedureId, status: 'completed', category: concept('http://snomed.info/sct', '387713003', 'Surgical procedure'), code: concept(STANDARD_TERMINOLOGY_DICTIONARY.ICD9CM.system, procedureCode, procedureDisplay), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), performedPeriod: { start, end }, performer: [{ actor: ref('Practitioner', practitionerId) }] }];
  const bloodPressure: Observation = { resourceType: 'Observation', id: `observation-${seed.id}-bp`, status: 'final', category: [concept('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '85354-9', 'Blood pressure panel'), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), basedOn: [ref('ServiceRequest', serviceRequestId)], effectiveDateTime: start, issued: now, performer: [ref('Practitioner', practitionerId)], component: [{ code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '8480-6', 'Systolic blood pressure'), valueQuantity: quantity(o.systolicBp ?? 120, 'mm[Hg]') }, { code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '8462-4', 'Diastolic blood pressure'), valueQuantity: quantity(o.diastolicBp ?? 80, 'mm[Hg]') }] };
  if (o.injectObs7Violation) bloodPressure.valueQuantity = quantity(o.systolicBp ?? 120, 'mm[Hg]');
  const observations: Observation[] = [
    bloodPressure,
    { resourceType: 'Observation', id: `observation-${seed.id}-hr`, status: 'final', category: [concept('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '8867-4', 'Heart rate'), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), basedOn: [ref('ServiceRequest', serviceRequestId)], effectiveDateTime: start, performer: [ref('Practitioner', practitionerId)], valueQuantity: quantity(o.heartRate ?? 82, '/min') },
    { resourceType: 'Observation', id: `observation-${seed.id}-temp`, status: 'final', category: [concept('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '8310-5', 'Body temperature'), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), basedOn: [ref('ServiceRequest', serviceRequestId)], effectiveDateTime: start, performer: [ref('Practitioner', practitionerId)], valueQuantity: quantity(o.bodyTemp ?? 36.8, 'Cel') }
  ];
  const diagnosticReport: DiagnosticReport = { resourceType: 'DiagnosticReport', id: diagnosticReportId, status: 'final', category: [concept('http://terminology.hl7.org/CodeSystem/v2-0074', 'LAB', 'Laboratory')], code: concept(STANDARD_TERMINOLOGY_DICTIONARY.LOINC.system, '85354-9', 'Blood pressure panel'), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), basedOn: [ref('ServiceRequest', serviceRequestId)], issued: now, performer: [ref('Practitioner', practitionerId)], result: observations.map(item => ref('Observation', item.id)), conclusion: 'Hasil vital sign tercatat.' };
  const kfaCode = seed.city === 'Jakarta Selatan' ? '93000003' : '93000001';
  const kfaDisplay = seed.city === 'Jakarta Selatan' ? 'Aspirin 80 mg tablet' : 'Paracetamol 500 mg tablet';
  const medication: Medication = {
    resourceType: 'Medication',
    id: medicationId,
    extension: [{ url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType', valueCodeableConcept: concept('https://terminology.kemkes.go.id/CodeSystem/medication-type', 'NC', 'Non-compound') }],
    code: concept(STANDARD_TERMINOLOGY_DICTIONARY.KFA.system, kfaCode, kfaDisplay),
    status: 'active',
    form: concept('http://snomed.info/sct', '385055001', 'Tablet'),
  };
  const medicationRequest: MedicationRequest = { resourceType: 'MedicationRequest', id: medicationRequestId, status: 'completed', intent: 'order', category: [concept('http://terminology.hl7.org/CodeSystem/medicationrequest-category', 'inpatient', 'Inpatient')], medicationReference: ref('Medication', medicationId), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), authoredOn: start, requester: ref('Practitioner', practitionerId), dosageInstruction: [{ text: '1 tablet setiap 8 jam' }], dispenseRequest: { quantity: { value: 9, unit: 'tablet', system: 'http://unitsofmeasure.org', code: '{tbl}' } } };
  const dispenseQuantity: SimpleQuantity = { value: 9, unit: 'tablet', system: 'http://unitsofmeasure.org', code: '{tbl}' };
  const medicationDispense: MedicationDispense = { resourceType: 'MedicationDispense', id: medicationDispenseId, status: 'completed', medicationReference: ref('Medication', medicationId), subject: ref('Patient', patientId), context: ref('Encounter', encounterId), authorizingPrescription: [ref('MedicationRequest', medicationRequestId)], quantity: dispenseQuantity, daysSupply: { value: amount(o.roomChargeDays, 3, 'daysSupply'), unit: 'd', system: 'http://unitsofmeasure.org', code: 'd' }, whenHandedOver: end };
  const section = (title: string, code: string, resources: FhirResource[], text: string): Composition['section'][number] => { const result: Composition['section'][number] = { title, code: concept('http://loinc.org', code, title), entry: resources.map(resource => ref(resource.resourceType, resource.id)), text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${text}</div>` } }; if (o.injectCmp1Violation) { delete result.entry; delete result.text; } return result; };
  const composition: Composition = { resourceType: 'Composition', id: compositionId, status: 'final', type: concept('http://loinc.org', '18842-5', 'Discharge summary'), subject: ref('Patient', patientId), encounter: ref('Encounter', encounterId), date: end, author: [ref('Practitioner', practitionerId)], title: 'Resume Medis Pulang', section: [section('Diagnosis', '11535-2', conditions, 'Diagnosis klinis'), section('Procedures', '29554-3', procedures, 'Tindakan medis'), section('Observations', '61150-9', observations, 'Hasil pengamatan'), section('Medications', '19009-0', [medication, medicationRequest, medicationDispense], 'Terapi obat'), section('Disposition', '8653-8', [encounter], 'Disposisi pasien')] };
  const appointment: Appointment = { resourceType: 'Appointment', id: appointmentId, status: 'fulfilled', serviceCategory: [concept('http://terminology.hl7.org/CodeSystem/service-category', '17', 'General Practice')], start, end, created: start, participant: [{ actor: ref('Patient', patientId), status: 'accepted', required: 'required' }, { actor: ref('Practitioner', practitionerId), status: 'accepted', required: 'required' }, { actor: ref('Location', locationId), status: 'accepted', required: 'required' }] };
  const coverage: Coverage = { resourceType: 'Coverage', id: coverageId, status: 'active', identifier: [commercialPayor ? identifier('https://example.org/fhir/insurance-policy', `POL-${seed.hospitalCode}`) : identifier('http://bpjs-kesehatan.go.id/id/kartu', `000${seed.provinceCode}${seed.hospitalCode}`)], type: commercialPayor ? concept('http://terminology.hl7.org/CodeSystem/v3-ActCode', 'EHCPOL', 'extended healthcare') : concept('http://terminology.hl7.org/CodeSystem/v3-ActCode', 'PUBLICPOL', 'Public healthcare'), subscriberId: `SUB-${seed.hospitalCode}`, beneficiary: ref('Patient', patientId), subscriber: ref('Patient', patientId), payor: [ref('Organization', payorId, payorName)], class: [{ type: concept('http://terminology.hl7.org/CodeSystem/coverage-class', 'plan'), value: commercialPayor ? 'COMMERCIAL' : 'JKN-Kelas-1', name: commercialPayor ? 'Asuransi komersial' : 'JKN Kelas 1' }], period: { start: '2026-01-01', end: '2026-12-31' } };
  const containedRequest: CoverageEligibilityRequest = { resourceType: 'CoverageEligibilityRequest', id: 'eligibility-request', status: 'active', purpose: ['validation', 'benefits'], patient: ref('Patient', patientId), created: now, insurer: ref('Organization', payorId), insurance: [{ focal: true, coverage: ref('Coverage', coverageId) }] };
  const coverageEligibilityResponse: CoverageEligibilityResponse = { resourceType: 'CoverageEligibilityResponse', id: eligibilityId, contained: [containedRequest], status: 'active', purpose: ['validation', 'benefits'], patient: ref('Patient', patientId), created: now, requestor: ref('Organization', orgId), request: { reference: '#eligibility-request' }, outcome: o.adjudicationOutcome || 'complete', insurer: ref('Organization', payorId), disposition: 'Coverage aktif dan memenuhi syarat', insurance: [{ coverage: ref('Coverage', coverageId), inforce: true }] };
  const account: Account = { resourceType: 'Account', id: accountId, status: 'active', type: concept('http://terminology.hl7.org/CodeSystem/v3-ActCode', 'PBILL'), name: `Tagihan ${fullName}`, subject: [ref('Patient', patientId)], owner: ref('Organization', orgId), servicePeriod: { start, end }, coverage: [{ coverage: ref('Coverage', coverageId), priority: 1 }] };
  const roomPrice = amount(o.roomUnitPriceIdr, 750000, 'roomUnitPriceIdr'); const procedurePrice = amount(o.procedurePriceIdr, 2500000, 'procedurePriceIdr'); const medicationPrice = amount(o.medicationPriceIdr, 125000, 'medicationPriceIdr'); const days = amount(o.roomChargeDays, 3, 'roomChargeDays'); const roomTotal = roomPrice * days; if (!Number.isFinite(roomTotal) || roomTotal < 0 || roomTotal > 1_000_000_000_000) throw new NormalizationError('Total ChargeItem tidak finite atau melebihi batas aman.', 'roomTotal');
  const chargeItems: ChargeItem[] = [
    { resourceType: 'ChargeItem', id: `charge-item-${seed.id}-room`, status: 'billed', code: concept('http://terminology.hl7.org/CodeSystem/ex-USCLS', 'ROOM-INPATIENT', `Akomodasi Kamar Rawat (${roomName})`), subject: ref('Patient', patientId), context: ref('Encounter', encounterId), performingOrganization: ref('Organization', orgId), quantity: quantity(days, 'd'), priceOverride: money(roomTotal), account: [ref('Account', accountId)], supportingInformation: [ref('Encounter', encounterId)] },
    { resourceType: 'ChargeItem', id: `charge-item-${seed.id}-procedure`, status: 'billed', code: concept(STANDARD_TERMINOLOGY_DICTIONARY.ICD9CM.system, procedureCode, procedureDisplay), subject: ref('Patient', patientId), context: ref('Encounter', encounterId), performingOrganization: ref('Organization', orgId), quantity: quantity(1, '1'), priceOverride: money(procedurePrice), account: [ref('Account', accountId)], supportingInformation: [ref('Procedure', procedureId)] },
    { resourceType: 'ChargeItem', id: `charge-item-${seed.id}-medication`, status: 'billed', code: concept(STANDARD_TERMINOLOGY_DICTIONARY.KFA.system, kfaCode, kfaDisplay), subject: ref('Patient', patientId), context: ref('Encounter', encounterId), performingOrganization: ref('Organization', orgId), quantity: quantity(1, '1'), priceOverride: money(medicationPrice), account: [ref('Account', accountId)], supportingInformation: [ref('MedicationDispense', medicationDispenseId)] }
  ];
  const benefitCategories = [
    concept('http://terminology.hl7.org/CodeSystem/ex-benefitcategory', 'room', 'Medical Care / Room & Board'),
    concept('http://terminology.hl7.org/CodeSystem/ex-benefitcategory', 'procedure', 'Surgical / Medical Procedure'),
    concept('http://terminology.hl7.org/CodeSystem/ex-benefitcategory', 'medication', 'Pharmacy / Medication'),
  ];
  const submittedTotal = roomTotal + procedurePrice + medicationPrice;
  const claimTotal = o.injectFinancialMismatch ? submittedTotal + 1 : submittedTotal;
  const drgCode = findValue(baseRow, ['drg_code', 'packageCode', 'cbg_code'], `DRG-${seed.hospitalCode}`);
  const claimItems: ClaimItem[] = chargeItems.map((item, index) => ({
    sequence: index + 1,
    category: benefitCategories[index] ?? benefitCategories[0],
    productOrService: item.code,
    diagnosisSequence: [1, 2],
    procedureSequence: [1],
    informationSequence: [1],
    encounter: [ref('Encounter', encounterId)],
    quantity: item.quantity as SimpleQuantity,
    unitPrice: index === 0 ? money(roomPrice) : item.priceOverride,
    net: item.priceOverride ?? money(0),
  }));
  const claim: Claim = { resourceType: 'Claim', id: claimId, identifier: [identifier(`http://sys-ids.kemkes.go.id/claim/${seed.hospitalCode}`, `CLM-${seed.hospitalCode}`, 'official')], status: 'active', type: concept('http://terminology.hl7.org/CodeSystem/claim-type', 'institutional', 'Institutional'), subType: concept('http://terminology.hl7.org/CodeSystem/ex-claimsubtype', encounterClass === 'EMER' ? 'emergency' : 'inpatient', encounterClass === 'EMER' ? 'Emergency Claim' : 'Inpatient Claim'), use: 'claim', billablePeriod: { start, end }, patient: ref('Patient', patientId), created: now, provider: ref('Organization', orgId), insurer: ref('Organization', payorId), priority: concept('http://terminology.hl7.org/CodeSystem/processpriority', 'normal'), insurance: [{ sequence: 1, focal: true, coverage: ref('Coverage', coverageId) }], supportingInfo: [{ sequence: 1, category: concept('http://terminology.hl7.org/CodeSystem/claiminformationcategory', 'info'), valueReference: ref('Composition', compositionId) }], diagnosis: [{ sequence: 1, diagnosisReference: ref('Condition', conditions[0].id), type: [concept('http://terminology.hl7.org/CodeSystem/ex-diagnosistype', 'principal')], packageCode: concept('http://terminology.hl7.org/CodeSystem/ex-diagnosisrelatedgroup', drgCode, 'Hospital DRG/INA-CBG grouping') }, { sequence: 2, diagnosisReference: ref('Condition', conditions[1].id), type: [concept('http://terminology.hl7.org/CodeSystem/ex-diagnosistype', 'comorbidity')] }], procedure: [{ sequence: 1, procedureReference: ref('Procedure', procedureId) }], item: claimItems, total: money(claimTotal) };
  if (o.injectBrokenEvidenceChain && claim.diagnosis[0].diagnosisReference) claim.diagnosis[0].diagnosisReference = ref('Condition', 'condition-missing');
  const approvedTotal = amount(o.approvedRoomBenefitIdr, roomTotal) + amount(o.approvedProcedureBenefitIdr, procedurePrice) + amount(o.approvedMedicationBenefitIdr, medicationPrice);
  const addBenefit = amount(o.addItemBenefitIdr, 0);
  const adjudicationOutcome = Object.prototype.hasOwnProperty.call(overrides, 'adjudicationOutcome') ? overrides.adjudicationOutcome ?? 'complete' : findValue(baseRow, ['status_klaim', 'adjudication', 'hasil'], o.adjudicationOutcome || 'complete') as ClaimResponse['outcome'];
  const claimResponse: ClaimResponse = { resourceType: 'ClaimResponse', id: responseId, status: 'active', type: claim.type, subType: claim.subType, use: 'claim', patient: ref('Patient', patientId), created: now, insurer: ref('Organization', payorId), request: ref('Claim', claimId), outcome: adjudicationOutcome, disposition: 'Klaim diproses oleh penjamin', total: [{ category: concept('http://terminology.hl7.org/CodeSystem/adjudication', 'submitted'), amount: money(submittedTotal) }, { category: concept('http://terminology.hl7.org/CodeSystem/adjudication', 'benefit'), amount: money(approvedTotal) }], addItem: addBenefit > 0 ? [{ productOrService: concept('http://terminology.hl7.org/CodeSystem/ex-benefitcategory', 'additional'), net: money(addBenefit), adjudication: [{ category: concept('http://terminology.hl7.org/CodeSystem/adjudication', 'benefit'), amount: money(addBenefit) }] }] : [], processNote: [{ type: 'display', text: 'Klaim berhasil diverifikasi.' }] };
  const explanationOfBenefit: ExplanationOfBenefit = { resourceType: 'ExplanationOfBenefit', id: eobId, status: 'active', type: claim.type, subType: claim.subType, use: 'claim', patient: ref('Patient', patientId), created: now, insurer: ref('Organization', payorId), provider: ref('Organization', orgId), priority: claim.priority, claim: ref('Claim', claimId), claimResponse: ref('ClaimResponse', responseId), outcome: claimResponse.outcome, disposition: claimResponse.disposition, insurance: [{ focal: true, coverage: ref('Coverage', coverageId) }], total: [{ category: concept('http://terminology.hl7.org/CodeSystem/adjudication', 'submitted'), amount: money(submittedTotal) }, { category: concept('http://terminology.hl7.org/CodeSystem/adjudication', 'benefit'), amount: money(approvedTotal) }] };
  const measureReport: MeasureReport = { resourceType: 'MeasureReport', id: measureId, status: 'complete', type: 'individual', measure: 'https://example.org/fhir/Measure/inpatient-evidence-completeness', subject: ref('Patient', patientId), date: now, reporter: ref('Organization', orgId), period: { start, end }, group: [{ population: [{ code: concept('http://terminology.hl7.org/CodeSystem/measure-population', 'initial-population'), count: 1 }, { code: concept('http://terminology.hl7.org/CodeSystem/measure-population', 'denominator'), count: 1 }, { code: concept('http://terminology.hl7.org/CodeSystem/measure-population', 'numerator'), count: 1 }], measureScore: quantity(1, '1') }], evaluatedResource: [ref('Encounter', encounterId), ref('Claim', claimId)] };
  const consent: Consent = { resourceType: 'Consent', id: consentId, status: 'active', scope: concept('http://terminology.hl7.org/CodeSystem/consentscope', 'patient-privacy'), category: [concept('http://loinc.org', '64292-6', 'Privacy policy')], policyRule: concept('http://terminology.hl7.org/CodeSystem/v3-ActCode', 'OPTIN', 'Opt-in'), patient: ref('Patient', patientId), dateTime: now, organization: [ref('Organization', orgId)], provision: { type: 'permit', period: { start, end } } };
  const provenance: Provenance = { resourceType: 'Provenance', id: provenanceId, target: [ref('Encounter', encounterId), ref('Claim', claimId)], recorded: now, activity: concept('http://terminology.hl7.org/CodeSystem/v3-DataOperation', 'CREATE'), agent: [{ who: ref('Practitioner', practitionerId), type: concept('http://terminology.hl7.org/CodeSystem/provenance-participant-type', 'author') }], signature: [{ type: [coding('urn:iso-astm:E1762-95:2013', '1.2.840.10065.1.12.1.1', "Author's Signature")], when: now, who: ref('Practitioner', practitionerId) }] };
  const concreteResources: SupportedTopLevelResource[] = [organization, payorOrganization, patient, ...(duplicateEmergencyPatient ? [duplicateEmergencyPatient] : []), practitioner, location, episodeOfCare, serviceRequest, encounter, consent, provenance, ...conditions, ...procedures, ...observations, diagnosticReport, medication, medicationRequest, medicationDispense, composition, appointment, coverage, coverageEligibilityResponse, account, ...chargeItems, claim, claimResponse, explanationOfBenefit, measureReport];
  const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = concreteResources.map((_, index) => index === concreteResources.length - 1 ? 'PUT' : 'POST');
  if (o.injectBundleOrderViolation && methods.length > 2) {
    const last = methods.length - 1;
    [methods[0], methods[last]] = [methods[last], methods[0]];
  }
  const transactionBundle: Bundle = {
    resourceType: 'Bundle',
    id: `bundle-${seed.id}`,
    type: 'transaction',
    timestamp: now,
    entry: concreteResources.map((resource, index) => ({
      fullUrl: `urn:uuid:${deterministicUuidV4(`${seed.id}:${resource.resourceType}:${resource.id}`)}`,
      resource,
      request: {
        method: methods[index],
        url: methods[index] === 'POST' ? resource.resourceType : `${resource.resourceType}/${resource.id}`,
      },
    })),
  };
  const sortedBundle = o.injectBundleOrderViolation ? transactionBundle : { ...transactionBundle, entry: sortBundleEntriesForTransaction(transactionBundle.entry ?? []) };
  const resolvedBundle = resolveTransactionBundleUrns(sortedBundle);
  return { hospitalId: seed.id, hospitalName: seed.hospitalName, organization, payorOrganization, patient, duplicateEmergencyPatient, practitioner, location, episodeOfCare, serviceRequest, encounter, consent, provenance, conditions, procedures, observations, diagnosticReport, medication, medicationRequest, medicationDispense, composition, appointment, coverage, coverageEligibilityResponse, account, chargeItems, claim, claimResponse, explanationOfBenefit, measureReport, transactionBundle: resolvedBundle, allResources: concreteResources, resources: concreteResources, contained: [containedRequest], graphRevision: deterministicUuidV4(`${seed.id}:graph:${now}`), sourceMap: Object.fromEntries(concreteResources.map(resource => [`${resource.resourceType}/${resource.id}`, { sourceTable: 'SIMRS', sourceKey: `${seed.id}:${resource.id}`, observedAt: now }])), };
}
