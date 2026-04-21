import { parseMioBundle, displayName, formatDateDe } from "./index.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const xml = fs.readFileSync(path.join(__dirname, "../../test-data/impfausweis.xml"), "utf-8");

const result = parseMioBundle(xml);

console.log("=== MIO Parse Result ===");
console.log("Typ:", result.type);

if (result.type !== "vaccination") {
  console.error("Unerwarteter Typ:", result.type);
  process.exit(1);
}

const d = result.data;

console.log("\n--- Bundle ---");
console.log("ID:", d.bundleId);
console.log("MIO Version:", d.mioVersion);
console.log("Zeitstempel:", d.timestamp);
console.log("Dokument:", d.documentTitle, "/", d.documentDate);

console.log("\n--- Patient ---");
console.log("Name:", displayName(d.patient.name));
console.log("Geburtsdatum:", formatDateDe(d.patient.birthDate));
console.log("Geschlecht:", d.patient.gender);
console.log("KVID:", d.patient.kvid);
console.log("Geburtsname:", displayName(d.patient.birthName));

console.log("\n--- Impfungen (" + d.immunizations.length + ") ---");
for (const imm of d.immunizations) {
  console.log("\n  Impfstoff:", imm.vaccineName);
  console.log("  Datum:", formatDateDe(imm.vaccinationDate));
  console.log("  Charge:", imm.lotNumber);
  console.log("  Hersteller:", imm.manufacturer);
  console.log("  Grundimmunisierung:", imm.isBasicImmunization);
  console.log("  Folgeimpfung:", imm.followUpDate ? formatDateDe(imm.followUpDate) : "–");
  console.log("  Primärquelle:", imm.primarySource);
  console.log("  Quelle:", imm.reportOrigin?.text);
  console.log("  Eintragstyp:", imm.entryType);
  console.log("  Zielkrankheiten:", imm.targetDiseases.map((t) => t.displayDe ?? t.display).join(", "));
  console.log("  Eintragender Arzt:", imm.enterer?.practitioner ? displayName(imm.enterer.practitioner.name) : "–");
  console.log("  Einrichtung Eintragender:", imm.enterer?.organization?.name ?? "–");
  console.log("  Bestätiger (Addendum):", imm.attesterAddendum?.practitioner ? displayName(imm.attesterAddendum.practitioner.name) : "–");
  console.log("  Einrichtung Bestätiger:", imm.attesterAddendum?.organization?.name ?? "–");
}

console.log("\n--- Autor ---");
console.log("Arzt:", d.author?.practitioner ? displayName(d.author.practitioner.name) : "–");
console.log("Einrichtung:", d.author?.organization?.name ?? "–");

console.log("\n✓ Test erfolgreich");
