// ─── FHIR Primitive Helpers ──────────────────────────────────────────────────

export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  /** KBV German display text via KBV_EX_Base_Terminology_German */
  displayDe?: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  use?: string;
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
}

export interface FhirAddress {
  type?: string;
  line?: string;
  streetName?: string;
  houseNumber?: string;
  additionalLocator?: string;
  postBox?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  district?: string;
}

export interface FhirTelecom {
  system?: string;
  value?: string;
}

export interface FhirHumanName {
  use?: string;
  text?: string;
  family?: string;
  /** humanname-namenszusatz: nobility prefix like "Graf", "Herzog" */
  namenszusatz?: string;
  /** humanname-own-prefix: preposition like "von", "van" */
  vorsatzwort?: string;
  /** humanname-own-name: actual family name without prefix/suffix */
  eigenname?: string;
  given?: string[];
  prefix?: string[];
}

// ─── Parsed Domain Objects ────────────────────────────────────────────────────

export interface MioPatient {
  id: string;
  kvid?: string;
  name: FhirHumanName;
  birthName?: FhirHumanName;
  gender?: string;
  birthDate?: string;
  identifiers: FhirIdentifier[];
}

export interface MioPractitioner {
  id: string;
  name: FhirHumanName;
  birthName?: FhirHumanName;
  lanr?: string;
  efn?: string;
  qualifications: FhirCoding[];
  telecoms: FhirTelecom[];
  comment?: string;
}

export interface MioOrganization {
  id: string;
  name?: string;
  iknr?: string;
  bsnr?: string;
  addresses: FhirAddress[];
  telecoms: FhirTelecom[];
  comment?: string;
}

export interface MioPractitionerRole {
  id: string;
  practitioner?: MioPractitioner;
  organization?: MioOrganization;
}

// ─── Impfausweis (Vaccination) ────────────────────────────────────────────────

export type VaccinationEntryType = "end" | "original" | string;

export interface MioImmunization {
  id: string;
  status: string;
  /** Vaccine name: prefers vaccineCode.text, falls back to first coding display */
  vaccineName: string;
  vaccinationDate: string;
  /** true = data recorded by provider, false = reported (e.g. patient recall) */
  primarySource: boolean;
  reportOrigin?: FhirCodeableConcept;
  manufacturer?: string;
  lotNumber?: string;
  note?: string;
  targetDiseases: FhirCoding[];
  isBasicImmunization?: boolean;
  followUpDate?: string;
  /** KBV entry type: "end" = digital-only, "original" = paper original */
  entryType?: VaccinationEntryType;
  /** Practitioner who entered the record */
  enterer?: MioPractitionerRole;
  /** Practitioner who attested/countersigned (Addendum) */
  attesterAddendum?: MioPractitionerRole;
}

export interface MioVaccinationBundle {
  bundleId: string;
  timestamp: string;
  documentDate?: string;
  documentTitle?: string;
  mioVersion: string;
  patient: MioPatient;
  immunizations: MioImmunization[];
  /** Author of the Composition (usually the PractitionerRole that made the entries) */
  author?: MioPractitionerRole;
}

// ─── eAU (Arbeitsunfähigkeitsbescheinigung) ───────────────────────────────────

export type AuType = "Erstbescheinigung" | "Folgebescheinigung" | "Abschlussbescheinigung" | string;

export interface MioAuCondition {
  icdCode?: string;
  icdSystem?: string;
  displayText?: string;
  diagnoseSicherheit?: string;
}

export interface MioEau {
  bundleId: string;
  timestamp: string;
  mioVersion: string;
  patient: MioPatient;
  auType: AuType;
  incapacityFrom: string;
  incapacityTo: string;
  issuedDate: string;
  diagnosePrimary?: MioAuCondition;
  diagnoseSecondary?: MioAuCondition;
  workAccident: boolean;
  initialCertificate: boolean;
  finalCertificate: boolean;
  practitioner?: MioPractitionerRole;
  note?: string;
}

// ─── Mutterpass ───────────────────────────────────────────────────────────────

export interface MioPregnancyObservation {
  id: string;
  code: FhirCoding;
  value?: string | number | boolean | FhirCoding;
  unit?: string;
  effectiveDate?: string;
}

export interface MioMutterpass {
  bundleId: string;
  timestamp: string;
  mioVersion: string;
  patient: MioPatient;
  observations: MioPregnancyObservation[];
  practitioner?: MioPractitionerRole;
}

// ─── Generic Bundle Result ────────────────────────────────────────────────────

export type MioParseResult =
  | { type: "vaccination"; data: MioVaccinationBundle }
  | { type: "eau"; data: MioEau }
  | { type: "mutterpass"; data: MioMutterpass }
  | { type: "unknown"; profileUrl: string };

export class MioParseError extends Error {
  constructor(message: string, public readonly context?: unknown) {
    super(message);
    this.name = "MioParseError";
  }
}
