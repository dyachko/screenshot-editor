import { useCallback, useEffect, useRef } from 'react'
import './App.css'
import { Toolbar } from './components/Toolbar'
import { CanvasStage } from './components/CanvasStage'
import { exportScenePNG } from './services/exporter'
import { useEditorStore } from './state/editorStore'
import { BottomActions } from './components/BottomActions'
import { HistoryPanel } from './components/HistoryPanel'
import { ScenesSidebar } from './components/ScenesSidebar'

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
    const file = e.target.files?.[0]
    if (file) onSelectFile(file)
    e.currentTarget.value = ''
  }, [onSelectFile])

  const handleExport = useCallback(async () => {
    if (!activeScene) return
    const stage = useEditorStore.getState().stageRef
    if (stage) {
      // exact stage snapshot
      const dataUrl = stage.toDataURL({ pixelRatio: 1 })
      const blob = await (await fetch(dataUrl)).blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'screenshot.png'
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(a.href)
      document.body.removeChild(a)
      return
    }
    // fallback
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const done = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
    })
    img.src = activeScene.imageUrl
    const loaded = await done
    const objects = useEditorStore.getState().objects
    const stageScale = useEditorStore.getState().viewScale
    const { viewOffsetX, viewOffsetY } = useEditorStore.getState()
    await exportScenePNG({ image: loaded, objects, filename: 'screenshot.png', stageScale, offsetX: viewOffsetX, offsetY: viewOffsetY })
  }, [activeScene])

  const handleCopy = useCallback(async (): Promise<boolean> => {
    try {
      const stage = useEditorStore.getState().stageRef
      if (stage) {
        const dataUrl = stage.toDataURL({ pixelRatio: 1 })
        const blob = await (await fetch(dataUrl)).blob()
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        return true
      }
      const scene = activeScene
      if (!scene) return false
      const img = new Image(); img.crossOrigin = 'anonymous'
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = scene.imageUrl })
      const off = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
      const ctx = off.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const state = useEditorStore.getState()
      for (const obj of state.objects) {
        if (obj.type === 'mosaic') {
          const { x, y, width, height, blockSize } = obj
          const anchorX = ((x % blockSize) + blockSize) % blockSize
          const anchorY = ((y % blockSize) + blockSize) % blockSize
          const sx = x - anchorX
          const sy = y - anchorY
          const sw = width + anchorX
          const sh = height + anchorY
          const cols = Math.max(1, Math.round(sw / blockSize))
          const rows = Math.max(1, Math.round(sh / blockSize))
          const src = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
          const srcCtx = src.getContext('2d')!
          srcCtx.drawImage(img, 0, 0)
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
          for (let rIdx = 0; rIdx < rows; rIdx++) {
            for (let cIdx = 0; cIdx < cols; cIdx++) {
              const px = sx + cIdx * blockSize
              const py = sy + rIdx * blockSize
              const data = srcCtx.getImageData(Math.min(src.width - 1, Math.max(0, Math.floor(px))), Math.min(src.height - 1, Math.max(0, Math.floor(py))), 1, 1).data
              const a = data[3] / 255
              ctx.fillStyle = `rgba(${data[0]},${data[1]},${data[2]},${a})`
              ctx.fillRect(px, py, blockSize, blockSize)
            }
          }
          ctx.restore()
        }
      }
      ctx.imageSmoothingEnabled = true
      for (const obj of state.objects) {
        if (obj.type === 'rect') {
          ctx.strokeStyle = obj.color as any; ctx.lineWidth = obj.strokeWidth; ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)
        } else if (obj.type === 'arrow') {
          ctx.strokeStyle = obj.color as any; ctx.fillStyle = obj.color as any; ctx.lineWidth = obj.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
          ctx.beginPath(); ctx.moveTo(obj.start.x, obj.start.y); (ctx as any).quadraticCurveTo(obj.control.x, obj.control.y, obj.end.x, obj.end.y); ctx.stroke()
          const angle = Math.atan2(obj.end.y - obj.control.y, obj.end.x - obj.control.x)
          const head = 8 + obj.strokeWidth
          ctx.beginPath(); ctx.moveTo(obj.end.x, obj.end.y)
          ctx.lineTo(obj.end.x - head * Math.cos(angle - Math.PI/6), obj.end.y - head * Math.sin(angle - Math.PI/6))
          ctx.lineTo(obj.end.x - head * Math.cos(angle + Math.PI/6), obj.end.y - head * Math.sin(angle + Math.PI/6))
          ctx.closePath(); ctx.fill()
        }
      }
      const blob = await off.convertToBlob({ type: 'image/png' })
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      return true
    } catch (e) { console.error(e); return false }
  }, [activeScene])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar onUpload={handleUploadClick} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div style={{ flex: 1, minHeight: 0, position: 'relative', paddingLeft: scenesCount > 1 ? 220 : 0, paddingBottom: 88 }}>
        {scenesCount > 1 && <ScenesSidebar />}
        <CanvasStage imageUrl={activeScene?.imageUrl ?? null} />
        <HistoryPanel />
        <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 12, opacity: 0.6, color: '#aaa', pointerEvents: 'none' }}>v0.0.6</div>
      </div>
      <BottomActions onExport={handleExport} onCopy={handleCopy} />
      </div>
  )
}

export default App
