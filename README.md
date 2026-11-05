<div align="center">

<img src="build/icon.png" alt="Mo, der Maulwurf mit Grubenlampe" width="160">

# Burrow

**Mo der Maulwurf gräbt dir einen Tunnel von deinem Dev-Server aufs Handy.**

Port eintippen · Starten · QR-Code scannen · fertig.

[![CI](https://github.com/FlyingV111/burrow/actions/workflows/ci.yml/badge.svg)](https://github.com/FlyingV111/burrow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-86efac.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-45-47848f.svg)](https://www.electronjs.org)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-5fa04e.svg)](https://nodejs.org)

<img src="docs/screenshot.png" alt="Burrow Oberfläche" width="330">

</div>

---

## Warum Burrow?

Du entwickelst eine Web-App auf `localhost:3000` und willst sie **kurz auf dem echten Handy testen** – ohne WLAN-Gefrickel, ohne IP-Adressen abtippen, ohne CLI-Befehle zu googeln.

Burrow ist eine winzige Desktop-App, die genau das tut: Sie öffnet per [ngrok](https://ngrok.com) einen sicheren HTTPS-Tunnel zu deinem lokalen Port und zeigt dir den QR-Code dazu.

## Features

|     |                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📱  | **Ein Klick zum Handy** – öffentliche HTTPS-URL plus QR-Code zum Scannen                                                                             |
| 📊  | **Live-Statistik** – Anfragen, Datenmenge und aktive Verbindungen als Sparklines                                                                     |
| ⌨️  | **Port-Feld ohne Bevormundung** – tippe, was du willst; geprüft wird erst beim Start, mit klarer Meldung statt stiller Korrektur                     |
| 🔐  | **Token sicher gespeichert** – verschlüsselt mit dem Schlüsselspeicher deines Betriebssystems                                                        |
| 🌐  | **IPv4 oder IPv6 – du entscheidest** – Dev-Server nur auf `::1` (Angular, Vite)? Burrow findet ihn automatisch, oder du erzwingst die Adresse selbst |
| 🎲  | **Eigene Ports, die nie stören** – Burrow wählt seine Ports selbst im privaten Bereich (49152–65535) und meidet 3000, 5173, 8080, 4040 & Co.         |
| 🔔  | **Update-Hinweis** – erkennt automatisch, wenn es ein neues Release gibt, und zeigt es dezent in der Titelleiste an                                  |
| 🏠  | **Komplett lokal** – die Oberfläche ist nur über `127.0.0.1` erreichbar                                                                              |
| 🪶  | **Klein und ruhig** – ein festes 420×500-Fenster, dunkel, ohne Schnickschnack                                                                        |

## So funktioniert es

```mermaid
flowchart LR
    Phone["📱 Handy"] -->|HTTPS| Ngrok["☁️ ngrok"]
    Ngrok -->|Tunnel| Burrow["🦡 Burrow<br/>(Zähl-Proxy)"]
    Burrow -->|127.0.0.1| Dev["💻 Dein Dev-Server<br/>localhost:3000"]
```

Zwischen ngrok und deinem Server sitzt ein kleiner Proxy. Er leitet alles unverändert durch (inklusive WebSockets, damit Hot-Reload funktioniert) und zählt nebenbei den Datenverkehr für die Live-Anzeige.

## Download

Die fertige Windows-App gibt es unter **[Releases](https://github.com/FlyingV111/burrow/releases/latest)**:

- **`Burrow-Setup-…-x64.exe`** – Installer mit Desktop-Verknüpfung und Startmenü-Eintrag (empfohlen)
- **`Burrow-Portable-…-x64.exe`** – ohne Installation, einfach starten

> [!NOTE]
> Die Dateien sind noch nicht code-signiert, Windows SmartScreen warnt deshalb beim ersten Start („Weitere Informationen → Trotzdem ausführen“). Jedes Release enthält `SHA256SUMS.txt` und einen GitHub-Herkunftsnachweis, mit dem du den Download prüfen kannst: `gh attestation verify <Datei> --repo FlyingV111/burrow`.

## Aus dem Quellcode starten

**Voraussetzungen:** Node.js 18 oder neuer und ein kostenloser [ngrok-Account](https://dashboard.ngrok.com/signup) mit [Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).

```bash
git clone https://github.com/FlyingV111/burrow.git
cd burrow
npm install
npm start
```

Installer und Portable-Version baust du selbst mit:

```bash
npm run build      # Ergebnis in dist/: Burrow-Setup-… und Burrow-Portable-…
```

## Benutzung

1. **Token eintragen** – beim ersten Start einmalig deinen ngrok-Authtoken einfügen und speichern.
2. **Port eingeben** – der Port deines laufenden Dev-Servers (`3000`, `5173`, `8080` …). Der Server muss bereits laufen.
3. **Starten** – Mo gräbt den Tunnel. Scanne den QR-Code oder kopiere die URL.
4. **Beenden** – „Tunnel beenden“ schließt den Zugang sofort wieder.

> [!TIP]
> Ohne Desktop-Fenster geht es auch im Browser: `npm run server` starten – die Adresse mit dem zufällig gewählten freien Port steht im Terminal (fest vorgeben mit `BURROW_PORT=51234`). In diesem Modus gibt es keinen Schlüsselspeicher – der Token wird nicht gespeichert. Setze ihn stattdessen als Umgebungsvariable `NGROK_AUTHTOKEN`.

## Sicherheit

Ein Tunnel macht deinen lokalen Server **öffentlich erreichbar**. Burrow versucht, wenigstens den Rest sauber zu halten:

- 🔑 Der Authtoken wird **nie im Klartext** gespeichert (Electron `safeStorage`, unter Windows DPAPI) und von der lokalen API nie zurückgegeben.
- 🔒 Der interne Server lauscht nur auf `127.0.0.1` und lehnt fremde `Host`- und `Origin`-Header ab (Schutz vor DNS-Rebinding und Cross-Site-Requests).
- 🧱 Strikte Content-Security-Policy, kein Inline-Script, serverseitige Validierung aller Eingaben.
- 📦 Electron-Fenster mit Sandbox, `contextIsolation`, ohne Node-Integration und mit blockierter Navigation.

Teile die Tunnel-URL nur mit Leuten, denen du vertraust, und beende den Tunnel, wenn du fertig bist. Details und Meldeweg für Sicherheitslücken: [SECURITY.md](SECURITY.md).

## FAQ

<details>
<summary><b>Wo werden meine Einstellungen gespeichert?</b></summary>

In `~/.burrow/config.json` (unter Windows `C:\Users\<Name>\.burrow`). Der Token steht dort nur verschlüsselt. Einstellungen und Token aus den Vorgängerversionen (`~/.tunnel`, `~/.mitn`) werden beim ersten Start automatisch übernommen, der alte Klartext-Token wird dabei entfernt.

</details>

<details>
<summary><b>„Port muss zwischen 1 und 65535 liegen“ – warum korrigiert Burrow das nicht einfach?</b></summary>

Weil es dich nicht bevormunden soll. Das Feld bleibt, wie du es getippt hast; erst beim Start prüft Burrow die Eingabe und sagt dir, was nicht stimmt.

</details>

<details>
<summary><b>Der Tunnel startet, aber die Seite zeigt „Bad Gateway“ bzw. „Burrow: Auf Port … antwortet kein Server“.</b></summary>

Dein Dev-Server läuft nicht auf dem angegebenen Port. Starte ihn zuerst und prüfe, ob er unter `http://localhost:<port>` erreichbar ist.

Viele Dev-Server (Angular, Vite …) lauschen unter Windows nur auf IPv6 (`::1`) statt auf IPv4 (`127.0.0.1`). Burrow prüft im Modus **Automatisch** beide Adressen. Mit der Auswahl **IP** kannst du sie auch festlegen – IPv6 entspricht dem ngrok-Befehl `ngrok http http://[::1]:4200`.

</details>

<details>
<summary><b>Wie funktioniert die Update-Erkennung?</b></summary>

Burrow fragt beim Start und danach alle 6 Stunden die öffentliche GitHub-Releases-Seite dieses Projekts ab. Gibt es eine neuere Version, erscheint in der Titelleiste „Update x.y.z“ mit Link zur Download-Seite. Es wird **nichts automatisch installiert**, und es werden keine Daten von dir gesendet. Abschalten: Einstellungen → „Automatisch nach Updates suchen“, oder per Umgebungsvariable `BURROW_NO_UPDATE_CHECK=1`.

</details>

<details>
<summary><b>Welche Ports nutzt Burrow selbst?</b></summary>

Zufällige freie Ports im privaten Bereich 49152–65535 (nur auf `127.0.0.1`), nie einen der typischen Entwicklungsports und nie den Port, den du gerade teilst. Dein Dev-Server bekommt seinen Port also garantiert.

</details>

<details>
<summary><b>Läuft das auch unter macOS oder Linux?</b></summary>

Der Code ist plattformunabhängig, getestet und als Build vorbereitet ist bisher nur Windows. Mit `npm start` solltest du Burrow überall starten können, wo Electron läuft.

</details>

## Entwicklung

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm test              # Tests (node:test)
npm run check         # Lint + Format + Tests, wie in der CI
npm run icons         # App-Icon aus build/icon.svg neu rendern
```

```
electron/main.js      Electron-Hauptprozess (Sandbox, Token-Verschlüsselung)
src/server.js         Express-API: nur Loopback, CSP, Origin-Prüfung
src/tunnel.js         ngrok-Tunnel starten und stoppen
src/proxy.js          Zähl-Proxy für die Traffic-Statistik
src/free-port.js      Zufälliger freier Port abseits üblicher Dev-Ports
src/update.js         Update-Erkennung über GitHub Releases
src/port.js           Strikte Port-Validierung
src/config.js         Einstellungen und verschlüsselter Token
src/public/           Oberfläche (HTML, CSS, JS, Maskottchen)
test/                 Tests
```

## Release veröffentlichen

```bash
# Version in package.json und CHANGELOG.md anheben, committen, dann:
git tag v1.0.1
git push origin v1.0.1
```

Die GitHub Action baut Installer und Portable-Version, erzeugt Prüfsummen samt Herkunftsnachweis und legt das Release an.

## Lizenz

[MIT](LICENSE) © FlyingV111

<div align="center">
<sub>Gebaut mit Erde unter den Fingernägeln. 🦡</sub>
</div>
