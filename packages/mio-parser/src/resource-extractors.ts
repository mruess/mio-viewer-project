import {
  attr, dig, asArray,
  extractIdentifiers, extractHumanName, extractTelecoms,
  extractAddresses, extractCodings, getExtensionValue, normaliseDate,
} from "./fhir-utils.js";
import { resolveRefNode, type BundleEntry } from "./bundle-resolver.js";
import type {
  MioPatient, MioPractitioner, MioOrganization,
  MioPractitionerRole, FhirHumanName,
} from "./types.js";

// ─── Patient ──────────────────────────────────────────────────────────────────

export function extractPatient(resource: unknown): MioPatient {
  const res = resource as Record<string, unknown>;

  // KBV uses <name> for official and <geburtsname> for birth name
  const nameNodes = asArray<unknown>(res["name"]);
  const officialName = nameNodes.find((n) => attr(dig(n, "use")) === "official") ?? nameNodes[0];
  const birthNameNode = res["geburtsname"];

  const identifiers = extractIdentifiers(resource);
  const kvid = identifiers.find(
    (id) => id.type?.coding.some((c) => c.code === "GKV") || id.system?.includes("gkv/kvid-10")
  )?.value;

  const genderMap: Record<string, string> = {
    male: "männlich", female: "weiblich", other: "divers", unknown: "unbekannt",
  };
  const genderRaw = attr(dig(resource, "gender"));

  return {
    id: attr(dig(resource, "id")) ?? "",
    kvid,
    name: officialName ? extractHumanName(officialName) : { text: "Unbekannt" },
    birthName: birthNameNode ? extractHumanName(birthNameNode) : undefined,
    gender: genderRaw ? (genderMap[genderRaw] ?? genderRaw) : undefined,
    birthDate: normaliseDate(attr(dig(resource, "birthDate"))),
    identifiers,
  };
}

// ─── Practitioner ─────────────────────────────────────────────────────────────

export function extractPractitioner(resource: unknown): MioPractitioner {
  const res = resource as Record<string, unknown>;
  const nameNodes = asArray<unknown>(res["name"]);
  const officialName = nameNodes.find((n) => attr(dig(n, "use")) === "official") ?? nameNodes[0];
  const birthNameNode = res["geburtsname"];

  const identifiers = extractIdentifiers(resource);
  const lanr = identifiers.find(
    (id) => id.type?.coding.some((c) => c.code === "LANR") || id.system?.includes("KBV_NS_Base_ANR")
  )?.value;
  const efn = identifiers.find(
    (id) => id.type?.coding.some((c) => c.code === "MD") || id.system?.includes("bundesaerztekammer/efn")
  )?.value;

  const qualNodes = asArray<unknown>(dig(resource, "qualification"));
  const qualifications = qualNodes.flatMap((q) => extractCodings(dig(q, "code")));

  const rootExts = asArray<unknown>(res["extension"]);
  const comment = getExtensionValue(rootExts, "https://fhir.kbv.de/StructureDefinition/KBV_EX_Base_Additional_Comment");

  return {
    id: attr(dig(resource, "id")) ?? "",
    name: officialName ? extractHumanName(officialName) : { text: "Unbekannt" },
    birthName: birthNameNode ? extractHumanName(birthNameNode) : undefined,
    lanr, efn, qualifications,
    telecoms: extractTelecoms(resource),
    comment,
  };
}

// ─── Organization ─────────────────────────────────────────────────────────────

export function extractOrganization(resource: unknown): MioOrganization {
  const identifiers = extractIdentifiers(resource);
  const iknr = identifiers.find(
    (id) => id.type?.coding.some((c) => c.code === "XX") || id.system?.includes("arge-ik/iknr")
  )?.value;
  const bsnr = identifiers.find(
    (id) => id.type?.coding.some((c) => c.code === "BSNR") || id.system?.includes("KBV_NS_Base_BSNR")
  )?.value;

  const rootExts = asArray<unknown>((resource as Record<string, unknown>)["extension"]);
  const comment = getExtensionValue(rootExts, "https://fhir.kbv.de/StructureDefinition/KBV_EX_Base_Additional_Comment");

  return {
    id: attr(dig(resource, "id")) ?? "",
    name: attr(dig(resource, "name")),
    iknr, bsnr,
    addresses: extractAddresses(resource),
    telecoms: extractTelecoms(resource),
    comment,
  };
}

// ─── PractitionerRole ─────────────────────────────────────────────────────────

export function extractPractitionerRole(
  resource: unknown,
  entryMap: Map<string, BundleEntry>
): MioPractitionerRole {
  const pracEntry = resolveRefNode(dig(resource, "practitioner"), entryMap);
  const orgEntry = resolveRefNode(dig(resource, "organization"), entryMap);

  return {
    id: attr(dig(resource, "id")) ?? "",
    practitioner: pracEntry ? extractPractitioner(pracEntry.resource) : undefined,
    organization: orgEntry ? extractOrganization(orgEntry.resource) : undefined,
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Returns a readable display name. Prefers .text, then reconstructs from parts. */
export function displayName(name: FhirHumanName | undefined): string {
  if (!name) return "–";
  if (name.text) return name.text;
  const parts: string[] = [];
  if (name.prefix?.length) parts.push(name.prefix.join(" "));
  if (name.namenszusatz) parts.push(name.namenszusatz);
  if (name.given?.length) parts.push(name.given.join(" "));
  if (name.vorsatzwort) parts.push(name.vorsatzwort);
  parts.push(name.eigenname ?? name.family ?? "");
  return parts.filter(Boolean).join(" ") || "–";
}

/** Returns primary physical address (type=both), falls back to first address */
export function primaryAddress(addresses: import("./types.js").FhirAddress[]): import("./types.js").FhirAddress | undefined {
  return addresses.find((a) => a.type === "both") ?? addresses[0];
}
