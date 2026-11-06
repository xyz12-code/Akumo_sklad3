# AKUMO SKLAD 3

Přehledný skladový navigátor pro hledání dílů a šuplíků. Navrženo tak, aby šlo ovládat i bez technických znalostí: velké hledání, čitelné výsledky a jedno výrazné tlačítko **Ukaž šuplík na mapě**.

## Co umí

- Hledání **bez diakritiky**, podle názvu, čárového kódu i označení šuplíku (`E3`)
- Rychlá odpověď „kam jít“ + seznam shod
- **Schematická mapa** šuplíků po sekcích (A–U) v režimu **3D schéma** nebo **2D mřížka**
- Zvýraznění nalezených šuplíků, otevření vybraného šuplíku, `prefers-reduced-motion`
- Lokálně v prohlížeči: historie hledání, oblíbené šuplíky, režim mapy, sdílecí odkaz `?q=`
- Klávesnice: `/` fokus, `Esc` vymazat, `↑/↓` výsledky

## Co záměrně neumí / neříká

- **Nejsou k dispozici skutečné 3D souřadnice** šuplíků ve skladu. Mapa je přehledové schéma podle kódů (`A1`, `E3`…), ne fyzický půdorys.
- Stav množství je **údaj z inventurního exportu**, ne živý ERP/sklad.
- Historie a oblíbené se **neukládají na server** — jen `localStorage` v daném prohlížeči.
- Žádné falešné AI odhady dostupnosti.

## Data

Z veřejného repozitáře [Akumo_sklad2](https://github.com/xyz12-code/Akumo_sklad2):

| Soubor | Obsah |
| --- | --- |
| `supliky.json` | 277 šuplíků `[kód, název, volitelná poznámka]` |
| `beta-data/part1.json` … `part4.json` | 209 dílů `[kód, název, kategorie, množství, šuplík, poznámka]` |

Kontrolní součty: `data/CHECKSUMS.sha256`.

## Spuštění lokálně

Stačí libovolný statický server z kořene projektu, například:

```bash
python3 -m http.server 8080
```

Otevři `http://127.0.0.1:8080/`.

## Testy

```bash
npm test
npm run check:js
```

Testy ověřují normalizaci diakritiky, přesné kódy šuplíků, multiword search, barcode, prázdný výsledek, integritu JSON a relativní cesty pro GitHub Pages.

## Design

Barevnost inspirovaná veřejným CSS [akumo.cz](https://www.akumo.cz/) (primární zelená `#7db828`, černá/bílá, jemná zlatá výstraha). Vlastní UI, ne generická šablona dashboardu.

## Větve a nasazení

- `main` — výchozí README
- `feature/akumo-v3` — aplikace (GitHub Pages publikuje tuto větev z `/`)

Původní `Akumo_sklad2` se nemění.
