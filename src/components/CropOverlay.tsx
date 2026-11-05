import { Group, Line, Rect, Shape } from 'react-konva'
import type { ImageBounds, Point } from '../state/editorStore'
import { drawSpotlights } from '../services/annotations'

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

export const cropHandles = [
  ['nw', 0, 0], ['n', .5, 0], ['ne', 1, 0], ['e', 1, .5],
  ['se', 1, 1], ['s', .5, 1], ['sw', 0, 1], ['w', 0, .5],
] as const

export function CropOverlay({ crop, image, project, scale }: {
  crop: ImageBounds; image: ImageBounds; project: (point: Point) => Point; scale: number
}) {
  const { x, y } = project(crop)
  const width = crop.width * scale, height = crop.height * scale
  return (
    <Group listening={false}>
      <Shape sceneFunc={context => {
        const ctx = context._context
        const origin = project(image)
        ctx.save()
        ctx.translate(origin.x, origin.y)
        ctx.scale(scale, scale)
        drawSpotlights(ctx, image, [crop])
        ctx.restore()
      }} />
      <Rect x={x} y={y} width={width} height={height} stroke="#81aeff" strokeWidth={1.5} />
      {[1 / 3, 2 / 3].map(ratio => (
        <Group key={ratio}>
          <Line points={[x + width * ratio, y, x + width * ratio, y + height]} stroke="#ffffff8c" strokeWidth={1} />
          <Line points={[x, y + height * ratio, x + width, y + height * ratio]} stroke="#ffffff8c" strokeWidth={1} />
        </Group>
      ))}
      {cropHandles.map(([handle, ax, ay]) => (
        <Rect key={handle} x={x + ax * width - 5} y={y + ay * height - 5} width={10} height={10}
          cornerRadius={2} fill="#fff" stroke="#396dce" strokeWidth={1.5} />
      ))}
    </Group>
  )
}
