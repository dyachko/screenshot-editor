import Konva from 'konva'
import 'konva/lib/filters/Pixelate'
import { Group, Image as KonvaImage } from 'react-konva'
import { useEffect, useRef } from 'react'

interface MosaicShapeProps {
	x: number
	y: number
	width: number
	height: number
	blockSize: number
	img: HTMLImageElement
	offsetX: number
	offsetY: number
	scale: number
	stageFromImage: (p: { x: number; y: number }) => { x: number; y: number }
}

export function MosaicShape({ x, y, width, height, blockSize, img, offsetX, offsetY, scale, stageFromImage }: MosaicShapeProps) {
	const tl = stageFromImage({ x, y })
	const clipW = Math.max(0, width * scale)
	const clipH = Math.max(0, height * scale)
	const pixelSize = Math.max(1, Math.round(blockSize * scale))
	const imgRef = useRef<Konva.Image>(null)

	useEffect(() => {
		const node = imgRef.current
		if (node) {
			node.cache()
			node.getLayer()?.batchDraw()
		}
	}, [img, pixelSize, offsetX, offsetY, scale])

	return (
		<Group clipX={tl.x} clipY={tl.y} clipWidth={clipW} clipHeight={clipH}>
			<KonvaImage
				ref={imgRef}
				image={img}
				x={offsetX}
				y={offsetY}
				width={img.naturalWidth * scale}
				height={img.naturalHeight * scale}
				filters={[Konva.Filters.Pixelate]}
				pixelSize={pixelSize}
			/>
		</Group>
	)
} 