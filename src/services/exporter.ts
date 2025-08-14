import type { ArrowObject, MosaicObject, RectObject, SceneObject } from '../state/editorStore'

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
	const headLen = 12 + strokeWidth * 2
	ctx.beginPath()
	ctx.moveTo(end.x, end.y)
	ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
	ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
	ctx.closePath()
	ctx.fill()
}

function drawRectOutline(ctx: Ctx2D, obj: RectObject) {
	ctx.save()
	ctx.strokeStyle = obj.color as any
	ctx.lineWidth = obj.strokeWidth
	ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)
	ctx.restore()
}

function applyMosaic(ctx: Ctx2D, img: HTMLImageElement, r: MosaicObject) {
	const { x, y, width, height, blockSize } = r
	const w = Math.max(1, Math.floor(width / blockSize))
	const h = Math.max(1, Math.floor(height / blockSize))
	const tmp = new OffscreenCanvas(w, h)
	const tctx = tmp.getContext('2d') as OffscreenCanvasRenderingContext2D
	tctx.imageSmoothingEnabled = false
	tctx.drawImage(img, x, y, width, height, 0, 0, w, h)
	ctx.imageSmoothingEnabled = false
	;(ctx as any).drawImage(tmp as any, 0, 0, w, h, x, y, width, height)
}

export async function exportScenePNG(params: {
	image: HTMLImageElement,
	objects: SceneObject[],
	filename?: string,
}): Promise<Blob> {
	const { image, objects, filename } = params
	const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight)
	const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
	ctx.imageSmoothingEnabled = true
	ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
	for (const obj of objects) {
		if (obj.type === 'mosaic') applyMosaic(ctx, image, obj)
	}
	for (const obj of objects) {
		if (obj.type === 'rect') drawRectOutline(ctx, obj)
		if (obj.type === 'arrow') drawArrow(ctx, obj)
	}
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