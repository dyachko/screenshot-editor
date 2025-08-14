import { Rect } from 'react-konva'

interface RectOutlineShapeProps {
	x: number
	y: number
	width: number
	height: number
	color: string
	strokeWidth: number
	stageFromImage: (p: { x: number; y: number }) => { x: number; y: number }
	scale: number
}

export function RectOutlineShape({ x, y, width, height, color, strokeWidth, stageFromImage, scale }: RectOutlineShapeProps) {
	const topLeft = stageFromImage({ x, y })
	return (
		<Rect
			x={topLeft.x}
			y={topLeft.y}
			width={Math.max(0, width * scale)}
			height={Math.max(0, height * scale)}
			stroke={color}
			strokeWidth={strokeWidth}
			fillEnabled={false}
		/>
	)
} 