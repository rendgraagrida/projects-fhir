export type ImplementationStatus = 'IMPLEMENTED_SATUSEHAT' | 'PARTIAL_NATIONAL' | 'PIONEER_GLOBAL_FHIR';

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old' | string;
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}
export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}
export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>' | string;
  unit?: string;
  system?: string;
  code?: string;
}
export type SimpleQuantity = Omit<Quantity, 'comparator'>;
export interface Money {
  value?: number;
  currency?: string;
}
export interface Period {
  start?: string;
  end?: string;
}
export interface Extension {
  url: string;
  valueCode?: string;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueCoding?: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueReference?: Reference;
  extension?: Extension[];
}
export interface Narrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}
export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing' | string;
  type?: 'postal' | 'physical' | 'both' | string;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  extension?: Extension[];
}
export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden' | string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}
export interface Signature {
  type: Coding[];
  when: string;
  who: Reference;
  onBehalfOf?: Reference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
}

export interface FhirResourceBase {
  resourceType: string;
  id?: string;
  meta?: { versionId?: string; lastUpdated?: string; profile?: string[]; tag?: Coding[] };
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: FhirResource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
}

export interface Organization extends FhirResourceBase {
  resourceType: 'Organization';
  id: string;
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name: string;
  alias?: string[];
  telecom?: { system?: string; value?: string; use?: string }[];
  address?: Address[];
  partOf?: Reference;
}
export interface Patient extends FhirResourceBase {
  resourceType: 'Patient';
  id: string;
  identifier?: Identifier[];
  active?: boolean;
  name: HumanName[];
  telecom?: { system?: string; value?: string; use?: string }[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  managingOrganization?: Reference;
  link?: { other: Reference; type: 'replaced-by' | 'replaces' | 'refer' | 'seealso' }[];
}
export interface Practitioner extends FhirResourceBase {
  resourceType: 'Practitioner';
  id: string;
  identifier?: Identifier[];
  active?: boolean;
  name: HumanName[];
  telecom?: { system?: string; value?: string; use?: string }[];
  address?: Address[];
  qualification?: { identifier?: Identifier[]; code: CodeableConcept; period?: Period }[];
  communication?: CodeableConcept[];
}
export interface Location extends FhirResourceBase {
  resourceType: 'Location';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'suspended' | 'inactive';
  operationalStatus?: Coding;
  name: string;
  alias?: string[];
  description?: string;
  mode?: 'instance' | 'kind';
  type?: CodeableConcept[];
  physicalType?: CodeableConcept;
  telecom?: { system?: string; value?: string }[];
  address?: Address;
  managingOrganization?: Reference;
  partOf?: Reference;
}
export interface EpisodeOfCare extends FhirResourceBase {
  resourceType: 'EpisodeOfCare';
  id: string;
  identifier?: Identifier[];
  status: 'planned' | 'waitlist' | 'active' | 'onhold' | 'finished' | 'cancelled';
  statusHistory?: { status: string; period: Period }[];
  type?: CodeableConcept[];
  diagnosis?: { condition: Reference; role?: CodeableConcept; rank?: number }[];
  patient: Reference;
  managingOrganization?: Reference;
  period?: Period;
  referralRequest?: Reference[];
  careManager?: Reference;
}
export interface ServiceRequest extends FhirResourceBase {
  resourceType: 'ServiceRequest';
  id: string;
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code: CodeableConcept;
  orderDetail?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrencePeriod?: Period;
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference[];
  reasonCode?: CodeableConcept[];
  supportingInfo?: Reference[];
}
export interface Encounter extends FhirResourceBase {
  resourceType: 'Encounter';
  id: string;
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: Coding;
  classHistory?: { class: Coding; period: Period }[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: { type?: CodeableConcept[]; period?: Period; individual?: Reference }[];
  appointment?: Reference;
  period: Period;
  reasonCode?: CodeableConcept[];
  diagnosis?: { condition: Reference; use?: CodeableConcept; rank?: number }[];
  account?: Reference[];
  hospitalization?: { preAdmissionIdentifier?: Identifier; admitSource?: CodeableConcept; dischargeDisposition?: CodeableConcept; dischargeLocation?: Reference };
  location?: { location: Reference; status?: string; physicalType?: CodeableConcept; period?: Period }[];
  serviceProvider?: Reference;
}
export interface Consent extends FhirResourceBase {
  resourceType: 'Consent';
  id: string;
  status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
  scope: CodeableConcept;
  category: CodeableConcept[];
  patient: Reference;
  dateTime?: string;
  performer?: Reference[];
  organization?: Reference[];
  policy?: { authority?: string; uri?: string }[];
  provision?: { type?: string; period?: Period; actor?: { role: CodeableConcept; reference: Reference }[]; action?: CodeableConcept[] };
}
export interface Provenance extends FhirResourceBase {
  resourceType: 'Provenance';
  id: string;
  target: Reference[];
  occurredPeriod?: Period;
  occurredDateTime?: string;
  recorded: string;
  policy?: string[];
  activity?: CodeableConcept;
  agent: { type?: CodeableConcept; role?: CodeableConcept[]; who: Reference; onBehalfOf?: Reference }[];
  entity?: { role: 'derivation' | 'revision' | 'quotation' | 'source' | 'removal'; what: Reference }[];
  signature?: Signature[];
}
export interface Condition extends FhirResourceBase {
  resourceType: 'Condition';
  id: string;
  identifier?: Identifier[];
  clinicalStatus: CodeableConcept;
  verificationStatus: CodeableConcept;
  category: CodeableConcept[];
  severity?: CodeableConcept;
  code: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetPeriod?: Period;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: { summary?: CodeableConcept; assessment?: Reference[] };
  evidence?: { code?: CodeableConcept[]; detail?: Reference[] }[];
  note?: { text: string }[];
}
export interface Procedure extends FhirResourceBase {
  resourceType: 'Procedure';
  id: string;
  identifier?: Identifier[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performedString?: string;
  performer?: { function?: CodeableConcept; actor: Reference; onBehalfOf?: Reference }[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  followUp?: CodeableConcept[];
  note?: { text: string }[];
}
export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  interpretation?: CodeableConcept[];
  referenceRange?: { low?: Quantity; high?: Quantity; text?: string }[];
}
export interface Observation extends FhirResourceBase {
  resourceType: 'Observation';
  id: string;
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: { text: string }[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: { low?: Quantity; high?: Quantity; type?: CodeableConcept; text?: string }[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}
export interface DiagnosticReport extends FhirResourceBase {
  resourceType: 'DiagnosticReport';
  id: string;
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  result?: Reference[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
}
export interface Medication extends FhirResourceBase {
  resourceType: 'Medication';
  id: string;
  identifier?: Identifier[];
  code: CodeableConcept;
  status?: 'active' | 'inactive' | 'entered-in-error';
  form?: CodeableConcept;
  amount?: { numerator?: Ratio; denominator?: Ratio };
  ingredient?: { itemCodeableConcept?: CodeableConcept; itemReference?: Reference; isActive?: boolean; strength?: Ratio }[];
}
export interface Ratio { numerator?: Quantity; denominator?: Quantity }
export interface MedicationRequest extends FhirResourceBase {
  resourceType: 'MedicationRequest';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: CodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  medicationReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  authoredOn?: string;
  requester?: Reference;
  reasonCode?: CodeableConcept[];
  dosageInstruction?: { text?: string; timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } }; doseAndRate?: { doseQuantity?: Quantity }[] }[];
  dispenseRequest?: { quantity?: SimpleQuantity; expectedSupplyDuration?: Quantity };
  note?: { text: string }[];
}
export interface MedicationDispense extends FhirResourceBase {
  resourceType: 'MedicationDispense';
  id: string;
  identifier?: Identifier[];
  status: 'preparation' | 'in-progress' | 'cancelled' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped' | 'unknown';
  statusReasonCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  subject: Reference;
  context?: Reference;
  performer?: { actor: Reference; function?: CodeableConcept }[];
  authorizingPrescription?: Reference[];
  quantity: SimpleQuantity;
  daysSupply?: SimpleQuantity;
  whenPrepared?: string;
  whenHandedOver?: string;
  dosageInstruction?: { text?: string }[];
}
export interface CompositionSection {
  title?: string;
  code?: CodeableConcept;
  text?: Narrative;
  mode?: 'working' | 'snapshot' | 'changes';
  orderedBy?: CodeableConcept;
  entry?: Reference[];
  emptyReason?: CodeableConcept;
  section?: CompositionSection[];
}
export interface Composition extends FhirResourceBase {
  resourceType: 'Composition';
  id: string;
  identifier?: Identifier[];
  status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type: CodeableConcept;
  category?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  date: string;
  author: Reference[];
  title: string;
  confidentiality?: 'N' | 'R' | 'V' | 'U' | string;
  attester?: { mode: string[]; time?: string; party?: Reference }[];
  custodian?: Reference;
  section: CompositionSection[];
}
export interface Appointment extends FhirResourceBase {
  resourceType: 'Appointment';
  id: string;
  identifier?: Identifier[];
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
  cancelationReason?: CodeableConcept;
  serviceCategory?: CodeableConcept[];
  serviceType?: CodeableConcept[];
  specialty?: CodeableConcept[];
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  priority?: number;
  description?: string;
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: Reference[];
  created?: string;
  comment?: string;
  patientInstruction?: string;
  participant: { type?: CodeableConcept[]; actor?: Reference; required?: 'required' | 'optional' | 'information-only'; status: 'accepted' | 'declined' | 'tentative' | 'needs-action' }[];
}
export interface CoverageClass { type: CodeableConcept; value: string; name?: string }
export interface Coverage extends FhirResourceBase {
  resourceType: 'Coverage';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: CodeableConcept;
  policyHolder?: Reference;
  subscriber?: Reference;
  subscriberId: string;
  beneficiary: Reference;
  relationship?: CodeableConcept;
  period?: Period;
  payor: Reference[];
  class: CoverageClass[];
  order?: number;
  network?: string;
  costToBeneficiary?: { type?: CodeableConcept; valueMoney?: Money; valueQuantity?: Quantity }[];
}
export interface CoverageEligibilityResponse extends FhirResourceBase {
  resourceType: 'CoverageEligibilityResponse';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  purpose: ('auth-requirements' | 'benefits' | 'discovery' | 'validation')[];
  patient: Reference;
  servicedDate?: string;
  servicedPeriod?: Period;
  created: string;
  requestor?: Reference;
  request?: Reference;
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  insurer: Reference;
  insurance: { coverage: Reference; inforce?: boolean; benefitPeriod?: Period; item?: { category?: CodeableConcept; name?: string; description?: string; network?: CodeableConcept; unit?: CodeableConcept; term?: CodeableConcept; benefit?: { type?: CodeableConcept; allowedUnsignedInt?: number; allowedMoney?: Money; usedUnsignedInt?: number; usedMoney?: Money }[] }[] }[];
}
export interface Account extends FhirResourceBase {
  resourceType: 'Account';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'inactive' | 'on-hold' | 'entered-in-error';
  type?: CodeableConcept;
  name?: string;
  subject?: Reference[];
  servicePeriod?: Period;
  owner?: Reference;
  description?: string;
  guarantor?: { party: Reference; onHold?: boolean; period?: Period }[];
  diagnosis?: { condition: Reference; role?: CodeableConcept; rank?: number }[];
  procedure?: { sequence?: number; code?: CodeableConcept; date?: string; type?: CodeableConcept; packageCode?: CodeableConcept }[];
  balance?: { aggregate?: string; term?: CodeableConcept; amount: Money }[];
  coverage?: { coverage: Reference; priority?: number }[];
  partOf?: Reference;
}
export interface ChargeItem extends FhirResourceBase {
  resourceType: 'ChargeItem';
  id: string;
  identifier?: Identifier[];
  definitionUri?: string[];
  definitionCanonical?: string[];
  status: 'planned' | 'billable' | 'not-billable' | 'aborted' | 'billed' | 'entered-in-error' | 'unknown';
  partOf?: Reference[];
  code: CodeableConcept;
  subject: Reference;
  context?: Reference;
  occurrenceDateTime?: string;
  occurrencePeriod?: Period;
  performer?: { function?: CodeableConcept; actor: Reference }[];
  performingOrganization?: Reference;
  requestingOrganization?: Reference;
  costCenter?: Reference;
  quantity: Quantity;
  bodysite?: CodeableConcept[];
  factorOverride?: number;
  priceOverride?: Money;
  overrideReason?: string;
  enterer?: Reference;
  enteredDate?: string;
  account?: Reference[];
  note?: { text: string }[];
  supportingInformation?: Reference[];
}
export interface ClaimDiagnosis { sequence: number; diagnosisCodeableConcept?: CodeableConcept; diagnosisReference?: Reference; type?: CodeableConcept[]; onAdmission?: CodeableConcept; packageCode?: CodeableConcept }
export interface ClaimProcedure { sequence: number; type?: CodeableConcept[]; procedureReference?: Reference; procedureCodeableConcept?: CodeableConcept; date?: string; udi?: Reference[] }
export interface ClaimSupportingInfo { sequence: number; category: CodeableConcept; code?: CodeableConcept; timingDate?: string; timingPeriod?: Period; valueBoolean?: boolean; valueString?: string; valueQuantity?: Quantity; valueAttachment?: unknown; valueReference?: Reference; reason?: CodeableConcept }
export interface ClaimItem {
  sequence: number;
  careTeamSequence?: number[];
  diagnosisSequence?: number[];
  procedureSequence?: number[];
  informationSequence?: number[];
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  servicedDate?: string;
  servicedPeriod?: Period;
  locationAddress?: Address;
  locationReference?: Reference;
  locationCodeableConcept?: CodeableConcept;
  quantity?: SimpleQuantity;
  unitPrice?: Money;
  factor?: number;
  net: Money;
  udi?: Reference[];
  encounter: Reference[];
  detail?: { sequence: number; productOrService: CodeableConcept; quantity?: SimpleQuantity; unitPrice?: Money; net?: Money }[];
}
export interface Claim extends FhirResourceBase {
  resourceType: 'Claim';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference;
  billablePeriod?: Period;
  created: string;
  enterer?: Reference;
  insurer?: Reference;
  provider: Reference;
  priority: CodeableConcept;
  fundsReserve?: CodeableConcept;
  related?: { claim?: Reference; relationship?: CodeableConcept; reference?: Identifier }[];
  prescription?: Reference;
  originalPrescription?: Reference;
  payee?: { type: CodeableConcept; party?: Reference };
  referral?: Reference;
  facility?: Reference;
  careTeam?: { sequence: number; provider: Reference; responsible?: boolean; role?: CodeableConcept; qualification?: CodeableConcept }[];
  supportingInfo?: ClaimSupportingInfo[];
  diagnosis: ClaimDiagnosis[];
  procedure?: ClaimProcedure[];
  insurance: { sequence: number; focal: boolean; identifier?: Identifier; coverage: Reference }[];
  accident?: { date: string; type?: CodeableConcept; locationAddress?: Address; locationReference?: Reference };
  item: ClaimItem[];
  total?: Money;
}
export interface ClaimResponseTotal { category: CodeableConcept; amount: Money }
export interface ClaimResponseAddItem { itemSequence?: number[]; detailSequence?: number[]; subDetailSequence?: number[]; provider?: Reference[]; productOrService: CodeableConcept; modifier?: CodeableConcept[]; quantity?: SimpleQuantity; unitPrice?: Money; factor?: number; net?: Money; bodySite?: CodeableConcept; adjudication: { category: CodeableConcept; reason?: CodeableConcept; amount?: Money; value?: number }[] }
export interface ClaimResponse extends FhirResourceBase {
  resourceType: 'ClaimResponse';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference;
  created: string;
  insurer: Reference;
  request?: Reference;
  requestor?: Reference;
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  preAuthRef?: string;
  preAuthPeriod?: Period;
  payeeType?: CodeableConcept;
  item?: { itemSequence: number[]; adjudication: { category: CodeableConcept; reason?: CodeableConcept; amount?: Money; value?: number }[] }[];
  addItem?: ClaimResponseAddItem[];
  total: ClaimResponseTotal[];
  processNote?: { number?: number; type?: string; text: string; language?: CodeableConcept }[];
  communicationRequest?: Reference[];
  error?: { itemSequence?: number; detailSequence?: number; subDetailSequence?: number; code: CodeableConcept }[];
}
export interface ExplanationOfBenefit extends FhirResourceBase {
  resourceType: 'ExplanationOfBenefit';
  id: string;
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference;
  billablePeriod?: Period;
  created: string;
  insurer: Reference;
  provider: Reference;
  priority: CodeableConcept;
  fundsReserve?: CodeableConcept;
  related?: unknown[];
  prescription?: Reference;
  originalPrescription?: Reference;
  payee?: { type: CodeableConcept; party?: Reference };
  referral?: Reference;
  facility?: Reference;
  claim?: Reference;
  claimResponse?: Reference;
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  insurance: { focal: boolean; coverage: Reference; preAuthRef?: string[] }[];
  total: { category: CodeableConcept; amount: Money }[];
  careTeam?: unknown[];
  diagnosis?: unknown[];
  procedure?: unknown[];
  supportingInfo?: unknown[];
  item?: unknown[];
  benefitBalance?: unknown[];
}
export interface MeasureReport extends FhirResourceBase {
  resourceType: 'MeasureReport';
  id: string;
  identifier?: Identifier[];
  status: 'complete' | 'pending' | 'error';
  type: 'individual' | 'subject-list' | 'summary';
  measure: string;
  subject?: Reference;
  date?: string;
  reporter?: Reference;
  period: Period;
  improvementNotation?: CodeableConcept;
  group: { identifier?: Identifier; population?: { code: CodeableConcept; count?: number; subjectResults?: Reference[] }[]; measureScore?: Quantity; stratifier?: unknown[] }[];
  evaluatedResource?: Reference[];
}
export interface BundleEntry {
  fullUrl?: string;
  resource?: FhirResource;
  request?: { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url: string; ifNoneMatch?: string; ifModifiedSince?: string; ifMatch?: string; ifNoneExist?: string };
  response?: { status?: string; location?: string; etag?: string; lastModified?: string; outcome?: unknown };
  search?: { mode?: 'match' | 'include' | 'outcome'; score?: number };
}
export interface Bundle extends FhirResourceBase {
  resourceType: 'Bundle';
  id: string;
  identifier?: Identifier;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: { relation: string; url: string }[];
  entry?: BundleEntry[];
  signature?: Signature;
}

export type FhirResource = Organization | Patient | Practitioner | Location | EpisodeOfCare | ServiceRequest | Encounter | Consent | Provenance | Condition | Procedure | Observation | DiagnosticReport | Medication | MedicationRequest | MedicationDispense | Composition | Appointment | Coverage | CoverageEligibilityResponse | Account | ChargeItem | Claim | ClaimResponse | ExplanationOfBenefit | MeasureReport | Bundle;
export type FhirResourceType = FhirResource['resourceType'];

export interface ViewDefinitionColumn { name: string; path: string; type?: 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'dateTime'; description?: string }
export interface ViewDefinitionSelect { forEach?: string; forEachOrNull?: string; column?: ViewDefinitionColumn[]; select?: ViewDefinitionSelect[]; unionAll?: ViewDefinitionSelect[] }
export interface ViewDefinition { resourceType: 'ViewDefinition'; name: string; targetTable: string; resource: FhirResourceType; status: 'active' | 'draft'; implementationStatus: ImplementationStatus; description: string; select: ViewDefinitionSelect[] }
export type ValidationRuleId = 'FHIR_STD_01_MANDATORY_CARDINALITY' | 'FHIR_STD_02_OBSERVATION_INVARIANT_OBS7' | 'FHIR_STD_03_COMPOSITION_INVARIANT_CMP1' | 'FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN' | 'FHIR_STD_05_FINANCIAL_RECONCILIATION' | 'FHIR_STD_06_BUNDLE_TRANSACTION_BDL3';
export interface ValidationIssue { ruleId: ValidationRuleId; severity: 'error' | 'warning' | 'information'; resourceType: string; resourceId: string; path: string; message: string; remediation: string }
export interface ValidationRuleResult { ruleId: ValidationRuleId; title: string; description: string; passed: boolean; checkedCount: number; issues: ValidationIssue[] }
export interface ValidationReport { valid: boolean; timestamp: string; totalResourcesChecked: number; errorCount: number; warningCount: number; rules: ValidationRuleResult[]; issues: ValidationIssue[] }

export interface SandboxClinicalFinancialOverrides {
  encounterStatus?: Encounter['status']; encounterClass?: 'AMB' | 'EMER' | 'IMP'; dischargeDispositionCode?: 'home' | 'other-hcf' | 'aadvice' | 'exp'; primaryDiagnosisCode?: string; secondaryDiagnosisCode?: string; procedureCode?: string; systolicBp?: number; diastolicBp?: number; heartRate?: number; bodyTemp?: number; roomChargeDays?: number; roomUnitPriceIdr?: number; procedurePriceIdr?: number; medicationPriceIdr?: number; adjudicationOutcome?: 'queued' | 'complete' | 'error' | 'partial'; approvedRoomBenefitIdr?: number; approvedProcedureBenefitIdr?: number; approvedMedicationBenefitIdr?: number; addItemBenefitIdr?: number; injectObs7Violation?: boolean; injectCmp1Violation?: boolean; injectBrokenEvidenceChain?: boolean; injectFinancialMismatch?: boolean; injectBundleOrderViolation?: boolean; mergedDuplicatePatient?: boolean;
}
export interface TerminologyDictionary { [domain: string]: { system?: string; concepts?: Record<string, string>; [key: string]: unknown } }
export type FlattenedTableRows = Record<string, Record<string, unknown>[]>;
export interface SimrsHospitalSeed { id: string; hospitalCode: string; hospitalName: string; city: string; provinceCode: string; cityCode: string; districtCode: string; villageCode: string; simrsArchitectureStyle: string; scenarioTitle: string; scenarioSummary: string; rawSimrsTables: Record<string, Record<string, unknown>[]>; defaultOverrides: Required<SandboxClinicalFinancialOverrides> }
export interface NormalizedHospitalDataset { hospitalId: string; hospitalName: string; organization: Organization; payorOrganization: Organization; patient: Patient; duplicateEmergencyPatient?: Patient; practitioner: Practitioner; location: Location; episodeOfCare: EpisodeOfCare; serviceRequest: ServiceRequest; encounter: Encounter; consent: Consent; provenance: Provenance; conditions: Condition[]; procedures: Procedure[]; observations: Observation[]; diagnosticReport: DiagnosticReport; medication: Medication; medicationRequest: MedicationRequest; medicationDispense: MedicationDispense; composition: Composition; appointment: Appointment; coverage: Coverage; coverageEligibilityResponse: CoverageEligibilityResponse; account: Account; chargeItems: ChargeItem[]; claim: Claim; claimResponse: ClaimResponse; explanationOfBenefit: ExplanationOfBenefit; measureReport: MeasureReport; transactionBundle: Bundle; allResources: FhirResource[] }
export interface FlattenedDatasetResult { hospitalId: string; tables: Record<string, Record<string, unknown>[]> }
export interface SqlQueryExecutionResult { columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionTimeMs: number; error?: string }
export interface TableMetadataItem { tableName: string; kind: 'table' | 'view'; resourceType: string; level: string; implementationStatus: ImplementationStatus; description: string }
export interface CurriculumMission { id: string; title: string; description: string; targetActionHint: string }
export interface CurriculumModule { id: string; moduleNumber: number; level: string; title: string; subtitle: string; implementationStatus: ImplementationStatus; resourcesCovered: string[]; targetTables: string[]; mentalModelSummary: string; stepByStepExplanation: string[]; simrsVsFhirComparison: { simrsRaw: string; fhirStandard: string; rationale: string }[]; keyFhirPathExpressions: { label: string; expression: string; targetColumn: string }[]; missions: CurriculumMission[]; recommendedSqlQueryId?: string }
