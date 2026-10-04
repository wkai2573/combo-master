import type { Frame, GameView } from '../engine/view';

export interface DeckPayload {
  charId: string;
  cards: string[];
}

/** 訪客 → 房主 */
export type ClientMsg =
  | { t: 'hello'; deck: DeckPayload }
  | { t: 'submit'; keys: string[] }
  | { t: 'ping' };

/** 房主 → 訪客 */
export type HostMsg =
  /** view＝最新狀態；frames＝自上次以來要依序播放的動畫影格 */
  | { t: 'view'; view: GameView; frames: Frame[] }
  | { t: 'reject'; reason: string }
  | { t: 'pong' };

export const ROOM_PREFIX = 'lianji-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** 房號 → peer id */
export const peerIdOf = (code: string) => ROOM_PREFIX + code.trim().toUpperCase();

/** 離線超過這個秒數視為斷線 */
export const OFFLINE_AFTER_MS = 12_000;
/** 斷線後等待多久判負 */
export const FORFEIT_AFTER_S = 30;
export const PING_EVERY_MS = 3_000;
