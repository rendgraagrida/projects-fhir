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
  buildReferenceIndex,
  resolveReference,
} from '../src/lib/fhir-normalizer';
import { validateFhirDataset } from '../src/lib/fhir-validator';
import {
  evaluateFhirPath,
  evaluateViewDefinition,
  flattenDatasetWithSqlOnFhir,
  SQL_ON_FHIR_VIEW_DEFINITIONS,
  SQL_ON_FHIR_PROJECTIONS,
  PORTABLE_VIEW_DEFINITIONS,
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
  Address,
  Bundle,
  BundleEntry,
  Claim,
  Composition,
  Consent,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  Encounter,
  FhirResource,
  Medication,
  MedicationDispense,
  NormalizedHospitalDataset,
  Observation,
  Organization,
  Patient,
  Reference,
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

    it('uses R4-compliant addresses, consent and a contained eligibility request', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const dataset = normalizeSimrsToFhir(seed);
        expect(dataset.organization.address?.[0].use).toBe('work');
        expect(dataset.payorOrganization.address?.[0].use).toBe('work');
        expect(dataset.patient.address?.[0].use).toBe('home');
        expect(dataset.consent.category[0].coding?.[0]).toEqual({ system: 'http://loinc.org', code: '64292-6', display: 'Privacy policy' });
        expect(dataset.consent.policyRule?.coding?.[0]).toEqual({ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'OPTIN', display: 'Opt-in' });
        const response = dataset.coverageEligibilityResponse;
        expect(response.request.reference).toBe('#eligibility-request');
        expect(response.contained).toHaveLength(1);
        expect(response.contained?.[0]).toMatchObject({
          resourceType: 'CoverageEligibilityRequest', id: 'eligibility-request', status: 'active',
          purpose: ['validation', 'benefits'], patient: { reference: `Patient/${dataset.patient.id}` },
          created: response.created, insurer: { reference: `Organization/${dataset.payorOrganization.id}` },
          insurance: [{ focal: true, coverage: { reference: `Coverage/${dataset.coverage.id}` } }],
        });
        expect(dataset.allResources.some(resource => (resource.resourceType as string) === 'CoverageEligibilityRequest')).toBe(false);
        for (const section of dataset.composition.section) expect(section.text?.div).toContain('xmlns="http://www.w3.org/1999/xhtml"');
      }
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
      expect(dataset.payorOrganization.name).toBe('PT Asuransi Kesehatan Sejahtera');
      expect(dataset.payorOrganization.identifier?.[0]?.value).toBe('COMM-INS-001');
      expect(dataset.payorOrganization.type?.[0]?.coding?.[0]?.code).toBe('ins');
      expect(dataset.coverage.payor[0].display).toBe(dataset.payorOrganization.name);
      expect(dataset.coverage.class[0].value).toBe('COMMERCIAL');

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

    it('Multi-hospital Normalization: RS Premier Harapan Bangsa cleanly isolates commercial payor vs public BPJS seeds', () => {
      const jktSeed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rs-harapan-bangsa-jakarta')!;
      const sbySeed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsud-soetomo-surabaya')!;
      const bdgSeed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsia-bunda-bandung')!;

      const jktDs = normalizeSimrsToFhir(jktSeed);
      const sbyDs = normalizeSimrsToFhir(sbySeed);
      const bdgDs = normalizeSimrsToFhir(bdgSeed);

      // Jakarta uses commercial payor PT Asuransi Kesehatan Sejahtera
      expect(jktDs.payorOrganization.name).toBe('PT Asuransi Kesehatan Sejahtera');
      expect(jktDs.payorOrganization.identifier?.[0]?.value).toBe('COMM-INS-001');
      expect(jktDs.payorOrganization.identifier?.[0]?.system).toBe(
        'https://example.org/fhir/insurance-organization'
      );
      expect(jktDs.payorOrganization.type?.[0]?.coding?.[0]?.code).toBe('ins');
      expect(jktDs.coverage.payor[0].display).toBe('PT Asuransi Kesehatan Sejahtera');
      expect(jktDs.coverage.type?.coding?.[0]?.code).toBe('EHCPOL');
      expect(jktDs.coverage.class[0].value).toBe('COMMERCIAL');
      expect(jktDs.claim.total?.value).toBe(19950000);
      expect(jktDs.claim.total?.currency).toBe('IDR');

      // Surabaya and Bandung use BPJS public healthcare
      expect(sbyDs.payorOrganization.name).toBe('Penjamin RSUD Dr. Soetomo Nusantara');
      expect(sbyDs.payorOrganization.identifier?.[0]?.system).toBe('http://bpjs-kesehatan.go.id/id');
      expect(sbyDs.coverage.type?.coding?.[0]?.code).toBe('PUBLICPOL');
      expect(sbyDs.coverage.class[0].value).toBe('JKN-Kelas-1');

      expect(bdgDs.payorOrganization.name).toBe('Penjamin RSIA Bunda Sejahtera');
      expect(bdgDs.payorOrganization.identifier?.[0]?.system).toBe('http://bpjs-kesehatan.go.id/id');
      expect(bdgDs.coverage.type?.coding?.[0]?.code).toBe('PUBLICPOL');
      expect(bdgDs.coverage.class[0].value).toBe('JKN-Kelas-1');
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

    it('Conformance Rule 5: Organization addresses strictly use "work" or omit use, satisfying org-2 (never "home")', () => {
      // Invariant org-2: An address of an organization can never be of use 'home'
      // address.where(use = 'home').empty()
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);

        // Check provider organization
        expect(ds.organization.address).toBeDefined();
        expect(ds.organization.address!.length).toBeGreaterThan(0);
        for (const addr of ds.organization.address!) {
          expect(addr.use).toBe('work');
          expect(addr.use).not.toBe('home');
        }

        // Check payor organization
        expect(ds.payorOrganization.address).toBeDefined();
        expect(ds.payorOrganization.address!.length).toBeGreaterThan(0);
        for (const addr of ds.payorOrganization.address!) {
          expect(addr.use).toBe('work');
          expect(addr.use).not.toBe('home');
        }

        // Contrast: Patient address uses 'home'
        expect(ds.patient.address?.[0]?.use).toBe('home');
      }

      // Edge case tests for invariant org-2 logic:
      const satisfiesOrg2 = (org: Organization): boolean => {
        if (!org.address || org.address.length === 0) return true;
        return org.address.every((a) => a.use !== 'home');
      };

      const validWorkOrg: Organization = {
        resourceType: 'Organization',
        id: 'org-work',
        name: 'Klinik Sehat',
        address: [{ use: 'work', city: 'Surabaya' }],
      };
      expect(satisfiesOrg2(validWorkOrg)).toBe(true);

      const validOmittedUseOrg: Organization = {
        resourceType: 'Organization',
        id: 'org-omitted',
        name: 'Klinik Medika',
        address: [{ city: 'Jakarta' }], // use is omitted/undefined
      };
      expect(satisfiesOrg2(validOmittedUseOrg)).toBe(true);

      const validBillingOrg: Organization = {
        resourceType: 'Organization',
        id: 'org-billing',
        name: 'Kantor Asuransi',
        address: [{ use: 'billing', city: 'Bandung' }],
      };
      expect(satisfiesOrg2(validBillingOrg)).toBe(true);

      const invalidHomeOrg: Organization = {
        resourceType: 'Organization',
        id: 'org-invalid-home',
        name: 'Rumah Sakit Melanggar',
        address: [{ use: 'home', city: 'Surabaya' }],
      };
      expect(satisfiesOrg2(invalidHomeOrg)).toBe(false);

      const invalidMultiOrg: Organization = {
        resourceType: 'Organization',
        id: 'org-invalid-multi',
        name: 'RS Cabang',
        address: [
          { use: 'work', city: 'Surabaya' },
          { use: 'home', city: 'Malang' },
        ],
      };
      expect(satisfiesOrg2(invalidMultiOrg)).toBe(false);
    });

    it('Conformance Rule 6: Consent satisfies invariant ppc-1 with policyRule OPTIN and LOINC 64292-6 category', () => {
      // Invariant ppc-1: Either a policy or a policyRule SHALL be present
      // policy.exists() or policyRule.exists()
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const consent = ds.consent;

        expect(consent.resourceType).toBe('Consent');
        expect(consent.status).toBe('active');
        expect(consent.scope.coding?.[0]?.code).toBe('patient-privacy');
        expect(consent.scope.coding?.[0]?.system).toBe(
          'http://terminology.hl7.org/CodeSystem/consentscope'
        );

        // ppc-1: policyRule exists
        expect(consent.policyRule).toBeDefined();
        expect(consent.policyRule?.coding?.[0]?.system).toBe(
          'http://terminology.hl7.org/CodeSystem/v3-ActCode'
        );
        expect(consent.policyRule?.coding?.[0]?.code).toBe('OPTIN');
        expect(consent.policyRule?.coding?.[0]?.display).toBe('Opt-in');

        // category: strictly LOINC 64292-6
        expect(consent.category).toHaveLength(1);
        expect(consent.category[0].coding?.[0]?.system).toBe('http://loinc.org');
        expect(consent.category[0].coding?.[0]?.code).toBe('64292-6');
        expect(consent.category[0].coding?.[0]?.display).toBe('Privacy policy');

        // provision permit
        expect(consent.provision?.type).toBe('permit');
      }

      // Edge case tests for invariant ppc-1 logic:
      const satisfiesPpc1 = (c: Consent): boolean => {
        const hasPolicy = Boolean(c.policy && c.policy.length > 0);
        const hasPolicyRule = Boolean(c.policyRule?.coding?.length || c.policyRule?.text);
        return hasPolicy || hasPolicyRule;
      };

      const validWithPolicyRule: Consent = {
        resourceType: 'Consent',
        id: 'consent-rule',
        status: 'active',
        patient: { reference: 'Patient/p-test' },
        scope: { coding: [{ code: 'patient-privacy' }] },
        category: [{ coding: [{ system: 'http://loinc.org', code: '64292-6' }] }],
        policyRule: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'OPTIN' }],
        },
      };
      expect(satisfiesPpc1(validWithPolicyRule)).toBe(true);

      const validWithPolicyUri: Consent = {
        resourceType: 'Consent',
        id: 'consent-policy',
        status: 'active',
        patient: { reference: 'Patient/p-test' },
        scope: { coding: [{ code: 'patient-privacy' }] },
        category: [{ coding: [{ system: 'http://loinc.org', code: '64292-6' }] }],
        policy: [{ uri: 'https://example.org/privacy-policy-v1' }],
      };
      expect(satisfiesPpc1(validWithPolicyUri)).toBe(true);

      const invalidNoPolicyConsent: Consent = {
        resourceType: 'Consent',
        id: 'consent-invalid',
        status: 'active',
        patient: { reference: 'Patient/p-test' },
        scope: { coding: [{ code: 'patient-privacy' }] },
        category: [{ coding: [{ system: 'http://loinc.org', code: '64292-6' }] }],
      };
      expect(satisfiesPpc1(invalidNoPolicyConsent)).toBe(false);
    });

    it('Conformance Rule 7: CoverageEligibilityResponse embeds genuine contained CoverageEligibilityRequest (#eligibility-request)', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const res = ds.coverageEligibilityResponse;

        expect(res.resourceType).toBe('CoverageEligibilityResponse');
        expect(res.status).toBe('active');
        expect(res.request.reference).toBe('#eligibility-request');

        // Must contain genuine CoverageEligibilityRequest
        expect(res.contained).toBeDefined();
        expect(res.contained).toHaveLength(1);

        const req = res.contained?.[0] as CoverageEligibilityRequest;
        expect(req.resourceType).toBe('CoverageEligibilityRequest');
        expect(req.id).toBe('eligibility-request');
        expect(req.status).toBe('active');
        expect(req.purpose).toEqual(['validation', 'benefits']);
        expect(req.patient.reference).toBe(`Patient/${ds.patient.id}`);
        expect(req.insurer.reference).toBe(`Organization/${ds.payorOrganization.id}`);
        expect(req.created).toBe(res.created);
        expect(req.insurance).toHaveLength(1);
        expect(req.insurance?.[0].focal).toBe(true);
        expect(req.insurance?.[0].coverage.reference).toBe(`Coverage/${ds.coverage.id}`);

        // Architecture invariant: contained resource is NOT in top-level allResources
        expect(
          ds.allResources.some((r) => (r.resourceType as string) === 'CoverageEligibilityRequest')
        ).toBe(false);

        // Architecture invariant: contained resource does NOT have separate transaction entry
        expect(
          ds.transactionBundle.entry?.some(
            (e) => e.request?.url?.startsWith('CoverageEligibilityRequest')
          )
        ).toBe(false);
      }
    });

    it('Conformance Rule 8: Medication uses valueCodeableConcept with HTTPS national medication-type system and NC code', () => {
      for (const seed of SIMRS_HOSPITAL_SEEDS) {
        const ds = normalizeSimrsToFhir(seed);
        const med = ds.medication;

        expect(med.resourceType).toBe('Medication');
        expect(med.status).toBe('active');

        // MedicationType national extension
        const typeExt = med.extension?.find(
          (e) => e.url === 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType'
        );
        expect(typeExt).toBeDefined();

        // Must use valueCodeableConcept (NOT valueCoding or valueCode)
        expect(typeExt?.valueCodeableConcept).toBeDefined();
        expect((typeExt as unknown as Record<string, unknown>).valueCoding).toBeUndefined();
        expect((typeExt as unknown as Record<string, unknown>).valueCode).toBeUndefined();

        // Coding system MUST be HTTPS
        const coding = typeExt?.valueCodeableConcept?.coding?.[0];
        expect(coding?.system).toBe('https://terminology.kemkes.go.id/CodeSystem/medication-type');
        expect(coding?.code).toBe('NC');
        expect(coding?.display).toBe('Non-compound');

        // SQL-on-FHIR flattener extracts medication_type_code = 'NC'
        const flattened = flattenDatasetWithSqlOnFhir(ds);
        const medRow = flattened.tables.fhir_medication[0];
        expect(medRow.medication_type_code).toBe('NC');
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
        const rows = flattened.tables[viewDef.targetTable!];
        expect(rows).toBeDefined();
        if (rows.length > 0) {
          expect(rows[0].implementation_status).toBe(viewDef.implementationStatus);
          expect(typeof rows[0].raw_fhir).toBe('string');
        }
      }
      for (const row of flattened.tables.fhir_claim_item) {
        expect(JSON.parse(row.raw_fhir as string)).toEqual(JSON.parse(JSON.stringify(dataset.claim)));
      }
      expect(flattened.tables.fhir_medication[0].medication_type_code).toBe('NC');
      expect(flattened.tables.fhir_explanation_of_benefit[0].currency).toBe('IDR');
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
      datasets[0].medicationDispense.daysSupply = { value: 2.5, unit: 'd', system: 'http://unitsofmeasure.org', code: 'd' };
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
      const rawClaim = await executeSqlQuery(db, "SELECT raw_fhir->>'resourceType' AS type, raw_fhir->>'id' AS claim_id FROM fhir_claim_item WHERE sequence = 1 AND claim_id = $1", [datasets[0].claim.id]);
      expect(rawClaim.rows[0]).toEqual({ type: 'Claim', claim_id: datasets[0].claim.id });
      const eobCurrency = await executeSqlQuery(db, 'SELECT currency FROM fhir_explanation_of_benefit WHERE id = $1', [datasets[0].explanationOfBenefit.id]);
      expect(eobCurrency.rows[0].currency).toBe('IDR');
      const supply = await executeSqlQuery(db, 'SELECT days_supply_value FROM fhir_medication_dispense WHERE id = $1', [datasets[0].medicationDispense.id]);
      expect(Number(supply.rows[0].days_supply_value)).toBe(2.5);

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

    it('PGlite Integration: fhir_claim_item strictly persists raw_fhir JSONB NOT NULL, prevents null insertion, and preserves Claim JSON', async () => {
      // 1. Verify schema column constraints
      const colCheck = await executeSqlQuery(
        db,
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'fhir_claim_item' AND column_name = 'raw_fhir';"
      );
      expect(colCheck.error).toBeUndefined();
      expect(colCheck.rowCount).toBe(1);
      expect(colCheck.rows[0].data_type).toBe('jsonb');
      expect(colCheck.rows[0].is_nullable).toBe('NO');

      // 2. Verify all rows have valid raw_fhir populated
      const claimItemRows = await executeSqlQuery(
        db,
        "SELECT id, claim_id, sequence, raw_fhir IS NOT NULL AS has_raw, raw_fhir->>'resourceType' AS rt, raw_fhir->>'id' AS raw_claim_id, jsonb_array_length(raw_fhir->'item') AS item_count FROM fhir_claim_item;"
      );
      expect(claimItemRows.error).toBeUndefined();
      expect(claimItemRows.rowCount).toBe(9); // 3 items * 3 hospitals
      for (const row of claimItemRows.rows) {
        expect(row.has_raw).toBe(true);
        expect(row.rt).toBe('Claim');
        expect(row.raw_claim_id).toBe(row.claim_id);
        expect(Number(row.item_count)).toBe(3);
      }

      // 3. Edge case: attempting to insert raw_fhir as NULL must fail with NOT NULL constraint violation
      const nullInsert = await executeSqlQuery(
        db,
        "INSERT INTO fhir_claim_item (id, claim_id, sequence, product_or_service_system, product_or_service_code, product_or_service_display, net_value, currency, raw_fhir) VALUES ('item-test-null', 'claim-rsud-soetomo-surabaya', 99, 'http://test', 'CODE', 'Test', 1000, 'IDR', NULL);"
      );
      expect(nullInsert.error).toBeDefined();
      expect(nullInsert.error).toMatch(/null value in column "raw_fhir"|violates not-null constraint/);
    });

    it('PGlite Integration: fhir_medication_dispense NUMERIC column preserves decimal and fractional days_supply_value', async () => {
      // 1. Verify schema data type
      const colCheck = await executeSqlQuery(
        db,
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fhir_medication_dispense' AND column_name = 'days_supply_value';"
      );
      expect(colCheck.error).toBeUndefined();
      expect(colCheck.rowCount).toBe(1);
      expect(colCheck.rows[0].data_type).toBe('numeric');

      // 2. Test fractional/decimal values update and exact persistence
      const updateRes = await executeSqlQuery(
        db,
        "UPDATE fhir_medication_dispense SET days_supply_value = 2.75 WHERE id = 'medication-dispense-rs-harapan-bangsa-jakarta';"
      );
      expect(updateRes.error).toBeUndefined();

      const queryRes = await executeSqlQuery(
        db,
        "SELECT id, days_supply_value FROM fhir_medication_dispense WHERE id = 'medication-dispense-rs-harapan-bangsa-jakarta';"
      );
      expect(queryRes.error).toBeUndefined();
      expect(Number(queryRes.rows[0].days_supply_value)).toBe(2.75);

      // Fractional sub-unit value (e.g., 0.5 day)
      await executeSqlQuery(
        db,
        "UPDATE fhir_medication_dispense SET days_supply_value = 0.5 WHERE id = 'medication-dispense-rsia-bunda-bandung';"
      );
      const queryRes2 = await executeSqlQuery(
        db,
        "SELECT id, days_supply_value FROM fhir_medication_dispense WHERE id = 'medication-dispense-rsia-bunda-bandung';"
      );
      expect(Number(queryRes2.rows[0].days_supply_value)).toBe(0.5);

      // Verify aggregation works on numeric values
      const sumRes = await executeSqlQuery(
        db,
        'SELECT SUM(days_supply_value) AS total_days FROM fhir_medication_dispense;'
      );
      expect(sumRes.error).toBeUndefined();
      // 2.5 (from Soetomo) + 2.75 (from Harapan Bangsa) + 0.5 (from Bunda) = 5.75
      expect(Number(sumRes.rows[0].total_days)).toBe(5.75);
    });

    it('PGlite Integration: fhir_explanation_of_benefit cleanly projects non-null currency matching financial totals', async () => {
      // 1. Verify column exists
      const colCheck = await executeSqlQuery(
        db,
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'fhir_explanation_of_benefit' AND column_name = 'currency';"
      );
      expect(colCheck.error).toBeUndefined();
      expect(colCheck.rowCount).toBe(1);

      // 2. Verify all EOB records have non-null currency = 'IDR'
      const eobRows = await executeSqlQuery(
        db,
        'SELECT id, claim_id, currency, total_submitted_value, total_benefit_value FROM fhir_explanation_of_benefit;'
      );
      expect(eobRows.error).toBeUndefined();
      expect(eobRows.rowCount).toBe(3);
      for (const row of eobRows.rows) {
        expect(row.currency).toBe('IDR');
        expect(Number(row.total_submitted_value)).toBeGreaterThan(0);
        expect(Number(row.total_benefit_value)).toBeGreaterThan(0);
      }

      // 3. Verify cross-table currency agreement across EOB, Claim, and ClaimResponse
      const crossCheck = await executeSqlQuery(
        db,
        `SELECT eob.id, eob.currency AS eob_curr, cl.total_currency AS cl_curr, cr.currency AS cr_curr
         FROM fhir_explanation_of_benefit eob
         JOIN fhir_claim cl ON eob.claim_id = cl.id
         JOIN fhir_claim_response cr ON eob.claim_response_id = cr.id;`
      );
      expect(crossCheck.error).toBeUndefined();
      expect(crossCheck.rowCount).toBe(3);
      for (const row of crossCheck.rows) {
        expect(row.eob_curr).toBe('IDR');
        expect(row.cl_curr).toBe('IDR');
        expect(row.cr_curr).toBe('IDR');
      }
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
        )?.valueCodeableConcept?.coding?.[0]
      ).toEqual({ system: 'https://terminology.kemkes.go.id/CodeSystem/medication-type', code: 'NC', display: 'Non-compound' });
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

  // =========================================================================
  // 7. Phase 2 Universal Conformance, Reference Indexing, Validation,
  //    SQL-on-FHIR 27-Table Flattening, PGlite Merge & Zustand Store Suite
  // =========================================================================
  describe('7. Phase 2 Universal Conformance, Reference Indexing, Validation, SQL-on-FHIR 27-Table Flattening, PGlite Merge & Zustand Store Suite', () => {
    let pgliteDb: PGlite;

    beforeAll(async () => {
      pgliteDb = await initPgliteDatabase();
      const datasets = SIMRS_HOSPITAL_SEEDS.map((s) => normalizeSimrsToFhir(s));
      await syncDatasetsToPglite(pgliteDb, datasets);
    });

    // -----------------------------------------------------------------------
    // 7.1 Contained CoverageEligibilityRequest (#eligibility-request) Architecture
    // -----------------------------------------------------------------------
    describe('7.1 Contained CoverageEligibilityRequest (#eligibility-request) Architecture', () => {
      it('guarantees CoverageEligibilityRequest is strictly contained inside CoverageEligibilityResponse and absent from allResources top-level across all hospital seeds', () => {
        for (const seed of SIMRS_HOSPITAL_SEEDS) {
          const dataset = normalizeSimrsToFhir(seed);

          // 1. Must NOT appear anywhere in allResources top-level
          const topLevelResourceTypes = dataset.allResources.map((r) => r.resourceType);
          expect(topLevelResourceTypes).not.toContain('CoverageEligibilityRequest');
          expect(dataset.allResources.some((r) => r.id === 'eligibility-request')).toBe(false);

          // 2. Must be strictly contained in dataset.coverageEligibilityResponse
          const cer = dataset.coverageEligibilityResponse;
          expect(cer).toBeDefined();
          expect(cer.resourceType).toBe('CoverageEligibilityResponse');
          expect(Array.isArray(cer.contained)).toBe(true);
          expect(cer.contained).toHaveLength(1);

          const containedRequest = cer.contained![0] as CoverageEligibilityRequest;
          expect(containedRequest.resourceType).toBe('CoverageEligibilityRequest');
          expect(containedRequest.id).toBe('eligibility-request');
          expect(containedRequest.status).toBe('active');
          expect(containedRequest.purpose).toEqual(['validation', 'benefits']);
          expect(containedRequest.patient.reference).toBe(`Patient/${dataset.patient.id}`);
          expect(containedRequest.insurer.reference).toBe(`Organization/payor-${seed.id}`);
          expect(containedRequest.insurance?.[0]?.coverage?.reference).toBe(`Coverage/coverage-${seed.id}`);

          // 3. Response request reference must be local fragment #eligibility-request
          expect(cer.request.reference).toBe('#eligibility-request');
        }
      });

      it('guarantees transaction Bundle never exposes CoverageEligibilityRequest as a top-level transaction entry', () => {
        for (const seed of SIMRS_HOSPITAL_SEEDS) {
          const dataset = normalizeSimrsToFhir(seed);
          const entries = dataset.transactionBundle.entry ?? [];

          // Bundle entries must NOT have resourceType CoverageEligibilityRequest
          const entryResourceTypes = entries.map((e) => e.resource?.resourceType);
          expect(entryResourceTypes).not.toContain('CoverageEligibilityRequest');

          // Bundle entry URLs must NOT target CoverageEligibilityRequest
          const requestUrls = entries.map((e) => e.request?.url ?? '');
          expect(requestUrls.some((u) => u.includes('CoverageEligibilityRequest'))).toBe(false);

          // Contained request inside CoverageEligibilityResponse in bundle remains intact
          const bundleResponseEntry = entries.find(
            (e) => e.resource?.resourceType === 'CoverageEligibilityResponse'
          );
          expect(bundleResponseEntry).toBeDefined();
          const bundleCer = bundleResponseEntry!.resource as CoverageEligibilityResponse;
          expect(bundleCer.contained).toHaveLength(1);
          expect(bundleCer.contained![0].id).toBe('eligibility-request');
          expect(bundleCer.request.reference).toBe('#eligibility-request');
        }
      });
    });

    // -----------------------------------------------------------------------
    // 7.2 Reference Indexing and Resolution (buildReferenceIndex & resolveReference)
    // -----------------------------------------------------------------------
    describe('7.2 Reference Indexing and Resolution (buildReferenceIndex & resolveReference)', () => {
      it('buildReferenceIndex accurately indexes standalone resources and bundle entries by key and fullUrl', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        const index = buildReferenceIndex(dataset.allResources, dataset.transactionBundle);

        // Verify byKey index
        expect(index.byKey.has(`Patient/${dataset.patient.id}`)).toBe(true);
        expect(index.byKey.get(`Patient/${dataset.patient.id}`)).toEqual(dataset.patient);
        expect(index.byKey.has(`Encounter/${dataset.encounter.id}`)).toBe(true);
        expect(index.byKey.get(`Encounter/${dataset.encounter.id}`)).toEqual(dataset.encounter);
        expect(index.byKey.has(`Organization/org-${seed.id}`)).toBe(true);
        expect(index.byKey.has(`Claim/${dataset.claim.id}`)).toBe(true);

        // Verify byFullUrl index
        const firstEntry = dataset.transactionBundle.entry![0];
        expect(index.byFullUrl.has(firstEntry.fullUrl!)).toBe(true);
        expect(index.byFullUrl.get(firstEntry.fullUrl!)).toBe(firstEntry.resource);

        // Standalone indexing without bundle
        const standaloneIndex = buildReferenceIndex(dataset.allResources);
        expect(standaloneIndex.byKey.has(`Patient/${dataset.patient.id}`)).toBe(true);
        expect(standaloneIndex.byFullUrl.size).toBe(0);
      });

      it('resolveReference resolves contained fragment reference #eligibility-request against owner resource', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);
        const index = buildReferenceIndex(dataset.allResources, dataset.transactionBundle);

        // 1. Valid contained resolution
        const resolution = resolveReference(
          { reference: '#eligibility-request' },
          dataset.coverageEligibilityResponse,
          index
        );
        expect(resolution.state).toBe('resolved');
        if (resolution.state === 'resolved') {
          expect(resolution.target.resourceType).toBe('CoverageEligibilityRequest');
          expect(resolution.target.id).toBe('eligibility-request');
          expect(resolution.key).toBe('CoverageEligibilityRequest/eligibility-request');
          expect(resolution.owner).toBe(`CoverageEligibilityResponse/${dataset.coverageEligibilityResponse.id}`);
        }

        // 2. Expected types filter matches
        const resWithMatchingType = resolveReference(
          { reference: '#eligibility-request' },
          dataset.coverageEligibilityResponse,
          index,
          ['CoverageEligibilityRequest']
        );
        expect(resWithMatchingType.state).toBe('resolved');

        // 3. Expected types filter mismatches
        const resWithMismatchType = resolveReference(
          { reference: '#eligibility-request' },
          dataset.coverageEligibilityResponse,
          index,
          ['Patient', 'Observation']
        );
        expect(resWithMismatchType.state).toBe('invalid');
        if (resWithMismatchType.state === 'invalid') {
          expect(resWithMismatchType.reason).toBe('Contained reference has an unexpected resource type.');
        }

        // 4. Missing fragment in contained array
        const resMissing = resolveReference(
          { reference: '#non-existent-fragment' },
          dataset.coverageEligibilityResponse,
          index
        );
        expect(resMissing.state).toBe('unresolved');
        if (resMissing.state === 'unresolved') {
          expect(resMissing.reference).toBe('#non-existent-fragment');
        }
      });

      it('resolveReference resolves direct reference by key, path prefixes, and enforces expectedTypes constraint', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);
        const index = buildReferenceIndex(dataset.allResources, dataset.transactionBundle);

        // Direct reference Patient/{id}
        const patRes = resolveReference(
          { reference: `Patient/${dataset.patient.id}` },
          dataset.encounter,
          index,
          ['Patient']
        );
        expect(patRes.state).toBe('resolved');
        if (patRes.state === 'resolved') {
          expect(patRes.target).toEqual(dataset.patient);
          expect(patRes.key).toBe(`Patient/${dataset.patient.id}`);
        }

        // Direct reference with URL path prefix e.g. /baseR4/Encounter/{id}
        const encRes = resolveReference(
          { reference: `http://example.org/fhir/Encounter/${dataset.encounter.id}` },
          dataset.claim,
          index,
          ['Encounter']
        );
        expect(encRes.state).toBe('resolved');
        if (encRes.state === 'resolved') {
          expect(encRes.target).toEqual(dataset.encounter);
        }
        // Type mismatch constraint
        const mismatchRes = resolveReference(
          { reference: `Patient/${dataset.patient.id}` },
          dataset.encounter,
          index,
          ['Encounter', 'Condition']
        );
        expect(mismatchRes.state).toBe('invalid');
        if (mismatchRes.state === 'invalid') {
          expect(mismatchRes.reason).toBe('Reference has an unexpected resource type.');
        }

        // Non-existent key
        const unres = resolveReference(
          { reference: 'Patient/patient-ghost-404' },
          dataset.encounter,
          index
        );
        expect(unres.state).toBe('unresolved');
      });

      it('resolveReference handles bundle fullUrl, logical identifier, external URLs, and missing references', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);
        const index = buildReferenceIndex(dataset.allResources, dataset.transactionBundle);

        // Bundle fullUrl resolution
        const entry = dataset.transactionBundle.entry![0];
        const urnRes = resolveReference({ reference: entry.fullUrl }, dataset.encounter, index);
        expect(urnRes.state).toBe('resolved');
        if (urnRes.state === 'resolved') {
          expect(urnRes.target).toBe(entry.resource!);
        }

        // Logical identifier reference
        const logicalRes = resolveReference(
          { identifier: { system: 'http://bpjs-kesehatan.go.id/id/kartu', value: '000123456789' } },
          dataset.encounter,
          index
        );
        expect(logicalRes.state).toBe('logical');
        if (logicalRes.state === 'logical') {
          expect(logicalRes.identifier.value).toBe('000123456789');
        }

        // External reference URL not in local index
        const extRes = resolveReference(
          { reference: 'https://satusehat.kemkes.go.id/fhir-r4/v1/Patient/external-ihs-pat-999' },
          dataset.encounter,
          index
        );
        expect(extRes.state).toBe('external');
        if (extRes.state === 'external') {
          expect(extRes.reference).toBe('https://satusehat.kemkes.go.id/fhir-r4/v1/Patient/external-ihs-pat-999');
        }

        // Missing both reference and identifier
        const invalidRes = resolveReference({} as Reference, dataset.encounter, index);
        expect(invalidRes.state).toBe('invalid');
        if (invalidRes.state === 'invalid') {
          expect(invalidRes.reason).toBe('Reference requires reference or identifier.');
        }
      });
    });

    // -----------------------------------------------------------------------
    // 7.3 Expanded Validation Rules: Cardinality, Observation, Composition, Evidence chain, Financial reconciliation, Bundle transactions
    // -----------------------------------------------------------------------
    describe('7.3 Expanded Validation Rules Suite for All 6 Rules', () => {
      it('Rule 1: Cardinality detects duplicate resource identities in allResources', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // Inject duplicate Patient resource into allResources
        const duplicatePatient = { ...dataset.patient };
        const tamperedDataset: NormalizedHospitalDataset = {
          ...dataset,
          allResources: [...dataset.allResources, duplicatePatient],
        };

        const report = validateFhirDataset(tamperedDataset);
        const cardRule = report.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
        expect(cardRule.passed).toBe(false);
        expect(cardRule.issues.some((i) => i.message.includes('Identitas resource duplikat'))).toBe(true);
      });

      it('Rule 1: Cardinality enforces org-1, org-2, ppc-1, and choice constraints on MedicationRequest & MedicationDispense', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. org-2: Organization address use=home is forbidden
        const tamperedOrgHome: NormalizedHospitalDataset = {
          ...dataset,
          organization: {
            ...dataset.organization,
            address: [{ use: 'home' as Address['use'], text: 'Forbidden home address for org' }],
          },
          allResources: dataset.allResources.map((r) =>
            r.id === dataset.organization.id
              ? { ...dataset.organization, address: [{ use: 'home' as Address['use'], text: 'Forbidden home address for org' }] }
              : r
          ),
        };
        const reportOrgHome = validateFhirDataset(tamperedOrgHome);
        const rule1OrgHome = reportOrgHome.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
        expect(rule1OrgHome.passed).toBe(false);
        expect(rule1OrgHome.issues.some((i) => i.message.includes('org-2'))).toBe(true);

        // 2. org-1: Organization must have name or identifier
        const tamperedOrgEmpty: NormalizedHospitalDataset = {
          ...dataset,
          organization: { ...dataset.organization, name: '', identifier: [] },
          allResources: dataset.allResources.map((r) =>
            r.id === dataset.organization.id ? { ...dataset.organization, name: '', identifier: [] } : r
          ),
        };
        const reportOrgEmpty = validateFhirDataset(tamperedOrgEmpty);
        const rule1OrgEmpty = reportOrgEmpty.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
        expect(rule1OrgEmpty.passed).toBe(false);
        expect(rule1OrgEmpty.issues.some((i) => i.message.includes('org-1'))).toBe(true);

        // 3. ppc-1: Consent must have policy or policyRule
        const tamperedConsent: NormalizedHospitalDataset = {
          ...dataset,
          consent: { ...dataset.consent, policy: [], policyRule: undefined },
          allResources: dataset.allResources.map((r) =>
            r.id === dataset.consent.id ? { ...r, policy: [], policyRule: undefined } : r
          ),
        };
        const reportConsent = validateFhirDataset(tamperedConsent);
        const rule1Consent = reportConsent.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
        expect(rule1Consent.passed).toBe(false);
        expect(rule1Consent.issues.some((i) => i.message.includes('ppc-1'))).toBe(true);

        // 4. MedicationRequest choice conflict (both medicationReference and medicationCodeableConcept)
        const tamperedMedReq: NormalizedHospitalDataset = {
          ...dataset,
          medicationRequest: {
            ...dataset.medicationRequest,
            medicationReference: { reference: `Medication/${dataset.medication.id}` },
            medicationCodeableConcept: { coding: [{ system: 'http://test', code: 'TEST' }] },
          },
          allResources: dataset.allResources.map((r) =>
            r.id === dataset.medicationRequest.id
              ? {
                  ...r,
                  medicationReference: { reference: `Medication/${dataset.medication.id}` },
                  medicationCodeableConcept: { coding: [{ system: 'http://test', code: 'TEST' }] },
                }
              : r
          ),
        };
        const reportMedReq = validateFhirDataset(tamperedMedReq);
        const rule1MedReq = reportMedReq.rules.find((r) => r.ruleId === 'FHIR_STD_01_MANDATORY_CARDINALITY')!;
        expect(rule1MedReq.passed).toBe(false);
        expect(rule1MedReq.issues.some((i) => i.path === 'medication[x]')).toBe(true);
      });

      it('Rule 2: Observation OBS-7 detects identical root and component codes as well as multiple root value[x]', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. Identical root and component code
        const identicalCodeObs: Observation = {
          resourceType: 'Observation',
          id: 'obs-duplicate-code',
          status: 'final',
          category: [dataset.observations[0].category[0]],
          code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic' }] },
          subject: { reference: `Patient/${dataset.patient.id}` },
          component: [
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic' }] },
              valueQuantity: { value: 120, unit: 'mm[Hg]', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
            },
          ],
        };
        const tamperedObs1: NormalizedHospitalDataset = {
          ...dataset,
          observations: [...dataset.observations, identicalCodeObs],
        };
        const report1 = validateFhirDataset(tamperedObs1);
        const obs7Rule1 = report1.rules.find((r) => r.ruleId === 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7')!;
        expect(obs7Rule1.passed).toBe(false);
        expect(obs7Rule1.issues.some((i) => i.message.includes('code root tidak boleh sama dengan code component'))).toBe(true);

        // 2. Multiple root value[x]
        const multiValueObs: Observation = {
          resourceType: 'Observation',
          id: 'obs-multi-value',
          status: 'final',
          category: [dataset.observations[0].category[0]],
          code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
          subject: { reference: `Patient/${dataset.patient.id}` },
          valueQuantity: { value: 80, unit: '/min', system: 'http://unitsofmeasure.org', code: '/min' },
          valueString: 'Eighty beats per minute',
        };
        const tamperedObs2: NormalizedHospitalDataset = {
          ...dataset,
          observations: [...dataset.observations, multiValueObs],
        };
        const report2 = validateFhirDataset(tamperedObs2);
        const obs7Rule2 = report2.rules.find((r) => r.ruleId === 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7')!;
        expect(obs7Rule2.passed).toBe(false);
        expect(obs7Rule2.issues.some((i) => i.message.includes('Observation hanya boleh memiliki satu alternatif value[x]'))).toBe(true);
      });

      it('Rule 3: Composition CMP-1 & CMP-2 enforce section invariants and XHTML narrative namespaces', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. CMP-2: section cannot have both entry and emptyReason
        const tamperedCmp2: NormalizedHospitalDataset = {
          ...dataset,
          composition: {
            ...dataset.composition,
            section: dataset.composition.section.map((sec, idx) =>
              idx === 0
                ? {
                    ...sec,
                    entry: [{ reference: `Condition/${dataset.conditions[0].id}` }],
                    emptyReason: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'unavailable' }] },
                  }
                : sec
            ),
          },
        };
        const reportCmp2 = validateFhirDataset(tamperedCmp2);
        const rule3Cmp2 = reportCmp2.rules.find((r) => r.ruleId === 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1')!;
        expect(rule3Cmp2.passed).toBe(false);
        expect(rule3Cmp2.issues.some((i) => i.message.includes('Pelanggaran cmp-2'))).toBe(true);

        // 2. Narrative XHTML xmlns requirement
        const tamperedXmlns: NormalizedHospitalDataset = {
          ...dataset,
          composition: {
            ...dataset.composition,
            section: dataset.composition.section.map((sec, idx) =>
              idx === 0
                ? {
                    ...sec,
                    text: { status: 'generated', div: '<div>Plain div without xmlns declaration</div>' },
                  }
                : sec
            ),
          },
        };
        const reportXmlns = validateFhirDataset(tamperedXmlns);
        const rule3Xmlns = reportXmlns.rules.find((r) => r.ruleId === 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1')!;
        expect(rule3Xmlns.passed).toBe(false);
        expect(rule3Xmlns.issues.some((i) => i.message.includes('Narrative Composition harus berupa XHTML'))).toBe(true);
      });

      it('Rule 4: Evidence chain validates cross-encounter linkage, contained CER, and supportingInfo types', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. Claim supportingInfo pointing to an invalid resource type (e.g. Patient)
        const tamperedSupportingInfo: NormalizedHospitalDataset = {
          ...dataset,
          claim: {
            ...dataset.claim,
            supportingInfo: [
              {
                sequence: 1,
                category: { coding: [{ system: 'http://test', code: 'support' }] },
                valueReference: { reference: `Patient/${dataset.patient.id}` },
              },
            ],
          },
        };
        const reportSupp = validateFhirDataset(tamperedSupportingInfo);
        const evidenceRuleSupp = reportSupp.rules.find((r) => r.ruleId === 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN')!;
        expect(evidenceRuleSupp.passed).toBe(false);
        expect(evidenceRuleSupp.issues.some((i) => i.message.includes('Supporting information klaim harus menunjuk Composition, Observation, atau ServiceRequest'))).toBe(true);

        // 2. CoverageEligibilityResponse request referencing missing fragment
        const tamperedCer: NormalizedHospitalDataset = {
          ...dataset,
          coverageEligibilityResponse: {
            ...dataset.coverageEligibilityResponse,
            request: { reference: '#missing-request-id' },
          },
        };
        const reportCer = validateFhirDataset(tamperedCer);
        const evidenceRuleCer = reportCer.rules.find((r) => r.ruleId === 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN')!;
        expect(evidenceRuleCer.passed).toBe(false);
        expect(evidenceRuleCer.issues.some((i) => i.message.includes('Eligibility request tidak resolve'))).toBe(true);
      });

      it('Rule 5: Financial reconciliation catches negative amounts, duplicate adjudication categories, and currency mismatches', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. Negative amount in ChargeItem
        const tamperedCharge: NormalizedHospitalDataset = {
          ...dataset,
          chargeItems: dataset.chargeItems.map((item, idx) =>
            idx === 0 ? { ...item, priceOverride: { value: -100000, currency: 'IDR' } } : item
          ),
        };
        const reportCharge = validateFhirDataset(tamperedCharge);
        const financialRuleCharge = reportCharge.rules.find((r) => r.ruleId === 'FHIR_STD_05_FINANCIAL_RECONCILIATION')!;
        expect(financialRuleCharge.passed).toBe(false);
        expect(financialRuleCharge.issues.some((i) => i.message.includes('Nilai finansial tidak boleh negatif'))).toBe(true);

        // 2. Duplicate adjudication category in ClaimResponse.total
        const tamperedTotal: NormalizedHospitalDataset = {
          ...dataset,
          claimResponse: {
            ...dataset.claimResponse,
            total: [
              { category: { coding: [{ system: 'http://test', code: 'submitted' }] }, amount: { value: 1000, currency: 'IDR' } },
              { category: { coding: [{ system: 'http://test', code: 'submitted' }] }, amount: { value: 1000, currency: 'IDR' } },
            ],
          },
        };
        const reportTotal = validateFhirDataset(tamperedTotal);
        const financialRuleTotal = reportTotal.rules.find((r) => r.ruleId === 'FHIR_STD_05_FINANCIAL_RECONCILIATION')!;
        expect(financialRuleTotal.passed).toBe(false);
        expect(financialRuleTotal.issues.some((i) => i.message.includes('menggandakan kategori adjudication'))).toBe(true);

        // 3. Currency mismatch in Claim.total
        const tamperedCurrency: NormalizedHospitalDataset = {
          ...dataset,
          claim: {
            ...dataset.claim,
            total: { value: dataset.claim.total?.value ?? 0, currency: 'USD' },
          },
        };
        const reportCurrency = validateFhirDataset(tamperedCurrency);
        const financialRuleCurrency = reportCurrency.rules.find((r) => r.ruleId === 'FHIR_STD_05_FINANCIAL_RECONCILIATION')!;
        expect(financialRuleCurrency.passed).toBe(false);
      });

      it('Rule 6: Bundle bdl-3 transaction rules validate HTTP methods, URLs, and operation ordering', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // 1. Non-transaction bundle ignores bdl-3 order checks
        const nonTransactionBundle: Bundle = {
          ...dataset.transactionBundle,
          type: 'collection',
        };
        const reportNonTx = validateFhirDataset({
          ...dataset,
          transactionBundle: nonTransactionBundle,
        });
        const bundleRuleNonTx = reportNonTx.rules.find((r) => r.ruleId === 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3')!;
        expect(bundleRuleNonTx.passed).toBe(true);

        // 2. POST transaction url must NOT have resource id
        const tamperedPostUrl: Bundle = {
          ...dataset.transactionBundle,
          entry: (dataset.transactionBundle.entry ?? []).map((e, idx) =>
            idx === 0 && e.request?.method === 'POST'
              ? { ...e, request: { ...e.request, url: `${e.resource?.resourceType}/${e.resource?.id}` } }
              : e
          ),
        };
        const reportPostUrl = validateFhirDataset({ ...dataset, transactionBundle: tamperedPostUrl });
        const bundleRulePostUrl = reportPostUrl.rules.find((r) => r.ruleId === 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3')!;
        expect(bundleRulePostUrl.passed).toBe(false);
        expect(bundleRulePostUrl.issues.some((i) => i.message.includes('POST transaction harus memakai URL type-level'))).toBe(true);

        // 3. PUT transaction url must include ResourceType/id
        const tamperedPutUrl: Bundle = {
          ...dataset.transactionBundle,
          entry: (dataset.transactionBundle.entry ?? []).map((e) =>
            e.request?.method === 'PUT'
              ? { ...e, request: { ...e.request, url: e.resource?.resourceType ?? '' } }
              : e
          ),
        };
        const reportPutUrl = validateFhirDataset({ ...dataset, transactionBundle: tamperedPutUrl });
        const bundleRulePutUrl = reportPutUrl.rules.find((r) => r.ruleId === 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3')!;
        expect(bundleRulePutUrl.passed).toBe(false);
        expect(bundleRulePutUrl.issues.some((i) => i.message.includes('PUT transaction harus memuat ResourceType/id'))).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // 7.4 SQL-on-FHIR 27 Analytic Tables Flattening & raw_fhir Integrity
    // -----------------------------------------------------------------------
    describe('7.4 SQL-on-FHIR 27 Analytic Tables Flattening & raw_fhir Integrity', () => {
      it('SQL_ON_FHIR_VIEW_DEFINITIONS covers exactly 27 analytical views aligning with TABLE_METADATA', () => {
        expect(SQL_ON_FHIR_VIEW_DEFINITIONS).toHaveLength(27);
        expect(SQL_ON_FHIR_PROJECTIONS).toHaveLength(27);
        expect(PORTABLE_VIEW_DEFINITIONS).toHaveLength(27);

        const expectedTables = TABLE_METADATA.filter((t) => t.kind === 'table').map((t) => t.tableName);
        expect(expectedTables).toHaveLength(27);

        const viewTargetTables = SQL_ON_FHIR_VIEW_DEFINITIONS.map((v) => v.targetTable);
        for (const targetTable of expectedTables) {
          expect(viewTargetTables).toContain(targetTable);
        }

        // Validate projection status classifications
        const implementedProjections = SQL_ON_FHIR_PROJECTIONS.filter((p) => p.implementationStatus === 'implemented');
        const partialProjections = SQL_ON_FHIR_PROJECTIONS.filter((p) => p.implementationStatus === 'partial');
        const notAssessedProjections = SQL_ON_FHIR_PROJECTIONS.filter((p) => p.implementationStatus === 'not-assessed');

        expect(implementedProjections.length).toBeGreaterThan(0);
        expect(partialProjections.length).toBeGreaterThan(0);
        expect(notAssessedProjections.length).toBeGreaterThan(0);
        expect(implementedProjections.length + partialProjections.length + notAssessedProjections.length).toBe(27);

        // Claim item projection policy
        const claimItemProj = SQL_ON_FHIR_PROJECTIONS.find((p) => p.targetTable === 'fhir_claim_item');
        expect(claimItemProj?.sourcePolicy).toBe('claim-item');
      });

      it('flattenDatasetWithSqlOnFhir populates all 27 tables with non-null raw_fhir and valid metadata across all 3 hospitals', () => {
        for (const seed of SIMRS_HOSPITAL_SEEDS) {
          const dataset = normalizeSimrsToFhir(seed);
          const flattened = flattenDatasetWithSqlOnFhir(dataset);

          expect(flattened.hospitalId).toBe(seed.id);
          const tableNames = Object.keys(flattened.tables);
          expect(tableNames).toHaveLength(27);

          for (const tableName of tableNames) {
            const rows = flattened.tables[tableName];
            expect(rows).toBeDefined();
            expect(rows.length).toBeGreaterThan(0);

            for (const row of rows) {
              expect(row.hospital_id).toBe(seed.id);
              expect(row.implementation_status).toBeTruthy();
              expect(row.source_table).toBeTruthy();
              expect(row.source_key).toBeTruthy();
              expect(typeof row.raw_fhir).toBe('string');
              expect((row.raw_fhir as string).length).toBeGreaterThan(2);

              // Must parse cleanly back to JSON
              const parsed = JSON.parse(row.raw_fhir as string);
              expect(typeof parsed).toBe('object');
              expect(parsed).not.toBeNull();
              expect(parsed.resourceType).toBeTruthy();
            }
          }
        }
      });

      it('raw_fhir stability guarantees complete round-trip JSON serialization without corruption or loss', () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);
        const flattened = flattenDatasetWithSqlOnFhir(dataset);

        // 1. Detail table fhir_claim_item preserves full parent Claim JSON
        const claimItemRows = flattened.tables.fhir_claim_item;
        expect(claimItemRows).toHaveLength(3);
        for (const itemRow of claimItemRows) {
          const parentClaimJson = JSON.parse(itemRow.raw_fhir as string) as Claim;
          expect(parentClaimJson.resourceType).toBe('Claim');
          expect(parentClaimJson.id).toBe(dataset.claim.id);
          expect(parentClaimJson.item).toHaveLength(3);
          expect(parentClaimJson.total?.value).toBe(dataset.claim.total?.value);
        }

        // 2. Patient raw_fhir preserves identifiers and demographics
        const patientRow = flattened.tables.fhir_patient[0];
        const parsedPatient = JSON.parse(patientRow.raw_fhir as string) as Patient;
        expect(parsedPatient.resourceType).toBe('Patient');
        expect(parsedPatient.id).toBe(dataset.patient.id);
        expect(parsedPatient.name[0].text).toBe(dataset.patient.name[0].text);
        expect(parsedPatient.identifier).toEqual(dataset.patient.identifier);

        // 3. Calculated columns integrity
        const chargeRows = flattened.tables.fhir_charge_item;
        for (const chargeRow of chargeRows) {
          const qty = Number(chargeRow.quantity_value);
          const total = Number(chargeRow.total_price_value);
          const unit = Number(chargeRow.unit_price_value);
          if (qty > 0) {
            expect(unit).toBeCloseTo(total / qty, 2);
          }
        }

        const eobRow = flattened.tables.fhir_explanation_of_benefit[0];
        const benefit = Number(eobRow.total_benefit_value);
        const submitted = Number(eobRow.total_submitted_value);
        const variance = Number(eobRow.variance_value);
        expect(variance).toBeCloseTo(benefit - submitted, 2);
      });
    });

    // -----------------------------------------------------------------------
    // 7.5 PGlite Transactional Patient Merge & Multi-Resource Reference Rewriting
    // -----------------------------------------------------------------------
    describe('7.5 PGlite Transactional Patient Merge & Multi-Resource Reference Rewriting', () => {
      it('resolveAndMergeDuplicatePatient rewrites all patient references across all clinical and financial resources', async () => {
        const seed = SIMRS_HOSPITAL_SEEDS.find((s) => s.id === 'rsia-bunda-bandung')!;
        const dataset = normalizeSimrsToFhir(seed);

        // Create a synthetic dataset where multiple resources explicitly point to duplicate patient
        const dupId = 'pat-temp-igd-003';
        const masterId = dataset.patient.id;

        const syntheticEncounter: Encounter = {
          ...dataset.encounter,
          subject: { reference: `Patient/${dupId}` },
        };
        const syntheticObs: Observation = {
          ...dataset.observations[0],
          subject: { reference: `Patient/${dupId}` },
        };

        const syntheticDataset: NormalizedHospitalDataset = {
          ...dataset,
          encounter: syntheticEncounter,
          observations: [syntheticObs, ...dataset.observations.slice(1)],
          allResources: dataset.allResources.map((r) => {
            if (r.id === syntheticEncounter.id) return syntheticEncounter;
            if (r.id === syntheticObs.id) return syntheticObs;
            return r;
          }),
        };

        const { updatedDataset, mergedPatient } = await resolveAndMergeDuplicatePatient(
          pgliteDb,
          syntheticDataset,
          dupId,
          masterId
        );

        // Master patient has replaces link
        expect(mergedPatient.link?.some((l) => l.type === 'replaces' && l.other.reference === `Patient/${dupId}`)).toBe(true);

        // Duplicate patient is deactivated and has replaced-by link
        expect(updatedDataset.duplicateEmergencyPatient?.active).toBe(false);
        expect(
          updatedDataset.duplicateEmergencyPatient?.link?.some(
            (l) => l.type === 'replaced-by' && l.other.reference === `Patient/${masterId}`
          )
        ).toBe(true);

        // Multi-resource reference rewriting in memory
        const rewrittenEncounter = updatedDataset.allResources.find((r) => r.id === syntheticEncounter.id) as Encounter;
        expect(rewrittenEncounter.subject.reference).toBe(`Patient/${masterId}`);

        const rewrittenObs = updatedDataset.allResources.find((r) => r.id === syntheticObs.id) as Observation;
        expect(rewrittenObs.subject?.reference).toBe(`Patient/${masterId}`);
      });

      it('PGlite database reflects transactional patient merge with replaced_by_patient_id and updated raw_fhir', async () => {
        const queryRes = await executeSqlQuery(
          pgliteDb,
          "SELECT id, replaced_by_patient_id, active, raw_fhir->>'active' AS raw_active, raw_fhir->'link' AS raw_link FROM fhir_patient WHERE id = 'pat-temp-igd-003';"
        );
        expect(queryRes.error).toBeUndefined();
        expect(queryRes.rowCount).toBe(1);

        const row = queryRes.rows[0];
        expect(row.replaced_by_patient_id).toBe('patient-rsia-bunda-bandung');
        expect(row.active).toBe(false);
        expect(row.raw_active).toBe('false');

        const rawLink = row.raw_link as Array<{ type: string; other: { reference: string } }>;
        expect(rawLink.some((l) => l.type === 'replaced-by' && l.other.reference === 'Patient/patient-rsia-bunda-bandung')).toBe(true);
      });

      it('resolveAndMergeDuplicatePatient strictly enforces duplicate !== master and resource existence', async () => {
        const seed = SIMRS_HOSPITAL_SEEDS[0];
        const dataset = normalizeSimrsToFhir(seed);

        // Same ID for duplicate and master
        await expect(
          resolveAndMergeDuplicatePatient(pgliteDb, dataset, dataset.patient.id, dataset.patient.id)
        ).rejects.toThrow('Duplikat dan pasien master tidak boleh memiliki ID yang sama.');

        // Non-existent duplicate ID
        await expect(
          resolveAndMergeDuplicatePatient(pgliteDb, dataset, 'non-existent-dup-id', dataset.patient.id)
        ).rejects.toThrow('Pasien duplikat atau pasien master tidak ditemukan.');
      });
    });

    // -----------------------------------------------------------------------
    // 7.6 Zustand Store: Invalid SQL Preview vs Last-Valid SQL Snapshot Separation
    // -----------------------------------------------------------------------
    describe('7.6 Zustand Store: Invalid SQL Preview vs Last-Valid SQL Snapshot Separation', () => {
      it('deriveDatasetState cleanly separates invalidFlattenedPreview while preserving lastValidFlattenedResult on invalid overrides', async () => {
        const store = useFhirStore.getState();
        await store.initializeLab();
        store.selectHospital('rsud-soetomo-surabaya');

        // Baseline: valid state
        const baselineState = useFhirStore.getState();
        expect(baselineState.validationReport?.valid).toBe(true);
        expect(baselineState.invalidFlattenedPreview).toBeNull();
        expect(baselineState.lastValidFlattenedResult).not.toBeNull();
        const validSnapshot = baselineState.lastValidFlattenedResult;

        // Apply invalid clinical/financial override
        await store.updateOverrides({ injectFinancialMismatch: true });
        const invalidState = useFhirStore.getState();

        expect(invalidState.validationReport?.valid).toBe(false);
        // invalidFlattenedPreview contains the preview with mismatch
        expect(invalidState.invalidFlattenedPreview).not.toBeNull();
        expect(invalidState.invalidFlattenedPreview?.hospitalId).toBe('rsud-soetomo-surabaya');
        // lastValidFlattenedResult retains previous valid snapshot without corruption
        expect(invalidState.lastValidFlattenedResult).toBe(validSnapshot);

        // Reset overrides back to valid state
        await store.resetHospitalOverrides();
        const recoveredState = useFhirStore.getState();

        expect(recoveredState.validationReport?.valid).toBe(true);
        expect(recoveredState.invalidFlattenedPreview).toBeNull();
        expect(recoveredState.lastValidFlattenedResult).not.toBeNull();
      });

      it('runSqlQuery cleanly preserves lastValidSqlQueryResult when executing invalid queries and captures invalidSqlQueryResult', async () => {
        const store = useFhirStore.getState();
        await store.initializeLab();

        // 1. Run a valid query
        await store.runSqlQuery('SELECT count(*) AS total_orgs FROM fhir_organization;');
        const validState1 = useFhirStore.getState();

        expect(validState1.sqlQueryResult?.error).toBeUndefined();
        expect(validState1.invalidSqlQueryResult).toBeNull();
        expect(validState1.lastValidSqlQueryResult).not.toBeNull();
        expect(Number(validState1.lastValidSqlQueryResult?.rows[0]?.total_orgs)).toBe(6);

        // 2. Run an invalid query with syntax error / non-existent table
        await store.runSqlQuery('SELECT non_existent_column_xyz FROM non_existent_table_abc;');
        const invalidState = useFhirStore.getState();

        expect(invalidState.sqlQueryResult?.error).toBeDefined();
        expect(invalidState.invalidSqlQueryResult).not.toBeNull();
        expect(invalidState.invalidSqlQueryResult?.error).toContain('does not exist');

        // CRITICAL: lastValidSqlQueryResult must NOT be wiped or replaced with error result!
        expect(invalidState.lastValidSqlQueryResult).not.toBeNull();
        expect(invalidState.lastValidSqlQueryResult?.error).toBeUndefined();
        expect(Number(invalidState.lastValidSqlQueryResult?.rows[0]?.total_orgs)).toBe(6);

        // 3. Run another valid query
        await store.runSqlQuery('SELECT count(*) AS total_patients FROM fhir_patient;');
        const validState2 = useFhirStore.getState();

        expect(validState2.sqlQueryResult?.error).toBeUndefined();
        expect(validState2.invalidSqlQueryResult).toBeNull();
        expect(validState2.lastValidSqlQueryResult).not.toBeNull();
        expect(Number(validState2.lastValidSqlQueryResult?.rows[0]?.total_patients)).toBe(4);
      });

      it('runSqlQuery handles uninitialized DB gracefully by setting invalidSqlQueryResult', async () => {
        const store = useFhirStore.getState();
        const currentDb = store.db;

        try {
          // Temporarily set db to null to simulate uninitialized DB state
          useFhirStore.setState({ db: null });
          await store.runSqlQuery('SELECT 1;');

          const state = useFhirStore.getState();
          expect(state.invalidSqlQueryResult).not.toBeNull();
          expect(state.invalidSqlQueryResult?.error).toBe('PGlite belum terinisialisasi.');
          expect(state.isExecutingSql).toBe(false);
        } finally {
          // Restore DB
          useFhirStore.setState({ db: currentDb });
        }
      });
    });
  });
});
