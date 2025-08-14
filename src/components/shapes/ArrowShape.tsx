import { Group, Line } from 'react-konva'
import type { Point } from '../../state/editorStore'

interface ArrowShapeProps {
	start: Point
	control: Point
	end: Point
	color: string
	strokeWidth: number
	stageFromImage: (p: Point) => Point
}

function quadPoints(start: Point, control: Point, end: Point, segments = 32) {
	const pts: number[] = []
	for (let i = 0; i <= segments; i++) {
		const t = i / segments
		const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x
		const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y
		pts.push(x, y)
	}
	return pts
}

function arrowHead(base: Point, tip: Point, size: number) {
	const angle = Math.atan2(tip.y - base.y, tip.x - base.x)
	const left = { x: tip.x - size * Math.cos(angle - Math.PI / 6), y: tip.y - size * Math.sin(angle - Math.PI / 6) }
	const right = { x: tip.x - size * Math.cos(angle + Math.PI / 6), y: tip.y - size * Math.sin(angle + Math.PI / 6) }
	return [left, tip, right]
}

export function ArrowShape({ start, control, end, color, strokeWidth, stageFromImage }: ArrowShapeProps) {
	const curveImg = quadPoints(start, control, end)
	const curveStage = [] as number[]
	for (let i = 0; i < curveImg.length; i += 2) {
		const p = stageFromImage({ x: curveImg[i], y: curveImg[i + 1] })
		curveStage.push(p.x, p.y)
	}
	const baseImg: Point = curveImg.length >= 4 ? { x: curveImg[curveImg.length - 4], y: curveImg[curveImg.length - 3] } : start
	const tipImg: Point = end
	const headSize = 8 + strokeWidth
	const [lImg, tipImg2, rImg] = arrowHead(baseImg, tipImg, headSize)
	const l = stageFromImage(lImg)
	const tip = stageFromImage(tipImg2)
	const r = stageFromImage(rImg)
	return (
		<Group>
			<Line points={curveStage} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round"/>
			<Line points={[l.x, l.y, tip.x, tip.y, r.x, r.y]} closed fill={color} stroke={color} strokeWidth={strokeWidth} />
		</Group>
	)
} 