import { ALL_CHARACTERS } from '../data/cards';
import { presetDeck, PRESET_CHARACTER_IDS } from '../data/presetDecks';
import { validateDeck } from './validate';

export interface DeckEntry {
  id: string;
  name: string;
  charId: string;
  cards: string[];
  /** 預設牌組：不可覆寫或刪除，只能複製 */
  preset: boolean;
}

const KEY = 'lianji.decks.v1';

type Saved = Omit<DeckEntry, 'preset'>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 讀不進來的資料：整份不是合法 JSON 陣列，或單筆缺 id、cards 不是陣列。raw 是要給玩家複製的原文 */
export interface CorruptDeck {
  kind: 'whole' | 'entry';
  raw: string;
}

function defaultStorage(): StorageLike | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function isValidSaved(d: unknown): d is Saved {
  return !!d && typeof (d as Saved).id === 'string' && Array.isArray((d as Saved).cards);
}

function entryRaw(d: unknown): string {
  return JSON.stringify(d, null, 2);
}

/** 讀出自訂牌組，並把讀不進來的資料分開回報，不靜默丟棄 */
export function inspectSavedDecks(storage: StorageLike | null = defaultStorage()): { decks: Saved[]; corrupt: CorruptDeck[] } {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { decks: [], corrupt: [] };
    let arr: unknown;
    try {
      arr = JSON.parse(raw);
    } catch {
      return { decks: [], corrupt: [{ kind: 'whole', raw }] };
    }
    if (!Array.isArray(arr)) return { decks: [], corrupt: [{ kind: 'whole', raw }] };
    const decks: Saved[] = [];
    const corrupt: CorruptDeck[] = [];
    for (const d of arr) {
      if (isValidSaved(d)) decks.push(d);
      else corrupt.push({ kind: 'entry', raw: entryRaw(d) });
    }
    return { decks, corrupt };
  } catch {
    return { decks: [], corrupt: [] };
  }
}

/** 刪除一筆損壞資料：整份壞掉就清掉整個 key，單筆壞掉只移除該筆，其餘原樣保留 */
export function discardCorruptDeck(item: CorruptDeck, storage: StorageLike | null = defaultStorage()): void {
  try {
    if (!storage) return;
    const raw = storage.getItem(KEY);
    if (!raw) return;
    if (item.kind === 'whole') {
      // 內容已被改寫（例如另一個分頁存過牌組）就不動，免得刪掉好的資料
      if (raw === item.raw) storage.removeItem(KEY);
      return;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    let removed = false;
    const rest = arr.filter((d) => {
      if (removed || isValidSaved(d) || entryRaw(d) !== item.raw) return true;
      removed = true;
      return false;
    });
    storage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // 儲存失敗：忽略，玩家下次載入仍會看到提示
  }
}

function readSaved(): Saved[] {
  return inspectSavedDecks().decks;
}

function writeSaved(list: Saved[]): void {
  try {
    // 單筆損壞的資料先留著，等玩家在提示裡複製、決定刪除，不能因為存別的牌組就被吃掉
    const kept = inspectSavedDecks().corrupt.filter((c) => c.kind === 'entry').map((c) => JSON.parse(c.raw) as unknown);
    localStorage.setItem(KEY, JSON.stringify([...list, ...kept]));
  } catch {
    // 儲存失敗（私密模式或容量滿）：忽略，介面仍可繼續使用
  }
}

export function presetEntries(): DeckEntry[] {
  return PRESET_CHARACTER_IDS.map((charId) => ({
    id: `preset:${charId}`,
    name: `${charId}（預設）`,
    charId,
    cards: presetDeck(charId),
    preset: true,
  }));
}

export function listDecks(): DeckEntry[] {
  return [...presetEntries(), ...readSaved().map((d) => ({ ...d, preset: false }))];
}

export function getDeck(id: string): DeckEntry | undefined {
  return listDecks().find((d) => d.id === id);
}

export function saveDeck(deck: { id?: string; name: string; charId: string; cards: string[] }): DeckEntry {
  const list = readSaved();
  const id = deck.id && !deck.id.startsWith('preset:') ? deck.id : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entry: Saved = { id, name: deck.name.trim() || '未命名牌組', charId: deck.charId, cards: [...deck.cards] };
  const i = list.findIndex((d) => d.id === id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  writeSaved(list);
  return { ...entry, preset: false };
}

export function deleteDeck(id: string): void {
  writeSaved(readSaved().filter((d) => d.id !== id));
}

export function exportDeck(d: { name: string; charId: string; cards: string[] }): string {
  return JSON.stringify({ name: d.name, charId: d.charId, cards: d.cards }, null, 2);
}

export function importDeck(text: string): { ok: true; deck: { name: string; charId: string; cards: string[] } } | { ok: false; error: string } {
  try {
    const o = JSON.parse(text) as { name?: unknown; charId?: unknown; cards?: unknown };
    if (typeof o.charId !== 'string' || !Array.isArray(o.cards) || o.cards.some((c) => typeof c !== 'string')) {
      return { ok: false, error: '格式不正確，需要 charId 與 cards 陣列' };
    }
    if (!ALL_CHARACTERS.some((c) => c.id === o.charId)) return { ok: false, error: `未知的角色：${o.charId}` };
    return { ok: true, deck: { name: typeof o.name === 'string' ? o.name : '匯入的牌組', charId: o.charId, cards: o.cards as string[] } };
  } catch {
    return { ok: false, error: '不是有效的 JSON' };
  }
}

/** 可用於對戰的牌組（通過驗證） */
export function playableDecks(): DeckEntry[] {
  return listDecks().filter((d) => validateDeck(d.charId, d.cards).ok);
}
