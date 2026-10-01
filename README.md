# Prosek Volejbal

Mobilní PWA (React + TypeScript + Vite) se zápasy, výsledky a změnami termínů. Běží jako statický web na GitHub Pages, data se aktualizují automaticky přes GitHub Actions.

```
ZDROJ DAT → scripts/update-matches.mjs → normalizace + validace → public/data/*.json → aplikace
```

## Lokální spuštění
```bash
npm install
npm run dev          # vývoj
npm run build        # produkční build (kontrola typů + vite)
npm run update       # ruční import (vyžaduje DATA_SOURCE_URL)
```

## Nasazení na GitHub
1. Vytvořte repozitář a nahrajte obsah projektu (větev `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: přidejte
   - `DATA_SOURCE_URL` – adresa zdroje (ICS / JSON / HTML),
   - `DATA_SOURCE_TYPE` – `ics`, `json` nebo `html` (výchozí `ics`).
4. **Actions → Update matches → Run workflow**. Poté se import spouští každých 6 hodin.

Aplikace pak běží na `https://<uživatel>.github.io/<repozitář>/`. Na iPhonu: Safari → Sdílet → Přidat na plochu.

## Zdroj dat (důležité)
Přesný veřejný zdroj nebyl při vytváření ověřen (bez přístupu k síti). Proto je zdroj konfigurovatelný v **jednom souboru `scripts/data-source.mjs`**:
- `ics` – nejspolehlivější, pokud ČVS/klub nabízí ICS export kalendáře,
- `json` – API; mapování polí v `jsonFields`,
- `html` – scraping tabulky; upravte selektory v `html`.

Do doby nastavení zdroje se zobrazují ukázková data (`id` začíná `sample-`) – smažte je po prvním úspěšném importu.

## Co import dělá
- zachová ID zápasů (z UID/ID zdroje, jinak hash soutěže, kola a týmů),
- při změně data/času uloží `change` (původní termín, čas změny) → v aplikaci „Zápas byl přeložen“,
- při objevení skóre nastaví `finished` a uloží výsledek a sety,
- neplatné záznamy přeskočí; prázdný nebo nedostupný zdroj **nikdy nepřepíše** existující data,
- commit vznikne jen při změně dat; poté se spustí deploy. Používá se pouze `GITHUB_TOKEN`, žádné tajné klíče v kódu.

## Offline a notifikace
- Service worker ukládá aplikaci a poslední data; při výpadku se zobrazí uložená verze.
- Přepínače oznámení se ukládají a žádají o oprávnění. **Skutečný web push** vyžaduje push službu s VAPID klíči (uložit jako GitHub Secrets / v externí službě) a odeslání z Actions při `changes` v `last-update.json`. Architektura je připravena (`changes` seznam), odesílání není implementováno.
- Logo týmů je zatím placeholder s iniciálami; reálná loga lze přidat do `public/` a do `teams.json`.
