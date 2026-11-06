# Anonymní historie hledání (Supabase)

Projekt: **Akumo Sklad** (`uyjgjuinqtgstquhhvie`, eu-central-1).  
Tabulka: `public.akumo_search_history` (`dotaz`, `cas`). Žádné ID uživatele, browser fingerprint ani IP.

## Kdy se hledání zapíše

Frontend volá `POST /rest/v1/akumo_search_history` s tělem jen `{ "dotaz": "…" }` když:

1. **Explicitní potvrzení** — odeslání formuláře (Enter / Hledat),
2. **Sken** — úspěšný barcode → `runSearch(true)`,
3. **Lokální historie** — klik na chip „Naposledy“,
4. **Deep-link** `?q=` při startu,
5. **Live input** — až po ~1 s ustálení textu (ne při každém stisku klávesy, ne při přepínání mapy/záložek/oblíbených).

Duplicitní stejný dokončený dotaz (po trim) se znovu neodesílá. Lokální `localStorage` historie zůstává beze změny.

Chyba sítě, offline nebo timeout **nesmí** zpomalit ani rozbít hledání — zápis je fire-and-forget, bez retry fronty.

## Co frontend nikdy neposílá

- sloupec `cas` / `id` (čas nastaví DB přes `default now()` + BEFORE INSERT trigger `now()`),
- identity uživatele, cookies, IP, User-Agent jako identifikátor.

Omezení délky: max **256** znaků (`char_length` / Unicode code points), prázdný/whitespace text se neodesílá. DB navíc `btrim` + CHECK + RLS `WITH CHECK`.

## Práva (veřejný insert-only)

- RLS zapnuté.
- Role `anon` / publishable klíč: **pouze INSERT** do sloupce `dotaz` + `USAGE` na identity sekvenci.
- Žádný veřejný `SELECT` / `UPDATE` / `DELETE`.
- Admin prohlíží historii v **Supabase Dashboard → Table Editor** (postgres / service_role).  
  **Nikdy** nevkládejte service_role/secret do frontendu.

> Veřejný insert-only endpoint **není autentizace**. Kdokoliv s publishable klíčem může vložit falešné dotazy. Rate-limit / Captcha jsou mimo tento scope.

## Konfigurace v repu

| Soubor | Účel |
| --- | --- |
| `js/supabase-config.js` | Project URL + **publishable** klíč |
| `js/history-log.js` | Validace, dedupe, REST insert (`Prefer: return=minimal`) |
| `supabase/schema/akumo_search_history.sql` | Dokumentované nasazené schema (ne CLI migration timestamp) |

Klienti: moderní publishable klíč `sb_publishable_…` (legacy `anon` JWT je kompatibilní, ale preferujeme publishable).

## Ověření

```bash
npm test
npm run check:js
```

Reálný HTTP smoke (mimo unit testy) ověřuje insert + odmítnutí SELECT/UPDATE/DELETE publishable klíčem.
