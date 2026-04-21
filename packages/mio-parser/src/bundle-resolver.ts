import { attr, dig, asArray } from "./fhir-utils.js";

export type ResourceType =
  | "Composition"
  | "Patient"
  | "Immunization"
  | "Practitioner"
  | "PractitionerRole"
  | "Organization"
  | "Condition"
  | "Observation"
  | "AllergyIntolerance"
  | string;

export interface BundleEntry {
  fullUrl: string;
  resourceType: ResourceType;
  resource: unknown;
}

/**
 * Builds a lookup map of { uuid → BundleEntry } from a parsed FHIR Bundle.
 * Handles both "urn:uuid:xxx" and plain UUIDs as keys.
 */
export function buildEntryMap(bundle: Record<string, unknown>): Map<string, BundleEntry> {
  const map = new Map<string, BundleEntry>();
  const entries = asArray<unknown>(bundle["entry"]);

  for (const entry of entries) {
    const fullUrl = attr(dig(entry, "fullUrl")) ?? "";
    // Identify resource type by checking which key exists under "resource"
    const resourceWrapper = dig(entry, "resource") as Record<string, unknown> | undefined;
    if (!resourceWrapper) continue;

    const resourceType = Object.keys(resourceWrapper).find((k) =>
      [
        "Composition",
        "Patient",
        "Immunization",
        "Practitioner",
        "PractitionerRole",
        "Organization",
        "Condition",
        "Observation",
        "AllergyIntolerance",
        "CarePlan",
        "Encounter",
        "Procedure",
        "MedicationStatement",
        "DiagnosticReport",
        "DocumentReference",
      ].includes(k)
    ) as ResourceType | undefined;

    if (!resourceType) continue;

    const resource = resourceWrapper[resourceType];
    const bundleEntry: BundleEntry = { fullUrl, resourceType, resource };

    // Store by full urn:uuid: URL
    map.set(fullUrl, bundleEntry);
    // Also store by plain UUID (without urn:uuid: prefix) for convenience
    const plain = fullUrl.replace(/^urn:uuid:/, "");
    if (plain !== fullUrl) map.set(plain, bundleEntry);
  }

  return map;
}

/**
 * Resolve a FHIR reference string to a BundleEntry.
 * Handles "urn:uuid:xxx" and plain UUIDs.
 */
export function resolveRef(
  ref: string | undefined,
  map: Map<string, BundleEntry>
): BundleEntry | undefined {
  if (!ref) return undefined;
  return map.get(ref) ?? map.get(ref.replace(/^urn:uuid:/, ""));
}

/** Convenience: resolve a { reference: { @_value } } node */
export function resolveRefNode(
  refNode: unknown,
  map: Map<string, BundleEntry>
): BundleEntry | undefined {
  const refVal = attr(dig(refNode, "reference"));
  return resolveRef(refVal, map);
}

/**
 * Return deduplicated entries from the map (each physical resource once).
 * buildEntryMap stores every entry twice (urn:uuid: + plain), so we
 * yield only the first occurrence of each fullUrl.
 */
export function uniqueEntries(map: Map<string, BundleEntry>): BundleEntry[] {
  const seen = new Set<string>();
  const out: BundleEntry[] = [];
  for (const entry of map.values()) {
    if (!seen.has(entry.fullUrl)) {
      seen.add(entry.fullUrl);
      out.push(entry);
    }
  }
  return out;
}
