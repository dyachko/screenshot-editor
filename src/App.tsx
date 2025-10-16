import { useCallback, useEffect, useRef } from 'react'
import JSZip from 'jszip'
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
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      onSelectFile(file)
    }
    e.currentTarget.value = ''
  }, [onSelectFile])

  const handleExport = useCallback(async () => {
    if (!activeScene) return
    const stage = useEditorStore.getState().stageRef
    if (stage) {
      // export at original image resolution by cropping to image area and scaling up
      const scale = useEditorStore.getState().viewScale || 1
      const { viewOffsetX, viewOffsetY } = useEditorStore.getState()
      const safarize = useEditorStore.getState().safarize
      const iw = activeScene.imageNatural.width
      const ih = activeScene.imageNatural.height
      const topBar = safarize ? 40 : 0 // must match CanvasStage topBarH
      const crop = safarize
        ? { x: viewOffsetX, y: viewOffsetY - topBar, width: iw * scale, height: ih * scale + topBar }
        : { x: viewOffsetX, y: viewOffsetY, width: iw * scale, height: ih * scale }
      // retry a few times to avoid rare empty frames
      const toDataUrlReliable = async () => {
        for (let i = 0; i < 3; i++) {
          const url = stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
          if (url && url.startsWith('data:image')) return url
          await new Promise(r => requestAnimationFrame(r))
        }
        return stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
      }
      const dataUrl = await toDataUrlReliable()
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
        // copy at original image resolution; include Safari frame if enabled
        const scale = useEditorStore.getState().viewScale || 1
        const { viewOffsetX, viewOffsetY } = useEditorStore.getState()
        const scene = activeScene
        if (!scene) return false
        const safarize = useEditorStore.getState().safarize
        const iw = scene.imageNatural.width
        const ih = scene.imageNatural.height
        const topBar = safarize ? 40 : 0
        const crop = safarize
          ? { x: viewOffsetX, y: viewOffsetY - topBar, width: iw * scale, height: ih * scale + topBar }
          : { x: viewOffsetX, y: viewOffsetY, width: iw * scale, height: ih * scale }
        const toDataUrlReliable = async () => {
          for (let i = 0; i < 3; i++) {
            const url = stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
            if (url && url.startsWith('data:image')) return url
            await new Promise(r => requestAnimationFrame(r))
          }
          return stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
        }
        const dataUrl = await toDataUrlReliable()
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

  const deleteAllScenes = useCallback(async () => {
    const ok = confirm('Удалить все изображения? Действие необратимо.')
    if (!ok) return
    await useEditorStore.getState().deleteAllScenes()
  }, [])

  const handleExportAll = useCallback(async () => {
    const state = useEditorStore.getState()
    const scenes = state.scenes
    if (scenes.length === 0) return
    const zip = new JSZip()
    const fmt = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    const stamp = `${now.getFullYear()}-${fmt(now.getMonth()+1)}-${fmt(now.getDate())}_${fmt(now.getHours())}-${fmt(now.getMinutes())}-${fmt(now.getSeconds())}`
    const digits = String(scenes.length).length
    const pad = (n: number) => String(n).padStart(digits, '0')
    const safe = (s: string) => s.replace(/\s+/g, ' ').trim()
    const addPng = async (filename: string, blob: Blob) => {
      zip.file(filename, blob)
    }
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
    const waitForSceneReady = async (sceneId: string) => {
      for (let i = 0; i < 40; i++) { // up to ~2s
        const st = useEditorStore.getState()
        if (st.activeSceneId === sceneId && st.stageRef && (st.viewScale || 0) > 0) {
          // give Konva a frame to draw
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
          return true
        }
        await sleep(50)
      }
      return false
    }

    const originalId = state.activeSceneId
    let index = 0
    for (const sc of scenes) {
      state.switchScene(sc.id)
      await waitForSceneReady(sc.id)
      const st = useEditorStore.getState()
      const stage = st.stageRef
      const baseName = `${pad(++index)}_${safe(sc.title || sc.id)}`
      if (stage) {
        const scale = st.viewScale || 1
        const { viewOffsetX, viewOffsetY } = st
        const safarize = st.safarize
        const iw = sc.imageNatural.width
        const ih = sc.imageNatural.height
        const topBar = safarize ? 40 : 0
        const crop = safarize
          ? { x: viewOffsetX, y: viewOffsetY - topBar, width: iw * scale, height: ih * scale + topBar }
          : { x: viewOffsetX, y: viewOffsetY, width: iw * scale, height: ih * scale }
        const toDataUrlReliable = async () => {
          for (let i = 0; i < 3; i++) {
            const url = stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
            if (url && url.startsWith('data:image')) return url
            await new Promise(r => requestAnimationFrame(r))
          }
          return stage.toDataURL({ ...crop, pixelRatio: Math.max(1, 1 / Math.max(scale, 1e-6)) })
        }
        const dataUrl = await toDataUrlReliable()
        const blob = await (await fetch(dataUrl)).blob()
        await addPng(`${baseName}.png`, blob)
      } else {
        const blob = await (await fetch(sc.imageUrl)).blob()
        await addPng(`${baseName}.png`, blob)
      }
    }
    if (originalId) { state.switchScene(originalId); await new Promise(r => requestAnimationFrame(r)) }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zipBlob)
    a.download = `screenshots_${stamp}.zip`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(a.href)
    document.body.removeChild(a)
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
      <div style={{ flex: 1, minHeight: 0, position: 'relative', paddingLeft: scenesCount > 1 ? 220 : 0, paddingBottom: 88 }}>
        {scenesCount > 1 && <ScenesSidebar />}
        <CanvasStage imageUrl={activeScene?.imageUrl ?? null} />
        <HistoryPanel />
        <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 12, opacity: 0.6, color: '#aaa', pointerEvents: 'none' }}>v1.0.3</div>
      </div>
      <BottomActions onExport={handleExport} onCopy={handleCopy} onExportAll={scenesCount > 0 ? handleExportAll : undefined} onDeleteAll={scenesCount > 0 ? deleteAllScenes : undefined} />
      </div>
  )
}

export default App
