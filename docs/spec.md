# Universal 5-Stage Production Pipeline
## Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox

**Status:** Dokumen spesifikasi arsitektur dan rencana Fase 2; bukan laporan implementasi selesai, sertifikasi HL7, atau bukti integrasi SATUSEHAT.

**Normative baseline:** HL7 FHIR R4 `4.0.1`; SQL-on-FHIR `2.0.0`; profil nasional hanya jika use case, versi, environment, terminologi, dan evidence disebutkan. `00-master-manifest.md`, `02-tech-and-architecture.md`, `08-workflow-environments.md`, dan `layout.md` adalah aturan kanonikal repository.

**Verification boundary:** Isi ini mendefinisikan target yang harus diimplementasikan dan diuji. Klaim `pass` hanya boleh ditulis setelah bukti aktual dicatat; status default untuk national conformance dan terminology yang tidak tersedia adalah `not-assessed`.

## 0. Tujuan, scope, dan batas klaim

Aplikasi mengajarkan dekomposisi row SIMRS menjadi graph resource FHIR, validasi berlapis, proyeksi SQL-on-FHIR, dan analitik lokal PGlite melalui tiga panel React. Fokusnya adalah tiga seed rumah sakit sintetis dan skenario learning lab, bukan server FHIR, terminology server, payment gateway, digital-signature verifier, atau integrasi API nasional.

Empat lapisan penilaian harus selalu dibedakan:

| Lapisan | Dinilai terhadap | Tidak boleh diklaim |
|---|---|---|
| Core R4 | R4 4.0.1 structure, cardinality, choice, invariant, binding, reference | enam rule group lokal adalah seluruh validator HL7 |
| `lab-r4` | populated evidence, BP profile, finance reconciliation, merge policy | kebijakan demo adalah invariant universal |
| SQL-on-FHIR | SOF 2.0.0 ViewDefinition dan runner yang dinyatakan didukung | insert SQL membuktikan JSON FHIR valid |
| SATUSEHAT | named use case/profile/version/terminology/environment | URI nasional, badge, atau data sintetis berarti production-ready |

**Assessment states:** `pass`, `fail`, `not-assessed`; `valid` adalah convenience result untuk execution profile terpilih, bukan sertifikasi. Semua issue membawa source (`HL7_R4`, `SATUSEHAT`, `LAB_POLICY`, `PROJECTION`), path, severity, rule/profile, URL/version bila ada, dan provenance sumber.

## 1. Pipeline lima tahap

### Stage 1 — Source and contracts

Pin package/artifact `hl7.fhir.r4.core#4.0.1`, R4 model metadata, FHIRPath R4 engine, terminology evidence, exact-decimal arithmetic, dan SQL-on-FHIR 2.0.0. `src/types/fhir-global.ts` menjadi public boundary complete R4; tidak boleh ada schema R4 handwritten kedua yang parsial. Source adapters menyimpan source table/key dan timestamp asli.

### Stage 2 — Normalize

Adapter memetakan seed SIMRS ke graph resource menggunakan precedence:

`explicit sandbox override > mapped raw source value > documented fixture-only value`.

Input biasa yang invalid (negative/NaN/infinite/unsafe money, ambiguous entity, malformed date) menghasilkan `NormalizationError`; intentional negative-case injection diberi label dan tidak boleh masuk snapshot DB valid. Tidak ada city-driven payer/medication/order inference.

### Stage 3 — Assess

Reference index dibangun sebelum validator. Validator menerapkan core R4, selected `lab-r4`, dan national assessment secara terpisah. Contained resource diselesaikan dengan owner scope. Unsupported terminology/profile menghasilkan `not-assessed`, bukan fabricated pass.

### Stage 4 — Project and persist

FHIRPath model R4 + SOF-2 runner menghasilkan typed rows untuk 27 tabel. Row mempertahankan `(resourceType,id)`, hospital/dataset scope, `raw_fhir` JSONB, temporal lexeme, dan numeric precision. PGlite melakukan versioned migration dan satu transaction untuk snapshot valid saja; preview invalid tetap di UI.

### Stage 5 — Inspect and prove

Zustand menyimpan satu graph revision, assessment, SQL revision, merge state, dan query history. UI menampilkan FHIR/Bundle/contained JSON, provenance, validation issues, SQL rows/views, latency, dan last-valid snapshot. QA, reviewer, dan security audit menggunakan acceptance matrix §10.

## 2. Inventaris resource dan envelope

### 2.1 26 concrete top-level FHIR R4 resource types

Daftar kanonikal (tepat 26, tidak termasuk Bundle dan contained request):

1. Organization  2. Patient  3. Practitioner  4. Location  5. EpisodeOfCare  6. ServiceRequest  7. Encounter  8. Consent  9. Provenance  10. Condition  11. Procedure  12. Observation  13. DiagnosticReport  14. Medication  15. MedicationRequest  16. MedicationDispense  17. Composition  18. Appointment  19. Coverage  20. CoverageEligibilityResponse  21. Account  22. ChargeItem  23. Claim  24. ClaimResponse  25. ExplanationOfBenefit  26. MeasureReport.

`Bundle` adalah Resource envelope untuk transaction/inspection dan tidak mendapat analytical table. `CoverageEligibilityRequest` adalah fully modeled **contained resource** di dalam `CoverageEligibilityResponse` pada eligibility scenario:

```text
CoverageEligibilityResponse.contained[0].resourceType = CoverageEligibilityRequest
CoverageEligibilityResponse.contained[0].id = "eligibility-request"
CoverageEligibilityResponse.request.reference = "#eligibility-request"
```

Contained request harus memenuhi minimum R4 (`status`, non-empty `purpose`, `patient`, `created`, `insurer` sesuai selected profile), owner-scoped resolve, dan **tidak** menjadi top-level resource, catalog projected resource, atau tabel ke-28.

### 2.2 Resource-specific minimum and profile boundary

Implementasi memakai official R4 snapshots untuk seluruh nested elements. Ringkasan berikut mencegah over-requirement:

| Resource | Core minimum / mandatory focus | `lab-r4` requirement dan known boundary |
|---|---|---|
| Organization | `org-1` name or identifier; `org-2` address use not `home`; `org-3` period rules | provider/payor identities and work address are synthetic unless sourced |
| Patient | no universal business field beyond resource shape | selected identifier provenance, merge/link graph, source birth-date precision |
| Practitioner | no universal name | source-backed role/name; synthetic IHS is not MPI evidence |
| Location | no universal name/status | room identity, managingOrganization, physicalType when scenario supplies it |
| EpisodeOfCare | `status`, `patient`; type must have honest semantics | no misuse of `hacc`; period precision retained |
| ServiceRequest | `status`, `intent`, `subject` | code/order only when source supports it; no invented Observation links |
| Encounter | `status`, `class` | subject/period and diagnosis references selected by local profile; `appointment` is Reference[] |
| Consent | `status`, `scope`, category +; `ppc-1` policy or policyRule | synthetic training policy URI clearly labeled; category uses correct LOINC/value set |
| Provenance | target +, recorded, agent +, agent.who | first-target SQL summary is lossy and labeled; signature metadata is not verification |
| Condition | subject and conditional clinical/verification rules | Encounter diagnosis is authority; rank is not universal principal/comorbidity |
| Procedure | `status`, `subject` | performed[x] preserves Period vs dateTime; source procedure category only |
| Observation | `status`, `code`; component.code when component present; obs-3/6/7 | BP profile uses LOINC 85354-9 components 8480-6/8462-4, UCUM `mm[Hg]`; this is profile, not universal obs-7 |
| DiagnosticReport | `status`, `code` | result references only when source order/specimen semantics support them |
| Medication | no business field; ingredient.item[x] required when ingredient exists | `amount` is Ratio; MedicationType shape/system separately assessed |
| MedicationRequest | `status`, `intent`, medication[x], subject | exactly one medication choice; rich dosage optional unless profile requires |
| MedicationDispense | `status`, medication[x] | daysSupply is decimal SimpleQuantity; enforce `mdd-1` |
| Composition | `status`, `type`, `date`, author +, title | recursive `cmp-1`/`cmp-2`; five sections are scenario, not universal R4 |
| Appointment | `status`, participant +, participant.status | actor-or-type and app constraints; national API evidence is environment-scoped |
| Coverage | `status`, beneficiary, payor + | payor is polymorphic; no hard-coded BPJS for commercial scenario |
| CoverageEligibilityResponse | status, purpose +, patient, created, request CER, outcome, insurer | request must resolve to contained CoverageEligibilityRequest; eligibility independent from adjudication |
| Account | `status` | only R4 Account fields; analytics must not add diagnosis/procedure/balance as FHIR fields |
| ChargeItem | `status`, `code`, `subject` | `priceOverride` is total charge price; derived unit rate null for zero/absent quantity |
| Claim | status, type, use, patient, created, provider, priority, insurance + | sequence/choice/reference links and local financial equations; local codes use local URI |
| ClaimResponse | status, type, use, patient, created, insurer, outcome | totals are optional core; added-item adjudication reconciled independently |
| ExplanationOfBenefit | status, type, use, patient, created, insurer, provider, outcome, insurance + | currency, selected response policy, benefit/variance and multi-response cardinality explicit |
| MeasureReport | status, type, measure, period | illustrative score unless a computable Measure definition is present; `subjectResults` singleton |
| Bundle | `type`; type-specific bdl rules | transaction request/body/identity/fullUrl checks; client entry order is not an invariant |
| Contained CER | full R4 CER model and owner-scoped identity | never emitted as separate table/resource; inspected under response |

Core optional elements remain optional. Profile requirements are enforced before persistence, not fabricated in normalizer/flattener/database.

## 3. Data contracts and module interfaces

### 3.1 Canonical types

```ts
type SupportedTopLevelResource =
  Organization | Patient | Practitioner | Location | EpisodeOfCare |
  ServiceRequest | Encounter | Consent | Provenance | Condition | Procedure |
  Observation | DiagnosticReport | Medication | MedicationRequest |
  MedicationDispense | Composition | Appointment | Coverage |
  CoverageEligibilityResponse | Account | ChargeItem | Claim | ClaimResponse |
  ExplanationOfBenefit | MeasureReport;

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
```

`Resource` and `DomainResource` semantics are distinct; FHIR primitive metadata (`Element.id`, extensions, `_value`), datatypes, choice alternatives, and inherited fields are represented through the pinned R4 source. A typed field must reject both/zero choice where a selected contract requires exactly one, while runtime validation still accepts `unknown` safely.

### 3.2 Normalization and reference API

```ts
normalizeSimrsToFhir(
  seed: SimrsHospitalSeed,
  overrides?: SandboxClinicalFinancialOverrides,
): NormalizedHospitalDataset;

buildReferenceIndex(
  resources: readonly FhirResource[], bundle?: Bundle,
): ReferenceIndex;

resolveReference(
  reference: Reference, owner: FhirResource, index: ReferenceIndex,
  expectedTypes?: readonly string[],
): ReferenceResolution;
```

`ReferenceResolution` is discriminated: `resolved` (target/key/type/owner), `external` (supported URL not loaded), `logical` (identifier-only), `unresolved` (missing internal), `invalid` (malformed/wrong-type/ambiguous). Relative, absolute/history, URN, Bundle fullUrl, contained owner scope, and identifier references are handled explicitly. Rewrite may alter only `Reference.reference`, never narrative, identifier, canonical, signature, or arbitrary strings.

### 3.3 Assessment API

```ts
validateFhirDataset(
  dataset: NormalizedHospitalDataset,
  options?: { profile: 'lab-r4'; nationalProfile?: string },
): ValidationReport;
```

`ValidationReport` contains issues, six group summaries, and three assessment results (`coreR4`, `labProfile`, `national`), each with `pass|fail|not-assessed` and reason. No normalizer import from validator (avoid cycle); shared pure evidence metric may live in a separate contract helper.

### 3.4 SQL and database API

```ts
type SqlValue = string | number | boolean | null | readonly SqlScalar[];

evaluateFhirPath(
  resource: unknown, expression: string, rootResource?: unknown,
  context?: EvaluationContext,
): unknown[];

evaluateViewDefinition(
  view: ViewDefinition, resources: readonly FhirResource[],
  context?: EvaluationContext,
): Record<string, SqlValue>[];

flattenDatasetWithSqlOnFhir(
  dataset: NormalizedHospitalDataset,
): FlattenedDatasetResult;

initPgliteDatabase(existingInstance?: PGlite): Promise<PGlite>;
syncDatasetsToPglite(
  db: PGlite, datasets: readonly NormalizedHospitalDataset[],
): Promise<void>;

resolveAndMergeDuplicatePatient(
  db: PGlite | null, dataset: NormalizedHospitalDataset,
  duplicatePatientId: string, targetMasterPatientId: string,
): Promise<{ updatedDataset: NormalizedHospitalDataset; mergedPatient: Patient }>;
```

### 3.5 ViewDefinition separation

Portable ViewDefinition follows SOF-2 (`resourceType`, resource, name, status, select, optional where/constant, standard columns with name/path/type/collection/tags). Local metadata is separate:

```ts
type ProjectionDefinition = {
  view: ViewDefinition;
  targetTable: TableName;
  implementationStatus: 'implemented' | 'partial' | 'not-assessed';
  sourcePolicy: 'resource' | 'claim-item';
};
```

`targetTable`, national adoption, and implementation status must not be inserted into portable ViewDefinition. No private `splitType`, ad-hoc `+` coercion, or unknown-expression-to-null fallback.

## 4. Normalization mapping and invariants

- Every local code records source system/code/display, target system/code/display, mapping status, and evidence. Official namespaces cannot host invented DRG, inpatient subtype, comorbidity, or room codes.
- `Consent` satisfies `ppc-1` with real policy/policyRule and correct category binding; legal policy claims remain synthetic.
- `CoverageEligibilityResponse.request` points to contained CER `#eligibility-request`; outcome/inforce never derive from Claim adjudication.
- Local deterministic transaction uses `PUT ResourceType/id`; imported POST uses type-level URL, body, and server identity rules. Bundle fullUrls are not server-issued IDs.
- `Organization` address uses `work` or omitted use; Patient may use `home`. Patient IHS namespace is evidence-qualified; synthetic logical IDs are not MPI results.
- MedicationType uses national valueCodeableConcept shape and named system only where source evidence exists; KFA values remain unverified without authoritative lookup.
- Optional empty arrays/objects/strings are omitted. `false`, `0`, and explicit zero quantity remain values. No `||` fallback that changes zero.
- Financial arithmetic uses exact decimal and final overflow/finite/nonnegative checks. `ChargeItem.priceOverride` is total, never multiplied by quantity again. `Claim.item.net = quantity × unitPrice × factor` only in selected lab profile.
- Duplicate patient merge is identity graph operation: reject same ID/wrong type/cycle/ambiguity; update all typed references, named handles, Bundle, store, and DB atomically; preserve replaced-by provenance and idempotency.

## 5. Six application validation groups

These stable groups are navigation/report IDs, not official HL7 rules:

1. **Mandatory/cardinality:** all supported resources, contained resources, Bundle, nested arrays, primitive format, choice exclusivity, and binding strength. Optional core is not over-required; identifier-only Reference and text-only permitted concepts remain valid.
2. **Observation:** actual `obs-3`, `obs-6`, `obs-7`, value/absence choices, component rules. Matching root/component code is core error; different-code root + component may be valid. BP no-root rule is `lab-r4` only.
3. **Composition:** recursive `cmp-1 = text.exists() or entry.exists() or section.exists()`; `cmp-2` forbids entry with emptyReason; narrative XHTML and nested sections validated.
4. **Evidence/reference:** typed resolve, Bundle/fullUrl/URN/contained scope, duplicate identity, same-patient/same-encounter only where `lab-r4` requires, Encounter diagnosis, medication chain, Claim item links, eligibility request.
5. **Financial reconciliation:** selected lab equations, currencies, missing amount vs zero, duplicate category, response/EOB selection, addItem benefit exactly once. Never labels these equations universal R4.
6. **Bundle/HTTP contract:** bdl-1/2/3/4/5/7/8 and supplied type rules; request/body presence, POST/PUT identity, fullUrl and reference resolution; PATCH/HEAD are valid methods where capability is declared. Client entry ordering is accepted.

A group passes only when no error exists in its scope. Informational/unassessed notices remain visible.

## 6. SQL-on-FHIR v2 flattening contract

### 6.1 Evaluation semantics

- Sibling selections at every level are Cartesian products; an empty inner branch yields zero rows.
- Union branches have identical ordered schema and retain parent/sibling context. `forEachOrNull` emits every descendant column as null, not `{}`.
- Scalar: empty→null; singleton→typed scalar; multiple with `collection` absent/false→typed error; collection true→declared collection serialized as JSONB.
- `getResourceKey()` and typed/untyped `getReferenceKey()` return matching table-scoped identity; target resource type is separate. Claim item key: `%resource.getResourceKey() & '-' & sequence.toString()`.
- R4 model identity is preserved: Period is not dateTime, Quantity is not inferred from object shape, and `performed.ofType(dateTime)` is empty for performedPeriod.
- `where`, `constant`, path predicates, escaped literals, boolean/number types, `%resource` context, and supported SOF functions follow model-aware FHIRPath. Unsupported syntax is a structured error with view/column/path.
- Resource source identity is carried internally; no bare-id search. Claim-item `raw_fhir` is full Claim plus sequence, and optional raw item may be stored separately.
- Summary `first()` columns declare deterministic, lossy selection and match system + code where semantic identity requires it. Raw FHIR remains complete.

### 6.2 27 table registry

One table is registered for each 26 resource types plus Claim detail:

`fhir_organization`, `fhir_patient`, `fhir_practitioner`, `fhir_location`, `fhir_episode_of_care`, `fhir_service_request`, `fhir_encounter`, `fhir_consent`, `fhir_provenance`, `fhir_condition`, `fhir_procedure`, `fhir_observation`, `fhir_diagnostic_report`, `fhir_medication`, `fhir_medication_request`, `fhir_medication_dispense`, `fhir_composition`, `fhir_appointment`, `fhir_coverage`, `fhir_coverage_eligibility_response`, `fhir_account`, `fhir_charge_item`, `fhir_claim`, `fhir_claim_item`, `fhir_claim_response`, `fhir_explanation_of_benefit`, `fhir_measure_report`.

Every table has source identity, hospital/dataset scope, and `raw_fhir JSONB`; Claim item has `claim_id`, positive `sequence`, unique `(claim_id, sequence)`, and parent Claim JSON. Do not add Bundle or contained CER tables. Use TEXT for legal FHIR strings/references/URIs/narratives, NUMERIC for decimals, and lexeme columns for partial date/time. Optional core projections are nullable; lab persistence constraints are checked before write.

### 6.3 Three views

1. `vw_fhir_clinical_diagnosis_recap`: cardinality-safe patient/encounter/condition recap; merged identity canonicalization is not MPI; organizations group by ID, not display.
2. `vw_fhir_financial_claim_recap`: one contribution per Claim; deterministic latest eligible response (created instant then stable ID); no mixed-currency aggregation; unknown benefit remains unknown.
3. `vw_fhir_clinical_to_claim_audit`: principal diagnosis follows Claim diagnosis type, not rank alone; selected EOB joins are explicit; composition evidence status is not auto-labeled complete.

## 7. Catalog and curriculum boundary

There are exactly 35 catalog entries and 12 curriculum lessons. They are not 35 resource modules. Catalog metadata must distinguish `resourceTypes`, `conceptTypes`, `projectionTables`, `labCapability` (`projected|envelope|embedded|partial|not-implemented`), `conformance`, and evidence-based national adoption. Counts derive from arrays, not literals.

Five roadmap groups remain not implemented in this lab: HealthcareService/Device, AllergyIntolerance/Specimen/ImagingStudy, Schedule/Slot/Task, Invoice/Payment*, and PlanDefinition/GuidanceResponse/Measure definitions. Contained CER is eligibility support, not Invoice/Payment implementation. Terminology JavaScript dictionaries are not CodeSystem/ValueSet/ConceptMap resources. MeasureReport is illustrative unless a computable Measure is present.

Each lesson defines objective, pinned source, resource/profile context, valid JSON, intentional invalid JSON, and inspectable JSON/validator/SQL evidence. Levels 1–5 are learning taxonomy, not certification. Curriculum must explicitly teach Resource vs DomainResource vs datatype vs logical model vs analytical table, identifier/reference/terminology, optionality and choices, obs-3/6/7, cmp-1/2, bdl-3, eligibility contained request, financial distinction, merge identity, and SOF cross-join/union/cardinality.

## 8. Presentation, store, and security boundary

At `xl` (1280px), preserve `LeftCurriculumPanel` (12 lessons/35 catalog), `CenterSandboxPanel` (raw→FHIR→SQL graph and simulations), and `RightInspectorPanel` (FHIR/Bundle/contained JSON, SQL/views, sourced issues) as defined in `layout.md`. Invalid preview and last-valid SQL revision must be explicit. Status text must name assessment profile and evidence state; never generic “DATASET CONFORMANT”. JSON/narrative is text-rendered; copy, keyboard focus, local overflow, and reduced motion are required.

Store writes and merge are queued/atomic. Query values are parameterized. SQL console is local education only. No network call or credential belongs in synchronous validator/render. National submission is never implied by local PGlite commit.

## 9. File-by-file Fase 2 work packages

Write ownership is exclusive. Shared contracts land first; dependent packages may then run in parallel. Main integrates and verifies once after all packages land.

| Task label / dependency | Exclusive target files | Deliverable |
|---|---|---|
| **ARCH-R4-CONTRACTS** / first | `src/types/fhir-global.ts`, `src/data/fhir-r4-conformance.ts` (new), `package.json`, `bun.lock` | Complete pinned R4 datatypes/backbones/choices, Resource vs DomainResource, contained CER, normalized/profile/assessment/projection/catalog contracts, provenance and dependency hashes. |
| **CORE-REFERENCE-GRAPH** / contracts | `src/lib/fhir-references.ts` (new) | Typed builders, `(type,id)`/fullUrl index, owner-contained resolution, external/logical states, duplicate/cycle checks, Reference-only rewrite. |
| **DATA-SOURCE-AND-TERMINOLOGY** / contracts | `src/data/simrs-normalization-seeds.ts` | Explicit raw medication/payor/order/eligibility/timestamp fields, source mappings, synthetic labels, local code systems, no city inference, corrected semantics. |
| **CORE-NORMALIZATION-CUTOVER** / contracts + refs + seeds | `src/lib/fhir-normalizer.ts` | Explicit adapters/precedence, 26 resources, Bundle PUT contract, contained CER, Consent policy/category, MedicationType, omitted empties, eligibility/adjudication separation, N01–N12. |
| **VALIDATION-R4-SIX-GROUPS** / contracts + refs | `src/lib/fhir-validator.ts` | Complete core/nested shape and six groups, official invariants/bindings, profile/national assessment states, source-bearing localized issues, financial/evidence metrics, safe unknown handling. |
| **SOF2-RUNNER-AND-PROJECTIONS** / contracts + refs | `src/lib/sql-on-fhir-flattener.ts` | Model-aware FHIRPath/SOF-2 runner, cross-join/union/null/cardinality/typed-key semantics, 27 projections, raw source identity, decimals/temporal lexemes, EOB currency, no defaults. |
| **PGLITE-SCHEMA-AND-MERGE** / contracts + refs + projections | `src/lib/pglite-db.ts` | Idempotent migrations, exact 27 tables/3 views, schema-parity registry, TEXT/NUMERIC/precision fixes, claim detail raw_fhir, cardinality-safe views, atomic snapshot/merge/rollback. |
| **CURRICULUM-EVIDENCE-CUTOVER** / contracts | `src/data/curriculum-modules.ts`, `01_master_plan_architecture_and_fhir_normalization.md`, `02_data_schema_curriculum_and_ai_agent_prompt.md` | Honest 35-entry metadata, 12 lessons, five laws, SQL-vs-FHIRPath distinction, source-backed national evidence and historical/non-normative corrections. |
| **UI-STORE-ASSESSMENT-CUTOVER** / contracts; core integration | `src/store/use-fhir-store.ts`, `src/components/StatusBadge.tsx`, `src/components/LeftCurriculumPanel.tsx`, `src/components/CenterSandboxPanel.tsx`, `src/components/RightInspectorPanel.tsx`, `src/App.tsx` | Call-site cutover, sourced assessment labels, invalid-preview/last-valid distinction, Bundle/contained inspection, derived counts, merge/override persistence, rule-group counts (not issue count). |
| **QA-R4-SOF2-REGRESSIONS** / all contracts | `tests/fhir-lab.test.ts` | Full acceptance matrix §10; remove tests encoding wrong standards; no unrelated UI changes. |
| **DOC-FINAL-TRACEABILITY** / all owners | `docs/spec.md`, `docs/README.md`, `docs/DOCUMENTATION_STATUS.md`, `.agents/HANDOFF.md`, `.agents/rules/00-master-manifest.md`, `.agents/rules/02-tech-and-architecture.md` | Record actual dispositions/evidence, synchronize names/counts/boundaries; do not fabricate verification. |

`src/main.tsx`, styling, and unrelated layout remain unchanged unless a direct contract callsite requires it. No package owns another task's exclusive files.

## 10. Acceptance and verification matrix

### A. Models and standards

- Compile positive/negative fixtures for all 26 resources, Bundle, contained CER, choices, primitive metadata, and nested cardinality; malformed `unknown` returns localized issues without throw.
- Normal fixtures have no core errors under pinned R4 4.0.1; unassessed terminology/profile evidence remains visible. No national pass without named profile/version/environment.
- Test optional core absence, text-only concepts where binding permits, identifier-only Reference, false/zero, omitted empty values, MedicationType valueCodeableConcept, exact namespaces, org-2, ppc-1, ces request target.
- Test obs-7 matching root/component negative, different-code root/component positive, BP profile-only negative, UCUM system mismatch, absence reasons; cmp-1 nested-only positive, emptyReason-only negative, cmp-2 entry+emptyReason negative; Bundle bdl-3/request/body/identity/fullUrl and permutation positive.

### B. Normalization, identity, and money

- Change raw diagnosis/status/time/billing independently and confirm source mapping; explicit override wins; unrelated rows cannot collapse.
- Jakarta commercial payer stays commercial; unsupported links are omitted, not invented. Reference rewrite changes only Reference.reference and detects duplicate identities.
- Evidence cases cover wrong patient/encounter, missing diagnosis, broken medication chain, invalid Claim item and contained request. Merge rejects same ID/cycle/wrong type, updates every graph handle/Bundle/SQL, remains idempotent, and rolls back on injected persistence failure.
- Money tests cover zero/decimal quantity and daysSupply, negatives/NaN/infinity/unsafe products, factor, missing amount/currency, duplicate adjudication categories, multiple addItems, all outcome states. ChargeItem total is not multiplied twice; added benefit counted exactly once.

### C. SQL-on-FHIR

- Root/nested sibling Cartesian product, empty forEach, complete outer-null descendants, union+parent/sibling context, schema mismatch rejection.
- Scalar multiplicity errors, collection preservation, where/constant, typed literals/escaping, `%resource`, valid concatenation, unsupported syntax diagnostics, typed reference keys, Period vs dateTime, Quantity type, and no defaults.
- Every executable catalog expression parses in its advertised context; prose/SQL expressions are labeled and not evaluated as FHIRPath.

### D. Database and parity

- Fresh and prior-instance migration is idempotent; exactly 27 tables and 3 canonical views exist; registry equals insert columns and information_schema.
- All 27 tables, including Claim item, retain correct source JSON object; no `{}` fallback. Long legal strings/references, partial date/time, period times, offset/lexeme, NUMERIC fractional daysSupply round-trip.
- Multiple responses/EOBs are cardinality-safe; views select deterministically and never mix currencies or count a Claim twice. Invalid preview cannot overwrite last-valid SQL.
- 35 catalog entries, 12 lessons, five not-implemented groups, contained CER scope, and evidence-based national labels reconcile with actual capabilities.

### E. Evidence ledger and gates

Before declaring implementation complete, `docs/DOCUMENTATION_STATUS.md` records for every check: finding/test ID, input/scenario, standard/tool version, expected result, observed result, diagnostics, artifact path, and limitation. Required repository commands are `bun run typecheck`, `bun test`, `bun run build`, and integrated `bun run ci`; Main runs them after integration. Browser smoke covers all three hospitals, 12 lessons, JSON/Bundle/contained inspection, invalid simulation, merge/edit, and last-valid SQL behavior. Independent pinned R4 and SQL-on-FHIR fixtures are required; missing tooling is an unmet prerequisite, not a skipped pass.

No statement may claim “100% FHIR”, national production readiness, or successful submission without actual evidence and authorization. Capability gaps remain explicit; no stubs, no placeholder implementations, no silent suppression.

## 11. Change record

- Reconciled 26 concrete resource types, separate Bundle, contained CER, 27 analytical tables, and three canonical `vw_` views.
- Separated core R4, local `lab-r4`, SQL-on-FHIR, and SATUSEHAT assessment boundaries.
- Defined typed contracts for normalizer, reference graph, six validation groups, SOF-2 flattener, PGlite, merge, UI/store, and security boundaries.
- Corrected eligibility request target, Consent/Organization/MedicationType boundaries, financial semantics, SOF sibling/union/cardinality rules, temporal/decimal preservation, and no-default policy.
- Added non-overlapping file-by-file work packages for coder, tester, reviewer, and security audit.
- This document is a plan/specification update only; implementation and verification remain future work until evidence is recorded.
