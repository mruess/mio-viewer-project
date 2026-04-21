import { useState, useCallback } from 'react'
import { parseMioBundle, MioParseError, type MioParseResult } from '@mio/parser'

type ParseState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'success'; result: MioParseResult }
  | { status: 'error'; message: string; detail?: string }

/**
 * Hook that wraps parseMioBundle with React state management.
 *
 * Usage:
 *   const { state, parseXml, parseFile, reset } = useMioParser()
 */
export function useMioParser() {
  const [state, setState] = useState<ParseState>({ status: 'idle' })

  const parseXml = useCallback((xml: string) => {
    setState({ status: 'parsing' })
    // Run in a microtask so "parsing" state actually renders
    queueMicrotask(() => {
      try {
        const result = parseMioBundle(xml)
        setState({ status: 'success', result })
      } catch (e) {
        const message = e instanceof MioParseError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Unbekannter Fehler beim Parsen'
        setState({ status: 'error', message })
      }
    })
  }, [])

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const xml = e.target?.result
      if (typeof xml === 'string') parseXml(xml)
    }
    reader.onerror = () => {
      setState({ status: 'error', message: `Datei konnte nicht gelesen werden: ${file.name}` })
    }
    reader.readAsText(file, 'utf-8')
  }, [parseXml])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, parseXml, parseFile, reset }
}
