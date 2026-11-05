import http from 'node:http'
import { createRequire } from 'node:module'

import { listenOnFreePort } from './free-port.js'

const require = createRequire(import.meta.url)
const httpProxy = require('http-proxy')

const HISTORY_SIZE = 40

/** @param {number} targetPort */
export async function createRequestProxy(targetPort) {
  const stats = {
    requests: 0,
    responses: 0,
    bytesIn: 0,
    bytesOut: 0,
    active: 0,
  }

  const history = {
    in: Array(HISTORY_SIZE).fill(0),
    out: Array(HISTORY_SIZE).fill(0),
    active: Array(HISTORY_SIZE).fill(0),
  }

  let lastBytesIn = 0
  let lastBytesOut = 0

  const sampleTimer = setInterval(() => {
    const deltaIn = stats.bytesIn - lastBytesIn
    const deltaOut = stats.bytesOut - lastBytesOut
    lastBytesIn = stats.bytesIn
    lastBytesOut = stats.bytesOut

    history.in.push(deltaIn)
    history.out.push(deltaOut)
    history.active.push(stats.active)

    if (history.in.length > HISTORY_SIZE) history.in.shift()
    if (history.out.length > HISTORY_SIZE) history.out.shift()
    if (history.active.length > HISTORY_SIZE) history.active.shift()
  }, 1000)

  function trackIncoming(size) {
    stats.bytesIn += size
  }

  function trackOutgoing(size) {
    stats.bytesOut += size
  }

  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${targetPort}`,
    ws: true,
    xfwd: true,
  })

  proxy.on('proxyReq', (_proxyReq, req) => {
    const length = Number(req.headers['content-length'])
    if (Number.isFinite(length) && length > 0) {
      trackIncoming(length)
    }

    req.on('data', (chunk) => trackIncoming(chunk.length))
  })

  proxy.on('proxyRes', (proxyRes, _req) => {
    stats.responses++

    const length = Number(proxyRes.headers['content-length'])
    if (Number.isFinite(length) && length > 0) {
      trackOutgoing(length)
    }

    proxyRes.on('data', (chunk) => trackOutgoing(chunk.length))
    proxyRes.on('end', () => {
      stats.active = Math.max(0, stats.active - 1)
    })
  })

  proxy.on('error', (_err, req, res) => {
    if (req) stats.active = Math.max(0, stats.active - 1)
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Bad Gateway')
    }
  })

  const server = http.createServer((req, res) => {
    stats.requests++
    stats.active++
    proxy.web(req, res)
  })

  server.on('upgrade', (req, socket, head) => {
    stats.requests++
    stats.active++

    socket.on('data', (chunk) => trackIncoming(chunk.length))
    socket.on('close', () => {
      stats.active = Math.max(0, stats.active - 1)
    })

    proxy.ws(req, socket, head)
  })

  proxy.on('open', (proxySocket) => {
    proxySocket.on('data', (chunk) => trackOutgoing(chunk.length))
  })

  // Freien Port selbst wählen – nie den Ziel-Port, damit dein Dev-Server ihn noch bekommt.
  let port
  try {
    port = await listenOnFreePort(server, { exclude: [targetPort] })
  } catch (error) {
    clearInterval(sampleTimer)
    proxy.close()
    throw error
  }

  return {
    port,
    getStats: () => ({
      ...stats,
      history: {
        in: [...history.in],
        out: [...history.out],
        active: [...history.active],
      },
    }),
    close: () =>
      new Promise((closeResolve) => {
        clearInterval(sampleTimer)
        server.close(() => closeResolve())
        proxy.close()
      }),
  }
}
