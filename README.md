# AKUMO RADAR

Rychlý skladový radar pro hledání dílů, sken čárových kódů a schematickou mapu šuplíků.

**Produktový název:** AKUMO RADAR  
**Repozitář:** `Akumo_sklad3` (nemění se)

## Co umí

- Hledání bez diakritiky podle názvu, EAN/kódu i šuplíku
- Kamerové skenování čárových kódů (EAN-13/8, Code 128 a běžné 1D) s ohledem na iPhone/Safari
- Regálové průčelí ve sloupcích (A1 nad A2…): bloky A–G a H–M dle videa, N–U dle evidence; 3D/2D
- Mobilní spodní lišta: Hledat · Skenovat · Mapa
- Lokálně v prohlížeči: historie, oblíbené, režim mapy, odkaz `?q=`

## Data a limity (technické poznámky)

Aplikace nese **vlastní lokální kopie** inventárních JSON (`supliky.json`, `beta-data/…`) přímo v tomto repozitáři. Za běhu **nečte** remote URL původního `Akumo_sklad2` (ten je nyní private) ani jeho Pages.

Snapshot byl pořízen z dřívějšího veřejného exportu SKLAD 2:

| Soubor | Obsah |
| --- | --- |
| `supliky.json` | 277 šuplíků `[kód, název, volitelná poznámka]` |
| `beta-data/part1.json` … `part4.json` | 209 dílů `[kód, název, kategorie, množství, šuplík, poznámka]` |

- Množství je **inventurní údaj / evidence**, ne živý ERP sklad.
- Mapa je **schéma podle označení** (`A1`, `E3`…), ne fyzický půdorys — v datech nejsou XYZ souřadnice.
- Historie, oblíbené a režim mapy se ukládají jen v `localStorage` daného prohlížeče.
- Barevnost je inspirovaná veřejným CSS [akumo.cz](https://www.akumo.cz/) (zelená `#7db828`).

Kontrolní součty: `data/CHECKSUMS.sha256`.

## Skenování

1. Uživatel klepne **Skenovat** (kamera se nežádá při načtení stránky).
2. Pokud prohlížeč nabízí `BarcodeDetector` s 1D formáty (`ean_13`, `ean_8`, `code_128`), použije se nativní cesta.
3. Jinak se **až po klepnutí** načte lokální vendored `@zxing/browser@0.1.5` z `vendor/zxing/` (Apache-2.0) — žádné CDN za běhu.
4. Po úspěchu se kamera i dekódování zastaví, raw kód (včetně úvodních nul) jde do hledání.

## Spuštění

```bash
python3 -m http.server 8080
```

Otevři `http://127.0.0.1:8080/` (pro kameru v produkci HTTPS / GitHub Pages).

## Testy

```bash
npm test
npm run check:js
```

Mockované testy skeneru **nejsou** náhradou za fyzické skenování na iPhonu.

## Větve

- `main` — výchozí README
- `feature/akumo-v3` — aplikace (GitHub Pages z této větve)

Původní `Akumo_sklad2` se v tomto workstreamu nemění (viditelnost řeší vlastník zvlášť).
