## Download

| Datei                               | Wofür                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Burrow-Setup-<version>-x64.exe`    | **Empfohlen.** Installer mit Desktop- und Startmenü-Verknüpfung, Deinstallation über Windows-Einstellungen |
| `Burrow-Portable-<version>-x64.exe` | Ohne Installation, einfach starten (z. B. vom USB-Stick)                                                   |
| `SHA256SUMS.txt`                    | Prüfsummen zum Verifizieren des Downloads                                                                  |

## Hinweis zu Windows SmartScreen

Die Dateien sind noch **nicht code-signiert**. Windows zeigt deshalb beim ersten Start „Der Computer wurde durch Windows geschützt“. Das ist bei neuen, unsignierten Apps normal: **Weitere Informationen → Trotzdem ausführen**.

Prüfe vorher gern die Echtheit:

```powershell
Get-FileHash .\Burrow-Setup-<version>-x64.exe -Algorithm SHA256   # mit SHA256SUMS.txt vergleichen
gh attestation verify .\Burrow-Setup-<version>-x64.exe --repo FlyingV111/burrow
```

Die zweite Zeile belegt, dass die Datei von GitHub Actions aus diesem Repository gebaut wurde.

---
