import { useEffect, useId, useRef, useState } from 'react'
import { DEFAULT_ANNOTATION_COLOR, type TextStyle } from '../state/editorStore'
import { ColorPicker } from './ColorPicker'
import './EditorOverlays.css'

export function TextLabelDialog({ initial, onSave, onClose }: {
  initial?: TextStyle
  onSave: (style: TextStyle) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [text, setText] = useState(initial?.text ?? '')
  const [fontSize, setFontSize] = useState(initial?.fontSize ?? 24)
  const [background, setBackground] = useState(initial?.background ?? false)
  const [color, setColor] = useState(initial ? initial.color ?? '#ffffff' : DEFAULT_ANNOTATION_COLOR)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog ref={ref} className="editor-text-dialog" aria-labelledby={title}
      onCancel={event => { event.preventDefault(); onClose() }}>
      <form onSubmit={event => {
        event.preventDefault()
        if (!text.trim() || !Number.isFinite(fontSize) || fontSize < 12 || fontSize > 96) return
        onSave({ text, fontSize, background, color })
      }}>
        <h2 id={title}>{initial ? 'Изменить текст' : 'Добавить текст'}</h2>
        <label>Текст
          <textarea autoFocus rows={3} maxLength={500} value={text} style={{ color }}
            onChange={event => setText(event.target.value)} />
        </label>
        <div className="editor-text-settings">
          <label>Размер <input type="number" min={12} max={96} value={fontSize || ''} required
            onChange={event => setFontSize(Number(event.target.value))} /></label>
          <label><input type="checkbox" checked={background} onChange={event => setBackground(event.target.checked)} /> Подложка</label>
          <ColorPicker label="Цвет текста" color={color} onApply={setColor} />
        </div>
        <div className="editor-text-actions">
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="submit" disabled={!text.trim()}>{initial ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </form>
    </dialog>
  )
}
