import { formatDateDe } from '@mio/parser'
import type { MioEau, MioAuCondition } from '@mio/parser'
import { PatientCard, PractitionerPill, Tag } from './shared'

interface Props {
  data: MioEau
}

type TagColor = 'green' | 'amber' | 'blue'

function auTypeColor(t: string): TagColor {
  if (t === 'Erstbescheinigung') return 'green'
  if (t === 'Folgebescheinigung') return 'amber'
  return 'blue'
}

export function EauViewer({ data }: Props) {
  return (
    <div className="doc-viewer">
      <div className="doc-header">
        <div className="doc-header-icon" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
          AU
        </div>
        <div>
          <div className="doc-header-title">Arbeitsunfähigkeitsbescheinigung</div>
          <div className="doc-header-meta">
            ausgestellt {formatDateDe(data.issuedDate)}
            {' · '}
            <span className="mono">{data.bundleId.slice(0, 8)}…</span>
            <span style={{ marginLeft: 8 }}>
              <Tag color="amber">MIO v{data.mioVersion}</Tag>
            </span>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head">
          <span className="section-title">Zeitraum der Arbeitsunfähigkeit</span>
        </div>
        <div className="section-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="field-label">Von</div>
              <div className="field-value em">{formatDateDe(data.incapacityFrom)}</div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 20, marginTop: 14 }}>→</div>
            <div>
              <div className="field-label">Bis</div>
              <div className="field-value em">{formatDateDe(data.incapacityTo)}</div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
              <Tag color={auTypeColor(data.auType)}>{data.auType}</Tag>
              {data.workAccident && <Tag color="red">Arbeitsunfall</Tag>}
            </div>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head"><span className="section-title">Patient</span></div>
        <div className="section-body">
          <PatientCard patient={data.patient} />
        </div>
      </div>

      {data.diagnosePrimary && (
        <div className="section" style={{ marginBottom: 12 }}>
          <div className="section-head"><span className="section-title">Diagnose</span></div>
          <div className="section-body">
            <DiagnoseBlock label="Hauptdiagnose" condition={data.diagnosePrimary} />
            {data.diagnoseSecondary && (
              <>
                <hr className="divider" />
                <DiagnoseBlock label="Nebendiagnose" condition={data.diagnoseSecondary} />
              </>
            )}
          </div>
        </div>
      )}

      {data.note && (
        <div className="section" style={{ marginBottom: 12 }}>
          <div className="section-head"><span className="section-title">Hinweis</span></div>
          <div className="section-body">
            <div className="note-box">{data.note}</div>
          </div>
        </div>
      )}

      {data.practitioner && (
        <div className="section">
          <div className="section-head"><span className="section-title">Aussteller</span></div>
          <div className="section-body">
            <div className="prac-row">
              <PractitionerPill role="Ausstellender Arzt" practitionerRole={data.practitioner} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiagnoseBlock({ label, condition }: { label: string; condition: MioAuCondition }) {
  return (
    <div className="field-grid">
      {condition.icdCode && (
        <div>
          <div className="field-label">ICD-10</div>
          <div className="field-value mono">{condition.icdCode}</div>
        </div>
      )}
      {condition.displayText && (
        <div>
          <div className="field-label">{label}</div>
          <div className="field-value">{condition.displayText}</div>
        </div>
      )}
      {condition.diagnoseSicherheit && (
        <div>
          <div className="field-label">Diagnosesicherheit</div>
          <div className="field-value">{condition.diagnoseSicherheit}</div>
        </div>
      )}
    </div>
  )
}
