// Erzeugt build/icon.png (512 px) aus build/icon.svg.  Aufruf: npm run icons
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(path.join(root, 'build', 'icon.svg'))

for (const size of [512, 256]) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
  const name = size === 512 ? 'icon.png' : 'icon-256.png'
  await writeFile(path.join(root, 'build', name), png)
  console.log(`build/${name} (${size}×${size})`)
}
