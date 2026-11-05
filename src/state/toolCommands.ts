import type { Tool } from './editorStore'

export const toolCommands = [
  { tool: 'select', label: 'Выбор', key: 'S' },
  { tool: 'rect', label: 'Рамка', key: 'R' },
  { tool: 'arrow', label: 'Стрелка', key: 'A' },
  { tool: 'mosaic', label: 'Мозаика', key: 'M' },
  { tool: 'crop', label: 'Кадрировать', key: 'C' },
  { tool: 'marker', label: 'Нумерованная метка', key: 'N' },
  { tool: 'text', label: 'Текст', key: 'T' },
  { tool: 'spotlight', label: 'Подсветка области', key: 'H' },
] as const satisfies ReadonlyArray<{ tool: Tool; label: string; key: string }>
