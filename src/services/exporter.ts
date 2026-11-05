import { drawSafariFrame, safariToolbarHeight, SAFARI_PADDING, SAFARI_RADIUS } from './safariFrame'
import type { ArrowObject, ImageBounds, MosaicObject, RectObject, SceneObject } from '../state/editorStore'
import { drawMarker, drawRedaction, drawSpotlights, drawTextLabel, loadTextLabelFont } from './annotations'

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function drawArrow(ctx: Ctx2D, obj: ArrowObject) {
	const { start, control, end, color, strokeWidth } = obj
	;(ctx as CanvasRenderingContext2D).strokeStyle = color
	;(ctx as CanvasRenderingContext2D).fillStyle = color
	ctx.lineWidth = strokeWidth
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.beginPath()
	ctx.moveTo(start.x, start.y)
	;(ctx as CanvasRenderingContext2D).quadraticCurveTo(control.x, control.y, end.x, end.y)
	ctx.stroke()
	const angle = Math.atan2(end.y - control.y, end.x - control.x)
	const headLen = 8 + strokeWidth
	ctx.beginPath()
	ctx.moveTo(end.x, end.y)
	ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
	ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
	ctx.closePath()
	ctx.fill()
	ctx.stroke()
}

function drawRectOutline(ctx: Ctx2D, obj: RectObject) {
	ctx.save()
	ctx.strokeStyle = obj.color
	ctx.lineWidth = obj.strokeWidth
	ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)
	ctx.restore()
}

function applyMosaicFromSource(ctx: Ctx2D, srcCtx: OffscreenCanvasRenderingContext2D, r: MosaicObject, bounds: ImageBounds) {
	const { x, y, width, height, blockSize } = r
	// Align blocks to grid anchored at (0,0)
	const anchorX = ((x % blockSize) + blockSize) % blockSize
	const anchorY = ((y % blockSize) + blockSize) % blockSize
	const sx = x - anchorX
	const sy = y - anchorY
	const sw = width + anchorX
	const sh = height + anchorY
	const cols = Math.max(1, Math.ceil(sw / blockSize))
	const rows = Math.max(1, Math.ceil(sh / blockSize))

	;(ctx as CanvasRenderingContext2D).save()
	;(ctx as CanvasRenderingContext2D).beginPath()
	;(ctx as CanvasRenderingContext2D).rect(x, y, width, height)
	;(ctx as CanvasRenderingContext2D).clip()

	for (let rIdx = 0; rIdx < rows; rIdx++) {
		for (let cIdx = 0; cIdx < cols; cIdx++) {
			const px = sx + cIdx * blockSize
			const py = sy + rIdx * blockSize
			const ix = Math.min(bounds.x + bounds.width - 1, Math.max(bounds.x, Math.floor(px)))
			const iy = Math.min(bounds.y + bounds.height - 1, Math.max(bounds.y, Math.floor(py)))
			const data = srcCtx.getImageData(ix, iy, 1, 1).data
			const a = data[3] / 255
			;(ctx as CanvasRenderingContext2D).fillStyle = `rgba(${data[0]},${data[1]},${data[2]},${a})`
			;(ctx as CanvasRenderingContext2D).fillRect(px, py, blockSize, blockSize)
		}
	}
	;(ctx as CanvasRenderingContext2D).restore()
}

export async function exportScenePNG(params: {
	image: HTMLImageElement,
	objects: SceneObject[],
	filename?: string,
	safarize?: boolean,
	safariShadow?: boolean,
	safariAddress?: string,
	crop?: ImageBounds | null,
	stageScale?: number,
	offsetX?: number,
	offsetY?: number,
}): Promise<Blob> {
	const { image, objects, filename, safarize = false, safariShadow = true, safariAddress, crop } = params
	if (objects.some(obj => obj.type === 'text')) await loadTextLabelFont()
	const bounds = crop ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
	const pad = safarize && safariShadow ? SAFARI_PADDING : 0
	const top = safarize ? safariToolbarHeight(bounds.width) : 0
	const canvas = new OffscreenCanvas(bounds.width + pad * 2, bounds.height + top + pad * 2)
	const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
	ctx.translate(pad, pad)
	if (safarize) drawSafariFrame(ctx, bounds.width, bounds.height, safariShadow, safariAddress)
	ctx.save()
	if (safarize) {
		ctx.beginPath(); ctx.roundRect(0, 0, bounds.width, bounds.height + top, SAFARI_RADIUS); ctx.clip()
	}
	ctx.translate(0, top)
	ctx.beginPath(); ctx.rect(0, 0, bounds.width, bounds.height); ctx.clip()
	ctx.translate(-bounds.x, -bounds.y)
	ctx.imageSmoothingEnabled = true
	ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
	const mosaics = objects.filter(obj => obj.type === 'mosaic')
	const redactions = objects.filter(obj => obj.type === 'redact')
	if (mosaics.length) {
		const src = new OffscreenCanvas(image.naturalWidth, image.naturalHeight)
		const srcCtx = src.getContext('2d') as OffscreenCanvasRenderingContext2D
		srcCtx.drawImage(image, 0, 0)
		// A mosaic block may extend beyond a mask; never sample the hidden source color.
		for (const obj of redactions) drawRedaction(srcCtx, obj)
		for (const obj of mosaics) applyMosaicFromSource(ctx, srcCtx, obj, bounds)
	}
	drawSpotlights(ctx, bounds, objects.filter(obj => obj.type === 'spotlight'))
	for (const obj of objects) {
		if (obj.type === 'rect') drawRectOutline(ctx, obj)
		if (obj.type === 'arrow') drawArrow(ctx, obj)
		if (obj.type === 'marker') drawMarker(ctx, obj)
		if (obj.type === 'text') drawTextLabel(ctx, obj)
	}
	for (const obj of redactions) drawRedaction(ctx, obj)
	ctx.restore()
	const blob = await canvas.convertToBlob({ type: 'image/png' })
	if (filename) {
		const a = document.createElement('a')
		a.href = URL.createObjectURL(blob)
		a.download = filename
		document.body.appendChild(a)
		a.click()
		URL.revokeObjectURL(a.href)
		document.body.removeChild(a)
	}
	return blob
}
