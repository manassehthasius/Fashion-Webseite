# Stilkompass – Persönlicher AI Fashion Finder Schweiz

Kostenlose, werbefreie Web-App, die hochwertige Kleidung zum **besten Gesamtpreis in die Schweiz** findet: neue Mode und Secondhand aus über 50 geprüften Shops, mit echtem Gesamtpreis (Versand, Einfuhr-MWST, Verzollung), Qualitätsscore, Preisalarmen, KI-Bildsuche, Outfit-Empfehlungen und Style-Profil.

- **Dauerhaft gratis:** Open Source, keine Abos, keine KI-API, keine Datenbank-Kosten.
- **Echte Daten:** öffentliche Produkt-Feeds der Shops, alle 30 Minuten aktualisiert, auch wenn die Seite geschlossen ist.
- **Privat:** Favoriten, Watchlist und Profil bleiben in deinem Browser. Für Hintergrund-Alarme werden sie optional Ende-zu-Ende-verschlüsselt synchronisiert.

## Funktionen

| Bereich | Was es kann |
|---|---|
| **Neue Kleidung** | ~47’000 Produkte von 87 Qualitäts-, Marken- und Multibrand-Shops (darunter Napapijri, Belstaff, Lyle & Scott, Rains, Stüssy, Jack Wolfskin, Filling Pieces) mit Lieferung in die Schweiz (z. B. NIKIN, QWSTION, ROTAUF, Muntagnard, Sunspel, Drake's, Norse Projects, Merz b. Schwanen, Colorful Standard, Private White V.C., Taylor Stitch, Tricker's, Asphaltgold, AFEW, Overkill, Footdistrict). Echte CHF-Preise, wo der Shop einen Schweizer Markt hat. |
| **Gesamtsortiment** | Zusätzlich zu den neuesten Produkten holt die Engine einmal täglich das komplette Sortiment grosser Shops (bis 25’000 Produkte pro Shop, mehrere 100’000 insgesamt). Die App lädt diese Daten erst beim Suchen und nur für die passenden Kategorien. |
| **Neue Shops automatisch** | Nach jeder Aktualisierung prüft die Engine einige Marken, die bei den Fachhändlern geführt werden, auf einen eigenen Online-Shop: Lieferung in die Schweiz, offizieller Marken-Shop, Rückgabe-/Datenschutzbestimmungen, robots.txt, überwiegend Kleidung, plausible Preise (Schutz vor Fake-Shops). Gefundene Shops erscheinen als „Neu entdeckt“. |
| **Secondhand & Vintage** | ~11’000 Teile von REAWAKE (Zürich), Labellov, Thrifted, Rokit, Vintage Folk und PICKNWEIGHT, mit Zustand. Dazu Direktsuche auf Ricardo, tutti.ch, Vestiaire Collective, eBay.ch, Grailed (und Vinted, das nicht in die Schweiz liefert). |
| **Gesamtpreis** | Artikel + Versand (inkl. Gratisversand-Schwelle) + 8,1 % Einfuhr-MWST + Post-Verzollungsgebühr. Zoll auf Kleidung ist seit 1.1.2024 abgeschafft. Warenkorb-Rechner pro Shop. |
| **Qualitätsscore 0–100** | Material, Verarbeitung, Markenruf, Herkunft/Zertifikate, Langlebigkeit bzw. Zustand. Jede Komponente ist als Daten, kuratiert oder Schätzung gekennzeichnet. |
| **Intelligente Suche** | versteht z. B. „breite schwarze Anzughosen“, „schwarzer Merino Pullover Herren unter 150 Grösse M“ oder „converser chuck low“ (Tippfehler werden korrigiert), ohne KI-Kosten. Mode-Begriffe (weit/schmal, Low/High, Rollkragen, Anzughose …) und deutsche Komposita (Wollmantel, Leinenhemd) werden verstanden. Filter für Marke, Stil, Grösse, Material, Farbe, Qualität, Preis, Versand, Zoll, Lieferzeit, Zustand. |
| **Produkt-Preisvergleich** | Bei einem bestimmten Produkt werden gleiche Modelle aus allen Shops gruppiert, pro Shop der beste Gesamtpreis. Dazu Direktvergleich bei Google Shopping und toppreise.ch für alle übrigen Webseiten. |
| **KI-Bildsuche** | Foto hochladen → ähnliche Teile. Das Open-Source-Modell Marqo-FashionSigLIP läuft lokal im Browser. Erkennt Kategorie, Farbe und Stil. |
| **Lernt deinen Stil** | merkt sich (nur im Browser), was du ansiehst, merkst, beobachtest, im Shop öffnest, suchst und als Foto hochlädst. Daraus entstehen „Für dich“-Vorschläge, „Passend zu deinen Bildern“ und „Zuletzt angesehen“. Im Style-Profil sichtbar, einzeln löschbar, pausierbar. |
| **Outfits** | komplette Looks aus verfügbaren Teilen: Farbharmonie, Stil, Saison, Grösse, Budget |
| **Preisvergleich** | gleiches Produkt in mehreren Shops, günstigere Alternativen mit ähnlicher Qualität, Vergleichstabelle |
| **Favoriten & Watchlist** | dauerhaft gespeichert, mit Export/Import. Alarme bei Preissturz, Wunschpreis, wieder verfügbarer Grösse und neuen Treffern gespeicherter Suchen |
| **Benachrichtigungen** | Web-Push (Browser-Standard, kostenlos), auch bei geschlossener Seite |
| **Design** | minimalistisch, hell/dunkel, für Smartphone und Desktop, installierbar als App (PWA) |

## Schnellstart (lokal)

Voraussetzung: [Node.js 22](https://nodejs.org) (LTS).

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run update
```

```bash
npm run build
```

```bash
npm start
```

Öffne danach http://localhost:8787. Der Server aktualisiert alle 30 Minuten automatisch und sendet Push-Alarme, solange er läuft. Der erste Lauf dauert etwa 2 Minuten.

- `npm run setup` erzeugt die Web-Push-Schlüssel (`.env`, privat) und `web/public/push-config.json` (öffentlich).
- Der KI-Bildindex wird bei jedem Lauf schrittweise ergänzt (Standard: 800 neue Bilder pro Lauf, `EMBED_BUDGET=0` schaltet ihn aus). Für den kompletten Index sofort: `npm run update:embed`.
- Optionen: `PORT=8787`, `HOST=127.0.0.1` (für Zugriff im Heimnetz `HOST=0.0.0.0`; Push braucht aber HTTPS oder localhost), `UPDATE_INTERVAL_MIN=30`.
- Entwicklung mit Hot Reload: `npm run dev` (nutzt die Daten aus `data/`).

## GitHub (kostenlos hosten, Updates auch bei ausgeschaltetem Computer)

GitHub Actions führt die Engine alle 30 Minuten aus und veröffentlicht die Seite auf GitHub Pages. In **öffentlichen** Repos ist beides unbegrenzt kostenlos.

1. **Repo:** Code in ein öffentliches GitHub-Repo pushen (z. B. `stilkompass`).
2. **Pages aktivieren:** Repo → *Settings → Pages → Source: GitHub Actions*.
3. **Secrets setzen:** *Settings → Secrets and variables → Actions → New repository secret*. Die Werte stehen in deiner lokalen `.env` (nach `npm run setup`):
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (für Web-Push)
   - `STATE_PASSPHRASE` (für die verschlüsselte Watchlist)
4. **Ersten Lauf starten:** *Actions → Stilkompass aktualisieren → Run workflow*. Nach etwa 5–10 Minuten ist die Seite unter `https://<benutzer>.github.io/<repo>/` erreichbar.
5. **Alarme bei geschlossener Seite:** In der App unter *Einstellungen → Synchronisierung → GitHub* eintragen:
   - Benutzer und Repo
   - ein [Fine-grained Token](https://github.com/settings/personal-access-tokens/new), beschränkt auf dieses Repo, mit *Contents: Read and write* (optional *Actions: Read and write* für den Knopf „Daten jetzt aktualisieren“)
   - dieselbe Passphrase wie `STATE_PASSPHRASE`

   Danach unter *Alarme* Web-Push einschalten.

**Wie das zusammenspielt:**
- Die Daten liegen im Branch `data` (nur der letzte Stand, ohne Historie).
- Deine Watchlist liegt AES-256-verschlüsselt im Branch `userstate`. Ohne Passphrase ist sie nicht lesbar, und das Token bleibt nur in deinem Browser.
- Optional: Mit der Repository-Variable `EMBED_BUDGET` steuerst du, wie viele neue Produktbilder pro Lauf in den KI-Index kommen (Standard 1500).
- Optional: `DEEP_BUDGET` (Feed-Seiten fürs Gesamtsortiment pro Lauf, Standard 400) und `DISCOVER_PROBES` (Marken, die pro Lauf auf einen eigenen Shop geprüft werden, Standard 8, `0` schaltet die Entdeckung aus).

**Gut zu wissen:**
- GitHub startet geplante Läufe teils mit einigen Minuten Verzögerung.
- Bei 60 Tagen ohne Aktivität deaktiviert GitHub geplante Workflows. Die automatischen Pushes auf `data` halten das Repo aktiv. Falls doch, reaktivierst du ihn unter *Actions* mit einem Klick.

## Seriosität der Shops

Alle Shops wurden geprüft (11/2026): Rückgabe-, Datenschutz- und AGB-Seiten, Kontakt- und Firmenangaben, bei Händlern und Secondhand-Shops zusätzlich Kundenbewertungen (Trustpilot u. a.). Entfernt: HEWI (Trustpilot 2.2/5, Beschwerden zu Echtheit und Lieferung) und Baghunter (keine überprüfbaren Bewertungen). Goodhood und Overkill haben gemischte Bewertungen – sie sind in der App gekennzeichnet und werden leicht tiefer sortiert. SHEIN und boohoo (nur Direktsuche) tragen den Hinweis „Qualität umstritten“.

## Transparenz: Quellen und Grenzen

- **Datenquellen:** öffentliche Shopify-Storefront-Feeds (`/products.json`, `/meta.json`, öffentlicher Kursfeed).
  - Gesamtsortiment: pro Shop höchstens 1× täglich vollständig, mit Pausen zwischen den Seiten. Preise dort sind bis 24 h alt; beobachtete Teile werden alle 30 Minuten einzeln aktualisiert.
  - Automatisch gefundene Shops: Versandkosten sind geschätzt, Kundenbewertungen werden nicht automatisch geprüft (in der App gekennzeichnet).
  - Die Lieferung in die Schweiz wird bei jedem Lauf geprüft, robots.txt wird respektiert.
  - Pro Shop höchstens ein Abruf alle 30 Minuten, mit Pausen zwischen den Seiten.
  - Die vollständige Shop-Liste mit Status steht in der App unter *Methode & Transparenz*.
- **Nicht umsetzbar (ohne Kosten bzw. Nutzungsbedingungen zu verletzen):**
  - Produktdaten von Ricardo, tutti.ch, Vinted, Vestiaire Collective, Grailed und eBay. Sie haben keine freie öffentliche API, deshalb gibt es dort nur Direktsuchlinks und keine Hintergrund-Alarme.
  - Tipp: Ricardo und Vinted bieten eigene, kostenlose Suchabos.
  - Vinted liefert nicht in die Schweiz.
- **Schätzungen (in der App gekennzeichnet):**
  - Versandkosten einiger Shops.
  - Abzug der EU/UK-MWST bei Shops ohne Schweizer Markt.
  - Qualitätsscore bei wenigen Produktdaten.
  - Kurier-Verzollungsgebühren können höher sein als der Post-Tarif.
- **Nicht eingebaut:** E-Mail- und Telegram-Benachrichtigungen (nicht gewählt). Die Engine ist so aufgebaut, dass sie sich in `engine/alerts.ts` ergänzen lassen.
- **iPhone:** Web-Push funktioniert nur, wenn die Seite zum Home-Bildschirm hinzugefügt wurde (iOS 16.4+).

## Technik

```
shared/   Gemeinsame Logik (Browser + Node): Taxonomie, Klassifizierung, Preise CH, Qualitätsscore,
          Suche, Personalisierung, Outfits, Ähnlichkeit, Verschlüsselung, Katalogformat
engine/   Datenabruf (Shops), Normalisierung, Preisverlauf, Alarme (Web-Push), KI-Embeddings
server/   Lokaler Server: App, Daten, /api (Zustand, Aktualisierung), 30-Minuten-Zeitplan
web/      React-App (Vite, PWA, Service Worker)
tests/    Unit-Tests (vitest)
```

Befehle: `npm test` (Tests), `npm run typecheck`, `npm run update -- --shops=drakes,nikin` (einzelne Shops).

Lizenz: MIT. Produktdaten, Bilder und Marken gehören den jeweiligen Shops. Stilkompass verlinkt direkt auf die Produktseiten.
