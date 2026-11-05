// Erzeugt aus build/icon.svg:
//   build/icon.png      512 px (Fenster-Icon, Linux/macOS-Builds)
//   build/icon-256.png  256 px (README)
//   build/icon.ico      16–256 px (Windows: EXE, Installer, Desktop-Verknüpfung)
// Aufruf: npm run icons
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = (name) => path.join(root, 'build', name)
const svg = await readFile(out('icon.svg'))

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()

await writeFile(out('icon.png'), await render(512))
await writeFile(out('icon-256.png'), await render(256))

/** ICO-Container mit eingebetteten PNGs (ab Windows Vista unterstützt). */
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // Typ: Icon
  header.writeUInt16LE(images.length, 4)

  let offset = header.length + images.length * 16
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt16LE(1, 4) // Farbebenen
    entry.writeUInt16LE(32, 6) // Bit pro Pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)])
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await render(size) })))
await writeFile(out('icon.ico'), buildIco(images))

console.log('build/icon.png, build/icon-256.png, build/icon.ico erzeugt')
