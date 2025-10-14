import { memo, useState, useEffect } from 'react'
import type { Tool } from '../state/editorStore'
import { useEditorStore } from '../state/editorStore'
import { IconSelect } from './icons/IconSelect'
import { IconArrow } from './icons/IconArrow'
import { IconRect } from './icons/IconRect'
import { IconMosaic } from './icons/IconMosaic'

interface ToolbarProps {
  onUpload?: () => void
}

export const Toolbar = memo(({ onUpload }: ToolbarProps) => {
  const tool = useEditorStore(s => s.tool)
  const setTool = useEditorStore(s => s.setTool)
  const strokeColor = useEditorStore(s => s.strokeColor)
  const setStrokeColor = useEditorStore(s => s.setStrokeColor)
  const strokeWidth = useEditorStore(s => s.strokeWidth)
  const setStrokeWidth = useEditorStore(s => s.setStrokeWidth)
  const mosaicBlockSize = useEditorStore(s => s.mosaicBlockSize)
  const setMosaicBlockSize = useEditorStore(s => s.setMosaicBlockSize)
  const safarize = useEditorStore(s => s.safarize)
  const setSafarize = useEditorStore(s => s.setSafarize)

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

  const tools: Array<{ key: Tool; title: string; render: () => any }> = [
    { key: 'select', title: 'Выбор', render: () => <IconSelect /> },
    { key: 'rect', title: 'Рамка', render: () => <IconRect /> },
    { key: 'arrow', title: 'Стрелка', render: () => <IconArrow /> },
    { key: 'mosaic', title: 'Мозаика', render: () => <IconMosaic /> },
  ]

  return (
    <div style={{
      display: 'flex',
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
      {tools.map(t => (
        <button
          key={t.key}
          onClick={() => setTool(t.key)}
          title={t.title}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 32,
            borderRadius: 10,
            border: tool === t.key ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
            background: tool === t.key ? '#2563eb' : 'transparent',
            color: tool === t.key ? '#fff' : undefined,
            cursor: 'pointer',
            boxShadow: tool === t.key ? '0 0 0 2px rgba(37,99,235,0.25)' : 'none'
          }}
        >{t.render()}</button>
      ))}
      <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 8px' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Цвет линии">
        <span style={{ fontSize: 12, opacity: 0.8 }}>Цвет</span>
        <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Толщина линии">
        <span style={{ fontSize: 12, opacity: 0.8 }}>Толщина</span>
        <input type="range" min={1} max={12} value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Размер мозаики">
        <span style={{ fontSize: 12, opacity: 0.8 }}>Мозаика</span>
        <input type="range" min={4} max={48} value={mosaicBlockSize} onChange={e => setMosaicBlockSize(Number(e.target.value))} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Сафаризатор (рамка Safari)">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.8 }}>
          <span>Сафаризатор</span>
          <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#2563eb', border: '1px solid rgba(37,99,235,0.35)', padding: '1px 6px', borderRadius: 999, background: 'rgba(37,99,235,0.10)' }}>Beta</span>
        </span>
        <input type="checkbox" checked={safarize} onChange={e => setSafarize(e.target.checked)} />
      </label>
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
              <li><b>S</b> — Выбор (Select)</li>
              <li><b>A</b> — Стрелка</li>
              <li><b>R</b> — Рамка</li>
              <li><b>M</b> — Мозаика</li>
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