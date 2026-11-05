import { randomInt } from 'node:crypto'

/**
 * Burrow wählt seine eigenen Ports selbst: zufällig aus dem privaten Bereich
 * (IANA „dynamic/private“, 49152–65535). Dort liegt kein üblicher Entwicklungsport,
 * und die Oberfläche kollidiert nicht mit deinen Dev-Servern.
 */
export const PORT_RANGE = Object.freeze({ min: 49152, max: 65535 })

/** Typische Entwicklungs- und Tool-Ports, die Burrow nie für sich belegt. */
export const AVOIDED_PORTS = Object.freeze(
  new Set([
    80, 443, 1234, 1313, 2368, 3000, 3001, 3002, 3003, 3333, 3306, 4000, 4040, 4173, 4200, 4321,
    4444, 5000, 5001, 5173, 5174, 5432, 5500, 5555, 6006, 6379, 7000, 7777, 8000, 8001, 8008, 8080,
    8081, 8082, 8443, 8787, 8888, 9000, 9090, 9229, 9999, 19000, 19006, 24678, 27017,
  ]),
)

/**
 * @param {Iterable<number>} [exclude] zusätzlich auszulassende Ports (z. B. der Ziel-Port)
 * @param {(min: number, max: number) => number} [random] austauschbar für Tests
 */
export function pickCandidate(exclude = [], random = randomInt) {
  const blocked = new Set(exclude)
  for (;;) {
    const port = random(PORT_RANGE.min, PORT_RANGE.max + 1)
    if (!AVOIDED_PORTS.has(port) && !blocked.has(port)) return port
  }
}

/**
 * Lässt `server` auf einem freien Port lauschen und gibt diesen zurück.
 * Es wird direkt gebunden statt vorher zu prüfen – so gibt es kein Zeitfenster,
 * in dem ein anderer Prozess den Port wegschnappt. Ist er belegt, wird neu gewürfelt.
 *
 * @param {import('node:net').Server} server
 * @param {{ host?: string, exclude?: Iterable<number>, attempts?: number, random?: typeof randomInt }} [options]
 * @returns {Promise<number>}
 */
export async function listenOnFreePort(server, options = {}) {
  const { host = '127.0.0.1', exclude = [], attempts = 50, random = randomInt } = options

  for (let attempt = 0; attempt < attempts; attempt++) {
    const port = pickCandidate(exclude, random)

    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.off('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, host)
      })
      return port
    } catch (error) {
      // Port belegt oder gesperrt (Windows reserviert manche Bereiche): nächster Versuch.
      if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') throw error
    }
  }

  throw new Error('Es konnte kein freier Port gefunden werden.')
}
