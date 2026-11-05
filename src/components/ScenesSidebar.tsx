import { memo, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../state/editorStore'

export const ScenesSidebar = memo(({ onExportSelected }: { onExportSelected: (ids: string[]) => Promise<void> }) => {
  const scenes = useEditorStore(s => s.scenes)
  const activeSceneId = useEditorStore(s => s.activeSceneId)
  const switchScene = useEditorStore(s => s.switchScene)
  const deleteScenes = useEditorStore(s => s.deleteScenes)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<'delete' | 'export' | null>(null)
  const [error, setError] = useState('')
  const selectAll = useRef<HTMLInputElement>(null)
  const selected = scenes.filter(scene => checked.has(scene.id)).map(scene => scene.id)
  const allSelected = selected.length === scenes.length
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selected.length > 0 && !allSelected
  }, [selected.length, allSelected])

  const run = async (action: 'delete' | 'export') => {
    if (busy || selected.length === 0) return
    if (action === 'delete' && !confirm(`Удалить выбранные изображения (${selected.length})? Действие необратимо.`)) return
    setBusy(action)
    setError('')
    try {
      if (action === 'export') await onExportSelected(selected)
      else {
        await deleteScenes(selected)
        setChecked(new Set())
      }
    } catch (error) {
      console.error(error)
      setError(action === 'delete' ? 'Не удалось удалить изображения.' : 'Не удалось экспортировать изображения.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <aside className="scenes-sidebar" aria-label="Изображения">
      <div className="scenes-sidebar-controls">
        <label className="scenes-select-all">
          <input ref={selectAll} type="checkbox" checked={allSelected} disabled={!!busy}
            onChange={event => setChecked(new Set(event.target.checked ? scenes.map(scene => scene.id) : []))} />
          Выбрать все
          <span aria-label={`Выбрано ${selected.length} из ${scenes.length}`}>{selected.length}/{scenes.length}</span>
        </label>
        <div className="scenes-sidebar-actions">
          <button type="button" disabled={!!busy || !selected.length} onClick={() => void run('export')}>
            {busy === 'export' ? 'Экспорт…' : 'Экспортировать выбранные'}
          </button>
          <button type="button" disabled={!!busy || !selected.length} onClick={() => void run('delete')}>
            {busy === 'delete' ? 'Удаление…' : 'Удалить выбранные'}
          </button>
        </div>
        {error && <div className="scenes-sidebar-error" role="alert">{error}</div>}
      </div>
      <ul className="scenes-list">
        {scenes.map(scene => (
          <li key={scene.id} data-active={activeSceneId === scene.id} data-selected={checked.has(scene.id)}>
            <input type="checkbox" aria-label={`Выбрать ${scene.title}`} checked={checked.has(scene.id)}
              disabled={!!busy} onChange={event => {
                const marked = event.target.checked
                setChecked(previous => {
                  const next = new Set(previous)
                  if (marked) next.add(scene.id)
                  else next.delete(scene.id)
                  return next
                })
              }} />
            <button type="button" aria-current={activeSceneId === scene.id ? 'true' : undefined}
              title={scene.title} disabled={busy === 'delete'} onClick={() => switchScene(scene.id)}>
              <span>{scene.title}</span>
              <img src={scene.imageUrl} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
})
