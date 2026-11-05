import test from 'node:test'
import assert from 'node:assert/strict'
import { applySessionSecurity } from '../electron/security.js'

const ORIGIN = 'http://localhost:51234'

function setup() {
  const handlers = {}
  applySessionSecurity(
    {
      setPermissionRequestHandler: (fn) => (handlers.request = fn),
      setPermissionCheckHandler: (fn) => (handlers.check = fn),
    },
    ORIGIN,
  )
  const ask = (permission, requestingUrl) =>
    new Promise((resolve) => handlers.request(null, permission, resolve, { requestingUrl }))
  return { ask, check: handlers.check }
}

test('Kopieren in die Zwischenablage ist für die eigene Oberfläche erlaubt', async () => {
  const { ask, check } = setup()
  assert.equal(await ask('clipboard-sanitized-write', `${ORIGIN}/index.html`), true)
  assert.equal(check(null, 'clipboard-sanitized-write', `${ORIGIN}/`), true)
})

test('alle anderen Berechtigungen bleiben gesperrt', async () => {
  const { ask, check } = setup()
  for (const permission of ['geolocation', 'media', 'notifications', 'clipboard-read', 'midi']) {
    assert.equal(await ask(permission, `${ORIGIN}/`), false, permission)
    assert.equal(check(null, permission, ORIGIN), false, permission)
  }
})

test('fremde Seiten bekommen auch das Kopieren nicht', async () => {
  const { ask, check } = setup()
  assert.equal(await ask('clipboard-sanitized-write', 'https://evil.example/'), false)
  assert.equal(await ask('clipboard-sanitized-write', 'kaputt'), false)
  assert.equal(check(null, 'clipboard-sanitized-write', 'https://evil.example'), false)
})
