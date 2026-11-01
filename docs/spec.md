# Global FHIR Normalization Learning Lab — Implementation Specification

**Status:** implementation contract for the complete application, Phases 1–6.  
**Audience:** the coder implementing the entire product, not just the core engines.  
**Interface language:** Bahasa Indonesia; code identifiers and technical contracts: English.  
**Scope:** browser-only, synthetic-data educational lab. No real patient data, production clinical decision support, SATUSEHAT submission, payer integration, authentication service, or backend is implied.

## 1. Authority, scope, and explicit decisions

### 1.1 Inputs and precedence

Read and preserve both workspace plans:

- `01_master_plan_architecture_and_fhir_normalization.md`: five normalization laws, resource matrix, ten conformance requirements, mappings, Claim example, and separate Claim header/item ViewDefinitions.
- `02_data_schema_curriculum_and_ai_agent_prompt.md`: complete base DDL, three analytical views, twelve modules, and six validator identifiers.

This document resolves their ambiguities and specifies all missing executable contracts. Normative published FHIR definitions take precedence over erroneous claims about a standard; the requested educational restrictions remain explicit **lab-profile** requirements. The three adoption badges describe the source plans' teaching baseline, **not a current government certification or automatically verified regulatory claim**. Display that qualification in the mental model and badge help.

### 1.2 Fixed technology contract

- Bun dependency manager, scripts, and unit-test runner; committed Bun lockfile.
- Vite; React **18**; TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; ES2022; ESM; DOM and worker types separated.
- Tailwind CSS **3.4** through PostCSS; `lucide-react`; system font stack; no external font dependency.
- Zustand with selector subscriptions; no second application state framework.
- `@electric-sql/pglite`, instantiated in a dedicated module Web Worker; PostgreSQL syntax, not SQLite or simulated query results.
- `@xyflow/react` with React 18-compatible pinned release; import its shipped CSS.
- `@types/fhir` for R4 compile-time resource types; runtime validation remains independent.
- `decimal.js` for exact monetary calculations; never use binary floating-point summation for reconciliation.
- Test-only: Bun test, Testing Library React/DOM, happy-dom, Playwright, axe-core Playwright integration. Vite's React plugin must be React-18 compatible.
- Pin resolved dependency versions and commit `bun.lock`; do not use unbounded latest tags. One package, no monorepo or microservices.

### 1.3 FHIR release and honest conformance

Clinical/financial payloads use **FHIR R4 4.0.1**, because the plans require R4 `Encounter.class`, `Encounter.hospitalization`, `Coverage.payor`, `ChargeItem.priceOverride`, and medication choice structures. Never mix R5 fields into R4 resources. Teach R5 differences in explanatory content; importing an explicitly R5 dataset fails with an actionable version message, not silent reinterpretation. SQL-on-FHIR **v2.0.0** ViewDefinition is a separate logical model and can project R4 resources. Do not validate ViewDefinition as an R4 clinical Resource.

The native runner implements the capability surface specified in §6, not the entire FHIRPath language or every optional external runner feature. Unsupported expressions must fail explicitly. Show this capability statement in the ViewDefinition inspector and downloadable metadata. The six-rule engine is a lab conformance/evidence validator, **not** an accredited full HL7 validator or a complete terminology server.

Normative distinctions that implementation and lessons must preserve:

| Topic | Published R4 meaning | Required lab behavior |
|---|---|---|
| `Claim.total` | `0..1 Money` | Read `total.value`, never `total[].amount`. A draft can omit it; financial reconciliation then reports an incomplete lab claim. |
| ClaimResponse/EOB `total` | `0..*` category/amount backbones | Extract submitted/benefit by coding system **and** code; missing category is NULL, not zero. |
| `obs-7` | Root value prohibited when root code matches a component code | Also prohibit root `value[x]` for lab multi-component panels, especially BP `85354-9`; require systolic/diastolic UCUM components. Distinguish invariant and profile diagnostics. |
| `cmp-1` | A section has text, entry, or a nested section | Lab sections have entries, text, or emptyReason. An emptyReason selection must generate explanatory XHTML text as well, satisfying both contracts; never claim emptyReason alone satisfies R4 cmp-1. Apply cmp-2 too. |
| `bdl-3` | Request present for transaction/batch/history, prohibited otherwise | Transaction entries additionally require a lab `fullUrl`, valid method/URL, reference resolution, atomicity, and execution ordering. |
| Transaction ordering | Input order does not control outcome; DELETE, POST, PUT/PATCH, GET/HEAD processing phases | Support DELETE → POST → PUT → GET. Preserve request order in response entries and display execution order separately. Reject unsupported PATCH/HEAD/conditional operations explicitly; they are not invalid FHIR in general. |
| Mandatory fields | R4 cardinality is often less restrictive than the plans | Run both R4 structural checks and named lab-profile checks, with `origin` in every diagnostic. Do not mislabel additional lab requirements as global cardinalities. |

Published references used for these decisions:

- https://hl7.org/fhir/R4/observation-definitions.html (`obs-7`, choice elements).
- https://hl7.org/fhir/R4/composition.html#invs (`cmp-1`, `cmp-2`).
- https://hl7.org/fhir/R4/bundle.html#invs (`bdl-3`, `bdl-4`, fullUrl rules).
- https://hl7.org/fhir/R4/http.html#transaction (atomicity, execution order, UUID resolution, response order).
- https://sql-on-fhir.org/ig/2.0.0/StructureDefinition-ViewDefinition.html (keys, selection cross-products, unnesting).
- Both source plans' official HL7, OHS fhir-data-pipes, and SATUSEHAT links remain accessible in the curriculum. The browser does not invoke Java/Beam fhir-data-pipes; it runs the native compatible projection layer.

### 1.4 Complete resource coverage without inventing extra tables

The live registry supports every resource in the plans: Resource/DataTypes/Extension teaching; Bundle; CodeSystem, ValueSet, ConceptMap, Consent, Provenance; Patient, Practitioner, Organization, Location, HealthcareService, EpisodeOfCare, Encounter, Device; Condition, Procedure, Observation, DiagnosticReport, Specimen, ImagingStudy, Medication, MedicationRequest, MedicationDispense, AllergyIntolerance, Composition; ServiceRequest, Appointment, Schedule, Slot, Task; Coverage, CoverageEligibilityRequest, CoverageEligibilityResponse, Account, ChargeItem, Claim, ClaimResponse, ExplanationOfBenefit; PlanDefinition, GuidanceResponse, Measure, MeasureReport.

`Resource` and `Extension` are base/datatype teaching objects, not fake standalone clinical records. All actual concrete types above have typed registry access, offline metadata, validation, valid fixtures, reference graph visibility, JSON inspection, and curriculum exercises. Twenty-six resource types map to the twenty-seven SQL tables (Claim maps to two). Types without a named table remain durable in the canonical resource registry, not dropped and not represented by a 28th table. `Encounter.diagnosis[]` has a selectable diagnostic ViewDefinition preview but **no additional persisted PostgreSQL table or fourth SQL analytical view**.

## 2. Architecture and dependency direction

### 2.1 Layers

```text
React components → Zustand actions/selectors → LabController → WorkerClient
                                                         ⇅ typed messages
WorkerRuntime → DatasetRepository + Command pipeline → pure domain engines
                                      ↓
                          native ViewDefinition runner → PGlite projection
                                      ↓
                         three real PostgreSQL analytical views
```

- `src/types`: contracts only; no runtime imports of React, Zustand, DB, or engines.
- `src/domain`: terminology, profile definitions, resource/reference/evidence logic. Pure deterministic functions; no DOM, database, worker messages, storage, or UI imports.
- `src/lib`: pure engines and infrastructure adapters separated by file. Pure engines depend on types/domain, not UI. Database modules depend on contracts and runner, not Zustand.
- `src/data`: declarative resources, hospital profiles, curriculum, mappings, examples, and pinned offline FHIR metadata. No side effects or hidden DB initialization.
- `src/workers`: sole owner of canonical live dataset, mutation serialization, PGlite, and durable repository.
- `src/app`: composition root and orchestration bridge; no FHIR business rules in React callbacks.
- `src/store`: serializable presentation snapshots and commands; no PGlite/Worker/Map/Decimal/ReactFlow instance in store.
- `src/components`: render props or narrow store selectors, dispatch typed commands. Never import PGlite or implement normalization, financial, or FHIRPath rules.

Do not add barrel re-export files merely to hide ownership. Imports name their actual owner. Avoid cyclic imports: domain rules must not import validator, and validator must not import transaction processor. They share planning and profile helpers.

### 2.2 Authoritative data and derived data

The worker's immutable `DatasetSnapshot` is the canonical committed FHIR resource collection. Its durable copy is one IndexedDB dataset record. PGlite is an **in-memory, rebuildable projection**, so there is no cross-database claim of physical ACID. Raw JSON columns are copies of the authoritative committed resource, not independent editable documents. Zustand holds the current synchronized UI snapshot, draft resource/editor state, and inspection selections.

A revision number identifies each dataset version. Every normalization/command/validation/graph/table/SQL response carries `revision` and `requestId`. SQL-only requests do not increment the dataset revision. Late responses never overwrite newer revisions, changed scenario drafts, or superseded queries. Query results remain labeled with their source revision until rerun.

### 2.3 End-to-end flows

1. Boot: create one worker → open IndexedDB → load dataset or synthetic seed → initialize in-memory PGlite → apply DDL → project registry in one DB transaction → validate and compute summary → publish ready. A failed DB load is shown as failure; never switch to fake data/query results.
2. Edit raw SIMRS: keep invalid JSON as local editor text; only valid typed source documents can enter normalization. Preview normalization is pure and does not change committed tables. Show source-to-target mapping trace and unresolved terminology.
3. Commit normalized preview: worker validates source revision, computes candidate registry and all six-rule report, rejects structural/reference/DB-projection blockers, atomically persists/projects candidate as §8. Invalid educational financial/evidence content can remain inspectable when structurally projectable; report stays red. SQL tables always correspond exactly to the committed revision.
4. Edit evidence: dispatch an explicit `EvidenceCommand`; worker derives candidate changes to the correct FHIR paths, recalculates validation and projection, commits once. The graph and inspectors update from the same resulting snapshot.
5. Apply transaction: preflight + ID reservation + reference rewrite + ordered execution + candidate validation + commit; failed request leaves registry and SQL unchanged, returning an OperationOutcome.
6. Merge patients: explicit chosen survivor → plan links and affected references → validate → commit through the same mutation path. No heuristic automatic NIK merge.
7. Run SQL: real worker query on the committed PGlite revision, read-only and timeout bounded. Output is actual PostgreSQL rows/types/errors, not precomputed lesson answers.
8. Mission evaluation: evaluate typed facts from acknowledged operations and live data. Checking a checkbox does not grant success when an objective requires an engine result.

## 3. Shared TypeScript contracts

The declarations below are public contracts, not implementation code. Each owner file in §12 must export the named declarations. Prefer readonly arrays/records for snapshots; worker-local indexes may use Maps. JSON external input is `unknown` until decoded.

### 3.1 Core domain types — `src/types/fhir.ts`, `common.ts`

```ts
import type * as R4 from 'fhir/r4';
export type Resource = R4.Resource; // actual R4 discriminated union
export type ResourceType = Resource['resourceType'];
export type ResourceOf<T extends ResourceType> = Extract<Resource, { resourceType: T }>;
export type ResourceKey = `${ResourceType}/${string}`;
export type ImplementationStatus =
  | 'IMPLEMENTED_SATUSEHAT' | 'PARTIAL_NATIONAL' | 'PIONEER_GLOBAL_FHIR';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type Revision = number;
export interface LabError {
  code: 'INPUT' | 'FHIR_VERSION' | 'NORMALIZATION' | 'FHIRPATH_PARSE'
    | 'FHIRPATH_UNSUPPORTED' | 'FHIRPATH_CARDINALITY' | 'VIEW_SCHEMA'
    | 'REFERENCE' | 'CONFLICT' | 'TRANSACTION' | 'DB_INIT' | 'DB_SYNC'
    | 'PERSISTENCE' | 'SQL' | 'SQL_TIMEOUT' | 'WORKER';
  messageId: string; detail?: string; path?: string; resourceKey?: ResourceKey;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: LabError };
export interface ResourceEnvelope {
  resource: Resource; source: SourceLocator | null;
  implementationStatus: ImplementationStatus;
}
export interface DatasetSnapshot {
  schemaVersion: 1; fhirVersion: '4.0.1'; datasetId: string;
  revision: Revision; resources: readonly ResourceEnvelope[];
}
export interface SourceLocator {
  hospitalId: string; entity: string; sourceId: string; sourcePath: string;
}
export interface Clock { now(): string }
export interface IdFactory { nextId(type: ResourceType): string; nextUuid(): string }
```

Resources in a committed dataset have valid FHIR logical IDs `[A-Za-z0-9\-.]{1,64}` and unique `(resourceType,id)`. A registry never keys by bare id: Patient/123 and Claim/123 can coexist. Business identifiers are not technical primary keys. No `undefined`, NaN, Infinity, prototype-bearing objects, or comments in exported FHIR JSON. Metadata/adoption badges/Indonesian annotations stay outside FHIR payloads. `JsonValue` and R4 values may cross JSON serialization only through explicit codecs, not unsafe universal casts.

### 3.2 Registry, references, and profiles — `src/types/registry.ts`

```ts
export interface RegistryReader {
  get<T extends ResourceType>(type: T, id: string): ResourceOf<T> | undefined;
  getByKey(key: ResourceKey): Resource | undefined;
  list<T extends ResourceType>(type: T): readonly ResourceOf<T>[];
  all(): readonly Resource[];
}
export interface ReferenceResolution {
  kind: 'resolved' | 'missing' | 'external' | 'contained' | 'invalid';
  key?: ResourceKey; resource?: Resource; diagnostic?: string;
}
export interface ReferenceContext {
  registry: RegistryReader; baseUrl: string;
  fullUrlToKey: ReadonlyMap<string, ResourceKey>; owner?: Resource;
}
export interface ResourceProfile {
  resourceType: ResourceType; implementationStatus: ImplementationStatus;
  referencePaths: readonly ReferencePathDefinition[];
  constraints: readonly ElementConstraint[];
}
export interface ReferencePathDefinition {
  path: string; targets: readonly ResourceType[] | 'Any';
  relation: 'identity' | 'administration' | 'clinical' | 'workflow' | 'financial' | 'evidence';
}
export interface ElementConstraint {
  path: string; min: number; max: number | '*'; types: readonly string[];
  origin: 'HL7_R4' | 'LAB_PROFILE'; binding?: { system: string; codes: readonly string[] };
}
```

Paths here use an explicit metadata walker notation (`item[].encounter[]`, choices declared in metadata), not invented regex-based FHIRPath. Every reference walker, merger, graph builder, and validator consumes this same metadata, including nested extensions of type Reference and contained resource ownership. Absolute URLs are internal only when the configured lab base matches, or a Bundle fullUrl explicitly maps them. Never collapse `https://other.example/Patient/1` into local Patient/1. No network dereferencing.

### 3.3 Normalization contracts — `src/types/normalization.ts`

```ts
export type HospitalId = 'rs-a' | 'rs-b' | 'rs-c';
export interface SimrsDocument {
  hospitalId: HospitalId; version: 1;
  entities: Readonly<Record<string, readonly Readonly<Record<string, JsonValue>>[]>>;
}
export interface HospitalProfile {
  id: HospitalId; label: string; timezone: 'Asia/Jakarta';
  organizationId: string; identifierNamespaces: Readonly<Record<string, string>>;
  entities: readonly EntityMapping[];
}
export interface EntityMapping {
  sourceEntity: string; sourceIdField: string; resourceType: ResourceType;
  fields: readonly FieldMapping[];
}
export interface FieldMapping {
  sourcePath: string; targetPath: string;
  transform: 'identity' | 'identifier' | 'code' | 'quantity' | 'money'
    | 'reference' | 'date' | 'datetime' | 'blood-pressure' | 'diagnosis-role';
  dictionary?: string; required: boolean;
}
export interface NormalizationIssue {
  severity: 'error' | 'warning'; code: string; source: SourceLocator;
  targetPath?: string; messageId: string;
}
export interface MappingTrace {
  source: SourceLocator; resourceKey: ResourceKey; targetPath: string;
  law: 1 | 2 | 3 | 4 | 5; transform: FieldMapping['transform'];
}
export interface NormalizationResult {
  baseRevision: Revision; resources: readonly ResourceEnvelope[];
  issues: readonly NormalizationIssue[]; trace: readonly MappingTrace[];
  canCommit: boolean;
}
export interface NormalizationContext {
  baseRevision: Revision; registry: RegistryReader; profile: HospitalProfile;
  terminology: TerminologyCatalog; clock: Clock;
}
```

Raw document entity/field names are adapter-specific, declared in the profile; arbitrary unknown entities are reported, not silently discarded. Normalization result resources replace that source scenario's owned records by stable source identity; they must not delete other hospitals' records or manually created unrelated resources.

### 3.4 Validator contract — `src/types/validation.ts`

```ts
export type ValidationRuleId =
  | 'FHIR_STD_01_MANDATORY_CARDINALITY'
  | 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7'
  | 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1'
  | 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN'
  | 'FHIR_STD_05_FINANCIAL_RECONCILIATION'
  | 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3';
export interface ValidationIssue {
  id: string; ruleId: ValidationRuleId; severity: 'error' | 'warning' | 'information';
  origin: 'HL7_R4' | 'LAB_PROFILE'; resourceKey?: ResourceKey;
  path: string; invariant?: string; messageId: string;
  related: readonly { resourceKey: ResourceKey; path: string }[];
  blocksProjection: boolean;
}
export interface RuleResult {
  ruleId: ValidationRuleId; status: 'pass' | 'fail' | 'not-applicable';
  checked: number; issues: readonly ValidationIssue[];
}
export interface ValidationReport {
  revision: Revision; rules: readonly RuleResult[];
  valid: boolean; projectionAllowed: boolean;
}
export interface ValidationContext {
  revision: Revision; registry: RegistryReader; references: ReferenceContext;
  profiles: ReadonlyMap<ResourceType, ResourceProfile>;
  transaction?: R4.Bundle; transactionPlan?: TransactionPlan;
}
export type ValidationRule = (context: ValidationContext) => RuleResult;
```

Always return all six entries in declared order; not-applicable is not pass. IDs are stable from `(ruleId,key,path,diagnosticCode)`. Issues use zero-based array paths and Indonesian message IDs. No rule mutates or auto-fixes its input.

### 3.5 Projection contracts — `src/types/sql-on-fhir.ts`, `database.ts`

```ts
export type ColumnType = 'string' | 'boolean' | 'integer' | 'decimal'
  | 'date' | 'dateTime' | 'instant' | 'id' | 'code' | 'uri';
export interface ViewColumn {
  name: string; path: string; type: ColumnType; collection?: boolean;
}
export interface ViewSelect {
  forEach?: string; forEachOrNull?: string;
  column?: readonly ViewColumn[]; select?: readonly ViewSelect[];
  unionAll?: readonly ViewSelect[];
}
export interface ViewDefinition {
  resourceType: 'ViewDefinition'; name: string; resource: ResourceType;
  status: 'draft' | 'active' | 'retired'; fhirVersion?: readonly ['4.0.1'];
  constant?: readonly { name: string; valueString?: string; valueBoolean?: boolean;
    valueInteger?: number; valueDecimal?: number }[];
  where?: readonly { path: string }[]; select: readonly ViewSelect[];
}
export type SqlScalar = string | number | boolean | null;
export type FlatRow = Readonly<Record<string, SqlScalar | readonly SqlScalar[]>>;
export interface FlatResult { columns: readonly ViewColumn[]; rows: readonly FlatRow[] }
export interface EvaluationContext {
  root: Resource; focus: readonly FhirPathValue[]; references: ReferenceContext;
  constants: Readonly<Record<string, FhirPathValue>>;
}
export interface FhirPathValue { value: JsonValue; fhirType: string; ownerKey?: ResourceKey }
export interface TableDefinition {
  name: TableName; resourceType: ResourceType; viewName: string;
  columns: readonly SqlColumnDefinition[]; primaryKey: readonly string[];
}
export interface SqlColumnDefinition {
  name: string; sqlType: string; nullable: boolean;
  derived?: 'raw-resource' | 'status' | 'claim-item-key' | 'charge-total'
    | 'variance' | 'encounter-diagnosis' | 'referenced-display' | 'row-count';
}
export interface ProjectionBatch {
  revision: Revision; tables: Readonly<Record<TableName, readonly FlatRow[]>>;
}
export interface QueryResult {
  revision: Revision; columns: readonly { name: string; dataTypeId: number }[];
  rows: readonly Readonly<Record<string, JsonValue>>[];
  rowCount: number; truncated: boolean; elapsedMs: number;
}
export interface ProjectionSummary {
  revision: Revision; counts: Readonly<Record<TableName, number>>;
  views: readonly { name: AnalyticalViewName; rowCount: number }[];
}
```

`TableName` is the exact union of 27 names in §8. `AnalyticalViewName` is the exact three-name union there. `decimal` transport values may be canonical decimal strings, retaining precision; SQL parameters consume these strings directly. FHIR JSON still has numeric decimal values and rejects unsafe input precision at decode rather than losing digits. PostgreSQL NUMERIC and bigint/count results are displayed as strings when needed; do not coerce them all with Number(). No JS Date crosses worker messages.

### 3.6 Commands, Bundle, merge, graph — `src/types/commands.ts`

```ts
export type EvidenceCommand =
  | { kind: 'set-encounter-diagnosis'; encounter: ResourceKey; condition: ResourceKey;
      use: 'AD' | 'DD' | 'CC' | 'CM'; rank: number }
  | { kind: 'link-claim-diagnosis'; claim: ResourceKey; condition: ResourceKey;
      sequence: number; role: 'principal' | 'admitting' | 'comorbidity' | 'discharge' }
  | { kind: 'link-claim-procedure'; claim: ResourceKey; procedure: ResourceKey; sequence: number }
  | { kind: 'link-claim-support'; claim: ResourceKey; target: ResourceKey;
      sequence: number; categoryCode: string }
  | { kind: 'set-item-evidence'; claim: ResourceKey; itemSequence: number;
      diagnosisSequences: readonly number[]; procedureSequences: readonly number[];
      informationSequences: readonly number[]; encounter: ResourceKey }
  | { kind: 'set-charge-support'; charge: ResourceKey; target: ResourceKey }
  | { kind: 'remove-evidence'; owner: ResourceKey; path: string; index: number };
export interface TransactionPlan {
  entries: readonly PlannedEntry[];
  executionOrder: readonly number[];
  fullUrlToKey: ReadonlyMap<string, ResourceKey>;
}
export interface PlannedEntry {
  requestIndex: number; method: 'DELETE' | 'POST' | 'PUT' | 'GET';
  url: string; key: ResourceKey; resource?: Resource;
}
export type TransactionResult =
  | { ok: true; candidate: DatasetSnapshot; response: R4.Bundle;
      executionOrder: readonly number[]; changedKeys: readonly ResourceKey[] }
  | { ok: false; outcome: R4.OperationOutcome; status: number };
export interface PatientMergeRequest {
  survivor: ResourceKey; duplicate: ResourceKey; baseRevision: Revision;
  decisions: readonly { path: string; take: 'survivor' | 'duplicate' }[];
}
export interface PatientMergePlan {
  survivor: ResourceOf<'Patient'>; duplicate: ResourceOf<'Patient'>;
  replacements: readonly Resource[];
  conflicts: readonly { path: string; survivor: JsonValue; duplicate: JsonValue }[];
  changedKeys: readonly ResourceKey[];
}
export interface GraphNodeData {
  resourceKey: ResourceKey; title: string; resourceType: ResourceType;
  implementationStatus: ImplementationStatus; issueCount: number;
}
export interface GraphEdgeData {
  owner: ResourceKey; path: string; target: ResourceKey | null;
  reference: string; relation: ReferencePathDefinition['relation']; resolved: boolean;
}
```

UI graph adapters convert domain graph data into ReactFlow Node/Edge types. ReactFlow must not become the domain graph model. Arbitrary dragging a line cannot invent a FHIR field: only edges corresponding to a supported EvidenceCommand are editable, through a typed dialog.

## 4. Normalization algorithm

Public owner: `src/lib/normalizer.ts`:

```ts
export function decodeSimrs(input: unknown, profile: HospitalProfile): Result<SimrsDocument>;
export function normalizeSimrs(document: SimrsDocument,
  context: NormalizationContext): NormalizationResult;
```

### 4.1 Synthetic multi-hospital input contract

Provide three materially different schemas, each with the complete same clinical-to-financial scenario, not three renamed copies of one Patient:

| Canonical entity | RS-A entity/id and fields | RS-B entity/id and fields | RS-C entity/id and fields |
|---|---|---|---|
| Patient | `pasien/no_rm`: `nik,nama,jk,tgl_lahir` | `patients/patient_code`: `national_id,display_name,sex,dob` | `person/person_key`: `identities,demography` nested object |
| Encounter | `kunjungan/no_reg`: `no_rm,kelas,masuk,pulang,dokter,kamar` | `visits/visit_id`: `patient_code,visit_type,started_at,ended_at,clinician,ward` | `care_event/event_key`: `person_key,care_class,period,participants,location_key` |
| Diagnosis | `diagnosa/id`: `no_reg,kode,peran,urut` | `diagnoses/id`: `visit_id,icd10,role,rank` | `problem/key`: `event_key,concept,context_role,priority` |
| Observation | `hasil/id`: `no_reg,kode_lokal,hasil,satuan` | `results/id`: `visit_id,test_code,numeric_value,unit,bp_text` | `measurement/key`: `event_key,concept,value,components` |
| Procedure | `tindakan/id`: `no_reg,kode,waktu` | `procedures/id`: `visit_id,procedure_code,performed_at` | `intervention/key`: `event_key,concept,performed` |
| Financial detail | `biaya/id`: `no_reg,jenis,kode,jumlah,tarif,bukti_id` | `charges/id`: `visit_id,category,service_code,qty,unit_price,evidence_id` | `ledger_line/key`: `event_key,concept,quantity,money,evidence` |
| Claim | `klaim/no_klaim`: `no_reg,no_peserta,total` | `claims/claim_no`: `visit_id,member_id,submitted` | `submission/key`: `event_key,coverage_key,amount` |

`profiles.ts` must additionally declare explicit fields for organizations/payors/practitioners/locations/episodes, medications/orders/dispenses, reports, discharge summary, coverage/eligibility, account, adjudication/EOB, provenance/consent, scheduling, and quality data in each schema; corresponding fixtures and field mapping rows are part of the deliverable. Reuse the declarative canonical field catalog rather than three separate business-rule implementations. Profiles define entity cardinality, source keys, cross-entity references, local MRN namespace, date formats, currency format, code dictionaries, and null/blank handling. Export three `HospitalProfile`s plus `CANONICAL_FIELD_CATALOG`, whose target paths are the R4 paths listed throughout this specification and the base plan. Unknown codes cannot be assigned a fabricated standard meaning.

### 4.2 Processing order and invariants

1. Decode shape, known fields, primitives, local references, ID uniqueness. Preserve identifiers as strings, including leading zeros. Blank required fields produce precise source errors.
2. First pass assigns deterministic logical IDs from `(hospitalId,resourceType,sourceEntity,sourceId)` using a fixed UUID-v5-style namespace hash or deterministic SHA-256 truncation to 32 hex characters, prefixed with the hospital ID. Use Web Crypto and make the public normalizer asynchronous **only if** Web Crypto is chosen; preferred contract is synchronous deterministic non-cryptographic stable encoding with collision detection. Exact implementation decision: encode source identity as UTF-8, use a deterministic bundled SHA-256 pure utility, take 32 hex characters, prefix `rs-a-`/`rs-b-`/`rs-c-`. Export `sourceIdentityToId(locator,type): string`; no randomness or current time in IDs. Detect collisions across distinct source identities and reject them. Manual POST uses IdFactory instead.
3. Apply law 1: map NIK/IHS/MRN/member/claim identifiers with declared namespace URIs. Deduplicate exact `(system,value)` only; do not merge across hospital MRNs. Administrative address extension is `https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode`, nested province/city/district/village/rt/rw, `valueCode` strings.
4. Apply law 2: resolve local codes through the pinned catalog. Emit standard `(system,code,display)`; retain a real local coding only under the hospital's local CodeSystem URI. An unmapped required standard code is a blocking normalization issue; don't substitute `unknown`, use a random SNOMED code, or fuzzy-match clinical text silently. Concepts can carry several genuine codings.
5. Apply law 3: parse numbers with the adapter's explicit locale rules (e.g. RS-A `1.250.000,50`, RS-B `1250000.50`), reject ambiguous input not covered by that profile. Use decimal arithmetic. Parse `120/80` into LOINC BP `85354-9` components `8480-6` and `8462-4`, UCUM system `http://unitsofmeasure.org`, code `mm[Hg]`, no root value. Single numeric values become valueQuantity; coded/text results use exactly one appropriate `value[x]`. Money is `{value,currency:'IDR'}`, never bare currency-formatted text. SimpleQuantity has no comparator. Validate safe precision before conversion to FHIR decimal JSON numbers.
6. Date-only values remain date-only. Local datetimes require the profile's Jakarta zone and convert to ISO instants with a declared offset; no browser locale parsing or fabricated current timestamps. `Clock` may supply creation metadata only for commands that truly create an event. Preserve explicit absent/unknown dates.
7. Apply law 4: resolve source FKs through first-pass identity index into typed Reference objects. Build parents/children in memory without reliance on file row order. Missing mandatory references block commit. Preserve encounter diagnosis use/rank exclusively on `Encounter.diagnosis[]`; never invent `Condition.diagnosisRank` fields. Medication request/dispense link to the Medication resource; dispense links to authorizingPrescription. Charge supports clinical evidence; Claim sequence arrays refer to its own diagnosis/procedure/supportingInfo sequence values.
8. Build Composition's five lab sections (diagnoses, procedures, results, discharge medications, follow-up). Section code uses declared LOINC mappings. No content: use valid emptyReason plus generated narrative; do not fabricate a clinical entry.
9. Claim header has single Money total; each item requires sequence, productOrService, category, encounter and net under lab profile. ClaimResponse/EOB use totals with adjudication Coding system and amount Money. AddItem net and adjudication benefits are not conflated.
10. Produce envelopes, trace, and issues. No partial successful batch is committed while normalization contains errors. Repeated normalization of unchanged input yields the same clinical payload and IDs; no default current timestamp churn.
11. Law 5 occurs in the projection pipeline, not a second hard-coded normalizer SQL serializer. Every non-derived SQL column must be produced by a visible ViewDefinition path.

Implement a small bundled stable SHA-256 utility only for deterministic identity if no package is chosen; ownership `src/domain/identity.ts`. It is not used for authentication or security. The coder may instead use a pinned synchronous SHA-256 package and expose the same function; there must be one deterministic algorithm with fixed fixtures, never two platform-dependent IDs.

## 5. Six-rule conformance and evidence validator

Public `src/lib/fhir-validator.ts`:

```ts
export const VALIDATION_RULE_ORDER: readonly ValidationRuleId[];
export function validateDataset(context: ValidationContext): ValidationReport;
export function toOperationOutcome(report: ValidationReport): R4.OperationOutcome;
```

Run all applicable rules without short-circuiting the whole report. Broken shape in a resource produces rule-1 issues and prevents unsafe traversal of that branch; other resources/rules still run. Validate references against the entire candidate snapshot, not the pre-mutation snapshot. Distinguish editable invalid clinical/evidence content from projection blockers: malformed primitive/cardinality/choice data, required SQL column absence, dangling internal required relational FK, and impossible table keys block projection; financial discrepancies and broken claim evidence can be saved for an exercise with a failing report when SQL-projectable.

### 5.1 Rule 01 — mandatory cardinality, datatypes, lab profile

`rules/mandatory.ts` exports `validateMandatory: ValidationRule`.

Use offline R4 StructureDefinition-derived element metadata for **all supported resource types and nested backbones**, not just a handful of root properties. Respect inherited Resource/DomainResource elements, datatype fields, polymorphic choices, array min/max, positiveInt, boolean `false`, numeric `0`, date/dateTime precision, Coding system/code, identifier system/value lab requirements, and required bound status/use codes. A false value or zero is present, not absent. Recognize primitive extension-only `_field` values for R4 structural validation; a lab-required concrete value still needs a value. R4 `ele-1`/choice contradictions are reported here; no silent cast of array to object.

Offline metadata is a checked-in compact derivative of `hl7.fhir.r4.core@4.0.1` StructureDefinition snapshots, with source package/version/license attribution in JSON. It includes supported types' inherited elements, choices, bindings needed by seeded scenarios, reference targets, and conditional cardinality predicates used by these profiles. Do not label checking only `typeof` as mandatory validation. The complete external HL7 invariant/terminology suite remains outside this six-rule engine.

Required lab overlay, in addition to all normative 1..1/1..* metadata:

| Resource | Lab-required data / special nested constraints |
|---|---|
| Organization | name, identifier system/value, active, type; administrative code when in scenario |
| Patient | identifier namespace/value, name.text, gender, managingOrganization; address extensions if present |
| Practitioner / Location / EpisodeOfCare | name and practitioner identity; location managingOrganization; episode status, patient, managingOrganization |
| Encounter | status, class v3-ActCode, subject Patient, serviceProvider, period.start; diagnosis condition/use/rank when a diagnosis exists; unique positive rank per role within encounter |
| Consent / Provenance | consent status/scope/category/patient; provenance target[], recorded, agent[].who; no fake top-level patient on Provenance |
| ServiceRequest / Appointment | request status/intent/code/subject; appointment status and participant actor/status; real Schedule/Slot links when scheduling scenario applies |
| Condition | clinicalStatus, verificationStatus, category, code, subject, encounter; official condition status systems |
| Procedure | status, code, subject, encounter; performedDateTime or performedPeriod, not both |
| Observation | status/category/code/subject/encounter/performer[]; code LOINC and UCUM numeric units in supplied scenarios |
| DiagnosticReport | status/category/code/subject/encounter/result[], all referenced results exist |
| Medication | code KFA or declared international coding; NC/EP uses the documented extension URL, not a new root field |
| MedicationRequest | status/intent/medicationReference/subject/encounter/requester |
| MedicationDispense | status/medicationReference/subject/context/authorizingPrescription[], SimpleQuantity quantity/daysSupply |
| Composition | status/type/subject/encounter/date/author[]/title/section[]; five sections for discharge-summary lesson |
| Coverage | status/subscriberId/beneficiary/payor[]/type/class[]; class type/value |
| CoverageEligibilityRequest | status/purpose[]/patient/created/insurer (plus R4 nested minimums) |
| CoverageEligibilityResponse | status/purpose[]/patient/created/insurer/outcome plus R4 mandatory `request`; insurance[].coverage required for lab response (the source plan omits normative request) |
| Account | status, subject[] Patient, owner Organization |
| ChargeItem | status/code/subject/context/account[]/quantity/priceOverride/supportingInformation[]; Money IDR |
| Claim | status/type/use/patient/created/provider/priority/insurance[]; insurance sequence/focal/coverage; positive unique diagnosis/procedure/supportingInfo/item sequences; item productOrService/category/encounter[]/net; financial lesson additionally expects total |
| ClaimResponse | seven root fields status/type/use/patient/created/insurer/outcome; request; if total exists every entry has category/amount |
| ExplanationOfBenefit | eight root fields status/type/use/patient/created/insurer/provider/outcome, plus insurance[] with focal/coverage; total backbones category/amount |
| Measure / MeasureReport | Measure canonical URL and named numerator/denominator definitions for lesson; report status/type/measure/period, group.population codes/count and measureScore; reporter for SQL projection |
| Remaining matrix types | all normative root/nested minimums from metadata, plus scenario requirements declared in `lab-profiles.ts`; include valid HealthcareService, Device, Specimen, ImagingStudy, AllergyIntolerance, Schedule, Slot, Task, CodeSystem, ValueSet, ConceptMap, PlanDefinition, GuidanceResponse fixtures |

Use real R4 statuses including valid entered-in-error variants where supported. Source DDL comments are examples, not exhaustive value sets. R4 Coverage also allows entered-in-error; never reject a valid core code solely because a source comment abbreviated it. No national profile conformance badge is granted merely for having a NIK.

### 5.2 Rule 02 — Observation `obs-7` and lab panels

`rules/observation.ts` exports `validateObservation: ValidationRule`.

- Find actual choice keys from metadata, not every property whose name starts with `value`.
- Normative obs-7: if a root Coding `(system,code)` matches a component Coding and root value exists, report `origin: HL7_R4`, invariant `obs-7`.
- Lab panel profile: when component[] is used as a multi-component panel, reject every root value[x]. For BP root LOINC 85354-9 require one systolic 8480-6 and one diastolic 8462-4; each numeric valueQuantity UCUM mm[Hg]. Duplicated/missing/wrong-unit component is an explicit issue.
- Missing measurement can be represented with allowed dataAbsentReason in advanced exercises, but never fabricated as zero; BP completion mission requires both actual values.

### 5.3 Rule 03 — Composition `cmp-1`/`cmp-2`

`rules/composition.ts` exports `validateComposition: ValidationRule`.

Recursively visit all nested sections. Normative cmp-1 requires meaningful narrative, nonempty entry[], or nonempty subsections; cmp-2 prohibits emptyReason together with entries. Lab leaves require at least entries, narrative, or a valid emptyReason. EmptyReason-only input gets a normative failure; the normalizer/editor's intentional empty-state action emits emptyReason **and** generated narrative. Narrative has status and valid XHTML div namespace, rendered as escaped code unless explicitly sanitized. Whitespace/empty arrays/empty objects are not educational content. Report invalid references to section entries with a resource/path link.

### 5.4 Rule 04 — clinical-to-financial evidence

`rules/evidence.ts` exports `validateEvidence: ValidationRule`; reuse `buildEvidenceIndex` from domain.

For each claim:

1. Resolve patient and every item's encounter[], reject missing/mixed patient and, for this lab's per-encounter claim, more than one distinct encounter. One-encounter is a lab constraint, not universal FHIR.
2. Resolve every diagnosisReference to Condition, procedureReference to Procedure, and supportingInfo.valueReference to Observation/Composition/ServiceRequest. ServiceRequest is allowed by the master plan even though the second plan's summary omits it. Require evidence subject/patient to resolve to the same canonical patient and its encounter/context to the claim encounter. ServiceRequest has no encounter in R4: require Encounter.basedOn to reference that ServiceRequest and its subject to match. Do not invent ServiceRequest.encounter.
3. Every item diagnosisSequence/procedureSequence/informationSequence value must resolve uniquely in its respective parent array. Positive unique parent sequences are required; no use of zero-based array position as FHIR sequence.
4. A rank-1 discharge diagnosis on Encounter must align with a principal Claim diagnosis for the complete discharge scenario. Non-principal sequences may point to AD/DD/CM as taught; roles are not blindly inferred from array order.
5. ChargeItem supports Procedure/Observation/MedicationDispense in this lab; resolve all supportingInformation, same patient and encounter/context; dispense context and authorizing prescription must resolve correctly.
6. Composition status final, valid sections, and referenced evidence are completeness requirements for a completed-claim mission; preliminary is a lab warning unless the mission explicitly requires final. No medical efficacy judgment is made.

Return every broken link and exact path. Graph uses the same reference/evidence indexes, not another truth source.

### 5.5 Rule 05 — financial reconciliation

`rules/financial.ts` exports `validateFinancial: ValidationRule`; money utility exports exact `parseDecimal`, `sumMoney`, `compareMoney`, `multiplyMoney` and `formatIdr`.

For each per-encounter claim:

- Require nonempty total Money for reconciliation, each item net Money, all relevant ChargeItem priceOverride and claim amounts in IDR. Missing amounts report incomplete; do not pass with zero. A valid optional omission is marked LAB_PROFILE, not a fictitious HL7 minimum.
- Sum `Claim.item[].net.value` and compare exactly to Claim.total.value. Claim net is authoritative; item `quantity * unitPrice` can have factor/tax behavior in general FHIR. Lab items with no adjustment/factor must match their declared arithmetic; do not recompute arbitrary external net.
- Charge total = quantity.value × priceOverride.value for each billable/billed charge in that encounter and selected account, excluding planned/aborted/entered-in-error records. Lab claim owns one account's complete encounter ledger. Sum charges equals claim total; claims for a different account must not be mixed. Scope is derived from the scenario's declared account and encounter evidence, not patient alone.
- ClaimResponse/EOB `submitted` and `benefit` amounts are extracted by adjudication system/code, currencies consistent; duplicate categories are ambiguous and fail the lab profile. Submitted equals claim total. Benefit may legitimately be lower/higher; variance = benefit − submitted, not a reconciliation error by itself. A partial outcome with an explanation is valid and teachable.
- `ClaimResponse.addItem[].net` is separately summed for analytical display. Never add it again to total benefit, which is already the payer's total.
- EOB claim/claimResponse/coverage relationships must agree and its submitted/benefit correspond to the selected response. No fake automatic insurer decisions, CBG grouping, or BPJS price computation.
- Decimal operations have no epsilon tolerance. The synthetic IDR datasets use at most two decimal places; reject out-of-range/unsafe precision on input. Do not use formatted currency strings in calculations.

### 5.6 Rule 06 — Bundle transaction `bdl-3`

`rules/bundle.ts` exports `validateBundle: ValidationRule`; `domain/transaction-plan.ts` owns shared preflight.

For transaction entries require request method/url, lab fullUrl, unique identity/fullUrl, POST/PUT resource body/type consistency, no GET/DELETE body, supported relative URL shape, and no unresolved transaction URNs. Expose planned method order DELETE → POST → PUT → GET; mixed input order is accepted. Response checks enforce `transaction-response`, one response per request in original order, correct status/location semantics (location mandatory in lab for writes; for GET/DELETE use the addressed resource location). The rule reports unsupported operations as lab capabilities, not globally forbidden FHIR operations. UUID syntax must be valid RFC-4122 v4 for newly generated lab URNs; imported unsupported URNs get a precise capability error. Non-transaction resources yield not-applicable. A recent transaction report belongs to its revision; do not claim a dataset with no Bundle passed transaction validation.

## 6. Native SQL-on-FHIR v2 runner and FHIRPath

### 6.1 Required public API

`src/lib/sql-on-fhir-flattener.ts` is the single public pure runner:

```ts
export function validateViewDefinition(input: unknown): Result<ViewDefinition>;
export function compileViewDefinition(view: ViewDefinition): Result<CompiledView>;
export function flattenResource(view: CompiledView, resource: Resource,
  references: ReferenceContext): Result<FlatResult>;
export function flattenResources(view: CompiledView, resources: readonly Resource[],
  references: ReferenceContext): Result<FlatResult>;
```

`src/lib/fhirpath/parser.ts` exports `tokenize`, `parseFhirPath`, `FhirPathAst`. `evaluator.ts` exports `evaluateFhirPath(ast,context): Result<readonly FhirPathValue[]>`. `functions.ts` exports `FHIRPATH_CAPABILITIES` and `applyFunction`. `choice.ts` exports `readChoice`. `select.ts` exports `evaluateSelect`. `compiler.ts` exports `CompiledView`, `compileColumns`. No JS `eval`, Function constructor, SQL execution for FHIRPath, regex string splitting on dots, or external FHIRPath runtime. Decimal points, quoted URI strings, parentheses, and nested predicates must tokenize correctly.

### 6.2 Supported grammar/capability surface

Implement a tokenizer and precedence parser with precise token offsets. Supported:

- Property navigation with automatic flattening of arrays; explicit `%resource`, `$this`, `%constantName`; optional resource-type root qualifier.
- String literals with escaped quotes, integer/decimal literals, true/false, empty collection `{}`, parentheses.
- Comparison `=`, `!=`, `<`, `<=`, `>`, `>=`; logical `not()`, `and`, `or`; addition/subtraction/multiplication/division of scalar numeric values needed by editable exercises; empty/invalid numeric operations produce a typed error, not NaN. Use FHIRPath three-valued empty/boolean behavior; predicate keeps only singleton true, not JavaScript truthiness.
- `.where(predicate)`, `.first()`, `.exists()` and `.exists(predicate)`, `.empty()`, `.count()`, `.ofType(Type)`; `.ofType(FHIR.Quantity)` and lower-case primitive names supported. `.getResourceKey()` at a resource focus; `.getReferenceKey('ResourceType')`, bare type-specifier form `.getReferenceKey(Patient)`, and polymorphic no-argument form.
- `getResourceKey()` root invocation; `.where(code.coding.exists(system='...' and code='...')).first()`; predicates may nest and include dots and string URLs.
- Choice access such as `value.ofType(Quantity)` reads `valueQuantity`, `performed.ofType(dateTime)` reads `performedDateTime`, `medication.ofType(Reference)` reads `medicationReference`; direct JSON property access remains supported. Type information comes from metadata, not guessed solely from JS `typeof`.
- ViewDefinition top-level `where[]` clauses are ANDed. Constants support exactly one of the declared value[x] fields. `select`, nested `select`, `forEach`, `forEachOrNull`, and `unionAll` are implemented with v2.0.0 semantics. No speculative 2.1 `repeat` support. Unknown keys/functions/operators fail capability validation with their path.

All evaluation values are collections, including singletons. `first()` on empty returns empty; scalar comparisons enforce required cardinality; where predicates evaluate relative to each candidate with `%resource` stable. Boolean `false` remains a value; exists(false) is true because a value exists. A missing path is empty, not an empty string or zero.

### 6.3 Key semantics

- `getResourceKey()` returns the current resource's logical id. Keys are table-scoped; registry keys remain type/id. Invoking it on an item backbone is invalid. In the Claim item ViewDefinition, evaluate the claim_id column on the parent resource **before** entering `forEach: 'item'`.
- Typed `getReferenceKey(T)` returns the referenced id when reference type matches T, otherwise empty. Relative literal `Patient/id` keys do not require the target to exist for syntactic key extraction; referential validation is separate. Unresolvable URNs/contained/external URLs return empty with inspection diagnostics, not a fake substring key.
- Polymorphic no-argument `getReferenceKey()` returns the same bare id as that resource's getResourceKey, **not type/id**. Preserve reference type in a separate column when needed: Provenance target type via reference parsing, ChargeItem supporting_info_ref as a canonical typed reference derived by the sync decorator. These strings are not a dishonest alternate key function.
- For an internal absolute URL, base matching is required; strip base and optional history only under declared resolver behavior. Versioned references retain their semantics in the registry and report unsupported historical resolution if unavailable. Never resolve an external reference by last path segment.
- Transaction URNs are resolved from a prebuilt fullUrl map before committing/projecting. A schema cannot receive `urn:uuid:` as a patient FK.

### 6.4 Selection algebra

For each matching resource:

1. Start with one empty row and root context. Apply top-level resource filters.
2. Each select chooses current focus (unchanged, forEach result items, or one null-focus sentinel for empty forEachOrNull). forEach empty produces zero rows; forEachOrNull empty produces one row with all local columns null.
3. Evaluate columns at that select focus. Scalar column: zero values → SQL NULL, one → validate/convert type, more than one → FHIRPATH_CARDINALITY. Never implicitly take the first. `collection:true` returns a homogeneous scalar array for preview and declared array columns only; no object coercion.
4. Recursively evaluate child selects per focus; parent columns repeat for child rows. Sibling select results cross join, including top-level siblings. A zero-row sibling empties the combined result. Keep deterministic input order for UI without claiming normative sort guarantees.
5. unionAll concatenates compatible nested branches. Branch column name/order/type/collection flags must agree. Combine union output with parent/local selections under the same documented cross-product rules.
6. Duplicate output column names fail compilation, including parent/child collisions. No overwriting map entries. forEach and forEachOrNull are mutually exclusive on a select. Empty invalid select, unsupported column type, malformed constant, or invalid SQL identifier fails validation.
7. Flatten result is data only; raw_fhir/status/derived relational columns are added by the projection decorator, not by extending FHIRPath with undocumented local functions.

Compile/cache ASTs per ViewDefinition content in the worker; edits invalidate only that compiled view. Bound expression depth 64, expression length 16 KiB, output rows per preview 10,000, and selection cross-product rows per resource 10,000; deterministic limit errors prevent lockup without changing semantics. Full sync enforces dataset size limits before commit and reports them; never truncate persisted projections silently.

### 6.5 Required mappings

Provide a canonical active ViewDefinition for every table, named `fhir_<suffix>_view` except `fhir_claim_header_view` and `fhir_claim_item_view`. Exactly 27 table projections. Also provide nonpersisted `fhir_encounter_diagnosis_view` with forEach diagnosis, parent encounter_id, condition_id, role system/code, rank. The latter powers teaching and diagnosis synchronization; not a PostgreSQL view/table.

Each ordinary non-derived column in §8 has a visible `column.path`; mapping file and table schema must agree exactly at startup. Correct required examples:

| Column | Path / rule |
|---|---|
| patient nik / ihs_number | `identifier.where(system='https://fhir.kemkes.go.id/id/nik').first().value` / equivalent ihs-number system |
| patient local_mrn | identifier filtered by owning hospital's declared MRN URI, not first identifier |
| patient managing org | `managingOrganization.getReferenceKey('Organization')` |
| encounter practitioner | `participant.individual.getReferenceKey('Practitioner').first()` |
| encounter diagnosis role/rank | nonpersisted diagnosis view + cross-resource sync, never Condition extensions |
| observation numeric/unit | `value.ofType(Quantity).value` / `.code` |
| systolic / diastolic | `component.where(code.coding.exists(system='http://loinc.org' and code='8480-6')).first().value.ofType(Quantity).value`, code 8462-4 for diastolic |
| procedure performed | `performed.ofType(dateTime)`; period stays in raw and explicit lesson explains scalar choice projection |
| medication request/dispense | `medication.ofType(Reference).getReferenceKey('Medication')` |
| dispense prescription | `authorizingPrescription.first().getReferenceKey('MedicationRequest')` |
| coverage plan | `class.where(type.coding.exists(system='http://terminology.hl7.org/CodeSystem/coverage-class' and code='plan')).first().value` |
| Claim total | `total.value`, `total.currency` |
| Claim coverage | `insurance.where(focal=true).first().coverage.getReferenceKey('Coverage')` |
| Claim composition | `supportingInfo.value.ofType(Reference).getReferenceKey('Composition').first()` |
| Claim principal package | select diagnosis where `type.coding.exists(system='http://terminology.hl7.org/CodeSystem/ex-diagnosistype' and code='principal')`, then first packageCode coding; do not assume principal always sequence 1 |
| ClaimResponse/EOB submitted | `total.where(category.coding.exists(system='http://terminology.hl7.org/CodeSystem/adjudication' and code='submitted')).first().amount.value` |
| ClaimResponse/EOB benefit | same category system, code benefit |
| MeasureReport numerator/denominator | group.first().population filtered by official measure-population code, first().count |

The Claim header outputs one row per Claim regardless of item count. Item view parent claim_id uses getResourceKey(), child `forEach:'item'` outputs sequence, encounter first typed key, category system/code/display, productOrService system/code/display, quantity.value, unitPrice.value, net.value/currency. Mandatory item fields are checked even if the projection path would return null. Item row id is decorated as `${claimId}-${sequence}`; enforce unique `(claim_id,sequence)`.

Edited mappings are explicit dataset settings, persisted with the dataset record and versioned separately from published curriculum definitions. A preview can be invalid without harming current tables. Apply mapping: compile all views, enforce exact target columns/types and cardinality, project full candidate, commit mapping+dataset revision atomically. Resource identity/FK/key columns cannot be remapped to incompatible types. Restoring canonical mapping is a deliberate command, not silent fallback after an error.

## 7. Bundle transactions and Patient.link merges

### 7.1 Bundle processor

`src/lib/bundle-transaction.ts` exports:

```ts
export function processTransaction(bundle: R4.Bundle, snapshot: DatasetSnapshot,
  context: { registry: RegistryReader; baseUrl: string; ids: IdFactory; clock: Clock }
): TransactionResult;
```

It is a pure candidate builder; persistence is owned by worker runtime. Shared `planTransaction(bundle,context): Result<TransactionPlan>` and `rewriteTransactionReferences(resource,map): Result<Resource>` live in `domain/transaction-plan.ts` and `domain/references.ts`.

Algorithm:

1. Accept only type transaction and supported request URLs: POST `ResourceType`; PUT/DELETE/GET `ResourceType/id`. Reject query strings, conditional create/update/delete, absolute request URLs, `_history` writes, patch, operations, batch execution, ifNoneExist/ifMatch features not implemented. The UI capability statement names these limits.
2. Validate all entry shapes/fullUrls/URL targets before modifying anything. POST/PUT require resource type matching URL; PUT id must match addressed id when present. POST assigns a new server-style id and ignores supplied logical id for identity assignment, while keeping original input unchanged.
3. Reserve every POST id **before** any resource reference traversal. Build fullUrl → type/id map for all create/update entries, validate uniqueness and target identities, include resources later in the input. GET/DELETE entries also carry lab fullUrl but cannot masquerade as create targets. Reject duplicate operations on the same identity rather than relying on arbitrary within-phase order.
4. Clone only changed resources. Traverse typed Reference nodes using shared metadata (including supported extension References). Replace matching urn:uuid and mapped fullUrls with reserved canonical relative type/id. Unknown URNs fail. Do not globally replace strings: identifier.value, narrative, canonical URLs, and plain text containing a UUID remain untouched. Contained `#id` references remain owner-scoped.
5. Stage changes on a candidate registry, running phases DELETE, POST, PUT, GET with stable request order inside each phase. GET reads the staged final post-write state. Deletion of a referenced record fails unless all surviving references are removed/repointed within the same transaction. Do not rely on SQL cascades to delete clinical resources implicitly.
6. PUT updates an existing record or creates a new record at the addressed valid ID, returning 200 OK or 201 Created. POST returns 201 Created. DELETE existing/absent returns 204 No Content (unless integrity blocks deletion). GET missing fails whole transaction with 404. Invalid body/unsupported capabilities → 400/422; conflicting identities/references → 409. IDs consumed by a failed transaction do not imply persisted resources.
7. Validate final candidate registry and projection viability. An intermediate forward reference must not fail merely because its POST has not executed yet. Circular non-invalid references are supported by preallocation and deferred final validation.
8. On any error return single OperationOutcome with original request entry paths; no partial transaction-response, no committed registry/table changes. On success return transaction-response with entries in **original request order**, each response status and lab location, and GET resource body as appropriate. Include separate executionOrder for teaching.
9. Worker commits candidate once (§8); only then publishes response/success. Persistence/projection failure is a failed operation with no false success. Response Bundle itself is an operation result, not automatically inserted as a clinical resource.

### 7.2 Patient merge helper

`src/lib/patient-merge.ts` exports:

```ts
export function planPatientMerge(request: PatientMergeRequest,
  registry: RegistryReader): Result<PatientMergePlan>;
export function applyPatientMergePlan(plan: PatientMergePlan,
  snapshot: DatasetSnapshot): Result<DatasetSnapshot>;
export function resolveCanonicalPatient(key: ResourceKey,
  registry: RegistryReader): Result<ResourceKey>;
```

- Requires two different existing Patient keys, selected survivor, base revision match, and no cycles in existing replaced-by graph. Reject conflicting verified NIK/IHS values until the user explicitly resolves the conflicting identity fields; never auto-merge by matching name or empty identifiers.
- Survivor gets a deduplicated `link[{other:duplicate,type:'replaces'}]`; duplicate gets `link[{other:survivor,type:'replaced-by'}]` and active false. Preserve existing valid refer/seealso links; they **do not** imply canonical identity equivalence. Do not delete duplicate Patient or reuse its id.
- Preserve and union identifiers by system/value; keep conflicting demographics visible for explicit decisions. Do not silently combine incompatible birth dates or overwrite national identifiers. No clinical fields are invented to make the match pass.
- `resolveCanonicalPatient` follows replaced-by only, with visited set, validates exactly one unambiguous target and no cycle/missing target. `replaces` is reciprocal information, not the traversal direction. Repeated identical merge is idempotent; merging into one's descendant fails.
- Repoint live patient References in all supported resources (subject/patient/beneficiary/subscriber/Account.subject/etc.) through metadata, including unprojected resources. Preserve Patient.link historical identity references; do not rewrite them into self-links. Do not rewrite business identifiers, arbitrary JSON strings, or non-Patient references with the same bare id.
- The helper returns a plan for preview of both patients and all rewrites. Commit through the common worker command; one revision, one projection transaction. `fhir_patient.replaced_by_patient_id` derives from link replaced-by, not a parallel mutable source. Existing episodes/encounters/financial chains project to survivor consistently.

## 8. PGlite schema, projections, and atomic synchronization

### 8.1 Schema source and exact table inventory

`src/lib/db/schema.sql` transcribes the **complete 27 CREATE TABLE statements** from Document 2 §1, preserving every listed column, length/type, raw payload and adoption metadata, subject only to the explicit corrections below. The inventory below is normative and makes missing-table/column mistakes reviewable. No placeholder tables. Common notation: `id` = VARCHAR(100) PK unless noted; `sN` = VARCHAR(N), `txt` = TEXT, `n` = NUMERIC, `i` = INTEGER, `b` = BOOLEAN, `ts` = TIMESTAMPTZ, `d` = DATE. `!` = NOT NULL. All columns not marked ! may be NULL. Column types/defaults/FKs remain as in the original DDL unless overridden here.

All 27 tables contain `implementation_status s40 !` with CHECK over the three exact status values, and `raw_fhir JSONB !`. Claim item raw_fhir stores its **item backbone**, with claim_id identifying its parent; all other tables store complete source resource JSON. Organization and Patient additionally retain their original updated_at ts. A timestamp is sync metadata and is not inserted into clinical payloads.

| # / table / Resource | Complete domain column inventory (in addition to shared fields) |
|---|---|
| 1 `fhir_organization` / Organization | id; identifier_system s255; identifier_value s100; active b; type_code s50; name s255!; address_province_code s20; address_city_code s20; updated_at ts |
| 2 `fhir_patient` / Patient | id; managing_organization_id s100; nik s50; ihs_number s100; local_mrn s100; full_name s255!; gender s20!; birth_date d; active b; citizenship_code s20; address_province_code s20; address_city_code s20; address_district_code s20; address_village_code s20; replaced_by_patient_id s100; updated_at ts |
| 3 `fhir_practitioner` / Practitioner | id; ihs_number s100; identifier_system s255; identifier_value s100; active b; full_name s255!; qualification_code s100 |
| 4 `fhir_location` / Location | id; managing_organization_id s100; identifier_value s100; status s30!; name s255!; mode_code s30; physical_type_code s50 |
| 5 `fhir_episode_of_care` / EpisodeOfCare | id; managing_organization_id s100; patient_id s100; status s40!; type_code s100; period_start ts; period_end ts |
| 6 `fhir_service_request` / ServiceRequest | id; patient_id s100; requester_practitioner_id s100; performer_organization_id s100; identifier_value s100; status s40!; intent s40!; category_code s100; priority_code s30; code_system s255; code_value s100; code_display txt; authored_on ts |
| 7 `fhir_encounter` / Encounter | id; service_provider_org_id s100; patient_id s100; practitioner_id s100; location_id s100; episode_of_care_id s100; based_on_service_request_id s100; identifier_system s255; identifier_value s100; status s40!; class_code s40!; service_type_code s100; discharge_disposition_code s50; period_start ts!; period_end ts |
| 8 `fhir_consent` / Consent | id; patient_id s100; organization_id s100; status s40!; scope_code s50!; category_code s100!; date_time ts |
| 9 `fhir_provenance` / Provenance | id; target_resource_type s50!; target_resource_id s100!; agent_practitioner_id s100; recorded_datetime ts!; activity_code s50; signature_type_code s50 |
| 10 `fhir_condition` / Condition | id; patient_id s100; encounter_id s100; clinical_status s40; verification_status s40; category_code s50; diagnosis_role_code s20; diagnosis_rank i; code_system s255!; code_value s50!; code_display txt!; recorded_date ts |
| 11 `fhir_procedure` / Procedure | id; patient_id s100; encounter_id s100; status s40!; category_code s50; code_system s255!; code_value s50!; code_display txt!; performed_datetime ts |
| 12 `fhir_observation` / Observation | id; patient_id s100; encounter_id s100; performer_practitioner_id s100; based_on_service_request_id s100; status s40!; category_code s50!; code_system s255!; code_value s50!; code_display txt; value_quantity n; value_unit s50; value_string txt; systolic_value n; diastolic_value n; effective_datetime ts |
| 13 `fhir_diagnostic_report` / DiagnosticReport | id; patient_id s100; encounter_id s100; based_on_service_request_id s100; primary_observation_id s100; status s40!; category_code s50!; code_system s255!; code_value s50!; code_display txt; conclusion txt; issued_datetime ts |
| 14 `fhir_medication` / Medication | id; code_system s255!; code_value s100!; code_display txt!; form_code s100; medication_type_code s20 |
| 15 `fhir_medication_request` / MedicationRequest | id; patient_id s100; encounter_id s100; requester_practitioner_id s100; medication_id s100; status s40!; intent s40!; category_code s50; dosage_text txt; authored_on ts |
| 16 `fhir_medication_dispense` / MedicationDispense | id; patient_id s100; encounter_id s100; medication_id s100; authorizing_prescription_id s100; status s40!; quantity_value n; quantity_unit s40; days_supply_value n; when_handed_over ts |
| 17 `fhir_composition` / Composition | id; patient_id s100; encounter_id s100; author_practitioner_id s100; status s40!; type_system s255; type_code s50; title s255!; section_count i; composition_date ts! |
| 18 `fhir_appointment` / Appointment | id; patient_id s100; practitioner_id s100; location_id s100; status s40!; service_category_code s100; start_datetime ts; end_datetime ts |
| 19 `fhir_coverage` / Coverage | id; patient_id s100; payor_organization_id s100; subscriber_id s100; status s40!; type_code s100; payor_display s255!; class_type_code s50; class_value s100 |
| 20 `fhir_coverage_eligibility_response` / CoverageEligibilityResponse | id; patient_id s100; insurer_organization_id s100; coverage_id s100; status s40!; outcome s30!; inforce b; disposition txt; created_datetime ts |
| 21 `fhir_account` / Account | id; service_provider_org_id s100; patient_id s100; status s40!; type_code s50; name s255 |
| 22 `fhir_charge_item` / ChargeItem | id; performing_organization_id s100; patient_id s100; encounter_id s100; account_id s100; status s40!; category_code s100; code_system s255!; code_value s100!; code_display s255!; quantity_value n; unit_price_value n!; total_price_value n!; currency s10; supporting_info_ref s150 |
| 23 `fhir_claim` / Claim | id; provider_organization_id s100; patient_id s100; encounter_id s100; coverage_id s100; composition_id s100; identifier_system s255; identifier_value s100; status s40!; type_code s50!; sub_type_code s50; use_code s40!; priority_code s30; diagnosis_package_system s255; diagnosis_package_code s100; diagnosis_package_display txt; total_value n; total_currency s10; created_datetime ts |
| 24 `fhir_claim_item` / Claim.item | id s120 PK; claim_id s100!; encounter_id s100!; sequence i!; category_system s255!; category_code s100!; category_display s255; product_or_service_system s255!; product_or_service_code s100!; product_or_service_display s255; quantity_value n; unit_price_value n; net_value n!; currency s10! |
| 25 `fhir_claim_response` / ClaimResponse | id; claim_id s100; patient_id s100; insurer_organization_id s100; status s40!; type_code s50!; use_code s40!; outcome s30!; disposition txt; total_submitted_value n; total_benefit_value n; add_item_benefit_value n; currency s10; process_note_text txt; created_datetime ts |
| 26 `fhir_explanation_of_benefit` / ExplanationOfBenefit | id; claim_id s100; claim_response_id s100; patient_id s100; provider_organization_id s100; insurer_organization_id s100; coverage_id s100; status s40!; type_code s50!; use_code s40!; outcome s30!; total_submitted_value n; total_benefit_value n; variance_value n; currency s10; created_datetime ts |
| 27 `fhir_measure_report` / MeasureReport | id; reporter_organization_id s100; measure_url s255!; measure_name s255!; status s40!; type_code s40!; period_start d!; period_end d!; numerator_count i; denominator_count i; measure_score_value n |

### 8.2 Explicit DDL corrections and integrity rules

1. Add raw_fhir to claim_item, as the plan's prose promises every table; implementation status is NOT NULL and CHECKed on every table.
2. Make Claim.total_value nullable, and ClaimResponse/EOB totals/variance nullable, matching 0..1/0..* semantics. Remove implicit financial/currency/default zero substitution when source is absent. Supplied synthetic completed scenarios contain totals. Missing totals are visible as NULL and lab diagnostics.
3. Remove UNIQUE from bare Organization.identifier_value; instead unique partial `(identifier_system,identifier_value)` when both present, as namespaces matter. Do not make Patient.nik or MRN globally unique: duplicates are a teaching scenario and MRN is hospital-local.
4. Remove UNIQUE from ClaimResponse.claim_id and EOB claim_id/claim_response_id: multiple adjudications are valid FHIR. Analytical views select the latest relevant non-entered-in-error response deterministically by `(created_datetime DESC NULLS LAST,id DESC)`, before aggregation. Do not multiply claim totals through 1:N joins.
5. Patient.replaced_by_patient_id is a DEFERRABLE INITIALLY DEFERRED self-FK, no self-reference. Diagnosis rank positive when nonnull; remove defaults DD/1 from fhir_condition: derive from actual Encounter diagnosis or NULL.
6. Change days_supply_value INTEGER to NUMERIC: SimpleQuantity can be fractional. Composition.section_count is computed, not default 5 when only 3 exist. Measure name comes from referenced Measure.title/name or canonical URL; no false human title. Charge total derived with decimal arithmetic; currency copied from source Money.
7. All original documented FKs retain their target and ON UPDATE CASCADE; use DEFERRABLE INITIALLY DEFERRED to tolerate valid circular/insertion dependencies. For full snapshot reprojection, defer constraints. Do not add a schema migration bookkeeping table: exactly 27 application tables; SQL version is tracked in the IndexedDB dataset metadata.
8. Retain source ON DELETE CASCADE/SET NULL definitions for projection mechanics, but **never expose direct write SQL**. Resource deletion is validated at canonical layer and reprojection must never silently cascade undeleted FHIR records. Registry and SQL raw payloads cannot disagree after a delete.
9. Add UNIQUE(claim_id,sequence), sequence > 0, nullable diagnosis_rank > 0, valid period ordering when endpoints exist, nonnegative lab quantities/amounts, obs panel projection root value NULL checks for the lab BP code. SQL CHECKs enforce structural projection invariants, not every clinical judgment. Credits/negative adjustments are outside these lab profiles and explicitly diagnosed, not silently clipped.
10. Add indexes on every FK and encounter/patient/code columns used by the three views. Preserve original lengths; valid logical id max 64 ensures composed claim-item id fits 120. No index on raw_fhir unless an actual exposed query requires it.

Optional source values remain nullable unless the relational lab schema explicitly requires them. Required relational columns imply a LAB_PROFILE projection constraint when core R4 allows omission. A source field never acquires a false clinical default from a DDL DEFAULT: sync explicitly inserts all declared values (including NULL), except updated_at.

### 8.3 Foreign key targets and scalar projection loss

All `_patient_id`, `_practitioner_id`, `_organization_id`/`service_provider_org_id`/`managing_organization_id`, `_encounter_id`, `_location_id`, `_episode_of_care_id`, `_service_request_id`, `_observation_id`, `_medication_id`, `_prescription_id`, `_coverage_id`, `_account_id`, `_composition_id`, `_claim_id`, `_claim_response_id` columns reference their corresponding table IDs exactly as Document 2 DDL. Provenance target and ChargeItem supporting_info_ref are polymorphic and validated by registry, not a broken single-table FK. Account.subject and appointments can have multiple actors; relational scalar fields select the declared patient/practitioner/location first() and retain all others in raw_fhir. Every such scalarization is visible in ViewDefinition and an inspector explanation. No claim of lossless relational flattening; **raw_fhir + durable registry** preserve the full FHIR graph.

### 8.4 Three analytical views — no fan-out errors

`src/lib/db/views.sql` exports exactly these three CREATE OR REPLACE VIEW definitions. Use source SQL as the baseline, implementing the corrections below.

1. **`vw_fhir_clinical_diagnosis_recap`**: organization_name, province_code, encounter_class, code_system, diagnosis_code, diagnosis_display, diagnosis_role_code, diagnosis_rank, total_encounters, total_unique_patients. Join Condition→Encounter, patient, organization as in source. Group by organization **id as well as** displayed name, province/class/code/role/rank so identically named hospitals do not collapse. Count distinct encounter IDs and canonical patient IDs after merge, not COALESCE(nik,id), which incorrectly conflates absent/duplicate identities. All encounter diagnosis role/rank selection rules are disclosed below.
2. **`vw_fhir_financial_claim_recap`**: provider_organization, claim_type, diagnosis_package_code, diagnosis_package_display, adjudication_outcome, total_claims, total_submitted_amount, total_approved_benefit_amount, total_variance_amount, currency. Select latest non-entered-in-error ClaimResponse per claim using a CTE/window or DISTINCT ON; one row per claim before group. Preserve claims with no response as queued for teaching, using zero approved amount only in this aggregate's expressly labeled pending comparison (not in canonical totals). Unknown submitted totals are not counted as genuine zeros; aggregate SQL SUM semantics remain visible. Group by provider id too; separate currency. Do not join EOB or claim items directly into an aggregate and multiply values.
3. **`vw_fhir_clinical_to_claim_audit`**: provider_organization, claim_id, claim_identifier, patient_name, encounter_class, discharge_disposition_code, discharge_summary_status, principal_diagnosis, secondary_diagnoses, diagnosis_package_code, submitted_amount, approved_benefit_amount, claim_outcome, disposition, process_note_text. Source display names preserved. Build principal/secondary evidence from each Claim.diagnosis references/types in raw_fhir with LATERAL JSONB extraction and left join Conditions; fallback to encounter DD rank when the claim has no diagnosis list, explicitly mark absence in validator. Preaggregate secondary STRING_AGG sorted/distinct and choose principal deterministically (unique principal required by complete-claim profile). Join latest response once, Composition by claim.composition_id. Exactly one audit row per claim, including incomplete evidence. Summary final → FINAL_COMPLETE, otherwise INCOMPLETE_OR_PRELIMINARY. Do not make a rank-1 admission diagnosis accidentally principal or let multiple primary rows fan out.

The UI shows view semantics/tooltips, including latest-response policy and the difference between missing/queued/zero. These are plain SQL views, not materialized views requiring refresh.

### 8.5 Encounter diagnosis synchronization

`src/lib/db/diagnosis-sync.ts` exports:

```ts
export function deriveDiagnosisAssignments(registry: RegistryReader): Result<
  ReadonlyMap<ResourceKey, { role: string | null; rank: number | null }>>;
export function enrichConditionRows(rows: readonly FlatRow[], assignments:
  ReadonlyMap<ResourceKey, { role: string | null; rank: number | null }>): readonly FlatRow[];
```

Evaluate the nonpersisted Encounter diagnosis ViewDefinition or equivalent shared compiled traversal. A Condition receives role/rank only from an Encounter.diagnosis entry resolving to that Condition **and matching Condition.encounter**. A condition used in another encounter's diagnosis cannot overwrite its own encounter assignment. One row can store only one role/rank: prefer DD, then AD, then CC, then CM, lowest positive rank, then original entry order; expose this deterministic **analytical scalarization** in the inspector while retaining all roles in raw Encounter JSON. Duplicated rank for the same role or duplicated conflicting entries is diagnosed. On removal/reassignment clear stale columns to NULL; never retain old DD/1 defaults. Encounter edits/removal and Condition changes trigger rederivation, even when the Condition JSON itself did not change. Audit queries use raw claim/encounter references where multiple roles matter.

### 8.6 Projection and durable commit protocol

Public APIs:

```ts
// db/client.ts
export function createDatabase(): Promise<Result<DatabaseHandle>>;
export interface DatabaseHandle {
  transaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T>;
  queryReadOnly(sql: string, params: readonly SqlScalar[], revision: Revision): Promise<Result<QueryResult>>;
  close(): Promise<void>;
}
// db/sync.ts
export function buildProjection(snapshot: DatasetSnapshot, views: readonly ViewDefinition[],
  registry: RegistryReader): Result<ProjectionBatch>;
export function replaceProjection(tx: DatabaseTransaction, batch: ProjectionBatch): Promise<void>;
// persistence/dataset-repository.ts
export interface DurableDataset {
  snapshot: DatasetSnapshot; viewOverrides: readonly ViewDefinition[]; schemaVersion: 1;
}
export interface DatasetRepository {
  load(): Promise<Result<DurableDataset | null>>;
  save(value: DurableDataset): Promise<Result<void>>;
  clear(): Promise<Result<void>>;
}
```

One worker mutation queue serializes commands and reads requiring consistency. Each mutation:

1. Check base revision, construct immutable candidate, validate, compile mappings, build full ProjectionBatch before touching committed state.
2. Begin PGlite transaction, defer FKs, delete existing projection rows in reverse dependency order (or truncate all 27 tables together with no unrelated tables), insert candidate rows in dependency order with parameterized VALUES, then apply diagnosis enrichment. Organization/Patient/Practitioner/Medication/Location/etc. precede dependent clinical/financial tables; Claim precedes ClaimItem/ClaimResponse/EOB. Source schema has no extra registry table. All params including raw JSON are bound, never SQL-interpolated from resource values.
3. Check SQL integrity while transaction is open. Persist entire DurableDataset in one atomic IndexedDB readwrite transaction with expected prior revision. If IndexedDB save fails, throw and roll back the PGlite transaction, retaining old in-memory registry. Reads remain queued during this operation.
4. Commit PGlite. Then swap worker registry and emit snapshot/summary/report revision together. If PG commit unexpectedly fails after IndexedDB commit, the durable snapshot is the authority: close/recreate PGlite and rebuild from durable data before accepting any further read or reporting success. If recovery fails, expose DB_SYNC failed state, no stale tables advertised as current. This is recoverable derived-state publication, not a distributed transaction.
5. Browser crash between durable save and DB commit: next boot reprojects durable snapshot. Crash before durable save: prior dataset survives. No operation acknowledges success before both durable state and projection are coherent.

Full replacement is the deliberate boring design for a bounded lab: ≤10,000 resources, ≤10,000 items per preview/resource, total input import ≤10 MiB. Build indexes once per revision; avoid reserializing unchanged resources where a cached JSON string is available, but do not introduce a second incremental sync protocol. Synthetic defaults are much smaller. A command violating bounds fails without silently dropping rows. The same core transaction wrapper is used by normalize, resource edits, evidence edits, merge, mapping apply, and Bundle commit.

Durable repository owns IndexedDB db `global-fhir-lab`, object store `datasets`, key `active`; curriculum progress can use separate `preferences` key/store, not a PostgreSQL table. Store a schemaVersion and validate on load. No silent reset of unsupported/corrupt datasets: offer export and explicit reset to synthetic fixtures. PGlite is intentionally in-memory and does not open its own independent durable IDB store. Multiple tabs: acquire one named Web Lock for dataset ownership; another tab opens read-only with a clear message until it acquires the lock. Unsupported Web Locks means explicit session-only mode with persistence disabled (and a visible nonpersistent banner), not concurrent last-write-wins corruption.

### 8.7 Interactive SQL contract

`src/lib/db/sql-console.ts` exports `runReadOnlyQuery(db,sql,revision): Promise<Result<QueryResult>>` and `readTablePage(db,request): Promise<Result<TablePage>>`.

- Execute user SQL in a transaction with `SET TRANSACTION READ ONLY`, `statement_timeout = '3000ms'`, conservative work_mem, and server-side cursor fetching at most 501 rows, displaying 500 and `truncated`. Roll back after fetch. Use actual PostgreSQL enforcement, not a fragile SELECT regex. Reject zero or multiple statements with a lexical SQL scanner aware of quotes, dollar-quotes, comments, and semicolons; a single WITH SELECT, EXPLAIN SELECT, or VALUES can work if PostgreSQL read-only permits it.
- Dedicated query connection is not available for a single in-memory PGlite instance: all queries serialize in the same worker queue; expose cancel as queued cancellation and statement timeout, not a fake interrupt. A watchdog on worker nonresponse may terminate and reinitialize worker from durable data, invalidating pending requests with explicit errors.
- Table browsing uses allowlisted TableName/AnalyticalViewName, escaped known identifiers, bound filter values, stable PK ordering, page size 100. No arbitrary untrusted identifiers or direct edit cell SQL. Schema inspector obtains columns/constraints from pg_catalog/information_schema.
- Read-only SQL cannot mutate canonical resources, drop schema, call unsafe file/network extensions, or change persistent settings. No optional PGlite extensions granting external I/O are loaded. It remains an educational local sandbox, not a hard multi-tenant hostile SQL service.
- Query errors include SQLSTATE/detail where available and Indonesian explanation, retaining the typed query so learners can fix it. Query success updates mission facts with query ID/revision/selected result assertions.

## 9. Zustand and worker orchestration contract

### 9.1 Worker protocol — `src/types/worker.ts`

```ts
export interface RequestMeta { requestId: string; baseRevision: Revision }
export type WorkerRequest = RequestMeta & (
  | { kind: 'initialize' }
  | { kind: 'preview-normalization'; document: SimrsDocument }
  | { kind: 'commit-normalization'; document: SimrsDocument }
  | { kind: 'replace-resource'; resource: Resource }
  | { kind: 'apply-evidence'; command: EvidenceCommand }
  | { kind: 'preview-merge'; request: PatientMergeRequest }
  | { kind: 'commit-merge'; request: PatientMergeRequest }
  | { kind: 'apply-transaction'; bundle: R4.Bundle }
  | { kind: 'validate' }
  | { kind: 'preview-view'; view: ViewDefinition; resourceKeys: readonly ResourceKey[] }
  | { kind: 'apply-views'; views: readonly ViewDefinition[] }
  | { kind: 'query'; sql: string }
  | { kind: 'table-page'; request: TablePageRequest }
  | { kind: 'reset-scenario'; scenarioId: string }
  | { kind: 'export-dataset' }
  | { kind: 'import-dataset'; value: unknown }
);
export type WorkerResponse =
  | { kind: 'ready' | 'committed'; requestId: string; snapshot: LabSnapshot }
  | { kind: 'normalization-preview'; requestId: string; revision: Revision; result: NormalizationResult }
  | { kind: 'merge-preview'; requestId: string; revision: Revision; result: PatientMergePlan }
  | { kind: 'view-preview'; requestId: string; revision: Revision; result: FlatResult }
  | { kind: 'query-result'; requestId: string; result: QueryResult }
  | { kind: 'table-page'; requestId: string; revision: Revision; result: TablePage }
  | { kind: 'transaction-result'; requestId: string; revision: Revision;
      result: TransactionResult; snapshot?: LabSnapshot }
  | { kind: 'validated'; requestId: string; revision: Revision; report: ValidationReport }
  | { kind: 'dataset-export'; requestId: string; revision: Revision; dataset: DurableDataset }
  | { kind: 'error'; requestId: string; revision: Revision; error: LabError };
export interface LabSnapshot {
  dataset: DatasetSnapshot; validation: ValidationReport; projection: ProjectionSummary;
  viewDefinitions: readonly ViewDefinition[]; lastTransaction: TransactionReceipt | null;
}
export interface TransactionReceipt {
  revision: Revision; request: R4.Bundle; response: R4.Bundle;
  executionOrder: readonly number[];
}
```

There is no transferable Map/Error/Decimal/function in protocol payloads; TransactionPlan's worker-local Map is converted to entries in preview DTOs if exposed. Define `TablePageRequest {name:TableName|AnalyticalViewName,page:number,pageSize:100,filter?:{column:string,value:string}}`; `TablePage {columns:...,rows:...,totalRows:number,page:number}` and validate column allowlists. `initialize` uses baseRevision 0 and is idempotent in StrictMode. TransactionResult sent over protocol omits the internal candidate when the committed LabSnapshot supplies the dataset; use exported `TransactionReceipt`/OperationOutcome DTO rather than duplicating a complete dataset in two payloads.

`WorkerClient` exports typed `request<K extends WorkerRequest['kind']>(payload:RequestFor<K>): Promise<Result<ResponseFor<K>>>`, `dispose():void`, and `subscribeStatus(listener):()=>void`. Request/response conditional types are declared in worker.ts. All rejected worker errors become LabError; no unhandled promises. `LabController` owns one client and dispatches snapshots into a store port; React components do not instantiate workers. Startup registers before React render or in a stable composition-root factory, and shutdown/HMR disposes listeners/worker exactly once.

### 9.2 Store — `src/store/lab-store.ts`

```ts
export type InspectorTab = 'fhir-json' | 'view-definition' | 'postgresql' | 'validator';
export type WorkspaceTab = 'normalization' | 'evidence' | 'graph' | 'sql';
export interface LabState {
  lifecycle: 'initializing' | 'ready' | 'readonly' | 'failed';
  snapshot: LabSnapshot | null;
  selectedModuleId: ModuleId; adoptionFilters: readonly ImplementationStatus[];
  selectedHospitalId: HospitalId; selectedScenarioId: string;
  selectedResourceKey: ResourceKey | null; selectedJsonPath: string | null;
  workspaceTab: WorkspaceTab; inspectorTab: InspectorTab;
  sourceDraft: { text: string; dirty: boolean; error: LabError | null };
  resourceDraft: { key: ResourceKey | null; text: string; dirty: boolean; error: LabError | null };
  normalizationPreview: NormalizationResult | null;
  mergePreview: PatientMergePlan | null;
  viewDraft: { name: string | null; text: string; dirty: boolean; error: LabError | null };
  viewPreview: FlatResult | null;
  sql: { text: string; status: 'idle' | 'running' | 'success' | 'error';
    result: QueryResult | null; error: LabError | null; activeRequestId: string | null };
  table: { name: TableName | AnalyticalViewName; page: number; data: TablePage | null;
    status: 'idle' | 'loading' | 'ready' | 'error'; error: LabError | null };
  progress: CurriculumProgress;
  operations: Readonly<Record<string, { kind: WorkerRequest['kind']; pending: boolean }>>;
  operationError: LabError | null;
  layout: { leftWidth: number; rightWidth: number; mobilePanel: 'learn' | 'work' | 'inspect' };
  graph: { positions: Readonly<Record<ResourceKey,{x:number;y:number}>>;
    relationFilters: readonly ReferencePathDefinition['relation'][]; showUnresolved: boolean };
}
export interface LabActions {
  initialize(): Promise<void>;
  selectModule(id: ModuleId): void;
  setAdoptionFilters(values: readonly ImplementationStatus[]): void;
  selectHospital(id: HospitalId): void;
  loadScenario(id: string): Promise<void>;
  selectResource(key: ResourceKey | null, path?: string): void;
  setWorkspaceTab(tab: WorkspaceTab): void;
  setInspectorTab(tab: InspectorTab): void;
  editSource(text: string): void;
  previewNormalization(): Promise<void>;
  commitNormalization(): Promise<void>;
  editResource(text: string): void;
  commitResource(): Promise<void>;
  applyEvidence(command: EvidenceCommand): Promise<void>;
  previewPatientMerge(request: PatientMergeRequest): Promise<void>;
  commitPatientMerge(request: PatientMergeRequest): Promise<void>;
  applyTransaction(bundle: R4.Bundle): Promise<void>;
  editView(text: string): void;
  previewView(): Promise<void>;
  applyView(): Promise<void>;
  restoreCanonicalView(name: string): Promise<void>;
  revalidate(): Promise<void>;
  editSql(text: string): void;
  runSql(): Promise<void>;
  browseTable(name: TableName | AnalyticalViewName, page: number): Promise<void>;
  acknowledgeMission(id: MissionId): void;
  resetProgress(): void;
  setPanelWidths(left: number, right: number): void;
  setMobilePanel(panel: 'learn' | 'work' | 'inspect'): void;
  setGraphPosition(key: ResourceKey, position: {x:number;y:number}): void;
  setGraphFilters(filters: LabState['graph']['relationFilters'], showUnresolved:boolean): void;
  exportDataset(): Promise<void>;
  importDataset(input: unknown): Promise<void>;
  clearOperationError(): void;
}
export type LabStore = LabState & LabActions;
export function createLabStore(controller: LabController): StoreApi<LabStore>;
```

Use a store Provider and typed `useLabStore(selector)` hook; do not create a global controller per test. `LabController` accepts `LabStorePort {publishSnapshot, publishStatus, publishError}` rather than importing store internals, preventing a cycle. Store actions are thin orchestration wrappers; controller processes response correlation and returns typed results.

Store invariants:

- Snapshot's dataset, validation and projection revisions equal. Preview revision can differ only when explicitly labeled stale; stale preview cannot commit.
- Immutable snapshots; Zustand is not a second mutable resource database. Build memoized selectors for resource lookup, selected ViewDefinitions, issues, graph, module counts, mission state. Do not subscribe every component to entire store or rebuild all graph nodes on textarea keystrokes.
- Draft parse errors never replace committed JSON or trigger sync. Explicit Apply commits; expensive previews run on request, not every keystroke. Mark prior previews stale on draft changes.
- Switching scenario/hospital with dirty drafts prompts save/discard in UI. `selectHospital` changes source focus, not global dataset deletion. `loadScenario` changes active exercise resources only through worker command with ownership metadata.
- Persist only module/filter/layout/scenario and curriculum progress/preferences through a versioned preference adapter. Do not localStorage-persist FHIR, SQL rows, runtime errors, in-flight operations, Maps, or full worker state. Persisted facts are keyed by scenario/dataset revision identity so resetting a scenario cannot grant stale mission success.
- Nonmutating UI remains usable while a query runs; mutation controls disable or queue visibly. Pending controls have accessible state; failed command retains draft and old coherent snapshot.
- Graph drag positions and tab selections do not increment dataset revision. Resource deletion/replacement reconciles selection; choose a stable existing resource or null, never crash on absent key.

## 10. Curriculum, missions, mental models, and cheatsheet

### 10.1 Types and evaluation

`src/types/curriculum.ts`:

```ts
export type ModuleId = 'm01'|'m02'|'m03'|'m04'|'m05'|'m06'
  |'m07'|'m08'|'m09'|'m10'|'m11'|'m12';
export type MissionId = `${ModuleId}-${string}`;
export interface LearningModule {
  id: ModuleId; order: number; title: string; level: string;
  statuses: readonly ImplementationStatus[]; prerequisites: readonly ModuleId[];
  objectives: readonly string[]; mentalModel: readonly string[];
  resourceTypes: readonly ResourceType[]; scenarioId: string;
  lessons: readonly LessonBlock[]; missions: readonly Mission[];
  initialWorkspace: WorkspaceTab; initialInspector: InspectorTab;
  references: readonly { label: string; url: string; version: string }[];
}
export type LessonBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'comparison'; sql: string; fhir: string; explanation: string }
  | { kind: 'example'; resourceKey: ResourceKey; path?: string; explanation: string }
  | { kind: 'warning'; text: string };
export interface Mission {
  id: MissionId; title: string; instruction: string;
  predicate: MissionPredicate; hint: string; explanation: string;
}
export type MissionPredicate =
  | { kind: 'acknowledge' }
  | { kind: 'selected-resource'; type: ResourceType; path?: string }
  | { kind: 'resource-path'; scenarioAlias: string; path: string; equals: JsonValue }
  | { kind: 'rule-pass'; ruleId: ValidationRuleId; scopeAliases: readonly string[] }
  | { kind: 'normalized'; hospitalId: HospitalId }
  | { kind: 'merged'; survivorAlias: string; duplicateAlias: string }
  | { kind: 'evidence-linked'; ownerAlias: string; targetAlias: string; relation: string }
  | { kind: 'transaction-committed'; methods: readonly ('DELETE'|'POST'|'PUT'|'GET')[] }
  | { kind: 'view-output'; viewName: string; assertion: ResultAssertion }
  | { kind: 'sql-output'; exampleId: string; assertion: ResultAssertion };
export interface ResultAssertion {
  columns: readonly string[]; minRows: number;
  expectedRows?: readonly Readonly<Record<string, JsonValue>>[];
}
export interface CurriculumProgress {
  version: 1; acknowledgments: readonly MissionId[];
  completed: Readonly<Record<MissionId, { datasetId:string; scenarioId:string;
    revision:Revision; completedAt:string }>>;
}
export interface MissionContext {
  snapshot: LabSnapshot; selection: { key:ResourceKey|null; path:string|null };
  facts: readonly LearningFact[];
}
export function evaluateMission(mission: Mission, context: MissionContext):
  { complete:boolean; reason:string; revision:Revision };
```

`LearningFact` is a discriminated event record for acknowledged normalization, merge, evidence, transaction, view preview/apply, SQL output, and resource selection, with requestId/scenarioId/datasetId/revision; its kind-specific payload is declared in the same file. Facts are generated only by successful corresponding actions. Static acknowledgment is permitted only for conceptual reading. Rule-pass applies to the target resources and must have nonzero checked count; global not-applicable cannot complete a mission. SQL result assertions compare actual columns/rows, not merely searching query text. If data later breaks a previously satisfied invariant, show historical achievement separately from current mission health; completion never masks a current validator failure.

### 10.2 Required twelve modules and concrete missions

Each module exports at least the three listed missions with stable IDs `mNN-01` etc., substantive Bahasa Indonesia lessons, SQL-vs-FHIR comparisons, hints, and a runnable scenario. Prerequisites guide learning but do not lock browsing. Every resource named in §1.4 appears in at least one lesson, valid fixture, and inspection/graph task.

| Module/status | Curriculum and mental model | Required interactive missions / evidence |
|---|---|---|
| **m01 Foundation — implemented** | Standard Lego resources; Resource vs datatype vs Extension; Coding/CodeableConcept/Quantity/Money/Period; SQL table/row vs resource/id; value[x]; R4 vs R5 boundary | Select Patient id vs identifier; inspect a valid quantity and Money; choose single-value Observation branch and validate choice rule. |
| **m02 Identity, Extensions, Security — implemented + partial** | NIK/IHS/MRN namespaces; administrative extension valueCode; duplicate/emergency identity; Consent and Provenance; CodeSystem/ValueSet/ConceptMap | Normalize identifiers from two hospitals without merging MRNs; repair administrative extension; merge an emergency duplicate explicitly and inspect reciprocal links + provenance target/agent. |
| **m03 Administration — implemented (+ Device partial explanation)** | Organization/payor, Location, Practitioner, Patient, HealthcareService, Device; EpisodeOfCare vs Encounter; class/statusHistory/period/discharge; diagnosis use vs rank | Connect encounter serviceProvider/location/episode; set discharge disposition home; assign DD rank 1 and CM rank 2, confirm Condition projection synchronization and inspect original Encounter array. |
| **m04 Diagnostics — implemented** | Observation root vs BP panel/components, UCUM, Specimen, ImagingStudy, DiagnosticReport/result[] | Convert RS raw BP 120/80; repair intentional root-value violation and pass rule 02; connect two observations to report results and inspect both raw references despite scalar primary_observation_id. |
| **m05 Conditions, Procedures, Allergies — implemented** | ICD-10/SNOMED vs local codes; ICD-9-CM procedures; condition clinical/verification status; AllergyIntolerance | Map real declared code dictionary; link a Procedure to matching patient/encounter; repair wrong-subject clinical evidence and inspect allergy coding. |
| **m06 Pharmacy and Discharge — implemented** | Medication→Request→Dispense; KFA NC/EP; SimpleQuantity; Composition/document distinction; five sections | Connect authorizingPrescription; set fractional daysSupply without truncation; complete five discharge sections including valid emptyReason+narrative and pass rule 03. |
| **m07 Workflow — partial + pioneer** | ServiceRequest referral/order, Schedule→Slot→Appointment, Task, Encounter.basedOn; not speculative national workflow certification | Create/inspect Schedule and Slot; link Appointment participants to booked slot; link ServiceRequest through Encounter.basedOn and complete a Task with valid focus/for references. |
| **m08 Coverage and Eligibility — pioneer** | Coverage beneficiary/payor/class, Organization insurer; EligibilityRequest→Response; coverage != claim approval | Normalize member ID/plan with actual namespace; link response.request and insurance.coverage; verify mandatory response fields and inspect active/inforce distinction. |
| **m09 Billing and Claim — pioneer** | Account/ChargeItem ledger and evidence; Claim diagnosis/procedure/supportingInfo, packageCode, sequence links; header vs items; global vs hypothetical national grouper | Attach clinical charge evidence; assemble two Claim items with productOrService and valid sequence references; reconcile 3,500,000 + 8,000,000 = 11,500,000 IDR, pass rule 04/05, inspect two item rows and one header. |
| **m10 Adjudication and EOB — pioneer** | ClaimResponse outcomes, disposition, totals submitted/benefit; addItem; notes; EOB insurance; legitimate variance | Enter valid submitted/benefit category totals; model partial benefit with explanatory notes and inspect negative variance; link EOB claim/claimResponse/coverage, add a second response and verify deterministic latest-response aggregate. |
| **m11 Quality and Transactions — pioneer + implemented core** | PlanDefinition/GuidanceResponse educational rules (not live clinical advice); Measure/MeasureReport populations; Bundle atomicity/URNs/order | Inspect executable synthetic quality counts; submit intentionally mixed-order transaction with forward/circular URN references and inspect ordered execution/original response order; force an invalid entry and demonstrate no revision/table changes. |
| **m12 SQL-on-FHIR v2 — implemented core** | ViewDefinition FHIRPath vs PostgreSQL views; keys, where/exists/first/ofType; forEach vs forEachOrNull; national recap with honest limitations | Preview/apply separate Claim header/item views and empty-array contrast; edit Encounter diagnosis and see derived role/rank clear/update; run all three analytical example queries on real PGlite and inspect cross-hospital counts. |

Seed scenarios include a valid complete baseline, repairable BP error, empty Composition section, cross-encounter claim reference, financial mismatch, invalid Bundle request, emergency duplicate Patient, no-item draft Claim, multiple-role diagnosis, missing optional totals, and repeated adjudication. Invalid fixtures are explicitly tagged exercises; the startup baseline must not pretend their violations are valid. Unprojectable malformed resources stay in draft/preview, not corrupting loaded tables.

### 10.3 Left panel teaching aids

- Five normalization laws remain visible as a selectable mental-model stepper. Selecting a law highlights relevant mapping traces, JSON paths, and corresponding table/view columns.
- Filter statuses use all three colors **and** text/icons; mixed-status modules match if any module status is selected. OR semantics, three selected by default, zero selected yields a clear empty state and reset. Filtering does not destroy current selection or silently reset progress.
- Interactive mission list shows current health, completion evidence/revision, hint, and jump-to-action. Conceptual acknowledgments use checkboxes; engine-backed missions show computed check state and a “Kerjakan” action, not a fake clickable success control.
- SQL-to-FHIR cheatsheet includes Table→resourceType; PK→id/getResourceKey; identity→identifier namespace; FK→Reference/getReferenceKey; enum→Coding/CodeableConcept; local attribute→Extension; JOIN→reference graph; BEGIN/COMMIT→Bundle transaction; UNNEST→forEach; LEFT LATERAL→forEachOrNull; scalar total→Money; adjudication totals→category/amount arrays. Each row has a real example and a navigation target.

## 11. Complete three-panel UI

### 11.1 Layout and hierarchy

```text
App
└─ LabProvider + AppErrorBoundary
   └─ AppShell
      ├─ Header (title, R4/version, revision, synthetic-data notice, DB/worker status,
      │          scenario reset, import/export)
      ├─ ResponsivePanelNav (Learn / Work / Inspect on narrow screens)
      └─ ThreePanelLayout
         ├─ LearningPanel [left]
         │  ├─ AdoptionFilter + StatusBadge
         │  ├─ ModuleNavigation (12 ModuleCards)
         │  ├─ ModuleLesson
         │  ├─ MentalModel
         │  ├─ MissionChecklist
         │  └─ SqlFhirCheatsheet
         ├─ WorkspacePanel [center]
         │  ├─ ScenarioToolbar (hospital, scenario, revision, reset)
         │  ├─ WorkspaceTabs
         │  ├─ NormalizationSandbox
         │  │  ├─ SourceEditor + HospitalProfileSummary
         │  │  ├─ MappingTraceTable
         │  │  └─ NormalizationPreview + PatientMergeDialog
         │  ├─ EvidenceChainEditor
         │  │  ├─ EvidenceResourcePicker
         │  │  ├─ DiagnosisRoleEditor
         │  │  ├─ ClaimItemEditor + EvidenceLinkDialog
         │  │  ├─ AdjudicationEditor
         │  │  └─ EvidenceSummary
         │  ├─ ResourceRelationshipGraph (ReactFlowProvider)
         │  │  ├─ ResourceNode + ReferenceEdge
         │  │  ├─ GraphToolbar (type/relation filters, fit, unresolved)
         │  │  └─ GraphAccessibleList (equivalent keyboard navigation)
         │  └─ SqlConsole
         │     ├─ SqlExamplePicker
         │     ├─ CodeEditor (SQL textarea, run keyboard shortcut)
         │     └─ QueryResultTable
         └─ InspectorPanel [right]
            ├─ ResourceSelector + selection breadcrumbs
            ├─ InspectorTabs (exactly 4 live tabs)
            ├─ FhirJsonInspector (JsonTree + Indonesian AnnotationPopover)
            ├─ ViewDefinitionInspector (CodeEditor + mapping target/preview)
            ├─ PostgreSqlInspector (SchemaBrowser + DataTable + raw row detail)
            └─ ConformanceInspector (RuleSummary + ValidationIssueList)
```

At desktop ≥1280px show all three columns with independent vertical scroll, approximate initial widths 280px / flexible ≥480px / 400px. Accessible pointer+keyboard separators clamp side widths (left 240–420, right 320–620); persist preferences. Between 768–1279px allow left collapse/right drawer while center stays usable. Below 768px show one panel using explicit nav without unmounting/loss of drafts. Tables/code horizontally scroll within their panel; no whole-page horizontal overflow. Header and panel titles stay reachable at 200% zoom.

### 11.2 Shared props and interaction contracts

`src/types/ui.ts` exports:

```ts
export interface ResourceSelectionProps {
  selectedKey: ResourceKey | null; onSelect(key: ResourceKey, path?: string): void;
}
export interface ResourcePickerProps extends ResourceSelectionProps {
  resources: readonly ResourceEnvelope[]; allowedTypes?: readonly ResourceType[];
  label: string; disabled?: boolean;
}
export interface CodeEditorProps {
  id: string; label: string; language: 'json'|'sql'; value: string;
  onChange(value: string): void; readOnly?: boolean; error?: string;
  onRun?: () => void; describedBy?: string;
}
export interface DataTableProps {
  columns: readonly {key:string;label:string}[];
  rows: readonly Readonly<Record<string, JsonValue>>[];
  rowKey(row:Readonly<Record<string, JsonValue>>,index:number): string;
  onSelectRow?: (index:number)=>void; caption:string; emptyMessage:string;
}
export interface StatusBadgeProps { status:ImplementationStatus; compact?:boolean }
export interface PanelProps { title:string; children:React.ReactNode; actions?:React.ReactNode }
export interface DialogProps {
  open:boolean; title:string; children:React.ReactNode; onClose():void;
}
```

Controlled leaf components only manipulate values/emit commands; container components use store selectors/actions. Graph click, table row selection, validation issue click, mission jump, and mapping trace click all converge on `selectResource(key,path)` and intentional inspector/workspace tab selection. No component-owned hidden resource copy can diverge from JSON/table/graph inspection.

### 11.3 Panel behavior and full editing capability

- **Normalizer:** JSON textarea with line/parse feedback, profile field catalog, preview resource list, trace mapping and issues, explicit Apply, reset to fixture. Users can select all three hospitals. Optional raw JSON/resource editing supports all resource types even when no special form exists.
- **Evidence editor:** select encounter/claim and evidence; add/remove diagnosis role/rank, claim diagnosis/procedure/supportingInfo entries and sequence references, edit item productOrService/category/encounter/net and quantity/unitPrice, charge evidence, claim total, response/EOB totals/status/outcome/disposition/notes and insurance coverage links. Typed forms decode into canonical R4 structures; general JSON Apply remains available for fields outside forms. `set-claim-item` and `set-adjudication` are exported typed domain commands in `types/commands.ts` (defined by the complete fields in §3/§8) handled by `domain/evidence.ts`; do not mutate local UI arrays without committing them. Show arithmetic/evidence diagnostics without silently recomputing the claim to hide an error.
- **Graph:** domain→ReactFlow nodes/edges, stable typed IDs, deterministic layout by domain layers and sorted keys, preserve positions on label changes, fit on initial/scenario changes not every mutation. Display unresolved references as labeled placeholder nodes, not disappearing edges. Directed labels show actual FHIR paths; financial/clinical/evidence legend uses text as well as color. Connecting only opens a supported typed link dialog. Use ReactFlow controls/background/minimap where useful, keyboard accessible list for equivalent actions; selection remains global.
- **SQL:** real queries, editable multiline text, Ctrl/Cmd+Enter, predefined queries for all three views plus raw JSONB extraction and header/item grouping, actual errors/truncation/runtime/revision label. Running an example loads the query; explicit run executes. Query results support resource navigation only when a typed resource identity is known, not any arbitrary `id` cell.
- **FHIR JSON tab:** exact valid R4 JSON download/copy, expand/collapse and path selection. Indonesian annotations are sidecar catalog entries keyed `(resourceType,pathPattern)`, covering identity, codes, choice types, money, reference, evidence, national/global distinctions and six-rule issues. Never inject comments, `_annotation` fields, or teaching extensions into payload. Copy/download raw JSON only.
- **ViewDefinition tab:** show resource's canonical associated views, switching Claim header/item and diagnostic Encounter view; expression/path explanations; editable validated JSON and live preview; Apply required before table mappings change. Display unsupported capabilities/error paths. A bad mapping never changes current DB.
- **PostgreSQL tab:** all 27 tables and exactly 3 analytical views discoverable with status badges, counts, schema types/FKs, paginated live data, NULL distinct from zero/empty string, raw_fhir row detail. Selecting a Claim item navigates parent Claim plus `item[index]` by sequence. No fake placeholder rows.
- **Conformance tab:** six rules with pass/fail/not-applicable and counts, origin HL7 vs lab labels, severity filters and exact resource/path links, evidence chain explanation, financial subtotals, transaction execution/response trace. Revalidate uses worker snapshot, not editor text unless explicitly preview validation.

### 11.4 Accessibility, security, resilience

Semantic landmarks, real buttons/labels, visible focus, roving keyboard tab navigation/ARIA panels, non-color badge text, screen-reader live regions for results, keyboard separators, dialog focus trap/restore/Escape, and reduced-motion support. Do not render arbitrary FHIR narrative with dangerouslySetInnerHTML. JsonTree and SQL cells escape content; Composition narrative preview remains escaped code or goes through an explicit strict sanitizer with no scripts/events/remote URLs (escaped display is the required baseline). Import accepts only bounded JSON, validates version and resources before committing, and does not execute attached URLs/content. Download uses Blob/object URL with cleanup. Clipboard errors are visible. Catch render errors at AppErrorBoundary with recover/reload and export diagnostics that exclude FHIR/identity data by default. No telemetry, secrets, or network transmission of dataset/queries.

All async views have loading/empty/error/stale/ready states. Do not hide a DB failure behind seeded UI counts. Per-operation errors do not replace the whole app if an old coherent snapshot exists. A worker crash cancels pending requests, announces failure, and can recover from the authoritative durable dataset; no invisible retry loop. Reset is explicit and destructive only to the active lab dataset, with confirmation and dirty-draft handling.

## 12. Exact file layout and ownership contracts

No implementation is present in the source workspace; these are required deliverable files. Every listed source file has a single owner below. Additional generated build output is not committed. Tests listed in §13 and content files below are part of the application delivery, not optional later phases. A coder may add private helpers within a file, but must not introduce parallel state/validation/mapping conventions.

### 12.1 Root/configuration/documentation

| File | Responsibility, exports/dependencies, invariant |
|---|---|
| `package.json` | Exact runtime/dev dependencies in §1; scripts dev=`vite`, build=`tsc -b && vite build`, typecheck=`tsc -b --pretty false`, test=`bun test`, test:e2e=`playwright test`, preview=`vite preview`; engines Bun. No React 19. |
| `bun.lock` | Generated by Bun install and committed; never hand-write fabricated resolution hashes. |
| `.gitignore` | node_modules, dist, coverage, Playwright output and local editor/runtime artifacts; do not ignore fixtures/spec. |
| `index.html` | lang=id, viewport, title, root element, module entry `/src/main.tsx`; no secrets. |
| `vite.config.ts` | default defineConfig with React plugin, src alias and worker ESM build; PGlite WASM asset resolution verified by build, no CDN fallback. |
| `tsconfig.json` | project refs to app/worker/node configs; strict common settings. |
| `tsconfig.app.json` | React JSX react-jsx, ES2022/DOM, bundler resolution, strict/noEmit; excludes worker-only globals from UI. |
| `tsconfig.worker.json` | ES2022/WebWorker, strict/noEmit, module worker entry + transitive pure libs; no DOM dependency. |
| `tsconfig.node.json` | config/test tooling types and Vite/Playwright config; strict composite-compatible noEmit configuration. |
| `tailwind.config.ts` | content globs, semantic adoption/domain/severity colors, typography/spacing; exports config. |
| `postcss.config.cjs` | Tailwind+autoprefixer plugins, single styling pipeline. |
| `bunfig.toml` | test preload happy-dom only for component suite via explicit setup separation; exclude Playwright files from Bun discovery. |
| `playwright.config.ts` | Chromium baseline, Vite webServer, deterministic fixture-reset setup; desktop/mobile and a11y suite. |
| `src/vite-env.d.ts` | Vite client/import worker asset types only. |
| `README.md` | Bun setup/run/check commands, full lab features, R4/runner limits, synthetic/privacy notice, recovery/export and architecture link. |
| `CHANGELOG.md` | Initial full Phases 1–6 release entry; factual capabilities/limitations, not claims of clinical certification. |
| `docs/spec.md` | This design contract; keep updated when an approved architectural decision changes. Original two source plans remain unchanged. |

### 12.2 Contracts, domain, pure engines

All types files depend only on other types and external `import type` definitions; no effects. All domain/engine functions consume readonly inputs and return new changed data/results; no UI imports.

| File | Required exports and responsibility | Allowed dependencies / invariant |
|---|---|---|
| `src/types/common.ts` | JsonValue, Result, LabError, Revision, Clock, IdFactory | None; serializable results. |
| `src/types/fhir.ts` | R4 alias namespace, Resource, ResourceType, ResourceOf, ResourceKey, ResourceEnvelope, DatasetSnapshot, ImplementationStatus, SourceLocator | common, @types/fhir; no fake index-signature FHIR model. |
| `src/types/registry.ts` | RegistryReader, ReferenceContext/Resolution, ResourceProfile, ElementConstraint/ReferencePathDefinition | fhir/common; metadata walker contract. |
| `src/types/normalization.ts` | contracts §3.3, TerminologyCatalog/CodingMapping types | fhir/registry/common; explicit adapters. |
| `src/types/validation.ts` | six IDs, ValidationRule/Context/Issue/Report/RuleResult | contracts only. |
| `src/types/sql-on-fhir.ts` | ViewDefinition/ViewSelect/ViewColumn, FhirPathValue, EvaluationContext, CompiledView-facing types, FlatResult | fhir/common/registry. |
| `src/types/database.ts` | TableName/AnalyticalViewName, SqlScalar, table/column definitions, batch/summary/query/page, DatabaseTransaction (`query`,`exec`), DatabaseHandle | common/sql-on-fhir; no PGlite implementation leak. |
| `src/types/commands.ts` | EvidenceCommand, explicit ClaimItemCommand/AdjudicationCommand payloads, merge and transaction contracts, graph node/edge DTOs | fhir/common/registry; include set-claim-item and set-adjudication discriminants in EvidenceCommand. |
| `src/types/curriculum.ts` | module/mission/predicate/fact/progress/context/lesson/assertion declarations §10 | contract files only. |
| `src/types/worker.ts` | WorkerRequest/Response, RequestFor/ResponseFor, LabSnapshot, TransactionReceipt | all DTO contracts; no runtime imports. |
| `src/types/ui.ts` | UI controlled props §11, typed panel/tab props | React types + contracts only. |
| `src/domain/registry.ts` | `createRegistry(snapshot):Result<RegistryReader>`, `indexResources`, `withResourceChanges(snapshot,changes):Result<DatasetSnapshot>` | contracts; detect duplicate typed keys, not mutable store. |
| `src/domain/identity.ts` | `sourceIdentityToId(locator,type):string`, `canonicalIdentifierKey(system,value):string` | contracts + single chosen sync SHA-256 utility/package; deterministic fixture identity, collision checks owned normalizer. |
| `src/domain/references.ts` | `resolveReference(reference,context):ReferenceResolution`, `walkReferences(resource,visitor):void`, `rewriteReferences(resource,replacer):Resource`, `rewriteTransactionReferences` | profile metadata/registry; reference-typed fields only, owner-contained scope. |
| `src/domain/terminology.ts` | `lookupCoding(catalog,dictionary,localCode):Result<Coding>`, `hasCoding`, `normalizeIdentifier`, `normalizeAdministrativeExtension` | data terminology and types; no guessed codes. |
| `src/domain/lab-profiles.ts` | `LAB_PROFILES`, `getProfile(type):ResourceProfile`, `SUPPORTED_RESOURCE_TYPES`, `LAB_CAPABILITIES` | offline metadata/status constants; all §1.4 concrete types. |
| `src/domain/money.ts` | parseDecimal/sumMoney/compareMoney/multiplyMoney/formatIdr | decimal.js and contracts; no float sum, no mutations. |
| `src/domain/dates.ts` | `parseLocalDate`, `parseProfileDateTime`, `validateFhirTemporal` returning Result | adapter declared formats; preserve precision/offset. |
| `src/domain/evidence.ts` | `buildEvidenceIndex(registry)`, `applyEvidenceCommand(snapshot,command):Result<DatasetSnapshot>`, `getClaimContext` | references/money/profiles; correct typed FHIR paths, no validator cycle. |
| `src/domain/transaction-plan.ts` | `planTransaction`, `validateTransactionShape`, operation rank constants | references/profiles/types; no validator/processor import cycle. |
| `src/domain/graph.ts` | `buildResourceGraph(registry,issues,filters):DomainGraph`, `layoutResourceGraph(graph,positions):DomainGraph`; export DomainGraph | references/profiles; deterministic nodes, unresolved explicit. |
| `src/lib/normalizer.ts` | decodeSimrs/normalizeSimrs §4; builder dispatch over EntityMapping | domain + profile data/types; two-pass IDs then references. |
| `src/lib/normalization/builders.ts` | `buildMappedResource(mapping,row,context):Result<Resource>`, `assembleClinicalFinancialLinks(resources,context)` | common/domain/mapping metadata; single builder registry covering all scenarios, no hospital-specific clinical rules. |
| `src/lib/fhir-validator.ts` | validateDataset/toOperationOutcome/VALIDATION_RULE_ORDER | six rules/types/domain; aggregates only. |
| `src/lib/validation/rules/mandatory.ts` | validateMandatory | offline metadata + profile walker. |
| `src/lib/validation/rules/observation.ts` | validateObservation | choice metadata/terminology; correct normative vs BP profile labels. |
| `src/lib/validation/rules/composition.ts` | validateComposition | narrative/reference helpers; recursive cmp-1/cmp-2. |
| `src/lib/validation/rules/evidence.ts` | validateEvidence | domain evidence/references; same-patient/encounter sequence chain. |
| `src/lib/validation/rules/financial.ts` | validateFinancial | money/evidence; declared claim-account scope and totals semantics. |
| `src/lib/validation/rules/bundle.ts` | validateBundle | shared transaction planner; no processor import. |
| `src/lib/validation/metadata.ts` | `walkElements`, `getElementConstraints`, `validatePrimitive`, `makeIssue` | offline JSON + types; reusable safe metadata traversal and deterministic diagnostics. |
| `src/lib/sql-on-fhir-flattener.ts` | public runner API §6 | fhirpath + sql-on-fhir internals; only facade used by DB/UI worker handler. |
| `src/lib/fhirpath/parser.ts` | tokenize/parseFhirPath/FhirPathAst/Token | types; real grammar, offsets, no eval. |
| `src/lib/fhirpath/evaluator.ts` | evaluateFhirPath | parser/functions/choice/money; collection/empty semantics. |
| `src/lib/fhirpath/functions.ts` | FHIRPATH_CAPABILITIES/applyFunction | references/metadata/types; key functions honor focus and expected type. |
| `src/lib/fhirpath/choice.ts` | readChoice(node,base,metadata):readonly FhirPathValue[] | offline element metadata; no prefix-only guesses. |
| `src/lib/sql-on-fhir/compiler.ts` | CompiledView/compileColumns/validate selection structure | parser/types; column collision/schema/type checks. |
| `src/lib/sql-on-fhir/select.ts` | evaluateSelect | evaluator/types; cross product, outer-null, union semantics. |
| `src/lib/bundle-transaction.ts` | processTransaction §7 | transaction planner/references/registry; pure atomic candidate, original response order. |
| `src/lib/patient-merge.ts` | planPatientMerge/applyPatientMergePlan/resolveCanonicalPatient | registry/references/types; reciprocal links, cycle/conflict prevention. |
| `src/lib/mission-evaluator.ts` | evaluateMission, `evaluateModule(module,context)` | curriculum/types and readonly report; no arbitrary JS predicate execution. |
| `src/lib/annotations.ts` | `getAnnotations(type,path):readonly Annotation[]` | data annotations; sidecar only. |

`ClaimItemCommand` fields: claim key, optional existing itemSequence, sequence, productOrService CodeableConcept, category CodeableConcept, encounter key, diagnosis/procedure/information sequence arrays, optional quantity SimpleQuantity/unitPrice Money, net Money. `AdjudicationCommand` fields: target ClaimResponse/EOB key, status/type/use, patient/insurer/provider where applicable, created/outcome, claim/request/claimResponse references, insurance for EOB, optional submitted/benefit Money, addItem net array, disposition/notes. Export full typed declarations using R4 field types; require fields according to target discriminant rather than one bag of unrelated optional properties. Form Apply and JSON Apply both reach the same canonical command pipeline.

### 12.3 Data/content files

Data exports are readonly and validated at load/test time; no imports from store/components/DB. JSON fixtures carry scenario metadata outside resource payloads. No lorem ipsum, single-resource placeholder curriculum, or unlinked graph fixtures.

| File | Required exports/responsibility | Dependencies/invariant |
|---|---|---|
| `src/data/statuses.ts` | `IMPLEMENTATION_STATUSES`, `STATUS_LABELS`, colors/icons/help, baseline disclaimer | types; exact three status values, textual accessible labels. |
| `src/data/terminology.ts` | `TERMINOLOGY_CATALOG`, canonical URIs, hospital code mappings, national extension URLs | types; ICD-10/ICD-9-CM/LOINC/SNOMED/UCUM/KFA/HL7 systems from plans; official displays where supplied, local entries marked local. |
| `src/data/fhir/r4-elements.json` | offline supported resource/datatype element/binding/reference metadata, source/version attribution | pinned R4 definitions; substantive inherited+nested metadata, no fabricated whole-standard validation claim. |
| `src/data/hospitals/profiles.ts` | `HOSPITAL_PROFILES`, `CANONICAL_FIELD_CATALOG` | terminology/types; explicit all three adapter mappings. |
| `src/data/hospitals/rs-a.json` | complete raw RS-A clinical/financial dataset | matches profile, synthetic identities. |
| `src/data/hospitals/rs-b.json` | complete differently-shaped RS-B dataset | cross-hospital analytics, no accidental shared local key collision. |
| `src/data/hospitals/rs-c.json` | complete nested RS-C dataset | array/object fields actually exercised. |
| `src/data/scenarios.ts` | `SCENARIOS`, `getScenario`, `createInitialDataset`, scenario alias→ResourceKey and owned-source groups | hospital inputs + FHIR fixtures/types; initial valid baseline + explicit invalid exercise variants. |
| `src/data/fhir/administration.json` | Organization/payor, Patient incl duplicate, Practitioner, Location, Episode, HealthcareService, Device | valid R4 refs and all required fields. |
| `src/data/fhir/clinical.json` | Condition, Procedure, BP/single Observations, reports, Specimen, ImagingStudy, AllergyIntolerance | LOINC/UCUM and evidence links correct. |
| `src/data/fhir/pharmacy-documents.json` | Medication/Request/Dispense + five-section Composition | authorizing chain and actual cmp-1 compliance. |
| `src/data/fhir/workflow-security.json` | ServiceRequest, Schedule, Slot, Appointment, Task; Consent, Provenance; CodeSystem, ValueSet, ConceptMap | normative mandatory fields/nested structures, no invented national rules. |
| `src/data/fhir/financial-quality.json` | Coverage, both Eligibility resources, Account, Charges, Claim, Responses, EOB, PlanDefinition, GuidanceResponse, Measure, MeasureReport | single Money vs category totals, current/secondary response chronology, quality canonical links. |
| `src/data/fhir/transactions.json` | mixed-order valid, forward/circular URN, DELETE/GET and failure transaction examples | fixed valid v4 UUIDs; examples distinguish request and response. |
| `src/data/view-definitions/administration.ts` | `ADMINISTRATION_VIEWS`: organization, patient, practitioner, location, episode, service request, encounter, consent, provenance (9) | SQL contracts; provenance type separately decorated. |
| `src/data/view-definitions/clinical.ts` | `CLINICAL_VIEWS`: condition, procedure, observation, report, medication/request/dispense, composition, appointment (9) | choice and BP paths; explicit scalarization. |
| `src/data/view-definitions/financial.ts` | `FINANCIAL_VIEWS`: coverage, eligibility response, account, charge, claim header/item, claim response, EOB, measure report (9) | exact required view names and item forEach. |
| `src/data/view-definitions/catalog.ts` | `CANONICAL_VIEW_DEFINITIONS`, `ENCOUNTER_DIAGNOSIS_VIEW`, table/view lookup | 27 persisted projections + one preview only; no duplicate target/view names. |
| `src/data/sql-examples.ts` | `SQL_EXAMPLES` with id/title/query/description/ResultAssertion | all three views + JSONB/claim item comparison; actual valid PostgreSQL queries, scenario-aware expected values. |
| `src/data/annotations.ts` | `FHIR_ANNOTATIONS` with type/path patterns/title/explanation/source/version | exact JSON path matching and Bahasa Indonesia text, no payload modification. |
| `src/data/cheatsheet.ts` | `SQL_FHIR_CHEATSHEET`, `NORMALIZATION_LAWS` | all mappings §10.3; clickable routes use typed target. |
| `src/data/curriculum/m01.ts` … `m12.ts` | each exports `module01` … `module12: LearningModule`; exact content/missions §10 | types/data only; real content per module; 12 explicitly required files. |
| `src/data/curriculum/catalog.ts` | `CURRICULUM`, `getModule(id)`, module/mission ID validation | imports twelve modules, no engines/UI; unique stable IDs and scenario refs. |

### 12.4 Database, persistence, worker, app state

| File | Required exports/responsibility | Dependencies/invariant |
|---|---|---|
| `src/lib/db/schema.sql` | complete corrected 27-table DDL/indexes/checks/FKs | §8 + source DDL; imported as Vite raw asset. |
| `src/lib/db/views.sql` | exactly 3 analytical CREATE OR REPLACE VIEWs | §8.4; deterministic latest response, no fan-out. |
| `src/lib/db/schema.ts` | `TABLE_DEFINITIONS`, `ANALYTICAL_VIEW_NAMES`, `initializeSchema(tx)`, `validateProjectionCatalog(views)` | SQL raw imports/types; all columns covered by mapping or declared decorator. |
| `src/lib/db/client.ts` | createDatabase/DatabaseHandle adapter | PGlite/types; worker-only instance, parameter binding/transaction cleanup. |
| `src/lib/db/diagnosis-sync.ts` | deriveDiagnosisAssignments/enrichConditionRows | runner/registry/diagnostic view; no stale defaults. |
| `src/lib/db/sync.ts` | buildProjection/replaceProjection, `decorateProjectedRows` | runner/schema/money/diagnosis; full snapshot sync, raw resource/item consistency. |
| `src/lib/db/sql-console.ts` | runReadOnlyQuery/readTablePage/`scanSingleSqlStatement` | client/schema; actual read-only PG, bounded cursor and timeout. |
| `src/lib/persistence/dataset-repository.ts` | `openDatasetRepository():Promise<Result<DatasetRepository>>`, DurableDataset contracts | native IndexedDB, types; one atomic active record, version validation, no silent reset. |
| `src/lib/persistence/preferences.ts` | `loadPreferences`, `savePreferences`, `clearPreferences`, `LabPreferences` | versioned localStorage or IDB adapter; excludes FHIR/rows/pending state. |
| `src/lib/worker-client.ts` | `createWorkerClient`, WorkerClient | Worker constructor URL + protocol; correlation, disposal, typed error mapping. |
| `src/workers/lab.worker.ts` | module worker event entry, runtime construction | runtime only; top-level no UI/store, catches errors into DTOs. |
| `src/workers/runtime.ts` | `createWorkerRuntime(deps):WorkerRuntime`, `handle(request)`, `dispose()` | engines/DB/repository/types; mutation queue, revision gate, publication protocol. |
| `src/workers/handlers.ts` | `handleRequest(request,context):Promise<WorkerResponse>` typed exhaustive dispatch | runtime ports/engines; no duplicate persistence path or default no-op cases. |
| `src/app/lab-controller.ts` | LabController/LabStorePort/createLabController, event→fact translation | worker-client/types; request correlation and snapshots only, no business rules. |
| `src/store/lab-store.ts` | LabState/LabActions/LabStore/createLabStore | Zustand/controller/preferences; contracts §9, immutable snapshots. |
| `src/store/selectors.ts` | `selectSelectedResource`, `selectVisibleModules`, `selectSelectedViews`, `selectIssues`, `selectGraph`, `selectMissionStates`, `selectCanCommit` | readonly state/domain graph/evaluator; memoized by revision and inputs. |
| `src/store/provider.tsx` | `LabProvider`, `useLabStore`, `useLabStoreApi` | React context/Zustand; one app store, injectable for tests. |
| `src/main.tsx` | React 18 createRoot + StrictMode, app composition and stylesheet imports | app/store/controller; one worker lifecycle. |
| `src/App.tsx` | `App():React.JSX.Element` | provider/layout/error boundary; root only, no embedded domain logic. |
| `src/styles/index.css` | Tailwind directives, semantic tokens, global/reset/focus/reduced-motion/ReactFlow overrides | no competing style framework, no remote assets. |

### 12.5 Component files — exports, dependency boundaries, invariants

Unless stated otherwise, `Foo.tsx` exports `Foo(props: FooProps): React.JSX.Element` and its named `FooProps` interface. Container components may have empty props and consume narrow `useLabStore` selectors/actions. Controlled leaves depend only on types/shared visual components. No file imports DB or worker internals. JSX files are not allowed to define normalization, FHIRPath, financial, transaction, merge, or conformance algorithms.

| Exact file | Props/responsibility/dependency invariant |
|---|---|
| `src/components/layout/AppShell.tsx` | container renders header/panels and global status; requires initialized/failed handling. |
| `src/components/layout/Header.tsx` | version/revision/status and import/export/reset controls; container actions, synthetic notice always visible. |
| `src/components/layout/ThreePanelLayout.tsx` | props `{left,center,right:ReactNode}`; controlled widths/mobile selection via store; keyboard/pointer resize, no dataset writes. |
| `src/components/layout/ResponsivePanelNav.tsx` | props `{active,onChange}` from mobile panel union; semantic nav, no draft unmount. |
| `src/components/shared/AppErrorBoundary.tsx` | React class boundary with `{children,onRecover}` props and typed error state; no swallowing errors as success. |
| `src/components/shared/Panel.tsx` | PanelProps; semantic heading/body/actions and independent scroll. |
| `src/components/shared/Tabs.tsx` | generic typed `{items,value,onChange,label}`; real tablist/panels/keyboard relationships. |
| `src/components/shared/StatusBadge.tsx` | StatusBadgeProps; textual status/help from data, color not sole meaning. |
| `src/components/shared/CodeEditor.tsx` | CodeEditorProps; labeled textarea, errors, run shortcut, no Monaco/CodeMirror dependency. |
| `src/components/shared/JsonTree.tsx` | `{value:JsonValue,selectedPath,onSelectPath}`; escaped recursive display, stable paths/expand controls. |
| `src/components/shared/DataTable.tsx` | DataTableProps; NULL/decimal/JSON rendering, caption, empty state, bounded rows. |
| `src/components/shared/ResourcePicker.tsx` | ResourcePickerProps; stable type/id option values and search/filter. |
| `src/components/shared/Dialog.tsx` | DialogProps; native dialog or accessible equivalent, focus/escape restoration. |
| `src/components/shared/AsyncState.tsx` | `{status,error?,emptyMessage?,children}`; loading/error/empty semantics with live regions. |
| `src/components/learning/LearningPanel.tsx` | container for full left panel; selected module/filter/progress. |
| `src/components/learning/AdoptionFilter.tsx` | `{selected:readonly ImplementationStatus[],onChange}`; three toggles OR semantics. |
| `src/components/learning/ModuleNavigation.tsx` | `{modules,selectedId,onSelect}`; all 12 accessible and count/empty state. |
| `src/components/learning/ModuleCard.tsx` | `{module,selected,completedCount,onSelect}`; mixed badges and completion, no fake locked module. |
| `src/components/learning/ModuleLesson.tsx` | `{module,onNavigate}`; render LessonBlock comparisons/examples/refs, links safe external. |
| `src/components/learning/MentalModel.tsx` | `{law, onSelectLaw}`; five laws and domain-level model, mapping navigation. |
| `src/components/learning/MissionChecklist.tsx` | `{missions,states,onAcknowledge,onNavigate}`; computed checks vs conceptual acknowledgment, hint/evidence/current health. |
| `src/components/learning/SqlFhirCheatsheet.tsx` | `{onNavigate}` + cheatsheet catalog; SQL/FHIR pairs with runnable links. |
| `src/components/workspace/WorkspacePanel.tsx` | container renders toolbar/tabs and four work surfaces; preserve editor drafts on tab switch. |
| `src/components/workspace/ScenarioToolbar.tsx` | container hospital/scenario/change/reset; dirty-draft guard and visible revision. |
| `src/components/normalization/NormalizationSandbox.tsx` | container source/preview/commit/merge workflows; uses store, cannot sync DB directly. |
| `src/components/normalization/SourceEditor.tsx` | `{profile,value,onChange,error,onPreview,disabled}`; CodeEditor wrapper, source format explanation. |
| `src/components/normalization/HospitalProfileSummary.tsx` | `{profile}`; declared namespaces/formats/field catalog, no live rule computation. |
| `src/components/normalization/MappingTraceTable.tsx` | `{trace,onSelect}`; source→law→FHIR→table jump, typed paths. |
| `src/components/normalization/NormalizationPreview.tsx` | `{preview,stale,pending,onApply,onSelect}`; resources/issues and commit disabled for stale/errors. |
| `src/components/normalization/PatientMergeDialog.tsx` | `{open,onClose}` container selected survivor/duplicate/decisions/preview/commit; explicit conflict resolution, reciprocal links preview. |
| `src/components/evidence/EvidenceChainEditor.tsx` | container selects claim/encounter, displays editors and summary; typed dispatch only. |
| `src/components/evidence/EvidenceResourcePicker.tsx` | `{allowedTypes,encounterKey,value,onChange}`; offers compatible evidence and explains incompatible resources without hiding existing bad links. |
| `src/components/evidence/DiagnosisRoleEditor.tsx` | `{encounter,conditions,onApply}` emits set-encounter-diagnosis; role/rank positive validation, no Condition field mutation. |
| `src/components/evidence/ClaimItemEditor.tsx` | `{claim,item?,onApply,onRemove}` typed ClaimItemCommand; mandatory product/category/encounter/net, sequence links. Remove routes through canonical resource command. |
| `src/components/evidence/EvidenceLinkDialog.tsx` | `{owner,target?,open,onApply,onClose}`; supported EvidenceCommand only, type/path previews. |
| `src/components/evidence/AdjudicationEditor.tsx` | `{resource:ClaimResponse|EOB,onApply}` typed AdjudicationCommand; correct array totals, insurance where needed, no Claim.total array. |
| `src/components/evidence/EvidenceSummary.tsx` | `{claimKey,report,financialSummary}`; provenance/evidence/amount health, no independent reconciliation calculation. |
| `src/components/graph/ResourceRelationshipGraph.tsx` | container domain graph→ReactFlow using adapter; click selection/typed link, stable layout/persistent positions. |
| `src/components/graph/ResourceNode.tsx` | `NodeProps<ResourceFlowNode>`; type/status/issues, accessible resource selection. |
| `src/components/graph/ReferenceEdge.tsx` | `EdgeProps<ReferenceFlowEdge>`; actual relation/path label and unresolved styling; no hidden data edits. |
| `src/components/graph/GraphToolbar.tsx` | `{filters,showUnresolved,onFiltersChange,onFit}`; legend and text labels. |
| `src/components/graph/GraphAccessibleList.tsx` | `{graph,onSelect,onEditLink}`; equivalent keyboard navigation to nodes/edges. |
| `src/components/graph/flow-adapter.ts` | exports `ResourceFlowNode`, `ReferenceFlowEdge`, `toFlowGraph(domainGraph)` | @xyflow types/domain DTOs only; no domain rule duplication. |
| `src/components/sql/SqlConsole.tsx` | container example/editor/run/result/error/revision; actual store query action. |
| `src/components/sql/SqlExamplePicker.tsx` | `{examples,selectedId,onSelect}`; query load only, no fabricated execution. |
| `src/components/sql/QueryResultTable.tsx` | `{result:QueryResult|null,error:LabError|null,onSelectResource}`; precision/null/types/truncation/runtime, DataTable. |
| `src/components/inspector/InspectorPanel.tsx` | container resource picker and exactly four tabs, selection breadcrumb. |
| `src/components/inspector/FhirJsonInspector.tsx` | container selected committed/draft resource + JsonTree/annotations; explicit draft edit/apply, raw export clean. |
| `src/components/inspector/AnnotationPopover.tsx` | `{annotations,issues}`; Indonesian teaching sidecars and standards origin. |
| `src/components/inspector/ViewDefinitionInspector.tsx` | container canonical/override view selection, edit/preview/apply/restore; header vs item shown distinctly. |
| `src/components/inspector/PostgreSqlInspector.tsx` | container schema/list/page/raw row, all 30 SQL objects discoverable. |
| `src/components/inspector/SchemaBrowser.tsx` | `{tables,views,counts,selected,onSelect}`; types/FKs and status; no guess at schema from first result row. |
| `src/components/inspector/ConformanceInspector.tsx` | container report/rerun and financial/transaction detail, valid/pending/not-applicable separate. |
| `src/components/inspector/RuleSummary.tsx` | `{results,onSelectRule}`; six stable rules and nonzero applicability semantics. |
| `src/components/inspector/ValidationIssueList.tsx` | `{issues,filters,onSelectIssue}`; exact resource/path navigation and origin labels, stable issue keys. |

ResourceSelector in hierarchy is the shared ResourcePicker, WorkspaceTabs and InspectorTabs are shared Tabs configured by their container; do not add duplicate implementations/files for these conceptual labels. Other conceptual hierarchy labels similarly map to the exact files above. `FinancialSummary` is a typed domain result exported by `domain/evidence.ts`, computed using money helpers in the worker and included in LabSnapshot as `financialSummaries: readonly FinancialSummary[]`; EvidenceSummary receives it without re-running validation in React. SchemaBrowser props use TableDefinition/catalog plus actual schema metadata supplied through table-page response; add `schema: readonly SqlColumnDefinition[]` to TablePage to avoid importing DB runtime into UI.

## 13. Verification specification and acceptance evidence

The architect does not execute builds/tests. The implementation owner/main agent must run the checks below after all implementation tasks land. Do not report them as passed until exercised. Tests must use real PGlite for database/SQL integration; pure-domain fixtures are allowed, mock query results are not evidence of working SQL.

### 13.1 Required test files

| File | Required assertions |
|---|---|
| `tests/setup-dom.ts` | happy-dom registration/Testing Library cleanup and deterministic browser APIs only; no fake engine behavior. |
| `tests/fixtures.ts` | typed deterministic Clock/IdFactory, baseline/exercise registry builders and expected identities/amounts. |
| `tests/normalizer.test.ts` | three distinct schemas, stable IDs/order independence, namespaces/leading zeros, terminology errors, decimal locales, BP components/no root, medication/Composition/Claim complete chains, missing references/no partial commit. |
| `tests/validator.test.ts` | each of six exact IDs pass/fail/not-applicable, all root/nested mandatory minima, false/zero, duplicate choices/sequences, full supported-resource fixture coverage, origin labeling. |
| `tests/observation-composition.test.ts` | true obs-7 shared-code case vs lab panel rule, BP wrong units/missing/duplicate components; recursive cmp-1, emptyReason-only failure, generated text+emptyReason success, cmp-2 entries conflict. |
| `tests/evidence-financial.test.ts` | wrong patient/encounter/missing reference/invalid item sequence; ServiceRequest via Encounter.basedOn; exact cents, missing totals vs zero, ledger scope, legitimate partial variance and addItem not double-counted. |
| `tests/fhirpath.test.ts` | parser quoting/URLs/escaped quotes/precedence/nested where/exists; collections/empty/false, choice primitive+complex types, typed/untyped keys, external/URN errors, unsupported syntax, bounds. |
| `tests/view-runner.test.ts` | exact one Claim header vs N detail rows; no items→header one/detail zero; forEachOrNull empty row, sibling cross products, nested focus/root parent key, unionAll schemas, scalar cardinality errors, all 27 view/schema contracts. |
| `tests/bundle-transaction.test.ts` | unsorted input ordered execution/original response order, all four methods, forward/circular urns, reference-only rewrite (identifier/narrative untouched), duplicate IDs/fullUrls, unsupported conditional ops, failed GET/write no partial candidate publication. |
| `tests/patient-merge.test.ts` | reciprocal link types/inactive duplicate, existing seealso preserved not canonical, same bare id other resource untouched, all supported Patient refs rewritten, verified identity conflict/cycle/self/repeated merge, derived replaced_by column. |
| `tests/pglite-schema.test.ts` | instantiate actual PGlite; exact 27 public tables + 3 public views, columns/raw_fhir/status checks/FKs/indexes; baseline projection and query expected rows, missing optional totals NULL, fractional daysSupply. |
| `tests/pglite-sync.test.ts` | atomic full replacement, claim item deletion/reorder, diagnosis update/removal/preference/null clearing, multiple encounters, reference-safe delete, repeated response aggregation/no fan-out, same-name hospitals separate. |
| `tests/runtime-persistence.test.ts` | actual IndexedDB-compatible adapter test harness, expected-revision conflict, save failure rolls back PG, crash/reload derivation, recovery after PG commit failure, old snapshot never marked new, singleton/read-only ownership/session-only mode. |
| `tests/worker-store.test.ts` | protocol exhaustiveness, initialize idempotence, request correlation/late responses, stale previews/query labels, failed command draft retention, no pending state persisted, graph position changes no revision, disposal errors pending requests. |
| `tests/curriculum.test.ts` | 12 modules, all 36+ missions unique, all resources covered, status OR filtering, actual predicates nonapplicable not passed, SQL assertions, historical vs current health, correct source refs. |
| `tests/ui-panels.test.tsx` | full three-panel component hierarchy, four live inspector tabs, source parse failure, typed evidence apply, graph/path→inspector sync, valid JSON copy without annotations, real table/view selection, loading/error/empty semantics. |
| `tests/ui-accessibility.test.tsx` | keyboard tabs/separators/dialogs, labels/focus, non-color badges, empty-filter recovery, responsive panel draft retention. |
| `e2e/full-lab.spec.ts` | browser loads WASM worker/PGlite without backend/CDN, all hospitals normalize, all twelve modules navigable, BP repair, discharge repair, evidence+Claim two items, partial adjudication/EOB, Bundle success+atomic failure, merge, all three SQL recap queries, reload persistence and import/export roundtrip. |
| `e2e/responsive-accessibility.spec.ts` | desktop three-panel layout, mobile nav/no overflow/draft loss, keyboard-only main workflow, axe critical/serious issues zero, 200% zoom/reduced motion. |

Bun DOM tests need not run real browser workers; worker/runtime contract tests can inject actual engine adapters and a deterministic message transport. Browser E2E **must** exercise the real module worker, Vite asset loading, IndexedDB, and PGlite WASM. Do not replace these with mocked UI counts.

### 13.2 Acceptance gates / no partial delivery

The main agent should run: `bun install --frozen-lockfile` (after initial lock generation), `bun run typecheck`, `bun test`, `bun run build`, `bun run test:e2e`. Inspect browser console/worker errors during E2E. Record actual command outcomes, not architectural predictions. No architectural requirement is satisfied solely because an interface compiles.

Release gate checklist:

- All §12 files and substantive content implemented; no placeholders, stubs, TODO implementations, fake validator/SQL fallbacks, missing Phases 3–6, or dead UI actions.
- All 27 SQL tables and 3 views, raw/status columns, mapping contracts, complete cross-hospital clinical→financial chains and nonprojected resource persistence are live.
- Claim header/item separation, correct three total shapes, BP no-root behavior, cmp-1-compatible empty sections, ordered atomic URN transaction, diagnosis sync, Patient.link merge all demonstrated.
- Six rules produce truthful applicable reports; right tabs show the same committed revision as center graph/source and DB.
- Twelve modules, colored+text filter, mental model, computed missions, cheatsheet, full normalizer/evidence/graph/SQL center and four inspection tabs are operational.
- Desktop/mobile/a11y/error/recovery/privacy flows implemented, README/changelog accurate, no backend dependencies or hidden external data submission.

## 14. Implementation task decomposition (non-overlapping ownership)

Implement all phases, not an engine-only cut. The tasks below are labels for handoff, not unfinished tracking items. Shared contracts land first; parallel workers own disjoint paths. Cross-task contract changes are coordinated before editing someone else's file.

| Task label / phase | Exclusive file targets | Dependencies / deliverable |
|---|---|---|
| **T00-CONTRACTS-TOOLCHAIN** / Phase 1 | root/config files, `src/types/**`, `src/vite-env.d.ts` | defines all contracts/package pins/strict config; consult downstream signature needs before freezing. |
| **T01-R4-METADATA-DOMAIN** / Phase 1 | `src/domain/**`, `src/data/statuses.ts`, `src/data/terminology.ts`, `src/data/fhir/r4-elements.json` | T00; reference graph/identity/money/profile/evidence/transaction plan and honest R4 metadata. |
| **T02-SYNTHETIC-DATA-NORMALIZER** / Phase 1 | `src/lib/normalizer.ts`, `src/lib/normalization/**`, `src/data/hospitals/**`, `src/data/fhir/*.json` **except r4-elements.json**, `src/data/scenarios.ts` | T00+T01; all adapters/resources/exercise scenarios, no omission of financial/workflow/quality. |
| **T03-SIX-RULE-CONFORMANCE** / Phase 1 | `src/lib/fhir-validator.ts`, `src/lib/validation/**` | T00+T01; all six rules including structural/lab differentiation and evidence/financial details. |
| **T04-NATIVE-VIEW-RUNNER** / Phase 2 | `src/lib/sql-on-fhir-flattener.ts`, `src/lib/fhirpath/**`, `src/lib/sql-on-fhir/**`, `src/data/view-definitions/**` | T00+T01; grammar/selection/key semantics and all 27 table projections + diagnostic preview. |
| **T05-BUNDLE-PATIENT-MERGE** / Phase 2 | `src/lib/bundle-transaction.ts`, `src/lib/patient-merge.ts` | T00+T01; shared domain planner/walker, no edits in domain owned by T01 without coordination. |
| **T06-PGLITE-WORKER-PERSISTENCE** / Phase 2 | `src/lib/db/**`, `src/lib/persistence/dataset-repository.ts`, `src/lib/worker-client.ts`, `src/workers/**` | T00–T05 stable contracts; corrected full schema/SQL/runtime pipeline/real persistence. |
| **T07-STATE-ORCHESTRATION** / Phase 3 | `src/store/**`, `src/app/**`, `src/lib/persistence/preferences.ts` | T00+worker DTOs; complete state/actions/correlation, not UI business rules. |
| **T08-TWELVE-MODULE-CONTENT** / Phase 4 | `src/types` **not editable**, `src/data/curriculum/**`, `src/data/cheatsheet.ts`, `src/data/annotations.ts`, `src/data/sql-examples.ts`, `src/lib/mission-evaluator.ts`, `src/lib/annotations.ts` | T00+T02/T04; actual curriculum/missions/examples, no overlap with shared contracts. |
| **T09-SHELL-LEARNING-UI** / Phase 5 | `src/main.tsx`, `src/App.tsx`, `src/styles/**`, `src/components/layout/**`, `src/components/shared/**`, `src/components/learning/**` | T00+T07+T08; accessible responsive shell and full left panel/shared primitives. |
| **T10-CENTER-LAB-UI** / Phase 5 | `src/components/workspace/**`, `src/components/normalization/**`, `src/components/evidence/**`, `src/components/graph/**`, `src/components/sql/**` | T00+T07+T09 shared-prop contracts; all four center tools wired to real worker actions. |
| **T11-LIVE-INSPECTORS** / Phase 5 | `src/components/inspector/**` | T00+T07+T09; exactly four live inspection tabs and cross-panel selection. |
| **T12-FULL-ACCEPTANCE-HANDOFF** / Phase 6 | `tests/**`, `e2e/**`, `README.md`, `CHANGELOG.md` | contracts/content complete; unit/integration/browser coverage and accurate handoff documentation. Main agent runs verification once after all tasks land. |

README/CHANGELOG ownership transfers from T00 initial creation to T12 final substantive content by explicit coordination; no simultaneous edits. `docs/spec.md` remains architectural ownership. T08's explicit not-editable types target prevents accidental contract overlap; needed changes go to T00. T02 raw FHIR JSON ownership excludes metadata owned by T01. Do not split files differently without preserving these non-overlap guarantees and the dependency direction.

**Definition of complete:** one coherent browser application implementing all core engines **and** state, substantive curriculum, entire three-panel interactive UI, durability/recovery and the acceptance behaviors above. No shim, mock analytical engine, engine-only scaffold, or promise of a later UI phase qualifies.
