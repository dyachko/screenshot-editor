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

function applyMosaicFromSource(ctx: Ctx2D, srcCtx: OffscreenCanvasRenderingContext2D, r: MosaicObject, stageScale: number, offsetX: number, offsetY: number) {
	const { x, y, width, height, blockSize } = r
	// Align blocks to grid anchored at (0,0)
	const anchorX = ((x % blockSize) + blockSize) % blockSize
	const anchorY = ((y % blockSize) + blockSize) % blockSize
	const sx = x - anchorX
	const sy = y - anchorY
	const sw = width + anchorX
	const sh = height + anchorY
	const cols = Math.max(1, Math.round(sw / blockSize))
	const rows = Math.max(1, Math.round(sh / blockSize))

	;(ctx as CanvasRenderingContext2D).save()
	;(ctx as CanvasRenderingContext2D).beginPath()
	;(ctx as CanvasRenderingContext2D).rect(x, y, width, height)
	;(ctx as CanvasRenderingContext2D).clip()

	for (let rIdx = 0; rIdx < rows; rIdx++) {
		for (let cIdx = 0; cIdx < cols; cIdx++) {
			const px = sx + cIdx * blockSize
			const py = sy + rIdx * blockSize
			// account for stage translation before scaling (match on-screen: src pixel at (offset + px*scale))
			const cx = Math.floor((offsetX + px * stageScale))
			const cy = Math.floor((offsetY + py * stageScale))
			const ix = Math.min(srcCtx.canvas.width - 1, Math.max(0, cx))
			const iy = Math.min(srcCtx.canvas.height - 1, Math.max(0, cy))
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
	stageScale?: number,
	offsetX?: number,
	offsetY?: number,
}): Promise<Blob> {
	const { image, objects, filename, stageScale = 1, offsetX = 0, offsetY = 0 } = params
	const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight)
	const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
	ctx.imageSmoothingEnabled = true
	ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
	// source context for sampling (scaled to stage scale)
	const sw = Math.max(1, Math.round(image.naturalWidth * stageScale))
	const sh = Math.max(1, Math.round(image.naturalHeight * stageScale))
	const src = new OffscreenCanvas(sw, sh)
	const srcCtx = src.getContext('2d') as OffscreenCanvasRenderingContext2D
	srcCtx.imageSmoothingEnabled = true
	srcCtx.drawImage(image, 0, 0, sw, sh)
	for (const obj of objects) {
		if (obj.type === 'mosaic') applyMosaicFromSource(ctx, srcCtx, obj, stageScale, offsetX, offsetY)
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