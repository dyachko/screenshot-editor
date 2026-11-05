export const SAFARI_PADDING = 48
export const SAFARI_RADIUS = 16

export function safariToolbarHeight(width: number) {
  if (width < 96) return 24
  if (width < 480) return 42
  return 72
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// All frame dimensions are in image pixels, shared by preview and export.
export function drawSafariFrame(ctx: Context, width: number, height: number, shadow: boolean, address = '') {
  const toolbarHeight = safariToolbarHeight(width)
  ctx.save()
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
  }
  ctx.fillStyle = '#f2f2f4'
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height + toolbarHeight, SAFARI_RADIUS)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height + toolbarHeight, SAFARI_RADIUS)
  ctx.clip()
  const glass = ctx.createLinearGradient(0, 0, 0, toolbarHeight)
  glass.addColorStop(0, '#fafafbcc')
  glass.addColorStop(1, '#e6e7ebee')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, width, toolbarHeight)
  const compact = width < 480
  const k = compact ? Math.min(1, width / 60) : Math.min(1, width / 640)
  ctx.scale(k, k)
  const w = width / k
  const cy = toolbarHeight / k / 2
  const line = (points: number[]) => {
    ctx.beginPath()
    ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
    ctx.stroke()
  }
  const pill = (x: number, y: number, pw: number, ph: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, ph / 2); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#64666c'
  }
  const addressText = (left: number, right: number, fontSize: number) => {
    let label = address.trim()
    if (!label || right - left < 18) return
    ctx.font = `${fontSize}px system-ui, sans-serif`
    if (ctx.measureText(label).width > right - left) {
      const chars = Array.from(label)
      do { chars.pop() } while (chars.length && ctx.measureText(chars.join('') + '…').width > right - left)
      label = chars.join('') + '…'
    }
    ctx.fillStyle = '#44464d'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, (left + right) / 2, cy)
  }
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ;['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(compact ? 14 + i * 13 : 23 + i * 20, cy, compact ? 4 : 6, 0, Math.PI * 2); ctx.fill()
  })
  if (compact) {
    if (width >= 96) {
      const showNav = width >= 192
      const addressX = showNav ? 88 : 54
      const addressEnd = width - (showNav ? 38 : 8)
      if (showNav) {
        pill(56, cy - 12, 24, 24)
        line([70, cy - 4, 66, cy, 70, cy + 4])
        pill(width - 32, cy - 12, 24, 24)
        line([width - 25, cy, width - 15, cy])
        line([width - 20, cy - 5, width - 20, cy + 5])
      }
      pill(addressX, cy - 13, addressEnd - addressX, 26)
      addressText(addressX + 8, addressEnd - 23, 11)
      const refreshX = addressEnd - 13
      ctx.beginPath(); ctx.arc(refreshX, cy, 4, 0.4, Math.PI * 1.85); ctx.stroke()
      line([refreshX + 4, cy - 4, refreshX + 4, cy - 1, refreshX + 1, cy - 1])
    }
    ctx.restore()
    return
  }
  pill(91, cy - 16, 36, 32)
  ctx.strokeRect(101, cy - 7, 16, 14)
  line([106, cy - 7, 106, cy + 7])
  pill(137, cy - 16, 66, 32)
  line([158, cy - 5, 153, cy, 158, cy + 5])
  line([181, cy - 5, 186, cy, 181, cy + 5])
  const ax = 220, aw = w - 360
  pill(ax, cy - 18, aw, 36)
  addressText(ax + 32, ax + aw - 32, 14)
  line([ax + 16, cy - 5, ax + 16, cy + 5, ax + 23, cy + 5])
  ctx.beginPath(); ctx.arc(ax + aw - 18, cy, 5, 0.4, Math.PI * 1.85); ctx.stroke()
  line([ax + aw - 13, cy - 5, ax + aw - 13, cy - 1, ax + aw - 17, cy - 1])
  pill(w - 122, cy - 16, 34, 32)
  line([w - 113, cy, w - 113, cy + 7, w - 97, cy + 7, w - 97, cy])
  line([w - 105, cy + 2, w - 105, cy - 8, w - 109, cy - 4])
  line([w - 105, cy - 8, w - 101, cy - 4])
  pill(w - 80, cy - 16, 34, 32)
  line([w - 69, cy, w - 57, cy]); line([w - 63, cy - 6, w - 63, cy + 6])
  pill(w - 38, cy - 16, 30, 32)
  ctx.strokeRect(w - 29, cy - 5, 11, 11)
  line([w - 25, cy - 8, w - 15, cy - 8, w - 15, cy + 2])
  ctx.restore()
}
