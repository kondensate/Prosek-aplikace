import type { Category, Settings } from './types';

export const CATEGORIES: Category[] = ['U18', 'U20', 'U22', 'Trénink'];
export const CATEGORY_LABEL: Record<Category, string> = { U18: 'U18', U20: 'U20', U22: 'U22', Trénink: 'Tréninky' };
export const CLUB_NAME = 'SK Prosek Praha';
export const CLUB_WEB = 'https://www.volejbalek.cz';
// Přesné podstránky webu doplňte podle skutečné struktury webu klubu.
export const WEB_LINKS = [
  { label: 'Aktuální články', url: CLUB_WEB },
  { label: 'Výsledky', url: CLUB_WEB },
  { label: 'Informace o klubu', url: CLUB_WEB },
  { label: 'Oficiální stránky', url: CLUB_WEB },
];
export const REFRESH_MS = 6 * 60 * 60 * 1000;
export const STATUS_LABEL = {
  upcoming: 'Nadcházející', live: 'Probíhá', finished: 'Odehráno', postponed: 'Přeloženo', cancelled: 'Zrušeno',
} as const;
export const DEFAULT_SETTINGS: Settings = {
  team: CLUB_NAME, categories: { U18: true, U20: true, U22: true, Trénink: true },
  notifyMatch: true, notifyChange: true, notifyResult: true, autoRefresh: true, theme: 'dark',
};
