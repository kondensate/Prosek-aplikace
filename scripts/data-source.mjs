// ============================================================
//  JEDINÉ MÍSTO PRO NASTAVENÍ ZDROJE DAT
//  Zdroj lze změnit i bez úpravy kódu: GitHub → Settings → Secrets and variables
//  → Actions → Variables → DATA_SOURCE_URL (a volitelně DATA_SOURCE_TYPE).
//  Žádné tajné klíče se do kódu nevkládají.
// ============================================================
export const DATA_SOURCE = {
  // 'ics' | 'json' | 'html'
  type: process.env.DATA_SOURCE_TYPE || 'cvf',
  // URL ICS kalendáře / JSON API / HTML stránky s rozpisem (např. export z ČVS / volejbalek.cz)
  url: process.env.DATA_SOURCE_URL || 'https://www.cvf.cz/souteze/celostatni-souteze',
  // Oficiální soutěže ČVS (type 'cvf'): ID soutěže z webu cvf.cz
  competitions: [
    { id: 18670, category: 'U18', name: 'Extraliga chlapci U18' },
    { id: 18666, category: 'U20', name: 'Extraliga chlapci U20' },
    { id: 18662, category: 'U22', name: 'Extraliga chlapci U22' },
  ],
  // Výchozí hodnoty, když zdroj údaj neposkytuje
  defaults: {
    venue: 'SH SK Prosek',
    address: 'Lovosická 559/32, Praha 9',
    teamFilter: 'Prosek', // ponechá jen zápasy, kde se tým vyskytuje ('' = vše)
  },
  // Mapování polí pro type 'json' (název pole ve zdroji → náš model)
  jsonFields: {
    id: 'id', date: 'date', time: 'time', category: 'category', competition: 'competition', round: 'round',
    homeTeam: 'homeTeam', awayTeam: 'awayTeam', venue: 'venue', address: 'address', status: 'status',
    homeScore: 'homeScore', awayScore: 'awayScore', sets: 'sets',
  },
  // CSS selektory pro type 'html' (upravte podle skutečné stránky; řádek tabulky = jeden zápas)
  html: {
    row: 'table tr',
    cells: { date: 'td:nth-child(1)', time: 'td:nth-child(2)', category: 'td:nth-child(3)', homeTeam: 'td:nth-child(4)', awayTeam: 'td:nth-child(5)', score: 'td:nth-child(6)', venue: 'td:nth-child(7)' },
  },
};
