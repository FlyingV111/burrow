# Changelog

Alle nennenswerten Änderungen an Burrow. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [1.1.1] – 2026-11-05

### Behoben

- „Kopieren fehlgeschlagen“ bei der Tunnel-URL: Das Electron-Fenster hat versehentlich auch das Schreiben in die Zwischenablage verboten. Erlaubt ist jetzt genau diese eine Berechtigung, nur für Burrows eigene Seite; zusätzlich gibt es einen Fallback
- „Bad Gateway“, wenn der Dev-Server nur auf IPv6 (`::1`) lauscht – typisch für Angular, Vite & Co. unter Windows. Burrow prüft jetzt `127.0.0.1` und `::1` und nimmt die erreichbare Adresse
- Läuft auf dem Port kein Server, erklärt die Fehlerseite das jetzt, statt nur „Bad Gateway“ zu zeigen

## [1.1.0] – 2026-11-05

### Hinzugefügt

- Burrow wählt seine eigenen Ports selbst: zufällig und frei im privaten Bereich (49152–65535), nie auf typischen Entwicklungsports und nie auf dem geteilten Ziel-Port
- Automatische Update-Erkennung über GitHub Releases mit Hinweis „Update x.y.z“ in der Titelleiste; abschaltbar in den Einstellungen
- Versionsanzeige in den Einstellungen

### Geändert

- Server-Modus (`npm run server`) nutzt nicht mehr fest Port 4040 (der ngrok-Inspector-Port), sondern einen freien Zufallsport; fest vorgebbar mit `BURROW_PORT`

## [1.0.0] – 2026-11-05

Erste öffentliche Version.

### Hinzugefügt

- Desktop-App (Electron): lokalen Port per ngrok-Tunnel mit QR-Code teilen
- Live-Statistik für Anfragen, Datenmenge und aktive Verbindungen
- Maskottchen Mo, App-Icon und Windows-Installer mit Desktop-Verknüpfung
- Portable-Variante ohne Installation
- Release-Workflow mit Prüfsummen und Herkunftsnachweis

### Geändert

- Port-Feld ist frei editierbar und wird nicht mehr automatisch korrigiert; geprüft wird erst beim Start

### Sicherheit

- Authtoken wird mit dem Schlüsselspeicher des Betriebssystems verschlüsselt
- Interner Server nur auf `127.0.0.1`, mit Host-/Origin-Prüfung und strikter CSP
- Electron-Fenster mit Sandbox und blockierter Navigation
