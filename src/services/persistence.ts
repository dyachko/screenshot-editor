import { get, set, del } from 'idb-keyval'
import type { SceneSnapshot } from '../state/editorStore'

const INDEX_KEY = 'se:index'
const SNAP_PREFIX = 'se:snap:'
const BLOB_PREFIX = 'se:blob:'
const ACTIVE_KEY = 'se:active'

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

export async function deleteBlob(id: string): Promise<void> {
	await del(BLOB_PREFIX + id)
}

export async function loadSnapshot(id: string): Promise<SceneSnapshot | undefined> {
	return await get(SNAP_PREFIX + id)
}

export async function saveSnapshot(id: string, snapshot: SceneSnapshot): Promise<void> {
	await set(SNAP_PREFIX + id, snapshot)
}

export async function deleteSnapshot(id: string): Promise<void> {
	await del(SNAP_PREFIX + id)
}

export async function loadActiveSceneId(): Promise<string | null> {
	return (await get(ACTIVE_KEY)) ?? null
}

export async function saveActiveSceneId(id: string | null): Promise<void> {
	await set(ACTIVE_KEY, id)
} 