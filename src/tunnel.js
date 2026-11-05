import ngrok from '@ngrok/ngrok'
import { loadConfig } from './config.js'
import { parsePort } from './port.js'
import { createRequestProxy } from './proxy.js'

/** @type {import('@ngrok/ngrok').Listener | null} */
let activeListener = null

/** @type {Awaited<ReturnType<typeof createRequestProxy>> | null} */
let requestProxy = null

/** @type {{ url: string, port: number, startedAt: string } | null} */
let tunnelState = null

export function getTunnelStatus() {
  if (!activeListener || !tunnelState) {
    return { active: false, url: null, port: null, startedAt: null }
  }

  return {
    active: true,
    url: tunnelState.url,
    port: tunnelState.port,
    startedAt: tunnelState.startedAt,
  }
}

export function getTrafficStats() {
  return (
    requestProxy?.getStats() ?? {
      requests: 0,
      responses: 0,
      bytesIn: 0,
      bytesOut: 0,
      active: 0,
      history: { in: [], out: [], active: [] },
    }
  )
}

export async function startTunnel(port) {
  if (activeListener) {
    throw new Error('Es läuft bereits ein Tunnel. Stoppe ihn zuerst.')
  }

  const config = loadConfig()
  if (!config.authtoken?.trim()) {
    throw new Error('Kein ngrok Authtoken hinterlegt. Bitte zuerst Account verknüpfen.')
  }

  const hasPort = port !== undefined && port !== null && String(port).trim() !== ''
  const targetPort = hasPort ? parsePort(port) : config.defaultPort

  requestProxy = await createRequestProxy(targetPort)

  activeListener = await ngrok.forward({
    addr: requestProxy.port,
    authtoken: config.authtoken,
  })

  const url = activeListener.url()
  if (!url) {
    await stopTunnel()
    throw new Error('Tunnel konnte nicht gestartet werden.')
  }

  tunnelState = {
    url,
    port: targetPort,
    startedAt: new Date().toISOString(),
  }

  return getTunnelStatus()
}

export async function stopTunnel() {
  if (activeListener) {
    await activeListener.close()
    activeListener = null
  }

  if (requestProxy) {
    await requestProxy.close()
    requestProxy = null
  }

  tunnelState = null
  return getTunnelStatus()
}
