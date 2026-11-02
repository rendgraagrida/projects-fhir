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
const referenceKey = (reference: Reference | undefined): string | undefined => {
  const value = reference?.reference;
  if (!value) return undefined;
  if (value.startsWith('#')) return value;
  const normalized = value.replace(/\/_history\/[^/]+$/, '');
  const match = normalized.match(/(?:^|\/)([A-Z][A-Za-z]+)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : normalized;
};
const idOf = (resource: FhirResource): string => resource.id ?? '(tanpa-id)';
const issue = (ruleId: ValidationRuleId, resource: FhirResource | { resourceType: string; id?: string }, path: string, message: string, remediation: string, source: ValidationIssue['source'] = 'HL7_R4'): ValidationIssue => ({ ruleId, severity: 'error', source, resourceType: resource.resourceType, resourceId: resource.id ?? '(tanpa-id)', path, message, remediation });
const validConcept = (value: { coding?: { code?: string }[]; text?: string } | undefined): boolean => Boolean(value?.coding?.some(item => Boolean(item.code)) || value?.text?.trim());
const hasSingleChoice = (value: Record<string, unknown>, names: string[]): boolean => names.filter(name => value[name] !== undefined && value[name] !== null).length === 1;

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
function additionalMandatoryIssues(dataset: NormalizedHospitalDataset): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  const identity = new Set<string>();
  for (const resource of dataset.allResources) {
    const key = `${resource.resourceType}/${resource.id}`;
    if (identity.has(key)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'id', `Identitas resource duplikat: ${key}.`, 'Gunakan satu resource untuk setiap pasangan resourceType/id.'));
    identity.add(key);
    if (resource.resourceType === 'Organization' && resource.address?.some(address => address.use === 'home')) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'address.use', 'Organization.address use=home melanggar org-2.', 'Gunakan use=work atau hilangkan use.'));
    if (resource.resourceType === 'Organization' && !resource.name && !resource.identifier?.some(identifier => identifier.value)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'name|identifier', 'Organization wajib memiliki name atau identifier (org-1).', 'Isi nama atau identifier yang bersumber.'));
    if (resource.resourceType === 'Consent' && !resource.policy?.some(policy => Boolean(policy.uri || policy.authority)) && !validConcept(resource.policyRule)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'policy|policyRule', 'Consent melanggar ppc-1.', 'Isi Consent.policy atau Consent.policyRule.'));
    if (resource.resourceType === 'MedicationRequest' && !hasSingleChoice(resource as unknown as Record<string, unknown>, ['medicationReference', 'medicationCodeableConcept'])) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'medication[x]', 'MedicationRequest harus memiliki tepat satu medication[x].', 'Pilih medicationReference atau medicationCodeableConcept, bukan keduanya.'));
    if (resource.resourceType === 'MedicationDispense' && !hasSingleChoice(resource as unknown as Record<string, unknown>, ['medicationReference', 'medicationCodeableConcept'])) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'medication[x]', 'MedicationDispense harus memiliki tepat satu medication[x].', 'Pilih medicationReference atau medicationCodeableConcept, bukan keduanya.'));
    if (resource.resourceType === 'Observation') {
      for (const [index, component] of (resource.component ?? []).entries()) {
        const choices = ['valueQuantity', 'valueCodeableConcept', 'valueString', 'valueBoolean', 'valueInteger'].filter(name => (component as unknown as Record<string, unknown>)[name] !== undefined);
        if (!validConcept(component.code) || choices.length !== 1) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, `component[${index}]`, 'Observation.component harus memiliki code dan satu value[x].', 'Lengkapi komponen sesuai choice R4.'));
      }
    }
    if (resource.resourceType === 'EpisodeOfCare' && (!resource.status || !resource.patient.reference)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/patient', 'EpisodeOfCare wajib memiliki status dan patient.', 'Lengkapi elemen minimum EpisodeOfCare.'));
    if (resource.resourceType === 'ServiceRequest' && (!resource.status || !resource.intent || !validConcept(resource.code) || !resource.subject.reference)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/intent/code/subject', 'ServiceRequest tidak memenuhi minimum R4.', 'Lengkapi status, intent, code, dan subject.'));
    if (resource.resourceType === 'Condition' && (!resource.subject.reference || !validConcept(resource.code) || !resource.clinicalStatus || !resource.verificationStatus || !resource.category.length)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'clinicalStatus/verificationStatus/category/code/subject', 'Condition tidak memenuhi minimum R4.', 'Lengkapi status klinis, verifikasi, category, code, dan subject.'));
    if (resource.resourceType === 'Procedure' && (!resource.status || !resource.subject.reference || !validConcept(resource.code))) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/code/subject', 'Procedure tidak memenuhi minimum R4.', 'Lengkapi status, code, dan subject.'));
    if (resource.resourceType === 'DiagnosticReport' && (!resource.status || !validConcept(resource.code) || !resource.subject.reference)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/code/subject', 'DiagnosticReport tidak memenuhi minimum R4.', 'Lengkapi status, code, dan subject.'));
    if (resource.resourceType === 'Appointment' && (!resource.status || !resource.participant.length || resource.participant.some(participant => !participant.status))) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/participant', 'Appointment wajib memiliki participant dan participant.status.', 'Lengkapi participant.'));
    if (resource.resourceType === 'Coverage' && (!resource.status || !resource.beneficiary.reference || !resource.payor.length)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/beneficiary/payor', 'Coverage tidak memenuhi minimum R4.', 'Lengkapi status, beneficiary, dan payor.'));
    if (resource.resourceType === 'Account' && !resource.status) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status', 'Account.status wajib ada.', 'Lengkapi status Account.'));
    if (resource.resourceType === 'ChargeItem' && (!resource.status || !validConcept(resource.code) || !resource.subject.reference)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/code/subject', 'ChargeItem tidak memenuhi minimum R4.', 'Lengkapi status, code, dan subject.'));
    if (resource.resourceType === 'MeasureReport' && (!resource.status || !resource.type || !resource.measure || !resource.period.start || !resource.period.end)) result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'status/type/measure/period', 'MeasureReport tidak memenuhi minimum R4.', 'Lengkapi status, type, measure, dan period.'));
    if (resource.resourceType === 'CoverageEligibilityResponse') {
      const contained = resource.contained?.find(item => item.resourceType === 'CoverageEligibilityRequest' && item.id === 'eligibility-request');
      if (!contained || resource.request.reference !== '#eligibility-request') result.push(issue('FHIR_STD_01_MANDATORY_CARDINALITY', resource, 'request', 'CoverageEligibilityResponse.request harus menunjuk contained CER #eligibility-request.', 'Simpan CER hanya pada owner response.'));
    }
  }
  return result;
}


function obs7Issues(observations: Observation[]): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  for (const observation of observations) {
    const rootCodes = new Set(observation.code.coding?.map(item => `${item.system ?? ''}|${item.code ?? ''}`));
    if ((observation.component ?? []).some(component => component.code.coding?.some(item => rootCodes.has(`${item.system ?? ''}|${item.code ?? ''}`)))) result.push(issue('FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', observation, 'component.code', 'Pelanggaran obs-7: code root tidak boleh sama dengan code component.', 'Gunakan code panel yang berbeda dari code komponennya.'));
    const valueChoices = ['valueQuantity', 'valueCodeableConcept', 'valueString', 'valueBoolean', 'valueInteger'].filter(name => (observation as unknown as Record<string, unknown>)[name] !== undefined);
    if (valueChoices.length > 1) result.push(issue('FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', observation, 'value[x]', 'Observation hanya boleh memiliki satu alternatif value[x].', 'Pertahankan satu choice value[x] atau dataAbsentReason.'));
    const code = observation.code.coding?.find(item => item.system === 'http://loinc.org')?.code;
    if (code !== '85354-9') continue;
    const systolic = observation.component?.find(item => item.code.coding?.some(coding => coding.code === '8480-6'));
    const diastolic = observation.component?.find(item => item.code.coding?.some(coding => coding.code === '8462-4'));
    const rootValuePresent = valueChoices.length > 0;
    const validSys = Number.isFinite(systolic?.valueQuantity?.value) && systolic?.valueQuantity?.system === 'http://unitsofmeasure.org' && systolic?.valueQuantity?.code === 'mm[Hg]';
    const validDia = Number.isFinite(diastolic?.valueQuantity?.value) && diastolic?.valueQuantity?.system === 'http://unitsofmeasure.org' && diastolic?.valueQuantity?.code === 'mm[Hg]';
    if (!validSys || !validDia || rootValuePresent) result.push(issue('FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', observation, 'component/value[x]', 'Pelanggaran obs-7: panel tekanan darah harus menaruh sistolik dan diastolik pada component[] serta mengosongkan value[x] root.', 'Pindahkan nilai 8480-6 dan 8462-4 ke component.valueQuantity dengan UCUM mm[Hg], lalu hapus value[x] root.'));
  }
  return result;
}
function cmp1Issues(composition: Composition): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  const visit = (sections: Composition['section'], prefix: string): void => {
    for (const [index, section] of sections.entries()) {
      const path = `${prefix}[${index}]`;
      if (!section.text?.div && !section.entry?.length && !section.section?.length) result.push(issue('FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', composition, path, 'Pelanggaran cmp-1: section wajib memiliki text, entry, atau nested section.', 'Isi entry Reference, narrative XHTML, atau nested section.'));
      if (section.entry?.length && section.emptyReason) result.push(issue('FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', composition, `${path}.emptyReason`, 'Pelanggaran cmp-2: section tidak boleh memiliki entry dan emptyReason sekaligus.', 'Hapus emptyReason atau kosongkan entry.'));
      if (section.text && !section.text.div.includes('xmlns=')) result.push(issue('FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', composition, `${path}.text.div`, 'Narrative Composition harus berupa XHTML.', 'Gunakan narrative div dengan namespace XHTML.'));
      visit(section.section ?? [], `${path}.section`);
    }
  };
  visit(composition.section, 'section');
  return result;
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
  dataset.encounter.diagnosis?.forEach((diagnosis, index) => ensure(diagnosis.condition, 'Condition', `encounter.diagnosis[${index}].condition`));
  const containedRequest = dataset.coverageEligibilityResponse.contained?.find(item => item.resourceType === 'CoverageEligibilityRequest' && item.id === 'eligibility-request');
  if (!containedRequest || dataset.coverageEligibilityResponse.request.reference !== '#eligibility-request') result.push(issue('FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN', dataset.coverageEligibilityResponse, 'request', 'Eligibility request tidak resolve dalam owner scope response.', 'Gunakan fragment reference #eligibility-request pada contained CER.'));
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
  const negativeAmount = dataset.chargeItems.some(item => item.priceOverride?.value !== undefined && item.priceOverride.value < 0) || dataset.claim.item.some(item => item.net.value !== undefined && item.net.value < 0);
  const responseCategories = dataset.claimResponse.total.map(total => total.category.coding?.[0]?.code).filter(Boolean);
  if (negativeAmount || new Set(responseCategories).size !== responseCategories.length) result.push(issue('FHIR_STD_05_FINANCIAL_RECONCILIATION', dataset.claimResponse, 'total', 'Nilai finansial tidak boleh negatif atau menggandakan kategori adjudication.', 'Gunakan decimal finite non-negatif dan satu kategori per total.', 'LAB_POLICY'));
  if (!allCurrenciesValid || dataset.claim.total?.currency !== 'IDR' || claimTotal === undefined || !Number.isFinite(claimTotal) || !Number.isFinite(chargeTotal) || !Number.isFinite(itemTotal) || Math.abs(chargeTotal - claimTotal) > 0.001 || Math.abs(itemTotal - claimTotal) > 0.001) {
    result.push(issue('FHIR_STD_05_FINANCIAL_RECONCILIATION', dataset.claim, 'total', `Rekonsiliasi gagal: ChargeItem=${chargeTotal}, Claim.item=${itemTotal}, Claim.total=${claimTotal ?? 'kosong'} IDR.`, 'Pastikan seluruh ChargeItem dan Claim.item.net dijumlahkan konsisten dengan Claim.total Money IDR.', 'LAB_POLICY'));
  }
  return result;
}
function bundleIssues(bundle: Bundle): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  if (bundle.type !== 'transaction') return result;
  const rank: Record<string, number> = { DELETE: 0, POST: 1, PUT: 2, PATCH: 2, GET: 3, HEAD: 3 };
  let previous = -1;
  for (const [index, entry] of (bundle.entry ?? []).entries()) {
    const method = entry.request?.method;
    const current = method && Object.prototype.hasOwnProperty.call(rank, method) ? rank[method] : -1;
    if (!entry.resource || !entry.fullUrl || !entry.request?.method || !entry.request.url || current === -1) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}]`, 'Entry transaction wajib memiliki resource, fullUrl, dan request.method/url yang valid.', 'Lengkapi fullUrl, body resource, dan request HTTP.'));
    if (method === 'POST' && entry.resource && entry.request?.url !== entry.resource.resourceType) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}].request.url`, 'POST transaction harus memakai URL type-level.', 'Gunakan ResourceType tanpa id pada request.url.'));
    if (method === 'PUT' && entry.resource?.id && entry.request?.url !== `${entry.resource.resourceType}/${entry.resource.id}`) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}].request.url`, 'PUT transaction harus memuat ResourceType/id.', 'Samakan request.url dengan resourceType/id.'));
    if (current !== -1 && current < previous) result.push(issue('FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', bundle, `entry[${index}].request.method`, 'Urutan request Bundle melanggar bdl-3.', 'Urutkan entry secara non-menurun DELETE, POST, PUT/PATCH, lalu GET/HEAD.'));
    if (current !== -1) previous = Math.max(previous, current);
  }
  return result;
}

export function validateFhirDataset(dataset: NormalizedHospitalDataset, options: { profile?: 'lab-r4'; nationalProfile?: string } = {}): ValidationReport {
  const checks: [ValidationRuleId, number, ValidationIssue[]][] = [
    ['FHIR_STD_01_MANDATORY_CARDINALITY', dataset.allResources.length + (dataset.contained?.length ?? 0), mandatoryIssues(dataset).concat(additionalMandatoryIssues(dataset))],
    ['FHIR_STD_02_OBSERVATION_INVARIANT_OBS7', dataset.observations.length, obs7Issues(dataset.observations)],
    ['FHIR_STD_03_COMPOSITION_INVARIANT_CMP1', dataset.composition.section.length, cmp1Issues(dataset.composition)],
    ['FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN', dataset.claim.diagnosis.length + (dataset.claim.procedure?.length ?? 0) + (dataset.claim.supportingInfo?.length ?? 0) + 1, evidenceIssues(dataset)],
    ['FHIR_STD_05_FINANCIAL_RECONCILIATION', dataset.chargeItems.length + dataset.claim.item.length, financialIssues(dataset)],
    ['FHIR_STD_06_BUNDLE_TRANSACTION_BDL3', dataset.transactionBundle.entry?.length ?? 0, bundleIssues(dataset.transactionBundle)],
  ];
  const rules: ValidationRuleResult[] = checks.map(([ruleId, checkedCount, issues]) => ({ ruleId, title: ruleTitles[ruleId], description: descriptions[ruleId], passed: issues.length === 0, checkedCount, issues }));
  const issues = rules.flatMap(rule => rule.issues);
  const errors = issues.filter(item => item.severity === 'error');
  return {
    valid: errors.length === 0,
    timestamp: new Date().toISOString(),
    totalResourcesChecked: dataset.allResources.length + (dataset.contained?.length ?? 0),
    errorCount: errors.length,
    warningCount: issues.filter(item => item.severity === 'warning').length,
    rules,
    issues,
    coreR4: { state: rules.slice(0, 4).every(rule => rule.passed) ? 'pass' : 'fail', reason: 'R4 shape and invariants are assessed by the local rule groups.', version: '4.0.1' },
    labProfile: { state: errors.length === 0 ? 'pass' : 'fail', reason: options.profile === 'lab-r4' || !options.profile ? 'lab-r4 execution profile assessed.' : 'Local groups assessed without a selected profile.', profile: 'lab-r4' },
    national: options.nationalProfile ? { state: 'not-assessed', reason: 'National evidence is not loaded.', profile: options.nationalProfile } : { state: 'not-assessed', reason: 'No named national profile/version/environment evidence was supplied.' },
  };
}
