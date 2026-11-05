import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { AVOIDED_PORTS, PORT_RANGE, listenOnFreePort, pickCandidate } from '../src/free-port.js'

test('Kandidaten liegen im privaten Bereich und nie auf typischen Dev-Ports', () => {
  for (let i = 0; i < 2000; i++) {
    const port = pickCandidate()
    assert.ok(port >= PORT_RANGE.min && port <= PORT_RANGE.max, `${port} außerhalb des Bereichs`)
    assert.ok(!AVOIDED_PORTS.has(port))
  }
})

test('typische Dev-Ports sind gesperrt', () => {
  for (const port of [3000, 4040, 5173, 8000, 8080, 9229]) {
    assert.ok(AVOIDED_PORTS.has(port), `${port} fehlt in der Sperrliste`)
  }
})

test('ausgeschlossene Ports (z. B. der Ziel-Port) werden nie gewählt', () => {
  const target = 50000
  // Zufallsquelle liefert erst den gesperrten Wert, dann einen erlaubten
  const values = [target, target, 50001]
  const picked = pickCandidate([target], () => values.shift())
  assert.equal(picked, 50001)
})

test('lauscht auf einem freien Port und gibt ihn zurück', async () => {
  const server = net.createServer()
  const port = await listenOnFreePort(server)
  try {
    assert.equal(server.address().port, port)
    assert.equal(server.address().address, '127.0.0.1')
    assert.ok(port >= PORT_RANGE.min)
  } finally {
    server.close()
  }
})

test('würfelt neu, wenn der Port belegt ist', async () => {
  const blocker = net.createServer()
  const blockedPort = await listenOnFreePort(blocker)
  const server = net.createServer()
  const values = [blockedPort, blockedPort, 0]
  let call = 0

  try {
    // erste zwei Versuche treffen den belegten Port, danach ein freier
    const free = await listenOnFreePort(server, {
      random: (min) => {
        const next = values[call++]
        return next === 0 ? min + 1234 : next
      },
    })
    assert.notEqual(free, blockedPort)
    assert.ok(call >= 3)
  } finally {
    server.close()
    blocker.close()
  }
})

test('gibt nach zu vielen Fehlversuchen auf', async () => {
  const blocker = net.createServer()
  const blockedPort = await listenOnFreePort(blocker)
  const server = net.createServer()
  try {
    await assert.rejects(
      listenOnFreePort(server, { attempts: 3, random: () => blockedPort }),
      /kein freier Port/,
    )
  } finally {
    blocker.close()
  }
})
