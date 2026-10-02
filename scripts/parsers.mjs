import { createHash } from 'node:crypto';

const CATS = ['U18', 'U20', 'U22', 'Muži'];
export const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

export function detectCategory(text = '') {
  const m = text.toUpperCase().match(/U\s?(18|20|22)/);
  if (m) return `U${m[1]}`;
  return /TR[ÉE]NINK|TRAINING/i.test(text) ? 'Trénink' : 'U18';
}

const pragueParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(d).map((p) => [p.type, p.value]));

function icsDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  if (m[7]) { const p = pragueParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : '00:00' };
}

const unesc = (s) => s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();

export function parseIcs(text, defaults) {
  const lines = text.replace(/\r/g, '').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT' && ev) {
      const dt = ev.DTSTART && icsDate(ev.DTSTART);
      if (dt && ev.SUMMARY) {
        const [home, away = ''] = unesc(ev.SUMMARY).split(/\s+[–—-]\s+/);
        const desc = unesc(ev.DESCRIPTION || '');
        const score = (unesc(ev.SUMMARY) + ' ' + desc).match(/(\d)\s?:\s?(\d)(?!\d)/);
        const cancelled = /CANCELLED/i.test(ev.STATUS || '') || /zrušen/i.test(desc);
        const loc = unesc(ev.LOCATION || '');
        out.push({
          id: ev.UID ? `ics-${hash(ev.UID)}` : undefined, ...dt, category: detectCategory(`${ev.SUMMARY} ${desc} ${ev.CATEGORIES || ''}`),
          competition: desc.split(/[|\n]/)[0] || '', round: '', homeTeam: home.replace(/\s*\d:\d.*$/, ''), awayTeam: away.replace(/\s*\d:\d.*$/, ''),
          venue: loc.split(',')[0] || defaults.venue, address: loc.includes(',') ? loc.split(',').slice(1).join(',').trim() : defaults.address,
          status: cancelled ? 'cancelled' : score ? 'finished' : 'upcoming',
          homeScore: score ? +score[1] : null, awayScore: score ? +score[2] : null, sets: [],
        });
      }
      ev = null;
    } else if (ev) {
      const i = line.indexOf(':'); if (i < 0) continue;
      ev[line.slice(0, i).split(';')[0]] = line.slice(i + 1);
    }
  }
  return out;
}

export function parseJson(text, cfg) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.matches ?? data.items ?? [];
  const f = cfg.jsonFields;
  return arr.map((r) => ({ ...Object.fromEntries(Object.entries(f).map(([k, src]) => [k, r[src]])) }));
}

export async function parseHtml(text, cfg) {
  const { load } = await import('cheerio');
  const $ = load(text); const c = cfg.html.cells; const out = [];
  $(cfg.html.row).each((_, tr) => {
    const g = (k) => $(tr).find(c[k]).first().text().replace(/\s+/g, ' ').trim();
    const d = g('date').match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/); const t = g('time').match(/(\d{1,2})[:.](\d{2})/);
    if (!d || !g('homeTeam')) return;
    const sc = g('score').match(/(\d)\s?:\s?(\d)/);
    out.push({
      date: `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`, time: t ? `${t[1].padStart(2, '0')}:${t[2]}` : '00:00',
      category: detectCategory(g('category')), competition: g('category'), homeTeam: g('homeTeam'), awayTeam: g('awayTeam'),
      venue: g('venue'), status: sc ? 'finished' : 'upcoming', homeScore: sc ? +sc[1] : null, awayScore: sc ? +sc[2] : null, sets: [],
    });
  });
  return out;
}

const STATUSES = ['upcoming', 'live', 'finished', 'postponed', 'cancelled'];
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(+v) ? null : +v);

/** Sjednocení do datového modelu + validace. Neplatné záznamy vrací v `rejected`. */
export function normalize(rows, defaults) {
  const matches = []; const rejected = [];
  for (const r of rows) {
    const date = String(r.date ?? '').slice(0, 10); const time = String(r.time ?? '').slice(0, 5);
    const m = {
      id: '', date, time, category: CATS.includes(r.category) || r.category === 'Trénink' ? r.category : detectCategory(`${r.category ?? ''} ${r.competition ?? ''}`),
      competition: String(r.competition ?? ''), round: String(r.round ?? ''), homeTeam: String(r.homeTeam ?? '').trim(), awayTeam: String(r.awayTeam ?? '').trim(),
      venue: String(r.venue || defaults.venue), address: String(r.address ?? defaults.address ?? ''),
      status: STATUSES.includes(r.status) ? r.status : 'upcoming', homeScore: num(r.homeScore), awayScore: num(r.awayScore),
      sets: Array.isArray(r.sets) ? r.sets.filter((s) => num(s?.home) !== null && num(s?.away) !== null).map((s) => ({ home: +s.home, away: +s.away })) : [],
    };
    if (m.homeScore !== null && m.awayScore !== null && m.status === 'upcoming') m.status = 'finished';
    // Stabilní ID: ze zdroje, jinak z kategorie + týmů + kola (nezávisí na datu → přesun termínu se pozná)
    m.id = r.id ? String(r.id) : `m-${hash([m.category, m.competition, m.round, m.homeTeam, m.awayTeam].join('|'))}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !/^\d{2}:\d{2}$/.test(m.time) || !m.homeTeam || !m.awayTeam) { rejected.push(r); continue; }
    if (defaults.teamFilter && !`${m.homeTeam} ${m.awayTeam}`.toLowerCase().includes(defaults.teamFilter.toLowerCase())) continue;
    matches.push(m);
  }
  return { matches, rejected };
}
