# Arsitektur Teknis & Spesifikasi Stack

Dokumen ini adalah aturan implementasi teknis kanonikal untuk **Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox**. Kontrak detail, acceptance matrix, dan work package terdapat di `docs/spec.md`.

## 1. Stack dan batas runtime

- Runtime/package manager: Bun 1.4+; dev command host-only (`bun run dev`), tanpa Docker.
- Build: Vite 6.x; UI: React 18.3.x + TypeScript 5.x strict.
- UI: Tailwind 3.4.x, PostCSS, Lucide React 0.475.x, `@xyflow/react` 12.4.x.
- Database: `@electric-sql/pglite` 0.2.x, PostgreSQL 16 WASM di browser.
- State: Zustand 5.x; tests: Bun Test.
- Baseline model: HL7 FHIR R4 4.0.1. Projection: SQL-on-FHIR 2.0.0 dengan FHIRPath model R4.

Version pin, package provenance, R4 snapshots, terminology evidence, and hashes are recorded by the contracts work package; version range alone is not conformance evidence.

## 2. Canonical module boundaries

1. **Source adapters — `src/data/simrs-normalization-seeds.ts`**
   - Menyediakan tiga seed hospital dan field provenance eksplisit (source table/key, encounter, patient, billing, medication, order, eligibility, timestamp).
   - Tidak boleh memilih payer/medication/order dari city atau default tersembunyi.
2. **R4 contracts/conformance — `src/types/fhir-global.ts`, `src/data/fhir-r4-conformance.ts`**
   - Public boundary untuk complete R4 datatypes/backbones, choices, Bundle, contained CoverageEligibilityRequest, normalized profile, ViewDefinition, projection, catalog, and assessment reports.
   - Memisahkan `Resource` dan `DomainResource`; tidak membuat schema FHIR kedua yang parsial.
3. **Reference graph — `src/lib/fhir-references.ts`**
   - Typed builder, `(resourceType,id)`/fullUrl index, owner-scoped contained resolver, duplicate/cycle detection, and Reference-only rewrite. Tidak melakukan HTTP atau mutation.
4. **Normalizer — `src/lib/fhir-normalizer.ts`**
   - Pure source-to-graph mapping; precedence `explicit override > mapped raw > documented fixture value`; no clinical defaulting. Membuat 26 types, Bundle envelope, and contained eligibility request.
5. **Validator — `src/lib/fhir-validator.ts`**
   - Validasi `coreR4`, `lab-r4`, dan national assessment; enam application rule groups; malformed `unknown` menghasilkan localized issues, bukan throw/assume-valid.
6. **SQL-on-FHIR — `src/lib/sql-on-fhir-flattener.ts`**
   - R4-aware FHIRPath adapter and SOF-2 runner. ViewDefinition portable; target table/status/source policy berada di local ProjectionDefinition. Menjaga key, union/cross-join, scalar cardinality, collection, null, source identity and raw JSON.
7. **PGlite — `src/lib/pglite-db.ts`**
   - Versioned idempotent migrations, exactly 27 projected tables and 3 views, parameterized writes, schema parity, atomic all-hospital snapshot, last-valid gate, and merge transaction.
8. **Store/UI — `src/store/`, `src/components/`, `src/App.tsx`**
   - Orchestrates one graph revision, assessment state, invalid preview vs last-valid SQL snapshot, Bundle/contained inspection, and evidence labels. UI cannot fabricate a second clinical representation.

## 3. End-to-end data flow

`SimrsHospitalSeed` → source-key preserving adapter → normalized R4 graph → reference index → three-layer assessment (`coreR4`, `lab-r4`, national) → SOF-2 ViewDefinition evaluation → typed flattened rows + raw provenance → PGlite transaction/migration → analytical views → Zustand/UI inspectors.

An invalid educational mutation may remain visible in JSON and validator panels, but MUST NOT replace the last valid PGlite snapshot. DB sync is not an HTTP FHIR transaction server and a PGlite COMMIT is not national API submission.

## 4. Canonical inventories

### 4.1 FHIR graph

The graph contains exactly these 26 concrete top-level types: `Organization`, `Patient`, `Practitioner`, `Location`, `EpisodeOfCare`, `ServiceRequest`, `Encounter`, `Consent`, `Provenance`, `Condition`, `Procedure`, `Observation`, `DiagnosticReport`, `Medication`, `MedicationRequest`, `MedicationDispense`, `Composition`, `Appointment`, `Coverage`, `CoverageEligibilityResponse`, `Account`, `ChargeItem`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit`, and `MeasureReport`.

`Bundle` is a transaction/inspection envelope and has no analytical table. `CoverageEligibilityRequest` is a fully modeled contained resource only (`CoverageEligibilityResponse.contained[0]`, local id `eligibility-request`, response request `#eligibility-request`); it is not a 27th top-level projection.

### 4.2 Tables/views

There are 27 tables: one for each type above plus `fhir_claim_item` (Claim.item projection). Every row has correct resource-source `raw_fhir` JSONB and source scope. Canonical views are `vw_fhir_clinical_diagnosis_recap`, `vw_fhir_financial_claim_recap`, and `vw_fhir_clinical_to_claim_audit`. No legacy view names or aliases are accepted in new code/docs.

## 5. Interface contracts

```ts
type FhirResource = SupportedTopLevelResource | Bundle | CoverageEligibilityRequest;
type NormalizedResource<T extends FhirResource> = T & { id: string };

type NormalizedHospitalDataset = {
  hospitalId: string;
  resources: readonly SupportedTopLevelResource[];
  transactionBundle: Bundle;
  contained: readonly CoverageEligibilityRequest[];
  graphRevision: string;
  sourceMap: SourceIdentityMap;
};

function normalizeSimrsToFhir(
  seed: SimrsHospitalSeed,
  overrides?: SandboxClinicalFinancialOverrides,
): NormalizedHospitalDataset;

function buildReferenceIndex(
  resources: readonly FhirResource[], bundle?: Bundle,
): ReferenceIndex;

function resolveReference(
  reference: Reference, owner: FhirResource, index: ReferenceIndex,
  expectedTypes?: readonly string[],
): ReferenceResolution;

function validateFhirDataset(
  dataset: NormalizedHospitalDataset,
  options?: { profile: 'lab-r4'; nationalProfile?: string },
): ValidationReport;

function evaluateFhirPath(
  resource: unknown, expression: string, rootResource?: unknown,
  context?: EvaluationContext,
): unknown[];

function evaluateViewDefinition(
  view: ViewDefinition, resources: readonly FhirResource[],
  context?: EvaluationContext,
): Record<string, SqlValue>[];

function flattenDatasetWithSqlOnFhir(
  dataset: NormalizedHospitalDataset,
): FlattenedDatasetResult;

function initPgliteDatabase(existingInstance?: PGlite): Promise<PGlite>;
function syncDatasetsToPglite(
  db: PGlite, datasets: readonly NormalizedHospitalDataset[],
): Promise<void>;

function resolveAndMergeDuplicatePatient(
  db: PGlite | null, dataset: NormalizedHospitalDataset,
  duplicatePatientId: string, targetMasterPatientId: string,
): Promise<{ updatedDataset: NormalizedHospitalDataset; mergedPatient: Patient }>;
```

Required discriminated results: `ReferenceResolution = resolved | external | logical | unresolved | invalid`; `SqlValue = string | number | boolean | null | readonly SqlScalar[]`; `ValidationReport` has core/lab/national assessment status (`pass|fail|not-assessed`) and source-bearing issues. Exact decimal arithmetic, FHIR temporal lexemes, and false/zero values must be preserved.

## 6. Validator rule groups

The six stable IDs are application report groups, not official HL7 rules:

1. Mandatory/cardinality/choice/primitive and nested R4 shape.
2. Observation `obs-3`, `obs-6`, `obs-7`; BP panel restrictions belong to `lab-r4`.
3. Composition recursive `cmp-1` and `cmp-2`, narrative and nested sections.
4. Reference graph, typed target, owner scope, patient/encounter evidence profile.
5. Local financial reconciliation (ChargeItem total override, Claim line net, adjudication, currencies, added benefit); never universal HL7 invariant.
6. Bundle invariants and supported HTTP payload contract (`bdl-3` request presence, identity, fullUrl, context); never reject client entry order merely for ordering.

Issues distinguish `HL7_R4`, `SATUSEHAT`, `LAB_POLICY`, and `PROJECTION`. Unavailable terminology/profile evidence is `not-assessed`, never pass.

## 7. SQL-on-FHIR runner invariants

- Sibling selects are Cartesian products at root and nested levels; `forEach` empty suppresses rows; `forEachOrNull` emits a complete descendant-null schema.
- Union branches have identical ordered names/types and retain parent/sibling context; mismatch is a typed error.
- Scalar cardinality is empty→null, singleton→scalar, multiple→error unless `collection=true`; no silent `[0]`.
- `getResourceKey()` and typed/untyped `getReferenceKey()` resolve to the same table-scoped key; target type remains separate for polymorphic references.
- `ofType(dateTime)` does not coerce Period; Quantity is model-typed. Unsupported syntax/function is diagnostic, not empty/default.
- No `requiredDefaults`, no private `splitType`, and no non-standard `+` string coercion in portable ViewDefinitions.

## 8. PGlite and security invariants

Migrations are versioned/idempotent and preserve user SQL content. TEXT stores legal FHIR identifiers/URIs/narratives/references; NUMERIC stores decimals and SimpleQuantity values; raw temporal lexemes accompany nullable derived instants/dates. Identifier uniqueness is scoped only when the domain guarantees it; patient replacement FK is deferrable and cycle checks are domain-level. All inserts use an internal projection registry and reject unexpected/missing source keys. Same-type identity collisions across datasets are explicit errors; same id across different resource types is legal.

## 9. UI/layout integration

At `xl` (1280px), preserve the three-panel layout specified in `layout.md`: 248/280px curriculum, flexible sandbox, 360/400px inspector. Left shows 12 lessons and 35 catalog entries; center shows raw→FHIR→SQL graph and invalid simulation; right shows FHIR/Bundle/contained JSON, SQL console/views, and sourced validation issues. Counts are derived from registries. Use accessible focus, local overflow, text-safe JSON, and evidence-qualified status labels; never show generic “DATASET CONFORMANT” for an unqualified assessment.
