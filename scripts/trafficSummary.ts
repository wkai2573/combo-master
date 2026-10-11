/** 流量事件的原始資料列（對應伺服器的 events 資料表） */
export interface EventRow {
  name: 'visit' | 'start' | 'finish';
  visit_id: string;
  device_id: string;
  version: string;
  opponent: 'cpu' | 'player' | null;
  created_at: number;
  last_seen_at: number;
  /** 造訪才有意義：分頁在前景可見的累計毫秒數 */
  active_ms: number;
}

export interface GroupStats {
  visits: number;
  devices: number;
  avgStaySeconds: number;
  medianStaySeconds: number;
  playedDevices: number;
  finishedDevices: number;
  starts: number;
  finishes: number;
}

export interface Summary {
  all: GroupStats & { returnedDevices: number };
  byDay: Array<GroupStats & { day: string; newDevices: number; returningDevices: number }>;
  byVersion: Array<GroupStats & { version: string }>;
  byOpponent: Array<{ opponent: 'cpu' | 'player'; starts: number; finishes: number; playedDevices: number; finishedDevices: number }>;
}

/** 日子依台北時間（UTC+8）切分 */
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const dayOf = (ts: number) => new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);

const distinct = (values: Iterable<string>) => new Set(values).size;
const median = (sorted: number[]) => {
  if (sorted.length === 0) return 0;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function groupStats(rows: EventRow[]): GroupStats {
  const visits = rows.filter((r) => r.name === 'visit');
  const starts = rows.filter((r) => r.name === 'start');
  const finishes = rows.filter((r) => r.name === 'finish');
  const stays = visits.map((v) => v.active_ms / 1000).sort((a, b) => a - b);
  return {
    visits: visits.length,
    // 人以所有事件去重：造訪被限流沒記到、但有開打的裝置也算一個人
    devices: distinct(rows.map((r) => r.device_id)),
    avgStaySeconds: stays.length ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length) : 0,
    medianStaySeconds: Math.round(median(stays)),
    playedDevices: distinct(starts.map((r) => r.device_id)),
    finishedDevices: distinct(finishes.map((r) => r.device_id)),
    starts: starts.length,
    finishes: finishes.length,
  };
}

const groupBy = <T>(rows: EventRow[], key: (r: EventRow) => T): Map<T, EventRow[]> => {
  const out = new Map<T, EventRow[]>();
  for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r]);
  return out;
};

const compareVersion = (a: string, b: string) => {
  const [pa, pb] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return 0;
};

export function summarize(rows: EventRow[]): Summary {
  // 每個裝置第一次出現的日子；某天第一次出現算新訪客，之前來過算回訪
  const firstDay = new Map<string, string>();
  const visitDays = new Map<string, Set<string>>();
  for (const r of rows) {
    const day = dayOf(r.created_at);
    if (!firstDay.has(r.device_id) || day < firstDay.get(r.device_id)!) firstDay.set(r.device_id, day);
    visitDays.set(r.device_id, (visitDays.get(r.device_id) ?? new Set()).add(day));
  }

  const byDay = [...groupBy(rows, (r) => dayOf(r.created_at))]
    .map(([day, group]) => {
      const visitors = new Set(group.map((r) => r.device_id));
      const newDevices = [...visitors].filter((d) => firstDay.get(d) === day).length;
      return { day, ...groupStats(group), newDevices, returningDevices: visitors.size - newDevices };
    })
    .sort((a, b) => b.day.localeCompare(a.day));

  const byVersion = [...groupBy(rows, (r) => r.version)]
    .map(([version, group]) => ({ version, ...groupStats(group) }))
    .sort((a, b) => compareVersion(a.version, b.version));

  const byOpponent = [...groupBy(rows.filter((r) => r.opponent !== null), (r) => r.opponent as 'cpu' | 'player')]
    .map(([opponent, group]) => {
      const g = groupStats(group);
      return { opponent, starts: g.starts, finishes: g.finishes, playedDevices: g.playedDevices, finishedDevices: g.finishedDevices };
    })
    .sort((a, b) => a.opponent.localeCompare(b.opponent));

  return {
    all: { ...groupStats(rows), returnedDevices: [...visitDays.values()].filter((days) => days.size >= 2).length },
    byDay,
    byVersion,
    byOpponent,
  };
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');
const duration = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`);
const OPPONENT_LABEL = { cpu: '對電腦', player: '對玩家' } as const;

/** 終端機看的文字報告 */
export function formatReport(s: Summary): string {
  const a = s.all;
  if (a.visits === 0 && a.starts === 0) return '還沒有資料。';
  const lines = [
    '【總覽】',
    `造訪次數　${a.visits}`,
    `不重複裝置　${a.devices}（其中 ${a.returnedDevices} 個在 2 天以上來過）`,
    `停留時間　平均 ${duration(a.avgStaySeconds)}，中位數 ${duration(a.medianStaySeconds)}（只算分頁可見的時間，誤差約 30 秒）`,
    `玩過　${a.playedDevices}（${pct(a.playedDevices, a.devices)}）　開始 ${a.starts} 場`,
    `玩完　${a.finishedDevices}（${pct(a.finishedDevices, a.devices)}）　打完 ${a.finishes} 場（開始的場次裡 ${pct(a.finishes, a.starts)}）`,
    '',
    '【每日（台北時間）】日期　　　造訪　裝置　新訪客　回訪　停留中位數　玩過　玩完',
    ...s.byDay.map((d) =>
      [d.day, d.visits, d.devices, d.newDevices, d.returningDevices, duration(d.medianStaySeconds), d.playedDevices, d.finishedDevices].join('　'),
    ),
    '',
    '【依版本】版本　造訪　裝置　停留中位數　玩過　玩完',
    ...s.byVersion.map((v) => [v.version, v.visits, v.devices, duration(v.medianStaySeconds), v.playedDevices, v.finishedDevices].join('　')),
    '',
    '【依對戰類型】類型　開始場次　打完場次　玩過裝置　玩完裝置',
    ...s.byOpponent.map((o) => [OPPONENT_LABEL[o.opponent], o.starts, o.finishes, o.playedDevices, o.finishedDevices].join('　')),
  ];
  return lines.join('\n');
}
