import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle as KCircle, Rect as KRect } from 'react-konva'
import useImage from 'use-image'
import { useEditorStore } from '../state/editorStore'
import { ArrowShape } from './shapes/ArrowShape'
import { RectOutlineShape } from './shapes/RectOutlineShape'
import { MosaicShape } from './shapes/MosaicShape'

interface CanvasStageProps {
  imageUrl: string | null
}

export const CanvasStage = ({ imageUrl }: CanvasStageProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [img] = useImage(imageUrl ?? '', 'anonymous')
  const [showShortcuts, setShowShortcuts] = useState(false)

  const objects = useEditorStore(s => s.objects)
  const draft = useEditorStore(s => s.drawingDraft)
  const startDrawing = useEditorStore(s => s.startDrawing)
  const updateDrawing = useEditorStore(s => s.updateDrawing)
  const commitDrawing = useEditorStore(s => s.commitDrawing)
  const tool = useEditorStore(s => s.tool)
  const selectedId = useEditorStore(s => s.selectedId)
  const selectObject = useEditorStore(s => s.selectObject)
  const beginArrowEdit = useEditorStore(s => s.beginArrowEdit)
  const finishArrowEdit = useEditorStore(s => s.finishArrowEdit)
  const updateArrowLive = useEditorStore(s => s.updateArrowLive)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const editingArrowId = useEditorStore(s => s.editingArrowId)
  const exitArrowEdit = useEditorStore(s => s.exitArrowEdit)
  const removeSelected = useEditorStore(s => s.removeSelected)
  const updateObjectLive = useEditorStore(s => s.updateObjectLive)
  const setTool = useEditorStore(s => s.setTool)
  const logObjectChange = useEditorStore(s => s.logObjectChange)

  const setCursor = (cur: string) => { if (containerRef.current) containerRef.current.style.cursor = cur }

  // drag session for moving whole objects
  const dragRef = useRef<null | {
    id: string
    type: 'arrow' | 'rect' | 'mosaic'
    startImg: { x: number; y: number }
    origin: any
  }>(null)

  useEffect(() => {
    if (!showShortcuts) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowShortcuts(false) }
    const onClick = (e: MouseEvent) => {
      // close if clicked outside of tooltip box
      const box = document.getElementById('shortcuts-tooltip')
      if (box && !box.contains(e.target as Node)) setShowShortcuts(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [showShortcuts])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect
      setSize({ width: cr.width, height: cr.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e: DragEvent) => { e.preventDefault() }
    el.addEventListener('dragover', prevent)
    el.addEventListener('drop', prevent)
    return () => {
      el.removeEventListener('dragover', prevent)
      el.removeEventListener('drop', prevent)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditable = !!(target && ((tag === 'input') || (tag === 'textarea') || (tag === 'select') || (target as any).isContentEditable))

      // Undo/Redo
      if (mod && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (!isMac && mod && e.code === 'KeyY') {
        e.preventDefault()
        redo()
        return
      }

      // Delete
      if (!isEditable && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        removeSelected()
        return
      }

      // Tool shortcuts (layout-independent)
      if (!mod && !e.shiftKey && !e.altKey && !isEditable) {
        if (e.code === 'KeyS') { setTool('select') }
        if (e.code === 'KeyA') { setTool('arrow') }
        if (e.code === 'KeyR') { setTool('rect') }
        if (e.code === 'KeyM') { setTool('mosaic') }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, removeSelected, setTool])

  const layout = useMemo(() => {
    if (!img || size.width === 0 || size.height === 0) return null as null | {
      scale: number; offsetX: number; offsetY: number; stageFromImage: (p: {x:number;y:number})=>{x:number;y:number}; imageFromStage: (p:{x:number;y:number})=>{x:number;y:number}
    }
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = Math.min(size.width / iw, size.height / ih)
    const offsetX = (size.width - iw * scale) / 2
    const offsetY = (size.height - ih * scale) / 2
    const stageFromImage = (p: { x: number; y: number }) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })
    const imageFromStage = (p: { x: number; y: number }) => ({ x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale })
    return { scale, offsetX, offsetY, stageFromImage, imageFromStage }
  }, [img, size.width, size.height])

  // distance from point to segment
  const distToSeg = (ax:number, ay:number, bx:number, by:number, px:number, py:number) => {
    const A = px - ax, B = py - ay, C = bx - ax, D = by - ay
    const len_sq = C*C + D*D || 1
    let t = (A*C + B*D) / len_sq
    t = Math.max(0, Math.min(1, t))
    const xx = ax + C*t, yy = ay + D*t
    return Math.hypot(px-xx, py-yy)
  }

  // distance from point to quadratic Bezier (sampled polyline)
  const distToQuad = (start:{x:number;y:number}, control:{x:number;y:number}, end:{x:number;y:number}, p:{x:number;y:number}) => {
    const segments = 28
    let min = Infinity
    let prev = start
    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x
      const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y
      const d = distToSeg(prev.x, prev.y, x, y, p.x, p.y)
      if (d < min) min = d
      prev = { x, y }
    }
    return min
  }

  const pickObjectAt = (pImg: { x: number; y: number }) => {
    // hit-test: check arrows (distance to curve), rects/mosaic by bounds, last-on-top
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]
      if (o.type === 'arrow') {
        const nearCurve = distToQuad(o.start, o.control, o.end, pImg) < 8
        if (nearCurve) return o
      } else {
        const within = pImg.x >= (o as any).x && pImg.x <= (o as any).x + (o as any).width && pImg.y >= (o as any).y && pImg.y <= (o as any).y + (o as any).height
        if (within) return o
      }
    }
    return null
  }

  const handlePointer = (e: any, kind: 'down' | 'move' | 'up') => {
    if (!img || !layout) return
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return
    const p = layout.imageFromStage(pos)

    if (tool === 'select') {
      // active dragging session
      if (dragRef.current && kind === 'move') {
        const { id, type, startImg, origin } = dragRef.current
        const dx = p.x - startImg.x
        const dy = p.y - startImg.y
        if (type === 'rect' || type === 'mosaic') {
          updateObjectLive(id, { x: origin.x + dx, y: origin.y + dy })
        } else if (type === 'arrow') {
          updateObjectLive(id, {
            start: { x: origin.start.x + dx, y: origin.start.y + dy },
            end: { x: origin.end.x + dx, y: origin.end.y + dy },
            control: { x: origin.control.x + dx, y: origin.control.y + dy },
          } as any)
        }
        setCursor('move')
        return
      }
      if (dragRef.current && kind === 'up') {
        const { id } = dragRef.current
        dragRef.current = null
        setCursor('default')
        // log change for per-object history
        logObjectChange(id, 'Изменено')
        return
      }

      if (kind === 'down') {
        const target = e.target
        const isHandle = target.getClassName?.() === 'Circle'
        const hit = pickObjectAt(p)
        if (hit) {
          // select if needed
          if (selectedId !== hit.id) {
            selectObject(hit.id)
            if (hit.type === 'arrow') beginArrowEdit(hit.id)
          } else if (!isHandle) {
            // start drag for whole object
            setCursor('move')
            const origin = hit.type === 'arrow' ? { start: { ...(hit as any).start }, end: { ...(hit as any).end }, control: { ...(hit as any).control } } : { x: (hit as any).x, y: (hit as any).y }
            dragRef.current = { id: hit.id, type: hit.type as any, startImg: p, origin }
          }
        } else {
          // click on empty space → deselect
          selectObject(null)
          exitArrowEdit()
          setCursor('default')
        }
        return
      }

      // hover cursor feedback (skip if over handle)
      if (kind === 'move') {
        const target = e.target
        const isHandle = target.getClassName?.() === 'Circle'
        if (isHandle) return
        const hit = selectedId ? objects.find(o => o.id === selectedId) : null
        if (!hit) return
        const over = !!pickObjectAt(p)
        setCursor(over ? 'move' : 'default')
      }
      return
    }

    if (kind === 'down') startDrawing(p)
    else if (kind === 'move') updateDrawing(p)
    else commitDrawing()
  }

  const constrainControlToMidPerpendicular = (start: {x:number;y:number}, end: {x:number;y:number}, point: {x:number;y:number}) => {
    const mx = (start.x + end.x) / 2
    const my = (start.y + end.y) / 2
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const k = (point.x - mx) * nx + (point.y - my) * ny
    return { x: mx + nx * k, y: my + ny * k }
  }

  const handleDragRectCorner = (obj: any, corner: 'tl'|'tr'|'bl'|'br') => (evt: any) => {
    const pos = evt.target.getStage().getPointerPosition()
    if (!pos || !layout) return
    const p = layout.imageFromStage(pos)
    let { x, y, width, height } = obj
    if (corner === 'tl') { width = (x + width) - p.x; height = (y + height) - p.y; x = p.x; y = p.y }
    if (corner === 'tr') { width = p.x - x; height = (y + height) - p.y; y = p.y }
    if (corner === 'bl') { width = (x + width) - p.x; x = p.x; height = p.y - y }
    if (corner === 'br') { width = p.x - x; height = p.y - y }
    width = Math.max(1, width); height = Math.max(1, height)
    updateObjectLive(obj.id, { x, y, width, height })
  }


  return (
    <div ref={containerRef} id="canvas-root" style={{ width: '100%', height: '100%', background: '#111', color: '#999', position: 'relative' }}>
      {!imageUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              Вставьте скриншот (⌘/Ctrl+V)
              <button
                onClick={() => setShowShortcuts(s => !s)}
                style={{ marginLeft: 12, background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}
                title="Показать горячие клавиши"
              >Шоткаты</button>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>или перетащите файл/нажмите «Загрузить»</div>
            {showShortcuts && (
              <div id="shortcuts-tooltip" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 10, padding: '10px 12px', background: 'rgba(20,20,20,0.95)', color: '#ddd', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', width: 280, textAlign: 'left', zIndex: 10 }}>
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
      )}
      {size.width > 0 && size.height > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          onPointerDown={(e) => handlePointer(e, 'down')}
          onPointerMove={(e) => handlePointer(e, 'move')}
          onPointerUp={(e) => handlePointer(e, 'up')}
        >
          <Layer>
            {img && layout && (
              <KonvaImage image={img} x={layout.offsetX} y={layout.offsetY} width={img.naturalWidth * layout.scale} height={img.naturalHeight * layout.scale} />
            )}
            {img && layout && objects.map((obj) => {
              if (obj.type === 'arrow') return (
                <ArrowShape key={obj.id} start={obj.start} control={obj.control} end={obj.end} color={obj.color} strokeWidth={obj.strokeWidth} stageFromImage={layout.stageFromImage} />
              )
              if (obj.type === 'rect') return (
                <RectOutlineShape key={obj.id} x={obj.x} y={obj.y} width={obj.width} height={obj.height} color={obj.color} strokeWidth={obj.strokeWidth} stageFromImage={layout.stageFromImage} scale={layout.scale} />
              )
              return (
                <MosaicShape key={obj.id}
                  x={obj.x} y={obj.y} width={obj.width} height={obj.height}
                  blockSize={obj.blockSize}
                  img={img}
                  offsetX={layout.offsetX}
                  offsetY={layout.offsetY}
                  scale={layout.scale}
                  stageFromImage={layout.stageFromImage}
                />
              )
            })}
            {img && layout && draft && (
              draft.type === 'arrow' ? (
                <ArrowShape start={draft.start} control={{ x: (draft.start.x + draft.current.x)/2, y: (draft.start.y + draft.current.y)/2 }} end={draft.current} color={useEditorStore.getState().strokeColor} strokeWidth={useEditorStore.getState().strokeWidth} stageFromImage={layout.stageFromImage} />
              ) : draft.type === 'rect' ? (
                <RectOutlineShape x={Math.min(draft.start.x, draft.current.x)} y={Math.min(draft.start.y, draft.current.y)} width={Math.abs(draft.current.x - draft.start.x)} height={Math.abs(draft.current.y - draft.start.y)} color={useEditorStore.getState().strokeColor} strokeWidth={useEditorStore.getState().strokeWidth} stageFromImage={layout.stageFromImage} scale={layout.scale} />
              ) : (
                (() => {
                  const x = Math.min(draft.start.x, draft.current.x)
                  const y = Math.min(draft.start.y, draft.current.y)
                  const w = Math.abs(draft.current.x - draft.start.x)
                  const h = Math.abs(draft.current.y - draft.start.y)
                  const tl = layout.stageFromImage({ x, y })
                  return (
                    <KRect x={tl.x} y={tl.y} width={w * layout.scale} height={h * layout.scale}
                      stroke="#F99761" strokeWidth={1.5} dash={[6,4]} fill="rgba(249,151,97,0.12)" />
                  )
                })()
              )
            )}
            {img && layout && objects.map(obj => {
              if (obj.type !== 'arrow') return null
              const s = layout.stageFromImage(obj.start)
              const e = layout.stageFromImage(obj.end)
              const m = layout.stageFromImage({ x: (obj.start.x + obj.end.x)/2, y: (obj.start.y + obj.end.y)/2 })
              const handleDrag = (kind: 'start'|'control'|'end') => (evt: any) => {
                const pos = evt.target.getStage().getPointerPosition()
                if (!pos) return
                const p = layout.imageFromStage(pos)
                const latest = useEditorStore.getState().objects.find(o => o.id === obj.id && o.type === 'arrow') as typeof obj | undefined
                if (!latest) return
                if (kind === 'control') {
                  const constrained = constrainControlToMidPerpendicular(latest.start, latest.end, p)
                  updateArrowLive(obj.id, { control: constrained })
                  return
                }
                // Dragging endpoints: preserve curvature scalar along normal
                const prevS = latest.start
                const prevE = latest.end
                const prevMid = { x: (prevS.x + prevE.x) / 2, y: (prevS.y + prevE.y) / 2 }
                const pdx = prevE.x - prevS.x
                const pdy = prevE.y - prevS.y
                const plen = Math.hypot(pdx, pdy) || 1
                const pnx = -pdy / plen
                const pny = pdx / plen
                const kOld = (latest.control.x - prevMid.x) * pnx + (latest.control.y - prevMid.y) * pny
                const newS = kind === 'start' ? p : prevS
                const newE = kind === 'end' ? p : prevE
                const newMid = { x: (newS.x + newE.x) / 2, y: (newS.y + newE.y) / 2 }
                const ndx = newE.x - newS.x
                const ndy = newE.y - newS.y
                const nlen = Math.hypot(ndx, ndy) || 1
                const nnx = -ndy / nlen
                const nny = ndx / nlen
                const newControl = { x: newMid.x + nnx * kOld, y: newMid.y + nny * kOld }
                updateArrowLive(obj.id, { start: newS, end: newE, control: newControl } as any)
              }
              const handleDown = () => { selectObject(obj.id); beginArrowEdit(obj.id) }
              const handleUp = () => finishArrowEdit(obj.id)
              const isEditing = editingArrowId === obj.id || selectedId === obj.id
              return (
                <>
                  {isEditing && (
                    <>
                      <KCircle key={obj.id+'-hs'} x={s.x} y={s.y} radius={6} fill="#F99761" stroke="white" strokeWidth={2}
                        draggable onDragStart={handleDown} onDragMove={handleDrag('start')} onDragEnd={handleUp} onPointerDown={handleDown}
                        onPointerEnter={() => setCursor('pointer')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={20} />
                      <KCircle key={obj.id+'-hc'} x={m.x} y={m.y} radius={6} fill="#F99761" stroke="white" strokeWidth={2}
                        draggable onDragStart={handleDown} onDragMove={handleDrag('control')} onDragEnd={handleUp} onPointerDown={handleDown}
                        onPointerEnter={() => setCursor('pointer')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={20} />
                      <KCircle key={obj.id+'-he'} x={e.x} y={e.y} radius={6} fill="#F99761" stroke="white" strokeWidth={2}
                        draggable onDragStart={handleDown} onDragMove={handleDrag('end')} onDragEnd={handleUp} onPointerDown={handleDown}
                        onPointerEnter={() => setCursor('pointer')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={20} />
                    </>
                  )}
                </>
              )
            })}
            {img && layout && objects.map(obj => {
              if (obj.type !== 'rect' && obj.type !== 'mosaic') return null
              if (selectedId !== obj.id) return null
              const tl = layout.stageFromImage({ x: obj.x, y: obj.y })
              const tr = layout.stageFromImage({ x: obj.x + obj.width, y: obj.y })
              const bl = layout.stageFromImage({ x: obj.x, y: obj.y + obj.height })
              const br = layout.stageFromImage({ x: obj.x + obj.width, y: obj.y + obj.height })
              const r = 8
              return (
                <>
                  <KRect x={tl.x} y={tl.y} width={obj.width * layout.scale} height={obj.height * layout.scale} stroke="#F99761" strokeWidth={1} dash={[6,4]} listening={false} />
                  <KCircle x={tl.x} y={tl.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'tl')} onDragEnd={() => logObjectChange(obj.id, 'Изменено')}
                    onPointerEnter={() => setCursor('nwse-resize')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={24} />
                  <KCircle x={tr.x} y={tr.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'tr')} onDragEnd={() => logObjectChange(obj.id, 'Изменено')}
                    onPointerEnter={() => setCursor('nesw-resize')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={24} />
                  <KCircle x={bl.x} y={bl.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'bl')} onDragEnd={() => logObjectChange(obj.id, 'Изменено')}
                    onPointerEnter={() => setCursor('nesw-resize')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={24} />
                  <KCircle x={br.x} y={br.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'br')} onDragEnd={() => logObjectChange(obj.id, 'Изменено')}
                    onPointerEnter={() => setCursor('nwse-resize')} onPointerLeave={() => setCursor('default')} hitStrokeWidth={24} />
                </>
              )
            })}
          </Layer>
        </Stage>
      )}
    </div>
  )
} 