import { XMLParser } from "fast-xml-parser";
import type {
  FhirCoding,
  FhirCodeableConcept,
  FhirHumanName,
  FhirAddress,
  FhirTelecom,
  FhirIdentifier,
} from "./types.js";

// ─── XML Parsing ──────────────────────────────────────────────────────────────

// Tags that are ALWAYS arrays regardless of context
const ALWAYS_ARRAY = new Set([
  "coding", "identifier", "given", "prefix",
  "telecom", "address", "line", "extension", "section",
  "qualification", "targetDisease", "note", "protocolApplied",
]);

// "name" is an array for HumanName resources but a plain string in Organization
const NAME_ARRAY_PARENTS = new Set([
  "Patient", "Practitioner", "RelatedPerson", "Person",
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name: string, jpath: unknown) => {
    const path = String(jpath);
    if (ALWAYS_ARRAY.has(name)) return true;
    // HumanName array: only in Patient/Practitioner/RelatedPerson context
    if (name === "name") {
      return NAME_ARRAY_PARENTS.has(path.split(".").slice(-2, -1)[0] ?? "");
    }
    // Bundle entries: array except inside Composition.section
    if (name === "entry") {
      return path !== "Bundle.entry.resource.Composition.section.entry";
    }
    return false;
  },
  removeNSPrefix: false,
});

/** Parse a FHIR Bundle XML string into a raw JS object tree */
export function parseXml(xml: string): Record<string, unknown> {
  const result = xmlParser.parse(xml) as Record<string, unknown>;
  if (!result["Bundle"]) {
    throw new Error("Root element is not a FHIR Bundle");
  }
  return result["Bundle"] as Record<string, unknown>;
}

// ─── Generic attribute/value accessors ───────────────────────────────────────

/** fast-xml-parser represents <foo value="x"/> as { "@_value": "x" } */
export function attr(node: unknown, key = "value"): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[`@_${key}`];
  return v !== undefined ? String(v) : undefined;
}

/** Safely navigate a path of keys through nested objects */
export function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Return node as array regardless of whether it already is one */
export function asArray<T>(val: unknown): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? (val as T[]) : [val as T];
}

// ─── Extension helpers ────────────────────────────────────────────────────────

export function findExtension(extensions: unknown[], url: string): unknown {
  for (const ext of extensions) {
    if (attr(ext, "url") === url) return ext;
  }
  return undefined;
}

export function getExtensionValue(
  extensions: unknown[],
  url: string,
  valueKey = "valueString"
): string | undefined {
  const ext = findExtension(extensions, url);
  if (!ext) return undefined;
  const val = dig(ext, valueKey);
  return attr(val) ?? undefined;
}

export function getNestedExtensionValue(
  extensions: unknown[],
  outerUrl: string,
  innerUrl: string,
  valueKey = "valueString"
): string | undefined {
  const outer = findExtension(extensions, outerUrl);
  if (!outer) return undefined;
  const inner = asArray<unknown>(dig(outer, "extension"));
  return getExtensionValue(inner, innerUrl, valueKey);
}

// ─── Date normalisation ───────────────────────────────────────────────────────

const DE_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Normalise dates to ISO (YYYY-MM-DD).
 * KBV examples use DD.MM.YYYY in some fields despite the spec saying ISO 8601.
 */
export function normaliseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "-" || trimmed === "") return undefined;
  const deMatch = trimmed.match(DE_DATE_RE);
  if (deMatch) return `${deMatch[3]}-${deMatch[2]}-${deMatch[1]}`;
  if (ISO_DATE_RE.test(trimmed)) return trimmed.substring(0, 10);
  return trimmed;
}

/** Format an ISO date string to German locale (DD.MM.YYYY) */
export function formatDateDe(iso: string | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso + "T12:00:00Z"); // noon UTC avoids DST off-by-one
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── FHIR structure extractors ────────────────────────────────────────────────

export function extractCodings(vaccineCodeNode: unknown): FhirCoding[] {
  const codings = asArray<unknown>(dig(vaccineCodeNode, "coding"));
  return codings.map((c) => {
    // KBV German display text lives inside display > extension > extension[url=content] > valueString
    const displayNode = dig(c, "display");
    const exts = asArray<unknown>(dig(displayNode, "extension"));
    const deExt = findExtension(exts, "https://fhir.kbv.de/StructureDefinition/KBV_EX_Base_Terminology_German");
    let displayDe: string | undefined;
    if (deExt) {
      const innerExts = asArray<unknown>(dig(deExt, "extension"));
      displayDe = getExtensionValue(innerExts, "content", "valueString");
    }
    return {
      system: attr(dig(c, "system")),
      version: attr(dig(c, "version")),
      code: attr(dig(c, "code")),
      display: attr(displayNode),
      displayDe,
    };
  });
}

export function extractCodeableConcept(node: unknown): FhirCodeableConcept {
  return {
    coding: extractCodings(node),
    text: attr(dig(node, "text")),
  };
}

export function extractIdentifiers(resource: unknown): FhirIdentifier[] {
  return asArray<unknown>(dig(resource, "identifier")).map((id) => ({
    use: attr(dig(id, "use")),
    type: extractCodeableConcept(dig(id, "type")),
    system: attr(dig(id, "system")),
    value: attr(dig(id, "value")),
  }));
}

export function extractTelecoms(resource: unknown): FhirTelecom[] {
  return asArray<unknown>(dig(resource, "telecom")).map((t) => ({
    system: attr(dig(t, "system")),
    value: attr(dig(t, "value")),
  }));
}

function extractAddressLine(lineNode: unknown): {
  line?: string;
  streetName?: string;
  houseNumber?: string;
  additionalLocator?: string;
  postBox?: string;
} {
  if (!lineNode) return {};
  const text = typeof lineNode === "object" ? attr(lineNode) : String(lineNode);
  const exts = asArray<unknown>(dig(lineNode, "extension"));
  return {
    line: text,
    streetName: getExtensionValue(exts, "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-streetName"),
    houseNumber: getExtensionValue(exts, "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-houseNumber"),
    additionalLocator: getExtensionValue(exts, "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-additionalLocator"),
    postBox: getExtensionValue(exts, "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-postBox"),
  };
}

export function extractAddresses(resource: unknown): FhirAddress[] {
  return asArray<unknown>(dig(resource, "address")).map((a) => {
    const lines = asArray<unknown>(dig(a, "line"));
    const firstLine = lines[0];
    const lineData = extractAddressLine(firstLine);
    const exts = asArray<unknown>(dig(a, "extension"));
    return {
      type: attr(dig(a, "type")),
      district: getExtensionValue(exts, "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-precinct"),
      ...lineData,
      city: attr(dig(a, "city")),
      state: attr(dig(a, "state")),
      postalCode: attr(dig(a, "postalCode")),
      country: attr(dig(a, "country")),
    };
  });
}

/**
 * Extract a KBV HumanName with all German extensions.
 * KBV uses <name> in Patient/Practitioner, but also accepts the tag name
 * "geburtsname" for birth names — both use the same structure.
 */
export function extractHumanName(nameNode: unknown): FhirHumanName {
  const familyNode = dig(nameNode, "family");
  const familyExts = asArray<unknown>(dig(familyNode, "extension"));

  const eigenname = getExtensionValue(familyExts, "http://hl7.org/fhir/StructureDefinition/humanname-own-name");
  const namenszusatz = getExtensionValue(familyExts, "http://fhir.de/StructureDefinition/humanname-namenszusatz");
  const vorsatzwort = getExtensionValue(familyExts, "http://hl7.org/fhir/StructureDefinition/humanname-own-prefix");

  const prefixNodes = asArray<unknown>(dig(nameNode, "prefix"));
  const prefixes = prefixNodes.map((p) => {
    const pExts = asArray<unknown>(dig(p, "extension"));
    const qualifier = findExtension(pExts, "http://hl7.org/fhir/StructureDefinition/iso21090-EN-qualifier");
    return attr(dig(qualifier, "valueString")) ?? attr(dig(qualifier, "valueCode")) ?? attr(p) ?? "";
  }).filter(Boolean);

  const givenNodes = asArray<unknown>(dig(nameNode, "given"));
  const givens = givenNodes.map((g) => attr(g) ?? "").filter(Boolean);

  return {
    use: attr(dig(nameNode, "use")),
    text: attr(dig(nameNode, "text")),
    family: attr(familyNode),
    eigenname,
    namenszusatz,
    vorsatzwort,
    given: givens,
    prefix: prefixes,
  };
}
