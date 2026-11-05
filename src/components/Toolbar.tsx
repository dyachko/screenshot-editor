import { memo, useState, useEffect, useRef, type ReactNode } from 'react'
import type { Tool } from '../state/editorStore'
import { DEFAULT_ANNOTATION_COLOR, LEGACY_MARKER_COLOR, getSceneCrop, useEditorStore } from '../state/editorStore'
import { toolCommands } from '../state/toolCommands'
import { IconSelect } from './icons/IconSelect'
import { IconArrow } from './icons/IconArrow'
import { IconRect } from './icons/IconRect'
import { IconMosaic } from './icons/IconMosaic'
import { ColorPicker } from './ColorPicker'
import { automaticMarkerNumberColor } from '../services/annotations'

interface ToolbarProps {
  onUpload?: () => void
}

const markerColors = [
  { label: 'Оранжевый', value: DEFAULT_ANNOTATION_COLOR },
  { label: 'Синий', value: LEGACY_MARKER_COLOR },
  { label: 'Красный', value: '#b72e3e' },
  { label: 'Тёмно-оранжевый', value: '#a94514' },
  { label: 'Зелёный', value: '#176f4b' },
  { label: 'Фиолетовый', value: '#6940a8' },
  { label: 'Графитовый', value: '#30343b' },
]

function StyleInput({ value, onCommit, ...props }: {
  type: 'range'
  value: number
  min?: number
  max?: number
  onCommit: (value: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.value = String(value)
  }, [value])
  useEffect(() => {
    const input = ref.current
    if (!input) return
    // Native change commits once when the slider is released.
    const commit = () => onCommit(input.value)
    input.addEventListener('change', commit)
    return () => input.removeEventListener('change', commit)
  }, [onCommit])
  return <input {...props} ref={ref} defaultValue={value} />
}

export const Toolbar = memo(({ onUpload }: ToolbarProps) => {
  const tool = useEditorStore(s => s.tool)
  const setTool = useEditorStore(s => s.setTool)
  const strokeColor = useEditorStore(s => s.strokeColor)
  const setStrokeColor = useEditorStore(s => s.setStrokeColor)
  const markerColor = useEditorStore(s => s.markerColor)
  const setMarkerColor = useEditorStore(s => s.setMarkerColor)
  const markerNumberColor = useEditorStore(s => s.markerNumberColor)
  const setMarkerNumberColor = useEditorStore(s => s.setMarkerNumberColor)
  const selected = useEditorStore(s => s.tool === 'select' ? s.objects.find(o => o.id === s.selectedId) : undefined)
  const selectedMarker = selected?.type === 'marker' ? selected : null
  const markerFill = selectedMarker ? selectedMarker.color ?? LEGACY_MARKER_COLOR : markerColor
  const numberColor = selectedMarker ? selectedMarker.numberColor : markerNumberColor
  const selectedStroke = selected?.type === 'arrow' || selected?.type === 'rect' ? selected : null
  const selectedMosaic = selected?.type === 'mosaic' ? selected : null
  const setObjectStyle = useEditorStore(s => s.setObjectStyle)
  const strokeWidth = useEditorStore(s => s.strokeWidth)
  const setStrokeWidth = useEditorStore(s => s.setStrokeWidth)
  const mosaicBlockSize = useEditorStore(s => s.mosaicBlockSize)
  const setMosaicBlockSize = useEditorStore(s => s.setMosaicBlockSize)
  const safarize = useEditorStore(s => s.safarize)
  const setSafarize = useEditorStore(s => s.setSafarize)
  const safariShadow = useEditorStore(s => s.safariShadow)
  const setSafariShadow = useEditorStore(s => s.setSafariShadow)
  const hasScene = useEditorStore(s => s.activeSceneId !== null)
  const hasCrop = useEditorStore(s => !!getSceneCrop(s.history, s.historyIndex))
  const setCrop = useEditorStore(s => s.setCrop)
  const safariAddress = useEditorStore(s => s.getActiveScene()?.snapshot.safariAddress ?? '')
  const setSafariAddress = useEditorStore(s => s.setSafariAddress)

  const [showTips, setShowTips] = useState(false)
  useEffect(() => {
    if (!showTips) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTips(false) }
    const onClick = (e: MouseEvent) => {
      const box = document.getElementById('toolbar-shortcuts-tip')
      if (box && !box.contains(e.target as Node)) setShowTips(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [showTips])

  const icons: Record<Tool, ReactNode> = {
    select: <IconSelect />,
    rect: <IconRect />,
    arrow: <IconArrow />,
    mosaic: <IconMosaic />,
    crop: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"/></svg>,
    marker: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 10 2-2v8m-2 0h4"/></svg>,
    text: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 6h14M12 6v13m-4 0h8"/></svg>,
    spotlight: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fillOpacity=".2"/><rect x="7" y="8" width="10" height="8" rx="1"/></svg>,
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(128,128,128,0.2)',
      position: 'relative',
      zIndex: 30,
    }}>
      <button
        onClick={onUpload}
        title="Загрузить"
        style={{
          padding: '10px 14px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)'
        }}
      >Загрузить</button>
      <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 8px' }} />
      {toolCommands.map(t => (
        <button
          key={t.tool}
          onClick={() => setTool(t.tool === tool ? 'select' : t.tool)}
          title={`${t.label} (${t.key})`}
          aria-label={t.label}
          aria-keyshortcuts={t.key}
          aria-pressed={tool === t.tool}
          disabled={!hasScene}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 32,
            borderRadius: 10,
            border: tool === t.tool ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
            background: tool === t.tool ? '#2563eb' : 'transparent',
            color: tool === t.tool ? '#fff' : undefined,
            cursor: 'pointer',
            boxShadow: tool === t.tool ? '0 0 0 2px rgba(37,99,235,0.25)' : 'none'
          }}
        >{icons[t.tool]}</button>
      ))}
      {hasCrop && tool !== 'crop' && <button type="button" title="Сбросить кадрирование" aria-label="Сбросить кадрирование"
        onClick={() => setCrop(null)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 32, borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 2.6 6.4M3 6v6h6"/></svg>
      </button>}
      {(tool === 'marker' || (tool === 'select' && selectedMarker)) && (
        <div role="group" aria-label="Стиль метки" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          {markerColors.map(({ label, value }) => {
            const active = markerFill === value
            return <button key={value} type="button" title={label} aria-label={label} aria-pressed={active}
              onClick={() => setMarkerColor(value)}
              style={{
                boxSizing: 'border-box', width: 24, height: 24, padding: 0, borderRadius: '50%', cursor: 'pointer',
                background: value, border: active ? '2px solid #fff' : '1px solid rgba(160,160,160,0.55)',
              }} />
          })}
          <ColorPicker key={selectedMarker?.id ?? 'marker-number'} label="Цвет цифры"
            color={numberColor ?? automaticMarkerNumberColor(markerFill)} onApply={setMarkerNumberColor}
            onReset={numberColor ? () => setMarkerNumberColor() : undefined} />
        </div>
      )}
      {hasScene && (tool === 'arrow' || tool === 'rect' || selectedStroke) && (
        <div role="group" aria-label="Стиль линии" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ColorPicker key={selectedStroke?.id ?? tool} label="Цвет линии" color={selectedStroke?.color ?? strokeColor}
            onApply={color => selectedStroke ? setObjectStyle(selectedStroke.id, { color }) : setStrokeColor(color)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Толщина линии">
            <span style={{ fontSize: 12, opacity: 0.8 }}>Толщина</span>
            <StyleInput key={selectedStroke?.id ?? 'width'} type="range" min={1} max={12} value={selectedStroke?.strokeWidth ?? strokeWidth}
              onCommit={value => selectedStroke ? setObjectStyle(selectedStroke.id, { strokeWidth: Number(value) }) : setStrokeWidth(Number(value))} />
          </label>
        </div>
      )}
      {hasScene && (tool === 'mosaic' || selectedMosaic) && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Размер мозаики">
          <span style={{ fontSize: 12, opacity: 0.8 }}>Мозаика</span>
          <StyleInput key={selectedMosaic?.id ?? 'mosaic'} type="range" min={4} max={48} value={selectedMosaic?.blockSize ?? mosaicBlockSize}
            onCommit={value => selectedMosaic ? setObjectStyle(selectedMosaic.id, { blockSize: Number(value) }) : setMosaicBlockSize(Number(value))} />
        </label>
      )}
      <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 8px' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Сафаризатор (рамка Safari)">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.8 }}>
          <span>Сафаризатор</span>
          <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#2563eb', border: '1px solid rgba(37,99,235,0.35)', padding: '1px 6px', borderRadius: 999, background: 'rgba(37,99,235,0.10)' }}>Beta</span>
        </span>
        <input type="checkbox" checked={safarize} onChange={e => setSafarize(e.target.checked)} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: safarize ? 1 : 0.45 }} title="Тень окна Safari">
        <span style={{ fontSize: 12, opacity: 0.8 }}>Тень</span>
        <input type="checkbox" checked={safariShadow} disabled={!safarize} onChange={e => setSafariShadow(e.target.checked)} />
      </label>
      {safarize && hasScene && (
        <input aria-label="Адрес Safari" title="Адрес Safari" placeholder="Адрес Safari" maxLength={256}
          value={safariAddress} onChange={e => setSafariAddress(e.target.value)}
          style={{ width: 140, maxWidth: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit' }} />
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <span style={{ opacity: 0.7, fontSize: 12 }}>Вставьте скриншот: ⌘/Ctrl+V</span>
        <button
          onClick={() => setShowTips(s => !s)}
          title="Горячие клавиши"
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
        >?
        </button>
        {showTips && (
          <div id="toolbar-shortcuts-tip" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', padding: '10px 12px', background: 'rgba(20,20,20,0.95)', color: '#ddd', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', width: 280, zIndex: 999 }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>Горячие клавиши</div>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
              {toolCommands.map(command => <li key={command.tool}><b>{command.key}</b> — {command.label}</li>)}
              <li><b>Enter</b> — Изменить выделенный текст</li>
              <li><b>Enter</b> — Применить кадрирование</li>
              <li><b>Esc</b> — Вернуться к выбору</li>
              <li><b>⌘/Ctrl+Z</b> — Отменить</li>
              <li><b>⌘/Ctrl+Shift+Z</b> или <b>Ctrl+Y</b> — Повторить</li>
              <li><b>Delete/Backspace</b> — Удалить выбранный</li>
            </ul>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>Подсказка: клик по элементу — выделение; повторный клик и перетаскивание — перемещение.</div>
          </div>
        )}
      </div>
    </div>
  )
})
