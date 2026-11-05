import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.BURROW_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-test-'))
delete process.env.NGROK_AUTHTOKEN

const { startServer } = await import('../src/server.js')
const { port, server } = await startServer()
const base = `http://127.0.0.1:${port}`

const post = (url, body, headers = {}) =>
  fetch(base + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

test.after(() => {
  server.close()
  fs.rmSync(process.env.BURROW_HOME, { recursive: true, force: true })
})

test('lauscht nur auf dem Loopback-Interface', () => {
  assert.equal(server.address().address, '127.0.0.1')
})

test('wählt einen freien Port abseits der typischen Dev-Ports', () => {
  assert.ok(port >= 49152, `Port ${port} liegt nicht im privaten Bereich`)
  assert.ok(![3000, 4040, 5173, 8080].includes(port))
})

test('Status enthält Version und Update-Einstellung, aber kein Update ohne Prüfung', async () => {
  const status = await (await fetch(`${base}/api/status`)).json()
  assert.match(status.version, /^\d+\.\d+\.\d+/)
  assert.equal(status.checkUpdates, true)
  assert.equal(status.update.available, false)
})

test('Status liefert die IP-Auswahl, Start lehnt Ungültiges ab', async () => {
  const status = await (await fetch(`${base}/api/status`)).json()
  assert.equal(status.ipVersion, 'auto')
  const res = await post('/api/tunnel/start', { port: '4200', ipVersion: 'ipv5' })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /Adress-Auswahl|Authtoken/)
})

test('Update-Einstellung lässt sich ausschalten und nimmt nur Booleans an', async () => {
  assert.equal((await post('/api/config', { checkUpdates: 'ja' })).status, 400)
  assert.equal((await post('/api/config', { checkUpdates: false })).status, 200)
  const off = await (await fetch(`${base}/api/status`)).json()
  assert.equal(off.checkUpdates, false)
  assert.equal(off.update, null)
  await post('/api/config', { checkUpdates: true })
})

test('fester Port per Option funktioniert und kollidiert nicht still', async () => {
  const { port: fixed, server: other } = await startServer({
    port: port + 1 === 65536 ? port - 1 : port + 1,
  })
  try {
    assert.ok(fixed > 0)
    await assert.rejects(startServer({ port: fixed }))
  } finally {
    other.close()
  }
})

test('setzt Sicherheits-Header und liefert nie den Token aus', async () => {
  const res = await fetch(`${base}/api/status`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/)
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('x-powered-by'), null)
  assert.ok(!('authtoken' in (await res.json())))
})

test('lehnt fremde Origin-Header bei Schreibzugriffen ab', async () => {
  const res = await post('/api/tunnel/stop', {}, { Origin: 'https://evil.example' })
  assert.equal(res.status, 403)
})

test('validiert Port und Token ohne etwas zu speichern', async () => {
  assert.equal((await post('/api/config', { defaultPort: 'abc' })).status, 400)
  assert.equal((await post('/api/config', { defaultPort: '70000' })).status, 400)
  assert.equal((await post('/api/config', { authtoken: 'kurz' })).status, 400)
  assert.equal((await post('/api/config', { authtoken: 'bad token with spaces!!' })).status, 400)
  assert.equal((await post('/api/tunnel/start', { port: 'abc' })).status, 400)
})
