import { useState, useCallback, useRef, type DragEvent } from 'react'

interface UseDropzoneOptions {
  onFile: (file: File) => void
  accept?: string // e.g. '.xml'
}

/**
 * Returns props to spread onto a label/div to make it a drag-drop zone.
 *
 * Usage:
 *   const { dropzoneProps, isDragging } = useDropzone({ onFile: handleFile })
 *   <label {...dropzoneProps} className={isDragging ? 'dragging' : ''}>
 *     <input {...dropzoneProps.inputProps} />
 *   </label>
 */
export function useDropzone({ onFile, accept = '.xml' }: UseDropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }, [onFile])

  return {
    isDragging,
    dropzoneProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
    inputProps: {
      type: 'file' as const,
      accept,
      onChange: onInputChange,
      style: { display: 'none' as const },
    },
  }
}
