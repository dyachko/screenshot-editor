import { memo, useState } from 'react'

interface BottomActionsProps {
  onExport: () => void
  onCopy: () => Promise<boolean>
}

export const BottomActions = memo(({ onExport, onCopy }: BottomActionsProps) => {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleCopyClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await onCopy()
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 16,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'inline-flex',
        gap: 0,
        background: 'rgba(20,20,20,0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        backdropFilter: 'blur(8px)'
      }}>
        <button onClick={onExport} style={{
          padding: '10px 14px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer'
        }}>Экспорт PNG</button>
        <button onClick={handleCopyClick} disabled={busy} style={{
          padding: '10px 14px',
          background: 'transparent',
          color: 'white',
          border: 'none',
          cursor: busy ? 'default' : 'pointer'
        }}>{copied ? 'Скопировано' : 'Копировать в буфер'}</button>
      </div>
    </div>
  )
}) 