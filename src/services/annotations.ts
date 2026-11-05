import { DEFAULT_ANNOTATION_COLOR, LEGACY_MARKER_COLOR, MARKER_RADIUS, type ImageBounds, type MarkerObject, type RedactObject, type TextObject } from '../state/editorStore'

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const textFont = (size: number) => `600 ${size}px "Tilda Sans", system-ui, sans-serif`
let textFontLoad: Promise<unknown> | undefined

export function loadTextLabelFont() {
  textFontLoad ??= document.fonts.load(textFont(24)).catch(error => {
    console.warn('Could not load Tilda Sans for text labels', error)
  })
  return textFontLoad
}

export function measureTextLabel(ctx: Context, obj: TextObject) {
  ctx.save()
  ctx.font = textFont(obj.fontSize)
  const lines = obj.text.split('\n')
  const lineHeight = obj.fontSize * 1.3
  const padding = obj.fontSize * 0.35
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + padding * 2
  ctx.restore()
  return { lines, lineHeight, padding, width, height: lines.length * lineHeight + padding * 2 }
}

export function drawTextLabel(ctx: Context, obj: TextObject) {
  const { lines, lineHeight, padding, width, height } = measureTextLabel(ctx, obj)
  ctx.save()
  if (obj.background) {
    ctx.fillStyle = '#22252beF'
    ctx.beginPath()
    ctx.roundRect(obj.x, obj.y, width, height, padding)
    ctx.fill()
  }
  ctx.font = textFont(obj.fontSize)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = obj.color ?? '#fff'
  ctx.strokeStyle = '#17191d'
  ctx.lineWidth = Math.max(2, obj.fontSize / 9)
  ctx.lineJoin = 'round'
  lines.forEach((line, i) => {
    const y = obj.y + padding + (i + 0.5) * lineHeight
    if (!obj.background) ctx.strokeText(line, obj.x + padding, y)
    ctx.fillText(line, obj.x + padding, y)
  })
  ctx.restore()
}

export function drawSpotlights(ctx: Context, bounds: ImageBounds, regions: ImageBounds[]) {
  if (!regions.length) return
  ctx.save()
  // Intersect the area outside each region so overlapping highlights stay clear.
  for (const region of regions) {
    ctx.beginPath()
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height)
    const x = Math.max(bounds.x, region.x)
    const y = Math.max(bounds.y, region.y)
    const width = Math.min(bounds.x + bounds.width, region.x + region.width) - x
    const height = Math.min(bounds.y + bounds.height, region.y + region.height) - y
    if (width > 0 && height > 0) ctx.rect(x, y, width, height)
    ctx.clip('evenodd')
  }
  ctx.fillStyle = 'rgba(10,12,16,0.58)'
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
  ctx.restore()
}

export function automaticMarkerNumberColor(color: string) {
  return color.toLowerCase() === DEFAULT_ANNOTATION_COLOR ? '#25201d' : '#fff'
}

export function drawMarker(ctx: Context, { x, y, number, color = LEGACY_MARKER_COLOR, numberColor }: MarkerObject) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = numberColor ?? automaticMarkerNumberColor(color)
  ctx.fillText(String(number), x, y, MARKER_RADIUS * 1.5)
  ctx.restore()
}

export function drawRedaction(ctx: Context, { x, y, width, height }: RedactObject) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  ctx.fillStyle = '#111'
  ctx.fillRect(left, top, Math.ceil(x + width) - left, Math.ceil(y + height) - top)
}
