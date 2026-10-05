// ZDROJ DAT → IMPORT → NORMALIZACE → JSON → APLIKACE
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { DATA_SOURCE } from './data-source.mjs';
import { fetchCvf } from './cvf.mjs';
import { parseIcs, parseJson, parseHtml, normalize } from './parsers.mjs';

const DIR = new URL('../public/data/', import.meta.url);
const DRY = process.argv.includes('--dry-run');
const readJson = async (f, fallback) => { try { return JSON.parse(await readFile(new URL(f, DIR), 'utf8')); } catch { return fallback; } };

/** Sloučí nová data se starými: zachová ID, zjistí přesuny termínů, aktualizuje výsledky. */
export function merge(oldList, fresh, now = new Date().toISOString()) {
  const old = new Map(oldList.map((m) => [m.id, m]));
  const changes = []; const seen = new Set();
  const merged = fresh.map((n) => {
    seen.add(n.id); const o = old.get(n.id);
    if (!o) return n;
    let change = o.change;
    if (o.date !== n.date || o.time !== n.time) {
      change = { originalDate: o.change?.originalDate ?? o.date, originalTime: o.change?.originalTime ?? o.time, changedAt: now };
      changes.push(`${n.id}: termín ${o.date} ${o.time} → ${n.date} ${n.time}`);
    }
    if (o.status !== 'finished' && n.status === 'finished') changes.push(`${n.id}: výsledek ${n.homeScore}:${n.awayScore}`);
    if (o.status !== n.status && n.status === 'cancelled') changes.push(`${n.id}: zrušeno`);
    return change ? { ...n, change } : n;
  });
  // Zápasy, které zdroj zatím nevrací, neničíme (odehrané zůstávají v historii).
  for (const o of oldList) if (!seen.has(o.id) && o.status === 'finished') merged.push(o);
  merged.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return { merged, changes };
}

let STANDINGS = [];

async function fetchRows(known = new Map()) {
  const { type, url } = DATA_SOURCE;
  if (type === 'cvf') {
    const r = await fetchCvf({ competitions: DATA_SOURCE.competitions, teamFilter: DATA_SOURCE.defaults.teamFilter, known });
    STANDINGS = r.standings;
    return r.rows;
  }
  if (!url) throw new Error('DATA_SOURCE_URL není nastaveno (viz scripts/data-source.mjs a README).');
  const res = await fetch(url, { headers: { 'User-Agent': 'prosek-volejbal-importer/1.0' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Zdroj vrátil HTTP ${res.status}`);
  const text = await res.text();
  if (type === 'ics') return parseIcs(text, DATA_SOURCE.defaults);
  if (type === 'json') return parseJson(text, DATA_SOURCE);
  if (type === 'html') return parseHtml(text, DATA_SOURCE);
  throw new Error(`Neznámý typ zdroje: ${type}`);
}

async function main() {
  const oldList = await readJson('matches.json', []);
  const rows = await fetchRows(new Map(oldList.map((m) => [m.id, m])));
  const { matches, rejected } = normalize(rows, DATA_SOURCE.defaults);
  if (rejected.length) console.warn(`Přeskočeno ${rejected.length} neplatných záznamů.`);
  // Ochrana: prázdný/rozbitý zdroj nikdy nepřepíše fungující data.
  if (!matches.length) throw new Error('Zdroj nevrátil žádné platné zápasy – data zůstávají beze změny.');

  const allowed = new Set(DATA_SOURCE.type === 'cvf' ? DATA_SOURCE.competitions.map((c) => c.category) : ['U18', 'U20', 'U22', 'Trénink']);
  const { merged: all, changes } = merge(oldList, matches);
  const merged = all.filter((m) => allowed.has(m.category)); // kategorie, které už nesledujeme, se z dat odstraní
  const same = JSON.stringify(oldList) === JSON.stringify(merged);
  console.log(`Zápasů: ${merged.length}, změn: ${changes.length}`);
  changes.forEach((c) => console.log(' •', c));
  // Tabulky skupin (volitelné – jejich selhání import zápasů nezastaví)
  let standingsChanged = false;
  if (STANDINGS.length && !DRY) {
    const oldSt = await readJson('standings.json', []);
    standingsChanged = JSON.stringify(oldSt) !== JSON.stringify(STANDINGS);
    if (standingsChanged) { await mkdir(DIR, { recursive: true }); await writeFile(new URL('standings.json', DIR), JSON.stringify(STANDINGS, null, 2) + '\n'); console.log('Tabulky skupin aktualizovány.'); }
  }
  if (DRY || same) { if (same) console.log('Data se nezměnila.'); return; }

  await mkdir(DIR, { recursive: true });
  await writeFile(new URL('matches.json', DIR), JSON.stringify(merged, null, 2) + '\n');
  await writeFile(new URL('last-update.json', DIR), JSON.stringify({ updatedAt: new Date().toISOString(), source: DATA_SOURCE.url, count: merged.length, changes }, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error('Import selhal:', e.message); process.exit(1); });
