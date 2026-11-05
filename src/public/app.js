const $ = (sel) => document.querySelector(sel)

const setupSection = $('#setup-section')
const configForm = $('#config-form')
const authtokenInput = $('#authtoken')
const targetPortInput = $('#target-port')
const settingsPortInput = $('#settings-port')
const settingsUpdates = $('#settings-updates')
const settingsVersion = $('#settings-version')
const updatePill = $('#update-pill')
const startBtn = $('#start-btn')
const stopBtn = $('#stop-btn')
const homeView = $('#home-view')
const liveView = $('#live-view')
const settingsPanel = $('#settings-panel')
const settingsBtn = $('#settings-btn')
const settingsClose = $('#settings-close')
const settingsForm = $('#settings-form')
const settingsAuthtokenInput = $('#settings-authtoken')
const qrImage = $('#qr-image')
const tunnelUrl = $('#tunnel-url')
const copyBtn = $('#copy-btn')
const statInCount = $('#stat-in-count')
const statInSize = $('#stat-in-size')
const statOutCount = $('#stat-out-count')
const statOutSize = $('#stat-out-size')
const statActive = $('#stat-active')
const chartIn = $('#chart-in')
const chartOut = $('#chart-out')
const chartActive = $('#chart-active')
const statusBadge = $('#status-badge')
const toast = $('#toast')

let settingsOpen = false

/**
 * Port-Felder werden vom Server nur vorbelegt, solange der Nutzer nichts
 * eingegeben hat. Eigene Eingaben werden nie überschrieben oder korrigiert.
 */
function trackUserInput(input) {
  input.addEventListener('input', () => {
    input.dataset.dirty = '1'
  })
}

function syncPortInput(input, value) {
  input.placeholder = String(value)
  if (input.dataset.dirty || document.activeElement === input) return
  input.value = String(value)
}

function clearDirty(input) {
  delete input.dataset.dirty
}

trackUserInput(targetPortInput)
trackUserInput(settingsPortInput)

function truncateUrl(url, max = 44) {
  if (url.length <= max) return url
  const side = Math.floor((max - 1) / 2)
  return `${url.slice(0, side)}…${url.slice(-side)}`
}

function setTunnelUrl(url) {
  tunnelUrl.href = url
  tunnelUrl.dataset.url = url
  tunnelUrl.title = url
  tunnelUrl.textContent = truncateUrl(url)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function drawSparkline(svg, values) {
  const width = 100
  const height = 22
  const pad = 1
  const data = values?.length ? values : [0]
  const max = Math.max(...data, 1)

  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width
      const y = height - pad - (value / max) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const ns = 'http://www.w3.org/2000/svg'
  const baseline = document.createElementNS(ns, 'line')
  baseline.setAttribute('x1', '0')
  baseline.setAttribute('y1', String(height - pad))
  baseline.setAttribute('x2', String(width))
  baseline.setAttribute('y2', String(height - pad))

  const line = document.createElementNS(ns, 'polyline')
  line.setAttribute('points', points)

  svg.replaceChildren(baseline, line)
}

function renderStats(stats) {
  statInCount.textContent = String(stats.requests ?? 0)
  statInSize.textContent = formatBytes(stats.bytesIn ?? 0)
  statOutCount.textContent = String(stats.responses ?? 0)
  statOutSize.textContent = formatBytes(stats.bytesOut ?? 0)
  statActive.textContent = String(stats.active ?? 0)

  const history = stats.history ?? {}
  drawSparkline(chartIn, history.in)
  drawSparkline(chartOut, history.out)
  drawSparkline(chartActive, history.active)
}

async function refreshStats() {
  if (liveView.classList.contains('hidden')) return
  try {
    const res = await fetch('/api/stats')
    renderStats(await res.json())
  } catch {
    // ignore
  }
}

let toastTimer = 0

function showToast(message) {
  toast.textContent = message
  toast.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200)
}

function setBadge(mode, text) {
  statusBadge.className = `status status--${mode}`
  const dot = document.createElement('span')
  dot.className = 'status-dot'
  statusBadge.replaceChildren(dot, document.createTextNode(text))
}

function openSettings() {
  settingsOpen = true
  settingsPanel.classList.remove('hidden')
  homeView.classList.add('hidden')
  liveView.classList.add('hidden')
}

function closeSettings() {
  settingsOpen = false
  settingsPanel.classList.add('hidden')
  settingsAuthtokenInput.value = ''
}

function renderUpdate({ version, checkUpdates, update }) {
  if (version !== undefined) {
    settingsVersion.textContent = `Burrow ${version}`
    // Während die Einstellungen offen sind, nie unter den Fingern des Nutzers überschreiben.
    if (!settingsOpen) settingsUpdates.checked = checkUpdates !== false
  }

  // Antworten ohne Update-Info (z. B. nach Start/Stopp) lassen die Anzeige unverändert.
  if (update === undefined) return

  if (update?.available && update.url) {
    updatePill.href = update.url
    updatePill.title = `Version ${update.latest} ist verfügbar (du hast ${update.current})`
    updatePill.textContent = `Update ${update.latest}`
    updatePill.classList.remove('hidden')
  } else {
    updatePill.classList.add('hidden')
  }
}

function updateUI(data) {
  const { configured, defaultPort, tunnel } = data

  renderUpdate(data)

  if (defaultPort !== undefined) {
    syncPortInput(targetPortInput, defaultPort)
    syncPortInput(settingsPortInput, defaultPort)
  }

  if (configured) {
    setupSection.classList.add('hidden')
    settingsBtn.classList.remove('hidden')
    startBtn.disabled = tunnel.active
    targetPortInput.disabled = tunnel.active
  } else {
    setupSection.classList.remove('hidden')
    settingsBtn.classList.add('hidden')
    startBtn.disabled = true
    targetPortInput.disabled = false
    closeSettings()
    setBadge('setup', 'Token fehlt')
  }

  if (tunnel.active && tunnel.url) {
    closeSettings()
    homeView.classList.add('hidden')
    liveView.classList.remove('hidden')

    qrImage.src = `/api/qrcode?t=${Date.now()}`
    setTunnelUrl(tunnel.url)
    stopBtn.disabled = false
    setBadge('active', `Live · :${tunnel.port}`)
    refreshStats()
    return
  }

  liveView.classList.add('hidden')
  stopBtn.disabled = true

  if (settingsOpen && configured) {
    homeView.classList.add('hidden')
    return
  }

  if (configured) {
    homeView.classList.remove('hidden')
    setBadge('idle', 'Bereit')
  }
}

async function fetchStatus() {
  const res = await fetch('/api/status')
  return res.json()
}

async function refresh() {
  try {
    const data = await fetchStatus()
    updateUI(data)
  } catch {
    showToast('Verbindung verloren')
  }
}

function savedMessage(result, body) {
  return body.authtoken && !result.persisted ? 'Token gilt nur für diese Sitzung' : 'Gespeichert'
}

async function saveConfig(body) {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: true, persisted: data.persisted !== false }
  }

  const data = await res.json().catch(() => ({}))
  return { ok: false, error: data.error }
}

configForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const token = authtokenInput.value.trim()
  if (!token) {
    showToast('Token eingeben')
    return
  }

  const body = { authtoken: token }
  const portText = targetPortInput.value.trim()
  if (portText) body.defaultPort = portText

  const result = await saveConfig(body)
  if (result.ok) {
    authtokenInput.value = ''
    clearDirty(targetPortInput)
    showToast(savedMessage(result, body))
    await refresh()
  } else {
    showToast(result.error ?? 'Fehler beim Speichern')
  }
})

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const token = settingsAuthtokenInput.value.trim()

  const body = { defaultPort: settingsPortInput.value, checkUpdates: settingsUpdates.checked }
  if (token) body.authtoken = token

  const result = await saveConfig(body)
  if (result.ok) {
    settingsAuthtokenInput.value = ''
    clearDirty(settingsPortInput)
    clearDirty(targetPortInput)
    showToast(savedMessage(result, body))
    closeSettings()
    await refresh()
  } else {
    showToast(result.error ?? 'Fehler beim Speichern')
  }
})

settingsBtn.addEventListener('click', () => {
  openSettings()
  homeView.classList.add('hidden')
  liveView.classList.add('hidden')
})

settingsClose.addEventListener('click', async () => {
  closeSettings()
  await refresh()
})

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true
  startBtn.textContent = '…'

  const res = await fetch('/api/tunnel/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port: targetPortInput.value }),
  })

  const data = await res.json()
  startBtn.textContent = 'Starten'

  if (res.ok) {
    showToast('Tunnel läuft')
    updateUI({ configured: true, tunnel: data })
  } else {
    showToast(data.error ?? 'Start fehlgeschlagen')
    startBtn.disabled = false
  }
})

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true
  const res = await fetch('/api/tunnel/stop', { method: 'POST' })
  const data = await res.json()

  if (res.ok) {
    showToast('Gestoppt')
    updateUI({ configured: true, tunnel: data })
  } else {
    showToast('Stoppen fehlgeschlagen')
    stopBtn.disabled = false
  }
})

/** Fallback für Umgebungen, in denen die Clipboard-API gesperrt ist. */
function copyWithSelection(text) {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.className = 'copy-buffer'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyWithSelection(text)
  }
}

copyBtn.addEventListener('click', async () => {
  const url = tunnelUrl.dataset.url || tunnelUrl.href
  if (!url) return
  showToast((await copyText(url)) ? 'Kopiert' : 'Kopieren fehlgeschlagen')
})

refresh()
setInterval(refresh, 5000)
setInterval(refreshStats, 1000)
