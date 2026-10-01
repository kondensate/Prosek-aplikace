import type { Match } from './types';
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dateCs = (s: string) => `${Number(s.slice(8))}. ${Number(s.slice(5, 7))}. ${s.slice(0, 4)}`;
export const dateLong = (s: string) => new Intl.DateTimeFormat('cs', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parse(s));
export const monthLabel = (d: Date) => new Intl.DateTimeFormat('cs', { month: 'long', year: 'numeric' }).format(d);
export const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}`;
};
export const sortMatches = (a: Match, b: Match) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
export const isHome = (m: Match, team: string) => m.homeTeam.startsWith(team.replace(/ [AB]$/, '')) || m.homeTeam === team;
