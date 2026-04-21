import { displayName, formatDateDe } from '@mio/parser'
import type { MioPatient, MioPractitionerRole, FhirCoding } from '@mio/parser'

// ── PatientCard ───────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: MioPatient
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PatientCard({ patient }: PatientCardProps) {
  const name = displayName(patient.name)

  return (
    <div className="patient-card">
      <div className="patient-avatar">{getInitials(name)}</div>
      <div className="field-grid" style={{ flex: 1 }}>
        <div>
          <div className="field-label">Name</div>
          <div className="field-value em">{name}</div>
          {patient.birthName && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              geb. {displayName(patient.birthName)}
            </div>
          )}
        </div>
        {patient.birthDate && (
          <div>
            <div className="field-label">Geburtsdatum</div>
            <div className="field-value">{formatDateDe(patient.birthDate)}</div>
          </div>
        )}
        {patient.gender && (
          <div>
            <div className="field-label">Geschlecht</div>
            <div className="field-value">{patient.gender}</div>
          </div>
        )}
        {patient.kvid && (
          <div>
            <div className="field-label">KVID</div>
            <div className="field-value mono">{patient.kvid}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PractitionerPill ──────────────────────────────────────────────────────────

interface PractitionerPillProps {
  role: string
  practitionerRole: MioPractitionerRole
}

export function PractitionerPill({ role, practitionerRole }: PractitionerPillProps) {
  const { practitioner, organization } = practitionerRole
  const qual = practitioner?.qualifications[0]?.display

  return (
    <div className="prac-pill">
      <span className="prac-role">{role}</span>
      <span className="prac-name">{practitioner ? displayName(practitioner.name) : '–'}</span>
      {qual && <span className="prac-org">{qual}</span>}
      {organization?.name && <span className="prac-org">{organization.name}</span>}
    </div>
  )
}

// ── Tag ───────────────────────────────────────────────────────────────────────

type TagColor = 'green' | 'amber' | 'blue' | 'red' | 'gray'

interface TagProps {
  children: React.ReactNode
  color?: TagColor
}

export function Tag({ children, color = 'gray' }: TagProps) {
  return <span className={`tag tag--${color}`}>{children}</span>
}

// ── CodingDisplay ─────────────────────────────────────────────────────────────

interface CodingDisplayProps {
  coding: FhirCoding
}

export function CodingDisplay({ coding }: CodingDisplayProps) {
  const text = coding.displayDe ?? coding.display ?? coding.code ?? '–'
  return <span title={`${coding.system} | ${coding.code}`}>{text}</span>
}
