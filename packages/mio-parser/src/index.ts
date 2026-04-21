// ─── Main API ─────────────────────────────────────────────────────────────────
export {
  parseMioBundle,
  parseVaccinationBundle,
  parseEauBundle,
  parseMutterpassBundle,
} from "./parsers.js";

// ─── Utilities ────────────────────────────────────────────────────────────────
export { parseXml, normaliseDate, formatDateDe } from "./fhir-utils.js";
export { displayName, primaryAddress } from "./resource-extractors.js";
export { buildEntryMap, uniqueEntries, resolveRef, resolveRefNode } from "./bundle-resolver.js";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  MioParseResult,
  MioVaccinationBundle,
  MioImmunization,
  MioEau,
  MioMutterpass,
  MioPatient,
  MioPractitioner,
  MioOrganization,
  MioPractitionerRole,
  MioPregnancyObservation,
  MioAuCondition,
  FhirCoding,
  FhirCodeableConcept,
  FhirHumanName,
  FhirAddress,
  FhirTelecom,
  FhirIdentifier,
  VaccinationEntryType,
  AuType,
} from "./types.js";
export { MioParseError } from "./types.js";
