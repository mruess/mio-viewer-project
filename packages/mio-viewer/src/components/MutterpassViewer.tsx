import { formatDateDe } from '@mio/parser'
import type { MioMutterpass, MioPregnancyObservation, FhirCoding } from '@mio/parser'
import { PatientCard, PractitionerPill, Tag } from './shared'

interface Props {
  data: MioMutterpass
}

function renderObsValue(value: MioPregnancyObservation['value'], unit?: string): string {
  if (value === undefined || value === null) return '–'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein'
  if (typeof value === 'number') return unit ? `${value} ${unit}` : String(value)
  if (typeof value === 'string') return unit ? `${value} ${unit}` : value
  const c = value as FhirCoding
  return c.displayDe ?? c.display ?? c.code ?? '–'
}

function obsLabel(obs: MioPregnancyObservation): string {
  return obs.code.displayDe ?? obs.code.display ?? obs.code.code ?? '–'
}

export function MutterpassViewer({ data }: Props) {
  return (
    <div className="doc-viewer">
      <div className="doc-header">
        <div className="doc-header-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
          MP
        </div>
        <div>
          <div className="doc-header-title">Mutterpass</div>
          <div className="doc-header-meta">
            <span className="mono">{data.bundleId.slice(0, 8)}…</span>
            <span style={{ marginLeft: 8 }}>
              <Tag color="blue">MIO v{data.mioVersion}</Tag>
            </span>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head"><span className="section-title">Patientin</span></div>
        <div className="section-body">
          <PatientCard patient={data.patient} />
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head">
          <span className="section-title">Befunde</span>
          <Tag color="gray">{data.observations.length}</Tag>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          {data.observations.length === 0 ? (
            <div style={{ padding: 16 }} className="muted">Keine Befunde vorhanden</div>
          ) : (
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Befund</th>
                  <th>Wert</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {data.observations.map((obs) => (
                  <tr key={obs.id}>
                    <td>{obsLabel(obs)}</td>
                    <td>
                      <span className="obs-value">
                        {renderObsValue(obs.value, obs.unit)}
                      </span>
                    </td>
                    <td className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {formatDateDe(obs.effectiveDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {data.practitioner && (
        <div className="section">
          <div className="section-head"><span className="section-title">Betreuender Arzt</span></div>
          <div className="section-body">
            <div className="prac-row">
              <PractitionerPill role="Betreuender Arzt" practitionerRole={data.practitioner} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
