export function IconRect({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth="2" rx="2"/>
    </svg>
  )
} 