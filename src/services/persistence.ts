import { createStore, get, set, promisifyRequest } from 'idb-keyval'
import type { SceneSnapshot } from '../state/editorStore'

const INDEX_KEY = 'se:index'
const SNAP_PREFIX = 'se:snap:'
const BLOB_PREFIX = 'se:blob:'
const ACTIVE_KEY = 'se:active'
const STROKE_COLOR_KEY = 'se:stroke-color'

export async function loadStrokeColor(): Promise<string | undefined> {
	return await get(STROKE_COLOR_KEY)
}

export async function saveStrokeColor(color: string): Promise<void> {
	await set(STROKE_COLOR_KEY, color)
}

export interface SceneIndexItem {
	id: string
	title: string
	imageNatural: { width: number; height: number }
}

export async function loadIndex(): Promise<SceneIndexItem[]> {
	return (await get(INDEX_KEY)) ?? []
}

export async function saveIndex(items: SceneIndexItem[]): Promise<void> {
	await set(INDEX_KEY, items)
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
	return await get(BLOB_PREFIX + id)
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
	await set(BLOB_PREFIX + id, blob)
}

export async function loadSnapshot(id: string): Promise<SceneSnapshot | undefined> {
	return await get(SNAP_PREFIX + id)
}

export async function saveSnapshot(id: string, snapshot: SceneSnapshot): Promise<void> {
	await set(SNAP_PREFIX + id, snapshot)
}

let sceneStore: ReturnType<typeof createStore> | undefined

export async function removeStoredScenes(ids: string[], remaining: SceneIndexItem[], activeId: string | null): Promise<void> {
	// Use the same store as idb-keyval's default helpers.
	sceneStore ??= createStore('keyval-store', 'keyval')
	await sceneStore('readwrite', store => {
		for (const id of ids) {
			store.delete(BLOB_PREFIX + id)
			store.delete(SNAP_PREFIX + id)
		}
		store.put(remaining, INDEX_KEY)
		store.put(activeId, ACTIVE_KEY)
		return promisifyRequest(store.transaction)
	})
}

export async function loadActiveSceneId(): Promise<string | null> {
	return (await get(ACTIVE_KEY)) ?? null
}

export async function saveActiveSceneId(id: string | null): Promise<void> {
	await set(ACTIVE_KEY, id)
}
