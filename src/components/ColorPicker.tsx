import { useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_ANNOTATION_COLOR } from '../state/editorStore'
import './LineColorPicker.css'

const swatches = [
  ['Оранжевый', DEFAULT_ANNOTATION_COLOR], ['Красный', '#dc3545'], ['Жёлтый', '#ffc438'], ['Зелёный', '#208b61'],
  ['Синий', '#2563eb'], ['Фиолетовый', '#8357ce'], ['Чёрный', '#15171c'], ['Белый', '#ffffff'],
]
const hexPattern = /^#[0-9a-f]{6}$/i
type HSV = { h: number; s: number; v: number }

function fromHex(hex: string): HSV {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const v = Math.max(r, g, b)
  const d = v - Math.min(r, g, b)
  const h = !d ? 0 : v === r ? (g - b) / d : v === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: v ? d / v : 0, v }
}

function toHex({ h, s, v }: HSV) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16).padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

export function ColorPicker({ label, color, onApply, onReset }: {
  label: string; color: string; onApply: (color: string) => void; onReset?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [hsv, setHsv] = useState(() => fromHex(color))
  const [hex, setHex] = useState(color)
  const normalized = `#${hex.trim().replace(/^#/, '')}`.toLowerCase()
  const valid = hexPattern.test(normalized)

  const chooseHex = (value: string) => {
    setHex(value)
    const candidate = `#${value.trim().replace(/^#/, '')}`
    if (hexPattern.test(candidate)) setHsv(fromHex(candidate))
  }
  const chooseHsv = (next: HSV) => {
    setHsv(next)
    setHex(toHex(next))
  }
  const pointColor = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const clamp = (n: number) => Math.max(0, Math.min(1, n))
    chooseHsv({ ...hsv, s: clamp((event.clientX - bounds.left) / bounds.width), v: 1 - clamp((event.clientY - bounds.top) / bounds.height) })
  }

  return (
    <>
      <button type="button" className="line-color-trigger" aria-haspopup="dialog" title={label} onClick={() => {
        chooseHex(color)
        dialog.current?.showModal()
      }}>
        <span className="line-color-sample" style={{ background: color }} />
        {label}
      </button>
      {createPortal(<dialog ref={dialog} className="line-color-dialog" aria-labelledby={titleId}
        onCancel={event => event.stopPropagation()}>
        <form onSubmit={event => {
          event.preventDefault()
          event.stopPropagation()
          if (!valid) return
          onApply(normalized)
          dialog.current?.close()
        }}>
          <h2 id={titleId}>{label}</h2>
          <div className="line-color-plane" aria-hidden="true" style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId)
              pointColor(event)
            }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pointColor(event) }}>
            <span style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
          </div>
          <input className="line-color-hue" type="range" min={0} max={359} value={Math.floor(hsv.h)}
            aria-label="Оттенок" onChange={event => chooseHsv({ ...hsv, h: Number(event.target.value) })} />
          <div className="line-color-swatches" role="group" aria-label="Готовые цвета">
            {swatches.map(([label, value]) => (
              <button key={value} type="button" title={label} aria-label={label} aria-pressed={valid && normalized === value}
                style={{ backgroundColor: value }} onClick={() => chooseHex(value)} />
            ))}
          </div>
          <div className="line-color-value">
            <span className="line-color-sample" style={{ background: valid ? normalized : toHex(hsv) }} />
            <label>HEX <input value={hex} onChange={event => chooseHex(event.target.value)} aria-invalid={!valid}
              maxLength={7} autoComplete="off" spellCheck={false} /></label>
          </div>
          <div className="line-color-actions">
            {onReset && <button type="button" onClick={() => { onReset(); dialog.current?.close() }}>Авто</button>}
            <button type="button" onClick={() => dialog.current?.close()}>Отмена</button>
            <button type="submit" disabled={!valid}>Применить</button>
          </div>
        </form>
      </dialog>, document.body)}
    </>
  )
}
