import net from 'node:net'

/**
 * Dev-Server binden `localhost` je nach System an IPv4 (127.0.0.1), IPv6 (::1) oder beides.
 * Angular, Vite & Co. landen unter Windows oft nur auf ::1. Burrow probiert deshalb beide
 * Loopback-Adressen aus und nimmt die, auf der wirklich etwas lauscht.
 */
export const LOOPBACK_HOSTS = Object.freeze(['127.0.0.1', '::1'])

/**
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function canConnect(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/** Baut die Basis-URL; IPv6-Adressen brauchen eckige Klammern. */
export function targetUrl(host, port) {
  return `http://${host.includes(':') ? `[${host}]` : host}:${port}`
}

/**
 * Liefert eine Funktion, die den erreichbaren Loopback-Host für `port` findet (oder null).
 * Das Ergebnis wird kurz gemerkt, damit nicht jede Anfrage neu prüft; fällt der
 * Dev-Server aus oder startet er neu, wird automatisch neu gesucht.
 *
 * @param {number} port
 * @param {{ hosts?: readonly string[], cacheMs?: number, connect?: typeof canConnect, now?: () => number }} [options]
 */
export function createTargetResolver(port, options = {}) {
  const { hosts = LOOPBACK_HOSTS, cacheMs = 1500, connect = canConnect, now = Date.now } = options
  let cached = null
  let cachedAt = 0

  return async function resolveTargetHost() {
    if (cached && now() - cachedAt < cacheMs) return cached

    // Zuletzt funktionierenden Host zuerst probieren.
    const order = cached ? [cached, ...hosts.filter((host) => host !== cached)] : hosts
    for (const host of order) {
      if (await connect(host, port)) {
        cached = host
        cachedAt = now()
        return host
      }
    }

    cached = null
    return null
  }
}
