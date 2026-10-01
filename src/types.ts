export type Category = 'U18' | 'U20' | 'U22' | 'Trénink';
export type Status = 'upcoming' | 'live' | 'finished' | 'postponed' | 'cancelled';
export interface SetScore { home: number; away: number }
export interface Change { originalDate: string; originalTime: string; changedAt: string }
export interface Match {
  id: string; date: string; time: string; category: Category; competition: string; round: string;
  homeTeam: string; awayTeam: string; venue: string; address: string; status: Status;
  homeScore: number | null; awayScore: number | null; sets: SetScore[]; change?: Change;
}
export interface LastUpdate { updatedAt: string; source: string; count: number; changes: string[] }
export interface Settings {
  team: string; categories: Record<Category, boolean>;
  notifyMatch: boolean; notifyChange: boolean; notifyResult: boolean;
  autoRefresh: boolean; theme: 'dark' | 'light';
}
