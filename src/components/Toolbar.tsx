import { memo } from 'react'
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
      borderBottom: '1px solid rgba(128,128,128,0.2)'
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
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ opacity: 0.7, fontSize: 12 }}>Вставьте скриншот: ⌘/Ctrl+V</span>
      </div>
    </div>
  )
}) 