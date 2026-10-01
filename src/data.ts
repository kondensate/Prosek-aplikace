import { useCallback, useEffect, useState } from 'react';
import type { LastUpdate, Match } from './types';
import { REFRESH_MS } from './config';

const CACHE_KEY = 'pv-cache-v1';
const STATUSES = ['upcoming', 'live', 'finished', 'postponed', 'cancelled'];

export function isMatch(m: unknown): m is Match {
  const x = m as Match;
  return !!x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && /^\d{2}:\d{2}$/.test(x.time) &&
    typeof x.homeTeam === 'string' && typeof x.awayTeam === 'string' && STATUSES.includes(x.status) && Array.isArray(x.sets);
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface Cached { matches: Match[]; info: LastUpdate | null }

export function useMatches(autoRefresh: boolean) {
  const [state, setState] = useState<Cached & { loading: boolean; error: string | null; offline: boolean }>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
      if (c) return { ...c, loading: true, error: null, offline: false };
    } catch { /* ignorováno */ }
    return { matches: [], info: null, loading: true, error: null, offline: false };
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const raw = await getJson<unknown[]>('matches.json');
      const matches = raw.filter(isMatch);
      const info = await getJson<LastUpdate>('last-update.json').catch(() => null);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, info }));
      setState({ matches, info, loading: false, error: null, offline: false });
    } catch (e) {
      setState((s) => ({
        ...s, loading: false, offline: s.matches.length > 0,
        error: s.matches.length ? null : e instanceof Error ? e.message : 'Data se nepodařilo načíst.',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!autoRefresh) return;
    const t = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh, autoRefresh]);

  return { ...state, refresh };
}
