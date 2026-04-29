import { useState, useCallback, useEffect } from 'react'
import { parseMioBundle, type MioParseResult } from '@mio/parser'
import { VaccinationViewer } from './components/VaccinationViewer'
import { EauViewer } from './components/EauViewer'
import { MutterpassViewer } from './components/MutterpassViewer'
import { Sidebar, type DocEntry } from './components/Sidebar'

import impfausweisXml from '../../../test-data/impfausweis_real.xml?raw'
import eauXml from '../../../test-data/eau.xml?raw'
import eauKbvXml from '../../../test-data/eau-kbv-unknown.xml?raw'
import mutterpassXml from '../../../test-data/mutterpass.xml?raw'

const API_BASE = 'http://192.168.0.225:8090/dataapi/context.php'

type ViewerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'parsed'; result: MioParseResult }

const BUILT_IN_DOCS: DocEntry[] = [
  { id: 'builtin-vacc', label: 'Impfausweis', desc: 'KBV · v1.1.0', type: 'vacc', xml: impfausweisXml },
  { id: 'builtin-eau', label: 'eAU', desc: 'Erstbescheinigung', type: 'eau', xml: eauXml },
  { id: 'builtin-eau-kbv', label: 'eAU (KBV)', desc: 'KBV_PR_EAU v1.2', type: 'eau', xml: eauKbvXml },
  { id: 'builtin-mp', label: 'Mutterpass', desc: '5 Befunde', type: 'mp', xml: mutterpassXml },
]

export function App() {
  const [state, setState] = useState<ViewerState>({ status: 'idle' })
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<DocEntry[]>([])

  const params = new URLSearchParams(window.location.search)
  const showSidebar = params.get('sidebar') !== '0' && params.get('sidebar') !== 'false'

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return

    setState({ status: 'loading' })
    fetch(`${API_BASE}?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { xml?: string }) => {
        if (!data.xml) throw new Error('no_xml')
        let xml: string
        try {
          const bytes = Uint8Array.from(atob(data.xml), c => c.charCodeAt(0))
          xml = new TextDecoder().decode(bytes)
        } catch {
          throw new Error('no_xml')
        }
        parseAndShow(xml, `url-${id}`)
      })
      .catch((e: unknown) => {
        const isNotFound = e instanceof Error && (e.message === 'no_xml' || e.message.startsWith('HTTP'))
        setState({
          status: 'error',
          message: isNotFound
            ? `Kontext ${id} konnte nicht geladen werden.`
            : `Ladefehler: ${e instanceof Error ? e.message : String(e)}`,
        })
      })
    // parseAndShow ist stabil (useCallback ohne deps-Änderungen) — einmalig beim Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parseAndShow = useCallback((xml: string, id: string) => {
    try {
      const result = parseMioBundle(xml)
      setState({ status: 'parsed', result })
      setActiveDocId(id)
    } catch (e) {
      console.error(e)
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      setActiveDocId(null)
    }
  }, [])

  const handleSelect = useCallback((doc: DocEntry) => {
    parseAndShow(doc.xml, doc.id)
  }, [parseAndShow])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const xml = e.target?.result as string
      const id = `upload-${Date.now()}`
      let docType: DocEntry['type'] = 'vacc'
      try {
        const r = parseMioBundle(xml)
        if (r.type === 'eau') docType = 'eau'
        else if (r.type === 'mutterpass') docType = 'mp'
      } catch { /* use default */ }
      const doc: DocEntry = {
        id,
        label: file.name.replace(/\.xml$/i, ''),
        desc: 'Hochgeladen',
        type: docType,
        xml,
      }
      setUploadedDocs(prev => [...prev, doc])
      parseAndShow(xml, id)
    }
    reader.readAsText(file, 'utf-8')
  }, [parseAndShow])

  const allDocs = [...BUILT_IN_DOCS, ...uploadedDocs]

  return (
    <div className={`app-shell${showSidebar ? '' : ' app-shell--no-sidebar'}`}>
      <header className="app-header">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 500 }}>
          Data-AL MIO Viewer
        </span>
        <span style={{ fontSize: 12, color: '#aaa' }}>
          Elektronische Patientenakte — Read-Only
        </span>
      </header>
      {showSidebar && (
        <Sidebar
          documents={allDocs}
          activeId={activeDocId}
          onSelect={handleSelect}
          onFile={handleFile}
        />
      )}
      <main className="main-content">
        <ViewerContent state={state} />
      </main>
    </div>
  )
}

function ViewerContent({ state }: { state: ViewerState }) {
  if (state.status === 'idle') {
    return (
      <div className="empty-state">
        <span>Kein Dokument geladen</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>
          Wähle ein Dokument aus der Seitenleiste
        </span>
      </div>
    )
  }
  if (state.status === 'loading') {
    return (
      <div className="empty-state">
        <span>Dokument wird geladen…</span>
      </div>
    )
  }
  if (state.status === 'error') {
    return <div className="error-box" style={{ margin: 24 }}>{state.message}</div>
  }

  const { result } = state
  switch (result.type) {
    case 'vaccination': return <VaccinationViewer data={result.data} />
    case 'eau': return <EauViewer data={result.data} />
    case 'mutterpass': return <MutterpassViewer data={result.data} />
    case 'unknown':
      return (
        <div className="error-box" style={{ margin: 24 }}>
          Unbekanntes MIO-Profil<br />
          <span style={{ opacity: 0.7 }}>{result.profileUrl}</span>
        </div>
      )
  }
}
