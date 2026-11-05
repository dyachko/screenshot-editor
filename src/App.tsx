import { useCallback, useEffect, useRef } from 'react'
import JSZip from 'jszip'
import './App.css'
import { Toolbar } from './components/Toolbar'
import { CanvasStage } from './components/CanvasStage'
import { exportScenePNG } from './services/exporter'
import { getSceneCrop, useEditorStore } from './state/editorStore'
import { BottomActions } from './components/BottomActions'
import { HistoryPanel } from './components/HistoryPanel'
import { ScenesSidebar } from './components/ScenesSidebar'

async function renderScene(scene: import('./state/editorStore').SceneMeta) {
  const state = useEditorStore.getState()
  const snapshot = scene.id === state.activeSceneId ? state : scene.snapshot
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Не удалось загрузить изображение'))
    image.src = scene.imageUrl
  })
  return exportScenePNG({
    image, objects: snapshot.objects, safarize: snapshot.safarize, safariShadow: snapshot.safariShadow,
    safariAddress: scene.snapshot.safariAddress, crop: getSceneCrop(snapshot.history, snapshot.historyIndex),
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const addScene = useEditorStore(s => s.addScene)
  const scenesCount = useEditorStore(s => s.scenes.length)
  const activeScene = useEditorStore(s => s.scenes.find(sc => sc.id === s.activeSceneId) ?? null)
  const hydrate = useEditorStore(s => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const onSelectFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/') && file.type !== '') return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      addScene({ imageUrl: url, imageNatural: { width: img.naturalWidth, height: img.naturalHeight }, title: (file as any).name || 'Вставленное изображение' })
    }
    img.src = url
  }, [addScene])

  const onPaste = useCallback(async (e: ClipboardEvent) => {
    const cd = e.clipboardData
    if (!cd) return
    if (cd.items && cd.items.length > 0) {
      for (let i = 0; i < cd.items.length; i++) {
        const it = cd.items[i]
        if (it.kind === 'file' && (it.type.startsWith('image/') || it.type === '')) {
          const file = it.getAsFile()
          if (file) { onSelectFile(file); return }
        }
      }
    }
    if (cd.files && cd.files.length > 0) {
      for (let i = 0; i < cd.files.length; i++) {
        const f = cd.files[i]
        if ((f.type && f.type.startsWith('image/')) || f.type === '') { onSelectFile(f); return }
      }
    }
  }, [onSelectFile])

  useEffect(() => {
    const handler = (e: any) => onPaste(e as ClipboardEvent)
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onPaste])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      onSelectFile(file)
    }
    e.currentTarget.value = ''
  }, [onSelectFile])

  const handleExport = useCallback(async () => {
    if (activeScene) download(await renderScene(activeScene), 'screenshot.png')
  }, [activeScene])

  const handleCopy = useCallback(async (): Promise<boolean> => {
    if (!activeScene) return false
    try {
      // Start the clipboard write during the click, before image decoding completes.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderScene(activeScene) })])
      return true
    } catch (error) { console.error(error); return false }
  }, [activeScene])

  const handleExportSelected = useCallback(async (ids: string[]) => {
    const selected = new Set(ids)
    const scenes = useEditorStore.getState().scenes.filter(scene => selected.has(scene.id))
    if (scenes.length === 0) return
    const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').replace(/\.[a-z0-9]+$/i, '').trim() || 'screenshot'
    if (scenes.length === 1) {
      download(await renderScene(scenes[0]), `${safe(scenes[0].title)}.png`)
      return
    }
    const zip = new JSZip()
    const fmt = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    const stamp = `${now.getFullYear()}-${fmt(now.getMonth()+1)}-${fmt(now.getDate())}_${fmt(now.getHours())}-${fmt(now.getMinutes())}-${fmt(now.getSeconds())}`
    const digits = String(scenes.length).length
    const pad = (n: number) => String(n).padStart(digits, '0')
    let index = 0
    for (const sc of scenes) {
      const baseName = `${pad(++index)}_${safe(sc.title || sc.id)}`
      zip.file(`${baseName}.png`, await renderScene(sc))
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    download(zipBlob, `screenshots_${stamp}.zip`)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar onUpload={handleUploadClick} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div className={scenesCount > 0 ? 'editor-workspace editor-workspace--scenes' : 'editor-workspace'}>
        {scenesCount > 0 && <ScenesSidebar onExportSelected={handleExportSelected} />}
        <CanvasStage key={activeScene?.id} imageUrl={activeScene?.imageUrl ?? null} onExport={handleExport} />
        <HistoryPanel />
        <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 12, opacity: 0.6, color: '#aaa', pointerEvents: 'none' }}>v1.1.0</div>
      </div>
      <BottomActions onExport={handleExport} onCopy={handleCopy} />
      </div>
  )
}

export default App
