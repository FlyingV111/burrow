# <img src="build/icon-256.png" alt="Mo, der Maulwurf" width="48" align="center"> Burrow

[![CI](https://github.com/FlyingV111/burrow/actions/workflows/ci.yml/badge.svg)](https://github.com/FlyingV111/burrow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Mo der Maulwurf gräbt dir einen Tunnel von deinem lokalen Dev-Server aufs Handy.**

Burrow ist eine kleine Electron-Desktop-App: Port eingeben, auf „Starten“ klicken, QR-Code mit dem Handy scannen – fertig. Dahinter arbeitet [ngrok](https://ngrok.com), dazu gibt es eine Live-Anzeige des Datenverkehrs.

## Features

- Ein Klick: lokaler Port → öffentliche HTTPS-URL + QR-Code
- Live-Statistik (Anfragen, Datenmenge, aktive Verbindungen)
- Port-Feld ohne Bevormundung: Du kannst frei tippen, geprüft wird erst beim Start – mit klarer Meldung statt stiller Korrektur
- Token sicher gespeichert (OS-Schlüsselspeicher, siehe [SECURITY.md](SECURITY.md))
- Läuft komplett lokal, die Oberfläche ist nur über `127.0.0.1` erreichbar

## Installation

Voraussetzungen: Node.js 18+ und ein kostenloser [ngrok-Account](https://dashboard.ngrok.com/signup) mit Authtoken.

```bash
git clone https://github.com/FlyingV111/burrow.git
cd burrow
npm install
npm start
```

Windows-Portable bauen: `npm run build` (Ergebnis in `dist/`).

## Benutzung

1. Authtoken einmalig eintragen und speichern.
2. Port des laufenden Dev-Servers eingeben (1–65535).
3. „Starten“ drücken und den QR-Code scannen.

Ohne Desktop-Fenster geht es auch im Browser: `npm run server` und `http://localhost:4040` öffnen. In diesem Modus wird der Token nicht gespeichert; setze ihn stattdessen über die Umgebungsvariable `NGROK_AUTHTOKEN`.

## Entwicklung

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm test              # Tests (node:test)
npm run check         # alles zusammen, wie in der CI
npm run icons         # App-Icon aus build/icon.svg neu rendern
```

```
electron/main.js      Electron-Hauptprozess (Sandbox, Token-Verschlüsselung)
src/server.js         Express-API, nur Loopback, CSP, Origin-Prüfung
src/tunnel.js         ngrok-Tunnel starten/stoppen
src/proxy.js          Zähl-Proxy für die Traffic-Statistik
src/port.js           Strikte Port-Validierung
src/config.js         Einstellungen + verschlüsselter Token
src/public/           Oberfläche (HTML, CSS, JS, Maskottchen)
test/                 Tests
```

## Lizenz

[MIT](LICENSE)
