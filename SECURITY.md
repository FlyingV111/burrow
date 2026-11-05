# Sicherheit

## Wie Burrow mit Geheimnissen umgeht

- Der ngrok-Authtoken wird **nie im Klartext** gespeichert. Die Desktop-App verschlüsselt ihn mit dem Schlüsselspeicher des Betriebssystems (Electron `safeStorage`, unter Windows DPAPI) und legt ihn in `~/.burrow/config.json` ab.
- Der Token verlässt den Rechner nur Richtung ngrok. Die lokale API gibt ihn nie zurück.
- Im reinen Server-Modus (`npm run server`) gibt es keinen Schlüsselspeicher. Dort wird der Token nur im Arbeitsspeicher gehalten oder aus `NGROK_AUTHTOKEN` gelesen – nie auf die Platte geschrieben.
- Das Repository enthält keine Zugangsdaten. `.env`, `~/.burrow` und Build-Ausgaben sind ausgeschlossen.

## Lokale Angriffsfläche

- Der interne Server lauscht ausschließlich auf `127.0.0.1`.
- Anfragen mit fremdem `Host` oder fremdem `Origin` werden abgelehnt (Schutz gegen DNS-Rebinding und Cross-Site-Requests).
- Strikte Content-Security-Policy, kein Inline-Script, Eingaben werden serverseitig validiert.
- Das Electron-Fenster läuft mit `sandbox`, `contextIsolation` und ohne Node-Integration; Navigation auf fremde Seiten ist blockiert, externe Links öffnen nur über `https`.

## Netzwerkverbindungen

- **ngrok:** Beim Tunnel baut Burrow eine Verbindung zu ngrok auf (Kernfunktion).
- **GitHub (Update-Suche):** Burrow ruft beim Start und alle 6 Stunden `api.github.com/repos/FlyingV111/burrow/releases/latest` ab. Es wird nur eine anonyme Abfrage gesendet (inklusive Versionsnummer im User-Agent), kein Token, keine Nutzerdaten. Links aus der Antwort werden nur akzeptiert, wenn sie auf die Release-Seite dieses Repositorys zeigen. Abschaltbar in den Einstellungen oder mit `BURROW_NO_UPDATE_CHECK=1`.
- Burrow selbst baut keine weiteren Verbindungen auf (das ngrok-SDK verwaltet seine Verbindung zu ngrok selbst).

## Schwachstelle melden

Bitte **kein öffentliches Issue** für Sicherheitslücken. Nutze stattdessen die private Meldung über den Reiter „Security“ → „Report a vulnerability“ in diesem GitHub-Repository.

## Hinweis

Ein ngrok-Tunnel macht deinen lokalen Server öffentlich im Internet erreichbar. Teile die URL nur mit Personen, denen du vertraust, und beende den Tunnel, wenn du ihn nicht mehr brauchst.
