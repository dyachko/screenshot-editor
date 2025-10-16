import { create } from 'zustand'
import { deleteBlob, deleteSnapshot, loadActiveSceneId, loadBlob, loadIndex, loadSnapshot, saveActiveSceneId, saveBlob, saveIndex, saveSnapshot } from '../services/persistence'

export type Tool = 'select' | 'arrow' | 'rect' | 'mosaic'

export interface Point { x: number; y: number }

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

export type SceneObject = ArrowObject | RectObject | MosaicObject

interface DrawingDraft {
	type: 'arrow' | 'rect' | 'mosaic'
	start: Point
	current: Point
}

export type ChangeOp =
	| { type: 'add'; object: SceneObject }
	| { type: 'updateArrow'; id: string; changes: Partial<Pick<ArrowObject, 'start' | 'control' | 'end' | 'color' | 'strokeWidth'>> }
	| { type: 'remove'; id: string }

export interface HistoryEntry {
	id: string
	label: string
	op: ChangeOp
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
	strokeWidth: number
	mosaicBlockSize: number
	drawingDraft: DrawingDraft | null
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
	deleteScene: (id: string) => void
	deleteAllScenes: () => Promise<void>
	// safari-style frame
	safarize: boolean
	setSafarize: (v: boolean) => void
	// editing session for arrows
	editingArrowOriginal: ArrowObject | null
	editingArrowId: string | null
	beginArrowEdit: (id: string) => void
	finishArrowEdit: (id: string) => void
	enterArrowEdit: (id: string) => void
	exitArrowEdit: () => void
	// tools
	setTool: (tool: Tool) => void
	startDrawing: (p: Point) => void
	updateDrawing: (p: Point) => void
	commitDrawing: () => void
	setStrokeColor: (c: string) => void
	setStrokeWidth: (w: number) => void
	setMosaicBlockSize: (b: number) => void
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

export const useEditorStore = create<EditorState>((set, get) => ({
	tool: 'select',
	objects: [],
	selectedId: null,
	strokeColor: '#F99761',
	strokeWidth: 3,
	mosaicBlockSize: 12,
	drawingDraft: null,
	history: [],
	historyIndex: -1,
	objectHistories: {},
	objectHistoryIndex: {},
	scenes: [],
	activeSceneId: null,
  safarize: false,
	hydrate: async () => {
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
		if (scene) set({ objects: scene.snapshot.objects, history: scene.snapshot.history, historyIndex: scene.snapshot.historyIndex, objectHistories: scene.snapshot.objectHistories ?? {}, objectHistoryIndex: scene.snapshot.objectHistoryIndex ?? {}, safarize: !!scene.snapshot.safarize })
	},
	addScene: ({ imageUrl, imageNatural, title }) => {
		const state = get()
		if (state.activeSceneId) {
			const updatedScenes = state.scenes.map(s => s.id === state.activeSceneId ? ({
				...s,
				snapshot: { objects: state.objects, history: state.history, historyIndex: state.historyIndex, objectHistories: state.objectHistories, objectHistoryIndex: state.objectHistoryIndex, safarize: get().safarize }
			}) : s)
			set({ scenes: updatedScenes })
		}
		const id = uid()
		const newScene: SceneMeta = {
			id,
			title: title ?? `Изображение ${get().scenes.length + 1}`,
			imageUrl,
			imageNatural,
			snapshot: { objects: [], history: [], historyIndex: -1, objectHistories: {}, objectHistoryIndex: {}, safarize: false }
		}
		set({
			scenes: [...get().scenes, newScene],
			activeSceneId: id,
			objects: [], history: [], historyIndex: -1,
			objectHistories: {}, objectHistoryIndex: {},
			selectedId: null, editingArrowId: null, editingArrowOriginal: null,
			tool: 'select', safarize: false
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
				snapshot: { objects: state.objects, history: state.history, historyIndex: state.historyIndex, objectHistories: state.objectHistories, objectHistoryIndex: state.objectHistoryIndex, safarize: get().safarize }
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
			editingArrowId: null,
			editingArrowOriginal: null,
			tool: 'select',
			safarize: !!target.snapshot.safarize
		})
		saveActiveSceneId(id)
	},
	getActiveScene: () => {
		const { scenes, activeSceneId } = get()
		return scenes.find(s => s.id === activeSceneId) ?? null
	},
	deleteScene: async (id: string) => {
		const state = get()
		const idx = state.scenes.findIndex(s => s.id === id)
		if (idx === -1) return
		const removed = state.scenes[idx]
		try { URL.revokeObjectURL(removed.imageUrl) } catch {}
		const newScenes = state.scenes.filter(s => s.id !== id)
		await deleteBlob(id)
		await deleteSnapshot(id)
		await saveIndex(newScenes.map(s => ({ id: s.id, title: s.title, imageNatural: s.imageNatural })))
		if (state.activeSceneId === id) {
			if (newScenes.length > 0) {
				const newIdx = Math.min(idx, newScenes.length - 1)
				const target = newScenes[newIdx]
				const snap = target.snapshot
				set({
					scenes: newScenes,
					activeSceneId: target.id,
					objects: snap.objects,
					history: snap.history,
					historyIndex: snap.historyIndex,
					objectHistories: snap.objectHistories ?? {},
					objectHistoryIndex: snap.objectHistoryIndex ?? {},
					selectedId: null,
					editingArrowId: null,
					editingArrowOriginal: null,
					tool: 'select'
				})
				await saveActiveSceneId(target.id)
			} else {
				set({
					scenes: [],
					activeSceneId: null,
					objects: [], history: [], historyIndex: -1, objectHistories: {}, objectHistoryIndex: {},
					selectedId: null,
					editingArrowId: null,
					editingArrowOriginal: null,
					tool: 'select'
				})
				await saveActiveSceneId(null)
			}
		} else {
			set({ scenes: newScenes })
		}
	},
	deleteAllScenes: async () => {
		const state = get()
		for (const s of state.scenes) {
			try { URL.revokeObjectURL(s.imageUrl) } catch {}
			await deleteBlob(s.id)
			await deleteSnapshot(s.id)
		}
		await saveIndex([])
		await saveActiveSceneId(null)
		set({
			scenes: [],
			activeSceneId: null,
			objects: [], history: [], historyIndex: -1,
			objectHistories: {}, objectHistoryIndex: {},
			selectedId: null, editingArrowId: null, editingArrowOriginal: null,
			tool: 'select'
		})
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
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { objects, history, historyIndex, objectHistories: get().objectHistories, objectHistoryIndex: get().objectHistoryIndex, safarize: get().safarize } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { objects, history, historyIndex, objectHistories: get().objectHistories, objectHistoryIndex: get().objectHistoryIndex, safarize: get().safarize })
		}
	},
	undo: () => {
		const { historyIndex, history, objectHistories, objectHistoryIndex } = get()
		if (historyIndex < 0) return
		const newIndex = historyIndex - 1
		const objects = newIndex >= 0 ? recomputeObjectsFromHistory(history, newIndex) : []
		set({ historyIndex: newIndex, objects, selectedId: null })
		const scene = get().getActiveScene()
		if (scene) {
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { ...s.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { ...scene.snapshot, historyIndex: newIndex, objects, objectHistories, objectHistoryIndex })
		}
	},
	redo: () => {
		const { historyIndex, history, objectHistories, objectHistoryIndex } = get()
		if (historyIndex >= history.length - 1) return
		const newIndex = historyIndex + 1
		const objects = recomputeObjectsFromHistory(history, newIndex)
		set({ historyIndex: newIndex, objects, selectedId: null })
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
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { objects, history: newHistory, historyIndex: newIndex, objectHistories, objectHistoryIndex } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { objects, history: newHistory, historyIndex: newIndex, objectHistories, objectHistoryIndex })
		}
	},
	logObjectChange: (id, label) => {
		const obj = get().objects.find(o => o.id === id)
		if (!obj) return
		const list = get().objectHistories[id] ?? []
		const newList = [...list.slice(0, (get().objectHistoryIndex[id] ?? list.length - 1) + 1), { id: uid(), label, at: Date.now(), state: JSON.parse(JSON.stringify(obj)) }]
		const objectHistories = { ...get().objectHistories, [id]: newList }
		const objectHistoryIndex = { ...get().objectHistoryIndex, [id]: newList.length - 1 }
		set({ objectHistories, objectHistoryIndex })
		const scene = get().getActiveScene()
		if (scene) {
			const snap = { ...scene.snapshot, objectHistories, objectHistoryIndex }
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
	},
	redoObject: (id) => {
		const list = get().objectHistories[id] ?? []
		if (list.length === 0) return
		const idx = (get().objectHistoryIndex[id] ?? list.length - 1)
		if (idx >= list.length - 1) return
		const newIdx = idx + 1
		const state = list[newIdx].state
		set({ objects: get().objects.map(o => o.id === id ? (JSON.parse(JSON.stringify(state)) as any) : o), objectHistoryIndex: { ...get().objectHistoryIndex, [id]: newIdx } })
	},
	editingArrowOriginal: null,
	editingArrowId: null,
	beginArrowEdit: (id) => {
		const arrow = get().objects.find(o => o.id === id && o.type === 'arrow') as ArrowObject | undefined
		if (arrow) set({ editingArrowOriginal: { ...arrow }, editingArrowId: id })
	},
	finishArrowEdit: (id) => {
		const { objects } = get()
		set({ editingArrowOriginal: null })
		get().logObjectChange(id, 'Изменено')
		const scene = get().getActiveScene()
		if (scene) {
			const scenes = get().scenes.map(s => s.id === scene.id ? ({ ...s, snapshot: { ...s.snapshot, objects } }) : s)
			set({ scenes })
			saveSnapshot(scene.id, { ...scene.snapshot, objects })
		}
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
	enterArrowEdit: (id) => set({ selectedId: id, editingArrowId: id }),
	exitArrowEdit: () => set({ editingArrowId: null }),
	setTool: (tool) => set({ tool, selectedId: null, drawingDraft: null }),
	startDrawing: (p) => {
		const tool = get().tool
		if (tool === 'select') return
		set({ drawingDraft: { type: tool as 'arrow' | 'rect' | 'mosaic', start: p, current: p } })
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
	setStrokeColor: (c) => set({ strokeColor: c }),
	setStrokeWidth: (w) => set({ strokeWidth: w }),
	setMosaicBlockSize: (b) => set({ mosaicBlockSize: Math.max(2, Math.round(b)) }),
	reset: () => set({ objects: [], selectedId: null, drawingDraft: null, history: [], historyIndex: -1, objectHistories: {}, objectHistoryIndex: {}, editingArrowId: null, editingArrowOriginal: null, scenes: [], activeSceneId: null }),
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