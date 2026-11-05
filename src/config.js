import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { IP_VERSIONS } from './target-host.js'

/**
 * Einstellungen + Authtoken.
 *
 * Der Authtoken wird nie im Klartext auf die Platte geschrieben. Die Electron-App
 * stellt dafür über `setSecretCodec` eine Verschlüsselung (OS-Keystore / DPAPI)
 * bereit. Ohne Codec (z. B. `npm run server`) bleibt der Token nur im Speicher
 * oder kommt aus der Umgebungsvariable NGROK_AUTHTOKEN.
 */

const APP_DIR = '.burrow'
const LEGACY_DIRS = ['.tunnel', '.mitn']
const TOKEN_FORMAT = 1

const DEFAULT_CONFIG = Object.freeze({
  defaultPort: 3000,
  checkUpdates: true,
  ipVersion: 'auto',
})

/**
 * @typedef {object} SecretCodec
 * @property {() => boolean} isAvailable
 * @property {(plain: string) => string} encrypt  Klartext -> base64
 * @property {(cipher: string) => string} decrypt base64 -> Klartext
 */

/** @type {SecretCodec | null} */
let codec = null
/** Token, der nicht persistiert werden konnte (nur für diese Sitzung). */
let sessionToken = ''

/** @param {SecretCodec | null} next */
export function setSecretCodec(next) {
  codec = next
}

function configDir() {
  return path.join(process.env.BURROW_HOME || os.homedir(), APP_DIR)
}

function configFile() {
  return path.join(configDir(), 'config.json')
}

function legacyFiles() {
  const base = process.env.BURROW_HOME || os.homedir()
  return LEGACY_DIRS.map((dir) => path.join(base, dir, 'config.json'))
}

function canEncrypt() {
  return Boolean(codec?.isAvailable())
}

function ensureConfigDir() {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 })
}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Atomar schreiben, nur für den aktuellen Nutzer lesbar. */
function writeJson(file, data) {
  ensureConfigDir()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
}

function decryptToken(stored) {
  if (typeof stored === 'string') return stored // Altformat: Klartext
  if (stored?.v === TOKEN_FORMAT && typeof stored.data === 'string' && canEncrypt()) {
    try {
      return codec.decrypt(stored.data)
    } catch {
      return ''
    }
  }
  return ''
}

function encryptToken(token) {
  return { v: TOKEN_FORMAT, data: codec.encrypt(token) }
}

/**
 * Übernimmt einen Klartext-Token aus den Vorgänger-Versionen (~/.tunnel, ~/.mitn)
 * in den verschlüsselten Speicher und entfernt ihn danach aus den alten Dateien.
 */
function migrateLegacy() {
  if (!canEncrypt()) return

  for (const file of legacyFiles()) {
    const legacy = readJson(file)
    if (!legacy) continue

    const token = typeof legacy.authtoken === 'string' ? legacy.authtoken.trim() : ''
    const current = readJson(configFile()) ?? {}

    if (token && !current.authtoken) {
      const next = { ...DEFAULT_CONFIG, ...current }
      if (Number.isInteger(legacy.defaultPort) && current.defaultPort === undefined) {
        next.defaultPort = legacy.defaultPort
      }
      next.authtoken = encryptToken(token)
      writeJson(configFile(), next)
    }

    // Klartext-Token aus der alten Datei entfernen, aber nur wenn er sicher übernommen wurde.
    if (token && decryptToken(readJson(configFile())?.authtoken) === token) {
      const { authtoken: _removed, ...rest } = legacy
      writeJson(file, rest)
    }
  }
}

/** Interne Sicht inkl. entschlüsseltem Token. Niemals an Clients ausliefern. */
export function loadConfig() {
  migrateLegacy()

  const stored = readJson(configFile()) ?? {}
  const authtoken =
    decryptToken(stored.authtoken) || sessionToken || (process.env.NGROK_AUTHTOKEN ?? '').trim()

  return {
    defaultPort: Number.isInteger(stored.defaultPort)
      ? stored.defaultPort
      : DEFAULT_CONFIG.defaultPort,
    checkUpdates:
      typeof stored.checkUpdates === 'boolean' ? stored.checkUpdates : DEFAULT_CONFIG.checkUpdates,
    ipVersion: IP_VERSIONS.includes(stored.ipVersion) ? stored.ipVersion : DEFAULT_CONFIG.ipVersion,
    authtoken,
  }
}

/**
 * @param {{ authtoken?: string, defaultPort?: number, checkUpdates?: boolean, ipVersion?: 'auto' | '4' | '6' }} partial
 * @returns {{ persisted: boolean }} persisted=false: Token nur im Speicher gehalten
 */
export function saveConfig(partial) {
  const stored = readJson(configFile()) ?? {}
  const next = {
    defaultPort: Number.isInteger(stored.defaultPort)
      ? stored.defaultPort
      : DEFAULT_CONFIG.defaultPort,
    checkUpdates:
      typeof stored.checkUpdates === 'boolean' ? stored.checkUpdates : DEFAULT_CONFIG.checkUpdates,
    ipVersion: IP_VERSIONS.includes(stored.ipVersion) ? stored.ipVersion : DEFAULT_CONFIG.ipVersion,
  }
  if (stored.authtoken && typeof stored.authtoken === 'object') next.authtoken = stored.authtoken

  let persisted = true

  if (partial.defaultPort !== undefined) next.defaultPort = partial.defaultPort
  if (partial.checkUpdates !== undefined) next.checkUpdates = partial.checkUpdates
  if (partial.ipVersion !== undefined) next.ipVersion = partial.ipVersion

  if (partial.authtoken !== undefined) {
    if (canEncrypt()) {
      next.authtoken = encryptToken(partial.authtoken)
      sessionToken = ''
    } else {
      sessionToken = partial.authtoken
      delete next.authtoken
      persisted = false
    }
  }

  writeJson(configFile(), next)
  return { persisted }
}

export function isConfigured() {
  return Boolean(loadConfig().authtoken)
}

export function getConfigPath() {
  return configFile()
}
