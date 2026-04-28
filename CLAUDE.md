# CLAUDE.md — MIO Viewer Projekt

---

## 1. Projektziel

Ein **Read-Only MIO-Viewer** für die elektronische Patientenakte (ePA). Die App empfängt FHIR-Bundle-XML-Dateien aus dem ePA-System und stellt sie in lesbarer Form dar — **ohne Bearbeitung, rein clientseitig**. Dokumente können per Datei-Upload oder über einen URL-Parameter `?id=` aus einem Backend geladen werden.

Unterstützte Dokumenttypen (MIOs = Medizinische Informationsobjekte, KBV-Standard):

- **Impfausweis** (`KBV_PR_MIO_Vaccination_Bundle_Entry`)
- **eAU** — Arbeitsunfähigkeitsbescheinigung (`KBV_PR_MIO_AU_Bundle`)
- **Mutterpass** (`KBV_PR_MIO_MR_Bundle`)

---

## 2. Repo-Struktur

```
mio-viewer-project/
├── CLAUDE.md                         ← diese Datei
├── package.json                      ← npm workspaces root
├── packages/
│   ├── mio-parser/                   ← @mio/parser — FERTIG, nicht anfassen
│   │   ├── src/
│   │   │   ├── types.ts              ← alle TypeScript-Interfaces
│   │   │   ├── fhir-utils.ts         ← XML-Parser, attr(), dig(), asArray()
│   │   │   ├── bundle-resolver.ts    ← UUID-Referenz-Auflösung
│   │   │   ├── resource-extractors.ts← Patient, Practitioner, Organization
│   │   │   ├── parsers.ts            ← parseMioBundle() — Haupteinstieg
│   │   │   └── index.ts              ← öffentliches API
│   │   └── package.json / tsconfig.json
│   │
│   └── mio-viewer/                   ← React-App — FERTIG
│       ├── src/
│       │   ├── main.tsx              ← Entry point (fertig)
│       │   ├── index.css             ← Design-Tokens + alle CSS-Klassen (fertig)
│       │   ├── App.tsx               ← Root-Komponente mit State-Management (fertig)
│       │   ├── hooks/
│       │   │   ├── useMioParser.ts   ← Parser-Hook mit Loading/Error (fertig)
│       │   │   └── useDropzone.ts    ← Drag & Drop Hook (fertig)
│       │   └── components/
│       │       ├── shared.tsx        ← PatientCard, PractitionerPill, Tag (fertig)
│       │       ├── Sidebar.tsx       ← Dokument-Liste + Upload-Zone (fertig)
│       │       ├── VaccinationViewer.tsx ← Impfausweis-Renderer (fertig)
│       │       ├── EauViewer.tsx     ← eAU-Renderer (fertig)
│       │       └── MutterpassViewer.tsx  ← Mutterpass-Renderer (fertig)
│       └── package.json / tsconfig.json / vite.config.ts / index.html
│
└── test-data/
    ├── impfausweis_real.xml          ← echtes KBV-Beispiel-Bundle (v1.1.0)
    ├── eau.xml                       ← synthetisches eAU-Bundle
    └── mutterpass.xml                ← synthetisches Mutterpass-Bundle
```

---

## 3. Setup & Start

```bash
# 1. Dependencies installieren
npm install

# 2. Parser bauen (einmalig, danach bei Änderungen am Parser)
npm run build --workspace=packages/mio-parser

# 3. Viewer starten
npm run dev --workspace=packages/mio-viewer
# → http://localhost:5173
```

---

## 4. Parser-API (@mio/parser)

Der Parser ist fertig und getestet. **Nicht anfassen.**

### Haupteinstieg

```typescript
import { parseMioBundle, displayName, formatDateDe } from '@mio/parser'

const result = parseMioBundle(xmlString) // MioParseResult

switch (result.type) {
  case 'vaccination': // result.data: MioVaccinationBundle
  case 'eau':         // result.data: MioEau
  case 'mutterpass':  // result.data: MioMutterpass
  case 'unknown':     // result.profileUrl: string
}
```

### Hilfsfunktionen

```typescript
displayName(name: FhirHumanName): string
// → bevorzugt .text, rekonstruiert sonst aus prefix + namenszusatz + given + vorsatzwort + eigenname

formatDateDe(iso: string | undefined): string
// → "2021-06-23" → "23.06.2021", undefined → "–"

normaliseDate(raw: string | undefined): string | undefined
// → "23.06.2021" oder "2021-06-23" → immer "2021-06-23"
```

### 4.1 MioVaccinationBundle — Impfausweis

```typescript
interface MioVaccinationBundle {
  bundleId: string
  timestamp: string          // ISO-Datum
  documentDate?: string      // ISO-Datum (aus Composition.date)
  documentTitle?: string     // z.B. "Impfeintrag-/einträge nach-/übertrag"
  mioVersion: string         // z.B. "1.1.0"
  patient: MioPatient
  immunizations: MioImmunization[]
  author?: MioPractitionerRole
}

interface MioImmunization {
  id: string
  status: string              // "completed"
  vaccineName: string         // bevorzugt vaccineCode.text
  vaccinationDate: string     // ISO
  primarySource: boolean      // false = Nachtrag/Recall
  reportOrigin?: FhirCodeableConcept  // .text = lesbare Herkunft
  manufacturer?: string
  lotNumber?: string
  note?: string
  targetDiseases: FhirCoding[]        // .displayDe bevorzugen
  isBasicImmunization?: boolean
  followUpDate?: string        // ISO, optional
  entryType?: string           // "end" = nur digital | "original" = Papieroriginal
  enterer?: MioPractitionerRole        // hat eingetragen
  attesterAddendum?: MioPractitionerRole  // hat gegengezeichnet
}
```

### 4.2 MioEau — Arbeitsunfähigkeitsbescheinigung

```typescript
interface MioEau {
  bundleId: string
  timestamp: string
  mioVersion: string
  patient: MioPatient
  auType: string              // "Erstbescheinigung" | "Folgebescheinigung" | "Abschlussbescheinigung"
  incapacityFrom: string      // ISO
  incapacityTo: string        // ISO
  issuedDate: string          // ISO
  diagnosePrimary?: {
    icdCode?: string          // z.B. "J06.9"
    icdSystem?: string
    displayText?: string      // lesbare Diagnose
    diagnoseSicherheit?: string
  }
  diagnoseSecondary?: MioAuCondition
  workAccident: boolean       // Arbeitsunfall → auffällig darstellen wenn true
  initialCertificate: boolean
  finalCertificate: boolean
  practitioner?: MioPractitionerRole
  note?: string
}
```

### 4.3 MioMutterpass

```typescript
interface MioMutterpass {
  bundleId: string
  timestamp: string
  mioVersion: string
  patient: MioPatient
  observations: MioPregnancyObservation[]
  practitioner?: MioPractitionerRole
}

interface MioPregnancyObservation {
  id: string
  code: FhirCoding             // .text bevorzugen für Anzeige
  value?: string | number | boolean | FhirCoding  // Typen beachten!
  unit?: string                // nur wenn value number
  effectiveDate?: string       // ISO
}
// Hinweis: bei value instanceof FhirCoding → .text ?? .displayDe ?? .display ?? .code anzeigen
```

### 4.4 Gemeinsame Typen

```typescript
interface MioPatient {
  id: string
  kvid?: string
  name: FhirHumanName
  birthName?: FhirHumanName
  gender?: string              // "männlich" | "weiblich" | "divers" | "unbekannt"
  birthDate?: string           // ISO
  identifiers: FhirIdentifier[]
}

interface MioPractitionerRole {
  id: string
  practitioner?: MioPractitioner
  organization?: MioOrganization
}

interface MioPractitioner {
  id: string
  name: FhirHumanName
  lanr?: string                // Lebenslange Arztnummer
  efn?: string                 // Einheitliche Fortbildungsnummer
  qualifications: FhirCoding[] // [0].display = Fachrichtung
  telecoms: FhirTelecom[]
  comment?: string
}

interface MioOrganization {
  id: string
  name?: string
  iknr?: string
  bsnr?: string
  addresses: FhirAddress[]
  telecoms: FhirTelecom[]
}
```

---

## 5. Aufgaben — Implementierungsstand

### Prio 1 — Erledigt ✓

**5.1 App.tsx** ✓ — `useMioParser`-Hook eingebunden, Sidebar integriert, Beispiel-XMLs per `?raw` importiert, `activeDocId`-State verwaltet, URL-Parameter-Ladelogik implementiert (siehe Abschnitt 5a).

**5.2 Sidebar.tsx** ✓ — `useDropzone`-Hook genutzt, drei eingebaute Dokumente, Klick + Drag & Drop, `.active`-Markierung.

**5.3 VaccinationViewer.tsx** ✓ — Dokument-Header, PatientCard, Immunization-Karten (Name, Datum, Charge, Hersteller, Zielkrankheiten, Folgeimpfung, Note, Enterer + Attester), Tags für entryType und isBasicImmunization.

**5.4 EauViewer.tsx** ✓ — AU-Zeitraum prominent, Bescheinigungsart-Tag (Erst=grün/Folge=amber/Abschluss=blau), ICD-10, Arbeitsunfall-Warning.

**5.5 MutterpassViewer.tsx** ✓ — Observations-Tabelle, sicheres value-Rendering (boolean/number/string/FhirCoding).

**5.6 shared.tsx** ✓ — PatientCard (Avatar + Initialen), PractitionerPill, Tag mit Farbvarianten, CodingDisplay-Hilfskomponente.

**5.7 Fehlerbehandlung** ✓ — `type: 'unknown'` mit Profil-URL, MioParseError-Logging, Empty states.

### Prio 3 — Offen (Nice-to-have)

**5.9 Impfausweis: Impfstatus-Zusammenfassung** — STIKO-Kategorien aus targetDiseases gruppieren ("COVID-19: 2 Impfungen" oben).

**5.10 eAU: Sekundärdiagnose** — `diagnoseSecondary` anzeigen wenn vorhanden (Parser füllt das Feld noch nicht).

**5.11 Mutterpass: Observations nach LOINC-Gruppe** — Vitaldaten (8302-2 Größe, 29463-7 Gewicht) vs. Laborwerte vs. Anamnese.

---

## 5a. Backend-Integration — URL-Parameter `?id=`

### Funktionsweise

Beim Seitenaufruf mit `?id=<contextId>` lädt `App.tsx` das Dokument automatisch vom Backend:

```
GET http://192.168.0.225:8090/dataapi/context.php?id=<contextId>
```

Das Backend antwortet mit JSON:

```json
{ "xml": "<base64-kodiertes FHIR-XML>" }
```

`App.tsx` dekodiert das XML mit `atob()` und parst es direkt. Ohne `?id=` startet die App normal mit den eingebauten Beispieldokumenten.

### Fehlerbehandlung

| Fehlerfall | Verhalten |
|---|---|
| HTTP-Fehler (4xx, 5xx) | Fehlermeldung "Kontext `<id>` konnte nicht geladen werden." |
| Fehlendes `xml`-Feld | Wie HTTP-Fehler |
| Ungültiges Base64 | Wie HTTP-Fehler |
| Netzwerkfehler | Fehlermeldung mit technischer Meldung |

### Konfiguration

`API_BASE` ist als Konstante in `App.tsx` (Zeile 12) hinterlegt:

```typescript
const API_BASE = 'http://192.168.0.225:8090/dataapi/context.php'
```

---

## 6. Wichtige Implementierungshinweise

### XML-Besonderheiten die der Parser bereits behandelt

- **Datumformat**: KBV-Bundles nutzen manchmal `DD.MM.YYYY` statt ISO. `formatDateDe()` und `normaliseDate()` kümmern sich darum — rohe `.vaccinationDate`-Werte sind immer ISO.
- **HumanName**: Namen werden aus mehreren Extensions zusammengesetzt. Immer `displayName(name)` nutzen, nie `.name.text` direkt — `.text` kann fehlen.
- **Doppeleinträge in der Map**: `buildEntryMap()` speichert jeden Eintrag doppelt (mit und ohne `urn:uuid:`-Prefix) für schnelle Lookups. Der Parser gibt trotzdem korrekte Arrays zurück.
- **Organization.name vs HumanName**: `<name>` ist in `Organization` ein einfaches Attribut, in `Patient`/`Practitioner` ein Objekt-Array. Der Parser normalisiert das bereits.

### CSS-Konventionen

Alle Design-Tokens sind in `src/index.css` als CSS-Variablen definiert. Keine Inline-Styles, keine Tailwind, keine CSS-in-JS. Klassen-Naming: BEM-ähnlich mit `--` für Modifier (`.tag--green`, `.doc-icon--vacc`).

### Vite + Monorepo

Der `@mio/parser`-Import wird von Vite über den `alias` in `vite.config.ts` direkt auf die TypeScript-Quelldateien gemappt — kein separater Build-Schritt des Parsers nötig während der Entwicklung.

XML-Dateien können mit dem `?raw`-Suffix als String importiert werden:

```typescript
import impfausweisXml from '../../../test-data/impfausweis_real.xml?raw'
```

---

## 7. Bekannte Einschränkungen / Offene Punkte

| Thema | Status | Hinweis |
|---|---|---|
| eAU-Parser | Teilweise | AU-Zeitraum + Diagnose funktioniert; KBV hat das eAU-Profil mehrfach überarbeitet, Extensions können je nach Version variieren |
| Mutterpass-Parser | Basis | Observations werden generisch extrahiert; kein MR-spezifisches Profil-Mapping |
| Folgebescheinigung eAU | Offen | `diagnoseSecondary` wird noch nicht befüllt |
| Fehlerbehandlung Parser | Basis | `MioParseError` wird geworfen, aber kein detailliertes Feld-Level-Logging |
| MIO-Versionen | v1.1.0 getestet | Impfausweis v1.0.0 und v1.1.0; andere Versionen sollten funktionieren aber nicht getestet |

---

## 8. Design-Referenz

Die Datei `mio-viewer.html` (im Projektwurzel oder Output-Ordner) ist eine vollständige funktionierende Standalone-Version des Viewers mit eingebettetem Parser. Sie dient als **visuelles Referenzdokument** — alle Render-Funktionen (`renderVaccination`, `renderEau`, `renderMutterpass`) sind dort als Plain-JS implementiert und können direkt in React portiert werden.

**Farbcodes für MIO-Typen:**

- Impfausweis: Grün (`--accent`, `--accent-bg`) · Icon-Text: `IV`
- eAU: Amber (`--warn`, `--warn-bg`) · Icon-Text: `AU`
- Mutterpass: Blau (`--info`, `--info-bg`) · Icon-Text: `MP`

---

## 9. Testdaten

| Datei | Inhalt | Besonderheit |
|---|---|---|
| `test-data/impfausweis_real.xml` | KBV-Beispiel-Bundle Impfausweis v1.1.0 | 2 Immunizations, 2 PractitionerRoles (Enterer + Attester), komplexe HumanNames mit Adelstiteln |
| `test-data/eau.xml` | Synthetisches eAU-Bundle | Erstbescheinigung J06.9, kein Arbeitsunfall |
| `test-data/mutterpass.xml` | Synthetisches Mutterpass-Bundle | 5 Observations: SSW, Größe, Gewicht, HIV-Test, Blutgruppe |

---

## 10. Nicht in Scope

- Schreibzugriff / Editieren von Dokumenten
- Authentifizierung / TI-Anbindung (läuft außerhalb dieser App)
- Konfigurierbarkeit der Backend-URL zur Laufzeit (aktuell Hardcode in App.tsx)
- PDF-Export
- Mehrsprachigkeit
- Mobiles Layout
