/**
 * Berechtigungen der Oberfläche: alles ist verboten außer dem Schreiben in die
 * Zwischenablage (für „Kopieren“ der Tunnel-URL) – und das nur für Burrows eigene Seite.
 */
export const ALLOWED_PERMISSIONS = Object.freeze(new Set(['clipboard-sanitized-write']))

/**
 * @param {import('electron').Session} session
 * @param {string} appOrigin z. B. "http://localhost:51234"
 */
export function applySessionSecurity(session, appOrigin) {
  const isAllowed = (permission, origin) =>
    ALLOWED_PERMISSIONS.has(permission) && origin === appOrigin

  session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    let origin = ''
    try {
      origin = new URL(details.requestingUrl).origin
    } catch {
      // ungültige URL -> verweigern
    }
    callback(isAllowed(permission, origin))
  })

  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    isAllowed(permission, requestingOrigin.replace(/\/$/, '')),
  )
}
