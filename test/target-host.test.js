import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequestProxy } from '../src/proxy.js'
import { createTargetResolver, targetUrl } from '../src/target-host.js'

test('IPv6-Adressen bekommen eckige Klammern in der URL', () => {
  assert.equal(targetUrl('127.0.0.1', 4200), 'http://127.0.0.1:4200')
  assert.equal(targetUrl('::1', 4200), 'http://[::1]:4200')
})

test('nimmt den Host, auf dem wirklich etwas lauscht', async () => {
  const onlyV6 = async (host) => host === '::1'
  const resolve = createTargetResolver(4200, { connect: onlyV6 })
  assert.equal(await resolve(), '::1')
})

test('bevorzugt IPv4, wenn beides geht', async () => {
  const resolve = createTargetResolver(4200, { connect: async () => true })
  assert.equal(await resolve(), '127.0.0.1')
})

test('liefert null, wenn nichts lauscht', async () => {
  const resolve = createTargetResolver(4200, { connect: async () => false })
  assert.equal(await resolve(), null)
})

test('merkt sich den Host kurz und sucht danach neu', async () => {
  let time = 0
  let calls = 0
  let listeningOn = '127.0.0.1'
  const resolve = createTargetResolver(4200, {
    now: () => time,
    cacheMs: 1000,
    connect: async (host) => {
      calls++
      return host === listeningOn
    },
  })

  assert.equal(await resolve(), '127.0.0.1')
  const callsAfterFirst = calls
  assert.equal(await resolve(), '127.0.0.1')
  assert.equal(calls, callsAfterFirst, 'innerhalb des Caches wird nicht neu geprüft')

  // Dev-Server startet neu und bindet jetzt nur noch an IPv6
  listeningOn = '::1'
  time = 5000
  assert.equal(await resolve(), '::1')
})

const get = (port) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode, body }))
      })
      .on('error', reject)
  })

test('Proxy erreicht einen Dev-Server, der nur auf IPv6 lauscht', async (t) => {
  const origin = http.createServer((_req, res) => res.end('hallo vom ipv6-server'))
  const listening = await new Promise((resolve) => {
    origin.once('error', () => resolve(false))
    origin.listen(0, '::1', () => resolve(true))
  })
  if (!listening) return t.skip('IPv6-Loopback auf diesem System nicht verfügbar')

  const proxy = await createRequestProxy(origin.address().port)
  try {
    const response = await get(proxy.port)
    assert.equal(response.status, 200)
    assert.equal(response.body, 'hallo vom ipv6-server')
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('Proxy erklärt verständlich, wenn kein Server läuft', async () => {
  const unused = http.createServer()
  await new Promise((resolve) => unused.listen(0, '127.0.0.1', resolve))
  const freePort = unused.address().port
  await new Promise((resolve) => unused.close(resolve))

  const proxy = await createRequestProxy(freePort)
  try {
    const response = await get(proxy.port)
    assert.equal(response.status, 502)
    assert.match(response.body, new RegExp(`Port ${freePort}`))
    assert.match(response.body, /Dev-Server/)
  } finally {
    await proxy.close()
  }
})
