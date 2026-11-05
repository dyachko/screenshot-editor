import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Point, Tool } from '../state/editorStore'
import { toolCommands } from '../state/toolCommands'
import './EditorOverlays.css'

export function CanvasContextMenu({ point, tool, onTool, onExport, onClose }: {
  point: Point; tool: Tool; onTool: (tool: Tool) => void; onExport: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(6, Math.min(point.x, window.innerWidth - width - 6))}px`
    menu.style.top = `${Math.max(6, Math.min(point.y, window.innerHeight - height - 6))}px`
    menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [point])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose() }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  return (
    <div ref={ref} role="menu" aria-label="Действия с изображением" className="canvas-context-menu"
      onContextMenu={event => { event.preventDefault(); event.stopPropagation() }}
      onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation() }
          onClose()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const items = Array.from(event.currentTarget.querySelectorAll('button'))
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}>
      {toolCommands.map(command => (
        <button key={command.tool} type="button" role="menuitemradio" aria-checked={tool === command.tool}
          onClick={() => { onTool(command.tool); onClose() }}>
          <span>{command.label}</span><kbd>{command.key}</kbd>
        </button>
      ))}
      <div role="separator" />
      <button type="button" role="menuitem" onClick={() => { onClose(); onExport() }}>Экспорт PNG</button>
    </div>
  )
}
