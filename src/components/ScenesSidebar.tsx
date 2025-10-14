import { memo } from 'react'
import { useEditorStore } from '../state/editorStore'

export const ScenesSidebar = memo(() => {
  const scenes = useEditorStore(s => s.scenes)
  const activeSceneId = useEditorStore(s => s.activeSceneId)
  const switchScene = useEditorStore(s => s.switchScene)
  const deleteScene = useEditorStore(s => s.deleteScene)

  const handleDelete = (id: string) => {
    if (confirm('Удалить изображение? Действие необратимо.')) deleteScene(id)
  }

  return (
    <div style={{ position: 'absolute', left: 0, top: 56, bottom: 0, width: 220, padding: 8, background: 'rgba(20,20,20,0.9)', borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'auto' }}>
      <div style={{ fontSize: 12, opacity: 0.7, padding: '4px 6px' }}>Изображения</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenes.map(s => (
          <div key={s.id} style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: 6, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)', background: activeSceneId === s.id ? 'rgba(255,255,255,0.06)' : 'transparent'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => switchScene(s.id)} style={{ flex: 1, textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 12 }}>{s.title}</div>
              </button>
              <button title="Удалить" onClick={() => handleDelete(s.id)} style={{ fontSize: 12 }}>✕</button>
            </div>
            <button onClick={() => switchScene(s.id)} style={{ textAlign: 'left', cursor: 'pointer', padding: 0, borderRadius: 6, overflow: 'hidden', border: 'none', background: 'transparent' }}>
              <img src={s.imageUrl} alt={s.title} style={{ width: '100%', display: 'block', background: '#111' }} />
            </button>
          </div>
        ))}
        {scenes.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.6, padding: 6 }}>Нет изображений</div>
        )}
      </div>
    </div>
  )
}) 