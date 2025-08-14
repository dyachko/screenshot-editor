export function IconMosaic({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" fill="currentColor"/>
      <rect x="10" y="3" width="4" height="4" fill="currentColor" opacity="0.8"/>
      <rect x="16" y="3" width="5" height="5" fill="currentColor" opacity="0.6"/>
      <rect x="3" y="10" width="4" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="9" y="10" width="6" height="6" fill="currentColor"/>
      <rect x="16" y="11" width="4" height="4" fill="currentColor" opacity="0.75"/>
      <rect x="4" y="17" width="5" height="5" fill="currentColor" opacity="0.9"/>
      <rect x="12" y="18" width="5" height="5" fill="currentColor"/>
    </svg>
  )
} 