import { memo, useState } from 'react'
import { useEditorStore } from '../state/editorStore'

export const HistoryPanel = memo(() => {
  const objects = useEditorStore(s => s.objects)
  const selectedId = useEditorStore(s => s.selectedId)
  const objectHistories = useEditorStore(s => s.objectHistories)
  const objectHistoryIndex = useEditorStore(s => s.objectHistoryIndex)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const undoObject = useEditorStore(s => s.undoObject)
  const redoObject = useEditorStore(s => s.redoObject)
  const removeSelected = useEditorStore(s => s.removeSelected)
  const enterArrowEdit = useEditorStore(s => s.enterArrowEdit)
  const selectObject = useEditorStore(s => s.selectObject)

  const [collapsed, setCollapsed] = useState<boolean>(true)

  const titleFor = (type: string, idx: number) => {
    if (type === 'arrow') return `Стрелка`;
    if (type === 'rect') return `Рамка`;
    if (type === 'mosaic') return `Мозаика`;
    return `Элемент ${idx+1}`;
  }

  const onSelect = (id: string, type: string) => {
    selectObject(id)
    if (type === 'arrow') enterArrowEdit(id)
  }

  const onDelete = (id: string) => {
    selectObject(id)
    removeSelected()
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="История"
        style={{ position: 'absolute', right: 12, top: 12, width: 44, height: 44, borderRadius: 12, background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer' }}
      >
        ☰
      </button>
    )
  }

  return (
    <div style={{ position: 'absolute', right: 12, top: 12, width: 300, maxHeight: '65%', overflow: 'auto', background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>История</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={undo} title="Отменить">↶</button>
          <button onClick={redo} title="Повторить">↷</button>
          <button onClick={() => setCollapsed(true)} title="Скрыть" style={{ padding: '4px 8px' }}>Скрыть</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {objects.map((obj, idx) => {
          const isSel = selectedId === obj.id
          const list = objectHistories[obj.id] ?? []
          const idxObj = objectHistoryIndex[obj.id] ?? (list.length - 1)
          const canUndo = idxObj > 0
          const canRedo = idxObj < list.length - 1
          return (
            <div key={obj.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', background: isSel ? 'rgba(37,99,235,0.20)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
                <button onClick={() => onSelect(obj.id, obj.type)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }} title="Выбрать элемент">
                  {titleFor(obj.type, idx)}
                </button>
                <button onClick={() => undoObject(obj.id)} title="Отменить изменения" disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.5 }}>↶</button>
                <button onClick={() => redoObject(obj.id)} title="Вернуть изменения" disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.5 }}>↷</button>
                <button onClick={() => onDelete(obj.id)} title="Удалить" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M9 3h6m-9 4h12m-10 3v7m4-7v7m4-7v7M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
        {objects.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.6, textAlign: 'center', padding: '8px 0' }}>Нет элементов</div>
        )}
      </div>
    </div>
  )
}) 