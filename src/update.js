import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Update-Erkennung über die GitHub-Releases-API. Es wird nichts automatisch
 * installiert: Burrow meldet nur, dass es eine neuere Version gibt, und verweist
 * auf die Release-Seite.
 */

const REPO = 'FlyingV111/burrow'
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASE_URL_PREFIX = `https://github.com/${REPO}/releases/`
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const currentVersion = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
).version

/**
 * Zerlegt „v1.2.3“ oder „1.2.3-beta.1“ in Zahlen + Vorabversions-Flag.
 * @param {string} value
 */
function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(value).trim())
  if (!match) return null
  return { parts: match.slice(1, 4).map(Number), prerelease: match[4] ?? null }
}

/**
 * @returns {number} >0 wenn a neuer als b ist, <0 wenn älter, 0 bei Gleichstand; NaN bei ungültigen Versionen
 */
export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return NaN

  for (let i = 0; i < 3; i++) {
    if (left.parts[i] !== right.parts[i]) return left.parts[i] - right.parts[i]
  }
  // 1.0.0 ist neuer als 1.0.0-beta
  if (left.prerelease === right.prerelease) return 0
  if (!left.prerelease) return 1
  if (!right.prerelease) return -1
  return left.prerelease < right.prerelease ? -1 : 1
}

/** @typedef {{ checked: boolean, available: boolean, current: string, latest: string | null, url: string | null, checkedAt: string | null }} UpdateState */

/** @returns {UpdateState} */
function emptyState() {
  return {
    checked: false,
    available: false,
    current: currentVersion,
    latest: null,
    url: null,
    checkedAt: null,
  }
}

/** @type {UpdateState} */
let state = emptyState()
/** @type {NodeJS.Timeout | null} */
let timer = null

export function getUpdateState() {
  return { ...state }
}

/**
 * Fragt das neueste Release ab. Schlägt die Abfrage fehl (offline, Rate-Limit …),
 * bleibt der bisherige Stand erhalten – ein Update-Check darf nie stören.
 *
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function checkForUpdate({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Burrow/${currentVersion}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return getUpdateState()

    const release = await response.json()
    if (release.draft || release.prerelease) return getUpdateState()

    const latest = String(release.tag_name ?? '').replace(/^v/, '')
    const url = String(release.html_url ?? '')
    // Nur Links auf die eigene Release-Seite zulassen.
    if (!url.startsWith(RELEASE_URL_PREFIX)) return getUpdateState()

    const comparison = compareVersions(latest, currentVersion)
    if (Number.isNaN(comparison)) return getUpdateState()

    state = {
      checked: true,
      available: comparison > 0,
      current: currentVersion,
      latest,
      url,
      checkedAt: new Date().toISOString(),
    }
  } catch {
    // offline o. Ä.: still bleiben
  }
  return getUpdateState()
}

/** Prüft sofort und danach alle 6 Stunden. */
export function startUpdateChecks(options) {
  stopUpdateChecks()
  checkForUpdate(options)
  timer = setInterval(() => checkForUpdate(options), CHECK_INTERVAL_MS)
  timer.unref()
}

export function stopUpdateChecks() {
  if (timer) clearInterval(timer)
  timer = null
}

/** Nur für Tests. */
export function resetUpdateState() {
  stopUpdateChecks()
  state = emptyState()
}
