import { useCallback, useEffect, useRef, useState } from 'react';
import type { LastUpdate, Match, Standing } from './types';
import { DATA_REMOTE, REFRESH_MS } from './config';

const CACHE_KEY = 'pv-cache-v1';
const STATUSES = ['upcoming', 'live', 'finished', 'postponed', 'cancelled'];

export function isMatch(m: unknown): m is Match {
  const x = m as Match;
  return !!x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && /^\d{2}:\d{2}$/.test(x.time) &&
    typeof x.homeTeam === 'string' && typeof x.awayTeam === 'string' && STATUSES.includes(x.status) && Array.isArray(x.sets);
}

async function getJson<T>(file: string): Promise<T> {
  for (const base of [DATA_REMOTE, `${import.meta.env.BASE_URL}data/`]) {
    try {
      const res = await fetch(`${base}${file}`, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as T;
    } catch { /* zkusí se další zdroj */ }
  }
  throw new Error(`${file}: nedostupné`);
}

interface Cached { matches: Match[]; info: LastUpdate | null }

export function useMatches(autoRefresh: boolean) {
  const [state, setState] = useState<Cached & { loading: boolean; error: string | null; offline: boolean; checkedAt: number | null }>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
      if (c) return { ...c, loading: true, error: null, offline: false, checkedAt: null };
    } catch { /* ignorováno */ }
    return { matches: [], info: null, loading: true, error: null, offline: false, checkedAt: null };
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const raw = await getJson<unknown[]>('matches.json');
      const matches = raw.filter(isMatch);
      const info = await getJson<LastUpdate>('last-update.json').catch(() => null);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, info }));
      setState({ matches, info, loading: false, error: null, offline: false, checkedAt: Date.now() });
    } catch (e) {
      setState((s) => ({
        ...s, loading: false, offline: s.matches.length > 0,
        error: s.matches.length ? null : e instanceof Error ? e.message : 'Data se nepodařilo načíst.',
      }));
    }
  }, []);

  const last = useRef(0);
  useEffect(() => {
    const run = () => { last.current = Date.now(); void refresh(); };
    run();
    if (!autoRefresh) return;
    const t = setInterval(run, REFRESH_MS);
    // Aplikace na ploše po otevření z pozadí sama nepřenačítá → obnovit při návratu / obnovení spojení
    const wake = () => { if (document.visibilityState === 'visible' && Date.now() - last.current > 60_000) run(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); };
  }, [refresh, autoRefresh]);

  return { ...state, refresh };
}

const ST_KEY = 'pv-standings-v1';
export function useStandings() {
  const [st, setSt] = useState<Standing[]>(() => { try { return JSON.parse(localStorage.getItem(ST_KEY) ?? '[]') as Standing[]; } catch { return []; } });
  useEffect(() => {
    getJson<Standing[]>('standings.json').then((d) => { if (Array.isArray(d)) { setSt(d); localStorage.setItem(ST_KEY, JSON.stringify(d)); } }).catch(() => { /* tabulky jsou volitelné */ });
  }, []);
  return st;
}
