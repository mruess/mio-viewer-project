import {
  attr,
  dig,
  asArray,
  findExtension,
  getExtensionValue,
  getNestedExtensionValue,
  extractCodings,
  extractCodeableConcept,
  normaliseDate,
  parseXml,
} from "./fhir-utils.js";
import { buildEntryMap, resolveRefNode, uniqueEntries } from "./bundle-resolver.js";
import {
  extractPatient,
  extractPractitionerRole,
} from "./resource-extractors.js";
import type {
  MioVaccinationBundle,
  MioImmunization,
  MioEau,
  MioMutterpass,
  MioPregnancyObservation,
  MioParseResult,
  FhirCoding,
} from "./types.js";
import { MioParseError } from "./types.js";

// ─── Profile URL constants ────────────────────────────────────────────────────

const PROFILE_VACCINATION =
  "https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_Vaccination_Bundle_Entry";
const PROFILE_EAU =
  "https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_AU_Bundle";
const PROFILE_MUTTERPASS =
  "https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_MR_Bundle";

function getBundleProfile(bundle: Record<string, unknown>): string {
  const profileNode = dig(bundle, "meta", "profile");
  const profileVal = attr(profileNode);
  // Strip version suffix (|1.1.0)
  return profileVal?.split("|")[0] ?? "";
}

// ─── Impfausweis Parser ───────────────────────────────────────────────────────

function parseImmunization(resource: unknown, entryMap: Map<string, unknown>): MioImmunization {
  const rootExts = asArray<unknown>((resource as Record<string, unknown>)["extension"]);

  // Entry type (end = digital-only, original = paper)
  const entryTypeExt = findExtension(
    rootExts,
    "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_Vaccination_Entry_Type"
  );
  const entryType = attr(
    dig(entryTypeExt, "valueCodeableConcept", "coding", "0", "code")
  ) ?? getNestedExtensionValue(
    asArray<unknown>(dig(entryTypeExt, "extension")),
    "valueCodeableConcept",
    "code"
  );

  // Attester (Addendum — countersigning practitioner)
  const attesterExt = findExtension(
    rootExts,
    "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_Vaccination_Attester_Addendum"
  );
  const attesterPartyExts = asArray<unknown>(dig(attesterExt, "extension"));
  const attesterPartyRef = findExtension(attesterPartyExts, "party");
  const attesterEntry = attesterPartyRef
    ? resolveRefNode(
        dig(attesterPartyRef, "valueReference"),
        entryMap as Map<string, import("./bundle-resolver.js").BundleEntry>
      )
    : undefined;

  // Enterer (practitioner who recorded the entry)
  const entererExt = findExtension(
    rootExts,
    "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_Vaccination_Enterer"
  );
  const entererPartyExts = asArray<unknown>(dig(entererExt, "extension"));
  const entererPartyRef = findExtension(entererPartyExts, "party");
  const entererEntry = entererPartyRef
    ? resolveRefNode(
        dig(entererPartyRef, "valueReference"),
        entryMap as Map<string, import("./bundle-resolver.js").BundleEntry>
      )
    : undefined;

  // Vaccine code
  const vaccineCodeNode = dig(resource, "vaccineCode");
  const codings = extractCodings(vaccineCodeNode);
  const vaccineName =
    attr(dig(vaccineCodeNode, "text")) ??
    codings.find((c) => c.displayDe)?.displayDe ??
    codings.find((c) => c.display)?.display ??
    codings[0]?.code ??
    "Unbekannt";

  // protocolApplied
  const protocols = asArray<unknown>(dig(resource, "protocolApplied"));
  const proto = protocols[0];
  const protoExts = asArray<unknown>(dig(proto, "extension"));

  const isBasicImmunization =
    getExtensionValue(
      protoExts,
      "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_Vaccination_Basic_Immunization",
      "valueBoolean"
    )?.toLowerCase() === "true";

  const followUpRaw = getExtensionValue(
    protoExts,
    "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_Vaccination_Follow_Up",
    "valueDateTime"
  );

  const targetDiseases: FhirCoding[] = asArray<unknown>(dig(proto, "targetDisease")).flatMap(
    (td) => extractCodings(td)
  );

  // Notes
  const notes = asArray<unknown>(dig(resource, "note"));
  const note = attr(dig(notes[0], "text"))?.trim();

  return {
    id: attr(dig(resource, "id")) ?? "",
    status: attr(dig(resource, "status")) ?? "",
    vaccineName,
    vaccinationDate: normaliseDate(attr(dig(resource, "occurrenceDateTime"))) ?? "",
    primarySource: attr(dig(resource, "primarySource")) === "true",
    reportOrigin: dig(resource, "reportOrigin")
      ? extractCodeableConcept(dig(resource, "reportOrigin"))
      : undefined,
    manufacturer: attr(dig(resource, "manufacturer", "display")),
    lotNumber: attr(dig(resource, "lotNumber")),
    note: note && note !== "" ? note : undefined,
    targetDiseases,
    isBasicImmunization,
    followUpDate: normaliseDate(followUpRaw),
    entryType: entryType ?? undefined,
    enterer: entererEntry
      ? extractPractitionerRole(
          entererEntry.resource,
          entryMap as Map<string, import("./bundle-resolver.js").BundleEntry>
        )
      : undefined,
    attesterAddendum: attesterEntry
      ? extractPractitionerRole(
          attesterEntry.resource,
          entryMap as Map<string, import("./bundle-resolver.js").BundleEntry>
        )
      : undefined,
  };
}

export function parseVaccinationBundle(bundle: Record<string, unknown>): MioVaccinationBundle {
  const entryMap = buildEntryMap(bundle);

  // Find Composition for document metadata
  const compositionEntry = uniqueEntries(entryMap).find(
    (e) => e.resourceType === "Composition"
  );
  const composition = compositionEntry?.resource;

  // Author (PractitionerRole)
  const authorEntry = composition
    ? resolveRefNode(dig(composition, "author"), entryMap)
    : undefined;

  // Patient
  const patientEntry = uniqueEntries(entryMap).find((e) => e.resourceType === "Patient");
  if (!patientEntry) throw new MioParseError("Kein Patient im Impfausweis-Bundle gefunden");

  // Immunizations
  const immunizationEntries = uniqueEntries(entryMap).filter(
    (e) => e.resourceType === "Immunization"
  );

  const mioVersionRaw = attr(dig(bundle, "meta", "profile")) ?? "";
  const mioVersion = mioVersionRaw.includes("|") ? mioVersionRaw.split("|")[1] : "unbekannt";

  return {
    bundleId: attr(dig(bundle, "id")) ?? "",
    timestamp: normaliseDate(attr(dig(bundle, "timestamp"))) ?? "",
    documentDate: normaliseDate(attr(dig(composition, "date"))),
    documentTitle: attr(dig(composition, "title")),
    mioVersion,
    patient: extractPatient(patientEntry.resource),
    immunizations: immunizationEntries.map((e) => parseImmunization(e.resource, entryMap)),
    author: authorEntry
      ? extractPractitionerRole(authorEntry.resource, entryMap)
      : undefined,
  };
}

// ─── eAU Parser ───────────────────────────────────────────────────────────────

export function parseEauBundle(bundle: Record<string, unknown>): MioEau {
  const entryMap = buildEntryMap(bundle);

  const patientEntry = uniqueEntries(entryMap).find((e) => e.resourceType === "Patient");
  if (!patientEntry) throw new MioParseError("Kein Patient im eAU-Bundle gefunden");

  const conditionEntry = uniqueEntries(entryMap).find((e) => e.resourceType === "Condition");
  const condition = conditionEntry?.resource;

  const compositionEntry = uniqueEntries(entryMap).find((e) => e.resourceType === "Composition");
  const composition = compositionEntry?.resource;

  // eAU specifics live in Condition and Composition extensions
  const compositionExts = asArray<unknown>((composition as Record<string, unknown> | undefined)?.["extension"]);

  const auType =
    getExtensionValue(
      compositionExts,
      "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_AU_Bescheinigungsart"
    ) ?? "Unbekannt";

  const incapacityFrom =
    normaliseDate(
      getExtensionValue(
        compositionExts,
        "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_AU_AUZeitraum_Von"
      )
    ) ?? "";
  const incapacityTo =
    normaliseDate(
      getExtensionValue(
        compositionExts,
        "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_AU_AUZeitraum_Bis"
      )
    ) ?? "";

  const conditionExts = asArray<unknown>((condition as Record<string, unknown> | undefined)?.["extension"]);

  const icdCodings = extractCodings(dig(condition, "code"));
  const primaryIcd = icdCodings.find((c) => c.system?.includes("icd"));

  const practitionerRoleEntry = uniqueEntries(entryMap).find(
    (e) => e.resourceType === "PractitionerRole"
  );

  const mioVersionRaw = attr(dig(bundle, "meta", "profile")) ?? "";
  const mioVersion = mioVersionRaw.includes("|") ? mioVersionRaw.split("|")[1] : "unbekannt";

  return {
    bundleId: attr(dig(bundle, "id")) ?? "",
    timestamp: normaliseDate(attr(dig(bundle, "timestamp"))) ?? "",
    mioVersion,
    patient: extractPatient(patientEntry.resource),
    auType,
    incapacityFrom,
    incapacityTo,
    issuedDate: normaliseDate(attr(dig(composition, "date"))) ?? "",
    diagnosePrimary: primaryIcd
      ? {
          icdCode: primaryIcd.code,
          icdSystem: primaryIcd.system,
          displayText: primaryIcd.displayDe ?? primaryIcd.display,
        }
      : undefined,
    workAccident:
      getExtensionValue(
        conditionExts,
        "https://fhir.kbv.de/StructureDefinition/KBV_EX_MIO_AU_Arbeitsunfall"
      ) === "true",
    initialCertificate: auType?.toLowerCase().includes("erst"),
    finalCertificate: auType?.toLowerCase().includes("abschluss"),
    practitioner: practitionerRoleEntry
      ? extractPractitionerRole(practitionerRoleEntry.resource, entryMap)
      : undefined,
  };
}

// ─── Mutterpass Parser ────────────────────────────────────────────────────────

export function parseMutterpassBundle(bundle: Record<string, unknown>): MioMutterpass {
  const entryMap = buildEntryMap(bundle);

  const patientEntry = uniqueEntries(entryMap).find((e) => e.resourceType === "Patient");
  if (!patientEntry) throw new MioParseError("Kein Patient im Mutterpass-Bundle gefunden");

  const observationEntries = uniqueEntries(entryMap).filter(
    (e) => e.resourceType === "Observation"
  );

  const observations: MioPregnancyObservation[] = observationEntries.map((e) => {
    const r = e.resource;
    const codings = extractCodings(dig(r, "code"));
    const code = codings[0] ?? { code: "unknown" };

    // Value can be valueQuantity, valueCodeableConcept, valueBoolean, valueString, valueDateTime
    let value: string | number | boolean | FhirCoding | undefined;
    let unit: string | undefined;

    const valQuantity = dig(r, "valueQuantity");
    const valConcept = dig(r, "valueCodeableConcept");
    const valBool = dig(r, "valueBoolean");
    const valStr = dig(r, "valueString");
    const valDT = dig(r, "valueDateTime");

    if (valQuantity) {
      value = Number(attr(dig(valQuantity, "value")));
      unit = attr(dig(valQuantity, "unit")) ?? attr(dig(valQuantity, "code"));
    } else if (valConcept) {
      const c = extractCodings(valConcept)[0];
      value = c?.displayDe ?? c?.display ?? c?.code;
    } else if (valBool !== undefined) {
      value = attr(valBool) === "true";
    } else if (valStr !== undefined) {
      value = attr(valStr);
    } else if (valDT !== undefined) {
      value = normaliseDate(attr(valDT));
    }

    return {
      id: attr(dig(r, "id")) ?? "",
      code,
      value,
      unit,
      effectiveDate: normaliseDate(attr(dig(r, "effectiveDateTime"))),
    };
  });

  const practitionerRoleEntry = uniqueEntries(entryMap).find(
    (e) => e.resourceType === "PractitionerRole"
  );

  const mioVersionRaw = attr(dig(bundle, "meta", "profile")) ?? "";
  const mioVersion = mioVersionRaw.includes("|") ? mioVersionRaw.split("|")[1] : "unbekannt";

  return {
    bundleId: attr(dig(bundle, "id")) ?? "",
    timestamp: normaliseDate(attr(dig(bundle, "timestamp"))) ?? "",
    mioVersion,
    patient: extractPatient(patientEntry.resource),
    observations,
    practitioner: practitionerRoleEntry
      ? extractPractitionerRole(practitionerRoleEntry.resource, entryMap)
      : undefined,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Parse a FHIR Bundle XML string and return a typed MioParseResult.
 * Detects the MIO type from the Bundle meta.profile URL.
 */
export function parseMioBundle(xml: string): MioParseResult {
  const bundle = parseXml(xml);
  const profile = getBundleProfile(bundle);

  if (profile.startsWith(PROFILE_VACCINATION)) {
    return { type: "vaccination", data: parseVaccinationBundle(bundle) };
  }
  if (profile.startsWith(PROFILE_EAU)) {
    return { type: "eau", data: parseEauBundle(bundle) };
  }
  if (profile.startsWith(PROFILE_MUTTERPASS)) {
    return { type: "mutterpass", data: parseMutterpassBundle(bundle) };
  }

  return { type: "unknown", profileUrl: profile };
}
