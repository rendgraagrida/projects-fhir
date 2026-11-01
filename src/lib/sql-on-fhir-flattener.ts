import type { Claim, FhirResource, NormalizedHospitalDataset, ViewDefinition, ViewDefinitionColumn, ViewDefinitionSelect, FlattenedDatasetResult } from '../types/fhir-global';

const SATUSEHAT = 'IMPLEMENTED_SATUSEHAT' as const;
const PARTIAL = 'PARTIAL_NATIONAL' as const;
const PIONEER = 'PIONEER_GLOBAL_FHIR' as const;
const col = (name: string, path: string, type?: ViewDefinitionColumn['type']): ViewDefinitionColumn => ({ name, path, type });
function view(name: string, targetTable: string, resource: ViewDefinition['resource'], implementationStatus: ViewDefinition['implementationStatus'], viewColumns: ViewDefinitionColumn[], select?: ViewDefinitionSelect[]): ViewDefinition {
  const effectiveSelect = (select ?? [{}]).map(item => item.column ? item : { ...item, column: viewColumns });
  return { resourceType: 'ViewDefinition', name, targetTable, resource, status: 'active', implementationStatus, description: `SQL-on-FHIR v2 view untuk ${targetTable}.`, select: effectiveSelect };
}

const c = (name: string, path: string, type?: ViewDefinitionColumn['type']): ViewDefinitionColumn => col(name, path, type);
export const SQL_ON_FHIR_VIEW_DEFINITIONS: ViewDefinition[] = [
  view('fhir_organization_view', 'fhir_organization', 'Organization', SATUSEHAT, [c('id', 'getResourceKey()'), c('identifier_system', 'identifier.first().system'), c('identifier_value', 'identifier.first().value'), c('active', 'active'), c('type_code', 'type.first().coding.first().code'), c('name', 'name'), c('address_province_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='province').first().valueCode"), c('address_city_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='city').first().valueCode")]),
  view('fhir_patient_view', 'fhir_patient', 'Patient', SATUSEHAT, [c('id', 'getResourceKey()'), c('nik', "identifier.where(system='https://fhir.kemkes.go.id/id/nik').first().value"), c('ihs_number', "identifier.where(system='https://fhir.kemkes.go.id/id/ihs-number').first().value"), c('local_mrn', "identifier.where(type.coding.exists(code='MR')).first().value"), c('full_name', 'name.first().text'), c('gender', 'gender'), c('birth_date', 'birthDate'), c('active', 'active'), c('citizenship_code', "extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/citizenshipStatus').first().valueCode"), c('address_province_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='province').first().valueCode"), c('address_city_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='city').first().valueCode"), c('address_district_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='district').first().valueCode"), c('address_village_code', "address.first().extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode').first().extension.where(url='village').first().valueCode"), c('replaced_by_patient_id', "link.where(type='replaced-by').first().other.getReferenceKey('Patient')"), c('managing_organization_id', "managingOrganization.getReferenceKey('Organization')")]),
  view('fhir_practitioner_view', 'fhir_practitioner', 'Practitioner', SATUSEHAT, [c('id', 'getResourceKey()'), c('ihs_number', "identifier.where(system='https://fhir.kemkes.go.id/id/ihs-number').first().value"), c('identifier_system', 'identifier.first().system'), c('identifier_value', 'identifier.first().value'), c('full_name', 'name.first().text'), c('active', 'active'), c('qualification_code', 'qualification.first().code.coding.first().code')]),
  view('fhir_location_view', 'fhir_location', 'Location', SATUSEHAT, [c('id', 'getResourceKey()'), c('managing_organization_id', "managingOrganization.getReferenceKey('Organization')"), c('identifier_value', 'identifier.first().value'), c('status', 'status'), c('name', 'name'), c('mode_code', 'mode'), c('physical_type_code', 'physicalType.coding.first().code')]),
  view('fhir_episode_of_care_view', 'fhir_episode_of_care', 'EpisodeOfCare', SATUSEHAT, [c('id', 'getResourceKey()'), c('managing_organization_id', "managingOrganization.getReferenceKey('Organization')"), c('patient_id', "patient.getReferenceKey('Patient')"), c('status', 'status'), c('type_code', 'type.first().coding.first().code'), c('period_start', 'period.start', 'dateTime'), c('period_end', 'period.end', 'dateTime')]),
  view('fhir_service_request_view', 'fhir_service_request', 'ServiceRequest', 'PARTIAL_NATIONAL', [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('requester_practitioner_id', "requester.getReferenceKey('Practitioner')"), c('performer_organization_id', "performer.first().getReferenceKey('Organization')"), c('identifier_value', 'identifier.first().value'), c('status', 'status'), c('intent', 'intent'), c('category_code', 'category.first().coding.first().code'), c('priority_code', 'priority'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('authored_on', 'authoredOn', 'dateTime')]),
  view('fhir_encounter_view', 'fhir_encounter', 'Encounter', SATUSEHAT, [c('id', 'getResourceKey()'), c('identifier_system', 'identifier.first().system'), c('identifier_value', 'identifier.first().value'), c('status', 'status'), c('class_code', 'class.code'), c('service_type_code', 'serviceType.coding.first().code'), c('patient_id', "subject.getReferenceKey('Patient')"), c('practitioner_id', "participant.where(individual.getReferenceKey('Practitioner').exists()).first().individual.getReferenceKey('Practitioner')"), c('location_id', "location.first().location.getReferenceKey('Location')"), c('episode_of_care_id', "episodeOfCare.first().getReferenceKey('EpisodeOfCare')"), c('based_on_service_request_id', "basedOn.first().getReferenceKey('ServiceRequest')"), c('service_provider_org_id', "serviceProvider.getReferenceKey('Organization')"), c('period_start', 'period.start', 'dateTime'), c('period_end', 'period.end', 'dateTime'), c('discharge_disposition_code', 'hospitalization.dischargeDisposition.coding.first().code')]),
  view('fhir_consent_view', 'fhir_consent', 'Consent', PARTIAL, [c('id', 'getResourceKey()'), c('patient_id', "patient.getReferenceKey('Patient')"), c('organization_id', "organization.first().getReferenceKey('Organization')"), c('status', 'status'), c('scope_code', 'scope.coding.first().code'), c('category_code', 'category.first().coding.first().code'), c('date_time', 'dateTime', 'dateTime')]),
  view('fhir_provenance_view', 'fhir_provenance', 'Provenance', PARTIAL, [c('id', 'getResourceKey()'), c('target_resource_type', 'target.first().reference.splitType()'), c('target_resource_id', 'target.first().getReferenceKey()'), c('agent_practitioner_id', "agent.where(who.getReferenceKey('Practitioner').exists()).first().who.getReferenceKey('Practitioner')"), c('recorded_datetime', 'recorded', 'dateTime'), c('activity_code', 'activity.coding.first().code'), c('signature_type_code', 'signature.first().type.first().code')]),
  view('fhir_condition_view', 'fhir_condition', 'Condition', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('clinical_status', 'clinicalStatus.coding.first().code'), c('verification_status', 'verificationStatus.coding.first().code'), c('category_code', 'category.first().coding.first().code'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('recorded_date', 'recordedDate', 'dateTime')]),
  view('fhir_procedure_view', 'fhir_procedure', 'Procedure', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('status', 'status'), c('category_code', 'category.coding.first().code'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('performed_datetime', 'performed.ofType(dateTime)', 'dateTime')]),
  view('fhir_observation_view', 'fhir_observation', 'Observation', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('performer_practitioner_id', "performer.first().getReferenceKey('Practitioner')"), c('based_on_service_request_id', "basedOn.first().getReferenceKey('ServiceRequest')"), c('status', 'status'), c('category_code', 'category.first().coding.first().code'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('value_quantity', 'value.ofType(Quantity).value', 'decimal'), c('value_unit', 'value.ofType(Quantity).code'), c('value_string', 'valueString'), c('systolic_value', "component.where(code.coding.exists(code='8480-6')).first().value.ofType(Quantity).value", 'decimal'), c('diastolic_value', "component.where(code.coding.exists(code='8462-4')).first().value.ofType(Quantity).value", 'decimal'), c('effective_datetime', 'effectiveDateTime', 'dateTime')]),
  view('fhir_diagnostic_report_view', 'fhir_diagnostic_report', 'DiagnosticReport', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('based_on_service_request_id', "basedOn.first().getReferenceKey('ServiceRequest')"), c('primary_observation_id', "result.first().getReferenceKey('Observation')"), c('status', 'status'), c('category_code', 'category.first().coding.first().code'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('conclusion', 'conclusion'), c('issued_datetime', 'issued', 'dateTime')]),
  view('fhir_medication_view', 'fhir_medication', 'Medication', SATUSEHAT, [c('id', 'getResourceKey()'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('form_code', 'form.coding.first().code'), c('medication_type_code', "extension.where(url='https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType').first().valueCoding.code")]),
  view('fhir_medication_request_view', 'fhir_medication_request', 'MedicationRequest', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('requester_practitioner_id', "requester.getReferenceKey('Practitioner')"), c('medication_id', "medication.ofType(Reference).getReferenceKey('Medication')"), c('status', 'status'), c('intent', 'intent'), c('category_code', 'category.first().coding.first().code'), c('dosage_text', 'dosageInstruction.first().text'), c('authored_on', 'authoredOn', 'dateTime')]),
  view('fhir_medication_dispense_view', 'fhir_medication_dispense', 'MedicationDispense', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "context.getReferenceKey('Encounter')"), c('medication_id', "medicationReference.getReferenceKey('Medication')"), c('authorizing_prescription_id', "authorizingPrescription.first().getReferenceKey('MedicationRequest')"), c('status', 'status'), c('quantity_value', 'quantity.value', 'decimal'), c('quantity_unit', 'quantity.code'), c('days_supply_value', 'daysSupply.value', 'integer'), c('when_handed_over', 'whenHandedOver', 'dateTime')]),
  view('fhir_composition_view', 'fhir_composition', 'Composition', SATUSEHAT, [c('id', 'getResourceKey()'), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "encounter.getReferenceKey('Encounter')"), c('author_practitioner_id', "author.first().getReferenceKey('Practitioner')"), c('status', 'status'), c('type_system', 'type.coding.first().system'), c('type_code', 'type.coding.first().code'), c('title', 'title'), c('section_count', 'section.count()', 'integer'), c('composition_date', 'date', 'dateTime')]),
  view('fhir_appointment_view', 'fhir_appointment', 'Appointment', PIONEER, [c('id', 'getResourceKey()'), c('patient_id', "participant.where(actor.getReferenceKey('Patient').exists()).first().actor.getReferenceKey('Patient')"), c('practitioner_id', "participant.where(actor.getReferenceKey('Practitioner').exists()).first().actor.getReferenceKey('Practitioner')"), c('location_id', "participant.where(actor.getReferenceKey('Location').exists()).first().actor.getReferenceKey('Location')"), c('status', 'status'), c('service_category_code', 'serviceCategory.first().coding.first().code'), c('start_datetime', 'start', 'dateTime'), c('end_datetime', 'end', 'dateTime')]),
  view('fhir_coverage_view', 'fhir_coverage', 'Coverage', PIONEER, [c('id', 'getResourceKey()'), c('subscriber_id', 'subscriberId'), c('status', 'status'), c('type_code', 'type.coding.first().code'), c('patient_id', "beneficiary.getReferenceKey('Patient')"), c('payor_organization_id', "payor.first().getReferenceKey('Organization')"), c('payor_display', 'payor.first().display'), c('class_type_code', 'class.where(type.coding.exists(code=\'plan\')).first().type.coding.first().code'), c('class_value', 'class.where(type.coding.exists(code=\'plan\')).first().value')]),
  view('fhir_coverage_eligibility_response_view', 'fhir_coverage_eligibility_response', 'CoverageEligibilityResponse', PIONEER, [c('id', 'getResourceKey()'), c('patient_id', "patient.getReferenceKey('Patient')"), c('insurer_organization_id', "insurer.getReferenceKey('Organization')"), c('coverage_id', "insurance.first().coverage.getReferenceKey('Coverage')"), c('status', 'status'), c('outcome', 'outcome'), c('inforce', 'insurance.first().inforce', 'boolean'), c('disposition', 'disposition'), c('created_datetime', 'created', 'dateTime')]),
  view('fhir_account_view', 'fhir_account', 'Account', PIONEER, [c('id', 'getResourceKey()'), c('service_provider_org_id', "owner.getReferenceKey('Organization')"), c('patient_id', "subject.first().getReferenceKey('Patient')"), c('status', 'status'), c('type_code', 'type.coding.first().code'), c('name', 'name')]),
  view('fhir_charge_item_view', 'fhir_charge_item', 'ChargeItem', PIONEER, [c('id', 'getResourceKey()'), c('performing_organization_id', "performingOrganization.getReferenceKey('Organization')"), c('patient_id', "subject.getReferenceKey('Patient')"), c('encounter_id', "context.getReferenceKey('Encounter')"), c('account_id', "account.first().getReferenceKey('Account')"), c('status', 'status'), c('category_code', 'code.coding.first().code'), c('code_system', 'code.coding.first().system'), c('code_value', 'code.coding.first().code'), c('code_display', 'code.coding.first().display'), c('quantity_value', 'quantity.value', 'decimal'), c('unit_price_value', 'priceOverride.value', 'decimal'), c('total_price_value', 'priceOverride.value', 'decimal'), c('currency', 'priceOverride.currency'), c('supporting_info_ref', 'supportingInformation.first().getReferenceKey()')]),
  view('fhir_claim_header_view', 'fhir_claim', 'Claim', PIONEER, [c('id', 'getResourceKey()'), c('provider_organization_id', "provider.getReferenceKey('Organization')"), c('patient_id', "patient.getReferenceKey('Patient')"), c('encounter_id', 'item.first().encounter.first().getReferenceKey(\'Encounter\')'), c('coverage_id', "insurance.first().coverage.getReferenceKey('Coverage')"), c('composition_id', "supportingInfo.where(valueReference.getReferenceKey('Composition').exists()).first().valueReference.getReferenceKey('Composition')"), c('identifier_system', 'identifier.first().system'), c('identifier_value', 'identifier.first().value'), c('status', 'status'), c('type_code', 'type.coding.first().code'), c('sub_type_code', 'subType.coding.first().code'), c('use_code', 'use'), c('priority_code', 'priority.coding.first().code'), c('diagnosis_package_system', 'diagnosis.first().packageCode.coding.first().system'), c('diagnosis_package_code', 'diagnosis.first().packageCode.coding.first().code'), c('diagnosis_package_display', 'diagnosis.first().packageCode.coding.first().display'), c('total_value', 'total.value', 'decimal'), c('total_currency', 'total.currency'), c('created_datetime', 'created', 'dateTime')]),
  view('fhir_claim_item_view', 'fhir_claim_item', 'Claim', PIONEER, [c('id', "getResourceKey() + '-' + sequence"), c('claim_id', 'getResourceKey()'), c('encounter_id', 'encounter.first().getReferenceKey(\'Encounter\')'), c('sequence', 'sequence', 'integer'), c('category_system', 'category.coding.first().system'), c('category_code', 'category.coding.first().code'), c('category_display', 'category.coding.first().display'), c('product_or_service_system', 'productOrService.coding.first().system'), c('product_or_service_code', 'productOrService.coding.first().code'), c('product_or_service_display', 'productOrService.coding.first().display'), c('quantity_value', 'quantity.value', 'decimal'), c('unit_price_value', 'unitPrice.value', 'decimal'), c('net_value', 'net.value', 'decimal'), c('currency', 'net.currency')], [{ forEach: 'item' }]),
  view('fhir_claim_response_view', 'fhir_claim_response', 'ClaimResponse', PIONEER, [c('id', 'getResourceKey()'), c('claim_id', "request.getReferenceKey('Claim')"), c('patient_id', "patient.getReferenceKey('Patient')"), c('insurer_organization_id', "insurer.getReferenceKey('Organization')"), c('status', 'status'), c('type_code', 'type.coding.first().code'), c('use_code', 'use'), c('outcome', 'outcome'), c('disposition', 'disposition'), c('total_submitted_value', "total.where(category.coding.exists(code='submitted')).first().amount.value", 'decimal'), c('total_benefit_value', "total.where(category.coding.exists(code='benefit')).first().amount.value", 'decimal'), c('add_item_benefit_value', 'addItem.first().net.value', 'decimal'), c('currency', "total.where(category.coding.exists(code='submitted')).first().amount.currency"), c('process_note_text', 'processNote.first().text'), c('created_datetime', 'created', 'dateTime')]),
  view('fhir_explanation_of_benefit_view', 'fhir_explanation_of_benefit', 'ExplanationOfBenefit', PIONEER, [c('id', 'getResourceKey()'), c('claim_id', "claim.getReferenceKey('Claim')"), c('claim_response_id', "claimResponse.getReferenceKey('ClaimResponse')"), c('patient_id', "patient.getReferenceKey('Patient')"), c('provider_organization_id', "provider.getReferenceKey('Organization')"), c('insurer_organization_id', "insurer.getReferenceKey('Organization')"), c('coverage_id', "insurance.first().coverage.getReferenceKey('Coverage')"), c('status', 'status'), c('type_code', 'type.coding.first().code'), c('use_code', 'use'), c('outcome', 'outcome'), c('total_submitted_value', "total.where(category.coding.exists(code='submitted')).first().amount.value", 'decimal'), c('total_benefit_value', "total.where(category.coding.exists(code='benefit')).first().amount.value", 'decimal'), c('created_datetime', 'created', 'dateTime')]),
  view('fhir_measure_report_view', 'fhir_measure_report', 'MeasureReport', PIONEER, [c('id', 'getResourceKey()'), c('reporter_organization_id', "reporter.getReferenceKey('Organization')"), c('measure_url', 'measure'), c('measure_name', 'measure'), c('status', 'status'), c('type_code', 'type'), c('period_start', 'period.start', 'date'), c('period_end', 'period.end', 'date'), c('numerator_count', "group.first().population.where(code.coding.exists(code='numerator')).first().count", 'integer'), c('denominator_count', "group.first().population.where(code.coding.exists(code='denominator')).first().count", 'integer'), c('measure_score_value', 'group.first().measureScore.value', 'decimal')])
];

function splitPath(expression: string): string[] {
  const result: string[] = []; let current = ''; let depth = 0; let quote = ''; for (const character of expression) { if (quote) { current += character; if (character === quote) quote = ''; continue; } if (character === "'" || character === '"') { quote = character; current += character; continue; } if (character === '(') depth++; if (character === ')') depth--; if (character === '.' && depth === 0) { if (current) result.push(current); current = ''; } else current += character; } if (current) result.push(current); return result;
}
function valuesOf(input: unknown): unknown[] { return Array.isArray(input) ? input : input === undefined || input === null ? [] : [input]; }
function property(value: unknown, key: string): unknown {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
function parseLiteral(value: string): unknown { const trimmed = value.trim(); if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed.slice(1, -1); if (trimmed === 'true') return true; if (trimmed === 'false') return false; const numeric = Number(trimmed); return Number.isNaN(numeric) ? trimmed : numeric; }
function evaluatePredicate(item: unknown, predicate: string, rootResource?: unknown): boolean {
  const match = predicate.match(/^([\w.]+)\s*=\s*(.+)$/);
  if (!match) {
    const evaluated = evaluateFhirPath(item, predicate, rootResource);
    return evaluated.some(val => Boolean(val));
  }
  const actual = evaluateFhirPath(item, match[1], rootResource)[0];
  return actual === parseLiteral(match[2]);
}
function evaluateSegment(input: unknown[], segment: string, rootResource?: unknown): unknown[] {
  if ((segment.startsWith("'") && segment.endsWith("'")) || (segment.startsWith('"') && segment.endsWith('"'))) return [segment.slice(1, -1)];
  if (segment === '$this') return input;
  if (segment === 'first()') return input.length ? [input[0]] : [];
  if (segment === 'last()') return input.length ? [input[input.length - 1]] : [];
  if (segment === 'exists()') return input.length ? [true] : [false];
  const existsMatch = segment.match(/^exists\((.*)\)$/); if (existsMatch) return [input.some(item => evaluatePredicate(item, existsMatch[1], rootResource))];
  if (segment === 'count()') return [input.length];
  if (segment === 'getResourceKey()') return input.map(item => {
    const resource = item as { resourceType?: string; id?: string };
    const root = rootResource as { resourceType?: string; id?: string };
    return resource?.id ?? (root?.id ?? undefined);
  }).filter(Boolean);
  const referenceMatch = segment.match(/^getReferenceKey(?:\((?:'([^']*)')?\))?$/); if (referenceMatch) return input.map(item => {
    const reference = item as { reference?: string; type?: string };
    if (!reference?.reference) return undefined;
    if (referenceMatch[1]) { if (!reference.reference.startsWith(`${referenceMatch[1]}/`)) return undefined; return reference.reference.slice(referenceMatch[1].length + 1); }
    return reference.reference;
  }).filter(Boolean);
  const typeMatch = segment.match(/^ofType\(([^)]+)\)$/); if (typeMatch) {
    const targetType = typeMatch[1].replace(/^['"]|['"]$/g, '');
    return input.filter(item => {
      if (targetType === 'dateTime' || targetType === 'string' || targetType === 'date') return typeof item === 'string';
      if (!item || typeof item !== 'object') return false;
      const resource = item as { resourceType?: string };
      if (resource.resourceType === targetType) return true;
      if (targetType === 'Quantity') return 'value' in item;
      if (targetType === 'Reference') return 'reference' in item;
      if (targetType === 'Period') return 'start' in item || 'end' in item;
      if (targetType === 'CodeableConcept') return 'coding' in item;
      return false;
    });
  }
  const whereMatch = segment.match(/^where\((.*)\)$/); if (whereMatch) return input.filter(item => evaluatePredicate(item, whereMatch[1], rootResource));
  if (segment === 'splitType()') return input.flatMap(item => typeof item === 'string' ? item.split('/')[0] : []);
  if (segment === 'value') return input.flatMap(item => valuesOf(property(item, 'value') ?? property(item, 'valueQuantity') ?? property(item, 'valueCodeableConcept') ?? property(item, 'valueString') ?? property(item, 'valueBoolean') ?? property(item, 'valueInteger')));
  if (segment === 'performed') return input.flatMap(item => valuesOf(property(item, 'performed') ?? property(item, 'performedDateTime') ?? property(property(item, 'performedPeriod'), 'start') ?? property(item, 'performedPeriod')));
  if (segment === 'effective') return input.flatMap(item => valuesOf(property(item, 'effective') ?? property(item, 'effectiveDateTime') ?? property(property(item, 'effectivePeriod'), 'start') ?? property(item, 'effectivePeriod')));
  if (segment === 'medication') return input.flatMap(item => valuesOf(property(item, 'medication') ?? property(item, 'medicationReference') ?? property(item, 'medicationCodeableConcept')));
  return input.flatMap(item => valuesOf(property(item, segment)));
}
export function evaluateFhirPath(resource: unknown, expression: string, rootResource: unknown = resource): unknown[] {
  const trimmed = expression.trim();
  if (!trimmed) return [];
  if (trimmed.includes(' + ')) {
    const parts = trimmed.split(' + ');
    const combined = parts
      .map(part => {
        const p = part.trim();
        if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) return p.slice(1, -1);
        const evaluated = evaluateFhirPath(resource, p, rootResource);
        return evaluated[0] !== undefined && evaluated[0] !== null ? String(evaluated[0]) : '';
      })
      .join('');
    return [combined];
  }
  let current: unknown[] = [resource];
  for (const segment of splitPath(trimmed)) current = evaluateSegment(current, segment, rootResource);
  return current;
}

function selectRows(resource: FhirResource, select: ViewDefinitionSelect, rootResource: FhirResource = resource): Record<string, unknown>[] {
  let contexts: unknown[] = [resource];
  if (select.forEach) contexts = evaluateFhirPath(resource, select.forEach, rootResource);
  else if (select.forEachOrNull) contexts = evaluateFhirPath(resource, select.forEachOrNull, rootResource);
  if (contexts.length === 0 && select.forEachOrNull) contexts = [null];
  const rows = contexts.flatMap(context => {
    const baseRow: Record<string, unknown> = Object.create(null);
    for (const column of select.column ?? []) {
      if (column.name === '__proto__' || column.name === 'constructor' || column.name === 'prototype') continue;
      baseRow[column.name] = context === null ? null : evaluateFhirPath(context, column.path, rootResource)[0] ?? null;
    }
    let candidateRows: Record<string, unknown>[] = [{ ...baseRow }];
    for (const nested of select.select ?? []) {
      const childRows = context === null ? [{}] : selectRows(context as FhirResource, nested, rootResource);
      candidateRows = candidateRows.flatMap(parentRow => childRows.map(childRow => ({ ...parentRow, ...childRow })));
    }
    return candidateRows;
  });
  if (select.unionAll) {
    const unionRows = select.unionAll.flatMap(child => selectRows(resource, child, rootResource));
    return (select.column?.length || select.select?.length || select.forEach || select.forEachOrNull) ? [...rows, ...unionRows] : unionRows;
  }
  return rows;
}
export function evaluateViewDefinition(viewDef: ViewDefinition, resources: FhirResource[]): Record<string, unknown>[] { return resources.filter(resource => resource.resourceType === viewDef.resource).flatMap(resource => viewDef.select.flatMap(select => selectRows(resource, select, resource))); }

const requiredDefaults: Record<string, Record<string, unknown>> = {
  fhir_organization: { active: true, type_code: 'prov' }, fhir_patient: { gender: 'unknown', active: true }, fhir_practitioner: { active: true }, fhir_location: { status: 'active', mode_code: 'instance' }, fhir_episode_of_care: { status: 'active' }, fhir_service_request: { status: 'completed', intent: 'order', priority_code: 'routine' }, fhir_encounter: { status: 'finished', class_code: 'AMB' }, fhir_consent: { status: 'active', scope_code: 'patient-privacy', category_code: 'patient-privacy' }, fhir_provenance: { target_resource_type: 'Resource', target_resource_id: 'unknown' }, fhir_condition: { clinical_status: 'active', verification_status: 'confirmed', category_code: 'encounter-diagnosis', diagnosis_role_code: 'DD', diagnosis_rank: 1 }, fhir_procedure: { status: 'completed' }, fhir_observation: { status: 'final', category_code: 'vital-signs' }, fhir_diagnostic_report: { status: 'final', category_code: 'LAB' }, fhir_medication_request: { status: 'completed', intent: 'order' }, fhir_medication_dispense: { status: 'completed' }, fhir_composition: { status: 'final', section_count: 5 }, fhir_appointment: { status: 'fulfilled' }, fhir_coverage: { status: 'active', payor_display: 'Penjamin' }, fhir_coverage_eligibility_response: { status: 'active', outcome: 'complete', inforce: true }, fhir_account: { status: 'active' }, fhir_charge_item: { status: 'billed', quantity_value: 1, unit_price_value: 0, total_price_value: 0, currency: 'IDR' }, fhir_claim: { status: 'active', type_code: 'institutional', use_code: 'claim', total_value: 0, total_currency: 'IDR' }, fhir_claim_item: { sequence: 1, product_or_service_system: 'http://terminology.hl7.org/CodeSystem/ex-benefitcategory', product_or_service_code: 'unknown', net_value: 0, currency: 'IDR' }, fhir_claim_response: { status: 'active', outcome: 'complete', total_submitted_value: 0, total_benefit_value: 0, currency: 'IDR' }, fhir_explanation_of_benefit: { status: 'active', outcome: 'complete', total_submitted_value: 0, total_benefit_value: 0, currency: 'IDR' }, fhir_measure_report: { status: 'complete', type_code: 'individual' }
};
export function flattenDatasetWithSqlOnFhir(dataset: NormalizedHospitalDataset): FlattenedDatasetResult {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const resources = dataset.allResources;
  for (const viewDefinition of SQL_ON_FHIR_VIEW_DEFINITIONS) {
    const rows = evaluateViewDefinition(viewDefinition, resources);
    const defaultsForTable = requiredDefaults[viewDefinition.targetTable] ?? {};
    tables[viewDefinition.targetTable] = rows.map(row => {
      const normalized: Record<string, unknown> = { ...row };
      for (const [key, fallback] of Object.entries(defaultsForTable)) if (normalized[key] === undefined || normalized[key] === null) normalized[key] = fallback;
      const source = resources.find(resource => resource.id === row.id);
      normalized.implementation_status = viewDefinition.implementationStatus;
      normalized.raw_fhir = JSON.stringify(source ?? {});
      if (viewDefinition.targetTable === 'fhir_charge_item') {
        const qty = Number(normalized.quantity_value ?? 1);
        const total = Number(normalized.total_price_value ?? 0);
        normalized.unit_price_value = qty > 0 ? total / qty : total;
      }
      if (viewDefinition.targetTable === 'fhir_explanation_of_benefit') normalized.variance_value = Number(normalized.total_benefit_value ?? 0) - Number(normalized.total_submitted_value ?? 0);
      return normalized;
    });
  }
  const conditionRows = tables.fhir_condition ?? [];
  const diagnosisByCondition = new Map((dataset.encounter.diagnosis ?? []).map(diagnosis => [diagnosis.condition.reference, diagnosis]));
  for (const row of conditionRows) { const diagnosis = diagnosisByCondition.get(`Condition/${String(row.id ?? '').replace(/^Condition\//, '')}`) ?? diagnosisByCondition.get(String(row.id)); if (diagnosis) { row.diagnosis_role_code = diagnosis.use?.coding?.[0]?.code ?? row.diagnosis_role_code ?? 'DD'; row.diagnosis_rank = diagnosis.rank ?? row.diagnosis_rank ?? 1; } }
  return { hospitalId: dataset.hospitalId, tables };
}
