import { formatDateDe } from '@mio/parser'
import type { MioVaccinationBundle, MioImmunization } from '@mio/parser'
import { PatientCard, PractitionerPill, Tag } from './shared'

interface Props {
  data: MioVaccinationBundle
}

export function VaccinationViewer({ data }: Props) {
  const docDate = data.documentDate ?? data.timestamp?.split('T')[0]

  return (
    <div className="doc-viewer">
      <div className="doc-header">
        <div className="doc-header-icon" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
          IV
        </div>
        <div>
          <div className="doc-header-title">{data.documentTitle ?? 'Impfausweis'}</div>
          <div className="doc-header-meta">
            {formatDateDe(docDate)}
            {' · '}
            <span className="mono">{data.bundleId.slice(0, 8)}…</span>
            <span style={{ marginLeft: 8 }}>
              <Tag color="green">MIO v{data.mioVersion}</Tag>
            </span>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head"><span className="section-title">Patient</span></div>
        <div className="section-body">
          <PatientCard patient={data.patient} />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Impfeinträge</span>
          <Tag color="gray">{data.immunizations.length}</Tag>
        </div>
        <div className="section-body" style={{ padding: '12px 14px' }}>
          {data.immunizations.length === 0 ? (
            <span className="muted">Keine Impfeinträge vorhanden</span>
          ) : (
            data.immunizations.map((imm) => (
              <ImmunizationCard key={imm.id} imm={imm} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ImmunizationCard({ imm }: { imm: MioImmunization }) {
  const followUpIsFuture = imm.followUpDate
    ? new Date(imm.followUpDate) > new Date()
    : false

  return (
    <div className="imm-card">
      <div className="imm-card-head">
        <div>
          <div className="imm-name">{imm.vaccineName}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {imm.entryType === 'original' && <Tag color="blue">Papieroriginal</Tag>}
            {imm.entryType === 'end' && <Tag color="gray">Digital</Tag>}
            {imm.isBasicImmunization && <Tag color="green">Grundimmunisierung</Tag>}
            {!imm.primarySource && <Tag color="amber">Nachtrag</Tag>}
          </div>
        </div>
        <div className="imm-date">{formatDateDe(imm.vaccinationDate)}</div>
      </div>

      <div className="imm-body">
        <div className="imm-meta">
          {imm.lotNumber && (
            <div>
              <div className="field-label">Charge</div>
              <div className="field-value mono">{imm.lotNumber}</div>
            </div>
          )}
          {imm.manufacturer && (
            <div>
              <div className="field-label">Hersteller</div>
              <div className="field-value">{imm.manufacturer}</div>
            </div>
          )}
          {imm.targetDiseases.length > 0 && (
            <div>
              <div className="field-label">Zielkrankheiten</div>
              <div className="field-value">
                {imm.targetDiseases.map((d, i) => (
                  <span key={i}>
                    {i > 0 ? ', ' : ''}
                    {d.displayDe ?? d.display ?? d.code ?? '–'}
                  </span>
                ))}
              </div>
            </div>
          )}
          {imm.followUpDate && (
            <div>
              <div className="field-label">Folgeimpfung</div>
              <div className="field-value">
                {formatDateDe(imm.followUpDate)}
                {followUpIsFuture && (
                  <span style={{ marginLeft: 6 }}>
                    <Tag color="amber">Ausstehend</Tag>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {imm.note && <div className="note-box">{imm.note}</div>}

        {(imm.enterer || imm.attesterAddendum) && (
          <div className="prac-row" style={{ marginTop: 10 }}>
            {imm.enterer && (
              <PractitionerPill role="Eingetragen von" practitionerRole={imm.enterer} />
            )}
            {imm.attesterAddendum && (
              <PractitionerPill role="Bestätigt von" practitionerRole={imm.attesterAddendum} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
