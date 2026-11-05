import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const saved = new Map()
globalThis.__editorSaved = saved
const result = ts.transpileModule(readFileSync('src/state/editorStore.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const require = createRequire(import.meta.url)
const persistence = {
  saveSnapshot: async (id, snap) => saved.set(id, structuredClone(snap)),
  saveStrokeColor: async color => saved.set('stroke-color', color),
  loadStrokeColor: async () => saved.get('stroke-color'),
  loadIndex: async () => [],
  loadActiveSceneId: async () => null,
  removeStoredScenes: async (ids, remaining, active) => saved.set('batch-delete', { ids, remaining, active }),
}
const module = { exports: {} }
new Function('require', 'module', 'exports', result.outputText)(
  id => id.includes('persistence') ? persistence : require(id), module, module.exports,
)
const { useEditorStore: store, getSceneCrop } = module.exports
const rect = { id: 'rect', type: 'rect', x: 10, y: 20, width: 100, height: 80, color: '#ff0000', strokeWidth: 3 }

test('moving, resizing and object undo persist the current scene', () => {
  store.getState().reset()
  store.setState({ activeSceneId: 'scene', scenes: [{ id: 'scene', title: 'Test', imageUrl: '', imageNatural: { width: 800, height: 600 }, snapshot: { objects: [], history: [], historyIndex: -1 } }] })
  const state = store.getState()
  state.applyChange({ id: 'add', label: 'Add', op: { type: 'add', object: rect } })
  state.logObjectChange('rect', 'Created')
  state.updateObjectLive('rect', { x: 50, width: 150 })
  state.logObjectChange('rect', 'Moved')
  assert.equal(saved.get('scene').objects[0].x, 50)
  assert.equal(saved.get('scene').objects[0].width, 150)
  state.undoObject('rect')
  assert.equal(saved.get('scene').objects[0].x, 10)
  state.redoObject('rect')
  assert.equal(saved.get('scene').objects[0].x, 50)
})

test('undoing an unrelated addition preserves the edited geometry', () => {
  const state = store.getState()
  state.applyChange({ id: 'second', label: 'Add', op: { type: 'add', object: { ...rect, id: 'second' } } })
  state.undo()
  assert.equal(store.getState().objects.length, 1)
  assert.equal(store.getState().objects[0].x, 50)
  state.redo()
  assert.equal(store.getState().objects.length, 2)
})

test('global undo keeps the object history cursor consistent', () => {
  const state = store.getState()
  state.updateObjectLive('rect', { x: 75 })
  state.logObjectChange('rect', 'Move again')
  state.undo()
  assert.equal(store.getState().objects[0].x, 50)
  const index = store.getState().objectHistoryIndex.rect
  assert.equal(store.getState().objectHistories.rect[index].state.x, 50)
  state.redo()
  assert.equal(store.getState().objects[0].x, 75)
})

test('crop survives persistence and can be undone without moving annotations', () => {
  const { setTool, setCropDraft, applyCropDraft, undo, redo, setCrop } = store.getState()
  const before = structuredClone(store.getState().objects)
  const crop = () => {
    const { history, historyIndex } = saved.get('scene')
    return getSceneCrop(history, historyIndex)
  }
  setTool('crop')
  assert.deepEqual(store.getState().cropDraft, { x: 0, y: 0, width: 800, height: 600 })
  setCropDraft({ x: 30, y: 20, width: 250, height: 130 })
  setTool('select')
  assert.equal(store.getState().cropDraft, null)
  assert.equal(crop(), null)
  setTool('crop')
  setCropDraft({ x: 20, y: 10, width: 200, height: 130 })
  assert.equal(crop(), null)
  applyCropDraft()
  assert.deepEqual(crop(), { x: 20, y: 10, width: 200, height: 130 })
  undo()
  assert.equal(crop(), null)
  assert.deepEqual(store.getState().objects, before)
  redo()
  assert.equal(crop().width, 200)
  setCrop(null)
  assert.equal(crop(), null)
  undo()
  assert.equal(crop().width, 200)
})

test('marker colors are saved per object and changing a marker can be undone', () => {
  const { setTool, startDrawing, setMarkerColor, setMarkerNumberColor, selectObject, undo, setSafariAddress, applyChange } = store.getState()
  setSafariAddress('example.test')
  const mask = { id: 'old-mask', type: 'redact', x: 10, y: 20, width: 21, height: 16 }
  applyChange({ id: 'old-mask-add', label: 'Mask', op: { type: 'add', object: mask } })
  setTool('marker')
  setMarkerColor('#b72e3e')
  setMarkerNumberColor('#ffc438')
  startDrawing({ x: 50, y: 50 })
  setMarkerNumberColor()
  setMarkerColor('#176f4b')
  startDrawing({ x: 80, y: 80 })
  const { objects, safariAddress } = saved.get('scene')
  const markers = objects.filter(obj => obj.type === 'marker')
  assert.deepEqual(markers.map(obj => [obj.number, obj.color]), [[1, '#b72e3e'], [2, '#176f4b']])
  assert.deepEqual(markers.map(obj => obj.numberColor), ['#ffc438', undefined])
  setTool('select')
  selectObject(markers[0].id)
  setMarkerColor('#6940a8')
  assert.equal(saved.get('scene').objects.find(obj => obj.id === markers[0].id).color, '#6940a8')
  undo()
  assert.equal(saved.get('scene').objects.find(obj => obj.id === markers[0].id).color, '#b72e3e')
  selectObject(markers[0].id)
  setMarkerNumberColor('#ffffff')
  assert.equal(saved.get('scene').objects.find(obj => obj.id === markers[0].id).numberColor, '#ffffff')
  undo()
  assert.equal(saved.get('scene').objects.find(obj => obj.id === markers[0].id).numberColor, '#ffc438')
  assert.deepEqual(saved.get('scene').objects.find(obj => obj.id === mask.id), mask)
  assert.equal(safariAddress, 'example.test')
})

test('selected styles persist, support undo, and leave drawing defaults alone', () => {
  const { setObjectStyle, undo, applyChange, strokeColor, strokeWidth, mosaicBlockSize } = store.getState()
  const original = store.getState().objects.find(obj => obj.id === rect.id)
  setObjectStyle(rect.id, { color: '#008844', strokeWidth: 8 })
  assert.deepEqual(saved.get('scene').objects.find(obj => obj.id === rect.id), { ...original, color: '#008844', strokeWidth: 8 })
  undo()
  assert.deepEqual(saved.get('scene').objects.find(obj => obj.id === rect.id), original)
  const mosaic = { id: 'mosaic', type: 'mosaic', x: 0, y: 0, width: 20, height: 20, blockSize: 12 }
  applyChange({ id: 'mosaic-add', label: 'Mosaic', op: { type: 'add', object: mosaic } })
  setObjectStyle(mosaic.id, { blockSize: 32 })
  assert.equal(saved.get('scene').objects.find(obj => obj.id === mosaic.id).blockSize, 32)
  undo()
  assert.deepEqual(saved.get('scene').objects.find(obj => obj.id === mosaic.id), mosaic)
  assert.deepEqual([store.getState().strokeColor, store.getState().strokeWidth, store.getState().mosaicBlockSize], [strokeColor, strokeWidth, mosaicBlockSize])
})

test('the confirmed drawing color is restored on hydration', async () => {
  store.getState().setStrokeColor('#bb3344')
  store.setState({ strokeColor: '#f99761' })
  await store.getState().hydrate()
  assert.equal(store.getState().strokeColor, '#bb3344')
})

test('text editing and spotlight placement survive saving and undo', () => {
  store.getState().reset()
  store.setState({ activeSceneId: 'annotations', scenes: [{ id: 'annotations', title: 'Test', imageUrl: '', imageNatural: { width: 800, height: 600 }, snapshot: { objects: [], history: [], historyIndex: -1 } }] })
  const { saveText, setTool, startDrawing, updateDrawing, commitDrawing, undo } = store.getState()
  const savedObjects = () => saved.get('annotations').objects
  saveText({ x: 10, y: 20 }, { text: 'Step 1', fontSize: 24, background: false, color: '#004488' })
  const original = savedObjects()[0]
  saveText(original.id, { text: 'Open settings', fontSize: 32, background: true, color: '#ffffff' })
  setTool('spotlight')
  startDrawing({ x: 80, y: 100 })
  updateDrawing({ x: 30, y: 40 })
  commitDrawing()
  assert.deepEqual(savedObjects()[0], { ...original, text: 'Open settings', fontSize: 32, background: true, color: '#ffffff' })
  const { type, x, y, width, height } = savedObjects()[1]
  assert.deepEqual({ type, x, y, width, height }, { type: 'spotlight', x: 30, y: 40, width: 50, height: 60 })
  undo()
  assert.equal(savedObjects().length, 1)
  undo()
  assert.deepEqual(savedObjects(), [original])
})

test('batch deletion keeps the next surviving scene and restores its settings', async () => {
  const imageNatural = { width: 100, height: 100 }
  const scenes = ['a', 'b', 'c', 'd'].map(id => ({
    id, title: id, imageUrl: '', imageNatural, snapshot: { objects: [], history: [], historyIndex: -1, safarize: id === 'c' },
  }))
  store.getState().reset()
  store.setState({ scenes, activeSceneId: 'b' })
  store.getState().setTool('crop')
  await store.getState().deleteScenes(['a', 'b'])
  assert.deepEqual(store.getState().scenes.map(scene => scene.id), ['c', 'd'])
  assert.equal(store.getState().activeSceneId, 'c')
  assert.equal(store.getState().safarize, true)
  assert.equal(store.getState().cropDraft, null)
  assert.deepEqual(saved.get('batch-delete'), {
    ids: ['a', 'b'], active: 'c', remaining: ['c', 'd'].map(id => ({ id, title: id, imageNatural })),
  })
})
