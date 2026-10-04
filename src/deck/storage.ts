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

function readSaved(): Saved[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Saved[];
    return Array.isArray(arr) ? arr.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.cards)) : [];
  } catch {
    return [];
  }
}

function writeSaved(list: Saved[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
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
