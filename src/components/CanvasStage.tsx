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

  const pickObjectAt = (pImg: { x: number; y: number }) => {
    // hit-test: check arrows (distance to curve endpoints), rects (bounds), mosaic (bounds), last-on-top
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]
      if (o.type === 'arrow') {
        // simple: near line segment start-end or near control
        const d = (ax:number, ay:number, bx:number, by:number, px:number, py:number) => {
          const A = px - ax, B = py - ay, C = bx - ax, D = by - ay
          const dot = A*C + B*D
          const len_sq = C*C + D*D || 1
          let t = dot / len_sq
          t = Math.max(0, Math.min(1, t))
          const xx = ax + C*t, yy = ay + D*t
          return Math.hypot(px-xx, py-yy)
        }
        const near = d(o.start.x, o.start.y, o.end.x, o.end.y, pImg.x, pImg.y) < 8 || Math.hypot(pImg.x - o.control.x, pImg.y - o.control.y) < 8
        if (near) return o
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
      if (kind === 'down') {
        const target = e.target
        const isBackground = target === stage || target.getClassName?.() === 'Image'
        if (isBackground) {
          // try picking an object under cursor
          const o = pickObjectAt(p)
          if (o) {
            selectObject(o.id)
            if (o.type === 'arrow') beginArrowEdit(o.id)
          } else {
            selectObject(null)
            exitArrowEdit()
          }
        }
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
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Вставьте скриншот (⌘/Ctrl+V)</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>или перетащите файл/нажмите «Загрузить»</div>
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
              const c = layout.stageFromImage(obj.control)
              const e = layout.stageFromImage(obj.end)
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
                        draggable onDragStart={handleDown} onDragMove={handleDrag('start')} onDragEnd={handleUp} onPointerDown={handleDown} />
                      <KCircle key={obj.id+'-hc'} x={c.x} y={c.y} radius={6} fill="#F99761" stroke="white" strokeWidth={2}
                        draggable onDragStart={handleDown} onDragMove={handleDrag('control')} onDragEnd={handleUp} onPointerDown={handleDown} />
                      <KCircle key={obj.id+'-he'} x={e.x} y={e.y} radius={6} fill="#F99761" stroke="white" strokeWidth={2}
                        draggable onDragStart={handleDown} onDragMove={handleDrag('end')} onDragEnd={handleUp} onPointerDown={handleDown} />
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
              const r = 6
              return (
                <>
                  <KRect x={tl.x} y={tl.y} width={obj.width * layout.scale} height={obj.height * layout.scale} stroke="#F99761" strokeWidth={1} dash={[6,4]} listening={false} />
                  <KCircle x={tl.x} y={tl.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'tl')} />
                  <KCircle x={tr.x} y={tr.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'tr')} />
                  <KCircle x={bl.x} y={bl.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'bl')} />
                  <KCircle x={br.x} y={br.y} radius={r} fill="#F99761" stroke="white" strokeWidth={2} draggable onDragMove={handleDragRectCorner(obj, 'br')} />
                </>
              )
            })}
          </Layer>
        </Stage>
      )}
    </div>
  )
} 