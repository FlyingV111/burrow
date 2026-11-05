import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkForUpdate,
  compareVersions,
  currentVersion,
  getUpdateState,
  resetUpdateState,
} from '../src/update.js'

const release = (overrides = {}) => ({
  tag_name: 'v99.0.0',
  html_url: 'https://github.com/FlyingV111/burrow/releases/tag/v99.0.0',
  draft: false,
  prerelease: false,
  ...overrides,
})

const fakeFetch =
  (body, init = {}) =>
  async () => ({
    ok: init.ok ?? true,
    json: async () => body,
  })

test.beforeEach(() => resetUpdateState())

test('vergleicht Versionen numerisch statt als Text', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
  assert.ok(compareVersions('v2.0.0', '1.99.99') > 0)
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0)
  assert.equal(compareVersions('1.2.3', 'v1.2.3'), 0)
})

test('eine Vorabversion ist älter als das fertige Release', () => {
  assert.ok(compareVersions('1.0.0', '1.0.0-beta.1') > 0)
  assert.ok(compareVersions('1.0.0-beta.1', '1.0.0') < 0)
})

test('ungültige Versionen ergeben NaN', () => {
  assert.ok(Number.isNaN(compareVersions('abc', '1.0.0')))
  assert.ok(Number.isNaN(compareVersions('1.0', '1.0.0')))
})

test('meldet ein neueres Release', async () => {
  const state = await checkForUpdate({ fetchImpl: fakeFetch(release()) })
  assert.equal(state.available, true)
  assert.equal(state.latest, '99.0.0')
  assert.equal(state.current, currentVersion)
  assert.match(state.url, /^https:\/\/github\.com\/FlyingV111\/burrow\/releases\//)
})

test('meldet nichts, wenn man schon aktuell ist', async () => {
  const state = await checkForUpdate({
    fetchImpl: fakeFetch(release({ tag_name: `v${currentVersion}` })),
  })
  assert.equal(state.available, false)
  assert.equal(state.checked, true)
})

test('ignoriert Entwürfe und Vorabversionen', async () => {
  assert.equal(
    (await checkForUpdate({ fetchImpl: fakeFetch(release({ draft: true })) })).checked,
    false,
  )
  assert.equal(
    (await checkForUpdate({ fetchImpl: fakeFetch(release({ prerelease: true })) })).checked,
    false,
  )
})

test('lehnt Links außerhalb der eigenen Release-Seite ab', async () => {
  for (const html_url of [
    'https://evil.example/releases/',
    'http://github.com/FlyingV111/burrow/releases/tag/v99.0.0',
    'https://github.com/someone-else/burrow/releases/tag/v99.0.0',
    'javascript:alert(1)',
  ]) {
    const state = await checkForUpdate({ fetchImpl: fakeFetch(release({ html_url })) })
    assert.equal(state.available, false, html_url)
    assert.equal(state.url, null, html_url)
  }
})

test('Netzwerk- und HTTP-Fehler stören nicht und lassen den Stand unverändert', async () => {
  await checkForUpdate({ fetchImpl: fakeFetch(release()) })
  assert.equal(getUpdateState().available, true)

  const offline = async () => {
    throw new Error('offline')
  }
  assert.equal((await checkForUpdate({ fetchImpl: offline })).available, true)
  assert.equal((await checkForUpdate({ fetchImpl: fakeFetch({}, { ok: false }) })).available, true)
})
