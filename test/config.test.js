import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.BURROW_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-test-'))
delete process.env.NGROK_AUTHTOKEN

const { loadConfig, saveConfig, setSecretCodec, getConfigPath, isConfigured } =
  await import('../src/config.js')

// Test-Codec: nur zur Unterscheidung von Klartext, keine echte Kryptografie.
const fakeCodec = {
  isAvailable: () => true,
  encrypt: (plain) => Buffer.from(`enc:${plain}`).toString('base64'),
  decrypt: (cipher) => Buffer.from(cipher, 'base64').toString().replace(/^enc:/, ''),
}

test.after(() => fs.rmSync(process.env.BURROW_HOME, { recursive: true, force: true }))

test('ohne Codec wird der Token nicht auf die Platte geschrieben', () => {
  setSecretCodec(null)
  const { persisted } = saveConfig({ authtoken: 'session-only-token-123' })

  assert.equal(persisted, false)
  assert.equal(loadConfig().authtoken, 'session-only-token-123')
  assert.ok(!fs.readFileSync(getConfigPath(), 'utf8').includes('session-only-token-123'))
})

test('mit Codec liegt der Token nur verschlüsselt in der Datei', () => {
  setSecretCodec(fakeCodec)
  const { persisted } = saveConfig({ authtoken: 'super-secret-token-456' })

  assert.equal(persisted, true)
  assert.ok(!fs.readFileSync(getConfigPath(), 'utf8').includes('super-secret-token-456'))
  assert.equal(loadConfig().authtoken, 'super-secret-token-456')
  assert.ok(isConfigured())
})

test('Klartext-Token aus alten Versionen wird übernommen und danach entfernt', () => {
  setSecretCodec(fakeCodec)
  fs.rmSync(getConfigPath(), { force: true })

  const legacyFile = path.join(process.env.BURROW_HOME, '.tunnel', 'config.json')
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true })
  fs.writeFileSync(legacyFile, JSON.stringify({ authtoken: 'legacy-token-789', defaultPort: 5173 }))

  const config = loadConfig()
  assert.equal(config.authtoken, 'legacy-token-789')
  assert.equal(config.defaultPort, 5173)
  assert.ok(!fs.readFileSync(getConfigPath(), 'utf8').includes('legacy-token-789'))
  assert.ok(!fs.readFileSync(legacyFile, 'utf8').includes('legacy-token-789'))
})

test('Port-Einstellung bleibt beim Token-Speichern erhalten', () => {
  setSecretCodec(fakeCodec)
  saveConfig({ defaultPort: 8081 })
  saveConfig({ authtoken: 'another-token-000' })
  assert.equal(loadConfig().defaultPort, 8081)
})
