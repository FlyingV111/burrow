import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePort } from '../src/port.js'

test('akzeptiert gültige Ports und ignoriert Leerraum', () => {
  assert.equal(parsePort('8080'), 8080)
  assert.equal(parsePort(' 80 '), 80)
  assert.equal(parsePort(65535), 65535)
})

test('lehnt ungültige Eingaben mit Meldung ab, statt zu korrigieren', () => {
  const bad = ['', '   ', 'abc', '80a', '3000.5', '-1', '0', '65536', '1e3', undefined, null]
  for (const value of bad) {
    assert.throws(() => parsePort(value), Error, `sollte ${JSON.stringify(value)} ablehnen`)
  }
})
