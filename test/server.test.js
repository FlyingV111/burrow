import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.BURROW_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-test-'))
delete process.env.NGROK_AUTHTOKEN

const { startServer } = await import('../src/server.js')
const { port, server } = await startServer({ dynamicPort: true })
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
