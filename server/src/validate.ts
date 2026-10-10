import { KNOWN_CHARACTERS } from './characters';

/** 伺服器收到的一筆新戰績：對局代號與裝置代號是上傳用的欄位，不會在取得清單時回傳 */
export interface NewRecord {
  matchId: string;
  deviceId: string;
  version: string;
  opponent: 'cpu' | 'player';
  mine: string;
  theirs: string;
  outcome: 'win' | 'lose' | 'draw';
  turns: number;
  first?: boolean;
}

export const VERSION_PATTERN = /^\d{1,4}\.\d{1,5}\.\d{1,6}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** 檢查欄位格式；多餘的欄位直接忽略，缺漏或不合法的欄位回傳說明原因 */
export function validateNewRecord(body: unknown): Validated<NewRecord> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: '內容必須是物件' };
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  if (!ID_PATTERN.test(str('matchId'))) return { ok: false, error: 'matchId 格式不正確' };
  if (!ID_PATTERN.test(str('deviceId'))) return { ok: false, error: 'deviceId 格式不正確' };
  if (!VERSION_PATTERN.test(str('version'))) return { ok: false, error: 'version 格式不正確' };
  if (o.opponent !== 'cpu' && o.opponent !== 'player') return { ok: false, error: 'opponent 必須是 cpu 或 player' };
  if (!KNOWN_CHARACTERS.includes(str('mine'))) return { ok: false, error: 'mine 不是已知的角色' };
  if (!KNOWN_CHARACTERS.includes(str('theirs'))) return { ok: false, error: 'theirs 不是已知的角色' };
  if (o.outcome !== 'win' && o.outcome !== 'lose' && o.outcome !== 'draw') return { ok: false, error: 'outcome 必須是 win、lose 或 draw' };
  if (typeof o.turns !== 'number' || !Number.isInteger(o.turns) || o.turns < 1 || o.turns > 500) return { ok: false, error: 'turns 必須是 1 到 500 的整數' };
  if (o.first !== undefined && typeof o.first !== 'boolean') return { ok: false, error: 'first 必須是布林值' };
  return {
    ok: true,
    value: {
      matchId: str('matchId'), deviceId: str('deviceId'), version: str('version'),
      opponent: o.opponent, mine: str('mine'), theirs: str('theirs'), outcome: o.outcome, turns: o.turns,
      ...(o.first !== undefined && { first: o.first }),
    },
  };
}
