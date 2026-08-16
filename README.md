# 🍔 Timo & Kaj Pak-Mam

Een zelfgemaakte Pac-Man:
- **Hamburgers** 🍔 = de grote power-rondjes (eet je die op, dan kun je de spookjes even opeten)
- **Spookjes** = foto van je vriendin
- **Pac-Man** = kies bij de start tussen **Timo** of **Kaj**
- **3 levels**

Werkt met pijltjestoetsen / WASD, en met swipen op de telefoon.

---

## 1. Je eigen foto's toevoegen

Zet 3 foto's in de map `assets/` met **precies** deze namen (kleine letters):

| Bestand                 | Wordt gebruikt voor            |
|-------------------------|--------------------------------|
| `assets/timo.png`       | Pac-Man optie 1 (Timo)         |
| `assets/kaj.png`        | Pac-Man optie 2 (Kaj)          |
| `assets/vriendin.png`   | De spookjes (je vriendin)      |

Tips:
- **Vierkant** werkt het mooist (bijv. 400×400), gezicht in het midden — de game maakt ze automatisch rond.
- `.png` of `.jpg` mag allebei; noem het bestand dan wel exact `timo.jpg` enz. en pas niets aan — of hernoem gewoon naar `.png`.
- Zonder foto's werkt het spel ook: dan zie je een gele Pac-Man en gekleurde spookjes als tijdelijke versie.

---

## 2. Lokaal testen (op je eigen computer)

Open een Terminal in deze map en start een klein servertje:

```bash
python3 -m http.server 8765
```

Ga daarna in je browser naar: **http://localhost:8765**

(Stoppen: `Ctrl + C` in de Terminal.)

> Alleen dubbelklikken op `index.html` werkt meestal *niet* goed, omdat de foto's dan niet laden. Gebruik het servertje hierboven.

---

## 3. Online zetten via GitHub Pages (gratis)

1. Maak een gratis account op https://github.com (als je die nog niet hebt).
2. Klik rechtsboven op **+ → New repository**. Geef 'm een naam, bijv. `pacman`. Zet 'm op **Public**. Klik **Create repository**.
3. Upload alle bestanden uit deze map (`index.html`, `style.css`, `game.js`, `mazes.js` en de map `assets/`):
   - Op de repo-pagina: **Add file → Upload files**, sleep alle bestanden erin, klik **Commit changes**.
4. Ga naar **Settings → Pages** (linkermenu).
5. Bij **Build and deployment → Source** kies je **Deploy from a branch**, branch **main**, map **/(root)**, klik **Save**.
6. Wacht ~1 minuut. Bovenaan verschijnt je link, bijv.:
   `https://<jouw-gebruikersnaam>.github.io/pacman/`

Die link kun je delen — werkt op computer én telefoon.

---

## Bestanden

- `index.html` – de pagina
- `style.css` – de opmaak
- `mazes.js` – de 3 doolhoven (gecheckt: alles bereikbaar, 4 hamburgers per level)
- `game.js` – de spellogica
- `assets/` – hier komen je foto's

## Moeilijkheid aanpassen

In `game.js` bovenaan staat `LEVEL_CFG`. Daar kun je per level de
spookjes-snelheid (`ghostSpeed`) en de hamburger-tijd (`frightSec`) veranderen.
Lager = makkelijker.
