import { useDropzone } from '../hooks/useDropzone'

export interface DocEntry {
  id: string
  label: string
  desc?: string
  type: 'vacc' | 'eau' | 'mp'
  xml: string
}

const ICON_LABELS: Record<DocEntry['type'], string> = { vacc: 'IV', eau: 'AU', mp: 'MP' }

interface SidebarProps {
  documents: DocEntry[]
  activeId: string | null
  onSelect: (doc: DocEntry) => void
  onFile: (file: File) => void
}

export function Sidebar({ documents, activeId, onSelect, onFile }: SidebarProps) {
  const { isDragging, dropzoneProps, inputProps } = useDropzone({ onFile })

  return (
    <aside className="app-sidebar">
      <div style={{ padding: '0 12px', marginBottom: 10 }}>
        <span className="sidebar-label">Dokumente</span>
      </div>
      <div style={{ padding: '0 8px' }}>
        {documents.map((doc) => (
          <button
            key={doc.id}
            className={`doc-item${activeId === doc.id ? ' active' : ''}`}
            onClick={() => onSelect(doc)}
          >
            <div className={`doc-icon doc-icon--${doc.type}`}>
              {ICON_LABELS[doc.type]}
            </div>
            <div>
              <div className="doc-title">{doc.label}</div>
              {doc.desc && <div className="doc-desc">{doc.desc}</div>}
            </div>
          </button>
        ))}
      </div>
      <label
        className={`upload-zone${isDragging ? ' dragging' : ''}`}
        {...dropzoneProps}
      >
        <input {...inputProps} />
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>XML hochladen</div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
          Klick oder Drag &amp; Drop
        </div>
      </label>
    </aside>
  )
}
