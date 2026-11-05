# Changelog

Alle nennenswerten Änderungen an Burrow. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

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
