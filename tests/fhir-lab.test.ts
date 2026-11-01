import { describe, it, expect, beforeAll } from 'bun:test';
import {
  SIMRS_HOSPITAL_SEEDS,
  STANDARD_TERMINOLOGY_DICTIONARY,
  SAMPLE_ANALYTICAL_SQL_QUERIES,
  FHIR_ATTRIBUTE_ANNOTATIONS,
} from '../src/data/simrs-normalization-seeds';
import {
  normalizeSimrsToFhir,
  sortBundleEntriesForTransaction,
  resolveTransactionBundleUrns,
} from '../src/lib/fhir-normalizer';
import { validateFhirDataset } from '../src/lib/fhir-validator';
import {
  evaluateFhirPath,
  evaluateViewDefinition,
  flattenDatasetWithSqlOnFhir,
  SQL_ON_FHIR_VIEW_DEFINITIONS,
} from '../src/lib/sql-on-fhir-flattener';
import {
  initPgliteDatabase,
  syncDatasetsToPglite,
  executeSqlQuery,
  resolveAndMergeDuplicatePatient,
  TABLE_METADATA,
  FHIR_DDL_SQL,
} from '../src/lib/pglite-db';
import {
  CURRICULUM_MODULES,
  FIVE_NORMALIZATION_LAWS,
  ADVANCED_NORMALIZATION_LAWS,
  ALL_NORMALIZATION_LAWS,
  FHIR_ALL_MODULES_CATALOG,
  SQL_TO_FHIR_CHEAT_SHEET,
} from '../src/data/curriculum-modules';
import {
  useFhirStore,
  getResourceFromDataset,
  getPatientLinkTarget,
} from '../src/store/use-fhir-store';
import type {
  Bundle,
  BundleEntry,
  Claim,
  Composition,
  Encounter,
  NormalizedHospitalDataset,
  Observation,
  Patient,
  ValidationReport,
} from '../src/types/fhir-global';
import { PGlite } from '@electric-sql/pglite';

describe('Global HL7 FHIR & SQL-on-FHIR v2 Learning Lab Test Suite', () => {
  // =========================================================================
  // 1. Multi-hospital SIMRS Normalization
  // =========================================================================
  describe('1. Multi-Hospital SIMRS Normalization Across All 3 Hospital Seeds', () => {
    it('should contain exactly 3 distinct hospital seeds with required metadata', () => {
      expect(SIMRS_HOSPITAL_SEEDS).toHaveLength(3);
      const hospitalIds = SIMRS_HOSPITAL_SEEDS.map((s) => s.id);
      expect(hospitalIds).toEqual([
        'rsud-soetomo-surabaya',
        'rs-harapan-bangsa-jakarta',
        'rsia-bunda-bandung',
      ]);
    });

    it('should correctly normalize RSUD Dr. Soetomo Surabaya (East Java, Inpatient Pneumonia + Mechanical Ventilation)', () => {
      const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsud-soetomo-surabaya')!;
      expect(seed).toBeDefined();
      const dataset = normalizeSimrsToFhir(seed);

      expect(dataset.hospitalId).toBe('rsud-soetomo-surabaya');
      expect(dataset.hospitalName).toBe('RSUD Dr. Soetomo Nusantara');
      expect(dataset.patient.id).toBe('patient-rsud-soetomo-surabaya');
      expect(dataset.patient.name[0].text).toBe('Budi Santoso');
      expect(dataset.patient.gender).toBe('male');
      expect(dataset.patient.birthDate).toBe('1980-01-01');

      // Kemendagri Administrative Extension
      const address = dataset.patient.address?.[0];
      expect(address?.city).toBe('Surabaya');
      expect(address?.state).toBe('35');
      const adminExt = address?.extension?.find(
        (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode'
      );
      expect(adminExt).toBeDefined();
      expect(adminExt?.extension?.find((e) => e.url === 'province')?.valueCode).toBe('35');
      expect(adminExt?.extension?.find((e) => e.url === 'city')?.valueCode).toBe('3578');

      // Encounter & Diagnoses
      expect(dataset.encounter.class.code).toBe('IMP');
      expect(dataset.encounter.status).toBe('finished');
      expect(dataset.conditions).toHaveLength(2);
      expect(dataset.conditions[0].code.coding?.[0]?.code).toBe('J18.9');
      expect(dataset.conditions[0].code.coding?.[0]?.system).toBe('http://hl7.org/fhir/sid/icd-10');
      expect(dataset.conditions[1].code.coding?.[0]?.code).toBe('E11.9');

      // Procedure (Mechanical Ventilation ICD-9-CM)
      expect(dataset.procedures).toHaveLength(1);
      expect(dataset.procedures[0].code.coding?.[0]?.code).toBe('96.71');
      expect(dataset.procedures[0].code.coding?.[0]?.system).toBe('http://hl7.org/fhir/sid/icd-9-cm');

      // Medication (Paracetamol KFA)
      expect(dataset.medication.code.coding?.[0]?.code).toBe('93000001');
      expect(dataset.medication.code.coding?.[0]?.system).toBe('http://sys-ids.kemkes.go.id/kfa');

      // Financial calculations: room (3 * 750,000 = 2,250,000) + proc (2,500,000) + med (125,000) = 4,875,000
      expect(dataset.claim.total?.value).toBe(4875000);
      expect(dataset.claim.total?.currency).toBe('IDR');
      expect(dataset.claim.item).toHaveLength(3);

      // No emergency duplicate patient for Surabaya
      expect(dataset.duplicateEmergencyPatient).toBeUndefined();
    });

    it('should correctly normalize RS Premier Harapan Bangsa (DKI Jakarta, Acute STEMI + Stent)', () => {
      const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rs-harapan-bangsa-jakarta')!;
      expect(seed).toBeDefined();
      const dataset = normalizeSimrsToFhir(seed);

      expect(dataset.hospitalId).toBe('rs-harapan-bangsa-jakarta');
      expect(dataset.hospitalName).toBe('RS Premier Harapan Bangsa');
      expect(dataset.patient.id).toBe('patient-rs-harapan-bangsa-jakarta');
      expect(dataset.patient.name[0].text).toBe('Siti Rahmawati');
      expect(dataset.patient.gender).toBe('female');
      expect(dataset.patient.birthDate).toBe('1985-02-02');

      // Kemendagri Administrative Extension for DKI Jakarta (31)
      const address = dataset.patient.address?.[0];
      expect(address?.state).toBe('31');
      const adminExt = address?.extension?.find(
        (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode'
      );
      expect(adminExt?.extension?.find((e) => e.url === 'province')?.valueCode).toBe('31');
      expect(adminExt?.extension?.find((e) => e.url === 'city')?.valueCode).toBe('3171');

      // Encounter & Diagnoses (STEMI + Hypertension)
      expect(dataset.encounter.class.code).toBe('IMP');
      expect(dataset.conditions[0].code.coding?.[0]?.code).toBe('I21.0');
      expect(dataset.conditions[1].code.coding?.[0]?.code).toBe('I10');

      // Procedure (Coronary Stent ICD-9-CM 36.06)
      expect(dataset.procedures[0].code.coding?.[0]?.code).toBe('36.06');

      // Medication (Aspirin KFA 93000003)
      expect(dataset.medication.code.coding?.[0]?.code).toBe('93000003');

      // Financial calculations: room (2 * 750,000 = 1,500,000) + proc (18,000,000) + med (450,000) = 19,950,000
      expect(dataset.claim.total?.value).toBe(19950000);
      expect(dataset.claim.total?.currency).toBe('IDR');
    });

    it('should correctly normalize RSIA Bunda Sejahtera (West Java, Pre-eclampsia + C-Section + Emergency Duplicate Patient)', () => {
      const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsia-bunda-bandung')!;
      expect(seed).toBeDefined();
      const dataset = normalizeSimrsToFhir(seed);

      expect(dataset.hospitalId).toBe('rsia-bunda-bandung');
      expect(dataset.hospitalName).toBe('RSIA Bunda Sejahtera');
      expect(dataset.patient.id).toBe('patient-rsia-bunda-bandung');
      expect(dataset.patient.name[0].text).toBe('Dewi Lestari');
      expect(dataset.patient.gender).toBe('female');

      // Emergency Encounter
      expect(dataset.encounter.class.code).toBe('EMER');

      // Diagnoses: Pre-eclampsia (O14.1) & Single live birth (Z38.01)
      expect(dataset.conditions[0].code.coding?.[0]?.code).toBe('O14.1');
      expect(dataset.conditions[1].code.coding?.[0]?.code).toBe('Z38.01');

      // Procedure: C-Section (74.1)
      expect(dataset.procedures[0].code.coding?.[0]?.code).toBe('74.1');

      // Financial: room (1 * 1,000,000) + proc (8,500,000) + med (225,000) = 9,725,000
      expect(dataset.claim.total?.value).toBe(9725000);

      // Duplicate Emergency Patient is present by default
      expect(dataset.duplicateEmergencyPatient).toBeDefined();
      expect(dataset.duplicateEmergencyPatient?.id).toBe('pat-temp-igd-003');
      expect(dataset.duplicateEmergencyPatient?.name[0].text).toBe('Dewi L.');
      expect(dataset.duplicateEmergencyPatient?.link?.[0].type).toBe('replaced-by');
      expect(dataset.duplicateEmergencyPatient?.link?.[0].other.reference).toBe(
        'Patient/patient-rsia-bunda-bandung'
      );
    });

    it('should respect mergedDuplicatePatient toggle for RSIA Bunda Sejahtera', () => {
      const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsia-bunda-bandung')!;
      const datasetWithoutDuplicate = normalizeSimrsToFhir(seed, { mergedDuplicatePatient: false });
      expect(datasetWithoutDuplicate.duplicateEmergencyPatient).toBeUndefined();

      const datasetWithDuplicate = normalizeSimrsToFhir(seed, { mergedDuplicatePatient: true });
      expect(datasetWithDuplicate.duplicateEmergencyPatient).toBeDefined();
      expect(datasetWithDuplicate.duplicateEmergencyPatient?.id).toBe('pat-temp-igd-003');
    });

    it('should populate all expected FHIR resources across all hospital datasets', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        expect(ds.organization.resourceType).toBe('Organization');
        expect(ds.payorOrganization.resourceType).toBe('Organization');
        expect(ds.patient.resourceType).toBe('Patient');
        expect(ds.practitioner.resourceType).toBe('Practitioner');
        expect(ds.location.resourceType).toBe('Location');
        expect(ds.episodeOfCare.resourceType).toBe('EpisodeOfCare');
        expect(ds.serviceRequest.resourceType).toBe('ServiceRequest');
        expect(ds.encounter.resourceType).toBe('Encounter');
        expect(ds.consent.resourceType).toBe('Consent');
        expect(ds.provenance.resourceType).toBe('Provenance');
        expect(ds.conditions.length).toBeGreaterThanOrEqual(2);
        expect(ds.procedures.length).toBeGreaterThanOrEqual(1);
        expect(ds.observations.length).toBeGreaterThanOrEqual(3);
        expect(ds.diagnosticReport.resourceType).toBe('DiagnosticReport');
        expect(ds.medication.resourceType).toBe('Medication');
        expect(ds.medicationRequest.resourceType).toBe('MedicationRequest');
        expect(ds.medicationDispense.resourceType).toBe('MedicationDispense');
        expect(ds.composition.resourceType).toBe('Composition');
        expect(ds.appointment.resourceType).toBe('Appointment');
        expect(ds.coverage.resourceType).toBe('Coverage');
        expect(ds.coverageEligibilityResponse.resourceType).toBe('CoverageEligibilityResponse');
        expect(ds.account.resourceType).toBe('Account');
        expect(ds.chargeItems.length).toBe(3);
        expect(ds.claim.resourceType).toBe('Claim');
        expect(ds.claimResponse.resourceType).toBe('ClaimResponse');
        expect(ds.explanationOfBenefit.resourceType).toBe('ExplanationOfBenefit');
        expect(ds.measureReport.resourceType).toBe('MeasureReport');
        expect(ds.transactionBundle.resourceType).toBe('Bundle');
        expect(ds.allResources.length).toBeGreaterThanOrEqual(26);
      }
    });
  });

  // =========================================================================
  // 2. Zero-Bug Conformance Rules
  // =========================================================================
  describe('2. Zero-Bug Conformance Rules', () => {
    it('Conformance Rule 1: Claim.total is 0..1 Money { value, currency: IDR }, while ClaimResponse.total[] and EOB.total[] are BackboneElement[]', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);

        // Claim.total is a single Money object, NOT an array
        expect(Array.isArray(ds.claim.total)).toBe(false);
        expect(typeof ds.claim.total?.value).toBe('number');
        expect(ds.claim.total?.currency).toBe('IDR');

        // ClaimResponse.total is BackboneElement[] with submitted & benefit
        expect(Array.isArray(ds.claimResponse.total)).toBe(true);
        expect(ds.claimResponse.total).toHaveLength(2);
        const submittedCr = ds.claimResponse.total.find(
          (t) => t.category.coding?.[0]?.code === 'submitted'
        );
        const benefitCr = ds.claimResponse.total.find(
          (t) => t.category.coding?.[0]?.code === 'benefit'
        );
        expect(submittedCr).toBeDefined();
        expect(benefitCr).toBeDefined();
        expect(submittedCr?.amount.currency).toBe('IDR');
        expect(benefitCr?.amount.currency).toBe('IDR');

        // ExplanationOfBenefit.total is BackboneElement[] with submitted & benefit
        expect(Array.isArray(ds.explanationOfBenefit.total)).toBe(true);
        expect(ds.explanationOfBenefit.total).toHaveLength(2);
        const submittedEob = ds.explanationOfBenefit.total.find(
          (t) => t.category.coding?.[0]?.code === 'submitted'
        );
        const benefitEob = ds.explanationOfBenefit.total.find(
          (t) => t.category.coding?.[0]?.code === 'benefit'
        );
        expect(submittedEob).toBeDefined();
        expect(benefitEob).toBeDefined();
        expect(submittedEob?.amount.currency).toBe('IDR');
        expect(benefitEob?.amount.currency).toBe('IDR');
      }
    });

    it('Conformance Rule 2: Observation BP (85354-9) uses component[] (8480-6 & 8462-4 in mm[Hg]) and omits root valueQuantity (obs-7)', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const bpObservation = ds.observations.find((o) =>
          o.code.coding?.some((c) => c.system === 'http://loinc.org' && c.code === '85354-9')
        )!;
        expect(bpObservation).toBeDefined();

        // Invariant obs-7: root value[x] must be strictly undefined
        expect(bpObservation.valueQuantity).toBeUndefined();
        expect(bpObservation.valueCodeableConcept).toBeUndefined();
        expect(bpObservation.valueString).toBeUndefined();
        expect(bpObservation.valueBoolean).toBeUndefined();
        expect(bpObservation.valueInteger).toBeUndefined();

        // Must have component array with systolic and diastolic
        expect(bpObservation.component).toBeDefined();
        expect(bpObservation.component?.length).toBe(2);

        const systolic = bpObservation.component?.find((c) =>
          c.code.coding?.some((cod) => cod.code === '8480-6')
        );
        const diastolic = bpObservation.component?.find((c) =>
          c.code.coding?.some((cod) => cod.code === '8462-4')
        );

        expect(systolic).toBeDefined();
        expect(diastolic).toBeDefined();
        expect(systolic?.valueQuantity?.code).toBe('mm[Hg]');
        expect(systolic?.valueQuantity?.system).toBe('http://unitsofmeasure.org');
        expect(diastolic?.valueQuantity?.code).toBe('mm[Hg]');
        expect(diastolic?.valueQuantity?.system).toBe('http://unitsofmeasure.org');
        expect(systolic?.valueQuantity?.value).toBeGreaterThan(0);
        expect(diastolic?.valueQuantity?.value).toBeGreaterThan(0);
      }
    });

    it('Conformance Rule 3: Composition.section[] has 5 valid sections with entry, text, or emptyReason (cmp-1)', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const comp = ds.composition;

        expect(comp.resourceType).toBe('Composition');
        expect(comp.status).toBe('final');
        expect(comp.type.coding?.[0]?.code).toBe('18842-5'); // Discharge summary
        expect(comp.section).toHaveLength(5);

        const expectedSectionCodes = ['11535-2', '29554-3', '61150-9', '19009-0', '8653-8'];
        const sectionCodes = comp.section.map((s) => s.code?.coding?.[0]?.code);
        expect(sectionCodes).toEqual(expectedSectionCodes);

        // Invariant cmp-1: Each section must have entry, narrative text, or emptyReason
        for (const [index, section] of comp.section.entries()) {
          const hasEntry = Boolean(section.entry && section.entry.length > 0);
          const hasText = Boolean(section.text?.div);
          const hasEmptyReason = Boolean(section.emptyReason?.coding?.length);
          expect(hasEntry || hasText || hasEmptyReason).toBe(true);
        }
      }
    });

    it('Conformance Rule 4: Bundle (transaction) orders entries DELETE -> POST -> PUT -> GET (bdl-3) and resolves urn:uuid: references', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const bundle = ds.transactionBundle;

        expect(bundle.resourceType).toBe('Bundle');
        expect(bundle.type).toBe('transaction');
        expect(bundle.entry).toBeDefined();
        expect(bundle.entry!.length).toBeGreaterThan(0);

        // Every entry has fullUrl and request method/url
        const rank: Record<string, number> = { DELETE: 0, POST: 1, PUT: 2, GET: 3 };
        let prevRank = -1;
        for (const entry of bundle.entry!) {
          expect(entry.fullUrl).toBeDefined();
          expect(entry.fullUrl?.startsWith('urn:uuid:')).toBe(true);
          expect(entry.request).toBeDefined();
          expect(entry.request?.method).toBeDefined();
          expect(entry.request?.url).toBeDefined();

          const method = entry.request!.method;
          const currentRank = rank[method] ?? 3;
          expect(currentRank).toBeGreaterThanOrEqual(prevRank);
          prevRank = currentRank;
        }

        // Check sortBundleEntriesForTransaction unit behavior
        const unorderedEntries: BundleEntry[] = [
          { request: { method: 'GET', url: 'Patient/1' } },
          { request: { method: 'PUT', url: 'Observation/2' } },
          { request: { method: 'POST', url: 'Condition' } },
          { request: { method: 'DELETE', url: 'Encounter/3' } },
        ];
        const sorted = sortBundleEntriesForTransaction(unorderedEntries);
        expect(sorted.map((e) => e.request?.method)).toEqual(['DELETE', 'POST', 'PUT', 'GET']);

        // Check resolveTransactionBundleUrns unit behavior
        const mockBundle: Bundle = {
          resourceType: 'Bundle',
          id: 'test-bundle',
          type: 'transaction',
          entry: [
            {
              fullUrl: 'urn:uuid:test-pat-uuid',
              resource: { resourceType: 'Patient', id: 'pat-real-123' } as Patient,
            },
            {
              fullUrl: 'urn:uuid:test-enc-uuid',
              resource: {
                resourceType: 'Encounter',
                id: 'enc-real-456',
                subject: { reference: 'urn:uuid:test-pat-uuid' },
              } as Encounter,
            },
          ],
        };
        const resolved = resolveTransactionBundleUrns(mockBundle);
        const resolvedEnc = resolved.entry?.[1].resource as Encounter;
        expect(resolvedEnc.subject.reference).toBe('Patient/pat-real-123');
      }
    });
  });

  // =========================================================================
  // 3. All 6 HL7 FHIR Validator Rules
  // =========================================================================
  describe('3. All 6 HL7 FHIR Validator Rules', () => {
    it('should validate baseline datasets with 100% pass rate (valid: true, errorCount: 0)', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const dataset = normalizeSimrsToFhir(seed);
        const report = validateFhirDataset(dataset);

        expect(report.valid).toBe(true);
        expect(report.errorCount).toBe(0);
        expect(report.warningCount).toBe(0);
        expect(report.rules).toHaveLength(6);
        expect(report.rules.every((r) => r.passed)).toBe(true);
      }
    });

    it('Rule 1: FHIR_STD_01_MANDATORY_CARDINALITY fails when mandatory fields are missing', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);

      // Tamper with Encounter.status
      const tamperedDataset: NormalizedHospitalDataset = {
        ...dataset,
        encounter: { ...dataset.encounter, status: '' as unknown as Encounter['status'] },
      };
      const report = validateFhirDataset(tamperedDataset);
      const rule1 = report.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
      expect(rule1.passed).toBe(false);
      expect(rule1.issues.some((i) => i.path === 'status')).toBe(true);

      // Tamper with Coverage.payor
      const tamperedCoverage: NormalizedHospitalDataset = {
        ...dataset,
        coverage: { ...dataset.coverage, payor: [] },
      };
      const report2 = validateFhirDataset(tamperedCoverage);
      const rule1Coverage = report2.rules.find(
        (r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY'
      )!;
      expect(rule1Coverage.passed).toBe(false);
      expect(rule1Coverage.issues.some((i) => i.path === 'payor')).toBe(true);

      // Tamper with Claim mandatory field (use)
      const tamperedClaim: NormalizedHospitalDataset = {
        ...dataset,
        claim: { ...dataset.claim, use: '' as unknown as Claim['use'] },
      };
      const report3 = validateFhirDataset(tamperedClaim);
      const rule1Claim = report3.rules.find(
        (r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY'
      )!;
      expect(rule1Claim.passed).toBe(false);
      expect(rule1Claim.issues.some((i) => i.path === 'use')).toBe(true);
    });

    it('Rule 2: FHIR_STD_02_OBSERVATION_INVARIANT_OBS7 fails when injectObs7Violation is toggled', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed, { injectObs7Violation: true });
      const report = validateFhirDataset(dataset);

      expect(report.valid).toBe(false);
      expect(report.errorCount).toBeGreaterThan(0);
      const obs7Rule = report.rules.find(
        (r) => r.ruleId === 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7'
      )!;
      expect(obs7Rule.passed).toBe(false);
      expect(obs7Rule.issues).toHaveLength(1);
      expect(obs7Rule.issues[0].message).toContain('Pelanggaran obs-7');
      expect(obs7Rule.issues[0].remediation).toContain('Pindahkan nilai 8480-6 dan 8462-4');

      // The other 5 rules should remain passing
      const otherRules = report.rules.filter(
        (r) => r.ruleId !== 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7'
      );
      expect(otherRules.every((r) => r.passed)).toBe(true);
    });

    it('Rule 3: FHIR_STD_03_COMPOSITION_INVARIANT_CMP1 fails when injectCmp1Violation is toggled', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed, { injectCmp1Violation: true });
      const report = validateFhirDataset(dataset);

      expect(report.valid).toBe(false);
      expect(report.errorCount).toBeGreaterThan(0);
      const cmp1Rule = report.rules.find(
        (r) => r.ruleId === 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1'
      )!;
      expect(cmp1Rule.passed).toBe(false);
      expect(cmp1Rule.issues.length).toBe(5); // all 5 sections fail cmp-1
      expect(cmp1Rule.issues[0].message).toContain('Pelanggaran cmp-1');
      expect(cmp1Rule.issues[0].remediation).toContain('Isi entry Reference');

      // The other 5 rules should remain passing
      const otherRules = report.rules.filter(
        (r) => r.ruleId !== 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1'
      );
      expect(otherRules.every((r) => r.passed)).toBe(true);
    });

    it('Rule 4: FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN fails when injectBrokenEvidenceChain is toggled', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed, { injectBrokenEvidenceChain: true });
      const report = validateFhirDataset(dataset);

      expect(report.valid).toBe(false);
      expect(report.errorCount).toBeGreaterThan(0);
      const evidenceRule = report.rules.find(
        (r) => r.ruleId === 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN'
      )!;
      expect(evidenceRule.passed).toBe(false);
      expect(evidenceRule.issues[0].message).toContain('Condition/condition-missing');
      expect(evidenceRule.issues[0].remediation).toContain('Pastikan referensi menunjuk resource');

      // The other 5 rules should remain passing
      const otherRules = report.rules.filter(
        (r) => r.ruleId !== 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN'
      );
      expect(otherRules.every((r) => r.passed)).toBe(true);
    });

    it('Rule 5: FHIR_STD_05_FINANCIAL_RECONCILIATION fails when injectFinancialMismatch is toggled', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed, { injectFinancialMismatch: true });
      const report = validateFhirDataset(dataset);

      expect(report.valid).toBe(false);
      expect(report.errorCount).toBeGreaterThan(0);
      const financialRule = report.rules.find(
        (r) => r.ruleId === 'FHIR_STD_05_FINANCIAL_RECONCILIATION'
      )!;
      expect(financialRule.passed).toBe(false);
      expect(financialRule.issues[0].message).toContain('Rekonsiliasi gagal');
      expect(financialRule.issues[0].remediation).toContain('Pastikan seluruh ChargeItem');

      // The other 5 rules should remain passing
      const otherRules = report.rules.filter(
        (r) => r.ruleId !== 'FHIR_STD_05_FINANCIAL_RECONCILIATION'
      );
      expect(otherRules.every((r) => r.passed)).toBe(true);
    });

    it('Rule 6: FHIR_STD_06_BUNDLE_TRANSACTION_BDL3 fails when injectBundleOrderViolation is toggled', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed, { injectBundleOrderViolation: true });
      const report = validateFhirDataset(dataset);

      expect(report.valid).toBe(false);
      expect(report.errorCount).toBeGreaterThan(0);
      const bundleRule = report.rules.find(
        (r) => r.ruleId === 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3'
      )!;
      expect(bundleRule.passed).toBe(false);
      expect(bundleRule.issues.some((i) => i.message.includes('bdl-3'))).toBe(true);

      // The other 5 rules should remain passing
      const otherRules = report.rules.filter(
        (r) => r.ruleId !== 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3'
      );
      expect(otherRules.every((r) => r.passed)).toBe(true);
    });
  });

  // =========================================================================
  // 4. Native SQL-on-FHIR v2 Evaluator
  // =========================================================================
  describe('4. Native SQL-on-FHIR v2 Evaluator', () => {
    it('evaluateFhirPath should evaluate getResourceKey()', () => {
      const resource = { resourceType: 'Patient', id: 'pat-999' };
      expect(evaluateFhirPath(resource, 'getResourceKey()')).toEqual(['pat-999']);
    });

    it('evaluateFhirPath should evaluate getReferenceKey(ResourceType) and polymorphic getReferenceKey()', () => {
      const refTyped = { reference: 'Patient/pat-123' };
      expect(evaluateFhirPath(refTyped, "getReferenceKey('Patient')")).toEqual(['pat-123']);
      expect(evaluateFhirPath(refTyped, "getReferenceKey('Practitioner')")).toEqual([]);
      expect(evaluateFhirPath(refTyped, 'getReferenceKey()')).toEqual(['Patient/pat-123']);
    });

    it('evaluateFhirPath should evaluate .where(...).first()', () => {
      const patient = {
        resourceType: 'Patient',
        identifier: [
          { system: 'https://fhir.kemkes.go.id/id/nik', value: '3578010101800001' },
          { system: 'https://fhir.kemkes.go.id/id/ihs-number', value: 'P35RSUD001' },
        ],
      };
      const nik = evaluateFhirPath(
        patient,
        "identifier.where(system='https://fhir.kemkes.go.id/id/nik').first().value"
      );
      expect(nik).toEqual(['3578010101800001']);
    });

    it('evaluateFhirPath should evaluate .exists() and .ofType()', () => {
      const observation = {
        resourceType: 'Observation',
        component: [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] },
            value: { value: 125, unit: 'mm[Hg]' },
          },
        ],
      };
      const systolic = evaluateFhirPath(
        observation,
        "component.where(code.coding.exists(code='8480-6')).first().value.ofType(Quantity).value"
      );
      expect(systolic).toEqual([125]);
    });

    it('evaluateFhirPath should support string concatenation (+ and + - +)', () => {
      const claim = { resourceType: 'Claim', id: 'clm-001' };
      const item = { sequence: 2 };
      expect(evaluateFhirPath(item, "getResourceKey() + '-' + sequence", claim)).toEqual(['clm-001-2']);
    });

    it('should separate fhir_claim (header 1 row) and fhir_claim_item (detail N rows with forEach: "item")', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);

      const headerViewDef = SQL_ON_FHIR_VIEW_DEFINITIONS.find(
        (v) => v.name === 'fhir_claim_header_view'
      )!;
      const itemViewDef = SQL_ON_FHIR_VIEW_DEFINITIONS.find(
        (v) => v.name === 'fhir_claim_item_view'
      )!;

      expect(headerViewDef).toBeDefined();
      expect(itemViewDef).toBeDefined();

      const headerRows = evaluateViewDefinition(headerViewDef, [dataset.claim]);
      const itemRows = evaluateViewDefinition(itemViewDef, [dataset.claim]);

      // Header is exactly 1 row per Claim
      expect(headerRows).toHaveLength(1);
      expect(headerRows[0].id).toBe('claim-rsud-soetomo-surabaya');
      expect(headerRows[0].total_value).toBe(4875000);
      expect(headerRows[0].total_currency).toBe('IDR');

      // Detail is N rows (3 items) with forEach: "item"
      expect(itemRows).toHaveLength(3);
      expect(itemRows[0].claim_id).toBe('claim-rsud-soetomo-surabaya');
      expect(itemRows[0].sequence).toBe(1);
      expect(itemRows[1].sequence).toBe(2);
      expect(itemRows[2].sequence).toBe(3);
      expect(itemRows.map((r) => r.id)).toEqual([
        'claim-rsud-soetomo-surabaya-1',
        'claim-rsud-soetomo-surabaya-2',
        'claim-rsud-soetomo-surabaya-3',
      ]);
    });

    it('flattenDatasetWithSqlOnFhir should synchronize diagnosis_role_code and diagnosis_rank to fhir_condition', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);
      const flattened = flattenDatasetWithSqlOnFhir(dataset);

      const conditionRows = flattened.tables.fhir_condition;
      expect(conditionRows).toBeDefined();
      expect(conditionRows).toHaveLength(2);

      const primaryCond = conditionRows.find(
        (c) => c.id === 'condition-rsud-soetomo-surabaya-primary'
      );
      const secondaryCond = conditionRows.find(
        (c) => c.id === 'condition-rsud-soetomo-surabaya-secondary'
      );

      expect(primaryCond).toBeDefined();
      expect(primaryCond?.diagnosis_role_code).toBe('AD'); // Admission / Principal
      expect(primaryCond?.diagnosis_rank).toBe(1);

      expect(secondaryCond).toBeDefined();
      expect(secondaryCond?.diagnosis_role_code).toBe('CM'); // Comorbidity
      expect(secondaryCond?.diagnosis_rank).toBe(2);
    });

    it('flattenDatasetWithSqlOnFhir should populate all view tables with raw_fhir and implementation_status', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);
      const flattened = flattenDatasetWithSqlOnFhir(dataset);

      for (const viewDef of SQL_ON_FHIR_VIEW_DEFINITIONS) {
        const rows = flattened.tables[viewDef.targetTable];
        expect(rows).toBeDefined();
        if (rows.length > 0) {
          expect(rows[0].implementation_status).toBe(viewDef.implementationStatus);
          if (viewDef.targetTable !== 'fhir_claim_item') {
            expect(typeof rows[0].raw_fhir).toBe('string');
          }
        }
      }
    });
  });

  // =========================================================================
  // 5. Real PostgreSQL (@electric-sql/pglite) Integration
  // =========================================================================
  describe('5. Real In-Memory PostgreSQL (@electric-sql/pglite) Integration', () => {
    let db: PGlite;

    beforeAll(async () => {
      db = await initPgliteDatabase();
    });

    it('initPgliteDatabase should create all 27 fhir_* tables and all 3 vw_fhir_* views', async () => {
      const tableCheck = await executeSqlQuery(
        db,
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
      );
      expect(tableCheck.error).toBeUndefined();
      const existingTables = tableCheck.rows.map((r) => r.table_name as string);

      const expectedTables = TABLE_METADATA.filter((t) => t.kind === 'table').map(
        (t) => t.tableName
      );
      expect(expectedTables).toHaveLength(27);
      for (const expectedTable of expectedTables) {
        expect(existingTables).toContain(expectedTable);
      }

      const viewCheck = await executeSqlQuery(
        db,
        `SELECT table_name FROM information_schema.views WHERE table_schema = 'public';`
      );
      expect(viewCheck.error).toBeUndefined();
      const existingViews = viewCheck.rows.map((r) => r.table_name as string);

      const expectedViews = TABLE_METADATA.filter((t) => t.kind === 'view').map((t) => t.tableName);
      expect(expectedViews).toHaveLength(3);
      for (const expectedView of expectedViews) {
        expect(existingViews).toContain(expectedView);
      }
    });

    it('syncDatasetsToPglite should populate all 27 tables across all 3 hospitals without FK or NOT NULL errors', async () => {
      const datasets = SIMRS_HOSPITAL_SEEDS.map((s) => normalizeSimrsToFhir(s));
      await syncDatasetsToPglite(db, datasets);

      // Verify row counts for key tables
      const orgCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_organization;');
      expect(Number(orgCount.rows[0].cnt)).toBe(6); // 3 hospitals * (1 provider + 1 payor)

      const patCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_patient;');
      expect(Number(patCount.rows[0].cnt)).toBe(4); // 3 master patients + 1 RSIA Bunda emergency temp patient

      const encCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_encounter;');
      expect(Number(encCount.rows[0].cnt)).toBe(3);

      const condCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_condition;');
      expect(Number(condCount.rows[0].cnt)).toBe(6); // 2 conditions per hospital * 3 hospitals

      const claimCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_claim;');
      expect(Number(claimCount.rows[0].cnt)).toBe(3);

      const claimItemCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_claim_item;');
      expect(Number(claimItemCount.rows[0].cnt)).toBe(9); // 3 items per hospital * 3 hospitals

      const chargeCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_charge_item;');
      expect(Number(chargeCount.rows[0].cnt)).toBe(9);

      const obsCount = await executeSqlQuery(db, 'SELECT COUNT(*) AS cnt FROM fhir_observation;');
      expect(Number(obsCount.rows[0].cnt)).toBe(9); // 3 observations (bp, hr, temp) * 3 hospitals
    });

    it('executeSqlQuery should query vw_fhir_clinical_diagnosis_recap correctly', async () => {
      const recap = await executeSqlQuery(
        db,
        'SELECT * FROM vw_fhir_clinical_diagnosis_recap ORDER BY organization_name, diagnosis_rank;'
      );
      expect(recap.error).toBeUndefined();
      expect(recap.rowCount).toBe(6); // 2 diagnoses * 3 hospitals

      const firstRow = recap.rows[0];
      expect(firstRow).toHaveProperty('organization_name');
      expect(firstRow).toHaveProperty('province_code');
      expect(firstRow).toHaveProperty('encounter_class');
      expect(firstRow).toHaveProperty('diagnosis_code');
      expect(firstRow).toHaveProperty('diagnosis_role_code');
      expect(firstRow).toHaveProperty('diagnosis_rank');
      expect(firstRow).toHaveProperty('total_encounters');
      expect(firstRow).toHaveProperty('total_unique_patients');
    });

    it('executeSqlQuery should query vw_fhir_financial_claim_recap correctly', async () => {
      const recap = await executeSqlQuery(
        db,
        'SELECT * FROM vw_fhir_financial_claim_recap ORDER BY total_submitted_amount DESC;'
      );
      expect(recap.error).toBeUndefined();
      expect(recap.rowCount).toBe(3);

      // Verify Harapan Bangsa has highest submitted amount (19,950,000 IDR)
      const topClaim = recap.rows[0];
      expect(topClaim.provider_organization).toBe('RS Premier Harapan Bangsa');
      expect(Number(topClaim.total_submitted_amount)).toBe(19950000);
      expect(Number(topClaim.total_approved_benefit_amount)).toBe(19950000);
      expect(Number(topClaim.total_variance_amount)).toBe(0);
      expect(topClaim.currency).toBe('IDR');
    });

    it('executeSqlQuery should query vw_fhir_clinical_to_claim_audit correctly', async () => {
      const audit = await executeSqlQuery(
        db,
        'SELECT * FROM vw_fhir_clinical_to_claim_audit ORDER BY claim_id;'
      );
      expect(audit.error).toBeUndefined();
      expect(audit.rowCount).toBe(3);

      for (const row of audit.rows) {
        expect(row.discharge_summary_status).toBe('FINAL_COMPLETE');
        expect(row.claim_outcome).toBe('complete');
        expect(row.principal_diagnosis).toBeTruthy();
        expect(Number(row.submitted_amount)).toBeGreaterThan(0);
        expect(Number(row.approved_benefit_amount)).toBeGreaterThan(0);
      }
    });

    it('resolveAndMergeDuplicatePatient should merge emergency duplicate patient and update fhir_patient', async () => {
      const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsia-bunda-bandung')!;
      const dataset = normalizeSimrsToFhir(seed);

      const { updatedDataset, mergedPatient } = await resolveAndMergeDuplicatePatient(
        db,
        dataset,
        'pat-temp-igd-003',
        dataset.patient.id
      );

      // Verify in-memory FHIR links
      expect(mergedPatient.link?.some((l) => l.type === 'replaces' && l.other.reference === 'Patient/pat-temp-igd-003')).toBe(true);
      expect(updatedDataset.duplicateEmergencyPatient?.active).toBe(false);
      expect(updatedDataset.duplicateEmergencyPatient?.link?.some((l) => l.type === 'replaced-by' && l.other.reference === `Patient/${dataset.patient.id}`)).toBe(true);

      // Verify PostgreSQL table was updated
      const patientInDb = await executeSqlQuery(
        db,
        "SELECT id, replaced_by_patient_id, active FROM fhir_patient WHERE id = 'pat-temp-igd-003';"
      );
      expect(patientInDb.rows[0].replaced_by_patient_id).toBe(dataset.patient.id);
      expect(patientInDb.rows[0].active).toBe(false);
    });

    it('resolveAndMergeDuplicatePatient should throw if duplicate or master patient is not found', async () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);

      expect(
        resolveAndMergeDuplicatePatient(db, dataset, 'non-existent', dataset.patient.id)
      ).rejects.toThrow('Pasien duplikat atau pasien master tidak ditemukan.');
    });
  });

  // =========================================================================
  // 6. 12-Module Curriculum & Zustand Store Actions
  // =========================================================================
  describe('6. 12-Module Curriculum & Zustand Store Actions (useFhirStore)', () => {
    it('Curriculum Modules should have exactly 12 ordered modules with complete fields', () => {
      expect(CURRICULUM_MODULES).toHaveLength(12);
      CURRICULUM_MODULES.forEach((mod, idx) => {
        expect(mod.moduleNumber).toBe(idx + 1);
        expect(mod.id).toBe(`module-${idx + 1}`);
        expect(mod.title).toBeTruthy();
        expect(mod.subtitle).toBeTruthy();
        expect(mod.mentalModelSummary).toBeTruthy();
        expect(mod.stepByStepExplanation.length).toBeGreaterThan(0);
        expect(mod.simrsVsFhirComparison.length).toBeGreaterThan(0);
        expect(mod.keyFhirPathExpressions.length).toBeGreaterThan(0);
        expect(mod.missions.length).toBeGreaterThan(0);
        expect(mod.resourcesCovered.length).toBeGreaterThan(0);
        expect(mod.targetTables.length).toBeGreaterThan(0);
      });
    });

    it('Pedagogical constants should be complete and coherent', () => {
      expect(FIVE_NORMALIZATION_LAWS).toHaveLength(5);
      expect(ADVANCED_NORMALIZATION_LAWS).toHaveLength(7);
      expect(ALL_NORMALIZATION_LAWS).toHaveLength(12);
      expect(FHIR_ALL_MODULES_CATALOG.length).toBeGreaterThanOrEqual(30);
      for (const law of ALL_NORMALIZATION_LAWS) {
        expect(law.indonesiaStatusDetail.length).toBeGreaterThan(20);
        expect(law.detailedExplanation.length).toBeGreaterThan(20);
        expect(law.columnMappings.length).toBeGreaterThan(0);
      }
      expect(SQL_TO_FHIR_CHEAT_SHEET).toHaveLength(6);
      expect(SAMPLE_ANALYTICAL_SQL_QUERIES).toHaveLength(4);
      expect(Object.keys(FHIR_ATTRIBUTE_ANNOTATIONS).length).toBeGreaterThanOrEqual(25);
    });

    it('useFhirStore: initializeLab should boot PGlite, sync seeds, and set active dataset', async () => {
      const store = useFhirStore.getState();
      await store.initializeLab();

      const state = useFhirStore.getState();
      expect(state.dbInitialized).toBe(true);
      expect(state.db).not.toBeNull();
      expect(state.dbSyncing).toBe(false);
      expect(state.dbError).toBeNull();
      expect(state.activeDataset).not.toBeNull();
      expect(state.activeDataset?.hospitalId).toBe('rsud-soetomo-surabaya');
      expect(state.validationReport?.valid).toBe(true);
      expect(state.flattenedResult?.hospitalId).toBe('rsud-soetomo-surabaya');
    });

    it('useFhirStore: selectHospital should switch hospital and derive dataset state', () => {
      const store = useFhirStore.getState();
      store.selectHospital('rs-harapan-bangsa-jakarta');

      const state = useFhirStore.getState();
      expect(state.selectedHospitalId).toBe('rs-harapan-bangsa-jakarta');
      expect(state.activeDataset?.hospitalId).toBe('rs-harapan-bangsa-jakarta');
      expect(state.activeDataset?.patient.name[0].text).toBe('Siti Rahmawati');
      expect(state.validationReport?.valid).toBe(true);

      // Invalid hospital ID is safely ignored
      store.selectHospital('invalid-hospital-id');
      expect(useFhirStore.getState().selectedHospitalId).toBe('rs-harapan-bangsa-jakarta');
    });

    it('useFhirStore: updateOverrides and resetHospitalOverrides should update overrides and sync', async () => {
      const store = useFhirStore.getState();
      store.selectHospital('rsud-soetomo-surabaya');

      await store.updateOverrides({ systolicBp: 155, diastolicBp: 95 });
      const stateWithOverride = useFhirStore.getState();
      const bpObs = stateWithOverride.activeDataset?.observations.find((o) =>
        o.code.coding?.some((c) => c.code === '85354-9')
      );
      const systolic = bpObs?.component?.find((c) =>
        c.code.coding?.some((cod) => cod.code === '8480-6')
      );
      expect(systolic?.valueQuantity?.value).toBe(155);

      await store.resetHospitalOverrides();
      const stateAfterReset = useFhirStore.getState();
      const resetBpObs = stateAfterReset.activeDataset?.observations.find((o) =>
        o.code.coding?.some((c) => c.code === '85354-9')
      );
      const resetSystolic = resetBpObs?.component?.find((c) =>
        c.code.coding?.some((cod) => cod.code === '8480-6')
      );
      expect(resetSystolic?.valueQuantity?.value).toBe(120); // Default override
    });

    it('useFhirStore: setActiveModule should clamp values between 1 and 12', () => {
      const store = useFhirStore.getState();
      store.setActiveModule(5);
      expect(useFhirStore.getState().activeModuleNumber).toBe(5);

      store.setActiveModule(99);
      expect(useFhirStore.getState().activeModuleNumber).toBe(12);

      store.setActiveModule(-10);
      expect(useFhirStore.getState().activeModuleNumber).toBe(1);
    });

    it('useFhirStore: toggleMissionCompleted should add and remove mission IDs', () => {
      const store = useFhirStore.getState();
      expect(store.completedMissionIds).not.toContain('test-mission-1');

      store.toggleMissionCompleted('test-mission-1');
      expect(useFhirStore.getState().completedMissionIds).toContain('test-mission-1');

      store.toggleMissionCompleted('test-mission-1');
      expect(useFhirStore.getState().completedMissionIds).not.toContain('test-mission-1');
    });

    it('useFhirStore: setStatusFilter, setCenterMode, setRightTab, selectResource', () => {
      const store = useFhirStore.getState();

      store.setStatusFilter('PIONEER_GLOBAL_FHIR');
      expect(useFhirStore.getState().statusFilter).toBe('PIONEER_GLOBAL_FHIR');

      store.setCenterMode('graph');
      expect(useFhirStore.getState().centerMode).toBe('graph');

      store.setCenterMode('laws');
      expect(useFhirStore.getState().centerMode).toBe('laws');

      store.setCenterMode('rosetta');
      expect(useFhirStore.getState().centerMode).toBe('rosetta');

      store.setRightTab('validator');
      expect(useFhirStore.getState().rightTab).toBe('validator');

      store.selectResource('Claim', 'claim-rsud-soetomo-surabaya');
      const state = useFhirStore.getState();
      expect(state.selectedResourceType).toBe('Claim');
      expect(state.selectedResourceId).toBe('claim-rsud-soetomo-surabaya');
      expect(state.rightTab).toBe('fhir-json');
    });

    it('useFhirStore: selectTable should preview table rows from PGlite', async () => {
      const store = useFhirStore.getState();
      await store.selectTable('fhir_claim');

      const state = useFhirStore.getState();
      expect(state.selectedTableName).toBe('fhir_claim');
      expect(state.rightTab).toBe('pglite-tables');
      expect(state.tableRowsPreview.length).toBeGreaterThan(0);
    });

    it('useFhirStore: runSqlQuery should execute custom SQL and update sqlQueryResult', async () => {
      const store = useFhirStore.getState();
      await store.runSqlQuery('SELECT COUNT(*) AS total_orgs FROM fhir_organization;');

      const state = useFhirStore.getState();
      expect(state.isExecutingSql).toBe(false);
      expect(state.sqlQueryResult).not.toBeNull();
      expect(state.sqlQueryResult?.rowCount).toBe(1);
      expect(Number(state.sqlQueryResult?.rows[0].total_orgs)).toBe(6);
    });

    it('useFhirStore: triggerPatientMerge should merge emergency patient in store and PGlite', async () => {
      const store = useFhirStore.getState();
      store.selectHospital('rsia-bunda-bandung');

      expect(useFhirStore.getState().activeDataset?.duplicateEmergencyPatient?.active).toBe(true);

      await store.triggerPatientMerge();
      const state = useFhirStore.getState();
      expect(state.activeDataset?.duplicateEmergencyPatient?.active).toBe(false);
      expect(
        state.activeDataset?.patient.link?.some(
          (l) => l.type === 'replaces' && l.other.reference === 'Patient/pat-temp-igd-003'
        )
      ).toBe(true);
    });

    it('Helper functions: getResourceFromDataset and getPatientLinkTarget', () => {
      const seed = SIMRS_HOSPITAL_SEEDS[0];
      const dataset = normalizeSimrsToFhir(seed);

      const patient = getResourceFromDataset(dataset, 'Patient', dataset.patient.id);
      expect(patient).not.toBeNull();
      expect(patient?.id).toBe(dataset.patient.id);

      const nonExistent = getResourceFromDataset(dataset, 'Patient', 'non-existent-id');
      expect(nonExistent).toBeNull();

      const nullDataset = getResourceFromDataset(null, 'Patient', dataset.patient.id);
      expect(nullDataset).toBeNull();

      const linkedPatient: Patient = {
        resourceType: 'Patient',
        id: 'pat-linked',
        name: [],
        gender: 'female',
        link: [{ other: { reference: 'Patient/pat-master' }, type: 'replaced-by' }],
      };
      expect(getPatientLinkTarget(linkedPatient)).toBe('Patient/pat-master');

      const unlinkedPatient: Patient = {
        resourceType: 'Patient',
        id: 'pat-unlinked',
        name: [],
        gender: 'male',
      };
      expect(getPatientLinkTarget(unlinkedPatient)).toBeNull();
    });

    it('Regression (H1/M1/H6/H7/SEC-01): distinct systolic/diastolic, benefit vs submitted, nested forEach, and multi-hospital merge preservation', async () => {
      const sbySeed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsud-soetomo-surabaya')!;
      const customDs = normalizeSimrsToFhir(sbySeed, {
        systolicBp: 145,
        diastolicBp: 92,
        approvedRoomBenefitIdr: 1800000,
      });
      const flattened = flattenDatasetWithSqlOnFhir(customDs);
      const bpRow = flattened.tables.fhir_observation.find((r) => r.code_value === '85354-9')!;
      expect(Number(bpRow.systolic_value)).toBe(145);
      expect(Number(bpRow.diastolic_value)).toBe(92);

      const crRow = flattened.tables.fhir_claim_response[0];
      expect(Number(crRow.total_submitted_value)).toBe(4875000);
      expect(Number(crRow.total_benefit_value)).toBe(4425000);

      // Room unit price vs net
      expect(customDs.claim.item[0].unitPrice?.value).toBe(750000);
      expect(customDs.claim.item[0].net.value).toBe(2250000);
      expect(customDs.location.name).toBe('ICU-01');
      expect(customDs.claim.diagnosis[0].packageCode?.coding?.[0]?.code).toBe('DRG-RESP-MCC');

      // Nested select forEach cross-product (Blueprint §6.B)
      const nestedRows = evaluateViewDefinition(
        {
          resourceType: 'ViewDefinition',
          name: 'nested_claim_items',
          targetTable: 'fhir_claim_item',
          resource: 'Claim',
          status: 'active',
          implementationStatus: 'PIONEER_GLOBAL_FHIR',
          description: 'Nested claim items test',
          select: [
            {
              column: [{ name: 'claim_id', path: 'getResourceKey()', type: 'string' }],
              select: [
                {
                  forEach: 'item',
                  column: [
                    { name: 'sequence', path: 'sequence', type: 'integer' },
                    { name: 'net_value', path: 'net.value', type: 'decimal' },
                  ],
                },
              ],
            },
          ],
        },
        [customDs.claim]
      );
      expect(nestedRows).toHaveLength(3);
      expect(nestedRows.map((r) => r.sequence)).toEqual([1, 2, 3]);
      expect(nestedRows.every((r) => r.claim_id === customDs.claim.id)).toBe(true);

      // Verify store merge preserves all 3 hospitals and replaced_by_patient_id in PGlite
      const store = useFhirStore.getState();
      await store.runSqlQuery("SELECT id, replaced_by_patient_id FROM fhir_patient WHERE id = 'pat-temp-igd-003';");
      expect(useFhirStore.getState().sqlQueryResult?.rows[0]?.replaced_by_patient_id).toBe('patient-rsia-bunda-bandung');
      await store.runSqlQuery('SELECT COUNT(*) AS cnt FROM fhir_claim;');
      expect(Number(useFhirStore.getState().sqlQueryResult?.rows[0]?.cnt)).toBe(3);

      // Verify audited HL7 FHIR R4 & SATUSEHAT conformance details
      const adminExt = customDs.patient.address?.[0]?.extension?.find(
        (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode'
      );
      expect(adminExt?.extension?.find((e) => e.url === 'rt')?.valueCode).toBe('001');
      expect(adminExt?.extension?.find((e) => e.url === 'rw')?.valueCode).toBe('002');
      expect(
        customDs.patient.extension?.find(
          (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/citizenshipStatus'
        )?.valueCode
      ).toBe('WNI');

      const mrnIdentifier = customDs.patient.identifier?.find(
        (i) => i.type?.coding?.[0]?.code === 'MR'
      );
      expect(mrnIdentifier?.system).toBe('http://sys-ids.kemkes.go.id/mrn/RSUD-SBY-001');
      expect(mrnIdentifier?.value).toBe('RM-SBY-001');

      // MedicationType extension & MedicationRequest.category[] array
      expect(
        customDs.medication.extension?.find(
          (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType'
        )?.valueCoding?.code
      ).toBe('NC');
      expect(Array.isArray(customDs.medicationRequest.category)).toBe(true);
      expect(customDs.medicationRequest.category?.[0]?.coding?.[0]?.code).toBe('inpatient');

      // Claim.item[] distinct category vs productOrService (Room, ICD-9-CM Procedure, KFA Medication)
      expect(customDs.claim.item[0].category?.coding?.[0]?.code).toBe('room');
      expect(customDs.claim.item[0].productOrService.coding?.[0]?.code).toBe('ROOM-INPATIENT');
      expect(customDs.claim.item[1].category?.coding?.[0]?.code).toBe('procedure');
      expect(customDs.claim.item[1].productOrService.coding?.[0]?.code).toBe('96.71');
      expect(customDs.claim.item[2].category?.coding?.[0]?.code).toBe('medication');
      expect(customDs.claim.item[2].productOrService.coding?.[0]?.code).toBe('93000001');

      // Composition XHTML namespace & Bundle RFC 4122 UUID v4 fullUrl
      expect(customDs.composition.section[0].text?.div).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      expect(customDs.transactionBundle.entry?.[0]?.fullUrl).toMatch(
        /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });
});
