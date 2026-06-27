import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(resolve(__dirname, '../public/icon.svg'))
const outDir = resolve(__dirname, '../public/icons')

mkdirSync(outDir, { recursive: true })

for (const size of [16, 48, 128]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`${outDir}/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}
