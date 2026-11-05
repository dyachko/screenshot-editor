import { create } from 'zustand'
import { loadActiveSceneId, loadBlob, loadIndex, loadSnapshot, loadStrokeColor, removeStoredScenes, saveActiveSceneId, saveBlob, saveIndex, saveSnapshot, saveStrokeColor } from '../services/persistence'

export type Tool = 'select' | 'arrow' | 'rect' | 'mosaic' | 'crop' | 'marker' | 'text' | 'spotlight'

export interface Point { x: number; y: number }
export interface ImageBounds extends Point { width: number; height: number }
export const MARKER_RADIUS = 14
export const DEFAULT_ANNOTATION_COLOR = '#f99761'
export const LEGACY_MARKER_COLOR = '#2358bf'

export interface ArrowObject {
	id: string
	type: 'arrow'
	start: Point
	control: Point
	end: Point
	color: string
	strokeWidth: number
}

export interface RectObject {
	id: string
	type: 'rect'
	x: number
	y: number
	width: number
	height: number
	color: string
	strokeWidth: number
}

export interface MosaicObject {
	id: string
	type: 'mosaic'
	x: number
	y: number
	width: number
	height: number
	blockSize: number
}

export interface MarkerObject extends Point { id: string; type: 'marker'; number: number; color?: string; numberColor?: string }
// Keep existing masks in saved scenes even though the creation tool is gone.
export interface RedactObject extends ImageBounds { id: string; type: 'redact' }
export interface TextStyle { text: string; fontSize: number; background: boolean; color?: string }
export interface TextObject extends Point, TextStyle { id: string; type: 'text' }
export interface SpotlightObject extends ImageBounds { id: string; type: 'spotlight' }
export type SceneObject = ArrowObject | RectObject | MosaicObject | MarkerObject | RedactObject | TextObject | SpotlightObject

interface DrawingDraft {
	type: Exclude<Tool, 'select' | 'marker' | 'text' | 'crop'>
	start: Point
	current: Point
}

export type ChangeOp =
	| { type: 'add'; object: SceneObject }
	| { type: 'updateArrow'; id: string; changes: Partial<Pick<ArrowObject, 'start' | 'control' | 'end' | 'color' | 'strokeWidth'>> }
	| { type: 'update'; object: SceneObject }
	| { type: 'remove'; id: string }
	| { type: 'crop'; bounds: ImageBounds | null }

export interface HistoryEntry {
	id: string
	label: string
	op: ChangeOp
}

export function getSceneCrop(history: HistoryEntry[], index: number) {
	for (let i = index; i >= 0; i--) {
		const op = history[i].op
		if (op.type === 'crop') return op.bounds
	}
	return null
}

export interface ObjectChangeEntry {
	id: string
	label: string
	at: number
	state: SceneObject
}

export interface SceneSnapshot {
	objects: SceneObject[]
	history: HistoryEntry[]
	historyIndex: number
	objectHistories?: Record<string, ObjectChangeEntry[]>
	objectHistoryIndex?: Record<string, number>
  safarize?: boolean
  safariShadow?: boolean
  safariAddress?: string
}

export interface SceneMeta {
	id: string
	title: string
	imageUrl: string
	imageNatural: { width: number; height: number }
	snapshot: SceneSnapshot
	thumbnail?: string
}

export interface EditorState {
	tool: Tool
	objects: SceneObject[]
	selectedId: string | null
	strokeColor: string
	markerColor: string
	markerNumberColor?: string
	strokeWidth: number
	mosaicBlockSize: number
	drawingDraft: DrawingDraft | null
	cropDraft: ImageBounds | null
	// flat history (compat)
	history: HistoryEntry[]
	historyIndex: number
	applyChange: (entry: HistoryEntry) => void
	undo: () => void
	redo: () => void
	deleteHistoryEntry: (id: string) => void
	// per-object histories
	objectHistories: Record<string, ObjectChangeEntry[]>
	objectHistoryIndex: Record<string, number>
	logObjectChange: (id: string, label: string) => void
	undoObject: (id: string) => void
	redoObject: (id: string) => void
	// scenes
	scenes: SceneMeta[]
	activeSceneId: string | null
	addScene: (scene: { imageUrl: string; imageNatural: { width: number; height: number }; title?: string }) => void
	switchScene: (id: string) => void
	getActiveScene: () => SceneMeta | null
	deleteScenes: (ids: string[]) => Promise<void>
	// safari-style frame
	safarize: boolean
	setSafarize: (v: boolean) => void
	safariShadow: boolean
	setSafariShadow: (v: boolean) => void
	setSafariAddress: (address: string) => void
	setCrop: (bounds: ImageBounds | null) => void
	setCropDraft: (bounds: ImageBounds) => void
	applyCropDraft: () => void
	// editing session for arrows
	editingArrowOriginal: ArrowObject | null
	editingArrowId: string | null
	beginArrowEdit: (id: string) => void
	finishArrowEdit: (id: string) => void
	enterArrowEdit: (id: string) => void
	exitArrowEdit: () => void
	// tools
	setTool: (tool: Tool) => void
	saveText: (target: Point | string, style: TextStyle) => void
	startDrawing: (p: Point) => void
	updateDrawing: (p: Point) => void
	commitDrawing: () => void
	setStrokeColor: (c: string) => void
	setMarkerColor: (color: string) => void
	setMarkerNumberColor: (color?: string) => void
	setStrokeWidth: (w: number) => void
	setMosaicBlockSize: (b: number) => void
	setObjectStyle: (id: string, style: { color?: string; strokeWidth?: number; blockSize?: number }) => void
	reset: () => void
	selectObject: (id: string | null) => void
	updateArrowLive: (id: string, changes: Partial<Pick<ArrowObject, 'start' | 'control' | 'end'>>) => void
	updateObjectLive: (id: string, changes: Partial<any>) => void
	hydrate: () => Promise<void>
	removeSelected: () => void
	// view scale (stage/image scale factor used for pixelate parity)
	viewScale: number
	setViewScale: (s: number) => void
	viewOffsetX: number
	viewOffsetY: number
	setViewOffset: (x: number, y: number) => void
	// stage ref for exact export
	stageRef: any | null
	setStageRef: (stage: any | null) => void
}

function uid() {
	return Math.random().toString(36).slice(2, 9)
}

function applyOp(objects: SceneObject[], op: ChangeOp): SceneObject[] {
	if (op.type === 'add') return [...objects, op.object]
	if (op.type === 'update') return objects.map(o => o.id === op.object.id ? op.object : o)
	if (op.type === 'remove') return objects.filter(o => o.id !== op.id)
	if (op.type === 'updateArrow') return objects.map(o => o.id === op.id && o.type === 'arrow' ? { ...o, ...op.changes } : o)
	return objects
}

function recomputeObjectsFromHistory(entries: HistoryEntry[], index: number): SceneObject[] {
	let objs: SceneObject[] = []
	for (let i = 0; i <= index; i++) {
		objs = applyOp(objs, entries[i].op)
	}
	return objs
}

function historyIndexesFor(objects: SceneObject[], histories: Record<string, ObjectChangeEntry[]>, previous: Record<string, number>) {
	const indexes = { ...previous }
	for (const obj of objects) {
		const list = histories[obj.id] ?? []
		for (let i = list.length - 1; i >= 0; i--) {
			if (JSON.stringify(list[i].state) === JSON.stringify(obj)) {
				indexes[obj.id] = i
				break
			}
		}
	}
	return indexes
}

export const useEditorStore = create<EditorState>((set, get) => ({
	tool: 'select',
	objects: [],
	selectedId: null,
	strokeColor: DEFAULT_ANNOTATION_COLOR,
	markerColor: DEFAULT_ANNOTATION_COLOR,
	strokeWidth: 3,
	mosaicBlockSize: 12,
	drawingDraft: null,
	cropDraft: null,
	history: [],
	historyIndex: -1,
	objectHistories: {},
	objectHistoryIndex: {},
	scenes: [],
	activeSceneId: null,
  safarize: false,
  safariShadow: true,
	hydrate: async () => {
		const strokeColor = await loadStrokeColor()
		if (strokeColor && /^#[0-9a-f]{6}$/i.test(strokeColor)) set({ strokeColor })
		const index = await loadIndex()
		const activeId = await loadActiveSceneId()
		const scenes: SceneMeta[] = []
		for (const item of index) {
			const blob = await loadBlob(item.id)
			if (!blob) continue
			const url = URL.createObjectURL(blob)
			const snap = (await loadSnapshot(item.id)) ?? { objects: [], history: [], historyIndex: -1 }
			scenes.push({ id: item.id, title: item.title, imageUrl: url, imageNatural: item.imageNatural, snapshot: snap })
		}
		set({ scenes, activeSceneId: scenes.find(s => s.id === activeId)?.id ?? (scenes[0]?.id ?? null) })
		const scene = get().getActiveScene()
		if (scene) set({ objects: scene.snapshot.objects, history: scene.snapshot.history, historyIndex: scene.snapshot.historyIndex, objectHistories: scene.snapshot.objectHistories ?? {}, objectHistoryIndex: scene.snapshot.objectHistoryIndex ?? {}, safarize: !!scene.snapshot.safarize, safariShadow: scene.snapshot.safariShadow ?? true })
	},
	addScene: ({ imageUrl, imageNatural, title }) => {
		const state = get()
		if (state.activeSceneId) {
			const updatedScenes = state.scenes.map(s => s.id === state.activeSceneId ? ({
				...s,
				snapshot: { ...s.snapshot, objects: state.objects, history: state.history, historyIndex: state.historyIndex, objectHistories: state.objectHistories, objectHistoryIndex: state.objectHistoryIndex, safarize: state.safarize, safariShadow: state.safariShadow }
			}) : s)
			set({ scenes: updatedScenes })
		}
		const id = uid()
		const newScene: SceneMeta = {
			id,
			title: title ?? `Изображение ${get().scenes.length + 1}`,
			imageUrl,
			imageNatural,
			snapshot: { objects: [], history: [], historyIndex: -1, objectHistories: {}, objectHistoryIndex: {}, safarize: false, safariShadow: true }
		}
		set({
			scenes: [...get().scenes, newScene],
			activeSceneId: id,
			objects: [], history: [], historyIndex: -1,
			objectHistories: {}, objectHistoryIndex: {},
			selectedId: null, drawingDraft: null, cropDraft: null, editingArrowId: null, editingArrowOriginal: null,
			tool: 'select', safarize: false, safariShadow: true
		})
		fetch(imageUrl).then(r => r.blob()).then(async blob => {
			await saveBlob(id, blob)
			await saveIndex(get().scenes.map(s => ({ id: s.id, title: s.title, imageNatural: s.imageNatural })))
			await saveActiveSceneId(id)
		})
	},
	switchScene: (id) => {
		const state = get()
		if (state.activeSceneId === id) return
		if (state.activeSceneId) {
			const updatedScenes = state.scenes.map(s => s.id === state.activeSceneId ? ({
				...s,
				snapshot: { ...s.snapshot, objects: state.objects, history: state.history, historyIndex: state.historyIndex, objectHistories: state.objectHistories, objectHistoryIndex: state.objectHistoryIndex, safarize: state.safarize, safariShadow: state.safariShadow }
			}) : s)
			set({ scenes: updatedScenes })
		}
		const target = get().scenes.find(s => s.id === id)
		if (!target) return
		set({
			activeSceneId: id,
			objects: target.snapshot.objects,
			history: target.snapshot.history,
			historyIndex: target.snapshot.historyIndex,
			objectHistories: target.snapshot.objectHistories ?? {},
			objectHistoryIndex: target.snapshot.objectHistoryIndex ?? {},
			selectedId: null,
			drawingDraft: null,
			cropDraft: null,
			editingArrowId: null,
			editingArrowOriginal: null,
			tool: 'select',
			safarize: !!target.snapshot.safarize,
			safariShadow: target.snapshot.safariShadow ?? true
		})
		saveActiveSceneId(id)
	},
	getActiveScene: () => {
		const { scenes, activeSceneId } = get()
		return scenes.find(s => s.id === activeSceneId) ?? null
	},
	deleteScenes: async (ids) => {
		const selected = new Set(ids)
		const state = get()
		const removed = state.scenes.filter(scene => selected.has(scene.id))
		if (!removed.length) return
		const remaining = state.scenes.filter(scene => !selected.has(scene.id))
		const nextActive = (scenes: SceneMeta[], activeId: string | null) => {
			if (activeId && !selected.has(activeId)) return activeId
			const idx = Math.max(0, state.scenes.findIndex(scene => scene.id === activeId))
			const earlier = state.scenes.slice(0, idx).filter(scene => !selected.has(scene.id)).length
			return scenes[Math.min(earlier, scenes.length - 1)]?.id ?? null
		}
		await removeStoredScenes(removed.map(scene => scene.id), remaining.map(({ id, title, imageNatural }) => ({ id, title, imageNatural })), nextActive(remaining, state.activeSceneId))
		const current = get()
		const scenes = current.scenes.filter(scene => !selected.has(scene.id))
		const activeSceneId = nextActive(scenes, current.activeSceneId)
		const snapshot = scenes.find(scene => scene.id === activeSceneId)?.snapshot
		set(activeSceneId === current.activeSceneId ? { scenes } : {
			scenes, activeSceneId,
			objects: snapshot?.objects ?? [], history: snapshot?.history ?? [], historyIndex: snapshot?.historyIndex ?? -1,
			objectHistories: snapshot?.objectHistories ?? {}, objectHistoryIndex: snapshot?.objectHistoryIndex ?? {},
			selectedId: null, drawingDraft: null, cropDraft: null, editingArrowId: null, editingArrowOriginal: null,
			tool: 'select', safarize: !!snapshot?.safarize, safariShadow: snapshot?.safariShadow ?? true,
		})
		for (const scene of removed) URL.revokeObjectURL(scene.imageUrl)
	},
	applyChange: (entry) => {
		const state = get()
		const trimmed = state.history.slice(0, state.historyIndex + 1)
		const history = [...trimmed, entry]
		const historyIndex = history.length - 1
		const objects = applyOp(state.objects, entry.op)
		set({ history, historyIndex, objects })
		const scene = get().getActiveScene()
		if (scene) {
			const snapshot = { ...scene.snapshot, objects, history, historyIndex, objectHistories: state.objectHistories, objectHistoryIndex: state.objectHistoryIndex, safarize: state.safarize, safariShadow: state.safariShadow }
			const scenes = get().scenes.map(s => s.id === scene.id ? { ...s, snapshot } : s)
			set({ scenes })
			saveSnapshot(scene.id, snapshot)
		}
	},
	undo: () => {
		const { historyIndex, history, objectHistories } = get()
		if (historyIndex < 0) return
		const newIndex = historyIndex - 1
		const objects = newIndex >= 0 ? recomputeObjectsFromHistory(history, newIndex) : []
		const objectHistoryIndex = historyIndexesFor(objects, objectHistories, get().objectHistoryIndex)
		set({ historyIndex: newIndex, objects, objectHistoryIndex, selectedId: null })
		const scene = get().getActiveScene()
		if (scene) {
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { ...s.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { ...scene.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex })
		}
	},
	redo: () => {
		const { historyIndex, history, objectHistories } = get()
		if (historyIndex >= history.length - 1) return
		const newIndex = historyIndex + 1
		const objects = recomputeObjectsFromHistory(history, newIndex)
		const objectHistoryIndex = historyIndexesFor(objects, objectHistories, get().objectHistoryIndex)
		set({ historyIndex: newIndex, objects, objectHistoryIndex, selectedId: null })
		const scene = get().getActiveScene()
		if (scene) {
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { ...s.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { ...scene.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex })
		}
	},
	deleteHistoryEntry: (id) => {
		const { history, historyIndex, objectHistories, objectHistoryIndex } = get()
		const idx = history.findIndex(h => h.id === id)
		if (idx === -1) return
		const newHistory = history.filter(h => h.id !== id)
		let newIndex = historyIndex
		if (idx <= historyIndex) newIndex = historyIndex - 1
		if (newIndex >= newHistory.length) newIndex = newHistory.length - 1
		const objects = newIndex >= 0 ? recomputeObjectsFromHistory(newHistory, newIndex) : []
		set({ history: newHistory, historyIndex: newIndex, objects, selectedId: null })
		const scene = get().getActiveScene()
		if (scene) {
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { ...s.snapshot, objects, history: newHistory, historyIndex: newIndex, objectHistories, objectHistoryIndex } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { ...scene.snapshot, objects, history: newHistory, historyIndex: newIndex, objectHistories, objectHistoryIndex })
		}
	},
	logObjectChange: (id, label) => {
		const obj = get().objects.find(o => o.id === id)
		if (!obj) return
		const list = get().objectHistories[id] ?? []
		const previous = list[get().objectHistoryIndex[id] ?? list.length - 1]?.state
		if (previous && JSON.stringify(previous) === JSON.stringify(obj)) return
		const newList = [...list.slice(0, (get().objectHistoryIndex[id] ?? list.length - 1) + 1), { id: uid(), label, at: Date.now(), state: JSON.parse(JSON.stringify(obj)) }]
		const objectHistories = { ...get().objectHistories, [id]: newList }
		const objectHistoryIndex = { ...get().objectHistoryIndex, [id]: newList.length - 1 }
		set({ objectHistories, objectHistoryIndex })
		if (list.length > 0) get().applyChange({ id: uid(), label, op: { type: 'update', object: structuredClone(obj) } })
		const scene = get().getActiveScene()
		if (scene) {
			const snap = { ...scene.snapshot, objects: get().objects, objectHistories, objectHistoryIndex }
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: snap }) : s)
			set({ scenes })
			saveSnapshot(scene.id, snap)
		}
	},
	undoObject: (id) => {
		const list = get().objectHistories[id] ?? []
		if (list.length === 0) return
		const idx = (get().objectHistoryIndex[id] ?? list.length - 1)
		if (idx <= 0) return
		const newIdx = idx - 1
		const state = list[newIdx].state
		set({ objects: get().objects.map(o => o.id === id ? (JSON.parse(JSON.stringify(state)) as any) : o), objectHistoryIndex: { ...get().objectHistoryIndex, [id]: newIdx } })
		get().applyChange({ id: uid(), label: 'Изменено', op: { type: 'update', object: structuredClone(state) } })
	},
	redoObject: (id) => {
		const list = get().objectHistories[id] ?? []
		if (list.length === 0) return
		const idx = (get().objectHistoryIndex[id] ?? list.length - 1)
		if (idx >= list.length - 1) return
		const newIdx = idx + 1
		const state = list[newIdx].state
		set({ objects: get().objects.map(o => o.id === id ? (JSON.parse(JSON.stringify(state)) as any) : o), objectHistoryIndex: { ...get().objectHistoryIndex, [id]: newIdx } })
		get().applyChange({ id: uid(), label: 'Изменено', op: { type: 'update', object: structuredClone(state) } })
	},
	editingArrowOriginal: null,
	editingArrowId: null,
	beginArrowEdit: (id) => {
		const arrow = get().objects.find(o => o.id === id && o.type === 'arrow') as ArrowObject | undefined
		if (arrow) set({ editingArrowOriginal: { ...arrow }, editingArrowId: id })
	},
	finishArrowEdit: (id) => {
		set({ editingArrowOriginal: null })
		get().logObjectChange(id, 'Изменено')
	},
	setSafarize: (v) => {
		set({ safarize: v })
		const scene = get().getActiveScene()
		if (scene) {
			const snap = { ...scene.snapshot, safarize: v }
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: snap }) : s)
			set({ scenes })
			saveSnapshot(scene.id, snap)
		}
	},
	setSafariShadow: (v) => {
		set({ safariShadow: v })
		const scene = get().getActiveScene()
		if (scene) {
			const snap = { ...scene.snapshot, safariShadow: v }
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: snap }) : s)
			set({ scenes })
			saveSnapshot(scene.id, snap)
		}
	},
	enterArrowEdit: (id) => set({ selectedId: id, editingArrowId: id }),
	setSafariAddress: (address) => {
		const scene = get().getActiveScene()
		if (!scene) return
		const snapshot = { ...scene.snapshot, safariAddress: address.slice(0, 256) }
		set({ scenes: get().scenes.map(s => s.id === scene.id ? { ...s, snapshot } : s) })
		saveSnapshot(scene.id, snapshot)
	},
	setCrop: (bounds) => {
		const { history, historyIndex, applyChange, getActiveScene } = get()
		const scene = getActiveScene()
		if (!scene) return
		let next = null
		if (bounds) {
			const { width, height } = scene.imageNatural
			const x = Math.max(0, Math.min(width - 1, Math.round(bounds.x)))
			const y = Math.max(0, Math.min(height - 1, Math.round(bounds.y)))
			const w = Math.max(1, Math.min(width, Math.round(bounds.x + bounds.width)) - x)
			const h = Math.max(1, Math.min(height, Math.round(bounds.y + bounds.height)) - y)
			if (w !== width || h !== height) next = { x, y, width: w, height: h }
		}
		const current = getSceneCrop(history, historyIndex)
		if (JSON.stringify(current) !== JSON.stringify(next)) {
			applyChange({ id: uid(), label: next ? 'Кадрирование' : 'Сброс кадрирования', op: { type: 'crop', bounds: next } })
		}
		set({ drawingDraft: null, cropDraft: null, tool: 'select', selectedId: null })
	},
	setCropDraft: (bounds) => { if (get().tool === 'crop') set({ cropDraft: bounds }) },
	applyCropDraft: () => {
		const { cropDraft, tool, setCrop } = get()
		if (tool === 'crop' && cropDraft) setCrop(cropDraft)
	},
	exitArrowEdit: () => set({ editingArrowId: null }),
	setTool: (tool) => {
		const state = get()
		if (tool === 'crop' && state.tool === 'crop') return
		const image = state.getActiveScene()?.imageNatural
		const cropDraft = tool === 'crop' && image
			? getSceneCrop(state.history, state.historyIndex) ?? { x: 0, y: 0, ...image }
			: null
		set({ tool, selectedId: null, drawingDraft: null, cropDraft })
	},
	saveText: (target, style) => {
		const text = style.text.trim().slice(0, 500)
		if (!text || !get().activeSceneId) return
		const options = {
			text, fontSize: Math.max(12, Math.min(96, Math.round(style.fontSize))), background: style.background,
			...(style.color ? { color: style.color } : {}),
		}
		const { objects, applyChange, logObjectChange, updateObjectLive } = get()
		if (typeof target === 'string') {
			if (!objects.some(o => o.id === target && o.type === 'text')) return
			updateObjectLive(target, options)
			logObjectChange(target, 'Текст изменён')
			return
		}
		const object: TextObject = { id: uid(), type: 'text', ...target, color: DEFAULT_ANNOTATION_COLOR, ...options }
		applyChange({ id: uid(), label: 'Текст', op: { type: 'add', object } })
		logObjectChange(object.id, 'Создано')
		set({ selectedId: object.id, tool: 'select' })
	},
	startDrawing: (p) => {
		const tool = get().tool
		if (tool === 'select' || tool === 'text' || tool === 'crop') return
		if (tool === 'marker') {
			const number = 1 + get().objects.reduce((max, obj) => obj.type === 'marker' ? Math.max(max, obj.number) : max, 0)
			const { markerColor, markerNumberColor } = get()
			const object: MarkerObject = { id: uid(), type: 'marker', ...p, number, color: markerColor, numberColor: markerNumberColor }
			get().applyChange({ id: uid(), label: 'Метка', op: { type: 'add', object } })
			get().logObjectChange(object.id, 'Создано')
			return
		}
		set({ drawingDraft: { type: tool, start: p, current: p } })
	},
	updateDrawing: (p) => {
		if (!get().drawingDraft) return
		set({ drawingDraft: { ...get().drawingDraft!, current: p } })
	},
	commitDrawing: () => {
		const draft = get().drawingDraft
		if (!draft) return
		const { start, current, type } = draft
		const minX = Math.min(start.x, current.x)
		const minY = Math.min(start.y, current.y)
		const width = Math.abs(current.x - start.x)
		const height = Math.abs(current.y - start.y)
		if (type === 'spotlight') {
			if (width < 1 || height < 1) { set({ drawingDraft: null }); return }
			const object: SpotlightObject = { id: uid(), type, x: minX, y: minY, width, height }
			get().applyChange({ id: uid(), label: 'Подсветка', op: { type: 'add', object } })
			get().logObjectChange(object.id, 'Создано')
			set({ drawingDraft: null, selectedId: object.id, tool: 'select' })
			return
		}
		if (type === 'arrow') {
			const mid = { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 }
			const obj: ArrowObject = { id: uid(), type: 'arrow', start, control: mid, end: current, color: get().strokeColor, strokeWidth: get().strokeWidth }
			get().applyChange({ id: uid(), label: 'Стрелка', op: { type: 'add', object: obj } })
			get().logObjectChange(obj.id, 'Создано')
			set({ drawingDraft: null, selectedId: obj.id, editingArrowId: obj.id, tool: 'select' })
			return
		}
		if (type === 'rect') {
			const obj: RectObject = { id: uid(), type: 'rect', x: minX, y: minY, width, height, color: get().strokeColor, strokeWidth: get().strokeWidth }
			get().applyChange({ id: uid(), label: 'Рамка', op: { type: 'add', object: obj } })
			get().logObjectChange(obj.id, 'Создано')
			set({ drawingDraft: null, selectedId: obj.id, tool: 'select' })
			return
		}
		if (type === 'mosaic') {
			const obj: MosaicObject = { id: uid(), type: 'mosaic', x: minX, y: minY, width, height, blockSize: get().mosaicBlockSize }
			get().applyChange({ id: uid(), label: 'Мозаика', op: { type: 'add', object: obj } })
			get().logObjectChange(obj.id, 'Создано')
			set({ drawingDraft: null, selectedId: obj.id, tool: 'select' })
			return
		}
	},
	setStrokeColor: (c) => {
		set({ strokeColor: c })
		void saveStrokeColor(c).catch(console.error)
	},
	setMarkerColor: (color) => {
		const { selectedId, objects, tool, updateObjectLive, logObjectChange } = get()
		const marker = tool === 'select' && objects.find(obj => obj.id === selectedId && obj.type === 'marker')
		if (!marker) {
			set({ markerColor: color })
			return
		}
		updateObjectLive(marker.id, { color })
		logObjectChange(marker.id, 'Цвет метки')
	},
	setMarkerNumberColor: (numberColor) => {
		const { selectedId, objects, tool, updateObjectLive, logObjectChange } = get()
		const marker = tool === 'select' ? objects.find(obj => obj.id === selectedId && obj.type === 'marker') : undefined
		if (!marker) {
			set({ markerNumberColor: numberColor })
			return
		}
		if (marker.type !== 'marker' || marker.numberColor === numberColor) return
		updateObjectLive(marker.id, { numberColor })
		logObjectChange(marker.id, 'Цвет цифры')
	},
	setStrokeWidth: (w) => set({ strokeWidth: w }),
	setMosaicBlockSize: (b) => set({ mosaicBlockSize: Math.max(2, Math.round(b)) }),
	setObjectStyle: (id, style) => {
		const { objects, objectHistories, logObjectChange, updateObjectLive } = get()
		const object = objects.find(o => o.id === id)
		if (!object) return
		const changes = object.type === 'arrow' || object.type === 'rect'
			? { color: style.color ?? object.color, strokeWidth: style.strokeWidth ?? object.strokeWidth }
			: object.type === 'mosaic' ? { blockSize: style.blockSize ?? object.blockSize } : null
		if (!changes || Object.entries(changes).every(([key, value]) => Reflect.get(object, key) === value)) return
		if (!objectHistories[id]?.length) logObjectChange(id, 'Исходный стиль')
		updateObjectLive(id, changes)
		logObjectChange(id, 'Стиль элемента')
	},
	reset: () => set({ objects: [], selectedId: null, drawingDraft: null, cropDraft: null, history: [], historyIndex: -1, objectHistories: {}, objectHistoryIndex: {}, editingArrowId: null, editingArrowOriginal: null, scenes: [], activeSceneId: null, safarize: false, safariShadow: true }),
	selectObject: (id) => set({ selectedId: id }),
	updateArrowLive: (id, changes) => set({ objects: get().objects.map(o => o.id === id && o.type === 'arrow' ? { ...o, ...changes } : o) }),
	updateObjectLive: (id, changes) => set({ objects: get().objects.map(o => o.id === id ? ({ ...o, ...changes }) as any : o) }),
	removeSelected: () => {
		const { selectedId, objects } = get()
		if (!selectedId) return
		const obj = objects.find(o => o.id === selectedId)
		if (!obj) return
		get().applyChange({ id: uid(), label: 'Удалено', op: { type: 'remove', id: selectedId } })
		set({ selectedId: null, editingArrowId: null, editingArrowOriginal: null })
	},
	viewScale: 1,
	setViewScale: (s) => set({ viewScale: s }),
	viewOffsetX: 0,
	viewOffsetY: 0,
	setViewOffset: (x, y) => set({ viewOffsetX: x, viewOffsetY: y }),
	stageRef: null,
	setStageRef: (stage) => set({ stageRef: stage }),
}))
