import http from 'node:http'
import express from 'express'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import QRCode from 'qrcode'
import { isConfigured, loadConfig, saveConfig } from './config.js'
import { listenOnFreePort } from './free-port.js'
import { parsePort } from './port.js'
import { getTunnelStatus, getTrafficStats, startTunnel, stopTunnel } from './tunnel.js'
import { currentVersion, getUpdateState, startUpdateChecks, stopUpdateChecks } from './update.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const LOOPBACK_HOST = '127.0.0.1'
const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const AUTHTOKEN_PATTERN = /^[A-Za-z0-9_-]{8,200}$/

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/** @param {string | undefined} value */
function hostnameOf(value) {
  if (!value) return null
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname
  } catch {
    return null
  }
}

/**
 * Schutz gegen DNS-Rebinding und Cross-Site-Requests: Die API ist nur für die
 * eigene Oberfläche gedacht, nicht für andere Webseiten im Browser des Nutzers.
 */
function localOnly(req, res, next) {
  const host = hostnameOf(req.headers.host)
  if (!host || !ALLOWED_HOSTNAMES.has(host)) {
    return res.status(403).json({ error: 'Zugriff verweigert.' })
  }

  const origin = req.headers.origin
  if (origin !== undefined) {
    const originHost = hostnameOf(origin)
    const sameOrigin = origin === `http://${req.headers.host}`
    if (!originHost || !ALLOWED_HOSTNAMES.has(originHost) || !sameOrigin) {
      return res.status(403).json({ error: 'Zugriff verweigert.' })
    }
  }

  next()
}

function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  next()
}

function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}

/** Wird von startServer gesetzt: darf die App überhaupt nach Updates fragen? */
let updateChecksAllowed = false

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(localOnly)
  app.use(express.json({ limit: '10kb' }))
  app.use(express.static(path.join(__dirname, 'public')))
  app.use('/api', noStore)

  app.get('/api/status', (_req, res) => {
    const config = loadConfig()
    res.json({
      configured: isConfigured(),
      defaultPort: config.defaultPort,
      tunnel: getTunnelStatus(),
      version: currentVersion,
      checkUpdates: config.checkUpdates,
      ipVersion: config.ipVersion,
      update: config.checkUpdates ? getUpdateState() : null,
    })
  })

  app.post('/api/config', (req, res) => {
    const { authtoken, defaultPort, checkUpdates } = req.body ?? {}
    const update = {}

    if (authtoken !== undefined) {
      const token = typeof authtoken === 'string' ? authtoken.trim() : ''
      if (!AUTHTOKEN_PATTERN.test(token)) {
        return res.status(400).json({ error: 'Der Authtoken sieht ungültig aus.' })
      }
      update.authtoken = token
    }

    if (defaultPort !== undefined) {
      try {
        update.defaultPort = parsePort(defaultPort)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }
    }

    if (checkUpdates !== undefined) {
      if (typeof checkUpdates !== 'boolean') {
        return res.status(400).json({ error: 'Ungültige Einstellung für Update-Suche.' })
      }
      update.checkUpdates = checkUpdates
    }

    const { persisted } = saveConfig(update)

    if (update.checkUpdates !== undefined && updateChecksAllowed) {
      if (update.checkUpdates) startUpdateChecks()
      else stopUpdateChecks()
    }

    res.json({ ok: true, configured: isConfigured(), persisted })
  })

  app.post('/api/tunnel/start', async (req, res) => {
    try {
      const status = await startTunnel(req.body?.port, req.body?.ipVersion)
      // Die zuletzt gewählte Adress-Variante wird für den nächsten Start gemerkt.
      saveConfig({ ipVersion: status.ipVersion })
      res.json(status)
    } catch (error) {
      res.status(400).json({ error: error.message ?? 'Tunnel-Start fehlgeschlagen.' })
    }
  })

  app.post('/api/tunnel/stop', async (_req, res) => {
    try {
      res.json(await stopTunnel())
    } catch {
      res.status(500).json({ error: 'Tunnel-Stopp fehlgeschlagen.' })
    }
  })

  app.get('/api/stats', (_req, res) => {
    res.json(getTrafficStats())
  })

  app.get('/api/qrcode', async (_req, res) => {
    const { url } = getTunnelStatus()
    if (!url) {
      return res.status(404).json({ error: 'Kein aktiver Tunnel.' })
    }

    try {
      const png = await QRCode.toBuffer(url, {
        type: 'png',
        width: 160,
        margin: 1,
        color: { dark: '#0c0c0c', light: '#ffffff' },
      })
      res.set('Content-Type', 'image/png')
      res.send(png)
    } catch {
      res.status(500).json({ error: 'QR-Code konnte nicht erzeugt werden.' })
    }
  })

  // JSON-Fehler statt Stacktrace (z. B. bei kaputtem oder zu großem Body).
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500
    res.status(status).json({ error: status === 413 ? 'Anfrage zu groß.' : 'Ungültige Anfrage.' })
  })

  return app
}

/**
 * Startet die Oberfläche – ausschließlich auf dem Loopback-Interface.
 * Standardmäßig auf einem zufälligen freien Port (kein typischer Dev-Port);
 * ein fester Port lässt sich mit `options.port` oder der Umgebungsvariable BURROW_PORT setzen.
 *
 * @param {{ port?: number | string, updateChecks?: boolean }} [options]
 */
export async function startServer(options = {}) {
  const server = http.createServer(createApp())
  const requested = options.port ?? process.env.BURROW_PORT

  let port
  if (requested !== undefined && String(requested).trim() !== '') {
    const wanted = parsePort(requested)
    port = await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(wanted, LOOPBACK_HOST, () => resolve(server.address().port))
    })
  } else {
    port = await listenOnFreePort(server, { host: LOOPBACK_HOST })
  }

  updateChecksAllowed = Boolean(options.updateChecks) && !process.env.BURROW_NO_UPDATE_CHECK
  if (updateChecksAllowed && loadConfig().checkUpdates) startUpdateChecks()
  server.on('close', stopUpdateChecks)

  return { port, server }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  startServer({ updateChecks: true }).then(({ port }) => {
    console.log(`\n  Burrow läuft auf http://localhost:${port}\n`)
    if (!isConfigured()) {
      console.log('  → Bitte ngrok-Authtoken in der Oberfläche hinterlegen')
      console.log('    (oder NGROK_AUTHTOKEN als Umgebungsvariable setzen).\n')
    }
  })

  const shutdown = async () => {
    await stopTunnel()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
