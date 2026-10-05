import { useEffect, useMemo, useState } from 'react';
import type { Category, Match, Settings } from './types';
import { CATEGORIES, CATEGORY_LABEL, CLUB_WEB, DEFAULT_SETTINGS, WEB_LINKS } from './config';
import { useMatches, useStandings } from './data';
import { dateLong, monthLabel, sortMatches, stamp, ymd } from './format';
import { Calendar, CategoryFilter, Detail, Empty, MatchCard, Results, Standings } from './components';

type Tab = 'calendar' | 'results' | 'table' | 'web' | 'settings';
const TABS: [Tab, string, string][] = [['calendar', 'Kalendář', '🗓'], ['results', 'Výsledky', '🏆'], ['table', 'Tabulky', '📊'], ['web', 'Web', '🌐'], ['settings', 'Nastavení', '⚙️']];

function useSettings() {
  const [s, setS] = useState<Settings>(() => {
    try { const saved = JSON.parse(localStorage.getItem('pv-settings') ?? '{}') as Partial<Settings>; return { ...DEFAULT_SETTINGS, ...saved, categories: { ...DEFAULT_SETTINGS.categories, ...saved.categories } }; } catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => { localStorage.setItem('pv-settings', JSON.stringify(s)); document.documentElement.dataset.theme = s.theme; }, [s]);
  return [s, setS] as const;
}

export function App() {
  const [settings, setSettings] = useSettings();
  const { matches, info, loading, error, offline, checkedAt, refresh } = useMatches(settings.autoRefresh);
  const standings = useStandings();
  const [tab, setTab] = useState<Tab>('calendar');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(ymd(new Date()));
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [open, setOpen] = useState<Match | null>(null);

  const visible = useMemo(
    () => matches.filter((m) => settings.categories[m.category] && (filter === 'all' || m.category === filter)).sort(sortMatches),
    [matches, settings.categories, filter],
  );
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const today = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(ymd(d)); };
  const dayMatches = visible.filter((m) => m.date === selected);
  const monthMatches = visible.filter((m) => m.date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`));

  if (open) {
    return <main className="app"><Detail m={open} same={matches.filter((x) => x.date === open.date && x.id !== open.id)} onBack={() => setOpen(null)} onOpen={setOpen} /></main>;
  }

  const toggleNotif = (key: 'notifyMatch' | 'notifyChange' | 'notifyResult') => {
    const next = !settings[key];
    setSettings({ ...settings, [key]: next });
    if (next && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  };

  return (
    <>
      <main className="app">
        {tab === 'calendar' && <>
          <h1>Prosek Volejbal</h1>
          <div className="toolbar">
            <button className="icon" onClick={() => shift(-1)} aria-label="Předchozí měsíc">‹</button>
            <span className="month">{monthLabel(month)}</span>
            <button className="icon" onClick={() => shift(1)} aria-label="Další měsíc">›</button>
            <button className="icon txt" onClick={today}>Dnes</button>
            <button className="icon" onClick={() => void refresh()} aria-label="Aktualizovat">{loading ? '…' : '↻'}</button>
          </div>
          <CategoryFilter value={filter} onChange={setFilter} />
          <p className="muted small">{info ? `Poslední změna dat: ${stamp(info.updatedAt)}` : 'Zatím neaktualizováno'}{checkedAt && ` · zkontrolováno ${new Date(checkedAt).getHours()}:${String(new Date(checkedAt).getMinutes()).padStart(2, '0')}`}{offline && ' · offline, zobrazena uložená data'}</p>
          {error && <p className="alert">Data se nepodařilo načíst ({error}). Zkuste to později.</p>}
          {!error && !loading && !matches.length && <Empty>Zatím nejsou k dispozici žádné zápasy.</Empty>}
          <Calendar month={month} matches={monthMatches} selected={selected} onSelect={setSelected} />
          <h2>Kalendář</h2>
          <p className="muted">{dateLong(selected)}</p>
          {dayMatches.length ? dayMatches.map((m) => <MatchCard key={m.id} m={m} onOpen={setOpen} />) : <Empty>V tento den nejsou žádné zápasy.</Empty>}
          {filter !== 'all' && <>
            <h3>Zápasy – {CATEGORY_LABEL[filter]}</h3>
            {visible.filter((m) => m.status === 'upcoming').slice(0, 6).map((m) => <MatchCard key={m.id} m={m} onOpen={setOpen} showDate />)}
          </>}
        </>}

        {tab === 'results' && <><h1>Výsledky</h1><Results matches={visible} team={settings.team} onOpen={setOpen} /></>}

        {tab === 'table' && <><h1>Tabulky</h1><Standings data={standings.filter((t) => settings.categories[t.category])} /></>}

        {tab === 'web' && <>
          <h1>Web</h1><p className="muted">Oficiální stránky Prosek Volejbal</p>
          <div className="card list">{WEB_LINKS.map((l) => <a key={l.label} className="link-row" href={l.url} target="_blank" rel="noreferrer"><span>{l.label}</span>›</a>)}</div>
          <p className="muted small">Web klubu se otevře v prohlížeči: {CLUB_WEB.replace('https://', '')}</p>
        </>}

        {tab === 'settings' && <>
          <h1>Nastavení</h1>
          <div className="card list"><label className="row between">Tým<input className="txt-input" value={settings.team} onChange={(e) => setSettings({ ...settings, team: e.target.value })} /></label></div>
          <h3>Zobrazované kategorie</h3>
          <div className="card list">{CATEGORIES.map((c) => (
            <label key={c} className="row between">{CATEGORY_LABEL[c]}<input type="checkbox" checked={settings.categories[c]} onChange={() => setSettings({ ...settings, categories: { ...settings.categories, [c]: !settings.categories[c] } })} /></label>))}</div>
          <h3>Oznámení</h3>
          <div className="card list">
            {([['notifyMatch', 'Upozornění na zápasy'], ['notifyChange', 'Změny termínů'], ['notifyResult', 'Výsledky zápasů']] as const).map(([k, l]) => (
              <label key={k} className="row between">{l}<input type="checkbox" className="switch" checked={settings[k]} onChange={() => toggleNotif(k)} /></label>))}
          </div>
          <h3>Automatická aktualizace</h3>
          <div className="card list">
            <label className="row between">Automaticky načítat data<input type="checkbox" className="switch" checked={settings.autoRefresh} onChange={() => setSettings({ ...settings, autoRefresh: !settings.autoRefresh })} /></label>
            <div className="row between"><span>Poslední aktualizace</span><span className="muted">{info ? stamp(info.updatedAt) : '–'}</span></div>
            <button className="link-row" onClick={() => void refresh()}><span>{loading ? 'Načítám…' : 'Aktualizovat teď'}</span>↻</button>
          </div>
          <h3>Vzhled</h3>
          <div className="card list"><label className="row between">Světlý režim<input type="checkbox" className="switch" checked={settings.theme === 'light'} onChange={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })} /></label></div>
          <div className="card list"><div className="row between"><span>O aplikaci</span><span className="muted">Verze 1.0</span></div></div>
        </>}
      </main>
      <nav className="tabbar">{TABS.map(([id, label, icon]) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>))}</nav>
    </>
  );
}
