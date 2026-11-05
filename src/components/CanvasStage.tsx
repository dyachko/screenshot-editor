import { drawSafariFrame, safariToolbarHeight, SAFARI_PADDING, SAFARI_RADIUS } from '../services/safariFrame'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Shape, Group, Image as KonvaImage, Circle as KCircle, Rect as KRect, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import useImage from 'use-image'
import { getSceneCrop, MARKER_RADIUS, useEditorStore, type ImageBounds, type Point, type SceneObject, type TextObject } from '../state/editorStore'
import { toolCommands } from '../state/toolCommands'
import { drawMarker, drawRedaction, drawSpotlights, drawTextLabel, loadTextLabelFont, measureTextLabel } from '../services/annotations'
import { ArrowShape } from './shapes/ArrowShape'
import { RectOutlineShape } from './shapes/RectOutlineShape'
import { MosaicShape } from './shapes/MosaicShape'
import { CanvasContextMenu } from './CanvasContextMenu'
import { TextLabelDialog } from './TextLabelDialog'
import { CropOverlay, cropHandles, type CropHandle } from './CropOverlay'

interface CanvasStageProps {
  imageUrl: string | null
  onExport: () => Promise<void>
}

export const CanvasStage = ({ imageUrl, onExport }: CanvasStageProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [img] = useImage(imageUrl ?? '', 'anonymous')
  const [menuPoint, setMenuPoint] = useState<Point | null>(null)
  const closeMenu = useCallback(() => setMenuPoint(null), [])
  const [textTarget, setTextTarget] = useState<Point | TextObject | null>(null)
  const [exportError, setExportError] = useState(false)
  const [textContext] = useState(() => document.createElement('canvas').getContext('2d'))
  const [textFontReady, setTextFontReady] = useState(false)
  useEffect(() => {
    let active = true
    void loadTextLabelFont().then(() => { if (active) setTextFontReady(true) })
    return () => { active = false }
  }, [])
  const saveText = useEditorStore(s => s.saveText)

  const objects = useEditorStore(s => s.objects)
  const orderedObjects = useMemo(() => [
    ...objects.filter(o => o.type === 'spotlight' || o.type === 'mosaic'),
    ...objects.filter(o => o.type !== 'mosaic' && o.type !== 'redact' && o.type !== 'spotlight'),
    ...objects.filter(o => o.type === 'redact'),
  ], [objects])
  const crop = useEditorStore(s => getSceneCrop(s.history, s.historyIndex))
  const cropDraft = useEditorStore(s => s.cropDraft)
  const setCropDraft = useEditorStore(s => s.setCropDraft)
  const applyCropDraft = useEditorStore(s => s.applyCropDraft)
  const cropDrag = useRef<{ handle: CropHandle; start: Point; bounds: ImageBounds; pointerId: number } | null>(null)
  const safariAddress = useEditorStore(s => s.getActiveScene()?.snapshot.safariAddress)
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
  const exitArrowEdit = useEditorStore(s => s.exitArrowEdit)
  const removeSelected = useEditorStore(s => s.removeSelected)
  const updateObjectLive = useEditorStore(s => s.updateObjectLive)
  const setTool = useEditorStore(s => s.setTool)
  const logObjectChange = useEditorStore(s => s.logObjectChange)
  const setViewScale = useEditorStore(s => s.setViewScale)
  const setViewOffset = useEditorStore(s => s.setViewOffset)
  const setStageRef = useEditorStore(s => s.setStageRef)
  const safarize = useEditorStore(s => s.safarize)
  const safariShadow = useEditorStore(s => s.safariShadow)

  useEffect(() => {
    cropDrag.current = null
    const element = containerRef.current
    if (!element) return
    element.style.cursor = 'default'
    if (tool === 'crop') element.focus({ preventScroll: true })
  }, [tool])

  const setCursor = (cur: string) => { if (containerRef.current) containerRef.current.style.cursor = cur }
  const arrowGrabOffset = useRef<Point>({ x: 0, y: 0 })

  // drag session for moving whole objects
  const dragRef = useRef<null | {
    id: string
    type: SceneObject['type']
    startImg: { x: number; y: number }
    origin: any
  }>(null)

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
      const target = e.target instanceof HTMLElement ? e.target : null
      if (e.defaultPrevented || e.isComposing || target?.closest('input, textarea, select, dialog') || target?.isContentEditable) return
      if (!imageUrl) return
      if (e.key === 'Escape') {
        setTool('select')
        return
      }
      if (e.key === 'Enter' && !target?.closest('button') && !mod) {
        const state = useEditorStore.getState()
        if (state.tool === 'crop') { e.preventDefault(); applyCropDraft(); return }
        const obj = state.objects.find(o => o.id === state.selectedId)
        if (obj?.type === 'text') { e.preventDefault(); setTextTarget(obj); return }
      }

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
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        removeSelected()
        return
      }

      // Tool shortcuts (layout-independent)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.repeat) {
        const command = toolCommands.find(command => e.code === `Key${command.key}`)
        if (command) { e.preventDefault(); closeMenu(); setTool(command.tool) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, removeSelected, setTool, imageUrl, closeMenu, applyCropDraft])

  const layout = useMemo(() => {
    if (!img || size.width === 0 || size.height === 0) return null
    const bounds = (tool !== 'crop' && crop) || { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
    const { width: iw, height: ih } = bounds
    const framed = safarize && tool !== 'crop'
    const pad = framed && safariShadow ? SAFARI_PADDING : 0
    const toolbarHeight = framed ? safariToolbarHeight(iw) : 0
    const margin = tool === 'crop' ? 14 : 0
    const controlsHeight = tool === 'crop' ? 46 : 0
    const scale = Math.max(0.001, Math.min((size.width - margin * 2) / (iw + pad * 2), (size.height - margin * 2 - controlsHeight) / (ih + toolbarHeight + pad * 2)))
    const topBarH = toolbarHeight * scale
    const outer = pad * scale
    const compW = iw * scale
    const compH = ih * scale + topBarH
    const winX = (size.width - compW) / 2
    const winY = (size.height + controlsHeight - compH) / 2
    const offsetX = winX - bounds.x * scale
    const offsetY = winY + topBarH - bounds.y * scale
    const winW = compW
    const winH = compH
    const stageFromImage = (p: { x: number; y: number }) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })
    const imageFromStage = (p: { x: number; y: number }) => ({ x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale })
    return { scale, offsetX, offsetY, topBarH, outer, winX, winY, winW, winH, bounds, framed, stageFromImage, imageFromStage }
  }, [img, size.width, size.height, safarize, safariShadow, crop, tool])

  useEffect(() => {
    if (layout) setViewScale(layout.scale)
    if (layout) setViewOffset(layout.offsetX, layout.offsetY)
  }, [layout, setViewScale, setViewOffset])

  // register stage ref
  const stageRefCb = (stage: any) => setStageRef(stage)

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
    for (let i = orderedObjects.length - 1; i >= 0; i--) {
      const o = orderedObjects[i]
      if (o.type === 'arrow') {
        const nearCurve = distToQuad(o.start, o.control, o.end, pImg) < 8
        if (nearCurve) return o
      } else if (o.type === 'marker') {
        if (Math.hypot(pImg.x - o.x, pImg.y - o.y) <= MARKER_RADIUS) return o
      } else if (o.type === 'text') {
        if (!textFontReady || !textContext) continue
        const { width, height } = measureTextLabel(textContext, o)
        if (pImg.x >= o.x && pImg.x <= o.x + width && pImg.y >= o.y && pImg.y <= o.y + height) return o
      } else {
        const within = pImg.x >= o.x && pImg.x <= o.x + o.width && pImg.y >= o.y && pImg.y <= o.y + o.height
        if (within) return o
      }
    }
    return null
  }

  const handlePointer = (e: KonvaEventObject<PointerEvent>, kind: 'down' | 'move' | 'up') => {
    if (!img || !layout) return
    if (kind !== 'move' && (e.evt.button !== 0 || e.evt.ctrlKey)) return
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return
    const p = layout.imageFromStage(pos)
    const { bounds } = layout
    const inside = p.x >= bounds.x && p.x < bounds.x + bounds.width && p.y >= bounds.y && p.y < bounds.y + bounds.height
    if (tool === 'crop' && cropDraft) {
      const activeDrag = cropDrag.current
      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
      if (activeDrag?.pointerId === e.evt.pointerId && kind !== 'down') {
        const { start, handle, bounds: initial } = activeDrag
        const dx = p.x - start.x, dy = p.y - start.y
        const { x, y, width, height } = initial
        if (handle === 'move') {
          setCropDraft({ ...initial, x: clamp(x + dx, 0, bounds.width - width), y: clamp(y + dy, 0, bounds.height - height) })
        } else {
          const right = x + width, bottom = y + height
          const left = handle.includes('w') ? clamp(x + dx, 0, right - 1) : x
          const top = handle.includes('n') ? clamp(y + dy, 0, bottom - 1) : y
          setCropDraft({ x: left, y: top,
            width: (handle.includes('e') ? clamp(right + dx, x + 1, bounds.width) : right) - left,
            height: (handle.includes('s') ? clamp(bottom + dy, y + 1, bounds.height) : bottom) - top,
          })
        }
        if (kind === 'up') cropDrag.current = null
        return
      }
      const { x, y, width, height } = cropDraft
      let nearest = 14 / layout.scale
      let handle: CropHandle | null = null
      for (const [name, ax, ay] of cropHandles) {
        const distance = Math.hypot(p.x - (x + width * ax), p.y - (y + height * ay))
        if (distance < nearest) { nearest = distance; handle = name }
      }
      if (!handle && p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height) handle = 'move'
      setCursor(handle === 'move' ? 'move' : handle ? `${handle}-resize` : 'default')
      if (kind === 'down' && handle) {
        cropDrag.current = { handle, start: p, bounds: cropDraft, pointerId: e.evt.pointerId }
        if (e.evt.target instanceof Element) e.evt.target.setPointerCapture(e.evt.pointerId)
      }
      return
    }
    if (tool === 'text') {
      if (kind === 'down' && inside) setTextTarget(p)
      return
    }

    if (tool === 'select') {
      // active dragging session
      if (dragRef.current && kind === 'move') {
        const { id, type, startImg, origin } = dragRef.current
        const dx = p.x - startImg.x
        const dy = p.y - startImg.y
        if (type !== 'arrow') {
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
        const hit = inside ? pickObjectAt(p) : null
        if (hit) {
          // select if needed
          if (selectedId !== hit.id) {
            selectObject(hit.id)
            if (hit.type === 'arrow') beginArrowEdit(hit.id)
          } else if (!isHandle) {
            // start drag for whole object
            setCursor('move')
            const origin = hit.type === 'arrow' ? { start: hit.start, end: hit.end, control: hit.control } : { x: hit.x, y: hit.y }
            dragRef.current = { id: hit.id, type: hit.type, startImg: p, origin }
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

    const point = {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, p.x)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, p.y)),
    }
    if (kind === 'down') { if (inside) startDrawing(point) }
    else if (kind === 'move') updateDrawing(point)
    else {
      updateDrawing(point)
      commitDrawing()
    }
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

  const handleDragRectCorner = (obj: { id: string; x: number; y: number; width: number; height: number }, corner: 'tl'|'tr'|'bl'|'br') => (evt: KonvaEventObject<DragEvent>) => {
    const pos = evt.target.getStage()?.getPointerPosition()
    if (!pos || !layout) return
    const p = layout.imageFromStage(pos)
    let { x, y, width, height } = obj
    const right = x + width, bottom = y + height
    if (corner.endsWith('l')) { x = Math.min(p.x, right - 1); width = right - x }
    else width = Math.max(1, p.x - x)
    if (corner.startsWith('t')) { y = Math.min(p.y, bottom - 1); height = bottom - y }
    else height = Math.max(1, p.y - y)
    updateObjectLive(obj.id, { x, y, width, height })
  }


  const spotlightDraft = draft?.type === 'spotlight' ? {
    x: Math.min(draft.start.x, draft.current.x), y: Math.min(draft.start.y, draft.current.y),
    width: Math.abs(draft.start.x - draft.current.x), height: Math.abs(draft.start.y - draft.current.y),
  } : null
  const spotlights = objects.filter(o => o.type === 'spotlight')
  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageUrl) return
    event.preventDefault()
    setExportError(false)
    setMenuPoint({ x: event.clientX, y: event.clientY })
  }
  return (
    <div ref={containerRef} id="canvas-root" onContextMenu={openContextMenu} tabIndex={-1}
      style={{ width: '100%', height: '100%', background: '#111', color: '#999', position: 'relative', outline: 'none' }}>
      {!imageUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              Вставьте скриншот (⌘/Ctrl+V)
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>или перетащите файл/нажмите «Загрузить»</div>
          </div>
        </div>
      )}
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRefCb}
          width={size.width}
          height={size.height}
          onPointerDown={(e) => handlePointer(e, 'down')}
          onPointerMove={(e) => handlePointer(e, 'move')}
          onPointerUp={(e) => handlePointer(e, 'up')}
          onPointerCancel={() => { cropDrag.current = null }}
          onDblClick={event => {
            if (tool !== 'select' || !layout) return
            const point = event.target.getStage()?.getPointerPosition()
            const obj = point && pickObjectAt(layout.imageFromStage(point))
            if (obj && obj.type === 'text') setTextTarget(obj)
          }}
        >
          <Layer>
            {img && layout?.framed && (
              <Shape listening={false} sceneFunc={context => {
                const ctx = context._context
                ctx.save()
                ctx.translate(layout.winX, layout.winY)
                ctx.scale(layout.scale, layout.scale)
                drawSafariFrame(ctx, layout.bounds.width, layout.bounds.height, safariShadow, safariAddress)
                ctx.restore()
              }} />
            )}
            <Group clipFunc={ctx => {
              if (!img || !layout) { ctx.rect(0, 0, 0, 0); return }
              const radius = layout.framed ? SAFARI_RADIUS * layout.scale : 0
              ctx.roundRect(layout.winX, layout.winY + layout.topBarH, layout.winW, layout.winH - layout.topBarH, [0, 0, radius, radius])
            }}>
            {img && layout && (
              // Image clipped with rounded bottom corners (top corners covered by toolbar)
              <>
                <KonvaImage
                  image={img}
                  x={layout.offsetX}
                  y={layout.offsetY}
                  width={img.naturalWidth * layout.scale}
                  height={img.naturalHeight * layout.scale}

                />
              </>
            )}
            {img && layout && objects.map(obj => obj.type === 'mosaic' && (
              <MosaicShape key={obj.id} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
                blockSize={obj.blockSize} img={img} offsetX={layout.offsetX} offsetY={layout.offsetY}
                scale={layout.scale} stageFromImage={layout.stageFromImage} />
            ))}
            {layout && (spotlights.length > 0 || (spotlightDraft && spotlightDraft.width > 0 && spotlightDraft.height > 0)) && (
              <Shape listening={false} sceneFunc={context => {
                const ctx = context._context
                ctx.save()
                ctx.translate(layout.offsetX, layout.offsetY)
                ctx.scale(layout.scale, layout.scale)
                drawSpotlights(ctx, layout.bounds, spotlightDraft ? [...spotlights, spotlightDraft] : spotlights)
                ctx.restore()
              }} />
            )}
            {img && layout && orderedObjects.map((obj) => {
              if (obj.type === 'arrow') return (
                <ArrowShape key={obj.id} start={obj.start} control={obj.control} end={obj.end} color={obj.color} strokeWidth={obj.strokeWidth} stageFromImage={layout.stageFromImage} />
              )
              if (obj.type === 'rect') return (
                <RectOutlineShape key={obj.id} x={obj.x} y={obj.y} width={obj.width} height={obj.height} color={obj.color} strokeWidth={obj.strokeWidth} stageFromImage={layout.stageFromImage} scale={layout.scale} />
              )
              if (obj.type === 'marker' || obj.type === 'redact' || obj.type === 'text') return (
                <Shape key={obj.id} listening={false} sceneFunc={context => {
                  const ctx = context._context
                  ctx.save()
                  ctx.translate(layout.offsetX, layout.offsetY)
                  ctx.scale(layout.scale, layout.scale)
                  if (obj.type === 'marker') drawMarker(ctx, obj)
                  else if (obj.type === 'text') { if (textFontReady) drawTextLabel(ctx, obj) }
                  else drawRedaction(ctx, obj)
                  ctx.restore()
                }} />
              )
              return null
            })}
            {img && layout && draft && draft.type !== 'spotlight' && (
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
                      stroke="#F99761" strokeWidth={1.5} dash={[6,4]}
                      fill="rgba(90,150,255,0.12)" />
                  )
                })()
              )
            )}
            </Group>
            {layout && tool === 'crop' && cropDraft && (
              <CropOverlay crop={cropDraft} image={layout.bounds} project={layout.stageFromImage} scale={layout.scale} />
            )}
            {img && layout && tool === 'select' && objects.map(obj => {
              if (obj.type !== 'arrow' || selectedId !== obj.id) return null
              const s = layout.stageFromImage(obj.start)
              const e = layout.stageFromImage(obj.end)
              const control = layout.stageFromImage(obj.control)
              const mid = { x: (s.x + 2 * control.x + e.x) / 4, y: (s.y + 2 * control.y + e.y) / 4 }
              const tx = e.x - control.x
              const ty = e.y - control.y
              const tangentLength = Math.hypot(tx, ty)
              const tipHandle = {
                x: e.x + 14 * (tangentLength ? tx / tangentLength : 1),
                y: e.y + 14 * (tangentLength ? ty / tangentLength : 0),
              }
              const handleDrag = (kind: 'start'|'control'|'end') => (evt: KonvaEventObject<DragEvent>) => {
                const pos = kind === 'control' ? evt.target.position() : evt.target.getStage()?.getPointerPosition()
                if (!pos) return
                const p = layout.imageFromStage(pos)
                const latest = useEditorStore.getState().objects.find(o => o.id === obj.id && o.type === 'arrow') as typeof obj | undefined
                if (!latest) return
                if (kind === 'control') {
                  // At t = 0.5 the control point contributes half the position.
                  const desiredControl = {
                    x: 2 * p.x - (latest.start.x + latest.end.x) / 2,
                    y: 2 * p.y - (latest.start.y + latest.end.y) / 2,
                  }
                  const constrained = constrainControlToMidPerpendicular(latest.start, latest.end, desiredControl)
                  updateArrowLive(obj.id, { control: constrained })
                  return
                }
                p.x -= arrowGrabOffset.current.x
                p.y -= arrowGrabOffset.current.y
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
                updateArrowLive(obj.id, { start: newS, end: newE, control: newControl })
              }
              const handleDown = (anchor?: Point) => (evt: KonvaEventObject<PointerEvent>) => {
                evt.cancelBubble = true
                beginArrowEdit(obj.id)
                const pointer = evt.target.getStage()?.getPointerPosition()
                if (!pointer || !anchor) return
                const p = layout.imageFromStage(pointer)
                arrowGrabOffset.current = { x: p.x - anchor.x, y: p.y - anchor.y }
              }
              const handleStyle = {
                draggable: true, stroke: '#80390f', strokeWidth: 1.5, hitStrokeWidth: 14,
                onDragEnd: () => finishArrowEdit(obj.id),
                onPointerEnter: () => setCursor('grab'),
                onPointerLeave: () => setCursor('default'),
              }
              return (
                <Group key={obj.id}>
                  <Line points={[e.x, e.y, tipHandle.x, tipHandle.y]} dash={[2, 2]} stroke="#80390f" listening={false} />
                  <KCircle {...handleStyle} x={s.x} y={s.y} radius={4} fill="white"
                    onPointerDown={handleDown(obj.start)} onDragMove={handleDrag('start')} />
                  <KCircle {...handleStyle} x={tipHandle.x} y={tipHandle.y} radius={4} fill="white"
                    onPointerDown={handleDown(obj.end)} onDragMove={handleDrag('end')} />
                  <KRect {...handleStyle} x={mid.x} y={mid.y} width={9} height={9} offsetX={4.5} offsetY={4.5}
                    rotation={45} fill="#ffd6b9" onPointerDown={handleDown()} onDragMove={handleDrag('control')}
                    dragBoundFunc={pos => constrainControlToMidPerpendicular(s, e, pos)} />
                </Group>
              )
            })}
            {img && layout && objects.map(obj => {
              if (obj.type === 'marker' && selectedId === obj.id && tool === 'select') {
                return <KCircle key={obj.id} {...layout.stageFromImage(obj)} radius={MARKER_RADIUS * layout.scale + 3} stroke="#5a96ff" strokeWidth={1.5} listening={false} />
              }
              if (obj.type === 'text' && selectedId === obj.id && textFontReady && textContext) {
                const { width, height } = measureTextLabel(textContext, obj)
                return <KRect key={obj.id} {...layout.stageFromImage(obj)} width={width * layout.scale} height={height * layout.scale}
                  stroke="#5a96ff" dash={[4, 3]} strokeWidth={1.5} listening={false} />
              }
              if (obj.type !== 'rect' && obj.type !== 'mosaic' && obj.type !== 'redact' && obj.type !== 'spotlight') return null
              if (selectedId !== obj.id) return null
              const tl = layout.stageFromImage({ x: obj.x, y: obj.y })
              const tr = layout.stageFromImage({ x: obj.x + obj.width, y: obj.y })
              const bl = layout.stageFromImage({ x: obj.x, y: obj.y + obj.height })
              const br = layout.stageFromImage({ x: obj.x + obj.width, y: obj.y + obj.height })
              const r = 8
              const handleProps = {
                radius: r, fill: '#F99761', stroke: 'white', strokeWidth: 2, draggable: true, hitStrokeWidth: 24,
                onPointerDown: (event: KonvaEventObject<PointerEvent>) => { event.cancelBubble = true },
                onPointerLeave: () => setCursor('default'),
                onDragEnd: () => logObjectChange(obj.id, 'Изменено'),
              }
              return (
                <Group key={obj.id}>
                  <KRect x={tl.x} y={tl.y} width={obj.width * layout.scale} height={obj.height * layout.scale} stroke="#F99761" strokeWidth={1} dash={[6,4]} listening={false} />
                  <KCircle {...handleProps} x={tl.x} y={tl.y} onDragMove={handleDragRectCorner(obj, 'tl')} onPointerEnter={() => setCursor('nwse-resize')} />
                  <KCircle {...handleProps} x={tr.x} y={tr.y} onDragMove={handleDragRectCorner(obj, 'tr')} onPointerEnter={() => setCursor('nesw-resize')} />
                  <KCircle {...handleProps} x={bl.x} y={bl.y} onDragMove={handleDragRectCorner(obj, 'bl')} onPointerEnter={() => setCursor('nesw-resize')} />
                  <KCircle {...handleProps} x={br.x} y={br.y} onDragMove={handleDragRectCorner(obj, 'br')} onPointerEnter={() => setCursor('nwse-resize')} />
                </Group>
              )
            })}
          </Layer>
        </Stage>
      )}
      {img && tool === 'crop' && cropDraft && (
        <div className="crop-controls" role="group" aria-label="Кадрирование">
          <output>{Math.round(cropDraft.width)} × {Math.round(cropDraft.height)}</output>
          <button type="button" onClick={() => setCropDraft({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight })}>Весь снимок</button>
          <button type="button" onClick={() => { cropDrag.current = null; setTool('select'); setCursor('default') }}>Отмена</button>
          <button type="button" onClick={() => { cropDrag.current = null; applyCropDraft(); setCursor('default') }}>Применить</button>
        </div>
      )}
      {textTarget && (
        <TextLabelDialog initial={'id' in textTarget ? textTarget : undefined}
          onClose={() => setTextTarget(null)}
          onSave={style => { saveText('id' in textTarget ? textTarget.id : textTarget, style); setTextTarget(null) }} />
      )}
      {menuPoint && <CanvasContextMenu point={menuPoint} tool={tool} onTool={setTool} onClose={closeMenu}
        onExport={() => { void onExport().catch(error => { console.error(error); setExportError(true) }) }} />}
      {exportError && <div className="editor-export-error" role="alert">Не удалось экспортировать PNG.</div>}
    </div>
  )
}
