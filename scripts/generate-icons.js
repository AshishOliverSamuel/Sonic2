const { createCanvas } = require('canvas')
const { writeFileSync, mkdirSync } = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const iconsDir = path.join(__dirname, '../public/icons')

try {
  mkdirSync(iconsDir, { recursive: true })
} catch (e) {}

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  const radius = size * 0.2
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.lineTo(size - radius, 0)
  ctx.quadraticCurveTo(size, 0, size, radius)
  ctx.lineTo(size, size - radius)
  ctx.quadraticCurveTo(size, size, size - radius, size)
  ctx.lineTo(radius, size)
  ctx.quadraticCurveTo(0, size, 0, size - radius)
  ctx.lineTo(0, radius)
  ctx.quadraticCurveTo(0, 0, radius, 0)
  ctx.closePath()
  ctx.fillStyle = '#2563eb'
  ctx.fill()

  // Letter S
  ctx.fillStyle = 'white'
  ctx.font = `bold ${size * 0.55}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('S', size / 2, size / 2)

  const filePath = path.join(iconsDir, `icon-${size}x${size}.png`)
  writeFileSync(filePath, canvas.toBuffer('image/png'))
  console.log(`Generated ${size}x${size} at ${filePath}`)
}
