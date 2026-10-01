import type { ReactNode } from 'react';
import type { Category, Match } from './types';
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL } from './config';
import { dateCs, dateLong, isHome, monthLabel, pad, ymd } from './format';

export const Pin = () => <span className="pin" aria-hidden>📍</span>;

export function MatchCard({ m, onOpen, showDate }: { m: Match; onOpen: (m: Match) => void; showDate?: boolean }) {
  return (
    <button className="card match" onClick={() => onOpen(m)}>
      <div className="row between">
        <span><span className="badge">{m.category}</span><span className="muted"> {m.competition}</span></span>
        <span className="muted">{showDate ? `${dateCs(m.date)} ${m.time}` : m.time}</span>
      </div>
      <strong className="teams">{m.homeTeam} – {m.awayTeam}</strong>
      <div className="row between muted"><span><Pin /> {m.venue}</span>
        {m.change ? <span className="tag warn">Přeloženo</span> : m.status !== 'upcoming' && <span className="tag">{STATUS_LABEL[m.status]}</span>}
      </div>
    </button>
  );
}

export function Calendar({ month, matches, selected, onSelect }: {
  month: Date; matches: Match[]; selected: string; onSelect: (d: string) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const byDay = new Map<string, Match[]>();
  matches.forEach((m) => byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]));
  const today = ymd(new Date());
  return (
    <div className="card cal">
      <div className="grid head">{['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}`;
          const ms = byDay.get(key) ?? [];
          return (
            <button key={key} className={`day ${key === selected ? 'sel' : ''} ${key === today ? 'today' : ''}`} onClick={() => onSelect(key)} aria-label={`${d}. ${monthLabel(month)}`}>
              <span>{d}</span>
              {ms.slice(0, 2).map((m) => <i key={m.id} className="chip">{m.time}</i>)}
              {ms.length > 2 && <i className="chip">+{ms.length - 2}</i>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryFilter({ value, onChange }: { value: Category | 'all'; onChange: (v: Category | 'all') => void }) {
  return (
    <div className="pills" role="tablist">
      {(['all', ...CATEGORIES] as const).map((c) => (
        <button key={c} className={`pill ${value === c ? 'on' : ''}`} onClick={() => onChange(c)}>{c === 'all' ? 'Vše' : CATEGORY_LABEL[c]}</button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p>; }

export function Detail({ m, same, onBack, onOpen }: { m: Match; same: Match[]; onBack: () => void; onOpen: (m: Match) => void }) {
  const q = encodeURIComponent(`${m.venue} ${m.address}`);
  const rows: [string, string][] = [
    ['Datum', dateCs(m.date)], ['Čas', m.time], ['Soutěž', m.competition], ['Kolo / turnaj', m.round || '–'],
    ['Hala', m.venue], ['Adresa', m.address], ['Stav', STATUS_LABEL[m.status]],
  ];
  const logo = (n: string) => <span className="logo">{n.split(' ').filter((w) => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(w)).slice(-2).map((w) => w[0]).join('')}</span>;
  return (
    <div className="detail">
      <div className="row between topbar"><button className="link" onClick={onBack}>‹ Zpět</button></div>
      <div className="card">
        <div className="row"><span className="badge">{m.category}</span><span className="muted">{m.competition}</span></div>
        {m.change && <p className="alert">Zápas byl přeložen z {dateCs(m.change.originalDate)} {m.change.originalTime}.</p>}
        <p className="center muted">{dateLong(m.date)}<br /><b className="big">{m.time}</b></p>
        <div className="vs">
          <div>{logo(m.homeTeam)}<b>{m.homeTeam}</b></div>
          <div className="score">{m.status === 'finished' ? `${m.homeScore} : ${m.awayScore}` : '–'}</div>
          <div>{logo(m.awayTeam)}<b>{m.awayTeam}</b></div>
        </div>
        {m.sets.length > 0 && <p className="center muted">Sety: {m.sets.map((s) => `${s.home}:${s.away}`).join(', ')}</p>}
        <p className="muted"><Pin /> {m.venue}<br />{m.address}</p>
        <a className="btn" href={`https://maps.apple.com/?q=${q}`} target="_blank" rel="noreferrer">Otevřít v mapách</a>
      </div>
      <div className="card list">{rows.map(([k, v]) => <div key={k} className="row between"><span className="muted">{k}</span><span className="right">{v}</span></div>)}</div>
      {same.length > 0 && <>
        <h3>Další zápasy v tento den</h3>
        <div className="card list">{same.map((s) => <button key={s.id} className="link-row" onClick={() => onOpen(s)}><span>{s.homeTeam} – {s.awayTeam}<br /><span className="muted">{s.time} {s.category}</span></span>›</button>)}</div>
      </>}
    </div>
  );
}

export function Results({ matches, team, onOpen }: { matches: Match[]; team: string; onOpen: (m: Match) => void }) {
  const done = matches.filter((m) => m.status === 'finished' && m.homeScore !== null).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  if (!done.length) return <Empty>Zatím nejsou k dispozici žádné výsledky.</Empty>;
  return <>{done.map((m) => {
    const home = isHome(m, team); const mine = home ? m.homeScore! : m.awayScore!; const theirs = home ? m.awayScore! : m.homeScore!;
    const win = mine > theirs;
    return (
      <button key={m.id} className={`card match res ${win ? 'win' : 'loss'}`} onClick={() => onOpen(m)}>
        <div className="row between"><span className="muted">{dateCs(m.date)} · {m.competition}</span><span className="tag">{home ? 'Doma' : 'Venku'}</span></div>
        <div className="row between"><strong>{home ? m.awayTeam : m.homeTeam}</strong><strong className={win ? 'w' : 'l'}>{m.homeScore}:{m.awayScore}</strong></div>
        <span className="muted">{m.sets.map((s) => `${s.home}:${s.away}`).join('  ')}</span>
      </button>);
  })}</>;
}
