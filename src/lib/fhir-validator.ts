import type { Bundle, Claim, Composition, Encounter, FhirResource, NormalizedHospitalDataset, Observation, Reference, ValidationIssue, ValidationReport, ValidationRuleId, ValidationRuleResult } from '../types/fhir-global';

const ruleTitles: Record<ValidationRuleId, string> = {
  FHIR_STD_01_MANDATORY_CARDINALITY: 'Kardinalitas mandatory resource FHIR',
  FHIR_STD_02_OBSERVATION_INVARIANT_OBS7: 'Invariant obs-7 Observation multi-komponen',
  FHIR_STD_03_COMPOSITION_INVARIANT_CMP1: 'Invariant cmp-1 Composition.section',
  FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN: 'Rantai bukti klinis ke klaim',
  FHIR_STD_05_FINANCIAL_RECONCILIATION: 'Rekonsiliasi finansial IDR',
  FHIR_STD_06_BUNDLE_TRANSACTION_BDL3: 'Invariant bdl-3 Bundle transaction'
};
const descriptions: Record<ValidationRuleId, string> = {
  FHIR_STD_01_MANDATORY_CARDINALITY: 'Memastikan elemen wajib FHIR dan array 1..* terisi.',
  FHIR_STD_02_OBSERVATION_INVARIANT_OBS7: 'Panel tekanan darah menyimpan sistolik/diastolik pada component tanpa value[x] root.',
  FHIR_STD_03_COMPOSITION_INVARIANT_CMP1: 'Setiap section memiliki entry, narrative text, atau emptyReason.',
  FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN: 'Setiap referensi diagnosis, prosedur, dan supporting information menunjuk bukti yang ada.',
  FHIR_STD_05_FINANCIAL_RECONCILIATION: 'Jumlah ChargeItem dan Claim.item konsisten dengan Claim.total dalam IDR.',
  FHIR_STD_06_BUNDLE_TRANSACTION_BDL3: 'Entry transaction memiliki fullUrl/request dan urutan DELETE, POST, PUT, GET.'
};
const referenceKey = (reference: Reference | undefined): string | undefined => reference?.reference;
const idOf = (resource: FhirResource): string => resource.id ?? '(tanpa-id)';
const issue = (ruleId: ValidationRuleId, resource: FhirResource | { resourceType: string; id?: string }, path: string, message: string, remediation: string): ValidationIssue => ({ ruleId, severity: 'error', resourceType: resource.resourceType, resourceId: resource.id ?? '(tanpa-id)', path, message, remediation });
const validConcept = (value: { coding?: { code?: string }[] } | undefined): boolean => Boolean(value?.coding?.some(item => Boolean(item.code)));

function mandatoryIssues(dataset: NormalizedHospitalDataset): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  const resources = dataset.allResources;
  for (const resource of resources) {
    if (!resource.id) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'id', 'Resource wajib memiliki id.', 'Isi id teknis unik sebelum persistensi.'));
  }
  const encounter: Encounter = dataset.encounter;
  if (!encounter.status) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', encounter, 'status', 'Encounter.status wajib terisi.', 'Gunakan status resmi seperti finished atau in-progress.'));
  if (!encounter.class?.code) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', encounter, 'class', 'Encounter.class wajib memiliki kode.', 'Isi kode AMB, EMER, atau IMP.'));
  if (!encounter.subject?.reference) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', encounter, 'subject', 'Encounter.subject wajib menunjuk pasien.', 'Tambahkan Reference Patient/{id}.'));
  if (!dataset.coverage.payor?.length) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.coverage, 'payor', 'Coverage.payor wajib berisi minimal satu penjamin.', 'Tambahkan Reference Organization penjamin.'));
  for (const obs of dataset.observations) {
    if (!obs.status || !obs.category?.length || !validConcept(obs.code) || !obs.subject?.reference) {
      result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', obs, 'status/category/code/subject', 'Observation wajib memiliki status, category, code, dan subject.', 'Lengkapi atribut mandatory Observation.'));
    }
  }
  if (!dataset.composition.status || !validConcept(dataset.composition.type) || !dataset.composition.subject?.reference || !dataset.composition.date || !dataset.composition.author?.length || !dataset.composition.title) {
    result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.composition, 'status/type/subject/date/author/title', 'Composition wajib memiliki status, type, subject, date, author[], dan title.', 'Lengkapi atribut mandatory Composition.'));
  }
  for (const item of dataset.claim.item ?? []) {
    if (!item.sequence || !validConcept(item.productOrService)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.claim, `item[${item.sequence}].productOrService`, 'Claim.item wajib memiliki sequence dan productOrService.', 'Isi kode layanan standar dan sequence positif.'));
    if (!item.encounter?.length || !item.encounter[0]?.reference) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.claim, `item[${item.sequence}].encounter`, 'Claim.item.encounter wajib menunjuk Encounter.', 'Tambahkan Reference Encounter/{id}.'));
    if (!item.net?.value && item.net?.value !== 0) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.claim, `item[${item.sequence}].net`, 'Claim.item.net wajib memiliki nilai.', 'Isi nilai net dalam Money IDR.'));
  }
  const claimRequired: [string, boolean][] = [['status', Boolean(dataset.claim.status)], ['type', validConcept(dataset.claim.type)], ['use', Boolean(dataset.claim.use)], ['patient', Boolean(dataset.claim.patient?.reference)], ['created', Boolean(dataset.claim.created)], ['provider', Boolean(dataset.claim.provider?.reference)], ['priority', validConcept(dataset.claim.priority)], ['insurance', (dataset.claim.insurance?.length ?? 0) > 0]];
  for (const [path, present] of claimRequired) if (!present) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.claim, path, `Claim.${path} wajib terisi.`, 'Lengkapi elemen mandatory Claim sesuai HL7 FHIR.'));
  const responseRequired: [string, boolean][] = [['status', Boolean(dataset.claimResponse.status)], ['type', validConcept(dataset.claimResponse.type)], ['use', Boolean(dataset.claimResponse.use)], ['patient', Boolean(dataset.claimResponse.patient?.reference)], ['created', Boolean(dataset.claimResponse.created)], ['insurer', Boolean(dataset.claimResponse.insurer?.reference)], ['outcome', Boolean(dataset.claimResponse.outcome)], ['total', (dataset.claimResponse.total?.length ?? 0) > 0]];
  for (const [path, present] of responseRequired) if (!present) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.claimResponse, path, `ClaimResponse.${path} wajib terisi.`, 'Lengkapi tujuh elemen mandatory ClaimResponse dan total adjudikasi.'));
  const eobRequired: [string, boolean][] = [['status', Boolean(dataset.explanationOfBenefit.status)], ['type', validConcept(dataset.explanationOfBenefit.type)], ['use', Boolean(dataset.explanationOfBenefit.use)], ['patient', Boolean(dataset.explanationOfBenefit.patient?.reference)], ['created', Boolean(dataset.explanationOfBenefit.created)], ['insurer', Boolean(dataset.explanationOfBenefit.insurer?.reference)], ['provider', Boolean(dataset.explanationOfBenefit.provider?.reference)], ['outcome', Boolean(dataset.explanationOfBenefit.outcome)], ['insurance', (dataset.explanationOfBenefit.insurance?.length ?? 0) > 0]];
  for (const [path, present] of eobRequired) if (!present) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', dataset.explanationOfBenefit, path, `ExplanationOfBenefit.${path} wajib terisi.`, 'Lengkapi elemen root dan insurance wajib EOB.'));
  return result;
}

function obs7Issues(observations: Observation[]): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  for (const observation of observations) {
    const code = observation.code.coding?.find(item => item.system === 'http://loinc.org')?.code;
    if (code !== '85354-9') continue;
    const systolic = observation.component?.find(item => item.code.coding?.some(coding => coding.code === '8480-6'));
    const diastolic = observation.component?.find(item => item.code.coding?.some(coding => coding.code === '8462-4'));
    const rootValuePresent = observation.valueQuantity !== undefined || observation.valueCodeableConcept !== undefined || observation.valueString !== undefined || observation.valueBoolean !== undefined || observation.valueInteger !== undefined;
    const validSys = Number.isFinite(systolic?.valueQuantity?.value) && systolic?.valueQuantity?.code === 'mm[Hg]';
    const validDia = Number.isFinite(diastolic?.valueQuantity?.value) && diastolic?.valueQuantity?.code === 'mm[Hg]';
    if (!validSys || !validDia || rootValuePresent) result.push(issue('FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', observation, 'component/value[x]', 'Pelanggaran obs-7: panel tekanan darah harus menaruh sistolik dan diastolik pada component[] serta mengosongkan value[x] root.', 'Pindahkan nilai 8480-6 dan 8462-4 ke component.valueQuantity dengan UCUM mm[Hg], lalu hapus value[x] root.'));
  }
  return result;
}
function cmp1Issues(composition: Composition): ValidationIssue[] {
  return composition.section.flatMap((section, index) => section.entry?.length || section.text?.div || section.emptyReason?.coding?.length ? [] : [issue('FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', composition, `section[${index}]`, 'Pelanggaran cmp-1: section wajib memiliki entry, text, atau emptyReason.', 'Isi entry Reference, narrative XHTML, atau emptyReason yang menjelaskan data kosong.')]);
}
function evidenceIssues(dataset: NormalizedHospitalDataset): ValidationIssue[] {
  const resources = new Map(dataset.allResources.filter(resource => resource.id).map(resource => [`${resource.resourceType}/${resource.id}`, resource]));
  const encounterId = dataset.encounter.id;
  const result: ValidationIssue[] = [];
  const ensure = (reference: Reference | undefined, expected: string, path: string): void => {
    const key = referenceKey(reference);
    const target = key ? resources.get(key) : undefined;
    const targetEncounter = target && 'encounter' in target && target.encounter && typeof target.encounter === 'object' && 'reference' in target.encounter && typeof target.encounter.reference === 'string' ? target.encounter.reference : undefined;
    if (!target || target.resourceType !== expected || targetEncounter !== `Encounter/${encounterId}`) result.push(issue('FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN', dataset.claim, path, `Referensi bukti ${key ?? '(kosong)'} tidak valid untuk Encounter/${encounterId}.`, 'Pastikan referensi menunjuk resource klinis yang ada dan berada pada encounter yang sama.'));
  };
  dataset.claim.diagnosis.forEach((diagnosis, index) => ensure(diagnosis.diagnosisReference, 'Condition', `diagnosis[${index}].diagnosisReference`));
  (dataset.claim.procedure ?? []).forEach((procedure, index) => ensure(procedure.procedureReference, 'Procedure', `procedure[${index}].procedureReference`));
  (dataset.claim.supportingInfo ?? []).forEach((support, index) => { const reference = support.valueReference; const key = referenceKey(reference); const type = key?.split('/')[0]; if (!reference || !['Composition', 'Observation', 'ServiceRequest'].includes(type ?? '')) result.push(issue('FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN', dataset.claim, `supportingInfo[${index}].valueReference`, 'Supporting information klaim harus menunjuk Composition, Observation, atau ServiceRequest.', 'Tambahkan referensi bukti klinis yang valid.')); else ensure(reference, type ?? '', `supportingInfo[${index}].valueReference`); });
  return result;
}
function financialIssues(dataset: NormalizedHospitalDataset): ValidationIssue[] {
  const allCurrenciesValid =
    dataset.chargeItems.every(item => !item.priceOverride || (item.priceOverride.currency === 'IDR' && Number.isFinite(item.priceOverride.value))) &&
    dataset.claim.item.every(item => item.net?.currency === 'IDR' && Number.isFinite(item.net?.value));
  const chargeTotal = dataset.chargeItems.reduce((sum, item) => sum + (item.priceOverride?.value ?? 0), 0);
  const itemTotal = dataset.claim.item.reduce((sum, item) => sum + (item.net?.value ?? 0), 0);
  const claimTotal = dataset.claim.total?.value;
  const result: ValidationIssue[] = [];
  if (!allCurrenciesValid || dataset.claim.total?.currency !== 'IDR' || claimTotal === undefined || !Number.isFinite(claimTotal) || !Number.isFinite(chargeTotal) || !Number.isFinite(itemTotal) || Math.abs(chargeTotal - claimTotal) > 0.001 || Math.abs(itemTotal - claimTotal) > 0.001) {
    result.push(issue('FHIR_STD_05_FINANCIAL_RECONCILIATION', dataset.claim, 'total', `Rekonsiliasi gagal: ChargeItem=${chargeTotal}, Claim.item=${itemTotal}, Claim.total=${claimTotal ?? 'kosong'} IDR.`, 'Pastikan seluruh ChargeItem dan Claim.item.net dijumlahkan konsisten dengan Claim.total Money IDR.'));
  }
  return result;
}
function bundleIssues(bundle: Bundle): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  if (bundle.type !== 'transaction') return result;
  const rank: Record<string, number> = { DELETE: 0, POST: 1, PUT: 2, GET: 3 };
  let previous = -1;
  for (const [index, entry] of (bundle.entry ?? []).entries()) {
    const method = entry.request?.method;
    const current = method && Object.prototype.hasOwnProperty.call(rank, method) ? rank[method] : -1;
    if (!entry.fullUrl || !entry.request?.method || !entry.request.url || current === -1) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}]`, 'Entry transaction wajib memiliki fullUrl dan request.method/url yang valid (DELETE/POST/PUT/GET).', 'Lengkapi fullUrl (termasuk urn:uuid) dan request HTTP.'));
    if (current !== -1 && current < previous) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}].request.method`, 'Urutan request Bundle melanggar bdl-3.', 'Urutkan entry secara ketat DELETE, POST, PUT, lalu GET.'));
    if (current !== -1) previous = Math.max(previous, current);
  }
  return result;
}

export function validateFhirDataset(dataset: NormalizedHospitalDataset): ValidationReport {
  const checks: [ValidationRuleId, number, ValidationIssue[]][] = [
    ['FHIR_STD_01_MANDATORY_CARDINALITY', dataset.allResources.length, mandatoryIssues(dataset)],
    ['FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', dataset.observations.length, obs7Issues(dataset.observations)],
    ['FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', dataset.composition.section.length, cmp1Issues(dataset.composition)],
    ['FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN', dataset.claim.diagnosis.length + (dataset.claim.procedure?.length ?? 0) + (dataset.claim.supportingInfo?.length ?? 0), evidenceIssues(dataset)],
    ['FHIR_STD_05_FINANCIAL_RECONCILIATION', dataset.chargeItems.length + dataset.claim.item.length, financialIssues(dataset)],
    ['FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', dataset.transactionBundle.entry?.length ?? 0, bundleIssues(dataset.transactionBundle)]
  ];
  const rules: ValidationRuleResult[] = checks.map(([ruleId, checkedCount, issues]) => ({ ruleId, title: ruleTitles[ruleId], description: descriptions[ruleId], passed: issues.length === 0, checkedCount, issues }));
  const issues = rules.flatMap(rule => rule.issues);
  return { valid: issues.every(item => item.severity !== 'error'), timestamp: new Date().toISOString(), totalResourcesChecked: dataset.allResources.length, errorCount: issues.filter(item => item.severity === 'error').length, warningCount: issues.filter(item => item.severity === 'warning').length, rules, issues };
}
