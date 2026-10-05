import type { Category, Settings } from './types';

export const CATEGORIES: Category[] = ['U18', 'U20', 'U22', 'Trénink'];
export const CATEGORY_LABEL: Record<Category, string> = { U18: 'U18', U20: 'U20', U22: 'U22', Trénink: 'Tréninky' };
export const CLUB_NAME = 'SK Prosek Praha';
export const CLUB_WEB = 'https://www.volejbalek.cz';
// Přesné podstránky webu doplňte podle skutečné struktury webu klubu.
export const WEB_LINKS = [
  { label: 'Informace o klubu', url: CLUB_WEB },
  { label: 'Oficiální stránky ČVS', url: 'https://www.cvf.cz' },
  { label: 'Pina', url: 'https://pinaprosek.eu/dluhy' },
];
export const REFRESH_MS = 30 * 60 * 1000;
export const STATUS_LABEL = {
  upcoming: 'Nadcházející', live: 'Probíhá', finished: 'Odehráno', postponed: 'Přeloženo', cancelled: 'Zrušeno',
} as const;
export const DEFAULT_SETTINGS: Settings = {
  team: CLUB_NAME, categories: { U18: true, U20: true, U22: true, Trénink: true },
  notifyMatch: true, notifyChange: true, notifyResult: true, autoRefresh: true, theme: 'dark',
};

// Data se čtou přímo z repozitáře (bez čekání na nové nasazení webu); při výpadku se použije kopie přímo z webu.
export const DATA_REMOTE = 'https://raw.githubusercontent.com/kondensate/Prosek-aplikace/main/public/data/';
