export const MIN_PORT = 1
export const MAX_PORT = 65535

/**
 * Strikte Port-Prüfung ohne stille Korrektur.
 * Gibt die Portnummer zurück oder wirft einen Fehler mit verständlicher Meldung.
 * @param {unknown} value
 * @returns {number}
 */
export function parsePort(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    throw new Error('Bitte einen Port eingeben.')
  }

  if (!/^\d+$/.test(text)) {
    throw new Error(`„${text}“ ist kein gültiger Port – nur Ziffern erlaubt.`)
  }

  const port = Number(text)
  if (port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`Port muss zwischen ${MIN_PORT} und ${MAX_PORT} liegen.`)
  }

  return port
}
