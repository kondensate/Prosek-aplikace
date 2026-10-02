// Import zápasů z oficiálních stránek ČVS (cvf.cz) – Extraliga chlapců U18 / U20 / U22.
import { load } from 'cheerio';

export const BASE = 'https://www.cvf.cz/souteze/celostatni-souteze';
const UA = 'Mozilla/5.0 (compatible; prosek-volejbal-importer/1.0)';
const DATE_RE = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/;
const pad = (n) => String(n).padStart(2, '0');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function get(url, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'cs' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) { err = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(`${url}: ${err.message}`);
}

const param = (href, key) => { try { return new URL(href, BASE).searchParams.get(key); } catch { return null; } };

/** Z jedné stránky vytáhne bloky zápasů (kontejner s datem, dvěma týmy a odkazem gameId). */
export function extractBlocks(html) {
  const $ = load(html);
  const out = new Map();
  $('a[href*="gameId="]').each((_, a) => {
    const gameId = param($(a).attr('href'), 'gameId');
    if (!gameId || out.has(gameId)) return;
    const own = clean($(a).text());
    const cd = own.match(DATE_RE);
    if (cd && /prosek/i.test(own)) {
      // "club" v textu odkazu je jen alt obrázku loga → týmy odděluje <img>
      const raw = ($(a).html() || '').replace(/<img[^>]*>/gi, '|');
      const parts = clean(load(`<x>${raw}</x>`)('x').text()).split(/\||\bclub\b/i).map(clean).filter(Boolean);
      const ct = own.replace(DATE_RE, '').match(/(\d{1,2}):(\d{2})/);
      const names = parts.slice(1).filter((x) => !DATE_RE.test(x) && !/^\d{1,2}:\d{2}$/.test(x));
      out.set(gameId, { gameId, home: names[0] || '?', away: names[1] || '?', text: own, short: true,
        date: `${cd[3]}-${pad(cd[2])}-${pad(cd[1])}`, time: ct ? `${pad(ct[1])}:${ct[2]}` : '00:00' });
      return;
    }
    let el = $(a);
    for (let i = 0; i < 8; i++) {
      el = el.parent();
      if (!el.length) break;
      const ids = new Set(el.find('a[href*="gameId="]').map((_, x) => param($(x).attr('href'), 'gameId')).get());
      if (ids.size > 1) break; // příliš široký kontejner
      const names = [...new Set(el.find('a[href*="teamId="]').map((_, x) => clean($(x).text())).get().filter(Boolean))];
      const text = clean(el.text());
      const d = text.match(DATE_RE);
      if (names.length >= 2 && d) {
        const t = text.match(/(\d{1,2}):(\d{2})\s*hod/) || text.replace(DATE_RE, '').match(/(\d{1,2}):(\d{2})/);
        out.set(gameId, {
          gameId, home: names[0], away: names[1], text,
          date: `${d[3]}-${pad(d[2])}-${pad(d[1])}`, time: t ? `${pad(t[1])}:${t[2]}` : '00:00',
        });
        break;
      }
    }
  });
  return out;
}

/** Odkazy na další stránky téže soutěže (skupina Proseku, kola, výsledky). */
function relatedUrls(html, compId) {
  const $ = load(html); const urls = new Set(); let groupId = null; let teamId = null;
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href'); const text = clean($(a).text());
    if (/prosek/i.test(text) && param(href, 'teamId')) { teamId ??= param(href, 'teamId'); groupId ??= param(href, 'filteredGroupId'); }
  });
  $('a[href*="mode=program"], a[href*="mode=results"]').each((_, a) => {
    const href = $(a).attr('href');
    if (/round|kolo|turnaj/i.test(href) && param(href, 'competitionId') === String(compId)) urls.add(new URL(href, BASE).href);
  });
  return { urls: [...urls].slice(0, 20), groupId, teamId };
}

function parseDetail(html, home, away, teamFilter = 'prosek') {
  const $ = load(html);
  const text = clean($('body').text());
  const out = {};
  const teams = [...new Set($('h1 a[href*="teamId="], h2 a[href*="teamId="], h3 a[href*="teamId="]').map((_, x) => clean($(x).text())).get().filter(Boolean))];
  const mineA = $('a[href*="teamId="]').filter((_, x) => new RegExp(teamFilter, 'i').test(clean($(x).text()))).first();
  if (mineA.length) out.teamId = param(mineA.attr('href'), 'teamId');
  if (teams.length >= 2) { home = teams[0]; away = teams[1]; out.homeTeam = home; out.awayTeam = away; }
  const dt = text.match(/Datum a čas:\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4}),?\s*(\d{1,2}):(\d{2})/);
  if (dt) { out.date = `${dt[3]}-${pad(dt[2])}-${pad(dt[1])}`; out.time = `${pad(dt[4])}:${dt[5]}`; }
  out.competition = (text.match(/Soutěž:\s*(.*?)\s*(?=Datum a čas:|Místo konání:|$)/) || [])[1];
  let venue = (text.match(/Místo konání:\s*(.*?)\s*(?=Rozhodčí:|Delegát|Datum a čas:|Soutěž:|$)/) || [])[1] || '';
  const hi = venue.indexOf(home); if (hi > 0) venue = venue.slice(0, hi);
  out.venue = clean(venue).slice(0, 90);
  const start = Math.max(0, text.indexOf('Místo konání'));
  const ih = text.indexOf(home, start); const ia = ih >= 0 ? text.indexOf(away, ih + home.length) : -1;
  if (ih >= 0 && ia > ih) {
    const between = text.slice(ih + home.length, ia);
    const sc = between.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
    if (sc) {
      out.homeScore = +sc[1]; out.awayScore = +sc[2];
      const rest = text.slice(ia + away.length, ia + away.length + 600);
      const sets = [...rest.matchAll(/(\d{1,2})\s*:\s*(\d{1,2})/g)].map((m) => ({ home: +m[1], away: +m[2] }))
        .filter((s) => Math.max(s.home, s.away) >= 15 && Math.max(s.home, s.away) <= 60);
      if (sets.length >= out.homeScore + out.awayScore) out.sets = sets.slice(0, out.homeScore + out.awayScore);
    }
  }
  const body = text.slice(Math.max(0, start - 200), start + 800);
  if (/zrušen/i.test(body)) out.status = 'cancelled';
  else if (/odložen|přeložen/i.test(body)) out.status = 'postponed';
  return out;
}

export async function fetchCvf(cfg) {
  const rows = [];
  for (const comp of cfg.competitions) {
    const blocks = new Map();
    const seen = new Set();
    const add = async (url) => {
      if (seen.has(url)) return null;
      seen.add(url);
      const html = await get(url);
      for (const [k, v] of extractBlocks(html)) if (!blocks.has(k)) blocks.set(k, v);
      return html;
    };
    const first = await add(`${BASE}?mode=program&competitionId=${comp.id}`);
    const { urls, groupId, teamId } = relatedUrls(first, comp.id);
    const extra = [`${BASE}?mode=results&competitionId=${comp.id}`, ...urls];
    if (groupId) extra.push(`${BASE}?mode=program&competitionId=${comp.id}&filteredGroupId=${groupId}`, `${BASE}?mode=results&competitionId=${comp.id}&filteredGroupId=${groupId}`);
    if (teamId) extra.push(`${BASE}?mode=clubs&competitionId=${comp.id}&teamId=${teamId}`);
    for (const u of extra) { try { await add(u); } catch (e) { console.warn('  přeskočeno:', e.message); } }

    const mine = [...blocks.values()].filter((b) => new RegExp(cfg.teamFilter, 'i').test(`${b.home} ${b.away} ${b.text}`));
    if (!mine.length) { const $f = load(first); console.warn('  Ukázka odkazů s textem Prosek:', $f('a').filter((_, x) => /prosek/i.test($f(x).text())).slice(0, 3).map((_, x) => $f.html(x).slice(0, 400)).get()); }
    console.log(`${comp.category} (${comp.id}): zápasů na stránkách ${blocks.size}, Prosek ${mine.length}`);
    if (!blocks.size) console.warn('  VAROVÁNÍ: nenalezen žádný zápas – struktura stránky se asi změnila. Začátek stránky:\n', clean(load(first)('body').text()).slice(0, 800));

    const done = new Set();
    let proTeamId = teamId;
    const handle = async (b) => {
      if (done.has(b.gameId)) return;
      done.add(b.gameId);
      let d = {};
      try {
        const html = await get(`${BASE}?mode=program&competitionId=${comp.id}&gameId=${b.gameId}`);
        d = parseDetail(html, b.home, b.away, cfg.teamFilter);
      } catch (e) { console.warn(`  detail ${b.gameId} nedostupný:`, e.message); }
      proTeamId ??= d.teamId;
      const homeName = d.homeTeam || b.home; const awayName = d.awayTeam || b.away;
      const date = d.date || b.date; const time = d.time || b.time;
      if (!date || !homeName || homeName === '?' ) { console.warn(`  zápas ${b.gameId} přeskočen (chybí údaje)`); return; }
      const home = new RegExp(cfg.teamFilter, 'i').test(homeName);
      const finished = d.homeScore !== undefined;
      rows.push({
        id: `cvf-${b.gameId}`, date, time: time || '00:00', category: comp.category,
        competition: d.competition || comp.name, round: '', homeTeam: homeName, awayTeam: awayName,
        venue: d.venue || (home ? '' : 'Hala neuvedena'), address: home ? '' : `domácí tým: ${homeName}`,
        status: d.status || (finished ? 'finished' : 'upcoming'),
        homeScore: d.homeScore ?? null, awayScore: d.awayScore ?? null, sets: d.sets || [],
      });
    };
    for (const b of mine) await handle(b);

    // Stránka týmu: výpis jeho zápasů napříč dny (sobota + neděle, další kola)
    if (proTeamId) {
      for (const mode of ['clubs']) {
        try {
          const html = await get(`${BASE}?mode=${mode}&competitionId=${comp.id}&teamId=${proTeamId}`);
          const $t = load(html); const ids = new Set();
          $t('a[href*="gameId="]').each((_, x) => { const g = param($t(x).attr('href'), 'gameId'); if (g) ids.add(g); });
          console.log(`  stránka týmu ${proTeamId}: odkazů na zápasy ${ids.size}`);
          for (const g of ids) await handle({ gameId: g, home: '?', away: '?', text: '', date: '', time: '' });
        } catch (e) { console.warn('  stránka týmu nedostupná:', e.message); }
      }
    } else console.warn('  ID týmu Prosek se nepodařilo zjistit');
  }
  return rows;
}
